import {Task} from '../vroum'
import {applyStatics, log} from '../utils'
import {AbilityUse} from './ability-use'
import type {Unit} from './unit'

/**
 * Uses one unit-owned ability on a fixed schedule. Cadence owns when, and picks who from its
 * unit's standing preference among the units that ability's own rule allows.
 */
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
		return !(AbilityUse.usesCastRules(AbilityClass) && (this.parent.currentAbility || this.parent.gcd))
	}

	tick() {
		if (!this.shouldUse()) return
		const AbilityClass = this.parent.abilities[this.abilityId]

		// Ask for an unknown ability once so useAbility's refusal reaches the log.
		if (!AbilityClass) return this.use()

		const targeting = this.parent.targeting

		// A unit with no preference has nothing to choose with, this beat or any other. Say so:
		// beating forever in silence is how a Cadence on a unit that never got a Targeting — the
		// player, for one — looks exactly like a Cadence that is working.
		if (!targeting) return this.refuse('no targeting to choose a target with')

		// Having nobody eligible right now is the other thing entirely, and not a failure at all.
		// Wait for the next beat rather than spend it on a refusal.
		const target = targeting.pick(AbilityClass.targets)
		if (!target) return

		this.use(target)
	}

	private use(target?: Unit) {
		const result = this.parent.useAbility(this.abilityId, target)
		if (!result.ok) this.refuse(result.error)
	}

	private refuse(reason: string) {
		log(`cadence:${this.parent.name}:${this.abilityId}:${reason}`)
	}
}

export class NipCadence extends Cadence {
	static abilityId = 'Nip'
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

/** Long enough between leaps that a heal always fits in the gap, and the first one is not a surprise. */
export class PounceCadence extends Cadence {
	static abilityId = 'Pounce'
	static delay = 5000
	static interval = 4500
}

/** Haruk's telegraphed nuke. The interval is the boss's difficulty dial: every 2s shaved is one more wind-up to answer per fight (playtest wanted him meaner than 12s). */
export class NastyArrowCadence extends Cadence {
	static abilityId = 'NastyArrow'
	static delay = 8000
	static interval = 10000
}

export class ShieldBashCadence extends Cadence {
	static abilityId = 'ShieldBash'
	static delay = 0
	static interval = 2400
}

/**
 * Slow on purpose. At 8s this healed for as much as the tank hit for, to the decimal, so the fight
 * stalled at exactly nobody winning (#51). Half as often puts daylight between the two numbers
 * without shaving `Lick` itself, which stays a heal big enough to be worth racing.
 */
export class LickCadence extends Cadence {
	static abilityId = 'Lick'
	static delay = 4000
	static interval = 16000
}

export class WorryCadence extends Cadence {
	static abilityId = 'Worry'
	static delay = 3000
	static interval = 5000
}

export class AmbushCadence extends Cadence {
	static abilityId = 'Ambush'
	static delay = 6000
	static interval = 8000
}

export class RileCadence extends Cadence {
	static abilityId = 'Rile'
	static delay = 5000
	static interval = 12000
}
