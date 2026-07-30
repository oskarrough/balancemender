import {applyStatics} from '../utils'
import {Aura} from './aura'
import {STAT, type Stat} from './stats'
import type {Unit} from './unit'

/**
 * An aura that adds one temporary contribution to a unit stat. The modifier is owned by this aura
 * instance, so expiry and superseding remove exactly what that instance applied.
 */
export class StatModifierAura extends Aura {
	stat: Stat = STAT.STAMINA
	modifier = 0
	repeat = 1

	static id = 'StatModifier'
	static name = 'Stat modifier'
	static stat: Stat = STAT.STAMINA
	static modifier = 0
	static lifetime = 15000

	/**
	 * `modifier` overrides the class default so an ability can own the number as its magnitude, the
	 * same way Renew owns its periodic total and Shield owns its absorption pool.
	 */
	constructor(parent: Unit, caster: Unit, modifier?: number) {
		super(parent, caster)
		applyStatics(this, 'stat', 'modifier')
		if (modifier !== undefined) this.modifier = modifier
		this.delay = (this.constructor as typeof StatModifierAura).lifetime
	}

	mount() {
		this.parent.addStatModifier(this, this.stat, this.modifier)
	}

	/**
	 * Aura removes a superseded copy from the visible set synchronously, before deferred teardown.
	 * Its stat contribution leaves at the same moment so the fresh copy never overlaps it.
	 */
	supersede() {
		this.parent.removeStatModifier(this)
		super.supersede()
	}

	destroy() {
		// Idempotent: a superseded aura already removed this contribution above.
		this.parent.removeStatModifier(this)
	}
}
