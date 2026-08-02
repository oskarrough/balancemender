import {describe, expect, it} from 'vitest'
import {dungeonRegistry, TheWhite} from './dungeon'

describe('authored room identity', () => {
	it('gives every room a non-empty id unique across the dungeon registry', () => {
		const rooms = Object.values(dungeonRegistry).flatMap((dungeon) => dungeon.rooms)
		const ids = rooms.map((room) => room.id)

		expect(ids.every((id) => id.length > 0)).toBe(true)
		expect(new Set(ids).size).toBe(ids.length)
	})
})

describe('The White room arc', () => {
	it('introduces Hollow, combines it with the bell, then closes on Uvalu', () => {
		expect(TheWhite.rooms.map((room) => room.enemies)).toEqual([
			['Glider', 'Glider'],
			['Ringer', 'Ringer', 'Glider'],
			['Glider', 'Glider', 'Ringer'],
			['Uvalu'],
		])
	})
})
