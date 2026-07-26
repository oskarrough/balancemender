import {Task} from 'vroum'
import {Resource} from './resource'
import type {GameLoop} from './game-loop'
import {Character} from './character'
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
	regen: ManaRegen
	lastCastTime = 0

	/**
	 * `regenRate` is handed in rather than hardcoded, for the same reason `max` is: it is a stat of
	 * whoever owns the pool, so it is tunable per unit and read once at construction. Retuning it
	 * mid-fight leaves the fight you are in alone, which is the rule the rest of balance follows.
	 */
	constructor(parent: Character, max = 100, regenRate = 3) {
		super(parent, max, MANA_EVENTS)
		this.regen = new ManaRegen(this, regenRate)
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

/**
 * Mana comes back a second at a time, but only after five seconds without spending any.
 *
 * The rule is the interesting part: casting suppresses your own regeneration, so a lull is worth
 * something and topping everyone off during one has a price. That only reads as a decision if the
 * amount is large enough to notice — at 3/s it was about 7% of what a fight costs, which is
 * decoration. See #39, and `fiveSecondRule` is deliberately *not* tunable: measurement showed the
 * gaps between casts already run past five seconds, so the threshold was never the thing binding.
 */
export class ManaRegen extends Task {
	repeat = Infinity
	interval = 1000
	fiveSecondRule = 5000

	constructor(
		public parent: Mana,
		/** Mana per tick, and the tick is a second, so also mana per second. */
		public regenRate = 3,
	) {
		super(parent)
	}

	shouldTick(): boolean {
		const gameLoop = this.root as GameLoop
		const timeSinceCast = gameLoop.elapsedTime - this.parent.lastCastTime
		return timeSinceCast >= this.fiveSecondRule && this.parent.current < this.parent.max
	}

	tick() {
		this.parent.set(this.parent.current + this.regenRate)
	}
}
