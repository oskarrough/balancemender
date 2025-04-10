import {Task} from 'vroum'
import {Resource} from './resource'
import {GameLoop} from './game-loop'
import {Character} from './character'
import {logCombat} from '../combatlog'
/**
 * Events emitted by the Mana node
 */
export const MANA_EVENTS = {
	CHANGE: 'mana:change',
	EMPTY: 'mana:empty',
	FULL: 'mana:full',
} as const

/**
 * Mana node with regeneration capability
 */
export class Mana extends Resource {
	regen = new ManaRegen(this)
	lastCastTime = 0

	constructor(parent: Character, max = 100) {
		super(parent, max, MANA_EVENTS)
	}

	/**
	 * Attempt to spend mana - used where validation is required
	 * Returns false if not enough mana is available
	 */
	spend(amount: number): boolean {
		const gameLoop = this.root as GameLoop
		if (gameLoop.infiniteMana) return true
		if (amount > this.current) return false

		this.set(this.current - amount)
		this.lastCastTime = gameLoop.elapsedTime
		return true
	}
}

export class ManaRegen extends Task {
	repeat = Infinity
	interval = 1000
	regenRate = 3 // mana per tick
	fiveSecondRule = 5000

	constructor(public parent: Mana) {
		super(parent)
	}

	shouldTick(): boolean {
		// First check the parent Task's conditions
		if (!super.shouldTick()) return false

		const gameLoop = this.root as GameLoop

		// Get time since last cast
		const timeSinceCast = gameLoop.elapsedTime - this.parent.lastCastTime

		// Skip if in 5-second rule period or mana is full
		return timeSinceCast >= this.fiveSecondRule && this.parent.current < this.parent.max
	}

	tick() {
		this.parent.set(this.parent.current + this.regenRate)
		// logCombat({
		// 	timestamp: Date.now(),
		// 	eventType: 'RESOURCE_CHANGE',
		// 	sourceId: this.parent.id,
		// 	sourceName: this.parent.name,
		// 	value: this.regenRate,
		// 	extraInfo: 'MANA',
		// })
	}
}
