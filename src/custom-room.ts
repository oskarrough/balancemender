import {store} from './store.js'
import {unitRegistry, type UnitId} from './nodes/unit-registry'

const TABLE = 'custom-rooms'
const ROOM = 'default'

export interface CustomRoom {
	party: UnitId[]
	enemies: UnitId[]
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
