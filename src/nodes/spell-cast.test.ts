// @vitest-environment happy-dom
import {describe, it, expect} from 'vitest'
import {GameLoop} from './game-loop'
import {SpellCast} from './spell-cast'
import {GlobalCooldown} from './global-cooldown'
import {spellRegistry} from './registry'

/**
 * `validate()` answers two questions that look like one, and the action bar needs only the
 * second of them. Keeping them apart is not a tidiness preference: the global cooldown is up
 * for a fraction of a second after every cast, so an icon drawn from the combined answer goes
 * grey and back several times a second and stops meaning anything.
 */
describe('what a cast is allowed to be', () => {
	const Heal = spellRegistry['Heal']

	it('separates "the player cannot act" from "this spell is unusable"', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.gcd = new GlobalCooldown(player)

		// Same player, same instant, two different answers — that is the whole point.
		expect(SpellCast.whyNotAct(player)).toBe('global-cooldown')
		expect(SpellCast.whyNotCast(player, Heal, game.tank)).toBeUndefined()

		game.disconnect()
	})

	it('still refuses the cast, with the reason it always gave', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.gcd = new GlobalCooldown(player)

		// Composed in the original order, so the player-facing message does not change.
		expect(SpellCast.validate(player, Heal)).toBe('global-cooldown')
		expect(SpellCast.cast(player, 'Heal')).toMatchObject({ok: false, error: `Can't cast during global cooldown`})

		game.disconnect()
	})

	it('answers about the target it was handed, not the one selected', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		// A fresh player is selecting themselves, and is at full health — so the *selected* cast
		// is perfectly legal, and only the handed-in target makes this refusable.
		expect(player.getTarget()).toBe(player)

		const corpse = game.tank
		corpse.health.set(0)
		expect(SpellCast.whyNotCast(player, Heal, corpse)).toBe('missing-target')
		expect(SpellCast.whyNotCast(player, Heal)).toBeUndefined()

		game.disconnect()
	})

	it('holds a spell on its own cooldown, and lets it go when the clock passes', async () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		// No spell ships with a cooldown yet — the numbers are a balance question. Tune one in,
		// which also proves the Balance Lab can reach it.
		expect(game.perform({type: 'tune', of: 'spell', name: 'Heal', key: 'cooldown', value: 8000}).ok).toBe(true)

		expect(game.perform({type: 'cast', spell: 'Heal', target: game.tank.id}).ok).toBe(true)
		// The cooldown starts when the cast lands, so finish it.
		player.spell!._cycles = 1
		player.spell!.destroy()
		await Promise.resolve()

		expect(SpellCast.whyNotCast(player, spellRegistry['Heal'], game.tank)).toBe('cooldown')
		// Only that one spell. A shared cooldown would be the global one, which this is not.
		expect(SpellCast.whyNotCast(player, spellRegistry['Flash Heal'], game.tank)).toBeUndefined()

		game.elapsedTime = 8000
		expect(SpellCast.whyNotCast(player, spellRegistry['Heal'], game.tank)).toBeUndefined()

		game.perform({type: 'resetBalance'})
		game.disconnect()
	})

	it('reports missing mana per spell, which is what an icon draws', () => {
		const game = new GameLoop({party: ['Tank'], enemies: []})
		const player = game.player
		player.mana!.set(spellRegistry['Heal'].cost)

		expect(SpellCast.whyNotCast(player, spellRegistry['Heal'], game.tank)).toBeUndefined()
		expect(SpellCast.whyNotCast(player, spellRegistry['Greater Heal'], game.tank)).toBe('missing-mana')
		// Nothing about the player is wrong — only that one spell is out of reach.
		expect(SpellCast.whyNotAct(player)).toBeUndefined()

		game.disconnect()
	})
})
