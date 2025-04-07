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

// In your damage effect class or wherever you define these
enum DamageType {
	SPELL = 'SPELL',
	SWING = 'SWING', // Melee
	RANGE = 'RANGE', // Ranged attacks
}

// Map damage types to event types with proper typing
const damageTypeToEventType: Record<DamageType, CombatEventType> = {
	[DamageType.SPELL]: 'SPELL_DAMAGE',
	[DamageType.SWING]: 'SWING_DAMAGE',
	[DamageType.RANGE]: 'RANGE_DAMAGE',
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

	// Add this to your damage effect properties
	damageType: DamageType = DamageType.SPELL // Default

	/**
	 * Create a damage effect that will attack the attacker's current target
	 * @param attacker The character doing the attacking
	 * @param initialTarget Optional initial target - if not provided, will use attacker.currentTarget
	 */
	constructor(
		public attacker: Character,
		initialTarget?: Character,
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

		// Store target ID and attacker name for targeting and logs
		// If initialTarget is provided, use that, otherwise set to attacker
		// We'll use attacker.currentTarget in tick() if available
		this.targetId = initialTarget?.id || attacker.id
	}

	damage() {
		return randomIntFromInterval(this.minDamage, this.maxDamage)
	}

	shouldTick() {
		// Direct attacks should stop if the attacker is dead
		if (this.attacker.health.current <= 0) {
			return false
		}

		// Get current target - prefer attacker's currentTarget if available
		const target = this.attacker.currentTarget || this.attacker

		// Don't tick if target is dead
		if (target.health.current <= 0) {
			return false
		}

		// Update target ID
		this.targetId = target.id

		// Otherwise, continue with default behavior
		return super.shouldTick()
	}

	/**
	 * Get the target of this attack
	 * First try to use attacker's currentTarget, fall back to attacker itself
	 */
	get target(): Character {
		return this.attacker.currentTarget || this.attacker
	}

	tick() {
		const damage = this.damage()
		const actualDamage = this.target.health.damage(damage)

		log(
			`${this.attacker.name}: ${this.name} dealt ${actualDamage} damage to ${this.target.constructor.name}`,
		)

		// Log damage to combat log
		logCombat({
			timestamp: Date.now(),
			eventType: damageTypeToEventType[this.damageType] || 'SPELL_DAMAGE',
			sourceId: this.attacker.id,
			sourceName: this.attacker.name,
			targetId: this.target.id,
			targetName: this.target.name || this.target.constructor.name,
			spellId: this.name,
			spellName: this.name,
			value: actualDamage,
		})

		this.playSound()
		this.createVisualEffects(actualDamage)

		// Emit event for other systems to use
		this.emit(DAMAGE_EFFECT_EVENTS.DAMAGE_APPLIED, {
			attacker: this.attacker,
			target: this.target,
			damage: actualDamage,
			attackName: this.name,
		})

		// Check if target died
		if (this.target.health.current <= 0) {
			// Log unit death to combat log
			logCombat({
				timestamp: Date.now(),
				eventType: 'UNIT_DIED',
				targetId: this.target.id,
				targetName: this.target.name || this.target.constructor.name,
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
		if (!isPartyAttack) {
			const targetElement = document.querySelector(
				`.PartyMember[data-character-id="${this.targetId}"] .Character-avatar`,
			)
			if (targetElement) this.animateHit(targetElement)
		}

		// Create floating combat text
		const cssClass = isPartyAttack
			? `damage ${this.attacker.constructor.name.toLowerCase()}-damage`
			: 'damage'

		const fct = html`<floating-combat-text class=${cssClass}
			>-${damageAmount}</floating-combat-text
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
	static interval = 1500
	static minDamage = 21
	static maxDamage = 30
	static sound = 'combat.air_hit'
	static name = 'Quick Strike'
}

/** Medium attack with moderate damage and frequency */
export class MediumAttack extends DamageEffect {
	static delay = 3100
	static interval = 2800
	static minDamage = 400
	static maxDamage = 550
	static sound = 'combat.strong_punch'
	static name = 'Heavy Blow'
}

/** Heavy attack with high damage but infrequent */
export class HugeAttack extends DamageEffect {
	static delay = 8000
	static interval = 12000
	static minDamage = 500
	static maxDamage = 700
	static sound = 'combat.fast_punch'
	static name = 'Devastating Slam'
}

/** Tank attack - lower damage but consistent */
export class TankAttack extends DamageEffect {
	static interval = 1800
	static minDamage = 60
	static maxDamage = 90
	static sound = 'combat.sword_hit'
	static name = 'Shield Bash'
}

/** Warrior attack - high damage, slower attack speed */
export class WarriorAttack extends DamageEffect {
	static interval = 2200
	static minDamage = 120
	static maxDamage = 220
	static sound = 'combat.sword_hit'
	static name = 'Mighty Swing'
}

/** Rogue attack - lower damage but fast attack speed */
export class RogueAttack extends DamageEffect {
	static interval = 1000
	static minDamage = 65
	static maxDamage = 95
	static sound = 'combat.sword_hit'
	static name = 'Quick Slash'
}

/**
 * Base class for periodic damage effects (DoTs)
 */
export class PeriodicDamageEffect extends DamageEffect {
	tick() {
		const damage = this.damage()
		const actualDamage = this.target.health.damage(damage)

		log(
			`${this.attacker.name}: ${this.name} dealt ${actualDamage} periodic damage to ${this.target.constructor.name}`,
		)

		// Log damage to combat log with periodic event type
		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_PERIODIC_DAMAGE',
			sourceId: this.attacker.id,
			sourceName: this.attacker.name,
			targetId: this.target.id,
			targetName: this.target.name || this.target.constructor.name,
			spellId: this.name,
			spellName: this.name,
			value: actualDamage,
		})

		this.playSound()
		this.createVisualEffects(actualDamage)

		// Emit event for other systems to use
		this.emit(DAMAGE_EFFECT_EVENTS.DAMAGE_APPLIED, {
			attacker: this.attacker,
			target: this.target,
			damage: actualDamage,
			attackName: this.name,
		})

		// Check if target died
		if (this.target.health.current <= 0) {
			// Log unit death to combat log
			logCombat({
				timestamp: Date.now(),
				eventType: 'UNIT_DIED',
				targetId: this.target.id,
				targetName: this.target.name || this.target.constructor.name,
			})

			this.emit(DAMAGE_EFFECT_EVENTS.TARGET_KILLED, {
				target: this.target,
			})
		}
	}
}

// Example of a periodic damage effect like a poison
export class PoisonEffect extends PeriodicDamageEffect {
	static interval = 2000 // tick every 2 seconds
	static minDamage = 30
	static maxDamage = 45
	static sound = 'combat.poison'
	static name = 'Poison'
}
