import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {Cadence} from './cadence'
import {GameLoop} from './game-loop'
import {Haruk, Runt, Denmother} from './enemies'
import {Lick} from './spells'
import {Nip} from './attack'

let game!: GameLoop
const events = () => game.combatLog.events
afterEach(() => game.disconnect())

describe('a cadence', () => {
	it('requests every kind through the unit ability collection', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Denmother']})
		await settle()
		const [wolf, denmother] = game.enemies
		new Cadence(wolf, 'Nip').tick()
		expect(events().some((event) => event.abilityId === 'Nip')).toBe(true)
		new Cadence(denmother, 'Lick').tick()
		expect(denmother.currentAbility?.id).toBe('Lick')
		await settle()
	})

	it('requires one stable ability id', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		expect(() => new Cadence(game.player)).toThrow(/needs an ability id/)
	})

	it('preserves independent attack timings', async () => {
		const sim = new SimLoop({party: ['Tank'], enemies: ['Runt', 'Haruk']})
		game = sim
		await settle()
		const wolf = game.enemies[0] as Runt
		const haruk = game.enemies[1] as Haruk
		for (const unit of [...game.party, ...game.enemies]) {
			unit.health.max = 10_000
			unit.health.set(10_000)
		}
		expect([wolf.nipCadence.delay, wolf.nipCadence.interval]).toEqual([0, 1600])
		expect([wolf.savageBiteCadence.delay, wolf.savageBiteCadence.interval]).toEqual([4000, 3800])
		expect([haruk.heavyBlowCadence.delay, haruk.heavyBlowCadence.interval]).toEqual([4000, 3800])
		expect([haruk.nastyArrowCadence.delay, haruk.nastyArrowCadence.interval]).toEqual([8000, 10000])
		for (let time = 0; time <= 8000; time += 100) {
			sim.runFrame(time)
			await settle()
		}
		const times = (id: string) =>
			events()
				.filter((event) => event.abilityId === id && 'value' in event)
				.map((event) => event.time)
		expect(times('Nip')).toEqual([0, 1600, 3200, 4800, 6400, 8000])
		expect(times('SavageBite')).toEqual([4000, 7800])
		expect(times('HeavyBlow')).toEqual([4000, 7800])
		expect(times('NastyArrow')).toEqual([8000])
		expect(times('ShieldBash')).toEqual([0, 2400, 4800, 7200])
	})
})

describe('an enemy cast cadence', () => {
	it('mends the ally that needs it most', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Denmother']})
		const [wolf, denmother] = game.enemies
		await settle()
		wolf.health.set(wolf.health.max / 2)
		const before = wolf.health.current
		const use = denmother.useAbility('Lick', wolf)
		expect(use.ok).toBe(true)
		if (!use.ok) return
		await settle()
		use.value.tick()
		expect(wolf.health.current).toBeGreaterThan(before)
		expect(
			events().filter((event) => event.eventType === 'SPELL_HEAL' && event.sourceId === denmother.id),
		).toHaveLength(1)
	})

	/**
	 * The whole point of handing a target to each use: a unit used to have one slot, so carrying
	 * both an attack and a heal meant two drivers overwriting each other's aim.
	 */
	it('lets one unit strike an enemy and mend an ally at the same time', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Denmother']})
		await settle()
		const [wolf, denmother] = game.enemies
		denmother.abilities = {...denmother.abilities, Nip}
		wolf.health.set(wolf.health.max / 2)
		const tankBefore = game.party[0].health.current

		new Cadence(denmother, 'Nip').tick()
		new Cadence(denmother, 'Lick').tick()
		await settle()
		denmother.currentAbility?.tick()

		expect(game.party[0].health.current).toBeLessThan(tankBefore)
		expect(wolf.health.current).toBeGreaterThan(wolf.health.max / 2)
		await settle()
	})

	it('uses its own collection, cast rules and cadence rather than mana', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Denmother']})
		const [wolf, denmother] = game.enemies
		await settle()
		expect(denmother.useAbility('Heal', wolf)).toMatchObject({ok: false, error: /Ability Heal/})
		expect(wolf.useAbility('Lick', denmother)).toMatchObject({ok: false})
		expect(denmother.mana).toBeUndefined()
		expect(Lick.cost).toBe(0)
		expect((denmother as Denmother).cadence.interval).toBeGreaterThan(0)
		expect(denmother.useAbility('Lick', wolf).ok).toBe(true)
		expect((denmother as Denmother).cadence.shouldTick()).toBe(false)
		await settle()
	})
})
