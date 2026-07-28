import {Node} from '../vroum'
import {Resource} from './resource'
import type {GameLoop} from './game-loop'

export const HEALTH_EVENTS = {
	CHANGE: 'health:change',
	EMPTY: 'health:empty',
	FULL: 'health:full',
} as const

/** A health bar. Nothing outside `applyHit()` should be moving one — see `hit.ts`. */
export class Health extends Resource {
	constructor(parent: Node, max = 100) {
		super(parent, max, HEALTH_EVENTS)
	}

	heal(amount: number) {
		return this.set(this.current + amount)
	}

	damage(amount: number) {
		const {godMode} = this.root as GameLoop
		const next = this.current - amount
		return this.set(godMode ? Math.max(1, next) : next)
	}
}
