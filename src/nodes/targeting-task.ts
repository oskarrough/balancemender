import {Task} from 'vroum'
import {Character} from './character'
import {Tank} from './party-characters'
import {random} from '../rng'

/** Base targeting framework */
export class Targeting extends Task {
	constructor(public parent: Character) {
		super(parent)
	}

	tick() {
		if (this.needsTarget() || this.reconsiders()) {
			this.parent.currentTarget = this.prefers()
		}
	}

	shouldTick() {
		return this.parent.health.current > 0
	}

	needsTarget() {
		return !this.parent.getTarget()
	}

	reconsiders() {
		return false // Default: stay with chosen target (until dead)
	}

	prefers(): Character | undefined {
		const targets = this.getPotentialTargets()
		if (targets.length === 0) return undefined
		return targets[0]
	}

	getPotentialTargets(): Character[] {
		return []
	}
}

/** Targets alive characters from opposite faction */
export class TargetOppositeFaction extends Targeting {
	getPotentialTargets(): Character[] {
		const targets = this.parent.faction === 'party' ? this.parent.parent.enemies : this.parent.parent.party

		return targets.filter((target) => target.health && target.health.current > 0)
	}
}

/** Randomly selects a target from opposite faction */
export class RandomTargeting extends TargetOppositeFaction {
	prefers(): Character | undefined {
		const targets = this.getPotentialTargets()
		if (targets.length === 0) return undefined

		const randomIndex = Math.floor(random() * targets.length)
		return targets[randomIndex]
	}
}

/** Prioritizes targeting tanks */
export class TankTargeting extends TargetOppositeFaction {
	prefers(): Character | undefined {
		const targets = this.getPotentialTargets()
		if (targets.length === 0) return undefined
		const tank = targets.find((target) => target instanceof Tank)
		return tank || targets[0]
	}

	reconsiders(): boolean {
		return !!(
			this.parent.currentTarget &&
			!(this.parent.currentTarget instanceof Tank) &&
			this.getPotentialTargets().some((t) => t instanceof Tank)
		)
	}
}

/** Targets character with lowest health percentage */
export class LowestHealth extends TargetOppositeFaction {
	prefers(): Character | undefined {
		const targets = this.getPotentialTargets()
		if (targets.length === 0) return undefined
		return targets.sort((a, b) => a.health.current / a.health.max - b.health.current / b.health.max)[0]
	}
}
