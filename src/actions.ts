import {log} from './utils'
import {AudioPlayer} from './nodes/audio'
import {setBalanceValue, resetBalance, AbilityKey, CadenceKey, AuraKey, UnitKey, RuleKey} from './balance'
import type {GameLoop} from './nodes/game-loop'
import type {Unit} from './nodes/unit'
import type {Roster} from './nodes/encounter'
import type {UnitId} from './nodes/unit-registry'

/**
 * Everything that can change a running game.
 *
 * There is one interpreter — `game.perform(action)` — and everything that mutates a fight goes
 * through it: the keyboard, the ability buttons, the dev console, the Balance Lab, the Autopilot,
 * tests and agents. The console is a text adapter over this, nothing more.
 *
 * Actions go in; combat events come out of the fight separately (see `src/combatlog.ts`). An
 * action is a request that may be refused; an event is a record of something that happened.
 */
export type GameAction =
	/** Add a unit to the fight. It joins the side its class belongs to. */
	| {type: 'spawn'; unit: UnitId}
	/** Take a unit out of the fight, by unit id. */
	| {type: 'remove'; unit: string}
	/** Point the player at a unit id. */
	| {type: 'target'; unit: string}
	/** Use one of the player's abilities, optionally switching target first — the pair every caller
	 * used to duplicate. Casting is one way an ability runs, not a second action. */
	| {type: 'use'; ability: string; target?: string}
	/** Stop the cast in progress. */
	| {type: 'interrupt'}
	| {type: 'tune'; of: 'ability'; name: string; key: AbilityKey; value: number}
	| {type: 'tune'; of: 'cadence'; name: string; key: CadenceKey; value: number}
	| {type: 'tune'; of: 'aura'; name: string; key: AuraKey; value: number}
	| {type: 'tune'; of: 'unit'; name: string; key: UnitKey; value: number}
	/** A number the whole game reads rather than one ability — the condition thresholds, so far. */
	| {type: 'tune'; of: 'rule'; name: string; key: RuleKey; value: number}
	| {type: 'resetBalance'}
	| {type: 'healParty'}
	/** Start a different fight. */
	| {type: 'loadEncounter'; roster: Roster}
	/** Replay the fight you are in. */
	| {type: 'restart'}
	| {type: 'set'; key: 'godMode' | 'infiniteMana' | 'muted'; value: boolean}
	| {type: 'set'; key: 'gcd'; value: number}

/**
 * Explicit, so a caller can say why something did not happen instead of guessing from a
 * missing return value. The dev console prints `error`; the UI mostly ignores it.
 */
export type ActionResult<T = void> = {ok: true; value: T} | {ok: false; error: string}

export const ok = <T>(value: T): ActionResult<T> => ({ok: true, value})
export const fail = (error: string): ActionResult<never> => ({ok: false, error})

/** The one interpreter. Reached as `game.perform(action)`. */
export function perform(game: GameLoop, action: GameAction): ActionResult<unknown> {
	switch (action.type) {
		case 'spawn':
			return ok(game.encounter.spawn(action.unit))

		case 'remove':
			return game.encounter.remove(action.unit) ? ok(action.unit) : fail(`No unit with id ${action.unit}`)

		case 'target': {
			const unit = findUnit(game, action.unit)
			if (!unit) return fail(`No unit with id ${action.unit}`)
			game.player.currentTarget = unit
			return ok(unit)
		}

		case 'use': {
			if (action.target) {
				const targeted = perform(game, {type: 'target', unit: action.target})
				if (!targeted.ok) return targeted
			}
			return game.player.useAbility(action.ability)
		}

		case 'interrupt':
			return interrupt(game)

		case 'tune': {
			const applied = setBalanceValue(action.of, action.name, action.key, action.value)
			// Classes are the template; the units already fighting need telling separately.
			if (applied && action.of === 'unit') retuneLiveUnits(game, action.name, action.key, action.value)
			return applied ? ok(action.value) : fail(`Unknown ${action.of}: ${action.name}`)
		}

		case 'resetBalance':
			resetBalance()
			return ok(undefined)

		case 'healParty':
			for (const member of game.party) member.health.set(member.health.max)
			return ok(undefined)

		case 'loadEncounter':
			game.loadEncounter(action.roster)
			return ok(undefined)

		case 'restart':
			game.loadEncounter(game.encounter.roster)
			return ok(undefined)

		case 'set':
			game[action.key] = action.value as never
			if (action.key === 'infiniteMana' && action.value && game.player.mana) {
				game.player.mana.set(game.player.mana.max)
			}
			return ok(action.value)
	}
}

const findUnit = (game: GameLoop, id: string): Unit | undefined => game.encounter.units.find((unit) => unit.id === id)

/**
 * A retuned unit type applies to the ones already fighting, matched by `unitId` — never by
 * class name, which the production build minifies into nonsense.
 */
function retuneLiveUnits(game: GameLoop, unitId: string, key: UnitKey, value: number) {
	for (const unit of game.encounter.units) {
		if (unit.unitId !== unitId) continue
		const resource = key === 'maxHealth' ? unit.health : unit.mana
		if (!resource) continue
		resource.max = value
		if (resource.current > value) resource.set(value)
	}
	return true
}

function interrupt(game: GameLoop): ActionResult<void> {
	log('interrupt')
	const player = game.player
	if (!player.currentAbility) return fail('Nothing to interrupt')

	AudioPlayer.stopOwned(player.currentAbility)
	AudioPlayer.play('spell_fizzle')
	player.currentAbility.disconnect()
	player.gcd?.disconnect()
	player.currentAbility = undefined
	player.gcd = undefined
	return ok(undefined)
}
