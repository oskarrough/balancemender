import {applyHit} from './hit'
import {naturalizeNumber, randomIntFromInterval} from '../utils'
import type {CombatEventType} from '../combatlog'
// Type-only: ability.ts imports the `Effect` type back from here.
import type {Ability} from './ability'
import type {Aura} from './aura'
import type {Unit} from './unit'

/**
 * One thing an ability does when it lands. An ability owns an ordered list of these, so what it
 * does is readable from its declaration rather than from an override two files away.
 *
 * Deliberately not a vroum node: a child cannot run in the frame it is constructed, so an effect
 * node would have its lifecycle bypassed and be run by hand anyway. Everything here is
 * instantaneous; anything that lasts is an aura, and an aura is a Task.
 *
 * Effects hold no state, so one instance is shared by every use of the ability that declares it.
 */
export interface Effect {
	apply(ability: Ability, target: Unit): void
}

/** An aura class an effect can plant: `PeriodicAura` and `ShieldAura` both take a magnitude. */
type AuraClass = new (parent: Unit, caster: Unit, magnitude?: number) => Aura

/** Every health change an effect makes is credited to the ability that declared it. */
function hit(ability: Ability, target: Unit, amount: number, eventType: CombatEventType) {
	applyHit({
		source: ability.parent,
		target,
		amount,
		abilityId: ability.id,
		abilityName: ability.name,
		eventType,
	})
}

/**
 * Damage in the ability's own range, and the flinch that sells it.
 *
 * The numbers are read off the ability at landing time rather than captured here, because `--tune`
 * and the Balance Lab retune by writing onto the class object.
 */
export class Damage implements Effect {
	apply(ability: Ability, target: Unit) {
		// An ability that declares Damage without a range is a mistake `registry.test.ts` catches.
		const amount = randomIntFromInterval(ability.minDamage ?? 0, ability.maxDamage ?? 0)
		hit(ability, target, -amount, ability.eventType)
		shake(target)
	}
}

/** A direct heal, varied by a few percent so no two land identically. */
export class Heal implements Effect {
	apply(ability: Ability, target: Unit) {
		hit(ability, target, naturalizeNumber(ability.magnitude), 'SPELL_HEAL')
	}
}

/**
 * Leave an aura behind.
 *
 * The aura is sized by the ability's `magnitude` when it has one, which is what keeps Renew tunable
 * as `ability:Renew.magnitude` while Rend's size stays on the aura as `aura:Rend.total` — an aura
 * only needs its own balance row when no ability owns its number.
 */
export class ApplyAura implements Effect {
	constructor(private auraClass: AuraClass) {}

	apply(ability: Ability, target: Unit) {
		// An earlier effect in the same list may have killed the target, and death has already
		// cancelled its auras. Do not plant one on a corpse afterwards.
		if (!target.alive) return
		new this.auraClass(target, ability.parent, ability.magnitude)
	}
}

/** The flinch a hit draws on its target. Only a direct hit shakes — a bleed ticking does not. */
function shake(target: Unit) {
	// A simulated fight has no document to flinch in.
	if (typeof document === 'undefined') return
	const element = document.querySelector(`[data-unit-id="${target.id}"] .Unit-avatar`)
	if (!element) return
	element.classList.add('is-takingDamage')
	const animation = element.animate(
		[
			{transform: 'translate(0, 0)', filter: 'none'},
			{
				transform: `translate(${randomIntFromInterval(-2, 2)}px, ${randomIntFromInterval(-2, 2)}px)`,
				filter: 'brightness(0.5)',
			},
			{transform: 'translate(0, 0)', filter: 'none'},
		],
		{duration: 200, easing: 'ease-in-out'},
	)
	animation.onfinish = () => element.classList.remove('is-takingDamage')
}
