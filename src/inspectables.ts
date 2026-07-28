import type {GameLoop} from './nodes/game-loop'
import type {Unit} from './nodes/unit'
import {balanceCategories, type AbilityKey, type CadenceKey, type UnitKey, type RuleKey} from './balance'
import type {GameAction} from './actions'
import {abilityRegistry, type AbilityId} from './nodes/registry'
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

/**
 * What the player reads for every tunable number, in the order a panel lists them. Typed per kind
 * so adding a key to `ABILITY_KEYS` and friends without labelling it fails to compile.
 */
const LABELS: {
	ability: Record<AbilityKey, string>
	unit: Record<UnitKey, string>
	cadence: Record<CadenceKey, string>
	rule: Record<RuleKey, string>
} = {
	ability: {
		cost: 'Mana cost',
		magnitude: 'Magnitude (heal or shield)',
		castTime: 'Cast time (ms)',
		cooldown: 'Cooldown (ms)',
		minDamage: 'Min damage',
		maxDamage: 'Max damage',
	},
	unit: {maxHealth: 'Max health', maxMana: 'Max mana', manaRegen: 'Mana regen (per second)'},
	cadence: {delay: 'Initial delay (ms)', interval: 'Interval (ms)'},
	rule: {injured: 'Injured below (% health)', healthy: 'Healthy above (% health)'},
}

type BalancePanelKind = keyof typeof LABELS

type PanelSpec = {
	kind: BalancePanelKind
	section: string
	/** The panel heading. The balance key itself, unless the thing has a name a player reads. */
	title?: (name: string) => string
	subtitle: (name: string) => string
	min?: number
	actions?: (game: GameLoop, name: string) => Action[]
}

/**
 * One section per balance kind. They differ only in what they are called and whether a panel
 * offers to *do* something as well as tune something — the rest falls out of `balance.ts`.
 *
 * `aura` has no section: `Rend` is the only free-standing one, reachable as `--tune aura:Rend.total`.
 */
const PANELS: PanelSpec[] = [
	{
		kind: 'ability',
		section: 'Abilities',
		// Tags and school are labels, not execution paths — a spell and an attack are one class.
		title: (name) => abilityRegistry[name as AbilityId].name,
		subtitle: (name) => {
			const {tags, school} = abilityRegistry[name as AbilityId]
			return `ability:${name} · ${tags.join(', ')} · ${school}`
		},
	},
	{
		kind: 'unit',
		section: 'Units',
		subtitle: () => 'Unit defaults',
		min: 0,
		// The player is spawned with the encounter; a second one would just stand there.
		actions: (game, name) =>
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
					],
	},
	{kind: 'cadence', section: 'Cadences', subtitle: (name) => `cadence:${name}`},
	{
		kind: 'rule',
		section: 'Rules',
		// Unlike the rest these land on the fight in progress, because a rule is read where it is
		// used rather than copied onto an instance at construction.
		subtitle: () => 'Applies immediately',
		min: 0,
	},
]

/**
 * `PANELS` has already paired each kind with its own keys, which is the thing the `tune` action's
 * union asks for and the thing a kind/key pair widened to strings can no longer prove.
 */
const tune = (game: GameLoop, kind: BalancePanelKind, name: string, key: string, value: number) =>
	game.perform({type: 'tune', of: kind, name, key, value} as GameAction)

function balancePanels(game: GameLoop, spec: PanelSpec): Inspectable[] {
	const {kind} = spec
	const labels: Record<string, string> = LABELS[kind]
	const state = balanceCategories[kind].state
	return Object.keys(state).map((name) => ({
		id: `${kind}:${name}`,
		kind,
		title: spec.title?.(name) ?? name,
		subtitle: spec.subtitle(name),
		// Only the keys this one declares — an opt-in key stays absent rather than showing up as a
		// zero the player can tune.
		fields: Object.keys(labels)
			.filter((key) => key in state[name])
			.map(
				(key): NumberField => ({
					kind: 'number',
					key,
					label: labels[key],
					get: () => state[name][key] ?? 0,
					set: (value) => {
						tune(game, kind, name, key, value)
					},
					min: spec.min,
				}),
			),
		actions: spec.actions?.(game, name),
	}))
}

export function liveInspectables(game: GameLoop): Inspectable[] {
	const units: Unit[] = [...(game.party ?? []), ...(game.encounter?.enemies ?? [])]
	return units.map((unit) => liveInspectable(game, unit))
}

type Pool = {current: number; max: number; set(value: number): number}

/** A unit already in the fight: its bars written straight to, and the buttons that end it. */
function liveInspectable(game: GameLoop, unit: Unit): Inspectable {
	const {health, mana} = unit
	const poolFields = (key: string, label: string, pool: Pool): NumberField[] => [
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
			set: (value) => {
				pool.max = value
				if (pool.current > value) pool.set(value)
			},
			min: 1,
		},
	]

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
				health.set(0)
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
		fields: [...poolFields('hp', 'Health', health), ...(mana ? poolFields('mana', 'Mana', mana) : [])],
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
			button('Restart encounter', {type: 'restart'}),
			button('Reset balance', {type: 'resetBalance'}, 'danger'),
		],
	}
}

export type InspectableSection = {section: string; items: Inspectable[]}

export function allInspectables(game: GameLoop): InspectableSection[] {
	return [
		{section: 'Live', items: liveInspectables(game)},
		{section: 'Game', items: [globalsInspectable(game)]},
		...PANELS.map((spec) => ({section: spec.section, items: balancePanels(game, spec)})),
	]
}
