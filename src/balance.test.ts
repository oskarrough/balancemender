// @vitest-environment happy-dom — `balance.ts` reaches the game's classes, and the game needs a DOM
import {describe, it, expect, afterEach} from 'vitest'
import {parseTune, applyTunes, balance, balanceCategories, resetBalance, type BalanceKind} from './balance'

/**
 * A tune spec exists so measuring a candidate number does not mean editing a class and putting it
 * back. What it must never do is quietly succeed at nothing: a tune that misses leaves a sweep
 * identical to the baseline, which reads as "the dial does nothing" rather than "you typo'd".
 */

describe('parsing a tune', () => {
	it('reads kind, name, key and value', () => {
		expect(parseTune('aura:Rend.total=-8')).toEqual({kind: 'aura', name: 'Rend', key: 'total', value: -8})
	})

	// Names used to be display names, so this guarded "Flash Heal" surviving the split. They are
	// ids now — bare words — and what is left to guard is that the key comes off the *last* dot.
	it('takes the name from between the colon and the last dot', () => {
		expect(parseTune('spell:FlashHeal.cost=100')).toMatchObject({name: 'FlashHeal', key: 'cost'})
	})

	it('refuses what it cannot reach', () => {
		expect(() => parseTune('Rend.total=-8')).toThrow(/kind:Name.key=value/)
		expect(() => parseTune('potion:Rend.total=-8')).toThrow(/Unknown tune kind/)
		expect(() => parseTune('aura:Bleed.total=-8')).toThrow(/Known: Rend/)
		expect(() => parseTune('spell:Heal.damage=5')).toThrow(/Unknown spell key/)
		expect(() => parseTune('spell:Heal.cost=lots')).toThrow(/needs a number/)
	})
})

describe('applying a tune', () => {
	afterEach(() => resetBalance())

	it('writes through to the balance the game reads', () => {
		applyTunes(['aura:Rend.total=-40', 'spell:Heal.cost=10'])
		expect(balance.auras.Rend.total).toBe(-40)
		expect(balance.spells.Heal.cost).toBe(10)
	})

	/** A real key on the wrong class — a wolf has no mana pool for `maxMana` to mean anything. */
	it('refuses a key the class does not declare', () => {
		expect(() => applyTunes(['unit:TinyWolf.maxMana=100'])).toThrow(/no maxMana to tune/)
	})

	it('puts every category back where it started', () => {
		const bite = balance.attacks.WolfBite.interval
		const wolf = balance.units.TinyWolf.maxHealth
		applyTunes(['attack:WolfBite.interval=100', 'unit:TinyWolf.maxHealth=1'])
		resetBalance()
		expect(balance.attacks.WolfBite.interval).toBe(bite)
		expect(balance.units.TinyWolf.maxHealth).toBe(wolf)
	})
})

/**
 * The table is what stops the four kinds drifting apart — `aura` reached the tune action and the
 * CLI but not the dev console back when each surface hand-listed them.
 */
describe('the categories', () => {
	it('names a class and a snapshot row for every kind', () => {
		for (const kind of Object.keys(balanceCategories) as BalanceKind[]) {
			const {keys, classes, state} = balanceCategories[kind]
			expect(keys.length, kind).toBeGreaterThan(0)
			expect(Object.keys(classes).length, kind).toBeGreaterThan(0)
			for (const name of Object.keys(classes)) expect(state[name], `${kind} ${name}`).toBeDefined()
		}
	})
})
