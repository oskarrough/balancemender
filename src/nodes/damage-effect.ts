import {Task} from 'vroum'
import {applyStatics, randomIntFromInterval} from '../utils'
import {AudioPlayer} from './audio'
import {Character} from './character'
import type {CombatEventType} from '../combatlog'
import {applyHit} from './hit'
import {PeriodicEffect} from './periodic'

/**
 * Base class for all damage effects (attacks from any character to any character).
 * Subclasses declare static balance fields; construction snapshots them onto the
 * instance so balance edits only affect newly spawned attacks.
 */
export class DamageEffect extends Task {
	duration = 0
	repeat = Infinity

	minDamage = 0
	maxDamage = 0
	sound = ''
	name = ''
	eventType: CombatEventType = 'SPELL_DAMAGE'

	targetId: string = ''

	static delay = 0
	static interval = 1000
	static sound = ''
	static name = 'Generic Attack'
	static minDamage = 0
	static maxDamage = 0
	static eventType: CombatEventType = 'SPELL_DAMAGE'

	constructor(public attacker: Character) {
		super(attacker)
		applyStatics(this, 'delay', 'interval', 'sound', 'name', 'minDamage', 'maxDamage', 'eventType')
	}

	damage() {
		return randomIntFromInterval(this.minDamage, this.maxDamage)
	}

	get target() {
		return this.attacker.getTarget()
	}

	shouldTick() {
		if (this.attacker.health.current <= 0) return false
		return !!this.target
	}

	tick() {
		const target = this.target
		if (!target) return

		this.targetId = target.id
		// The floating number, the combat log entry and the death are all applyHit's job.
		applyHit({source: this.attacker, target, amount: -this.damage(), spell: this.name, eventType: this.eventType})

		this.playSound()
		this.shakeTarget()
	}

	playSound() {
		if (this.sound) AudioPlayer.play(this.sound)
	}

	/**
	 * The hit reaction on the unit frame, which is this attack's own to draw. Keyed on the
	 * character id alone — it is unique, and scoping to `.PartyMember` meant the Tank's own
	 * Shield Bash never found its target, so enemies took every hit without flinching.
	 */
	shakeTarget() {
		const element = document.querySelector(`[data-character-id="${this.targetId}"] .Character-avatar`)
		if (element) this.animateHit(element)
	}

	/* Animates a DOM element to shake and flash a bit */
	animateHit(element: Element) {
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
}

/**
 * Small, frequent attack with low damage. Only wolves use it, so it is tuned as part of the pack
 * budget below rather than on its own.
 */
export class SmallAttack extends DamageEffect {
	static interval = 1600
	static minDamage = 5
	static maxDamage = 7
	static sound = 'combat_air_hit'
	static name = 'Quick Stab'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Medium attack with moderate damage and frequency */
export class MediumAttack extends DamageEffect {
	static delay = 4000
	static interval = 3800
	static minDamage = 15
	static maxDamage = 20
	static sound = 'combat_strong_punch'
	static name = 'Heavy Blow'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/**
 * The wolf's own bite, split off `MediumAttack` because the boss swings that too — and a pack and
 * a boss want tuning in opposite directions, so a shared class made every wolf nerf a boss nerf.
 * Paired with Quick Stab, which only wolves use, this makes the whole pack tunable on its own.
 *
 * The two together land about 6.8 dps per wolf, down from 10.2 (#40). The pack still gets harder
 * than linearly — the tank kills one enemy at a time, so each wolf added both raises incoming
 * damage and lengthens the fight — which is deliberate, since a flat curve cannot give you a wall
 * at five. All that moved is where the cliff falls; see docs/simulation.md.
 */
export class WolfBite extends DamageEffect {
	static delay = 4000
	static interval = 3800
	static minDamage = 4
	static maxDamage = 7
	static sound = 'combat_strong_punch'
	static name = 'Savage Bite'
	static eventType: CombatEventType = 'SWING_DAMAGE'

	/**
	 * The bite lands, and leaves a wound behind. Half the bite's damage moved into the bleed
	 * rather than being added on top: this is meant to change the *shape* of the pack's damage,
	 * not its size, so the cliff #40 put past three wolves stays where it is.
	 */
	tick() {
		const target = this.target
		if (!target) return
		super.tick()
		// Check `alive` again after the hit, not before: this bite may have been the killing blow,
		// and `onDeath` has just cancelled the effects a fresh wound would be joining. Planting one
		// anyway leaves a Task on a corpse that outlives the tree it was mounted into.
		if (target.alive) new WolfBleed(target, this.attacker)
	}
}

/**
 * The steady half of a wolf's damage, and the reason Renew has anything to answer.
 *
 * Bites land in lumps you cannot see coming, so pre-healing them is a guess and the patient
 * spell is pure downside. A bleed is the opposite: already ticking, visible on the frame, and
 * costed in advance — which is the damage pattern a heal-over-time was written for.
 *
 * Every bite refreshes it, so while a wolf is alive this never expires and its throughput is just
 * one tick per `interval` — `total` and `repeat` do not set the damage, they set the *tail*: what
 * goes on draining after the wolf that opened the wound is dead.
 *
 * That tail is why `repeat` is 4 and not 40. Killing a wolf is how the party wins, and effects
 * outlive the unit that applied them (`Encounter.onDeath` cancels what is *on* a corpse, not what
 * it put on others). A long wound therefore charges for a wolf the tank has already dealt with,
 * which does not show up in damage-per-wolf at all — it is invisible until win rates drop. Four
 * ticks is just longer than the 3800ms refresh gap, so uptime is unbroken and the debt is small.
 *
 * Not keyed to the pack: `stackKey` is name-and-caster, so three wolves mean three wounds, and
 * bleed damage scales with pack size exactly as the bites it was taken from do.
 */
export class WolfBleed extends PeriodicEffect {
	static name = 'Rend'
	static total = -8
	static interval = 1000
	static repeat = 4
	/**
	 * A full tick, so no instalment lands at the moment of the bite. Without it a wound refreshed
	 * every 3800ms pays out immediately on every reapplication, and half the bleed would arrive
	 * as part of the lump it is supposed to be the alternative to.
	 */
	static delay = 1000
}

/**
 * The boss spike: rare, telegraphed by its 12s cadence, and worth about half a tank's
 * health bar — big enough that ignoring it kills, small enough that a heal answers it.
 */
export class HugeAttack extends DamageEffect {
	static delay = 8000
	static interval = 12000
	static minDamage = 120
	static maxDamage = 180
	static sound = 'combat_arrow'
	static name = 'Nasty arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
}

/** Tank attack - lower damage but consistent */
export class TankAttack extends DamageEffect {
	static interval = 2400
	static minDamage = 16
	static maxDamage = 24
	static sound = 'combat_sword_hit'
	static name = 'Shield Bash'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}
