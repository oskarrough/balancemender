import {Node} from '../vroum'
import {clamp} from '../utils'

export type ResourceEvents = {
	CHANGE: string
	EMPTY: string
	FULL: string
}

/** A clamped pool with events on the edges: health, mana, whatever comes next. */
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

	/** Clamps to the pool, and announces the edges only when something actually moved. */
	set(amount: number) {
		const previous = this.current
		this.current = clamp(amount, 0, this.max)
		if (previous === this.current) return this.current

		this.emit(this.events.CHANGE, {previous, current: this.current})
		if (this.current <= 0) this.emit(this.events.EMPTY)
		else if (this.current === this.max && previous < this.max) this.emit(this.events.FULL)

		return this.current
	}
}
