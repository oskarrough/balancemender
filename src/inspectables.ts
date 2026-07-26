import type {GameLoop} from './nodes/game-loop'
import type {Character} from './nodes/character'
import {balance, SPELL_KEYS, ATTACK_KEYS, UNIT_KEYS, SpellKey, AttackKey, UnitKey} from './balance'
import {spellRegistry, attackRegistry} from './nodes/registry'
import type {UnitId} from './nodes/unit-registry'

export type NumberField = {
	kind: 'number'
	key: string
	label: string
	get: () => number
	set: (value: number) => void
	step?: number
	min?: number
}

export type BooleanField = {
	kind: 'boolean'
	key: string
	label: string
	get: () => boolean
	set: (value: boolean) => void
}

export type Field = NumberField | BooleanField

export type Action = {
	label: string
	run: () => void
	variant?: 'danger' | 'primary' | 'default'
}

export type Inspectable = {
	id: string
	kind: 'spell' | 'attack' | 'unit' | 'live' | 'globals'
	title: string
	subtitle?: string
	fields: Field[]
	actions?: Action[]
}

const SPELL_LABEL: Record<SpellKey, string> = {
	cost: 'Mana cost',
	heal: 'Heal amount',
	castTime: 'Cast time (ms)',
}

const ATTACK_LABEL: Record<AttackKey, string> = {
	minDamage: 'Min damage',
	maxDamage: 'Max damage',
	interval: 'Interval (ms)',
	delay: 'Initial delay (ms)',
}

const UNIT_LABEL: Record<UnitKey, string> = {
	maxHealth: 'Max health',
	maxMana: 'Max mana',
}

export function spellInspectables(game: GameLoop): Inspectable[] {
	return Object.keys(spellRegistry).map((name) => ({
		id: `spell:${name}`,
		kind: 'spell',
		title: name,
		subtitle: 'Spell defaults',
		fields: SPELL_KEYS.map(
			(key): NumberField => ({
				kind: 'number',
				key,
				label: SPELL_LABEL[key],
				get: () => balance.spells[name][key] ?? 0,
				set: (value) => {
					game.perform({type: 'tune', of: 'spell', name, key, value})
				},
			}),
		),
	}))
}

export function attackInspectables(game: GameLoop): Inspectable[] {
	return Object.keys(attackRegistry).map((name) => ({
		id: `attack:${name}`,
		kind: 'attack',
		title: name,
		subtitle: 'Attack defaults',
		fields: ATTACK_KEYS.map(
			(key): NumberField => ({
				kind: 'number',
				key,
				label: ATTACK_LABEL[key],
				get: () => balance.attacks[name][key] ?? 0,
				set: (value) => {
					game.perform({type: 'tune', of: 'attack', name, key, value})
				},
			}),
		),
	}))
}

export function unitInspectables(game: GameLoop): Inspectable[] {
	return Object.keys(balance.units).map((name) => {
		const fields = UNIT_KEYS.filter((key) => key in balance.units[name]).map(
			(key): NumberField => ({
				kind: 'number',
				key,
				label: UNIT_LABEL[key],
				get: () => balance.units[name][key] ?? 0,
				set: (value) => {
					game.perform({type: 'tune', of: 'unit', name, key, value})
				},
				min: 0,
			}),
		)
		// The player is spawned with the encounter; a second one would just stand there.
		const actions: Action[] =
			name === 'Player'
				? []
				: [
						{
							label: `Spawn ${name}`,
							variant: 'primary',
							run: () => {
								game.perform({type: 'spawn', unit: name as UnitId})
							},
						},
					]
		return {
			id: `unit:${name}`,
			kind: 'unit',
			title: name,
			subtitle: 'Unit defaults',
			fields,
			actions,
		}
	})
}

export function liveInspectables(game: GameLoop): Inspectable[] {
	const party = game.party ?? []
	const enemies = game.encounter?.enemies ?? []
	const characters: Character[] = [...party, ...enemies]
	return characters.map((c) => liveInspectable(game, c))
}

function liveInspectable(game: GameLoop, c: Character): Inspectable {
	const fields: Field[] = [
		{
			kind: 'number',
			key: 'hp',
			label: 'Health',
			get: () => c.health.current,
			set: (v) => {
				c.health.set(v)
			},
			min: 0,
		},
		{
			kind: 'number',
			key: 'hpMax',
			label: 'Max health',
			get: () => c.health.max,
			set: (v) => {
				c.health.max = v
				if (c.health.current > v) c.health.current = v
			},
			min: 1,
		},
	]
	if (c.mana) {
		const mana = c.mana
		fields.push(
			{
				kind: 'number',
				key: 'mana',
				label: 'Mana',
				get: () => mana.current,
				set: (v) => {
					mana.set(v)
				},
				min: 0,
			},
			{
				kind: 'number',
				key: 'manaMax',
				label: 'Max mana',
				get: () => mana.max,
				set: (v) => {
					mana.max = v
					if (mana.current > v) mana.current = v
				},
				min: 1,
			},
		)
	}

	const actions: Action[] = [
		{
			label: 'Full heal',
			run: () => {
				c.health.set(c.health.max)
				c.mana?.set(c.mana.max)
			},
		},
		{
			label: 'Kill',
			variant: 'danger',
			run: () => {
				c.health.set(0)
			},
		},
	]
	if (c.faction === 'enemy') {
		actions.push({
			label: 'Remove',
			variant: 'danger',
			run: () => {
				game.perform({type: 'remove', unit: c.id})
			},
		})
	}

	return {
		id: `live:${c.id}`,
		kind: 'live',
		title: c.name || c.unitId || '?',
		subtitle: `${c.faction} · ${c.unitId}`,
		fields,
		actions,
	}
}

export function globalsInspectable(game: GameLoop): Inspectable {
	return {
		id: 'globals',
		kind: 'globals',
		title: 'Game',
		subtitle: 'Global toggles',
		fields: [
			{
				kind: 'boolean',
				key: 'godMode',
				label: 'God mode',
				get: () => game.godMode,
				set: (value) => {
					game.perform({type: 'set', key: 'godMode', value})
				},
			},
			{
				kind: 'boolean',
				key: 'infiniteMana',
				label: 'Infinite mana',
				get: () => game.infiniteMana,
				set: (value) => {
					game.perform({type: 'set', key: 'infiniteMana', value})
				},
			},
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
			{
				label: 'Heal party',
				run: () => {
					game.perform({type: 'healParty'})
				},
			},
			{
				label: 'Restart encounter',
				run: () => {
					game.perform({type: 'restart'})
				},
			},
			{
				label: 'Reset balance',
				variant: 'danger',
				run: () => {
					game.perform({type: 'resetBalance'})
				},
			},
		],
	}
}

export type InspectableSection = {section: string; items: Inspectable[]}

export function allInspectables(game: GameLoop): InspectableSection[] {
	return [
		{section: 'Live', items: liveInspectables(game)},
		{section: 'Game', items: [globalsInspectable(game)]},
		{section: 'Spells', items: spellInspectables(game)},
		{section: 'Units', items: unitInspectables(game)},
		{section: 'Attacks', items: attackInspectables(game)},
	]
}
