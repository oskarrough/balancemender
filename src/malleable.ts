import type {RoomInput} from './nodes/fight'
import type {UnitId} from './nodes/unit-registry'
import type {Faction} from './nodes/types'

export const MALLEABLE_SCHEMA_VERSION = 1

/** The autosaved roster for the one player-authored sandbox room. */
export interface MalleableComposition {
	version: typeof MALLEABLE_SCHEMA_VERSION
	party: UnitId[]
	enemies: UnitId[]
}

export function emptyMalleable(): MalleableComposition {
	return {version: MALLEABLE_SCHEMA_VERSION, party: [], enemies: []}
}

/** Return a changed copy, or null when the designated Player was requested. */
export function addUnit(composition: MalleableComposition, side: Faction, unit: UnitId): MalleableComposition | null {
	if (unit === 'Player') return null
	const key = side === 'party' ? 'party' : 'enemies'
	return {...composition, [key]: [...composition[key], unit]}
}

/** Return a changed copy, or null when that side has no entry at the requested index. */
export function removeUnit(
	composition: MalleableComposition,
	side: Faction,
	index: number,
): MalleableComposition | null {
	const key = side === 'party' ? 'party' : 'enemies'
	if (!Number.isInteger(index) || index < 0 || index >= composition[key].length) return null
	return {...composition, [key]: composition[key].filter((_, candidate) => candidate !== index)}
}

/** Build a fresh room input so a Fight cannot mutate the persisted arrays. */
export function toRoomInput(composition: MalleableComposition): RoomInput {
	return {party: [...composition.party], enemies: [...composition.enemies]}
}
