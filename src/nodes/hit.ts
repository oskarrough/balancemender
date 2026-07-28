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
 * The one door for changing a health bar. Every effect and every periodic aura comes through here,
 * so nothing lands without a floating number and a combat log entry — and a mechanic missing from
 * the log is invisible to the Combat log panel, the Fight report and the simulator at once.
 *
 * Returns what actually landed, which is less than `amount` when a heal tops off a full bar.
 */
export function applyHit({source, target, amount: incoming, abilityId, abilityName, eventType}: Hit): number {
	// Shields take their share before anything else here runs, so `landed`, the floating number and
	// the death check all follow from what got through and none of them has to know shields exist.
	const amount = throughShields(target, incoming)

	const before = target.health.current
	const conditionBefore = target.condition
	if (amount >= 0) target.health.heal(amount)
	else target.health.damage(-amount)
	const landed = Math.abs(target.health.current - before)

	// A fully absorbed hit moved nothing, and `-0` floating over the unit would claim otherwise.
	if (amount !== 0) fct(target.id, amount >= 0 ? `+${amount}` : `-${-amount}`)

	const eventFields = {
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
		...eventFields,
		value: Math.abs(amount),
		// Only heals can overheal, and reporting `0` on every hit would say they can't.
		...(amount > 0 && {overheal: amount - landed}),
	})

	// Both recorded here rather than by whatever swung, so they land after their own cause and
	// carry who caused it — from `Health.set()` they would arrive first, sourceless. `before > 0`
	// is what stops hitting a corpse announcing the death again, and the `else` is because a
	// killing blow already implies the condition: a corpse reads `injured`.
	if (before > 0 && target.health.current <= 0) {
		logCombat({timestamp: Date.now(), eventType: 'UNIT_DIED', ...eventFields})
	} else if (target.condition !== conditionBefore) {
		logCombat({timestamp: Date.now(), eventType: 'UNIT_CONDITION', ...eventFields, condition: target.condition})
	}

	return landed
}

/**
 * What is left of a hit once the target's shields have eaten their share. Only damage is
 * absorbable — a heal passes straight through. Oldest shield first: `auras` is in insertion order,
 * which is the order stacking already reads.
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
