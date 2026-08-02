import {afterEach, describe, expect, it} from 'vitest'
import {clearJournal, recordVictory} from './journal'
import {formatFightLocation} from './fight-location'
import {getFight, listFights, saveFight} from './fight-history'
import {TheGreen, TheRust} from './nodes/dungeon'
import {GameLoop} from './nodes/game-loop'
import {analyze, unitsOf} from './sim/report'
import {runFight} from './sim/run'
import {settle} from './test-setup'

let game!: GameLoop
afterEach(async () => {
	game?.disconnect()
	await settle()
	await clearJournal()
})

describe('fight location', () => {
	it('snapshots dungeon ids and the room number, then carries them into a report', async () => {
		game = new GameLoop({id: 'location-test', party: [], enemies: []})
		await settle()

		for (const room of TheGreen.rooms) await recordVictory({dungeonId: 'TheGreen', roomId: room.id})
		expect(game.perform({type: 'startDungeon', dungeon: 'TheRust'}).ok).toBe(true)
		await settle()

		const location = {
			dungeonId: 'TheRust' as const,
			roomId: TheRust.rooms[0].id,
			roomNumber: 1,
		}
		expect(game.combatLog.location).toEqual(location)
		expect(game.combatLog.events.every((event) => !('location' in event))).toBe(true)

		const report = analyze(game.combatLog.events, {
			units: unitsOf(game),
			location: game.combatLog.location,
		})
		expect(report.location).toEqual(location)
		expect(formatFightLocation(report.location)).toBe('The Rust · Room 1: The dry bed')

		game.dungeonRun!.room = 1
		game.enter(TheRust.rooms[1])
		expect(game.combatLog.location).toEqual({
			dungeonId: 'TheRust',
			roomId: TheRust.rooms[1].id,
			roomNumber: 2,
		})
	})

	it('persists location with the stored fight and restores it for report analysis', async () => {
		const location = {dungeonId: 'TheRust' as const, roomId: TheRust.rooms[0].id, roomNumber: 1}
		await saveFight({outcome: 'victory', duration: 0, events: [], units: [], location})

		const meta = listFights()[0]
		const stored = meta && getFight(meta.id)
		expect(stored?.location).toEqual(location)
		expect(analyze(stored?.events ?? [], {location: stored?.location}).location).toEqual(location)
	})

	it('leaves location absent for a terminal fight without dungeon context', async () => {
		const result = await runFight({room: {enemies: ['Runt']}, bot: 'idle', maxDuration: 1})
		expect(result.location).toBeUndefined()
		expect(analyze(result.events, result).location).toBeUndefined()
	})
})
