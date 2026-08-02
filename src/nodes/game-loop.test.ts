import {afterEach, describe, expect, it} from 'vitest'
import {clearJournal, readJournal} from '../journal'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
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
	// Learned spells are the run's, so a room outside the dungeon must not keep them.
	it('gives the whole bar back when the player walks off the dungeon', async () => {
		game = new GameLoop()
		await settle()

		expect(game.perform({type: 'startDungeon', dungeon: 'TheGreen'}).ok).toBe(true)
		await settle()
		// The first room grants Mend and Lance and nothing else.
		expect(Object.keys(game.player.abilities).sort()).toEqual(['Lance', 'Mend'])

		expect(game.perform({type: 'enter', room: {enemies: ['Runt']}}).ok).toBe(true)
		await settle()

		expect(Object.keys(game.player.abilities).sort()).toEqual(Object.keys(playerAbilities).sort())
	})
})
