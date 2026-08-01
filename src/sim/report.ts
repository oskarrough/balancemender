import type {CombatLogEvent} from '../combatlog'
import type {GameLoop} from '../nodes/game-loop'
import type {UnitId} from '../nodes/unit-registry'
import {accumulateEvents, isDamage, isHeal} from './report-analysis'

export type Outcome = 'victory' | 'defeat' | 'timeout'

/** Who was in a fight. Not a `Room` — that is the plan you spawn *from*. */
export interface UnitInfo {
	id: string
	name: string
	maxHealth: number
	faction: string
	/** The registry id, so a stored fight can still be read back against the unit registry. */
	unitId?: UnitId
}

/** Who is in this fight — the analyzer needs starting health to rebuild the health graph. */
export function unitsOf(game: GameLoop): UnitInfo[] {
	return game.fight.units.map((c) => ({
		id: c.id,
		name: c.name || c.constructor.name,
		maxHealth: c.health.max,
		faction: c.faction,
		unitId: c.unitId,
	}))
}

/**
 * Everything in here is a pure function over a combat log. That is the point: a fight
 * simulated in a terminal and a fight played in the browser produce the same events, so
 * they get read by the same code.
 */

export interface UnitStats {
	/** The unit's id. Names change mid-fight — `Fight.renumber()` sees to that. */
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
	 * Damage this unit's barriers swallowed before it reached a health bar. Credited to the
	 * barrier's caster, the way `healingDone` credits the healer rather than the target.
	 */
	absorbed: number
	/**
	 * Absorption a barrier lost unspent, to a timeout or a refresh. Overheal's counterpart for a
	 * preventive ability: without it, a barrier that expired untouched and one that soaked a killing
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

/**
 * One use of an ability, totalled from every heal event carrying its `castId`. What the per-ability
 * row cannot say: Renew overhealing 40% overall is descriptive, *this* Renew landing on a full
 * health bar is a cast that did nothing.
 */
export interface CastStats {
	castId: string
	abilityId: string
	abilityName: string
	/** Milliseconds into the fight when this use first landed something. */
	time: number
	total: number
	overheal: number
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
	/** The healing casts that did the least, highest overheal ratio first. Empty when none overhealed. */
	worstCasts: CastStats[]
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
	const {units, outcome, columns = 40} = options
	const sorted = [...events].sort((a, b) => at(a) - at(b))
	const start = sorted.length ? at(sorted[0]) : 0
	const duration = options.duration ?? (sorted.length ? at(sorted[sorted.length - 1]) - start : 0)
	const {totals, ...rows} = accumulateEvents(sorted, {units, start, duration})

	return {
		duration,
		events: sorted.length,
		outcome,
		...rows,
		health: units ? healthSeries(sorted, units, start, duration, columns) : [],
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
		const delta = isDamage(event.eventType)
			? -(event.value ?? 0)
			: isHeal(event.eventType)
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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))
