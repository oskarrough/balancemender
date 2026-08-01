import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {GameLoop} from './game-loop'
import {Waft} from './attack'

let game: GameLoop | undefined
afterEach(async () => {
	game?.disconnect()
	game = undefined
	await settle()
})

describe('Waft', () => {
	it('lands on every living ally, not just the one held target', async () => {
		game = new GameLoop({party: ['Tank', 'Wren'], enemies: ['Muhl']})
		const muhl = game.enemies[0]
		const [oak, wren, player] = game.party
		const before = {oak: oak.health.current, wren: wren.health.current, player: player.health.current}

		new Waft(muhl, oak).land()
		await settle()

		expect(oak.health.current).toBeLessThan(before.oak)
		expect(wren.health.current).toBeLessThan(before.wren)
		expect(player.health.current).toBeLessThan(before.player)
	})
})

describe('Grub', () => {
	it('stays asleep until its cadence delay, then swings HeavyBlow', async () => {
		game = new SimLoop({party: ['Tank'], enemies: ['Grub']})
		await settle()
		for (const unit of game.fight.units) {
			unit.health.max = 10_000
			unit.health.set(10_000)
		}

		for (let time = 0; time <= 5900; time += 100) game.runFrame(time)
		expect(game.combatLog.events.some((event) => event.abilityId === 'HeavyBlow')).toBe(false)

		for (let time = 6000; time <= 6500; time += 100) game.runFrame(time)
		expect(game.combatLog.events.some((event) => event.abilityId === 'HeavyBlow')).toBe(true)
	})
})
