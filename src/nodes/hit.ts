import {logCombat, CombatEventType} from '../combatlog'
import {fct} from '../components/floating-combat-text'
import type {Character} from './character'

export interface Hit {
	/** Who to credit it to. */
	source: Character
	target: Character
	/** Positive heals, negative damages. */
	amount: number
	/** The spell, attack or aura it came from: its stable `id` and its display `name`. */
	abilityId: string
	abilityName: string
	eventType: CombatEventType
}

/**
 * The one door for changing a health bar. Spells, attacks and periodic effects all come
 * through here, so nothing can land without a floating number and a combat log entry —
 * the Combat log panel, the Fight report and the simulator all read that log, and a
 * mechanic missing from it is invisible to all three at once.
 *
 * Returns what actually landed, which is less than `amount` when a heal tops off a full bar.
 */
export function applyHit({source, target, amount, abilityId, abilityName, eventType}: Hit): number {
	const before = target.health.current
	const conditionBefore = target.condition
	if (amount >= 0) target.health.heal(amount)
	else target.health.damage(-amount)
	const landed = Math.abs(target.health.current - before)

	fct(target.id, amount >= 0 ? `+${amount}` : `-${-amount}`)

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
