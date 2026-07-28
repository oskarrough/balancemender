import {Task} from '../vroum'
import type {Unit} from './unit'

/**
 * Sat on a unit as its `gcd`, this blocks casting for as long as it exists. One cycle, so vroum
 * disconnects it when the delay is up and `destroy()` clears the slot.
 */
export class GlobalCooldown extends Task {
	repeat = 1
	delay = 1500

	constructor(public parent: Unit) {
		super(parent)
	}

	destroy() {
		this.parent.gcd = undefined
	}
}
