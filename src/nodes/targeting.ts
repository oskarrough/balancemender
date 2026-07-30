import type {Unit} from './unit'
import {Tank} from './party-units'
import {random} from '../rng'
import {eligible, type TargetRule} from './target-rule'
import {highestThreat, pullsAggro} from './threat'

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

/** Whether this unit carries anything tagged `healing` — what makes it worth killing first. */
const heals = (unit: Unit) => Object.values(unit.abilities).some((ability) => ability.tags.includes('healing'))

export const prefer: {
	first: Preference
	atRandom: (reconsiderChance?: number) => Preference
	lowestHealth: Preference
	healerFirst: Preference
	tankFirst: Preference
	threat: (owner: Unit) => Preference
} = {
	/** Whoever comes first. Stays with them until they die. */
	first: {
		prefers: (candidates: Unit[]) => candidates[0],
		reconsiders: () => false,
	},

	/**
	 * Uses the seeded `random()`, never `Math.random` — a fight replayed from a seed must pick the
	 * same. `reconsiderChance` is the odds of re-rolling on any given attack, not per frame; 0 (the
	 * default) never lets go of its first pick, like the old fixed `atRandom`.
	 */
	atRandom: (reconsiderChance = 0) => ({
		prefers: (candidates: Unit[]) => {
			if (candidates.length === 0) return undefined
			return candidates[Math.floor(random() * candidates.length)]
		},
		reconsiders: () => random() < reconsiderChance,
	}),

	/** The most hurt of them, re-evaluated every tick — the only one that never settles. */
	lowestHealth: {
		// Copies before sorting: `prefers` is handed an array, and sorting it in place would reorder
		// the caller's.
		prefers: (candidates: Unit[]) => [...candidates].sort((a, b) => a.health.ratio - b.health.ratio)[0],
		reconsiders: () => true,
	},

	/**
	 * Anything that can heal, before anything that cannot. Read off the ability's own `healing` tag
	 * rather than off a class, so a unit that is given a heal later becomes a priority target by
	 * saying so in its abilities and nowhere else.
	 *
	 * Without this the party had no way to express "kill the healer first" and no other way to win a
	 * fight containing one: a `WolfShaman` at the back of the array was reached only after every
	 * wolf died, and no wolf could die while it lived (#51).
	 */
	healerFirst: {
		prefers: (candidates: Unit[]) => candidates.find(heals) ?? candidates[0],
		reconsiders: (current: Unit, candidates: Unit[]) => !heals(current) && candidates.some(heals),
	},

	/** A tank if there is one, and it switches over the moment one shows up. */
	tankFirst: {
		prefers: (candidates: Unit[]) => candidates.find((c) => c instanceof Tank) ?? candidates[0],
		reconsiders: (current: Unit, candidates: Unit[]) =>
			!(current instanceof Tank) && candidates.some((c) => c instanceof Tank),
	},

	/**
	 * Highest threat, with enough hysteresis that two nearly equal units do not trade aggro every
	 * attack. The table belongs to the enemy captured by this preference.
	 */
	threat: (owner: Unit) => ({
		prefers: (candidates: Unit[]) => highestThreat(threatTable(owner), candidates),
		reconsiders: (current: Unit, candidates: Unit[]) => pullsAggro(threatTable(owner), current, candidates),
	}),
}

function threatTable(owner: Unit) {
	if (!owner.threat) throw new Error(`${owner.name || owner.id} cannot prefer threat without a threat table`)
	return owner.threat
}

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
