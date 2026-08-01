import {afterEach, describe, expect, it} from 'vitest'
import {GameLoop} from './game-loop'
import {applyHit} from './hit'
import {ShieldBash} from './attack'
import {Ability} from './ability'
import {ApplyAura} from './effects'
import {PeriodicAura} from './periodic-aura'
import {HEALING_THREAT_MULTIPLIER} from './threat'
import {settle} from '../test-setup'
import {prefer, Targeting} from './targeting'

let game!: GameLoop
afterEach(() => game.disconnect())

describe('generating threat', () => {
	it('credits actual damage only to the enemy it landed on', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Runt']})
		const [target, observer] = game.enemies
		target.health.set(5)

		applyHit({
			source: game.party[0],
			target,
			amount: -10,
			abilityId: 'Test',
			abilityName: 'Test',
			eventType: 'SWING_DAMAGE',
			school: 'physical',
			threatMultiplier: 3,
		})

		expect(target.threat?.get(game.party[0])).toBe(15)
		expect(observer.threat?.get(game.party[0])).toBe(0)
	})

	it('splits effective healing between living enemies and ignores overhealing', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Runt', 'Runt']})
		const dead = game.enemies[2]
		dead.health.set(0)
		game.party[0].health.set(game.party[0].health.max - 20)
		const heal = () =>
			applyHit({
				source: game.player,
				target: game.party[0],
				amount: 50,
				abilityId: 'Mend',
				abilityName: 'Mend',
				eventType: 'SPELL_HEAL',
				school: 'holy',
			})

		heal()
		const expected = (20 * HEALING_THREAT_MULTIPLIER) / 2
		for (const enemy of game.enemies.slice(0, 2)) expect(enemy.threat?.get(game.player)).toBe(expected)
		expect(dead.threat?.get(game.player)).toBe(0)

		heal()
		for (const enemy of game.enemies.slice(0, 2)) expect(enemy.threat?.get(game.player)).toBe(expected)
	})

	it("applies an ability's multiplier to direct damage", () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		const wolf = game.enemies[0]
		const before = wolf.health.current

		new ShieldBash(game.party[0], wolf).land()

		expect(wolf.threat?.get(game.party[0])).toBe((before - wolf.health.current) * ShieldBash.threatMultiplier)
	})

	it("carries an ability's multiplier into its periodic aura", async () => {
		class TestAura extends PeriodicAura {
			static id = 'Test'
			static name = 'Test'
			static total = 20
			static repeat = 1
		}
		class TestAbility extends Ability {
			static id = 'Test'
			static name = 'Test'
			static targets = 'ally' as const
			static school = 'holy' as const
			static threatMultiplier = 3
			static effects = [new ApplyAura(TestAura, 0.2)]
		}

		game = new GameLoop({party: ['Tank'], enemies: ['Runt', 'Runt']})
		game.party[0].health.set(game.party[0].health.max - 20)
		new TestAbility(game.player, game.party[0]).land()
		await settle()
		const aura = [...game.party[0].auras].find((candidate): candidate is TestAura => candidate instanceof TestAura)
		if (!aura) throw new Error('Test ability did not apply its aura')

		aura.tick()

		const expected = (20 * TestAbility.threatMultiplier * HEALING_THREAT_MULTIPLIER) / 2
		for (const enemy of game.enemies) expect(enemy.threat?.get(game.player)).toBe(expected)
	})
})

describe('threat targeting', () => {
	it('starts tied on the tank and switches only after a challenger exceeds 110%', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['Runt']})
		const wolf = game.enemies[0]
		wolf.targeting = new Targeting(wolf, prefer.threat(wolf))
		const table = wolf.threat
		if (!table) throw new Error('Runt needs a threat table')

		expect([...table.keys()]).toEqual(game.party)
		expect(wolf.targeting?.pick('enemy')).toBe(game.party[0])

		table.set(game.party[0], 100)
		table.set(game.player, 110)
		expect(wolf.targeting?.pick('enemy')).toBe(game.party[0])

		table.set(game.player, 111)
		expect(wolf.targeting?.pick('enemy')).toBe(game.player)
	})
})
