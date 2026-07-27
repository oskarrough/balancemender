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

	/** Where a unit with real decisions puts them. By default the schedule is the whole decision. */
	shouldUse() {
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
		if (!this.shouldUse()) return
		const result = this.parent.useAbility(this.abilityId)
		if (!result.ok) log(`cadence:${this.parent.name}:${this.abilityId}:${result.error}`)
	}
}

export class QuickStabCadence extends Cadence {
	static abilityId = 'QuickStab'
	static delay = 0
	static interval = 1600
}

export class HeavyBlowCadence extends Cadence {
	static abilityId = 'HeavyBlow'
	static delay = 4000
	static interval = 3800
}

export class SavageBiteCadence extends Cadence {
	static abilityId = 'SavageBite'
	static delay = 4000
	static interval = 3800
}

export class NastyArrowCadence extends Cadence {
	static abilityId = 'NastyArrow'
	static delay = 8000
	static interval = 12000
}

export class ShieldBashCadence extends Cadence {
	static abilityId = 'ShieldBash'
	static delay = 0
	static interval = 2400
}

export class MendCadence extends Cadence {
	static abilityId = 'Mend'
	static delay = 4000
	static interval = 8000
}
