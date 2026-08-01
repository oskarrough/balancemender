import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'

let game: GameLoop | undefined

afterEach(async () => {
	game?.disconnect()
	await settle()
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
