import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {CombatLogEvent} from './combatlog'
import {clearJournal, readJournal, recordVictory} from './journal'
import {TheGreen} from './nodes/dungeon'
import {analyzeReport, type UnitInfo} from './sim/report'

const DB_NAME = 'balancemender-fight-history-v1'
type FightHistory = typeof import('./fight-history')
let history: FightHistory

const event = (partial: Partial<CombatLogEvent>): CombatLogEvent => ({
	timestamp: 0,
	time: 0,
	eventType: 'FIGHT_START',
	...partial,
})

const units: UnitInfo[] = [
	{id: 'player', name: 'Player', maxHealth: 100, faction: 'party'},
	{id: 'runt', name: 'Runt', maxHealth: 100, faction: 'enemy'},
]

const events = [
	event({eventType: 'FIGHT_START'}),
	event({
		time: 100,
		eventType: 'SWING_DAMAGE',
		sourceId: 'runt',
		sourceName: 'Runt',
		targetId: 'player',
		targetName: 'Player',
		value: 12,
	}),
	event({
		time: 200,
		eventType: 'SPELL_HEAL',
		sourceId: 'player',
		sourceName: 'Player',
		targetId: 'player',
		targetName: 'Player',
		value: 10,
		overheal: 3,
	}),
	event({time: 500, eventType: 'FIGHT_END'}),
]

const fight = (duration: number, outcome: 'victory' | 'defeat' | 'timeout' = 'victory') => ({
	outcome,
	duration,
	events,
	units,
})

function deleteDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(DB_NAME)
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
		request.onblocked = () => reject(new Error(`IndexedDB cleanup blocked for ${DB_NAME}`))
	})
}

function createInvalidDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 2)
		request.onsuccess = () => {
			request.result.close()
			resolve()
		}
		request.onerror = () => reject(request.error)
	})
}

function createLegacyEmptyDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1)
		request.onsuccess = () => {
			request.result.close()
			resolve()
		}
		request.onerror = () => reject(request.error)
	})
}

function databaseInfo(): Promise<{version: number; objectStoreCount: number}> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME)
		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const database = request.result
			const info = {version: database.version, objectStoreCount: database.objectStoreNames.length}
			database.close()
			resolve(info)
		}
	})
}

function bumpDatabaseVersion(): Promise<void> {
	return databaseInfo().then(
		({version}) =>
			new Promise((resolve, reject) => {
				const request = indexedDB.open(DB_NAME, version + 1)
				request.onsuccess = () => {
					request.result.close()
					resolve()
				}
				request.onerror = () => reject(request.error)
			}),
	)
}

/** Make one persisted row look like an older save without exposing the TinyBase store. */
function removeReportCells(id: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME)
		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const database = request.result
			const transaction = database.transaction('t', 'readwrite')
			const table = transaction.objectStore('t')
			const stored = table.get('fights')
			stored.onsuccess = () => {
				const fights = stored.result as {k: string; v: Record<string, Record<string, unknown>>}
				delete fights.v[id].allUnitDamage
				delete fights.v[id].allUnitHealing
				delete fights.v[id].allUnitOverhealing
				table.put(fights)
			}
			transaction.oncomplete = () => {
				database.close()
				resolve()
			}
			transaction.onerror = transaction.onabort = () => {
				database.close()
				reject(transaction.error)
			}
		}
	})
}

async function freshHistory(): Promise<FightHistory> {
	vi.resetModules()
	history = await import('./fight-history')
	return history
}

beforeEach(async () => {
	await deleteDatabase()
	await freshHistory()
	history.viewFight(null)
	await clearJournal()
})

afterEach(async () => {
	vi.restoreAllMocks()
	history.viewFight(null)
	try {
		await history.clearFightHistory()
	} finally {
		await clearJournal()
		await deleteDatabase()
	}
})

describe('fight history', () => {
	it('initializes a fresh database before loading it', async () => {
		await history.loadFightHistory()

		expect(history.readFightHistory()).toMatchObject({status: 'ready', savedFights: []})
		expect((await databaseInfo()).objectStoreCount).toBeGreaterThan(0)
	})

	it('initializes a legacy empty database before loading it', async () => {
		await createLegacyEmptyDatabase()
		await history.loadFightHistory()

		expect(history.readFightHistory()).toMatchObject({status: 'ready', savedFights: []})
		expect((await databaseInfo()).objectStoreCount).toBeGreaterThan(0)
	})

	it('defines an empty saved-fight record', () => {
		expect(history.readFightHistory().savedFightRecord).toEqual({
			scope: 'saved-fights',
			fightCount: 0,
			reportCount: 0,
			outcomeCounts: {victory: 0, defeat: 0, timeout: 0},
			totalDuration: 0,
			averageDuration: null,
			allUnitDamage: 0,
			allUnitHealing: 0,
			allUnitOverhealing: 0,
		})
	})

	it('reloads an existing current database and keeps detail lazy', async () => {
		const parse = vi.spyOn(JSON, 'parse')
		await history.saveFight(fight(500))
		const id = history.readFightHistory().savedFights[0].id

		expect(parse).not.toHaveBeenCalled()
		const reloaded = await freshHistory()
		expect(reloaded.readFightHistory().savedFights).toEqual([])
		await reloaded.loadFightHistory()
		expect(reloaded.readFightHistory().savedFights[0]).toMatchObject({id, outcome: 'victory', duration: 500})
		expect(parse).not.toHaveBeenCalled()

		const saved = reloaded.readSavedFight(id)
		expect(saved?.events).toEqual(events)
		expect(saved?.units).toEqual(units)
		expect(parse).toHaveBeenCalledTimes(2)
	})

	it('reloads a valid database after an external version bump', async () => {
		await history.saveFight(fight(500))
		const id = history.readFightHistory().savedFights[0].id
		await bumpDatabaseVersion()

		const reloaded = await freshHistory()
		await reloaded.loadFightHistory()

		expect(reloaded.readFightHistory().savedFights[0]).toMatchObject({id, outcome: 'victory', duration: 500})
		await deleteDatabase()
	})

	it('serializes a save behind an unawaited load', async () => {
		const loading = history.loadFightHistory()
		const saving = history.saveFight(fight(500))
		await Promise.all([loading, saving])

		const reloaded = await freshHistory()
		expect(reloaded.readFightHistory().savedFights).toEqual([])
		await reloaded.loadFightHistory()
		expect(reloaded.readFightHistory().savedFights).toHaveLength(1)
		expect(reloaded.readSavedFight(reloaded.readFightHistory().savedFights[0].id)?.events).toEqual(events)
	})

	it('serializes clear behind an unawaited save', async () => {
		const saving = history.saveFight(fight(500))
		const clearing = history.clearFightHistory()
		await Promise.all([saving, clearing])

		const reloaded = await freshHistory()
		await reloaded.loadFightHistory()
		expect(reloaded.readFightHistory().savedFights).toEqual([])
	})

	it('rejects persistence errors without poisoning the operation queue', async () => {
		await createInvalidDatabase()
		await expect(history.saveFight(fight(500))).rejects.toMatchObject({name: 'NotFoundError'})

		await deleteDatabase()
		await expect(history.clearFightHistory()).resolves.toBeUndefined()
	})

	it('analyzes equivalent live and saved report inputs identically', async () => {
		await history.saveFight(fight(500))
		const saved = history.readSavedFight(history.readFightHistory().savedFights[0].id)!
		const live = analyzeReport(fight(500))
		const reopened = analyzeReport(saved)

		expect(reopened).toEqual(live)
	})

	it('aggregates every saved row and names all-unit attribution', async () => {
		await history.saveFight(fight(500, 'victory'))
		await history.saveFight(fight(1500, 'defeat'))
		await history.saveFight(fight(1000, 'timeout'))

		expect(history.readFightHistory().savedFightRecord).toEqual({
			scope: 'saved-fights',
			fightCount: 3,
			reportCount: 3,
			outcomeCounts: {victory: 1, defeat: 1, timeout: 1},
			totalDuration: 3000,
			averageDuration: 1000,
			allUnitDamage: 36,
			allUnitHealing: 21,
			allUnitOverhealing: 9,
		})
	})

	it('reports incomplete aggregate coverage for older rows', async () => {
		await history.saveFight(fight(500))
		const id = history.readFightHistory().savedFights[0].id
		await removeReportCells(id)

		const reloaded = await freshHistory()
		await reloaded.loadFightHistory()
		expect(reloaded.readFightHistory().savedFightRecord).toMatchObject({
			fightCount: 1,
			reportCount: 0,
			allUnitDamage: null,
			allUnitHealing: null,
			allUnitOverhealing: null,
		})
	})

	it('keys live, ready, and unavailable selections separately', () => {
		const detail = {...fight(500), id: 'fight', timestamp: 0}

		expect(history.fightSelectionKey({status: 'live'})).toBe('live')
		expect(history.fightSelectionKey({status: 'ready', fight: detail})).toBe('ready:fight')
		expect(history.fightSelectionKey({status: 'not-found', id: 'fight'})).toBe('not-found:fight')
	})

	it('uses a discriminated not-found selection for a missing id', () => {
		history.viewFight('missing')
		expect(history.viewedFight()).toEqual({status: 'not-found', id: 'missing'})
	})

	it('evicts only the oldest detail and leaves Journal completion unchanged', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000)
		const room = TheGreen.rooms[0]
		await recordVictory({dungeonId: 'TheGreen', roomId: room.id})
		await history.saveFight(fight(0))
		const oldest = history.readFightHistory().savedFights[0].id
		history.viewFight(oldest)
		for (let duration = 1; duration <= history.MAX_FIGHTS; duration++) await history.saveFight(fight(duration))

		expect(history.readFightHistory().savedFights).toHaveLength(history.MAX_FIGHTS)
		expect(history.readSavedFight(oldest)).toBeUndefined()
		expect(history.viewedFight()).toEqual({status: 'not-found', id: oldest})
		expect(readJournal().completedRooms.TheGreen).toEqual([room.id])
	})
})
