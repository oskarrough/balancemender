import {log} from './utils'
import {AudioPlayer} from './nodes/audio'
import {setBalanceValue, resetBalance, AbilityKey, EffectKey, CadenceKey, AuraKey, UnitKey, RuleKey} from './balance'
import type {GameLoop} from './nodes/game-loop'
import type {Unit} from './nodes/unit'
import type {Roster} from './nodes/encounter'
// Safe to value-import: dungeon.ts is pure data and imports nothing back from actions.ts or balance.ts.
import {dungeonRegistry} from './nodes/dungeon'
import type {UnitId} from './nodes/unit-registry'

/**
 * Everything that can change a running game.
 *
 * There is one interpreter — `game.perform(action)` — and everything that mutates a fight goes
 * through it: the keyboard, the ability buttons, the dev console, the Balance Lab, the bot driver,
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
	/** Select a unit id. Player UI state — it moves nobody else's aim. */
	| {type: 'target'; unit: string}
	/** Use one of the player's abilities on a named unit, or on whatever the player has selected.
	 * Casting is one way an ability runs, not a second action. */
	| {type: 'use'; ability: string; target?: string}
	/** Stop the cast in progress. */
	| {type: 'interrupt'}
	| {type: 'tune'; of: 'ability'; name: string; key: AbilityKey; value: number}
	/** How big one of an ability's outcomes lands, named `Ability.effect`. */
	| {type: 'tune'; of: 'effect'; name: string; key: EffectKey; value: number}
	| {type: 'tune'; of: 'cadence'; name: string; key: CadenceKey; value: number}
	| {type: 'tune'; of: 'aura'; name: string; key: AuraKey; value: number}
	| {type: 'tune'; of: 'unit'; name: string; key: UnitKey; value: number}
	/** A number the whole game reads rather than one ability — the condition thresholds, so far. */
	| {type: 'tune'; of: 'rule'; name: string; key: RuleKey; value: number}
	| {type: 'resetBalance'}
	| {type: 'healParty'}
	/** Start a different fight. */
	| {type: 'loadEncounter'; roster: Roster}
	/** Start a dungeon from its first room, by dungeon id. */
	| {type: 'startDungeon'; dungeon: string}
	/** Move on to the next room of the dungeon you cleared. */
	| {type: 'nextRoom'}
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
			game.player.selectedTarget = unit
			return ok(unit)
		}

		case 'use': {
			// A named target belongs to this one use and leaves the player's selection alone. A bot
			// casting on the tank must not move the frame the player is aiming at.
			const target = action.target ? findUnit(game, action.target) : game.player.intendedTarget
			if (action.target && !target) return fail(`No unit with id ${action.target}`)
			return game.player.useAbility(action.ability, target)
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
			// Loading an arbitrary fight steps off the dungeon.
			game.dungeonRun = undefined
			game.loadEncounter(action.roster)
			return ok(undefined)

		case 'startDungeon': {
			const dungeon = dungeonRegistry[action.dungeon]
			if (!dungeon) return fail(`Unknown dungeon: ${action.dungeon}`)
			game.dungeonRun = {dungeon, room: 0, times: []}
			game.loadEncounter(dungeon.rooms[0].roster)
			return ok(dungeon)
		}

		case 'nextRoom': {
			const run = game.dungeonRun
			if (!run) return fail('Not in a dungeon')
			if (!game.gameOver || game.outcome !== 'victory') return fail('The room is not cleared yet')
			const next = run.room + 1
			if (next >= run.dungeon.rooms.length) return fail('The dungeon is finished')
			// loadEncounter zeroes the fight clock, so bank this room's time before it does.
			run.times.push(game.elapsedTime)
			run.room = next
			game.loadEncounter(run.dungeon.rooms[next].roster)
			return ok(next)
		}

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
		unit.setBaseStat(key, value)
	}
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
