import {applyStatics} from '../utils'
import {Aura} from './aura'
import type {PlantedAura} from './effects'
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
	 * Like every plantable aura, the effect that plants it sizes it — here the size is how much of
	 * the stat it adds. A class default stands in for one constructed without a landing behind it.
	 */
	constructor(parent: Unit, caster: Unit, planted?: PlantedAura) {
		super(parent, caster)
		applyStatics(this, 'stat', 'modifier')
		if (planted) this.modifier = planted.magnitude
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
