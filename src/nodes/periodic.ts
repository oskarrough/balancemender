import {Task} from 'vroum'
import {applyStatics, log} from '../utils'
import {applyHit} from './hit'
// Type-only both ways: character.ts names this class for its `effects` set.
import type {Character} from './character'

/**
 * Something that lands in instalments — a heal over time, a poison, a bleed.
 *
 * There is deliberately no separate HOT and DoT class: once the health change itself moved
 * into `applyHit`, the only thing left that differed between them was the sign of `total`.
 */
export class PeriodicEffect extends Task {
	name = 'Periodic'
	/**
	 * What the effect lands over its whole life, not per tick — each tick applies
	 * `total / repeat`. Negative hurts. Named for the whole because reading it as a
	 * per-tick number is exactly how Renew came to heal a fifth of what it claimed.
	 */
	total = 0
	interval = 3000
	repeat = 5

	casterName = ''
	casterId = ''

	static name = 'Periodic'
	static total = 0
	static interval = 3000
	static repeat = 5

	/**
	 * `parent` is the unit it lands on; `caster` is who to credit it to. `total` overrides the
	 * class default, so a spell can own its own number — see `Renew`, which keeps it on the
	 * spell where the balance lab can reach it.
	 */
	constructor(
		public parent: Character,
		public caster: Character,
		total?: number,
	) {
		super(parent)
		applyStatics(this, 'name', 'total', 'interval', 'repeat')
		if (total !== undefined) this.total = total
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
			amount: this.total / this.repeat,
			spell: this.name,
			eventType: this.total >= 0 ? 'SPELL_PERIODIC_HEAL' : 'SPELL_PERIODIC_DAMAGE',
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
