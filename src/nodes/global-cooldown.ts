import {Task} from '../vroum'
import type {Unit} from './unit'

/**
 * Global Cooldown
 *
 * When this task is added to a unit as its `gcd` property, it will prevent them from casting spells
 * while it exists.
 *
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
