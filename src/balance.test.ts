import {afterEach, describe, expect, it} from 'vitest'
import {
	applyTunes,
	balance,
	balanceCategories,
	cadenceClasses,
	parseTune,
	resetBalance,
	type BalanceKind,
} from './balance'
import {GameLoop} from './nodes/game-loop'

describe('parsing a tune', () => {
	it('reads kind, stable id, key and value', () => {
		expect(parseTune('ability:FlashHeal.cost=100')).toEqual({
			kind: 'ability',
			name: 'FlashHeal',
			key: 'cost',
			value: 100,
		})
	})

	it('refuses what it cannot reach', () => {
		expect(() => parseTune('Rend.total=-8')).toThrow(/kind:Name.key=value/)
		expect(() => parseTune('spell:Heal.cost=40')).toThrow(/Unknown tune kind/)
		expect(() => parseTune('ability:Fireball.cost=1')).toThrow(/Unknown ability/)
		expect(() => parseTune('ability:Heal.damage=5')).toThrow(/Unknown ability key/)
		expect(() => parseTune('ability:Heal.cost=lots')).toThrow(/needs a number/)
	})
})

describe('applying a tune', () => {
	afterEach(() => resetBalance())

	it('writes spell- and attack-tagged abilities through one surface', () => {
		applyTunes(['ability:Heal.cost=10', 'ability:SavageBite.minDamage=2', 'cadence:SavageBiteCadence.interval=5000'])
		expect(balance.abilities.Heal.cost).toBe(10)
		expect(balance.abilities.SavageBite.minDamage).toBe(2)
		expect(balance.cadences.SavageBiteCadence.interval).toBe(5000)
	})

	it('keeps opt-in keys absent and refuses tuning them', () => {
		expect(balance.abilities.SavageBite.cost).toBeUndefined()
		expect(() => applyTunes(['ability:SavageBite.cost=10'])).toThrow(/has no cost to tune/)
	})

	it('snapshots cadence tuning onto newly spawned drivers', () => {
		applyTunes(['cadence:SavageBiteCadence.delay=123'])
		const game = new GameLoop({party: [], enemies: ['TinyWolf']})
		expect(game.enemies[0]).toMatchObject({savageBiteCadence: {delay: 123}})
		game.disconnect()
	})

	it('puts every category back where it started', () => {
		const bite = balance.cadences.SavageBiteCadence.interval
		applyTunes(['cadence:SavageBiteCadence.interval=100'])
		resetBalance()
		expect(balance.cadences.SavageBiteCadence.interval).toBe(bite)
	})
})

describe('the categories', () => {
	it('keeps cadence timing separate', () => {
		expect(Object.keys(cadenceClasses)).toEqual([
			'QuickStabCadence',
			'HeavyBlowCadence',
			'SavageBiteCadence',
			'NastyArrowCadence',
			'ShieldBashCadence',
			'MendCadence',
		])
	})

	it('names a class and snapshot row for every kind', () => {
		for (const kind of Object.keys(balanceCategories) as BalanceKind[]) {
			const {keys, classes, state} = balanceCategories[kind]
			expect(keys.length, kind).toBeGreaterThan(0)
			expect(Object.keys(classes).length, kind).toBeGreaterThan(0)
			for (const name of Object.keys(classes)) expect(state[name], `${kind} ${name}`).toBeDefined()
		}
	})
})
