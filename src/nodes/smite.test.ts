import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {smite as smiteBot} from './bot'
import {GameLoop} from './game-loop'
import {Smite} from './spells'
import {STAT} from './stats'

let game: GameLoop | undefined

afterEach(async () => {
	game?.disconnect()
	await settle()
})

describe('Smite', () => {
	it('damages an enemy as SPELL_DAMAGE and spends mana', async () => {
		const sim = new SimLoop({party: [], enemies: ['TinyWolf']})
		game = sim
		await settle()
		// Drop FIGHT_START and the fight's opening chatter — the cast below is what is asserted on.
		sim.combatLog.clear()
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
		expect(
			sim.combatLog.events.find((event) => event.abilityId === 'Smite' && event.eventType === 'SPELL_DAMAGE'),
		).toMatchObject({
			sourceId: sim.player.id,
			targetId: wolf.id,
			value: damage,
		})
	})

	it('refuses ally targets', () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = tankGame

		expect(tankGame.perform({type: 'use', ability: 'Smite', target: tankGame.party[0].id})).toEqual({
			ok: false,
			error: `Can't use that ability on this target`,
		})
		expect(tankGame.player.currentAbility).toBeUndefined()
	})

	it('uses the same damage ability when an enemy owns it', async () => {
		const sim = new SimLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = sim
		await settle()
		// Drop FIGHT_START and the fight's opening chatter — the cast below is what is asserted on.
		sim.combatLog.clear()
		const wolf = sim.enemies[0]
		wolf.setBaseStat(STAT.INTELLECT, 40)
		wolf.abilities = {Smite}
		const healthBefore = sim.party[0].health.current

		expect(wolf.useAbility('Smite', sim.party[0]).ok).toBe(true)
		await settle()
		sim.runFrame(0)
		sim.runFrame(1500)
		await settle()

		expect(sim.party[0].health.current).toBeLessThan(healthBefore)
		expect(
			sim.combatLog.events.find((event) => event.abilityId === 'Smite' && event.eventType === 'SPELL_DAMAGE'),
		).toMatchObject({
			sourceId: wolf.id,
			targetId: sim.party[0].id,
		})
	})
})

describe('smite bot', () => {
	it('heals a hurt ally before damaging an enemy', () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = tankGame
		tankGame.party[0].health.set(tankGame.party[0].health.max / 2)

		expect(smiteBot(tankGame.player)).toMatchObject({ability: 'GreaterHeal', target: tankGame.party[0]})
	})

	it('does not attack when an ally needs healing but no heal is castable', () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		game = tankGame
		tankGame.party[0].health.set(tankGame.party[0].health.max * 0.9)
		tankGame.player.mana.set(40)

		expect(smiteBot(tankGame.player)).toBeUndefined()
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
