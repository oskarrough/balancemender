import {afterEach, describe, expect, it, vi} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {lance as smiteBot} from './bot'
import {GameLoop} from './game-loop'
import {Lance} from './spells'
import {STAT} from './stats'
import {Mana} from './mana'

let game: GameLoop | undefined

afterEach(async () => {
	game?.disconnect()
	await settle()
})

describe('Lance', () => {
	it('damages an enemy as SPELL_DAMAGE and spends mana', async () => {
		const sim = new SimLoop({party: [], enemies: ['Runt']})
		game = sim
		await settle()
		// Drop FIGHT_START and the fight's opening chatter — the cast below is what is asserted on.
		sim.combatLog.clear()
		const wolf = sim.enemies[0]
		const healthBefore = wolf.health.current
		const manaBefore = sim.player.mana.current

		expect(sim.perform({type: 'use', ability: 'Lance', target: wolf.id}).ok).toBe(true)
		await settle()
		sim.runFrame(0)
		sim.runFrame(1500)
		await settle()

		const damage = healthBefore - wolf.health.current
		expect(damage).toBeGreaterThanOrEqual(15)
		expect(damage).toBeLessThanOrEqual(25)
		expect(sim.player.mana.current).toBe(manaBefore - 40)
		expect(
			sim.combatLog.events.find((event) => event.abilityId === 'Lance' && event.eventType === 'SPELL_DAMAGE'),
		).toMatchObject({
			sourceId: sim.player.id,
			targetId: wolf.id,
			value: damage,
		})
	})

	it('lets its landing sound outlive cast cleanup', async () => {
		const sim = new SimLoop({party: [], enemies: ['Runt']})
		game = sim
		await settle()
		const play = vi.spyOn(sim.audio, 'play').mockReturnValue(null)
		const wolf = sim.enemies[0]

		expect(sim.perform({type: 'use', ability: 'Lance', target: wolf.id}).ok).toBe(true)
		await settle()
		sim.runFrame(0)
		sim.runFrame(1500)
		await settle()

		expect(play).toHaveBeenCalledWith('spell_cast')
	})

	it('refuses ally targets', () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		game = tankGame

		expect(tankGame.perform({type: 'use', ability: 'Lance', target: tankGame.party[0].id})).toEqual({
			ok: false,
			error: `Can't use that ability on this target`,
		})
		expect(tankGame.player.currentAbility).toBeUndefined()
	})

	it('uses the same damage ability when an enemy owns it', async () => {
		const sim = new SimLoop({party: ['Tank'], enemies: ['Runt']})
		game = sim
		await settle()
		// Drop FIGHT_START and the fight's opening chatter — the cast below is what is asserted on.
		sim.combatLog.clear()
		const wolf = sim.enemies[0]
		wolf.setBaseStat(STAT.INTELLECT, 40)
		wolf.mana = new Mana(wolf, 100)
		wolf.abilities = {Lance}
		const healthBefore = sim.party[0].health.current

		expect(wolf.useAbility('Lance', sim.party[0]).ok).toBe(true)
		await settle()
		sim.runFrame(0)
		sim.runFrame(1500)
		await settle()

		expect(sim.party[0].health.current).toBeLessThan(healthBefore)
		expect(
			sim.combatLog.events.find((event) => event.abilityId === 'Lance' && event.eventType === 'SPELL_DAMAGE'),
		).toMatchObject({
			sourceId: wolf.id,
			targetId: sim.party[0].id,
		})
	})
})

describe('lance bot', () => {
	it('heals a hurt ally before damaging an enemy', () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		game = tankGame
		tankGame.party[0].health.set(tankGame.party[0].health.max / 2)

		expect(smiteBot(tankGame.player)).toMatchObject({ability: 'Mend', target: tankGame.party[0]})
	})

	it('does not attack when an ally needs healing but no heal is castable', () => {
		const tankGame = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		game = tankGame
		tankGame.party[0].health.set(tankGame.party[0].health.max * 0.9)
		tankGame.player.mana.set(40)

		expect(smiteBot(tankGame.player)).toBeUndefined()
	})

	it('focuses the living enemy with lowest health ratio, then absolute health', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Haruk']})
		const [wolf, haruk] = game.enemies
		wolf.health.set(wolf.health.max / 2)
		haruk.health.set(haruk.health.max / 2)

		expect(smiteBot(game.player)).toMatchObject({ability: 'Lance', target: wolf})

		haruk.health.set(haruk.health.max * 0.4)
		expect(smiteBot(game.player)).toMatchObject({ability: 'Lance', target: haruk})
	})
})
