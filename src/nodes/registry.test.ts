// @vitest-environment happy-dom
import {describe, it, expect} from 'vitest'
import {spellRegistry, attackRegistry} from './registry'
import {unitRegistry} from './unit-registry'
import {balance} from '../balance'

/**
 * The registries and the balance snapshot are built at module-initialisation time, so a value
 * import that closes a loop back into `src/nodes/` leaves them reading half-built classes. The
 * symptom is the quiet kind: an entry that exists with `undefined` for a value, or a balance row
 * with no keys in it. Nothing throws, the game boots, and the Balance Lab is simply missing a
 * spell — see the note in docs/architecture.md.
 *
 * Every import that reaches these modules is one edge away from that, which is why this is
 * asserted rather than assumed.
 */
describe('the registries survive their import order', () => {
	it.each([
		['spells', spellRegistry],
		['attacks', attackRegistry],
		['units', unitRegistry],
	])('has a value for every %s entry', (_label, registry) => {
		const entries = Object.entries(registry)
		expect(entries.length).toBeGreaterThan(0)
		expect(entries.filter(([, value]) => !value).map(([name]) => name)).toEqual([])
	})

	it('snapshots numbers for every balance row', () => {
		for (const [category, rows] of Object.entries(balance)) {
			for (const [name, row] of Object.entries(rows)) {
				expect(Object.keys(row), `balance.${category}.${name}`).not.toHaveLength(0)
			}
		}
	})

	it('reaches the tunables a half-built class would have lost', () => {
		expect(balance.spells.Renew).toMatchObject({heal: 120, cost: 60})
		expect(balance.attacks.WolfBite).toMatchObject({minDamage: 4, maxDamage: 7})
		expect(balance.auras.Rend).toMatchObject({total: -8, interval: 1000, repeat: 4, delay: 1000})
		expect(balance.units.TinyWolf).toMatchObject({maxHealth: 240})
	})
})
