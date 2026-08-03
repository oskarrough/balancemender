import type {FightLocation} from '../fight-location'
import {dungeonOrder, dungeonRegistry} from '../nodes/dungeon'
import type {PlayerAbilityId} from '../nodes/registry'
import type {Trial} from './run'

export interface AuthoredRoom {
	id: string
	label: string
	trial: Trial & {abilities: PlayerAbilityId[]; location: FightLocation}
}

/** Build the exact room, cumulative granted kit and stable location from one authored room id. */
export function authoredRoom(id: string): AuthoredRoom {
	for (const [dungeonIndex, dungeonId] of dungeonOrder.entries()) {
		const dungeon = dungeonRegistry[dungeonId]
		const roomIndex = dungeon.rooms.findIndex((room) => room.id === id)
		if (roomIndex < 0) continue
		const room = dungeon.rooms[roomIndex]
		const roomNumber = roomIndex + 1
		const abilities = [
			...new Set([
				...dungeonOrder
					.slice(0, dungeonIndex)
					.flatMap((priorId) => dungeonRegistry[priorId].rooms.flatMap((candidate) => candidate.grants ?? [])),
				...dungeon.rooms.slice(0, roomNumber).flatMap((candidate) => candidate.grants ?? []),
			]),
		]
		const location = {dungeonId: dungeon.id, roomId: room.id, roomNumber}
		return {
			id,
			label: `${dungeon.name} · Room ${roomNumber}: ${room.name ?? room.id}`,
			trial: {room, abilities, location},
		}
	}

	throw new Error(`Unknown room "${id}". Known: ${authoredRoomIds().join(', ')}`)
}

export const authoredRoomIds = () => dungeonOrder.flatMap((id) => dungeonRegistry[id].rooms.map((room) => room.id))
