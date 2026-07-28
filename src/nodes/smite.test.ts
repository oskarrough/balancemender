import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {combatLogs, clearLogs} from '../combatlog'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {smite as smiteBot} from './bot'
import {GameLoop} from './game-loop'
import {Smite} from './spells'

let game: GameLoop | undefined

beforeEach(() => clearLogs())
afterEach(async () => {
	game?.disconnect()
	await settle()
})

describe('Smite', () => {
	it('damages an enemy as SPELL_DAMAGE and spends mana', async () => {
		const sim = new SimLoop({party: [], enemies: ['TinyWolf']})
		game = sim
		await settle()
		clearLogs()
		const wolf = sim.enemies[0]
		const healthBefore = wolf.health.current
		const manaBefore = sim.player.mana.current

		expect(sim.perform({type: 'use', ability: 'Smite', target: wolf.id}).ok).toBe(true)
		await settle()
		sim.runFrame(0)
		sim.runFrame(1500)
		await settle()

		const damage = healthBefore - wolf.health.current
		expect(damage).toBeGreaterThanOrEqual(15)
		expect(damage).toBeLessThanOrEqual(25)
		expect(sim.player.mana.current).toBe(manaBefore - 40)
		expect(combatLogs.find((event) => event.abilityId === 'Smite' && event.eventType === 'SPELL_DAMAGE')).toMatchObject(
			{
				sourceId: sim.player.id,
				targetId: wolf.id,
				value: damage,
			},
		)
	})

	it('refuses ally targets', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})

		expect(game.perform({type: 'use', ability: 'Smite', target: game.tank.id})).toEqual({
			ok: false,
			error: `Can't use that ability on this target`,
		})
		expect(game.player.currentAbility).toBeUndefined()
	})

	it('uses the same damage ability when an enemy owns it', async () => {
		const sim = new SimLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = sim
		await settle()
		clearLogs()
		const wolf = sim.enemies[0]
		wolf.abilities = {Smite}
		const healthBefore = sim.tank.health.current

		expect(wolf.useAbility('Smite', sim.tank).ok).toBe(true)
		await settle()
		sim.runFrame(0)
		sim.runFrame(1500)
		await settle()

		expect(sim.tank.health.current).toBeLessThan(healthBefore)
		expect(combatLogs.find((event) => event.abilityId === 'Smite' && event.eventType === 'SPELL_DAMAGE')).toMatchObject(
			{
				sourceId: wolf.id,
				targetId: sim.tank.id,
			},
		)
	})
})

describe('smite bot', () => {
	it('heals a hurt ally before damaging an enemy', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game.tank.health.set(game.tank.health.max / 2)

		expect(smiteBot(game.player)).toMatchObject({ability: 'GreaterHeal', target: game.tank})
	})

	it('does not attack when an ally needs healing but no heal is castable', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game.tank.health.set(game.tank.health.max * 0.9)
		game.player.mana.set(40)

		expect(smiteBot(game.player)).toBeUndefined()
	})

	it('focuses the living enemy with lowest health ratio, then absolute health', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'Nakroth']})
		const [wolf, nakroth] = game.enemies
		wolf.health.set(wolf.health.max / 2)
		nakroth.health.set(nakroth.health.max / 2)

		expect(smiteBot(game.player)).toMatchObject({ability: 'Smite', target: wolf})

		nakroth.health.set(nakroth.health.max * 0.4)
		expect(smiteBot(game.player)).toMatchObject({ability: 'Smite', target: nakroth})
	})
})
