import {TinyWolf, Nakroth} from './enemies'
import {Tank} from './party-characters'
import {Player} from './player'

/**
 * Which units exist, by id.
 *
 * Deliberately separate from `registry.ts`: `player.ts` imports the spell registry, so
 * anything that names the Player class from inside `registry.ts` would be reading it
 * mid-initialisation and get `undefined`. Nothing here may be imported by `player.ts`.
 */

/** Allies. The player is always in the fight, but is spawned like anyone else. */
export const partyRegistry = {
	Tank,
	Player,
} as const

export const enemyRegistry = {
	TinyWolf,
	Nakroth,
} as const

/**
 * Every spawnable unit. `Encounter.spawn()` reads this and routes by the class's own
 * faction, so party and enemies go through one door.
 *
 * Ids are stable strings, unlike `constructor.name`, which the production build minifies.
 */
export const unitRegistry = {
	...partyRegistry,
	...enemyRegistry,
} as const

export type PartyId = keyof typeof partyRegistry
export type EnemyId = keyof typeof enemyRegistry
export type UnitId = keyof typeof unitRegistry
