/**
 * Represents the faction a character belongs to
 */
export type Faction = 'party' | 'enemy'

// Constants for faction values
export const FACTION = {
	PARTY: 'party' as Faction,
	ENEMY: 'enemy' as Faction,
} as const

/** How hurt a unit is. See `Character.condition`. */
export type Condition = 'injured' | 'steady' | 'healthy'

/**
 * Where those bands sit, in percent of the health bar. Tunable as `rule:Condition.injured=30`.
 *
 * Here rather than on `Character` so `balance.ts` can register it without importing a class.
 * This module has no imports at all, and a value import that reaches back into a node is how
 * `balance.ts` ends up snapshotting a half-built one — see architecture.md.
 *
 * Unlike every other balance number, this one is read live on each call rather than copied onto
 * instances at construction, so a retune applies to the fight already in progress.
 */
export const CONDITION_THRESHOLDS = {injured: 35, healthy: 80}
