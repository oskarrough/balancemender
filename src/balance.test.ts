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
import {Renew} from './nodes/spells'
import {settle} from './test-setup'

describe('parsing a tune', () => {
	it('reads kind, stable id, key and value', () => {
		expect(parseTune('ability:Patch.cost=100')).toEqual({
			kind: 'ability',
			name: 'Patch',
			key: 'cost',
			value: 100,
		})
	})

	it('refuses what it cannot reach', () => {
		expect(() => parseTune('Rend.coefficient=-0.4')).toThrow(/kind:Name.key=value/)
		expect(() => parseTune('spell:Mend.cost=40')).toThrow(/Unknown tune kind/)
		expect(() => parseTune('ability:Fireball.cost=1')).toThrow(/Unknown ability/)
		expect(() => parseTune('ability:Mend.damage=5')).toThrow(/Unknown ability key/)
		expect(() => parseTune('ability:Mend.cost=lots')).toThrow(/needs a number/)
	})
})

describe('applying a tune', () => {
	afterEach(() => resetBalance())

	it('writes spell- and attack-tagged abilities through one surface', () => {
		applyTunes([
			'ability:Mend.cost=10',
			'effect:SavageBite.damage.coefficient=0.2',
			'ability:ShieldBash.threatMultiplier=7',
			'cadence:SavageBiteCadence.interval=5000',
			'rule:Damage.variance=0.1',
			'effect:SavageBite.rend.coefficient=0.4',
			'effect:Shield.barrier.coefficient=1.2',
			'aura:Rend.interval=1500',
		])
		expect(balance.abilities.Mend.cost).toBe(10)
		expect(balance.effects['SavageBite.damage'].coefficient).toBe(0.2)
		expect(balance.abilities.ShieldBash.threatMultiplier).toBe(7)
		expect(balance.cadences.SavageBiteCadence.interval).toBe(5000)
		expect(balance.rules.Damage.variance).toBe(0.1)
		expect(balance.effects['SavageBite.rend'].coefficient).toBe(0.4)
		expect(balance.effects['Shield.barrier'].coefficient).toBe(1.2)
		expect(balance.auras.Rend.interval).toBe(1500)
	})

	it('keeps opt-in keys absent and refuses tuning them', () => {
		expect(balance.abilities.SavageBite.cost).toBeUndefined()
		expect(() => applyTunes(['ability:SavageBite.cost=10'])).toThrow(/has no cost to tune/)
	})

	it('snapshots cadence tuning onto newly spawned drivers', () => {
		applyTunes(['cadence:SavageBiteCadence.delay=123'])
		const game = new GameLoop({party: [], enemies: ['Runt']})
		expect(game.enemies[0]).toMatchObject({savageBiteCadence: {delay: 123}})
		game.disconnect()
	})

	it('snapshots aura tuning onto the next aura applied', async () => {
		applyTunes(['aura:Renew.maxStacks=2'])
		const game = new GameLoop({party: ['Tank'], enemies: []})

		new Renew(game.player, game.party[0]).land()
		await settle()
		new Renew(game.player, game.party[0]).land()
		await settle()

		expect([...game.party[0].auras].filter((aura) => aura.id === 'Renew')).toHaveLength(2)
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
	it('balances Patch as the expensive fast heal and Mend as the efficient slow heal', () => {
		expect(balance.abilities.Patch).toMatchObject({cost: 80, castTime: 1000})
		expect(balance.effects['Patch.heal']).toMatchObject({coefficient: 1})
		expect(balance.abilities.Mend).toMatchObject({cost: 60, castTime: 3000})
		expect(balance.effects['Mend.heal']).toMatchObject({coefficient: 1.45})
	})

	it('keeps cadence timing separate', () => {
		expect(Object.keys(cadenceClasses)).toEqual([
			'NipCadence',
			'HeavyBlowCadence',
			'SavageBiteCadence',
			'NastyArrowCadence',
			'ShieldBashCadence',
			'SlingCadence',
			'LickCadence',
			'PounceCadence',
			'WorryCadence',
			'AmbushCadence',
			'RileCadence',
			'BellSwingCadence',
			'TollCadence',
			'TrampleCadence',
			'SporeCadence',
			'WaftCadence',
			'GrubWakeCadence',
			'GrubWakeCadenceLate',
			'GroundfallCadence',
			'SiviAmbushCadence',
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
