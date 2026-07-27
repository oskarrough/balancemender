import {logCombat, CombatEventType} from '../combatlog'
import {fct} from '../components/floating-combat-text'
import {ShieldAura} from './shield-aura'
import type {Unit} from './unit'

export interface Hit {
	/** Who to credit it to. */
	source: Unit
	target: Unit
	/** Positive heals, negative damages. */
	amount: number
	/** The spell, attack or aura it came from: its stable `id` and its display `name`. */
	abilityId: string
	abilityName: string
	eventType: CombatEventType
}

/**
 * The one door for changing a health bar. Every effect and every periodic aura comes
 * through here, so nothing can land without a floating number and a combat log entry —
 * the Combat log panel, the Fight report and the simulator all read that log, and a
 * mechanic missing from it is invisible to all three at once.
 *
 * Returns what actually landed, which is less than `amount` when a heal tops off a full bar.
 */
export function applyHit({source, target, amount: incoming, abilityId, abilityName, eventType}: Hit): number {
	// Shields take their share before anything else in this function runs. That is the whole
	// trick: `landed`, the floating number and the death check below all follow from what got
	// through, so none of the three has to know shields exist and a killing blow is decided on
	// the damage that was actually dealt.
	const amount = throughShields(target, incoming)

	const before = target.health.current
	const conditionBefore = target.condition
	if (amount >= 0) target.health.heal(amount)
	else target.health.damage(-amount)
	const landed = Math.abs(target.health.current - before)

	// A fully absorbed hit moved nothing, and `-0` floating over the unit would claim otherwise.
	if (amount !== 0) fct(target.id, amount >= 0 ? `+${amount}` : `-${-amount}`)

	const actors = {
		sourceId: source.id,
		sourceName: source.name,
		targetId: target.id,
		targetName: target.name || 'Unknown',
		abilityId,
		abilityName,
	}

	logCombat({
		timestamp: Date.now(),
		eventType,
		...actors,
		value: Math.abs(amount),
		// Only heals can overheal, and reporting `0` on every hit would say they can't.
		...(amount > 0 && {overheal: amount - landed}),
	})

	// Recorded here rather than by whatever swung, so a death by any means is logged exactly
	// once — the `before > 0` is what makes hitting a corpse not announce it again.
	//
	// Crossing a condition threshold is the same shape of fact and belongs in the same place:
	// after the event that caused it, carrying who caused it. Logging it from `Health.set()`
	// instead would land it *before* its own cause (both stamp the same `elapsedTime`), with no
	// source and no spell, and would fire from every dev tool that writes a health bar directly.
	//
	// `else` because a killing blow already says everything: a corpse reads `injured`, and
	// announcing that alongside the death is noise.
	if (before > 0 && target.health.current <= 0) {
		logCombat({timestamp: Date.now(), eventType: 'UNIT_DIED', ...actors})
	} else if (target.condition !== conditionBefore) {
		logCombat({timestamp: Date.now(), eventType: 'UNIT_CONDITION', ...actors, condition: target.condition})
	}

	return landed
}

/**
 * What is left of a hit once the target's shields have eaten their share. Only damage is
 * absorbable — a heal passes straight through, shields or not.
 *
 * Oldest shield first: `auras` is kept in insertion order, which is chronological, and it is the
 * order stacking already reads.
 */
function throughShields(target: Unit, amount: number): number {
	if (amount >= 0) return amount

	let remaining = -amount
	for (const aura of target.auras) {
		if (!(aura instanceof ShieldAura)) continue
		remaining -= aura.absorb(remaining)
		if (remaining <= 0) break
	}
	return -remaining
}
