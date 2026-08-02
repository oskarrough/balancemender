import {applyHit} from './hit'
import {eligible} from './targets'
import type {CombatEventType} from '../combatlog'
// Type-only: ability.ts imports the `Effect` type back from here.
import type {Ability, AbilitySchool} from './ability'
import type {Aura} from './aura'
import type {GameLoop} from './game-loop'
import type {Unit} from './unit'

/** One spread for rolled damage. Tunable live as `rule:Damage.variance=0.2`. */
export const DAMAGE_RULES = {variance: 0.2}

/**
 * One ability landing on one target, with the caster's side already worked out.
 *
 * The power is read once, when the use is constructed, and carried here — so a buff or a retune
 * that arrives mid-cast reaches the next use and never the one in flight. Effects resolve their
 * own size against it, which is why no use has to hold a mutable magnitude for them to read.
 */
export class Landing {
	constructor(
		readonly ability: Ability,
		readonly target: Unit,
		readonly power: number,
		/** What scales every effect of this landing, over and above its coefficients — see #33. */
		readonly bonus = 1,
	) {}

	/** The same landing, everything it lands scaled. */
	scaled(factor: number) {
		return new Landing(this.ability, this.target, this.power, this.bonus * factor)
	}

	/** In hit points: what a coefficient claims of this caster's power, this time. */
	resolve(coefficient: number) {
		return this.power * coefficient * this.bonus
	}

	get caster() {
		return this.ability.parent
	}
}

/**
 * One thing an ability does when it lands. An ability owns an ordered list of these, so what it
 * does is readable from its declaration rather than from an override two files away.
 *
 * An effect that lands an amount authors its own `coefficient`, because the effect is the thing
 * with a size: a composite ability sizes its parts independently, and every coefficient in the
 * game is tunable as `effect:Ability.name`.
 *
 * Deliberately not a vroum node: a child cannot run in the frame it is constructed, so an effect
 * node would have its lifecycle bypassed and be run by hand anyway. Everything here is
 * instantaneous; anything that lasts is an aura, and an aura is a Task.
 *
 * Effects hold no per-use state, so one instance is shared by every use of the ability that
 * declares it. A coefficient is authored template data, which is what makes retuning one safe.
 */
export interface Effect {
	/** Names this effect's row in the Balance Lab, under the ability that declares it. */
	readonly label: string
	/**
	 * The stable row name when one ability carries two effects that would share a label — the
	 * auto-numbering that used to tell them apart depended on declaration order. Defaults to the
	 * label, so only a same-label pair needs to set it.
	 */
	readonly id?: string
	/** Whether this effect can still land when the use's selected target has died. */
	readonly targetIndependent?: boolean
	coefficient?: number
	apply(landing: Landing): void
}

/** An aura an effect can plant. Whatever it lands arrives resolved, as `magnitude`. */
type AuraClass = (new (parent: Unit, caster: Unit, planted?: PlantedAura) => Aura) & {
	id: string
	mechanic?: string
}

/** What an ability hands the aura it plants. Each kind of aura reads the parts that mean something to it. */
export interface PlantedAura {
	magnitude: number
	threatMultiplier: number
	school: AbilitySchool
	/** The one ability use that planted it, so the aura's events trace back to the cast. */
	castId?: string
}

/** One of those, for the effect that plants an aura and for anything standing in for one. */
export const planted = (
	magnitude: number,
	threatMultiplier = 1,
	school: AbilitySchool = 'physical',
	castId?: string,
): PlantedAura => ({
	magnitude,
	threatMultiplier,
	school,
	castId,
})

/** Every health change an effect makes is credited to the ability that declared it. */
function hit({ability, target, bonus}: Landing, amount: number, eventType: CombatEventType) {
	applyHit({
		source: ability.parent,
		target,
		amount,
		abilityId: ability.id,
		abilityName: ability.name,
		eventType,
		threatMultiplier: ability.threatMultiplier,
		school: ability.school,
		castId: ability.castId,
		// The landing already carries the bonus a sweet-spot hit earned (#33) — this only tells the
		// floating number to look different, generic to any ability that opts in.
		sweetSpot: bonus !== 1,
	})
}

/** Rounded bounds keep a low-number midpoint symmetric: 6 ±20% remains 5–7. */
function rollDamage(landing: Landing, coefficient: number) {
	const magnitude = landing.resolve(coefficient)
	const spread = magnitude * Math.max(0, DAMAGE_RULES.variance)
	const min = Math.max(0, Math.round(magnitude - spread))
	const max = Math.max(min, Math.round(magnitude + spread))
	return (landing.ability.root as GameLoop).rng.int(min, max)
}

/** Damage rolled around what this landing resolves to, and the flinch that sells it. */
export class Damage implements Effect {
	readonly label = 'damage'

	constructor(public coefficient: number) {}

	apply(landing: Landing) {
		hit(landing, -rollDamage(landing, this.coefficient), landing.ability.eventType)
		shake(landing.target)
	}
}

/**
 * Same roll as `Damage`, landed on every living unit on the ability's side rather than just its
 * one held target — the Glow's ambient pressure, felt by the whole party without anyone dodging
 * it by not being the one the caster picked.
 */
export class AoeDamage implements Effect {
	readonly label = 'damage'
	readonly targetIndependent = true

	constructor(public coefficient: number) {}

	apply(landing: Landing) {
		for (const target of eligible(landing.caster, landing.ability.targets)) {
			const perTarget = new Landing(landing.ability, target, landing.power, landing.bonus)
			hit(perTarget, -rollDamage(perTarget, this.coefficient), perTarget.ability.eventType)
			shake(target)
		}
	}
}

/** A direct heal, varied by a few percent so no two land identically. */
export class Heal implements Effect {
	readonly label = 'heal'

	constructor(public coefficient: number) {}

	apply(landing: Landing) {
		const {rng} = landing.ability.root as GameLoop
		hit(landing, rng.naturalize(landing.resolve(this.coefficient)), 'SPELL_HEAL')
	}
}

/**
 * Not a health hit: drains mana straight off the target's own pool — the White's whole pressure.
 * A unit with no pool (`Tank`, `Wren`) is simply untouched, so this only ever lands on the healer.
 * Uses the same `RESOURCE_SPENT` event as a cast cost, but names Hollow and its caster so the
 * report can separate drain from the healer's own spending. It does not reset the five-second rule:
 * a lull still pays mana back.
 */
export class ManaBurn implements Effect {
	readonly label = 'manaBurn'

	constructor(public coefficient: number) {}

	apply(landing: Landing) {
		const {target, ability} = landing
		if (!target.mana) return
		const amount = Math.round(landing.resolve(this.coefficient))
		if (amount <= 0) return
		const before = target.mana.current
		target.mana.set(before - amount)
		const burned = before - target.mana.current
		if (burned <= 0) return

		const {combatLog} = ability.root as GameLoop
		combatLog.add({
			timestamp: Date.now(),
			eventType: 'RESOURCE_SPENT',
			sourceId: target.id,
			sourceName: target.name,
			targetId: ability.parent.id,
			targetName: ability.parent.name,
			abilityId: ability.id,
			abilityName: ability.name,
			castId: ability.castId,
			value: -burned,
			extraInfo: 'MANA',
		})
	}
}

/**
 * Cut every cast on the side this landed on, the target's included. The reach is the point and the
 * reason this is not aimed like the rest: what interrupts here is a sound, and a sound arrives at
 * whoever is standing in the room to hear it.
 *
 * Deliberately without a coefficient — an interrupt has no size, so the dial for an ability
 * carrying one is how often it comes rather than how hard.
 */
export class Interrupt implements Effect {
	readonly label = 'interrupt'
	readonly targetIndependent = true
	/** Stated rather than left off: this is the one effect that lands something with no size. */
	readonly coefficient = undefined

	apply({ability, caster}: Landing) {
		// The side the ability was aimed at, which is the side the target is standing on.
		for (const unit of eligible(caster, ability.targets)) unit.stopCasting()
	}
}

/**
 * The same aura as `ApplyAura`, planted on every living unit `targets` allows — the party's
 * shared wind, where who it lands on matters less than that it reaches everyone. Mirrors
 * `AoeDamage`, and `targetIndependent` for the same reason: the one held target dying stops
 * nothing. A party buff is why it exists, and a party buff lands on allies; the `targets` on the
 * ability still decides which side that is, so the effect stays generic like its damage sibling.
 *
 * Never the caster: an aura that fed its own maker would be sized from their freshly-buffed
 * strength on the next refresh and compound with every cast. The wind raises itself up, it does
 * not carry itself.
 */
export class AoeAura implements Effect {
	readonly label: string
	readonly targetIndependent = true

	constructor(
		/** Public because `balance.ts` walks the registry through here to find the auras a fight can carry. */
		readonly auraClass: AuraClass,
		public coefficient: number,
	) {
		this.label = (auraClass.mechanic ?? auraClass.id).toLowerCase()
	}

	apply(landing: Landing) {
		const {ability} = landing
		for (const target of eligible(landing.caster, ability.targets)) {
			if (target === landing.caster) continue
			const magnitude = landing.resolve(this.coefficient)
			new this.auraClass(
				target,
				ability.parent,
				planted(magnitude, ability.threatMultiplier, ability.school, ability.castId),
			)
		}
	}
}

/** Leave an aura behind, sized by this effect's own coefficient. */
export class ApplyAura implements Effect {
	readonly label: string

	constructor(
		/** Public because `balance.ts` walks the registry through here to find the auras a fight can carry. */
		readonly auraClass: AuraClass,
		public coefficient: number,
	) {
		// Declared data, not the class name: a minified build keeps these and loses the name.
		this.label = (auraClass.mechanic ?? auraClass.id).toLowerCase()
	}

	apply(landing: Landing) {
		const {target, ability} = landing
		// An earlier effect in the same list may have killed the target, and death has already
		// cancelled its auras. Do not plant one on a corpse afterwards.
		if (!target.alive) return
		const magnitude = landing.resolve(this.coefficient)
		new this.auraClass(
			target,
			ability.parent,
			planted(magnitude, ability.threatMultiplier, ability.school, ability.castId),
		)
	}
}

/** A pixel or two either way, for the flinch below. `Math.random`, never the fight's dice: a
 * wobble nobody replays has no business in the stream that makes seeded fights comparable. */
const wobble = () => Math.round(Math.random() * 4) - 2

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
				transform: `translate(${wobble()}px, ${wobble()}px)`,
				filter: 'brightness(0.5)',
			},
			{transform: 'translate(0, 0)', filter: 'none'},
		],
		{duration: 200, easing: 'ease-in-out'},
	)
	animation.onfinish = () => element.classList.remove('is-takingDamage')
}
