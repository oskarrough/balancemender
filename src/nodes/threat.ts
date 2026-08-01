import {damageThreatWeight, healMarkThreatWeight} from './heal-mark'
import type {Unit} from './unit'

/** Each enemy remembers how much attention every opposing unit has earned. */
export type ThreatTable = Map<Unit, number>

/** Healing is noticed less than damage, and every observing enemy shares it. */
export const HEALING_THREAT_MULTIPLIER = 0.5

/** Aggro is sticky: a challenger must move clearly ahead of the current target. */
export const AGGRO_PULL_MULTIPLIER = 1.1

export function addThreat(table: ThreatTable, unit: Unit, amount: number) {
	if (amount <= 0) return
	table.set(unit, (table.get(unit) ?? 0) + amount)
}

/** Highest threat wins; an exact tie keeps fight order stable. */
export function highestThreat(table: ThreatTable, candidates: Unit[]): Unit | undefined {
	let highest: Unit | undefined
	for (const candidate of candidates) {
		if (!highest || (table.get(candidate) ?? 0) > (table.get(highest) ?? 0)) highest = candidate
	}
	return highest
}

/** Whether somebody has earned enough threat to pull aggro from the current target. */
export function pullsAggro(table: ThreatTable, current: Unit, candidates: Unit[]): boolean {
	const challenger = highestThreat(table, candidates)
	if (!challenger || challenger === current) return false
	return (table.get(challenger) ?? 0) > (table.get(current) ?? 0) * AGGRO_PULL_MULTIPLIER
}

/**
 * Credit one landed health change.
 *
 * Damage belongs only to the enemy it landed on. Effective healing is divided between every
 * living enemy observing the healer; overhealing never reaches this function because it did not
 * move a health bar.
 *
 * Heal-mark: while the healer carries a HealMarkGate, heal threat is credited to the *patient* at
 * the gate's mark weight. A ThreatMark on a unit then multiplies that ally's damage threat for its
 * lifetime — lasting weight, not a one-shot dump. See `heal-mark.ts`.
 */
export function generateThreat(source: Unit, target: Unit, landed: number, healing: boolean, threatMultiplier = 1) {
	if (!healing) {
		const generated = landed * threatMultiplier * damageThreatWeight(source)
		if (generated <= 0) return
		if (target.threat) addThreat(target.threat, source, generated)
		return
	}

	const markWeight = healMarkThreatWeight(source)
	const noticed = markWeight !== undefined ? target : source
	const generated = landed * threatMultiplier * (markWeight ?? 1)
	if (generated <= 0) return

	const observers = source.parent.units.flatMap((unit) =>
		unit.alive && unit.faction !== source.faction && unit.threat ? [unit.threat] : [],
	)
	if (observers.length === 0) return
	const shared = (generated * HEALING_THREAT_MULTIPLIER) / observers.length
	for (const observer of observers) addThreat(observer, noticed, shared)
}
