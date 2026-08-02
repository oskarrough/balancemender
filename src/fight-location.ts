import {dungeonRegistry, type DungeonId} from './nodes/dungeon'

/** Stable location attached to one fight, with a 1-based room number captured for display. */
export interface FightLocation {
	dungeonId: DungeonId
	roomId: string
	roomNumber: number
}

/**
 * Turn stable location data into current display text. Names are looked up at render time so a
 * renamed dungeon or room is readable without rewriting stored history; ids remain the fallback
 * when an old or malformed record no longer resolves in the current registry.
 */
export function formatFightLocation(location?: FightLocation): string | undefined {
	if (!location) return undefined

	const dungeon = dungeonRegistry[location.dungeonId]
	const room = dungeon?.rooms.find((candidate) => candidate.id === location.roomId)
	const dungeonName = dungeon?.name || location.dungeonId || 'Unknown dungeon'
	const roomName = room?.name || location.roomId || `Room ${location.roomNumber}`
	return `${dungeonName} · Room ${location.roomNumber}: ${roomName}`
}
