import type {GameLoop} from './nodes/game-loop'
import type {Character} from './nodes/character'
import {
	balance,
	setSpellValue,
	setAttackValue,
	SPELL_KEYS,
	ATTACK_KEYS,
	UNIT_KEYS,
	SpellKey,
	AttackKey,
	UnitKey,
} from './balance'
import {spellRegistry, attackRegistry} from './nodes/registry'
import {enemyRegistry, EnemyId} from './nodes/unit-registry'
import {commands} from './commands'

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

export function spellInspectables(): Inspectable[] {
	return Object.keys(spellRegistry).map((name) => ({
		id: `spell:${name}`,
		kind: 'spell',
		title: name,
		subtitle: 'Spell defaults',
		fields: SPELL_KEYS.map(
			(k): NumberField => ({
				kind: 'number',
				key: k,
				label: SPELL_LABEL[k],
				get: () => balance.spells[name][k] ?? 0,
				set: (v) => {
					setSpellValue(name, k, v)
				},
			}),
		),
	}))
}

export function attackInspectables(): Inspectable[] {
	return Object.keys(attackRegistry).map((name) => ({
		id: `attack:${name}`,
		kind: 'attack',
		title: name,
		subtitle: 'Attack defaults',
		fields: ATTACK_KEYS.map(
			(k): NumberField => ({
				kind: 'number',
				key: k,
				label: ATTACK_LABEL[k],
				get: () => balance.attacks[name][k] ?? 0,
				set: (v) => {
					setAttackValue(name, k, v)
				},
			}),
		),
	}))
}

export function unitInspectables(game: GameLoop): Inspectable[] {
	return Object.keys(balance.units).map((name) => {
		const presentKeys = UNIT_KEYS.filter((k) => k in balance.units[name])
		const fields = presentKeys.map(
			(k): NumberField => ({
				kind: 'number',
				key: k,
				label: UNIT_LABEL[k],
				get: () => balance.units[name][k] ?? 0,
				set: (v) => {
					commands.setUnit(game, name, k, v)
				},
				min: 0,
			}),
		)
		const actions: Action[] = []
		if (name in enemyRegistry) {
			actions.push({
				label: `Spawn ${name}`,
				variant: 'primary',
				run: () => {
					commands.spawnEnemy(game, name as EnemyId)
				},
			})
		}
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
				commands.removeUnit(game, c.id)
			},
		})
	}

	return {
		id: `live:${c.id}`,
		kind: 'live',
		title: c.name || c.constructor.name,
		subtitle: `${c.faction} · ${c.constructor.name}`,
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
				set: (v) => {
					game.godMode = v
				},
			},
			{
				kind: 'boolean',
				key: 'infiniteMana',
				label: 'Infinite mana',
				get: () => game.infiniteMana,
				set: (v) => {
					game.infiniteMana = v
					if (v && game.player?.mana) game.player.mana.current = game.player.mana.max
				},
			},
			{
				kind: 'number',
				key: 'gcd',
				label: 'Global cooldown (ms)',
				get: () => game.gcd,
				set: (v) => {
					game.gcd = v
				},
				min: 0,
				step: 100,
			},
		],
		actions: [
			{
				label: 'Heal party',
				run: () => {
					commands.healParty(game)
				},
			},
			{
				label: 'Restart encounter',
				run: () => {
					commands.restartEncounter(game)
				},
			},
			{
				label: 'Reset balance',
				variant: 'danger',
				run: () => {
					commands.resetBalance(game)
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
		{section: 'Spells', items: spellInspectables()},
		{section: 'Units', items: unitInspectables(game)},
		{section: 'Attacks', items: attackInspectables()},
	]
}
