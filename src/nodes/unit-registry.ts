import type {Unit} from './unit'
import type {Faction} from './types'
import {
	Pup,
	Runt,
	Denmother,
	Haruk,
	Snapjaw,
	Skulker,
	Howler,
	Roha,
	Bellwether,
	Wether,
	Kite,
	Chafer,
	Sivi,
	Muhl,
	Grub,
	GrubDeep,
	Orovan,
	Glider,
	Ringer,
	Uvalu,
} from './enemies'
import {Tank, Wren, Clover} from './party-units'
import {Player} from './player'

/**
 * Every spawnable unit, by id. `Fight.spawn()` reads this and routes by the class's own
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
	Wren,
	Clover,
	Pup,
	Runt,
	Denmother,
	Haruk,
	Snapjaw,
	Skulker,
	Howler,
	Bellwether,
	Wether,
	Kite,
	Chafer,
	Roha,
	Sivi,
	Muhl,
	Grub,
	GrubDeep,
	Orovan,
	Glider,
	Ringer,
	Uvalu,
} as const

export type UnitId = keyof typeof unitRegistry

/** Ids of every unit on a side, for the callers that only offer one (the console, the Balance Lab). */
export function unitIds(faction?: Faction): UnitId[] {
	const ids = Object.keys(unitRegistry) as UnitId[]
	if (!faction) return ids
	return ids.filter((id) => (unitRegistry[id] as unknown as typeof Unit).faction === faction)
}
