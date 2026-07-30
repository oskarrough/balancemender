import type {CombatEventType, CombatLogEvent} from '../combatlog'
import type {GameLoop} from '../nodes/game-loop'

export type Outcome = 'victory' | 'defeat' | 'timeout'

/** Who was in a fight. Not a `Roster` — that is the spec you spawn *from*. */
export interface UnitInfo {
	id: string
	name: string
	maxHealth: number
	faction: string
}

/** Who is in this fight — the analyzer needs starting health to rebuild the health graph. */
export function unitsOf(game: GameLoop): UnitInfo[] {
	return game.encounter.units.map((c) => ({
		id: c.id,
		name: c.name || c.constructor.name,
		maxHealth: c.health.max,
		faction: c.faction,
	}))
}

/**
 * Everything in here is a pure function over a combat log. That is the point: a fight
 * simulated in a terminal and a fight played in the browser produce the same events, so
 * they get read by the same code.
 */

const DAMAGE: CombatEventType[] = ['SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE', 'SWING_DAMAGE', 'RANGE_DAMAGE']
const HEAL: CombatEventType[] = ['SPELL_HEAL', 'SPELL_PERIODIC_HEAL']
/** Both carry `wasted` when the aura was a shield with pool left — see `ShieldAura.removalFields`. */
const AURA_ENDED: CombatEventType[] = ['SPELL_AURA_REMOVED', 'SPELL_AURA_REFRESH']

export interface UnitStats {
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
	/**
	 * Damage this unit's shields swallowed before it reached a health bar. Credited to the
	 * shield's caster, the way `healingDone` credits the healer rather than the target.
	 */
	absorbed: number
	/**
	 * Absorption a shield lost unspent, to a timeout or a recast. Overheal's counterpart for a
	 * preventive spell: without it, a shield that expired untouched and one that soaked a killing
	 * blow read the same.
	 */
	wasted: number
	casts: number
	hits: number
	manaSpent: number
	/**
	 * Milliseconds this unit spent committed to a cast or its global cooldown. Against the fight's
	 * duration it answers what a cast count cannot: was this healer out of time, or out of mana?
	 */
	busyTime: number
	/**
	 * Milliseconds this unit spent below the injured threshold. What separates a fight the healer
	 * won from one that was never in doubt, however much healing landed.
	 */
	injuredTime: number
	deathTime?: number
}

export interface AbilityStats {
	/** Stable key. Renaming an ability must not split its history into two rows. */
	id: string
	name: string
	casts: number
	/** Times the ability actually landed (a HoT lands many times per cast). */
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

export interface Death {
	id?: string
	name: string
	/** Milliseconds into the fight. */
	time: number
}

export interface FightReport {
	duration: number
	events: number
	outcome?: Outcome
	units: UnitStats[]
	abilities: AbilityStats[]
	deaths: Death[]
	health: Series[]
	totals: {damage: number; healing: number; overhealing: number; dps: number; hps: number}
}

export interface AnalyzeOptions {
	units?: UnitInfo[]
	outcome?: Outcome
	duration?: number
	/** Resolution of the health graph. */
	columns?: number
}

const at = (event: CombatLogEvent) => event.time ?? event.timestamp

export function analyze(events: CombatLogEvent[], options: AnalyzeOptions = {}): FightReport {
	const {units: unitInfo, outcome, columns = 40} = options
	const sorted = [...events].sort((a, b) => at(a) - at(b))
	const start = sorted.length ? at(sorted[0]) : 0
	const duration = options.duration ?? (sorted.length ? at(sorted[sorted.length - 1]) - start : 0)

	const units = new Map<string, UnitStats>()
	const abilities = new Map<string, AbilityStats>()
	const deaths: Death[] = []
	const source = (event: CombatLogEvent) => unit(units, event.sourceId, event.sourceName)
	const target = (event: CombatLogEvent) => unit(units, event.targetId, event.targetName)
	/** When each unit currently below the injured line dropped there. Empty means nobody is. */
	const injuredSince = new Map<UnitStats, number>()
	const leaveInjured = (stats: UnitStats, time: number) => {
		const since = injuredSince.get(stats)
		if (since === undefined) return
		stats.injuredTime += time - since
		injuredSince.delete(stats)
	}

	for (const event of sorted) {
		const value = event.value ?? 0
		const overheal = event.overheal ?? 0

		if (DAMAGE.includes(event.eventType)) {
			const attacker = source(event)
			attacker.damageDone += value
			attacker.hits++
			target(event).damageTaken += value
			ability(abilities, event.abilityId, event.abilityName, value, 0)
		} else if (HEAL.includes(event.eventType)) {
			const healer = source(event)
			healer.healingDone += value - overheal
			healer.overhealing += overheal
			target(event).healingTaken += value - overheal
			ability(abilities, event.abilityId, event.abilityName, value, overheal)
		} else if (event.eventType === 'SPELL_ABSORBED') {
			// Credited to the shield's caster, the way healing is — see `ShieldAura.absorb`.
			source(event).absorbed += value
			ability(abilities, event.abilityId, event.abilityName, value, 0)
		} else if (AURA_ENDED.includes(event.eventType)) {
			// `wasted` is only present on a shield's own removal/refresh — everything else in
			// `AURA_ENDED` leaves it undefined, so this is a no-op for periodic auras.
			if (event.wasted) source(event).wasted += event.wasted
		} else if (event.eventType === 'SPELL_CAST_START') {
			// Counted at the start, not the success: an interrupted cast still cost the caster the
			// time it spent casting.
			source(event).busyTime += event.busyFor ?? 0
		} else if (event.eventType === 'SPELL_CAST_SUCCESS') {
			source(event).casts++
			const stats = ability(abilities, event.abilityId, event.abilityName, 0, 0)
			stats.casts++
		} else if (event.eventType === 'RESOURCE_SPENT') {
			source(event).manaSpent += Math.abs(value)
		} else if (event.eventType === 'UNIT_CONDITION') {
			const stats = target(event)
			if (event.condition === 'injured') {
				// Guarded rather than overwritten: two "injured" in a row would otherwise restart
				// the clock and lose everything before the second one.
				if (!injuredSince.has(stats)) injuredSince.set(stats, at(event))
			} else {
				leaveInjured(stats, at(event))
			}
		} else if (event.eventType === 'UNIT_DIED' && event.targetName) {
			const time = at(event) - start
			const stats = target(event)
			deaths.push({id: event.targetId, name: event.targetName, time})
			stats.deathTime = time
			// A killing blow deliberately logs no condition change, so a unit that died injured
			// still has an interval open. Dying ends it — a corpse is not in danger.
			leaveInjured(stats, at(event))
		}
	}

	// Units spawn at full health, so anyone still injured at the last event has been since their
	// last crossing. The fight's end closes the interval.
	for (const [stats, since] of injuredSince) stats.injuredTime += start + duration - since

	// The units are the authority on who is who. The list also carries the *current* name,
	// which matters because spawning a second wolf renames the first one halfway through the log.
	if (unitInfo) {
		for (const entry of unitInfo) {
			const stats = unit(units, entry.id, entry.name)
			stats.name = entry.name
			stats.faction = entry.faction
		}
	}

	// Logs and combat state keep their full precision. A report is the presentation boundary, so
	// clean up accumulated IEEE-754 noise here once rather than teaching every renderer about it.
	for (const stats of units.values()) {
		stats.damageDone = round(stats.damageDone)
		stats.damageTaken = round(stats.damageTaken)
		stats.healingDone = round(stats.healingDone)
		stats.overhealing = round(stats.overhealing)
		stats.healingTaken = round(stats.healingTaken)
		stats.absorbed = round(stats.absorbed)
		stats.wasted = round(stats.wasted)
		stats.manaSpent = round(stats.manaSpent)
	}
	for (const stats of abilities.values()) {
		stats.total = round(stats.total)
		stats.overheal = round(stats.overheal)
		stats.min = round(stats.min)
		stats.max = round(stats.max)
		stats.avg = round(stats.avg)
	}

	const list = [...units.values()].filter((a) => a.name !== 'unknown')
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
		units: list.sort((a, b) => b.damageDone + b.healingDone - (a.damageDone + a.healingDone)),
		abilities: [...abilities.values()].filter((a) => a.id !== 'unknown').sort((a, b) => b.total - a.total),
		deaths,
		health: unitInfo ? healthSeries(sorted, unitInfo, start, duration, columns) : [],
		totals,
	}
}

/**
 * Replay the log against the units' starting health to get a health graph per unit.
 * The log holds every hit and heal, so the bars can be rebuilt without recording them.
 */
export function healthSeries(
	events: CombatLogEvent[],
	units: UnitInfo[],
	start: number,
	duration: number,
	columns: number,
): Series[] {
	const byId = new Map(units.map((unit) => [unit.id, unit]))
	const current = new Map(units.map((unit) => [unit.id, unit.maxHealth]))
	const points = new Map(units.map((unit) => [unit.id, Array.from<number | null>({length: columns}).fill(null)]))
	const column = (time: number) => Math.min(columns - 1, Math.floor(((time - start) / (duration || 1)) * columns))

	for (const event of events) {
		const unit = event.targetId ? byId.get(event.targetId) : undefined
		if (!unit) continue
		const delta = DAMAGE.includes(event.eventType)
			? -(event.value ?? 0)
			: HEAL.includes(event.eventType)
				? (event.value ?? 0) - (event.overheal ?? 0)
				: 0
		if (!delta) continue
		const next = clamp((current.get(unit.id) ?? 0) + delta, 0, unit.maxHealth)
		current.set(unit.id, next)
		points.get(unit.id)![column(at(event))] = next / unit.maxHealth
	}

	return units.map((unit) => ({
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
function unit(units: Map<string, UnitStats>, id?: string, name = 'unknown') {
	const key = id ?? name
	let stats = units.get(key)
	if (!stats) {
		stats = {
			id,
			name,
			damageDone: 0,
			damageTaken: 0,
			healingDone: 0,
			overhealing: 0,
			healingTaken: 0,
			absorbed: 0,
			wasted: 0,
			casts: 0,
			hits: 0,
			manaSpent: 0,
			busyTime: 0,
			injuredTime: 0,
		}
		units.set(key, stats)
	}
	return stats
}

/**
 * Keyed by `abilityId`, displayed by `abilityName` — the same id/name split the units use, and
 * for the same reason: the id is what stays put. `Renew`'s cast and the ticks its aura lands share
 * an id deliberately, so they total into one row.
 */
function ability(abilities: Map<string, AbilityStats>, id = 'unknown', name = id, value: number, overheal: number) {
	let stats = abilities.get(id)
	if (!stats) {
		stats = {id, name, casts: 0, hits: 0, total: 0, overheal: 0, min: Infinity, max: 0, avg: 0}
		abilities.set(id, stats)
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

/**
 * The unit the bot drives. By name, unusually: `runFight` adds the healer itself and calls it
 * Player, and it is the one unit `renumber()` never touches, so the name is stable here.
 */
export const healerOf = (report: FightReport) => report.units.find((unit) => unit.name === 'Player')

/**
 * How long the party's worst-off member spent injured — was anyone ever actually in trouble?
 *
 * The worst member rather than the sum, so a bigger party does not read as a more dangerous fight.
 * Needs the unit list: `faction` comes from there, not from the log.
 */
export const partyInjuredTime = (report: FightReport) =>
	Math.max(0, ...report.units.filter((unit) => unit.faction === 'party').map((unit) => unit.injuredTime))

/**
 * Half the 95% interval on `part/whole`, in points — how far a rate this size could have landed
 * from the truth by luck alone.
 *
 * Wilson rather than the textbook `sqrt(p(1-p)/n)`, which collapses to ±0 at a clean sweep and so
 * claims certainty from five wins in five. 0 out of 25 comes out ±7, which is the honest answer.
 */
export function margin(part: number, whole: number) {
	if (whole <= 0) return 0
	const z = 1.96
	const p = part / whole
	const half = (z / (1 + (z * z) / whole)) * Math.sqrt((p * (1 - p)) / whole + (z * z) / (4 * whole * whole))
	return Math.round(half * 100)
}

const sum = <T>(items: T[], get: (item: T) => number) => items.reduce((total, item) => total + get(item), 0)
const round = (n: number) => Math.round(n * 10) / 10
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))
