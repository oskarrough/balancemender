import type {Unit} from './unit'
import type {Faction} from './types'
import {TinyWolf, WolfShaman, Nakroth} from './enemies'
import {Tank} from './party-units'
import {Player} from './player'

/**
 * Every spawnable unit, by id. `Encounter.spawn()` reads this and routes by the class's own
 * faction, so party and enemies go through one door.
 *
 * Ids are stable strings, unlike `constructor.name`, which the production build minifies. They are
 * also the keys of `balance.units`.
 *
 * Separate from `registry.ts` on purpose: `player.ts` imports the ability registry, so naming the
 * `Player` class from inside `registry.ts` would read it mid-initialisation and get `undefined`.
 * Nothing here may be imported by `player.ts`.
 */
export const unitRegistry = {
	Player,
	Tank,
	TinyWolf,
	WolfShaman,
	Nakroth,
} as const

export type UnitId = keyof typeof unitRegistry

/** Ids of every unit on a side, for the callers that only offer one (the console, the Balance Lab). */
export function unitIds(faction?: Faction): UnitId[] {
	const ids = Object.keys(unitRegistry) as UnitId[]
	if (!faction) return ids
	return ids.filter((id) => (unitRegistry[id] as unknown as typeof Unit).faction === faction)
}
