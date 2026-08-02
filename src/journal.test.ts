import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {clearJournal, loadJournal, readJournal, recordVictory, setAbilityBar, startingRoomIndex} from './journal'
import {dungeonOrder, dungeonRegistry} from './nodes/dungeon'

const location = (dungeonId: (typeof dungeonOrder)[number], roomId: string) => ({dungeonId, roomId})

// Keep the module-level fallback store isolated when tests run without browser storage.
beforeEach(async () => {
	await clearJournal()
})
afterEach(async () => {
	await clearJournal()
})

describe('Journal', () => {
	it('loads completed rooms and derives their abilities and progression', async () => {
		const room = dungeonRegistry.TheGreen.rooms[0]
		await recordVictory(location('TheGreen', room.id))
		await loadJournal()

		const journal = readJournal()
		expect(journal.completedRooms.TheGreen).toEqual([room.id])
		expect(journal.learnedAbilities).toEqual(['Mend', 'Lance'])
		expect(journal.dungeonProgression[0]).toMatchObject({
			dungeonId: 'TheGreen',
			unlocked: true,
			completed: false,
			firstUnmendedRoomIndex: 1,
		})
		expect(journal.dungeonProgression[1].unlocked).toBe(false)
	})

	it('records a room victory idempotently', async () => {
		const room = dungeonRegistry.TheGreen.rooms[0]
		expect(await recordVictory(location('TheGreen', room.id))).toBe(true)
		expect(await recordVictory(location('TheGreen', room.id))).toBe(false)
		expect(readJournal().completedRooms.TheGreen).toEqual([room.id])
	})

	it('does not unlock later dungeons from out-of-order records', async () => {
		for (const room of dungeonRegistry.TheRust.rooms) await recordVictory(location('TheRust', room.id))
		expect(readJournal().dungeonProgression.map((progress) => progress.unlocked)).toEqual([true, false, false, false])
	})

	it('unlocks dungeons sequentially', async () => {
		for (const room of dungeonRegistry.TheGreen.rooms) await recordVictory(location('TheGreen', room.id))
		let journal = readJournal()
		expect(journal.dungeonProgression.map((progress) => progress.unlocked)).toEqual([true, true, false, false])
		expect(journal.dungeonProgression.map((progress) => progress.completed)).toEqual([true, false, false, false])

		for (const room of dungeonRegistry.TheRust.rooms) await recordVictory(location('TheRust', room.id))
		journal = readJournal()
		expect(journal.dungeonProgression.map((progress) => progress.unlocked)).toEqual([true, true, true, false])
		expect(journal.dungeonProgression.map((progress) => progress.completed)).toEqual([true, true, false, false])
	})

	it('starts an incomplete dungeon at its first unmended room and replays a completed one from room zero', async () => {
		const rooms = dungeonRegistry.TheGreen.rooms
		await recordVictory(location('TheGreen', rooms[0].id))
		expect(startingRoomIndex('TheGreen')).toBe(1)

		for (const room of rooms.slice(1)) await recordVictory(location('TheGreen', room.id))
		expect(startingRoomIndex('TheGreen')).toBe(0)
	})

	it('returns free choice after every dungeon is complete', async () => {
		for (const dungeonId of dungeonOrder)
			for (const room of dungeonRegistry[dungeonId].rooms) await recordVictory(location(dungeonId, room.id))

		const journal = readJournal()
		expect(journal.allComplete).toBe(true)
		expect(journal.dungeonProgression.every((progress) => progress.completed && progress.unlocked)).toBe(true)
	})

	it('persists and reloads the ordered ability bar', async () => {
		await setAbilityBar(['Lance', 'Nip'])
		await loadJournal()
		expect(readJournal().abilityBar).toEqual(['Lance', 'Nip'])
	})
})
