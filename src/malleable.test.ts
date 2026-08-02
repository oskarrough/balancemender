import {describe, expect, it} from 'vitest'
import {addUnit, emptyMalleable, removeUnit, toRoomInput} from './malleable'

describe('Malleable composition', () => {
	it('adds units to either authored side without changing the input', () => {
		const empty = emptyMalleable()
		const party = addUnit(empty, 'party', 'Tank')!
		const enemies = addUnit(party, 'enemy', 'Runt')!

		expect(empty).toEqual({version: 1, party: [], enemies: []})
		expect(enemies).toEqual({version: 1, party: ['Tank'], enemies: ['Runt']})
	})

	it('refuses Player and invalid removals', () => {
		const empty = emptyMalleable()
		expect(addUnit(empty, 'party', 'Player')).toBeNull()
		expect(removeUnit(empty, 'enemy', 0)).toBeNull()
		expect(removeUnit(empty, 'party', -1)).toBeNull()
	})

	it('removes one duplicate by side and index', () => {
		const composition = {version: 1, party: [], enemies: ['Runt', 'Runt', 'Haruk']} as const
		const changed = removeUnit(
			{...composition, party: [...composition.party], enemies: [...composition.enemies]},
			'enemy',
			1,
		)
		expect(changed?.enemies).toEqual(['Runt', 'Haruk'])
	})

	it('turns the saved composition into a fresh room input', () => {
		const composition = {version: 1, party: ['Haruk'], enemies: ['Tank']} as const
		const room = toRoomInput({...composition, party: [...composition.party], enemies: [...composition.enemies]})
		expect(room).toEqual({party: ['Haruk'], enemies: ['Tank']})
		expect(room.party).not.toBe(composition.party)
		expect(room.enemies).not.toBe(composition.enemies)
	})
})
