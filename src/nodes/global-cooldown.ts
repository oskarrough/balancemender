import {Task} from 'vroum'
import type {Character} from './character'

/**
 * Global Cooldown
 *
 * When this task is added to a character as its `gcd` property, it will prevent them from casting spells
 * while it exists.
 *
 */
export class GlobalCooldown extends Task {
	repeat = 1
	delay = 1500

	constructor(public parent: Character) {
		super(parent)
	}

	destroy() {
		this.parent.gcd = undefined
	}
}
