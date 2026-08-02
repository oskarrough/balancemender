import {afterEach, describe, expect, it} from 'vitest'
import {store} from './store.js'
import {addRoomUnit, emptyCustomRoom, loadCustomRoom, removeRoomUnit, saveCustomRoom} from './custom-room'

afterEach(() => store.delRow('custom-rooms', 'default'))

describe('custom room', () => {
	it('adds units to either side without changing the input', () => {
		const empty = emptyCustomRoom()
		const party = addRoomUnit(empty, 'party', 'Tank')!
		const enemies = addRoomUnit(party, 'enemy', 'Runt')!

		expect(empty).toEqual({party: [], enemies: []})
		expect(enemies).toEqual({party: ['Tank'], enemies: ['Runt']})
	})

	it('refuses Player and invalid removals', () => {
		const empty = emptyCustomRoom()
		expect(addRoomUnit(empty, 'party', 'Player')).toBeNull()
		expect(removeRoomUnit(empty, 'enemy', 0)).toBeNull()
		expect(removeRoomUnit(empty, 'party', -1)).toBeNull()
	})

	it('removes one duplicate by side and index', () => {
		const changed = removeRoomUnit({party: [], enemies: ['Runt', 'Runt', 'Haruk']}, 'enemy', 1)
		expect(changed?.enemies).toEqual(['Runt', 'Haruk'])
	})

	it('round-trips through the shared store', () => {
		saveCustomRoom({party: ['Haruk'], enemies: ['Tank']})

		expect(store.hasRow('custom-rooms', 'default')).toBe(true)
		expect(loadCustomRoom()).toEqual({party: ['Haruk'], enemies: ['Tank']})
	})
})
