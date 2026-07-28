import {Node} from '../vroum'
import {clamp} from '../utils'

export type ResourceEvents = {
	CHANGE: string
	EMPTY: string
	FULL: string
}

/**
 * Base class for resources like health, mana, stamina, etc.
 */
export class Resource extends Node {
	max = 0
	current = 0

	constructor(
		public parent: Node,
		max: number = 100,
		public events: ResourceEvents,
	) {
		super(parent)
		this.max = max
		this.current = max
	}

	/**
	 * How full, 0 to 1. Zero when there is no pool at all rather than `NaN`, which is what
	 * `0 / 0` gives and what anything sorting or drawing on this would then propagate.
	 */
	get ratio() {
		return this.max ? this.current / this.max : 0
	}

	/**
	 * Set resource to a new value and emit appropriate events
	 */
	set(amount: number) {
		const oldValue = this.current
		this.current = clamp(amount, 0, this.max)

		// Emit events only if the value changed
		if (oldValue !== this.current) {
			this.emit(this.events.CHANGE, {
				previous: oldValue,
				current: this.current,
			})

			if (this.current <= 0) {
				this.emit(this.events.EMPTY)
			} else if (this.current === this.max && oldValue < this.max) {
				this.emit(this.events.FULL)
			}
		}

		return this.current
	}
}
