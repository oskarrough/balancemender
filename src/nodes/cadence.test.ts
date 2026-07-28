import {beforeEach, describe, expect, it} from 'vitest'
import {combatLogs, clearLogs} from '../combatlog'
import {SimLoop} from '../sim/run'
import {GameLoop} from './game-loop'
import {Cadence} from './cadence'
import {Nakroth, TinyWolf, WolfShaman, Mend} from './enemies'
import {QuickStab} from './attack'

const step = () => Promise.resolve()
const settle = async () => {
	await step()
	await step()
}

describe('a cadence', () => {
	beforeEach(() => clearLogs())

	it('requests every kind through the unit ability collection', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		await step()
		const [wolf, shaman] = game.enemies
		new Cadence(wolf, 'QuickStab').tick()
		expect(combatLogs.some((event) => event.abilityId === 'QuickStab')).toBe(true)
		new Cadence(shaman, 'Mend').tick()
		expect(shaman.currentAbility?.id).toBe('Mend')
		await settle()
		game.disconnect()
	})

	it('requires one stable ability id', () => {
		const game = new GameLoop({party: [], enemies: []})
		expect(() => new Cadence(game.player)).toThrow(/needs an ability id/)
		game.disconnect()
	})

	it('preserves independent attack timings', async () => {
		const game = new SimLoop({party: ['Tank'], enemies: ['TinyWolf', 'Nakroth']})
		await step()
		const wolf = game.enemies[0] as TinyWolf
		const nakroth = game.enemies[1] as Nakroth
		for (const unit of [...game.party, ...game.enemies]) {
			unit.health.max = 10_000
			unit.health.set(10_000)
		}
		expect([wolf.quickStabCadence.delay, wolf.quickStabCadence.interval]).toEqual([0, 1600])
		expect([wolf.savageBiteCadence.delay, wolf.savageBiteCadence.interval]).toEqual([4000, 3800])
		expect([nakroth.heavyBlowCadence.delay, nakroth.heavyBlowCadence.interval]).toEqual([4000, 3800])
		expect([nakroth.nastyArrowCadence.delay, nakroth.nastyArrowCadence.interval]).toEqual([8000, 12000])
		for (let time = 0; time <= 8000; time += 100) {
			game.runFrame(time)
			await step()
		}
		const times = (id: string) =>
			combatLogs.filter((event) => event.abilityId === id && 'value' in event).map((event) => event.time)
		expect(times('QuickStab')).toEqual([0, 1600, 3200, 4800, 6400, 8000])
		expect(times('SavageBite')).toEqual([4000, 7800])
		expect(times('HeavyBlow')).toEqual([4000, 7800])
		expect(times('NastyArrow')).toEqual([8000])
		expect(times('ShieldBash')).toEqual([0, 2400, 4800, 7200])
		game.disconnect()
	})
})

describe('an enemy cast cadence', () => {
	beforeEach(() => clearLogs())

	it('mends the ally that needs it most', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const [wolf, shaman] = game.enemies
		await step()
		wolf.health.set(wolf.health.max / 2)
		const before = wolf.health.current
		const use = shaman.useAbility('Mend', wolf)
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await step()
		use.value.tick()
		expect(wolf.health.current).toBeGreaterThan(before)
		expect(combatLogs.filter((event) => event.eventType === 'SPELL_HEAL' && event.sourceId === shaman.id)).toHaveLength(
			1,
		)
		game.disconnect()
	})

	/**
	 * The whole point of handing a target to each use: a unit used to have one slot, so carrying
	 * both an attack and a heal meant two drivers overwriting each other's aim.
	 */
	it('lets one unit strike an enemy and mend an ally at the same time', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		await step()
		const [wolf, shaman] = game.enemies
		shaman.abilities = {...shaman.abilities, QuickStab}
		wolf.health.set(wolf.health.max / 2)
		const tankBefore = game.tank.health.current

		new Cadence(shaman, 'QuickStab').tick()
		new Cadence(shaman, 'Mend').tick()
		await step()
		shaman.currentAbility?.tick()

		expect(game.tank.health.current).toBeLessThan(tankBefore)
		expect(wolf.health.current).toBeGreaterThan(wolf.health.max / 2)
		await settle()
		game.disconnect()
	})

	it('uses its own collection, cast rules and cadence rather than mana', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf', 'WolfShaman']})
		const [wolf, shaman] = game.enemies
		await step()
		expect(shaman.useAbility('Heal', wolf)).toMatchObject({ok: false, error: /Ability Heal/})
		expect(wolf.useAbility('Mend', shaman)).toMatchObject({ok: false})
		expect(shaman.mana).toBeUndefined()
		expect(Mend.cost).toBe(0)
		expect((shaman as WolfShaman).cadence.interval).toBeGreaterThan(0)
		expect(shaman.useAbility('Mend', wolf).ok).toBe(true)
		expect((shaman as WolfShaman).cadence.shouldTick()).toBe(false)
		await settle()
		game.disconnect()
	})
})
