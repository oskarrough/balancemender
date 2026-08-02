import type {JournalView} from './journal'

/** Flip to false when Malleable should require completed progression or the Balance Lab override. */
export const MALLEABLE_ROLLOUT_OPEN = true

let malleableOverride = false

export function setMalleableOverride(value: boolean): void {
	malleableOverride = value
}

export function getMalleableOverride(): boolean {
	return malleableOverride
}

export function canAccessMalleable(journal: JournalView, rolloutOpen: boolean = MALLEABLE_ROLLOUT_OPEN): boolean {
	return rolloutOpen || malleableOverride || journal.allComplete
}
