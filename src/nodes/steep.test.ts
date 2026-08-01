import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {SimLoop} from '../sim/run'
import {TheRust} from './dungeon'
import {steep as steepBot} from './bot'
import type {CombatLogEvent} from '../combatlog'
import type {Unit} from './unit'

let game: SimLoop | undefined

afterEach(async () => {
	game?.disconnect()
	game = undefined
	await settle()
})

const steepEvents = (eventType?: CombatLogEvent['eventType']) =>
	game!.combatLog.events.filter((event) => event.abilityId === 'Steep' && (!eventType || event.eventType === eventType))
const resourceEvents = () => game!.combatLog.events.filter((event) => event.eventType === 'RESOURCE_SPENT')

async function advance(from: number, through: number, step = 100) {
	for (let time = from; time <= through; time += step) {
		game!.runFrame(time)
		await settle()
	}
}

async function startSteep(target: Unit) {
	const result = game!.perform({type: 'use', ability: 'Steep', target: target.id})
	expect(result.ok).toBe(true)
	if (!result.ok) throw new Error(result.error)
	await settle()
	const castId = game!.player.currentAbility?.castId
	expect(castId).toBeTruthy()
	return castId!
}

describe('Steep', () => {
	it('survives Toll interruption as one target-owned payout with one cast attribution', async () => {
		game = new SimLoop({party: ['Tank', 'Wren'], enemies: ['Roha']}, 1)
		await settle()
		await advance(0, 4000)

		const tank = game.party[0]
		tank.health.set(100)
		const manaBefore = game.player.mana!.current
		const castId = await startSteep(tank)

		expect(game.player.mana!.current).toBe(manaBefore - 60)
		expect(resourceEvents()).toHaveLength(1)
		expect(resourceEvents()[0].castId).toBe(castId)
		expect(steepEvents('SPELL_AURA_APPLIED')).toHaveLength(1)

		await advance(4100, 8000)

		expect(steepEvents('SPELL_CAST_INTERRUPTED')).toHaveLength(1)
		expect(steepEvents('SPELL_CAST_SUCCESS')).toHaveLength(0)
		expect(steepEvents('SPELL_PERIODIC_HEAL')).toHaveLength(1)
		for (const event of [...steepEvents(), ...resourceEvents()]) expect(event.castId).toBe(castId)
	})

	it('completes normally without paying twice', async () => {
		game = new SimLoop({party: ['Tank'], enemies: ['Roha']}, 1)
		await settle()
		const tank = game.party[0]
		tank.health.set(1)
		const manaBefore = game.player.mana!.current

		const castId = await startSteep(tank)
		await advance(0, 3500)

		expect(game.player.mana!.current).toBe(manaBefore - 60)
		expect(resourceEvents()).toHaveLength(1)
		expect(resourceEvents()[0].castId).toBe(castId)
		expect(steepEvents('SPELL_CAST_SUCCESS')).toHaveLength(1)
		expect(steepEvents('SPELL_PERIODIC_HEAL')).toHaveLength(1)
		expect(steepEvents('SPELL_PERIODIC_HEAL')[0].castId).toBe(castId)
	})

	it('charges manual cancels and refreshes the pending payout rather than stacking it', async () => {
		game = new SimLoop({party: ['Tank'], enemies: ['Roha']}, 1)
		await settle()
		const tank = game.party[0]
		tank.health.set(1)
		const manaBefore = game.player.mana!.current

		const firstCastId = await startSteep(tank)
		await advance(0, 500)
		expect(game.perform({type: 'interrupt'}).ok).toBe(true)
		await settle()
		const secondCastId = await startSteep(tank)

		expect(game.player.mana!.current).toBe(manaBefore - 120)
		expect(resourceEvents().map((event) => event.castId)).toEqual([firstCastId, secondCastId])
		expect(steepEvents('SPELL_CAST_INTERRUPTED').map((event) => event.castId)).toEqual([firstCastId])
		expect(
			steepEvents()
				.filter((event) => event.eventType.startsWith('SPELL_AURA'))
				.map((event) => event.eventType),
		).toEqual(['SPELL_AURA_APPLIED', 'SPELL_AURA_REFRESH'])
		expect([...tank.auras].filter((aura) => aura.id === 'Steep')).toHaveLength(1)

		await advance(600, 4000)
		expect(steepEvents('SPELL_PERIODIC_HEAL').map((event) => event.castId)).toEqual([secondCastId])
	})

	it.each(['death', 'removal'] as const)('cancels its payout on target %s', async (ending) => {
		game = new SimLoop({party: ['Tank'], enemies: ['Runt']}, 1)
		await settle()
		const tank = game.party[0]
		tank.health.set(1)
		await startSteep(tank)
		game.runFrame(0)

		if (ending === 'death') tank.health.set(0)
		else expect(game.perform({type: 'remove', unit: tank.id}).ok).toBe(true)
		await settle()
		await advance(100, 3500)

		expect(steepEvents('SPELL_PERIODIC_HEAL')).toHaveLength(0)
	})

	it('is granted in The dry bed before Roha, and its bot keeps Patch triage', async () => {
		expect(TheRust.rooms[0]).toMatchObject({name: 'The dry bed'})
		expect(TheRust.rooms[0].grants).toContain('Steep')
		expect(TheRust.rooms[2].name).toBe('Roha')

		game = new SimLoop({party: ['Tank'], enemies: ['Runt']}, 1)
		await settle()
		const tank = game.party[0]
		tank.health.set(tank.health.max * 0.3)
		expect(steepBot(game.player)).toMatchObject({ability: 'Patch', target: tank})

		tank.health.set(tank.health.max * 0.5)
		expect(steepBot(game.player)).toMatchObject({ability: 'Steep', target: tank})

		await startSteep(tank)
		expect(steepBot(game.player)).toBeUndefined()
	})
})
