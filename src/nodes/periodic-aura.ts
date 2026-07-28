import {applyStatics} from '../utils'
import {Aura} from './aura'
import {applyHit} from './hit'
import type {Unit} from './unit'

/**
 * An aura that lands in instalments — a heal over time, a poison, a bleed.
 *
 * There is deliberately no separate HOT and DoT class: once the health change itself moved
 * into `applyHit`, the only thing left that differed between them was the sign of `total`.
 *
 * Everything about attaching, stacking and going away lives on `Aura`. This class is only the
 * ticking.
 */
export class PeriodicAura extends Aura {
	/**
	 * What the aura lands over its whole life, not per tick — each tick applies
	 * `total / repeat`. Negative hurts. Named for the whole because reading it as a
	 * per-tick number is exactly how Renew came to heal a fifth of what it claimed.
	 */
	total = 0
	interval = 3000
	repeat = 5
	/**
	 * How long before the first tick. Zero means the next frame — `interval` is the gap *between*
	 * ticks, so by default an aura lands an instalment the moment it is applied.
	 *
	 * Set it to `interval` for the Classic behaviour of waiting a full tick. That matters for an
	 * aura refreshed faster than it expires: with no delay, every reapplication buys an immediate
	 * instalment, and the aura is partly a direct hit wearing a periodic's name.
	 */
	delay = 0

	static id = 'Periodic'
	static name = 'Periodic'
	static total = 0
	static interval = 3000
	static repeat = 5
	static delay = 0

	/**
	 * `total` overrides the class default, so a spell can own its own number — see `Renew`, which
	 * keeps it on the spell where the balance lab can reach it.
	 */
	constructor(parent: Unit, caster: Unit, total?: number) {
		super(parent, caster)
		applyStatics(this, 'total', 'interval', 'repeat', 'delay')
		if (total !== undefined) this.total = total
	}

	tick() {
		applyHit({
			source: this.caster,
			target: this.parent,
			amount: this.total / this.repeat,
			abilityId: this.id,
			abilityName: this.name,
			eventType: this.total >= 0 ? 'SPELL_PERIODIC_HEAL' : 'SPELL_PERIODIC_DAMAGE',
		})
	}

	shouldTick() {
		return this.parent.health.current > 0
	}
}
