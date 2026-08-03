import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {panic, renew as renewBot, shield as shieldBot, triage} from './bot'
import {GameLoop} from './game-loop'
import {Mend, Renew, Shield} from './spells'

let game!: GameLoop
afterEach(() => game.disconnect())

describe('direct-healing bots', () => {
	it('triages with Patch below 40%, otherwise Mend', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]

		tank.health.set(tank.health.max * 0.39)
		expect(triage(game.player)).toMatchObject({ability: 'Patch', target: tank})

		tank.health.set(tank.health.max * 0.4)
		expect(triage(game.player)).toMatchObject({ability: 'Mend', target: tank})
	})

	it('fills an existing Renew with Mend', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]
		tank.health.set(tank.health.max * 0.5)

		new Renew(game.player, tank).land()
		await settle()

		expect(renewBot(game.player)).toMatchObject({ability: 'Mend', target: tank})
	})

	it('spams Patch with a Mend fallback', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]
		tank.health.set(tank.health.max * 0.5)

		expect(panic(game.player)).toMatchObject({ability: 'Patch', target: tank})

		game.player.mana.set(Mend.cost)
		expect(panic(game.player)).toMatchObject({ability: 'Mend', target: tank})
	})

	it('falls back to abilities the current room has granted', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		const tank = game.party[0]
		game.player.abilities = {Mend}
		tank.health.set(tank.health.max * 0.3)

		expect(triage(game.player)).toMatchObject({ability: 'Mend', target: tank})
		expect(panic(game.player)).toMatchObject({ability: 'Mend', target: tank})
		expect(renewBot(game.player)).toMatchObject({ability: 'Mend', target: tank})
		expect(shieldBot(game.player)).toMatchObject({ability: 'Mend', target: tank})
	})
})

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
