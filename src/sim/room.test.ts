import {describe, expect, it} from 'vitest'
import {authoredRoom, authoredRoomIds} from './room'
import {runFight} from './run'

describe('an authored simulation room', () => {
	it('loads its exact lineup, cumulative kit and location by stable id', () => {
		const scenario = authoredRoom('green-howling')

		expect(scenario.label).toBe('The Green · Room 4: The howling')
		expect(scenario.trial.room).toMatchObject({
			party: ['Tank'],
			enemies: ['Denmother', 'Howler', 'Runt'],
		})
		expect(scenario.trial.abilities).toEqual(['Mend', 'Lance', 'Renew', 'Patch'])
		expect(scenario.trial.location).toEqual({
			dungeonId: 'TheGreen',
			roomId: 'green-howling',
			roomNumber: 4,
		})
	})

	it('keeps a bot on the abilities granted by that point', async () => {
		const {trial} = authoredRoom('green-first-blood')
		const fight = await runFight({...trial, bot: 'shield', seed: 1})

		expect(fight.location).toEqual(trial.location)
		expect(fight.events.some((event) => event.abilityId === 'Shield')).toBe(false)
		expect(fight.events.some((event) => event.abilityId === 'Mend')).toBe(true)
	})

	it('brings earlier dungeon grants into later dungeons', () => {
		expect(authoredRoom('rust-dry-bed').trial.abilities).toEqual(['Mend', 'Lance', 'Renew', 'Patch', 'Shield', 'Steep'])
	})

	it('lists known ids when a room is unknown', () => {
		expect(() => authoredRoom('green-nope')).toThrow(/Unknown room.*green-stray-pup/)
		expect(authoredRoomIds()).toContain('green-howling')
	})
})
