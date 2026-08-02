import {readFightHistory, type FightHistoryView, type SavedFight, type SavedFightRecord} from './fight-history'
import {readJournal, type DungeonProgression, type JournalView} from './journal'
import {dungeonRegistry, type DungeonId} from './nodes/dungeon'

export interface JournalRoomHistory {
	readonly roomId: string
	readonly roomNumber: number
	readonly savedFights: readonly SavedFight[]
}

export interface JournalDungeonHistory {
	readonly dungeonId: DungeonId
	readonly progression: DungeonProgression
	readonly savedFights: readonly SavedFight[]
	readonly rooms: readonly JournalRoomHistory[]
}

/** Progression and evictable saved evidence joined only in this read model. */
export interface JournalHistoryView {
	readonly journal: JournalView
	readonly historyStatus: FightHistoryView['status']
	readonly savedFights: readonly SavedFight[]
	readonly savedFightRecord: SavedFightRecord
	readonly dungeons: readonly JournalDungeonHistory[]
	/** Old rows without a location, and rows whose authored location no longer exists. */
	readonly unplacedSavedFights: readonly SavedFight[]
}

export function readJournalHistory(): JournalHistoryView {
	const journal = readJournal()
	const history = readFightHistory()
	const placed = new Set<string>()
	const dungeons = journal.dungeonProgression.map((progression) => {
		const dungeonId = progression.dungeonId
		const dungeon = dungeonRegistry[dungeonId]
		const rooms = dungeon.rooms.map((room, index) => {
			const savedFights = history.savedFights.filter(
				(fight) => fight.location?.dungeonId === dungeonId && fight.location.roomId === room.id,
			)
			for (const fight of savedFights) placed.add(fight.id)
			return {roomId: room.id, roomNumber: index + 1, savedFights}
		})
		return {
			dungeonId,
			progression,
			rooms,
			savedFights: rooms.flatMap((room) => room.savedFights),
		}
	})

	return {
		journal,
		historyStatus: history.status,
		savedFights: history.savedFights,
		savedFightRecord: history.savedFightRecord,
		dungeons,
		unplacedSavedFights: history.savedFights.filter((fight) => !placed.has(fight.id)),
	}
}
