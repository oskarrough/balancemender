import type {GameAction} from '../actions'
import type {GameLoop} from '../nodes/game-loop'
import {MANA_PER_INTELLECT, STAT} from '../nodes/stats'
import {FACTION} from '../nodes/types'
import type {Unit} from '../nodes/unit'
import type {Action, BooleanField, Inspectable, InspectableSection, NumberField} from './contracts'

export function liveInspectables(game: GameLoop): Inspectable[] {
	const units: Unit[] = [...(game.party ?? []), ...(game.fight?.enemies ?? [])]
	return units.map((unit) => liveInspectable(game, unit))
}

type Pool = {current: number; max: number; set(value: number): number}

/** A unit already in the fight: its bars written straight to, and the buttons that end it. */
function liveInspectable(game: GameLoop, unit: Unit): Inspectable {
	const {health, mana} = unit
	const poolFields = (key: string, label: string, pool: Pool, setMax: (value: number) => void): NumberField[] => [
		{
			kind: 'number',
			key,
			label,
			get: () => pool.current,
			set: (value) => {
				pool.set(value)
			},
			min: 0,
		},
		{
			kind: 'number',
			key: `${key}Max`,
			label: `Max ${label.toLowerCase()}`,
			get: () => pool.max,
			set: setMax,
			min: 1,
		},
	]
	const setHealthMax = (value: number) => {
		const base = unit.stats.base(STAT.STAMINA)
		unit.setBaseStat(STAT.STAMINA, base + value - unit.stats.stamina)
	}
	const setManaMax = (value: number) => {
		const base = unit.stats.base(STAT.INTELLECT)
		unit.setBaseStat(STAT.INTELLECT, base + value / MANA_PER_INTELLECT - unit.stats.intellect)
	}

	const actions: Action[] = [
		{
			label: 'Full heal',
			run: () => {
				health.set(health.max)
				mana?.set(mana.max)
			},
		},
		{
			label: 'Kill',
			variant: 'danger',
			run: () => {
				game.perform({type: 'kill', unit: unit.id})
			},
		},
	]
	if (unit.faction === 'enemy') {
		actions.push({
			label: 'Remove',
			variant: 'danger',
			run: () => {
				game.perform({type: 'remove', unit: unit.id})
			},
		})
	}

	return {
		id: `live:${unit.id}`,
		kind: 'live',
		title: unit.name || unit.unitId || '?',
		subtitle: `${unit.faction} · ${unit.unitId}`,
		fields: [
			...poolFields('hp', 'Health', health, setHealthMax),
			...(mana ? poolFields('mana', 'Mana', mana, setManaMax) : []),
		],
		actions,
	}
}

export function globalsInspectable(game: GameLoop): Inspectable {
	const toggle = (key: 'godMode' | 'infiniteMana', label: string): BooleanField => ({
		kind: 'boolean',
		key,
		label,
		get: () => game[key],
		set: (value) => {
			game.perform({type: 'set', key, value})
		},
	})
	const button = (label: string, action: GameAction, variant?: Action['variant']): Action => ({
		label,
		variant,
		run: () => {
			game.perform(action)
		},
	})

	return {
		id: 'globals',
		kind: 'globals',
		title: 'Game',
		subtitle: 'Global toggles',
		fields: [
			toggle('godMode', 'God mode'),
			toggle('infiniteMana', 'Infinite mana'),
			{
				kind: 'number',
				key: 'gcd',
				label: 'Global cooldown (ms)',
				get: () => game.gcd,
				set: (value) => {
					game.perform({type: 'set', key: 'gcd', value})
				},
				min: 0,
				step: 100,
			},
		],
		actions: [
			button('Heal party', {type: 'healParty'}),
			// The two ways a fight ends, on demand — the fastest route to the game over panel.
			button('Kill enemies', {type: 'wipe', faction: FACTION.ENEMY}),
			button('Wipe party', {type: 'wipe', faction: FACTION.PARTY}),
			button('Restart fight', {type: 'restart'}),
			button('Reset balance', {type: 'resetBalance'}, 'danger'),
		],
	}
}

export function liveInspectableSections(game: GameLoop): InspectableSection[] {
	return [
		{section: 'Live', items: liveInspectables(game)},
		{section: 'Game', items: [globalsInspectable(game)]},
	]
}
