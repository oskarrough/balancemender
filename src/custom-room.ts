import {store} from './store.js'
import {unitRegistry, type UnitId} from './nodes/unit-registry'
import type {Faction} from './nodes/types'

const TABLE = 'custom-rooms'
const ROOM = 'default'

export interface CustomRoom {
	party: UnitId[]
	enemies: UnitId[]
}

export function emptyCustomRoom(): CustomRoom {
	return {party: [], enemies: []}
}

function unitIds(value: unknown): UnitId[] {
	if (typeof value !== 'string') return []
	try {
		const ids: unknown = JSON.parse(value)
		if (!Array.isArray(ids)) return []
		return ids.filter((id): id is UnitId => typeof id === 'string' && id !== 'Player' && id in unitRegistry)
	} catch {
		return []
	}
}

/** Read the one saved custom room, dropping corrupt or unknown units. */
export function loadCustomRoom(): CustomRoom {
	const room = store.getRow(TABLE, ROOM)
	return {party: unitIds(room.party), enemies: unitIds(room.enemies)}
}

export function saveCustomRoom(room: CustomRoom): void {
	store.setRow(TABLE, ROOM, {
		party: JSON.stringify(room.party),
		enemies: JSON.stringify(room.enemies),
	})
}

/** Return a changed copy, or null when the designated Player was requested. */
export function addRoomUnit(room: CustomRoom, side: Faction, unit: UnitId): CustomRoom | null {
	if (unit === 'Player') return null
	const key = side === 'party' ? 'party' : 'enemies'
	return {...room, [key]: [...room[key], unit]}
}

/** Return a changed copy, or null when that side has no entry at the requested index. */
export function removeRoomUnit(room: CustomRoom, side: Faction, index: number): CustomRoom | null {
	const key = side === 'party' ? 'party' : 'enemies'
	if (!Number.isInteger(index) || index < 0 || index >= room[key].length) return null
	return {...room, [key]: room[key].filter((_, candidate) => candidate !== index)}
}
