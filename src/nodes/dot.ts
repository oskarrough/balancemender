import {Task} from 'vroum'
// import {fct} from '../components/floating-combat-text'
import {log, randomIntFromInterval} from '../utils'
import {Character} from './character'
import {AudioPlayer} from './audio'

/**
 * Base class for all Damage over Time effects
 * DoTs attach to the target character and apply damage periodically
 */
export class DoT extends Task {
	// Instance properties
	name = 'Periodic Damage'
	minDamage = 0
	maxDamage = 0
	interval = 3000
	repeat = 5
	sound = ''

	// Required for compatibility with HOT effects in the Character.effects Set
	heal = 0

	// Store original caster for damage attribution
	casterName = ''
	casterId = ''

	// Static properties for effect definitions
	static name = 'Periodic Damage'
	static minDamage = 0
	static maxDamage = 0
	static interval = 3000
	static repeat = 5
	static sound = ''

	constructor(
		public parent: Character, // The target character this DoT is attached to
		public caster: Character, // The character who applied this DoT
	) {
		super(parent) // Parent is the target

		// Copy static properties to instance
		const constructor = this.constructor as typeof DoT
		this.name = constructor.name
		this.minDamage = constructor.minDamage
		this.maxDamage = constructor.maxDamage
		this.interval = constructor.interval
		this.repeat = constructor.repeat
		this.sound = constructor.sound

		// Store caster info for attribution
		this.casterName = caster.constructor.name
		this.casterId = caster.id
	}

	mount() {
		// Add self to target's effects collection when mounted
		this.parent.effects.add(this)
		log(`dot:mount ${this.name} from ${this.casterName} on ${this.parent.constructor.name}`)
	}

	damage() {
		// Each tick deals a portion of the total effect damage
		const baseDamage = randomIntFromInterval(this.minDamage, this.maxDamage)
		return Math.round(baseDamage / this.repeat)
	}

	tick() {
		const damageAmount = this.damage()
		const actualDamage = this.parent.damage(damageAmount)
		this.createVisualEffects(actualDamage)
		if (this.sound) AudioPlayer.play(this.sound)
		log(`dot:${this.name}:tick damage=${actualDamage} from=${this.casterName} to=${this.parent.constructor.name}`)
	}

	shouldTick() {
		return this.parent.health.current > 0
	}

	/**
	 * Create visual effects for the damage
	 */
	createVisualEffects(damageAmount: number) {
		// Get the DOM element with class .FloatingCombatText
		const container = document.querySelector('.FloatingCombatText')
		if (!container) return

		// Create the floating combat text element
		const element = document.createElement('floating-combat-text')
		element.classList.add('damage', `${this.casterName.toLowerCase()}-damage`)
		element.textContent = `-${damageAmount}`

		// Add it to the container
		container.appendChild(element)
	}

	destroy() {
		// Remove self from target's effects when destroyed
		this.parent.effects.delete(this)
		log(`dot:destroy ${this.name} from ${this.casterName}`)
	}
}

export class Poison extends DoT {
	repeat = 5
	static name = 'Poison'
	static minDamage = 200
	static maxDamage = 400
	static interval = 2000
	static sound = 'combat.poison'
}

export class Bleed extends DoT {
	interval = 300
	repeat = 8

	static name = 'Bleed'
	static minDamage = 150
	static maxDamage = 300
	static sound = 'combat.blood'
}

export class Burn extends DoT {
	interval = 3000
	repeat = 3

	static name = 'Burn'
	static minDamage = 400
	static maxDamage = 600
	static sound = 'combat.fire'
}
