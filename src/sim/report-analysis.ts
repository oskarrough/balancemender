import type {CombatEventType, CombatLogEvent} from '../combatlog'
import {roundOne} from '../utils'
import type {AbilityStats, CastStats, Death, UnitInfo, UnitStats} from './report'

const DAMAGE: CombatEventType[] = ['SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE', 'SWING_DAMAGE', 'RANGE_DAMAGE']
const HEAL: CombatEventType[] = ['SPELL_HEAL', 'SPELL_PERIODIC_HEAL']
export const isDamage = (eventType: CombatEventType) => DAMAGE.includes(eventType)
export const isHeal = (eventType: CombatEventType) => HEAL.includes(eventType)
/** Both carry `wasted` when a barrier has pool left — see `BarrierAura.removalFields`. */
const AURA_ENDED: CombatEventType[] = ['SPELL_AURA_REMOVED', 'SPELL_AURA_REFRESH']

interface AccumulateOptions {
	units?: readonly UnitInfo[]
	start: number
	duration: number
}

interface AnalysisSummary {
	units: UnitStats[]
	abilities: AbilityStats[]
	worstCasts: CastStats[]
	deaths: Death[]
	totals: {damage: number; healing: number; overhealing: number; dps: number; hps: number}
}

/** Reduce the combat log into report rows, then finish their presentation values. */
export function accumulateEvents(events: CombatLogEvent[], options: AccumulateOptions): AnalysisSummary {
	const units = new Map<string, UnitStats>()
	const abilities = new Map<string, AbilityStats>()
	const casts = new Map<string, CastStats>()
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

	for (const event of events) {
		const value = event.value ?? 0
		const overheal = event.overheal ?? 0

		if (isDamage(event.eventType)) {
			const attacker = source(event)
			attacker.damageDone += value
			attacker.hits++
			target(event).damageTaken += value
			ability(abilities, event.abilityId, event.abilityName, value, 0)
		} else if (isHeal(event.eventType)) {
			const healer = source(event)
			healer.healingDone += value - overheal
			healer.overhealing += overheal
			target(event).healingTaken += value - overheal
			ability(abilities, event.abilityId, event.abilityName, value, overheal)
			cast(casts, event, at(event) - options.start, value, overheal)
		} else if (event.eventType === 'SPELL_ABSORBED') {
			// Credited to the barrier's caster, the way healing is — see `BarrierAura.absorb`.
			source(event).absorbed += value
			ability(abilities, event.abilityId, event.abilityName, value, 0)
		} else if (AURA_ENDED.includes(event.eventType)) {
			// `wasted` is only present on a barrier's own removal/refresh — everything else in
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
		} else if (event.eventType === 'RESOURCE_GAIN') {
			source(event).manaGained += Math.max(0, value)
		} else if (event.eventType === 'RESOURCE_SPENT') {
			const amount = Math.abs(value)
			const stats = source(event)
			if (event.targetId) stats.manaBurned += amount
			else stats.manaSpent += amount
			if (event.abilityId) ability(abilities, event.abilityId, event.abilityName, 0, 0).manaSpent += amount
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
			const time = at(event) - options.start
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
	for (const [stats, since] of injuredSince) stats.injuredTime += options.start + options.duration - since

	return finalize(units, abilities, casts, deaths, options)
}

function finalize(
	units: Map<string, UnitStats>,
	abilities: Map<string, AbilityStats>,
	casts: Map<string, CastStats>,
	deaths: Death[],
	options: AccumulateOptions,
): AnalysisSummary {
	// The units are the authority on who is who. The list also carries the *current* name,
	// which matters because spawning a second wolf renames the first one halfway through the log.
	if (options.units) {
		for (const entry of options.units) {
			const stats = unit(units, entry.id, entry.name)
			stats.name = entry.name
			stats.faction = entry.faction
			if (entry.maxMana !== undefined) stats.maxMana = entry.maxMana
			if (entry.endMana !== undefined) stats.endMana = entry.endMana
		}
	}

	// Logs and combat state keep their full precision. A report is the presentation boundary, so
	// clean up accumulated IEEE-754 noise here once rather than teaching every renderer about it.
	for (const stats of units.values()) {
		stats.damageDone = roundOne(stats.damageDone)
		stats.damageTaken = roundOne(stats.damageTaken)
		stats.healingDone = roundOne(stats.healingDone)
		stats.overhealing = roundOne(stats.overhealing)
		stats.healingTaken = roundOne(stats.healingTaken)
		stats.absorbed = roundOne(stats.absorbed)
		stats.wasted = roundOne(stats.wasted)
		stats.manaSpent = roundOne(stats.manaSpent)
		stats.manaBurned = roundOne(stats.manaBurned)
		stats.manaGained = roundOne(stats.manaGained)
		stats.manaNet = roundOne(stats.manaGained - stats.manaSpent - stats.manaBurned)
	}
	for (const stats of abilities.values()) {
		stats.avg = stats.hits ? roundOne(stats.total / stats.hits) : 0
		stats.total = roundOne(stats.total)
		stats.overheal = roundOne(stats.overheal)
		stats.manaSpent = roundOne(stats.manaSpent)
		stats.min = roundOne(stats.min)
		stats.max = roundOne(stats.max)
	}

	// Ratio first, so a fully wasted Renew outranks a big heal that mostly landed; the amount only
	// breaks ties. Capped because the point is the worst offenders, not a per-cast ledger.
	const worstCasts = [...casts.values()]
		.filter((cast) => cast.overheal > 0)
		.sort((a, b) => b.overheal / b.total - a.overheal / a.total || b.overheal - a.overheal)
		.slice(0, 5)
	for (const cast of worstCasts) {
		cast.time = Math.round(cast.time)
		cast.total = roundOne(cast.total)
		cast.overheal = roundOne(cast.overheal)
	}

	const list = [...units.values()].filter((unit) => unit.name !== 'unknown')
	const totals = {
		damage: sum(list, (unit) => unit.damageDone),
		healing: sum(list, (unit) => unit.healingDone),
		overhealing: sum(list, (unit) => unit.overhealing),
		dps: 0,
		hps: 0,
	}
	const seconds = options.duration / 1000 || 1
	totals.dps = roundOne(totals.damage / seconds)
	totals.hps = roundOne(totals.healing / seconds)

	return {
		units: list.sort((a, b) => b.damageDone + b.healingDone - (a.damageDone + a.healingDone)),
		abilities: [...abilities.values()].filter((ability) => ability.id !== 'unknown').sort((a, b) => b.total - a.total),
		worstCasts,
		deaths,
		totals,
	}
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
			manaBurned: 0,
			manaGained: 0,
			manaNet: 0,
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
		stats = {id, name, casts: 0, hits: 0, total: 0, overheal: 0, manaSpent: 0, min: Infinity, max: 0, avg: 0}
		abilities.set(id, stats)
	}
	if (value) {
		stats.hits++
		stats.total += value
		stats.overheal += overheal
		stats.min = Math.min(stats.min, value)
		stats.max = Math.max(stats.max, value)
	}
	return stats
}

/** One row per healing cast, keyed by `castId`. Only events that carry one land here. */
function cast(casts: Map<string, CastStats>, event: CombatLogEvent, time: number, value: number, overheal: number) {
	if (!event.castId) return
	let stats = casts.get(event.castId)
	if (!stats) {
		stats = {
			castId: event.castId,
			abilityId: event.abilityId ?? 'unknown',
			abilityName: event.abilityName ?? 'unknown',
			time,
			total: 0,
			overheal: 0,
		}
		casts.set(event.castId, stats)
	}
	stats.total += value
	stats.overheal += overheal
}

/**
 * When an event happened, in fight time. The one place the clock is chosen — `report.ts` reads it
 * from here so a report and its graph cannot end up on two different clocks.
 *
 * Never falls back to `timestamp`: that is wall clock, and mixing an epoch number into fight-time
 * arithmetic does not degrade, it produces nonsense — one unstamped event among stamped ones puts
 * the fight's end 56 years after its start. `CombatLog.add()` fills `time` for every event it
 * takes, so 0 is only reachable by hand-building an event and skipping the log.
 */
export const at = (event: CombatLogEvent) => event.time ?? 0
const sum = <T>(items: T[], get: (item: T) => number) => items.reduce((total, item) => total + get(item), 0)
