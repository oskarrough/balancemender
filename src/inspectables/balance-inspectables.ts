import type {GameAction} from '../actions'
import {
	balanceCategories,
	type AbilityKey,
	type AuraKey,
	type CadenceKey,
	type EffectKey,
	type RuleKey,
	type UnitKey,
} from '../balance'
import type {GameLoop} from '../nodes/game-loop'
import {abilityRegistry, type AbilityId} from '../nodes/registry'
import type {UnitId} from '../nodes/unit-registry'
import type {Action, Inspectable, InspectableSection, NumberField} from './contracts'

/**
 * What the player reads for every tunable number, in the order a panel lists them. Typed per kind
 * so adding a key to `ABILITY_KEYS` and friends without labelling it fails to compile.
 */
const LABELS: {
	ability: Record<AbilityKey, string>
	effect: Record<EffectKey, string>
	unit: Record<UnitKey, string>
	cadence: Record<CadenceKey, string>
	aura: Record<AuraKey, string>
	rule: Record<RuleKey, string>
} = {
	ability: {
		cost: 'Mana cost',
		castTime: 'Cast time (ms)',
		cooldown: 'Cooldown (ms)',
		threatMultiplier: 'Threat multiplier',
		sweetSpotWindow: 'Sweet spot window (ms)',
		sweetSpotBonus: 'Sweet spot bonus (fraction)',
	},
	effect: {coefficient: 'Power coefficient'},
	unit: {
		stamina: 'Stamina',
		intellect: 'Intellect',
		strength: 'Strength',
		agility: 'Agility',
		spirit: 'Spirit',
	},
	cadence: {delay: 'Initial delay (ms)', interval: 'Interval (ms)'},
	aura: {
		interval: 'Tick interval (ms)',
		repeat: 'Ticks',
		delay: 'First tick delay (ms)',
		maxStacks: 'Max stacks (per caster)',
		pool: 'Absorb pool',
		lifetime: 'Barrier lifetime (ms)',
	},
	rule: {
		injured: 'Injured below (% health)',
		healthy: 'Healthy above (% health)',
		variance: 'Damage variance (fraction)',
	},
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
 */
const PANELS: PanelSpec[] = [
	{
		kind: 'ability',
		section: 'Abilities',
		// Tags and school are labels, not execution paths — a spell and an attack are one class.
		title: (name) => abilityRegistry[name as AbilityId].name,
		subtitle: (name) => {
			const {tags, school} = abilityRegistry[name as AbilityId]
			return `ability · ${tags.join(', ')} · ${school}`
		},
	},
	{
		kind: 'unit',
		section: 'Units',
		subtitle: () => 'Unit defaults',
		min: 0,
		// The player is spawned with the fight; a second one would just stand there.
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
	{
		kind: 'effect',
		section: 'Effects',
		// Named for the ability and the effect, because an ability can have more than one.
		subtitle: (name) => `effect:${name}`,
	},
	{kind: 'cadence', section: 'Cadences', subtitle: (name) => `cadence:${name}`},
	{
		// What the effect that plants it does not own: how it ticks, and how many copies stack.
		kind: 'aura',
		section: 'Auras',
		subtitle: (name) => `aura:${name}`,
		min: 0,
	},
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
					step: key === 'coefficient' || key === 'variance' ? 0.1 : undefined,
					min: spec.min,
				}),
			),
		actions: spec.actions?.(game, name),
	}))
}

export function balanceInspectableSections(game: GameLoop): InspectableSection[] {
	return PANELS.map((spec) => ({section: spec.section, items: balancePanels(game, spec)}))
}
