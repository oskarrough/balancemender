import {Task} from 'vroum'
import {applyStatics, randomIntFromInterval} from '../utils'
import {AudioPlayer} from './audio'
import {Character} from './character'
import type {CombatEventType} from '../combatlog'
import {applyHit} from './hit'

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
	static minDamage = 7
	static maxDamage = 11
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
 * Paired with Quick Stab, which only wolves use, this makes the whole pack tunable on its own (#40).
 */
export class WolfBite extends DamageEffect {
	static delay = 4000
	static interval = 3800
	static minDamage = 15
	static maxDamage = 20
	static sound = 'combat_strong_punch'
	static name = 'Savage Bite'
	static eventType: CombatEventType = 'SWING_DAMAGE'
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
