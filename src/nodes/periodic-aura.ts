import {applyStatics} from '../utils'
import {Aura} from './aura'
import {applyHit} from './hit'
import type {AbilitySchool} from './ability'
import type {PlantedAura} from './effects'
import type {Unit} from './unit'

/**
 * An aura that lands in instalments — a heal over time, a poison, a bleed.
 *
 * There is deliberately no separate HOT and DoT class: once the health change itself moved into
 * `applyHit`, the only thing left that differed between them was which way the instalments went,
 * and that is `harms`.
 *
 * Everything about attaching, stacking and going away lives on `Aura`. This class is only the
 * ticking.
 */
export class PeriodicAura extends Aura {
	/**
	 * What the aura lands over its whole life, not per tick — each tick applies
	 * `total / repeat`. Always positive; `harms` says which way it moves a health bar. Named for
	 * the whole because reading it as a per-tick number is exactly how Renew came to heal a fifth
	 * of what it claimed.
	 */
	total = 0
	/**
	 * Which way the instalments go. Declared rather than read back off the sign of `total`, so a
	 * bleed and a heal-over-time are told apart by what they are and not by how big they are.
	 */
	harms = false
	interval = 3000
	repeat = 5
	/**
	 * How long before the first tick. Defaults to the aura's interval; a deliberately immediate
	 * periodic effect opts in with `static delay = 0`.
	 */
	delay = 0

	static id = 'Periodic'
	static name = 'Periodic'
	static total = 0
	static harms = false
	static interval = 3000
	static repeat = 5

	threatMultiplier = 1
	school: AbilitySchool = 'physical'

	/**
	 * The effect that planted this aura sizes it: whatever it resolved arrives as `magnitude`, and
	 * a class default only stands in for an aura constructed without one.
	 */
	constructor(parent: Unit, caster: Unit, planted?: PlantedAura) {
		super(parent, caster)
		applyStatics(this, 'total', 'harms', 'interval', 'repeat')
		this.delay = this.interval
		// Apply separately so the default follows a subclass interval while an explicit zero wins.
		applyStatics(this, 'delay')
		if (planted) {
			this.total = planted.magnitude
			this.threatMultiplier = planted.threatMultiplier
			this.school = planted.school
		}
	}

	tick() {
		const instalment = this.total / this.repeat
		applyHit({
			source: this.caster,
			target: this.parent,
			amount: this.harms ? -instalment : instalment,
			abilityId: this.id,
			abilityName: this.name,
			eventType: this.harms ? 'SPELL_PERIODIC_DAMAGE' : 'SPELL_PERIODIC_HEAL',
			threatMultiplier: this.threatMultiplier,
			school: this.school,
		})
	}

	shouldTick() {
		return this.parent.health.current > 0
	}
}
