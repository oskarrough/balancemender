import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {clearFightHistory, saveFight} from './fight-history'
import {clearJournal} from './journal'
import {readJournalHistory} from './journal-history'
import {TheRust} from './nodes/dungeon'

beforeEach(async () => {
	await clearFightHistory()
	await clearJournal()
})

afterEach(async () => {
	await clearFightHistory()
	await clearJournal()
})

describe('Journal history', () => {
	it('places located saved fights under their dungeon and room, leaving old rows unplaced', async () => {
		const room = TheRust.rooms[1]
		await saveFight({
			outcome: 'victory',
			duration: 1000,
			events: [],
			units: [],
			location: {dungeonId: 'TheRust', roomId: room.id, roomNumber: 2},
		})
		await saveFight({outcome: 'defeat', duration: 500, events: [], units: []})

		const view = readJournalHistory()
		const rust = view.dungeons.find((dungeon) => dungeon.dungeonId === 'TheRust')!
		const placed = rust.rooms.find((candidate) => candidate.roomId === room.id)!.savedFights

		expect(placed).toHaveLength(1)
		expect(placed[0].location).toEqual({dungeonId: 'TheRust', roomId: room.id, roomNumber: 2})
		expect(view.unplacedSavedFights).toHaveLength(1)
		expect(view.unplacedSavedFights[0].outcome).toBe('defeat')
		expect(view.unplacedSavedFights[0].location).toBeUndefined()
	})
})
