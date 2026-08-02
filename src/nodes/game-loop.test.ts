import {afterEach, describe, expect, it} from 'vitest'
import {clearJournal, loadJournal, readJournal, recordVictory} from '../journal'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {dungeonRegistry} from './dungeon'
import {playerAbilities} from './registry'

let game: GameLoop | undefined

afterEach(async () => {
	game?.disconnect()
	await settle()
	await clearJournal()
})

describe('game over', () => {
	it('handles game over once per fight', async () => {
		game = new GameLoop({party: [], enemies: ['Runt']})
		await settle()

		game.onGameOver()
		game.onGameOver()

		expect(game.combatLog.events.filter((event) => event.eventType === 'FIGHT_END')).toHaveLength(1)

		game.enter({party: [], enemies: ['Runt']})
		await settle()
		game.onGameOver()

		expect(game.combatLog.events.filter((event) => event.eventType === 'FIGHT_END')).toHaveLength(1)
	})
})

describe('Journal victories', () => {
	it('does not mend a room when the debugger ends a live fight', async () => {
		game = new GameLoop()
		await settle()

		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'}).ok).toBe(true)
		game.onGameOver()
		await settle()

		expect(readJournal().completedRooms).toEqual({})
	})
})

describe('dungeon abilities', () => {
	it('restores the full player catalog outside dungeons', async () => {
		game = new GameLoop()
		await settle()

		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'}).ok).toBe(true)
		await settle()
		expect(Object.keys(game.player.abilities).sort()).toEqual(['Lance', 'Mend'])

		expect(game.perform({type: 'enter', room: {enemies: ['Runt']}}).ok).toBe(true)
		await settle()

		expect(Object.keys(game.player.abilities).sort()).toEqual(Object.keys(playerAbilities).sort())
	})

	it('keeps the current lesson through defeat and retry, then learns it on victory', async () => {
		game = new GameLoop()
		await settle()
		const [firstRoom, teachingRoom] = dungeonRegistry.TheGreen.rooms
		await recordVictory({dungeonId: 'TheGreen', roomId: firstRoom.id})

		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'}).ok).toBe(true)
		await settle()
		expect(Object.keys(game.player.abilities)).toEqual(['Mend', 'Lance', 'Renew'])
		expect(readJournal().learnedAbilities).toEqual(['Mend', 'Lance'])

		expect(game.perform({type: 'wipe', faction: 'party'}).ok).toBe(true)
		game.onGameOver()
		await settle()
		expect(readJournal().completedRooms.TheGreen).toEqual([firstRoom.id])
		expect(readJournal().learnedAbilities).toEqual(['Mend', 'Lance'])

		expect(game.perform({type: 'restart'}).ok).toBe(true)
		await settle()
		expect(Object.keys(game.player.abilities)).toEqual(['Mend', 'Lance', 'Renew'])

		expect(game.perform({type: 'wipe', faction: 'enemy'}).ok).toBe(true)
		game.onGameOver()
		await settle()
		expect(readJournal().completedRooms.TheGreen).toEqual([firstRoom.id, teachingRoom.id])
		expect(readJournal().learnedAbilities).toEqual(['Mend', 'Lance', 'Renew'])
	})

	it('deduplicates learned and current-run grants in stable order', async () => {
		game = new GameLoop()
		await settle()
		await recordVictory({dungeonId: 'TheGreen', roomId: dungeonRegistry.TheGreen.rooms[0].id})

		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'}).ok).toBe(true)
		await settle()
		expect(game.dungeonRun?.room).toBe(1)
		expect(Object.keys(game.player.abilities)).toEqual(['Mend', 'Lance', 'Renew'])
	})

	it('carries learned abilities across a Journal reload and into the next dungeon', async () => {
		game = new GameLoop()
		await settle()
		for (const room of dungeonRegistry.TheGreen.rooms) await recordVictory({dungeonId: 'TheGreen', roomId: room.id})
		await loadJournal()
		expect(dungeonRegistry.TheRust.rooms[0].grants).toEqual(['Steep'])

		expect(game.perform({type: 'startDungeon', dungeon: 'TheRust'}).ok).toBe(true)
		await settle()
		expect(Object.keys(game.player.abilities)).toEqual(['Mend', 'Lance', 'Renew', 'Patch', 'Nettle', 'Shield', 'Steep'])
	})

	it('keeps Glow and White entries nonempty through normal progression', async () => {
		game = new GameLoop()
		await settle()
		for (const dungeonId of ['TheGreen', 'TheRust', 'TheGlow'] as const)
			for (const room of dungeonRegistry[dungeonId].rooms) await recordVictory({dungeonId, roomId: room.id})
		await loadJournal()

		expect(game.perform({type: 'startDungeon', dungeon: 'TheGlow'}).ok).toBe(true)
		await settle()
		expect(Object.keys(game.player.abilities).length).toBeGreaterThan(0)

		expect(game.perform({type: 'startDungeon', dungeon: 'TheWhite'}).ok).toBe(true)
		await settle()
		expect(Object.keys(game.player.abilities).length).toBeGreaterThan(0)
	})
})
