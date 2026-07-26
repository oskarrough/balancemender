import type {CombatEventType, CombatLogEvent} from '../combatlog'
import type {Outcome, UnitInfo} from './run'

/**
 * Everything in here is a pure function over a combat log. That is the point: a fight
 * simulated in a terminal and a fight played in the browser produce the same events, so
 * they get read by the same code.
 */

const DAMAGE: CombatEventType[] = ['SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE', 'SWING_DAMAGE', 'RANGE_DAMAGE']
const HEAL: CombatEventType[] = ['SPELL_HEAL', 'SPELL_PERIODIC_HEAL']

export interface ActorStats {
	/** The unit's id. Names change mid-fight — `Encounter.renumber()` sees to that. */
	id?: string
	name: string
	faction?: string
	damageDone: number
	damageTaken: number
	healingDone: number
	/** Healing that landed on a full health bar and did nothing. */
	overhealing: number
	healingTaken: number
	casts: number
	hits: number
	manaSpent: number
	deathTime?: number
}

export interface SpellStats {
	name: string
	casts: number
	/** Times the spell actually landed (a HoT lands many times per cast). */
	hits: number
	total: number
	overheal: number
	min: number
	max: number
	avg: number
}

export interface Series {
	id: string
	name: string
	faction: string
	maxHealth: number
	/** Health percentage over the fight, one entry per column. */
	points: number[]
	endHealth: number
}

export interface FightReport {
	duration: number
	events: number
	outcome?: Outcome
	actors: ActorStats[]
	spells: SpellStats[]
	deaths: {id?: string; name: string; time: number}[]
	health: Series[]
	totals: {damage: number; healing: number; overhealing: number; dps: number; hps: number}
}

export interface AnalyzeOptions {
	roster?: UnitInfo[]
	outcome?: Outcome
	duration?: number
	/** Resolution of the health graph. */
	columns?: number
}

const at = (event: CombatLogEvent) => event.time ?? event.timestamp

export function analyze(events: CombatLogEvent[], options: AnalyzeOptions = {}): FightReport {
	const {roster, outcome, columns = 40} = options
	const sorted = [...events].sort((a, b) => at(a) - at(b))
	const start = sorted.length ? at(sorted[0]) : 0
	const duration = options.duration ?? (sorted.length ? at(sorted[sorted.length - 1]) - start : 0)

	const actors = new Map<string, ActorStats>()
	const spells = new Map<string, SpellStats>()
	const deaths: {id?: string; name: string; time: number}[] = []
	const source = (event: CombatLogEvent) => actor(actors, event.sourceId, event.sourceName)
	const target = (event: CombatLogEvent) => actor(actors, event.targetId, event.targetName)

	for (const event of sorted) {
		const value = event.value ?? 0
		const overheal = event.overheal ?? 0

		if (DAMAGE.includes(event.eventType)) {
			const attacker = source(event)
			attacker.damageDone += value
			attacker.hits++
			target(event).damageTaken += value
			spell(spells, event.spellName, value, 0)
		} else if (HEAL.includes(event.eventType)) {
			const healer = source(event)
			healer.healingDone += value - overheal
			healer.overhealing += overheal
			target(event).healingTaken += value - overheal
			spell(spells, event.spellName, value, overheal)
		} else if (event.eventType === 'SPELL_CAST_SUCCESS') {
			source(event).casts++
			const stats = spell(spells, event.spellName, 0, 0)
			stats.casts++
		} else if (event.eventType === 'RESOURCE_SPENT') {
			source(event).manaSpent += Math.abs(value)
		} else if (event.eventType === 'UNIT_DIED' && event.targetName) {
			const time = at(event) - start
			deaths.push({id: event.targetId, name: event.targetName, time})
			target(event).deathTime = time
		}
	}

	// The roster is the authority on who is who. It also carries the *current* name, which
	// matters because spawning a second wolf renames the first one halfway through the log.
	if (roster) {
		for (const entry of roster) {
			const stats = actor(actors, entry.id, entry.name)
			stats.name = entry.name
			stats.faction = entry.faction
		}
	}

	const list = [...actors.values()].filter((a) => a.name !== 'unknown')
	const totals = {
		damage: sum(list, (a) => a.damageDone),
		healing: sum(list, (a) => a.healingDone),
		overhealing: sum(list, (a) => a.overhealing),
		dps: 0,
		hps: 0,
	}
	const seconds = duration / 1000 || 1
	totals.dps = round(totals.damage / seconds)
	totals.hps = round(totals.healing / seconds)

	return {
		duration,
		events: sorted.length,
		outcome,
		actors: list.sort((a, b) => b.damageDone + b.healingDone - (a.damageDone + a.healingDone)),
		spells: [...spells.values()].filter((s) => s.name !== 'unknown').sort((a, b) => b.total - a.total),
		deaths,
		health: roster ? healthSeries(sorted, roster, start, duration, columns) : [],
		totals,
	}
}

/**
 * Replay the log against the roster's starting health to get a health graph per unit.
 * The log holds every hit and heal, so the bars can be rebuilt without recording them.
 */
export function healthSeries(
	events: CombatLogEvent[],
	roster: UnitInfo[],
	start: number,
	duration: number,
	columns: number,
): Series[] {
	const current = new Map(roster.map((unit) => [unit.id, unit.maxHealth]))
	const points = new Map(roster.map((unit) => [unit.id, Array.from<number | null>({length: columns}).fill(null)]))
	const column = (time: number) => Math.min(columns - 1, Math.floor(((time - start) / (duration || 1)) * columns))

	for (const event of events) {
		if (!event.targetId || !current.has(event.targetId)) continue
		const unit = roster.find((u) => u.id === event.targetId)
		if (!unit) continue
		const delta = DAMAGE.includes(event.eventType)
			? -(event.value ?? 0)
			: HEAL.includes(event.eventType)
				? (event.value ?? 0) - (event.overheal ?? 0)
				: 0
		if (!delta) continue
		const next = clamp((current.get(event.targetId) ?? 0) + delta, 0, unit.maxHealth)
		current.set(event.targetId, next)
		points.get(event.targetId)![column(at(event))] = next / unit.maxHealth
	}

	return roster.map((unit) => ({
		id: unit.id,
		name: unit.name,
		faction: unit.faction,
		maxHealth: unit.maxHealth,
		points: fill(points.get(unit.id) ?? []),
		endHealth: current.get(unit.id) ?? unit.maxHealth,
	}))
}

/** Columns where nothing happened keep the previous value; before anything happens, full health. */
function fill(points: (number | null)[]) {
	let last = 1
	return points.map((point) => {
		if (point === null) return last
		last = point
		return point
	})
}

/**
 * One row per unit, keyed by id. Every event the game logs carries one; the name is only a
 * label, and two units can share it for the moment between a spawn and the renumbering.
 */
function actor(actors: Map<string, ActorStats>, id?: string, name = 'unknown') {
	const key = id ?? name
	let stats = actors.get(key)
	if (!stats) {
		stats = {
			id,
			name,
			damageDone: 0,
			damageTaken: 0,
			healingDone: 0,
			overhealing: 0,
			healingTaken: 0,
			casts: 0,
			hits: 0,
			manaSpent: 0,
		}
		actors.set(key, stats)
	}
	return stats
}

function spell(spells: Map<string, SpellStats>, name = 'unknown', value: number, overheal: number) {
	let stats = spells.get(name)
	if (!stats) {
		stats = {name, casts: 0, hits: 0, total: 0, overheal: 0, min: Infinity, max: 0, avg: 0}
		spells.set(name, stats)
	}
	if (value) {
		stats.hits++
		stats.total += value
		stats.overheal += overheal
		stats.min = Math.min(stats.min, value)
		stats.max = Math.max(stats.max, value)
		stats.avg = round(stats.total / stats.hits)
	}
	return stats
}

const sum = <T>(items: T[], get: (item: T) => number) => items.reduce((total, item) => total + get(item), 0)
const round = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))
