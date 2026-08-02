import {afterEach, describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {Brightest, Glow} from './attack'
import {GameLoop} from './game-loop'
import {applyHit} from './hit'
import {SimLoop} from '../sim/run'
import {TheGlow} from './dungeon'
import {HEALING_THREAT_MULTIPLIER} from './threat'
import type {Unit} from './unit'

let game!: GameLoop
let sim: SimLoop | undefined
afterEach(async () => {
	game?.disconnect()
	sim?.disconnect()
	sim = undefined
	await settle()
})

const brightestOn = (unit: Unit) => [...unit.auras].find((aura): aura is Brightest => aura instanceof Brightest)

function heal(target: Unit, amount = 40) {
	return healFrom(game, target, amount)
}

function healFrom(loop: GameLoop, target: Unit, amount = 40) {
	return applyHit({
		source: loop.player,
		target,
		amount,
		abilityId: 'TestHeal',
		abilityName: 'Test Heal',
		eventType: 'SPELL_HEAL',
		school: 'holy',
	})
}

describe('Glow heal-mark', () => {
	it('marks a living full-health target without changing its health', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Sivi']})
		const tank = game.party[0]
		new Glow(game.player, game.enemies[0])
		await settle()
		const health = tank.health.current

		const landed = heal(tank)
		await settle()

		expect(landed).toBe(0)
		expect(tank.health.current).toBe(health)
		expect(brightestOn(tank)).toBeDefined()
		expect(
			game.combatLog.events.some(
				(event) => event.eventType === 'SPELL_AURA_APPLIED' && event.abilityId === Brightest.id,
			),
		).toBe(true)
	})

	it('moves its exclusive Brightest mark to the next healed ally', async () => {
		game = new GameLoop({party: ['Tank', 'Clover'], enemies: ['Sivi']})
		const [tank, clover] = game.party
		new Glow(game.player, game.enemies[0])
		await settle()

		heal(tank)
		await settle()
		expect(brightestOn(tank)).toBeDefined()

		heal(clover)
		await settle()
		expect(brightestOn(tank)).toBeUndefined()
		expect(brightestOn(clover)).toBeDefined()
		expect(
			game.combatLog.events.find(
				(event) =>
					event.eventType === 'SPELL_AURA_REMOVED' && event.abilityId === Brightest.id && event.targetId === tank.id,
			),
		).toMatchObject({extraInfo: 'moved to Clover'})
	})

	it('redirects only Sivi, then falls back to ordinary threat when Brightest fades', async () => {
		game = new GameLoop({party: ['Tank', 'Clover'], enemies: ['Sivi', 'Grub']})
		const [tank, clover] = game.party
		const [sivi, grub] = game.enemies
		for (const enemy of [sivi, grub]) {
			if (!enemy.threat) throw new Error(`${enemy.name} needs a threat table`)
			enemy.threat.set(tank, 100)
		}

		expect(sivi.targeting?.pick('enemy')).toBe(tank)
		expect(grub.targeting?.pick('enemy')).toBe(tank)

		new Glow(game.player, sivi)
		await settle()
		heal(tank)
		await settle()
		expect(sivi.targeting?.pick('enemy')).toBe(tank)

		clover.health.set(clover.health.max - 40)
		heal(clover)
		await settle()

		const ordinaryHealThreat = (40 * HEALING_THREAT_MULTIPLIER) / 2
		for (const enemy of [sivi, grub]) {
			expect(enemy.threat?.get(clover)).toBe(0)
			expect(enemy.threat?.get(game.player)).toBe(ordinaryHealThreat)
		}
		expect(sivi.targeting?.pick('enemy')).toBe(clover)
		expect(grub.targeting?.pick('enemy')).toBe(tank)

		brightestOn(clover)?.disconnect()
		await settle()

		expect(sivi.targeting?.pick('enemy')).toBe(tank)
		expect(
			game.combatLog.events.some(
				(event) => event.eventType === 'SPELL_AURA_REMOVED' && event.abilityId === Brightest.id,
			),
		).toBe(true)
	})

	it('Sivi naturally applies Glow, then returns to threat when Brightest expires', async () => {
		sim = new SimLoop({party: ['Tank', 'Clover'], enemies: ['Sivi']}, 1)
		await settle()
		const [tank, clover] = sim.party
		const sivi = sim.enemies[0]
		if (!sivi.threat) throw new Error('Sivi needs a threat table')
		sivi.threat.set(tank, 100)

		await advance(sim, 0, 2100)
		expect([...sim.player.auras].some((aura) => aura instanceof Glow)).toBe(true)

		expect(healFrom(sim, clover)).toBe(0)
		await settle()
		expect(sivi.targeting?.pick('enemy')).toBe(clover)

		await advance(sim, 2200, 7200)
		expect(brightestOn(clover)).toBeUndefined()
		expect(sivi.targeting?.pick('enemy')).toBe(tank)
	})

	it('lets Brightest spare a wounded ally in the bright-water composition', async () => {
		sim = new SimLoop(TheGlow.rooms[1], 1)
		await settle()
		const [, wren, clover] = sim.party
		const sivi = sim.enemies[0]
		if (!sivi.threat) throw new Error('Sivi needs a threat table')

		await advance(sim, 0, 2100)
		sivi.threat.set(wren, 1000)
		wren.health.set(50)
		clover.health.set(clover.health.max)
		expect(sivi.targeting?.pick('enemy')).toBe(wren)
		expect(healFrom(sim, clover)).toBe(0)
		await settle()
		expect(sivi.targeting?.pick('enemy')).toBe(clover)

		const ambush = sivi.useAbility('Ambush', sivi.targeting?.pick('enemy'))
		expect(ambush.ok).toBe(true)
		if (!ambush.ok) throw new Error(ambush.error)
		await settle()
		ambush.value.tick()

		expect(wren.health.current).toBe(50)
		expect(clover.health.current).toBeLessThan(clover.health.max)
	})

	it('plants no mark when the healer lacks Glow', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Sivi']})

		heal(game.party[0])
		await settle()

		expect(brightestOn(game.party[0])).toBeUndefined()
	})
})

async function advance(loop: SimLoop, from: number, through: number, step = 100) {
	for (let time = from; time <= through; time += step) {
		loop.runFrame(time)
		await settle()
	}
}
