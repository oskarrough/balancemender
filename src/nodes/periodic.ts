import {Task} from 'vroum'
import {applyStatics, log} from '../utils'
import {applyHit} from './hit'
// Type-only both ways: character.ts names this class for its `effects` set.
import type {Character} from './character'

/**
 * Something that lands in instalments — a heal over time, a poison, a bleed.
 *
 * There is deliberately no separate HOT and DoT class: once the health change itself moved
 * into `applyHit`, the only thing left that differed between them was the sign of `amount`.
 */
export class PeriodicEffect extends Task {
	name = 'Periodic'
	/** Total over the whole effect; each tick applies `amount / repeat`. Negative hurts. */
	amount = 0
	interval = 3000
	repeat = 5

	casterName = ''
	casterId = ''

	static name = 'Periodic'
	static amount = 0
	static interval = 3000
	static repeat = 5

	/** `parent` is the unit it lands on; `caster` is who to credit it to. */
	constructor(
		public parent: Character,
		public caster: Character,
	) {
		super(parent)
		applyStatics(this, 'name', 'amount', 'interval', 'repeat')
		this.casterName = caster.name
		this.casterId = caster.id
	}

	mount() {
		this.parent.effects.add(this)
		log('effect:mount', this.name)
	}

	tick() {
		applyHit({
			source: this.caster,
			target: this.parent,
			amount: this.amount / this.repeat,
			spell: this.name,
			eventType: this.amount >= 0 ? 'SPELL_PERIODIC_HEAL' : 'SPELL_PERIODIC_DAMAGE',
		})
	}

	shouldTick() {
		return this.parent.health.current > 0
	}

	destroy() {
		this.parent.effects.delete(this)
		log('effect:destroy', this.name)
	}
}
