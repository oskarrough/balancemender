import type {Unit} from './unit'
import {Tank} from './party-units'
import {random} from '../rng'
import {eligible, type TargetRule} from './target-rule'

export {eligible, type TargetRule} from './target-rule'

/**
 * Which of the eligible units to take. A property of the driver, not of the ability.
 *
 * The two methods stay together because they have to agree: a preference for the most hurt ally
 * that never looks again keeps healing someone already topped up.
 */
export interface Preference {
	prefers(candidates: Unit[]): Unit | undefined
	/** Whether to pick again while still holding a live target. */
	reconsiders(current: Unit, candidates: Unit[]): boolean
}

export const prefer = {
	/** Whoever comes first. Stays with them until they die. */
	first: {
		prefers: (candidates: Unit[]) => candidates[0],
		reconsiders: () => false,
	},

	/** Uses the seeded `random()`, never `Math.random` — a fight replayed from a seed must pick the same. */
	atRandom: {
		prefers: (candidates: Unit[]) => {
			if (candidates.length === 0) return undefined
			return candidates[Math.floor(random() * candidates.length)]
		},
		reconsiders: () => false,
	},

	/** The most hurt of them, re-evaluated every tick — the only one that never settles. */
	lowestHealth: {
		// Copies before sorting: `prefers` is handed an array, and sorting it in place would reorder
		// the caller's.
		prefers: (candidates: Unit[]) => [...candidates].sort((a, b) => a.health.ratio - b.health.ratio)[0],
		reconsiders: () => true,
	},

	/** A tank if there is one, and it switches over the moment one shows up. */
	tankFirst: {
		prefers: (candidates: Unit[]) => candidates.find((c) => c instanceof Tank) ?? candidates[0],
		reconsiders: (current: Unit, candidates: Unit[]) =>
			!(current instanceof Tank) && candidates.some((c) => c instanceof Tank),
	},
} satisfies Record<string, Preference>

/**
 * A unit's standing preference, asked once per use of an ability.
 *
 * It remembers who it settled on per target rule, not per unit, so a unit that both attacks and
 * heals keeps an enemy and an ally at the same time instead of two drivers fighting over one slot.
 * Nobody reads what it chose afterwards: the pick is handed to the use that asked for it.
 */
export class Targeting {
	private settled = new Map<TargetRule, Unit>()

	constructor(
		public parent: Unit,
		public preference: Preference,
	) {}

	/** Who to use an ability with this rule on, right now. A corpse picks nobody. */
	pick(rule: TargetRule): Unit | undefined {
		if (!this.parent.alive) return undefined
		const candidates = eligible(this.parent, rule)
		const current = this.settled.get(rule)
		const keep = current && candidates.includes(current) && !this.preference.reconsiders(current, candidates)
		const target = keep ? current : this.preference.prefers(candidates)
		if (target) this.settled.set(rule, target)
		else this.settled.delete(rule)
		return target
	}
}
