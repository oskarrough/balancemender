import {Task} from 'vroum'
import {html, log, randomIntFromInterval} from '../utils'
import {AudioPlayer} from './audio'
import {Character} from './character'
import {logCombat, CombatEventType} from '../combatlog'

// Event names for damage effects
export const DAMAGE_EFFECT_EVENTS = {
	DAMAGE_APPLIED: 'damageApplied',
	TARGET_KILLED: 'targetKilled',
}

/**
 * Configuration interface for damage effects
 */
export interface DamageEffectConfig {
	name: string
	minDamage: number
	maxDamage: number
	interval: number
	delay: number
	sound?: string
}

/**
 * Base class for all damage effects (attacks from any character to any character)
 */
export class DamageEffect extends Task {
	// Task properties
	delay = 0 // delay the first cycle
	interval = 1000 // wait between cycles
	duration = 0 // tick once every cycle
	repeat = Infinity

	minDamage = 0
	maxDamage = 0
	sound = ''
	name = ''

	// Target id for DOM operations
	targetId: string = ''

	// Static properties for attack definitions
	static delay = 0
	static interval = 1000
	static sound = ''
	static name = 'Generic Attack'
	static minDamage = 0
	static maxDamage = 0
	static eventType: CombatEventType = 'SPELL_DAMAGE' // Default event type

	// Instance event type
	eventType: CombatEventType = 'SPELL_DAMAGE' // Default

	/**
	 * Create a damage effect that will attack the attacker's current target
	 * @param attacker The character doing the attacking
	 */
	constructor(
		public attacker: Character,
	) {
		super(attacker)

		// Copy static properties to instance
		const constructor = this.constructor as typeof DamageEffect
		this.delay = constructor.delay
		this.interval = constructor.interval
		this.sound = constructor.sound
		this.name = constructor.name
		this.minDamage = constructor.minDamage
		this.maxDamage = constructor.maxDamage
		this.eventType = constructor.eventType

		// Store target ID and attacker name for targeting and logs
		// If initialTarget is provided, use that, otherwise set to attacker
		// We'll use attacker.currentTarget in tick() if available
		// this.targetId = initialTarget?.id || attacker.id
		// if (initialTarget) debugger
	}

	damage() {
		return randomIntFromInterval(this.minDamage, this.maxDamage)
	}

	shouldTick() {
		// Can't attack if we're dead can we?
		if (this.attacker.health.current <= 0) {
			return false
		}


		if (!this.target) {
			console.warn('damage effect missing target')
			return false
		}

		if (this.target.health.current <= 0) {
			return false
		}

		// why do this?
		this.targetId = this.target.id

		return super.shouldTick()
	}

	/** Get the target of this attack */
	get target(): Character {
		return this.attacker.currentTarget
	}

	tick() {
		const damage = this.damage()
		this.target.health.damage(damage)

		logCombat({
			timestamp: Date.now(),
			eventType: this.eventType,
			sourceId: this.attacker.id,
			sourceName: this.attacker.name,
			targetId: this.target.id,
			targetName: this.target.name || this.target.constructor.name,
			spellId: this.name,
			spellName: this.name,
			value: damage,
		})

		this.playSound()
		this.createVisualEffects(damage)

		// Emit event for other systems to use
		this.emit(DAMAGE_EFFECT_EVENTS.DAMAGE_APPLIED, {
			attacker: this.attacker,
			target: this.target,
			damage: damage,
			attackName: this.name,
		})

		// Check if target died
		if (this.target.health.current <= 0) {
			logCombat({
				timestamp: Date.now(),
				eventType: 'UNIT_DIED',
				sourceId: this.attacker.id,
				sourceName: this.attacker.name,
				targetId: this.target.id,
				targetName: this.target.name || this.target.constructor.name,
				spellId: this.name,
				spellName: this.name,
			})
			this.emit(DAMAGE_EFFECT_EVENTS.TARGET_KILLED, {
				target: this.target,
			})
		}
	}

	playSound() {
		if (this.sound) AudioPlayer.play(this.sound)
	}

	createVisualEffects(damageAmount: number) {
		// Determine if this is a player/party attack or an enemy attack
		const isPartyAttack =
			this.attacker.parent === this.target.parent &&
			'enemies' in this.attacker.parent &&
			this.attacker.parent.enemies.some((enemy) => enemy === this.target)

		// For enemy attacks on party members, animate the hit
		// if (!isPartyAttack) {
			const targetElement = document.querySelector(
				`.PartyMember[data-character-id="${this.targetId}"] .Character-avatar`,
			)
			if (targetElement) this.animateHit(targetElement)
		// }

		// Create floating combat text
		const cssClass = `damage ${this.attacker.constructor.name.toLowerCase()}-damage`
		const fct = html`<floating-combat-text class=${cssClass}>${damageAmount}</floating-combat-text
		>`.toDOM()
		const container = document.querySelector('.FloatingCombatText')
		if (container) container.appendChild(fct)
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

		animation.onfinish = () => {
			element.classList.remove('is-takingDamage')
		}
	}
}

/** Small, frequent attack with low damage */
export class SmallAttack extends DamageEffect {
	static delay = 0
	static interval = 1600
	static minDamage = 7
	static maxDamage = 11
	static sound = 'combat.air_hit'
	static name = 'Quick Stab'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Medium attack with moderate damage and frequency */
export class MediumAttack extends DamageEffect {
	static delay = 4000
	static interval = 3800
	static minDamage = 15
	static maxDamage = 20
	static sound = 'combat.strong_punch'
	static name = 'Heavy Blow'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Heavy attack with high damage but infrequent */
export class HugeAttack extends DamageEffect {
	static delay = 8000
	static interval = 12000
	static minDamage = 500
	static maxDamage = 700
	static sound = 'combat.arrow'
	static name = 'Nasty arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
}

/** Tank attack - lower damage but consistent */
export class TankAttack extends DamageEffect {
	static interval = 2400
	static minDamage = 16
	static maxDamage = 24
	static sound = 'combat.sword_hit'
	static name = 'Shield Bash'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Warrior attack - high damage, slower attack speed */
export class WarriorAttack extends DamageEffect {
	static interval = 2200
	static minDamage = 120
	static maxDamage = 220
	static sound = 'combat.sword_hit'
	static name = 'Mighty Swing'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** Rogue attack - lower damage but fast attack speed */
export class RogueAttack extends DamageEffect {
	static interval = 1000
	static minDamage = 65
	static maxDamage = 95
	static sound = 'combat.sword_hit'
	static name = 'Quick Slash'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

