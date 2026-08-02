import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {canAccessMalleable, setMalleableOverride} from './access'
import {clearJournal, readJournal, recordVictory} from './journal'
import {dungeonOrder, dungeonRegistry} from './nodes/dungeon'

beforeEach(async () => {
	setMalleableOverride(false)
	await clearJournal()
})

afterEach(async () => {
	setMalleableOverride(false)
	await clearJournal()
})

describe('Malleable access', () => {
	it('is open by default during rollout', () => {
		expect(canAccessMalleable(readJournal())).toBe(true)
	})

	it('denies an unfinished Journal when rollout is closed', () => {
		expect(canAccessMalleable(readJournal(), false)).toBe(false)
	})

	it('allows a completed Journal when rollout is closed', async () => {
		for (const dungeonId of dungeonOrder) {
			for (const room of dungeonRegistry[dungeonId].rooms) await recordVictory({dungeonId, roomId: room.id})
		}
		expect(canAccessMalleable(readJournal(), false)).toBe(true)
	})

	it('grants and clears the universal override', () => {
		setMalleableOverride(true)
		expect(canAccessMalleable(readJournal(), false)).toBe(true)
		setMalleableOverride(false)
		expect(canAccessMalleable(readJournal(), false)).toBe(false)
	})
})
