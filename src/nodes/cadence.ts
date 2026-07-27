import {Task} from 'vroum'
import {applyStatics, log} from '../utils'
import {AbilityUse} from './ability-use'
import type {Unit} from './unit'

/** Uses one unit-owned ability on a fixed schedule. Cadence owns when and nothing else. */
export class Cadence extends Task {
	abilityId: string
	delay = 0
	interval = 0
	repeat = Infinity

	static abilityId = ''
	static delay = 0
	static interval = 0

	constructor(
		public parent: Unit,
		abilityId?: string,
	) {
		super(parent)
		applyStatics(this, 'delay', 'interval')
		this.abilityId = abilityId ?? (this.constructor as typeof Cadence).abilityId
		if (!this.abilityId) throw new Error(`${this.constructor.name} needs an ability id to drive`)
	}

	chooses() {
		return true
	}

	shouldTick() {
		if (!this.parent.alive) return false
		const AbilityClass = this.parent.abilities[this.abilityId]
		if (!AbilityClass) return true
		if (AbilityUse.usesCastRules(AbilityClass) && (this.parent.currentAbility || this.parent.gcd)) return false
		return !!this.parent.getTarget()
	}

	tick() {
		if (!this.chooses()) return
		const result = this.parent.useAbility(this.abilityId)
		if (!result.ok) log(`cadence:${this.parent.name}:${this.abilityId}:${result.error}`)
	}
}

export class SmallAttackCadence extends Cadence {
	static abilityId = 'SmallAttack'
	static delay = 0
	static interval = 1600
}

export class MediumAttackCadence extends Cadence {
	static abilityId = 'MediumAttack'
	static delay = 4000
	static interval = 3800
}

export class WolfBiteCadence extends Cadence {
	static abilityId = 'WolfBite'
	static delay = 4000
	static interval = 3800
}

export class HugeAttackCadence extends Cadence {
	static abilityId = 'HugeAttack'
	static delay = 8000
	static interval = 12000
}

export class TankAttackCadence extends Cadence {
	static abilityId = 'TankAttack'
	static delay = 0
	static interval = 2400
}

export class MendCadence extends Cadence {
	static abilityId = 'Mend'
	static delay = 4000
	static interval = 8000
}
