import {describe, it, expect, afterEach} from 'vitest'
import {settle} from '../test-setup'
import {GameLoop} from './game-loop'
import {applyHit} from './hit'
import {PeriodicAura} from './periodic-aura'
import {Renew} from './spells'

/**
 * Every heal and every hit in the game goes through `applyHit`, so what it logs is what the
 * Combat log panel, the Fight report and the simulator all see. A mechanic that changes a
 * health bar some other way is invisible to all three — DoTs used to be exactly that.
 */

let game!: GameLoop
/** Each test builds its own game, so its log starts empty without anyone clearing one. */
const events = () => game.combatLog.events
const deaths = () => events().filter((event) => event.eventType === 'UNIT_DIED')

afterEach(() => game.disconnect())

describe('applyHit', () => {
	it('reports the part of a heal that did nothing', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.party[0].health.set(game.party[0].health.max - 10)

		const landed = applyHit({
			source: game.player,
			target: game.party[0],
			amount: 40,
			abilityId: 'Heal',
			abilityName: 'Heal',
			eventType: 'SPELL_HEAL',
			school: 'holy',
		})

		expect(landed).toBe(10)
		expect(events().at(-1)).toMatchObject({
			eventType: 'SPELL_HEAL',
			sourceId: game.player.id,
			targetId: game.party[0].id,
			value: 40,
			overheal: 30,
		})
	})

	it('leaves overheal off a hit, so damage does not claim it overhealed nothing', () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		applyHit({
			source: game.party[0],
			target: game.party[0],
			amount: -5,
			abilityId: 'Test',
			abilityName: 'Test',
			eventType: 'SWING_DAMAGE',
			school: 'physical',
		})

		expect(events().at(-1)).toMatchObject({eventType: 'SWING_DAMAGE', value: 5})
		expect(events().at(-1)).not.toHaveProperty('overheal')
	})

	it('announces a death once, however many more hits land on the body', () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]
		const hit = (amount: number) =>
			applyHit({
				source: game.party[0],
				target: wolf,
				amount,
				abilityId: 'ShieldBash',
				abilityName: 'Shield Bash',
				eventType: 'SWING_DAMAGE',
				school: 'physical',
			})

		hit(-wolf.health.max)
		expect(deaths()).toHaveLength(1)
		expect(deaths()[0]).toMatchObject({targetId: wolf.id, sourceId: game.party[0].id})

		hit(-10)
		expect(deaths()).toHaveLength(1)
	})
})

describe('PeriodicAura', () => {
	// The old DoT class applied damage without logging anything at all, so a poison was
	// invisible to every report. One class for both directions is what stops that recurring.
	it('logs damage as readily as it logs healing, and credits the caster either way', async () => {
		game = new GameLoop({party: ['Tank'], enemies: ['TinyWolf']})
		const wolf = game.enemies[0]

		class Poison extends PeriodicAura {
			static name = 'Poison'
			static harms = true
			static total = 50
			static interval = 1
			static repeat = 5
		}
		const poison = new Poison(wolf, game.party[0])
		await settle()
		poison.tick()

		expect(events().at(-1)).toMatchObject({
			eventType: 'SPELL_PERIODIC_DAMAGE',
			abilityName: 'Poison',
			sourceId: game.party[0].id,
			targetId: wolf.id,
			value: 10,
		})
	})

	/**
	 * The aura's number is a total over its whole life, not a per-tick one, and Renew sat
	 * at 30 for years meaning 6 a tick — a fifth of what the number implied, and
	 * less healing than Heal for more mana. Pin the total the spell advertises to the total
	 * that lands, so the two cannot drift apart again.
	 */
	it('lands the total a heal-over-time advertises, not a fraction of it', async () => {
		game = new GameLoop({party: ['Tank'], enemies: []})
		game.party[0].health.set(1)

		new Renew(game.player, game.party[0]).land()
		await settle()

		const renew = [...game.party[0].auras].find(
			(aura): aura is PeriodicAura => aura instanceof PeriodicAura && aura.name === 'Renew',
		)
		expect(renew).toBeDefined()
		for (let i = 0; i < renew!.repeat; i++) renew!.tick()

		const healed = events()
			.filter((event) => event.eventType === 'SPELL_PERIODIC_HEAL')
			.reduce((total, event) => total + (event.value ?? 0), 0)
		expect(healed).toBe(Renew.magnitudesFor(game.player)[0])
	})
})
