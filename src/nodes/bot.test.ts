import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {shield as shieldBot} from './bot'
import {GameLoop} from './game-loop'
import {Shield} from './spells'

let game!: GameLoop
afterEach(() => game.disconnect())

describe('shield bot', () => {
	it('shields the next tank when another is already protected', async () => {
		game = new GameLoop({party: ['Tank', 'Tank'], enemies: []})
		await settle()
		const [firstTank, secondTank] = game.party

		expect(shieldBot(game.player)).toMatchObject({ability: 'Shield', target: firstTank})

		new Shield(game.player, firstTank).land()
		await settle()

		expect(shieldBot(game.player)).toMatchObject({ability: 'Shield', target: secondTank})
	})
})
