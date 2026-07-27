// @vitest-environment happy-dom
import {describe, expect, it} from 'vitest'
import {Damage, Heal} from './effects'
import {abilityRegistry} from './registry'
import {unitRegistry} from './unit-registry'
import {balance} from '../balance'

describe('the registries survive their import order', () => {
	it.each([
		['abilities', abilityRegistry],
		['units', unitRegistry],
	])('has a value for every %s entry', (_label, registry) => {
		const entries = Object.entries(registry)
		expect(entries.length).toBeGreaterThan(0)
		expect(entries.filter(([, value]) => !value).map(([name]) => name)).toEqual([])
	})

	it('keys every ability by its stable id', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) expect(AbilityClass.id).toBe(id)
	})

	it('snapshots numbers for every balance row', () => {
		for (const [category, rows] of Object.entries(balance)) {
			for (const [name, row] of Object.entries(rows)) {
				expect(Object.keys(row), `balance.${category}.${name}`).not.toHaveLength(0)
			}
		}
	})

	/**
	 * An effect reads its magnitude off the ability that declares it, so a Damage with no range or a
	 * Heal with no amount is a silent nothing at runtime. This is where it stops being silent.
	 */
	it('gives every declared effect the number it reads', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) {
			for (const effect of AbilityClass.effects) {
				if (effect instanceof Damage) {
					expect(AbilityClass.minDamage, `${id} declares Damage`).toBeTypeOf('number')
					expect(AbilityClass.maxDamage, `${id} declares Damage`).toBeTypeOf('number')
				}
				if (effect instanceof Heal) expect(AbilityClass.heal, `${id} declares Heal`).toBeTypeOf('number')
			}
		}
	})

	it('gives every ability something to do', () => {
		for (const [id, AbilityClass] of Object.entries(abilityRegistry)) {
			expect(AbilityClass.effects, `${id} has no effects`).not.toHaveLength(0)
		}
	})

	it('reaches representative tunables', () => {
		expect(balance.abilities.Renew).toMatchObject({heal: 120, cost: 60})
		expect(balance.abilities.WolfBite).toMatchObject({minDamage: 4, maxDamage: 7})
		expect(balance.cadences.WolfBiteCadence).toMatchObject({delay: 4000, interval: 3800})
		expect(balance.auras.Rend).toMatchObject({total: -8, interval: 1000, repeat: 4, delay: 1000})
	})
})
