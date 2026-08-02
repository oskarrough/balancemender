import {afterEach, describe, expect, it} from 'vitest'
import {store} from './store.js'
import {loadCustomRoom, saveCustomRoom} from './custom-room'

afterEach(() => store.delRow('custom-rooms', 'default'))

describe('custom room', () => {
	it('round-trips through the shared store', () => {
		saveCustomRoom({party: ['Haruk'], enemies: ['Tank']})

		expect(store.hasRow('custom-rooms', 'default')).toBe(true)
		expect(loadCustomRoom()).toEqual({party: ['Haruk'], enemies: ['Tank']})
	})
})
