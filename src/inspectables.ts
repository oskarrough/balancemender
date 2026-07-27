import type {GameLoop} from './nodes/game-loop'
import type {Unit} from './nodes/unit'
import {
	balance,
	ABILITY_KEYS,
	CADENCE_KEYS,
	UNIT_KEYS,
	RULE_KEYS,
	type AbilityKey,
	type CadenceKey,
	type UnitKey,
	type RuleKey,
} from './balance'
import {abilityRegistry} from './nodes/registry'
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
	kind: 'ability' | 'cadence' | 'unit' | 'rule' | 'live' | 'globals'
	title: string
	subtitle?: string
	fields: Field[]
	actions?: Action[]
}

const ABILITY_LABEL: Record<AbilityKey, string> = {
	cost: 'Mana cost',
	magnitude: 'Magnitude (heal or shield)',
	castTime: 'Cast time (ms)',
	cooldown: 'Cooldown (ms)',
	minDamage: 'Min damage',
	maxDamage: 'Max damage',
}

const CADENCE_LABEL: Record<CadenceKey, string> = {
	delay: 'Initial delay (ms)',
	interval: 'Interval (ms)',
}

const UNIT_LABEL: Record<UnitKey, string> = {
	maxHealth: 'Max health',
	maxMana: 'Max mana',
	manaRegen: 'Mana regen (per second)',
}

const RULE_LABEL: Record<RuleKey, string> = {
	injured: 'Injured below (% health)',
	healthy: 'Healthy above (% health)',
}

/** One panel per stable ability id; tags and school are labels, not execution paths. */
export function abilityInspectables(game: GameLoop): Inspectable[] {
	return Object.entries(abilityRegistry).map(([name, AbilityClass]) => ({
		id: `ability:${name}`,
		kind: 'ability',
		title: AbilityClass.name,
		subtitle: `ability:${name} · ${AbilityClass.tags.join(', ')} · ${AbilityClass.school}`,
		fields: ABILITY_KEYS.filter((key) => key in balance.abilities[name]).map(
			(key): NumberField => ({
				kind: 'number',
				key,
				label: ABILITY_LABEL[key],
				get: () => balance.abilities[name][key] ?? 0,
				set: (value) => {
					game.perform({type: 'tune', of: 'ability', name, key, value})
				},
			}),
		),
	}))
}

export function cadenceInspectables(game: GameLoop): Inspectable[] {
	return Object.keys(balance.cadences).map((name) => ({
		id: `cadence:${name}`,
		kind: 'cadence',
		title: name,
		subtitle: `cadence:${name}`,
		fields: CADENCE_KEYS.map(
			(key): NumberField => ({
				kind: 'number',
				key,
				label: CADENCE_LABEL[key],
				get: () => balance.cadences[name][key] ?? 0,
				set: (value) => {
					game.perform({type: 'tune', of: 'cadence', name, key, value})
				},
			}),
		),
	}))
}

/**
 * Numbers the whole game reads. Unlike the other panels these land on the fight in progress,
 * because a rule is read where it is used rather than copied onto an instance at construction.
 */
export function ruleInspectables(game: GameLoop): Inspectable[] {
	return Object.keys(balance.rules).map((name) => ({
		id: `rule:${name}`,
		kind: 'rule',
		title: name,
		subtitle: 'Applies immediately',
		fields: RULE_KEYS.map(
			(key): NumberField => ({
				kind: 'number',
				key,
				label: RULE_LABEL[key],
				get: () => balance.rules[name][key] ?? 0,
				set: (value) => {
					game.perform({type: 'tune', of: 'rule', name, key, value})
				},
				min: 0,
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
	const units: Unit[] = [...party, ...enemies]
	return units.map((c) => liveInspectable(game, c))
}

function liveInspectable(game: GameLoop, c: Unit): Inspectable {
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
		{section: 'Abilities', items: abilityInspectables(game)},
		{section: 'Units', items: unitInspectables(game)},
		{section: 'Cadences', items: cadenceInspectables(game)},
		{section: 'Rules', items: ruleInspectables(game)},
	]
}
