import {log} from './utils'
import {
	setBalanceValue,
	resetBalance,
	validateBalanceValue,
	unitClasses,
	AbilityKey,
	EffectKey,
	CadenceKey,
	AuraKey,
	UnitKey,
	RuleKey,
} from './balance'
import type {GameLoop} from './nodes/game-loop'
import type {Unit} from './nodes/unit'
import {FACTION, type Faction} from './nodes/types'
import {STAT_KEYS} from './nodes/stats'
import type {Room} from './nodes/fight'
// Safe to value-import: dungeon.ts is pure data and imports nothing back from actions.ts or balance.ts.
import {dungeonRegistry} from './nodes/dungeon'
// The registry already reaches actions.ts through the dungeon import above; naming it directly is
// the spawn boundary, so a console typing an unknown id is refused here instead of throwing below.
import {unitRegistry, type UnitId} from './nodes/unit-registry'

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
	/** Select a unit id, or nothing to clear it. Player UI state — it moves nobody else's aim. */
	| {type: 'target'; unit?: string}
	/** Use one of the player's abilities on a named unit, or on whatever the player has selected.
	 * Casting is one way an ability runs, not a second action. */
	| {type: 'use'; ability: string; target?: string}
	/** Stop the cast in progress. */
	| {type: 'interrupt'}
	| {type: 'tune'; of: 'ability'; name: string; key: AbilityKey; value: number}
	/** How big one of an ability's effects lands, named `Ability.effect`. */
	| {type: 'tune'; of: 'effect'; name: string; key: EffectKey; value: number}
	| {type: 'tune'; of: 'cadence'; name: string; key: CadenceKey; value: number}
	| {type: 'tune'; of: 'aura'; name: string; key: AuraKey; value: number}
	| {type: 'tune'; of: 'unit'; name: string; key: UnitKey; value: number}
	/** A number the whole game reads rather than one ability — the condition thresholds, so far. */
	| {type: 'tune'; of: 'rule'; name: string; key: RuleKey; value: number}
	| {type: 'resetBalance'}
	| {type: 'healParty'}
	/** Put a unit in the ground, by unit id. */
	| {type: 'kill'; unit: string}
	/** Kill everyone on one side, ending the fight the way it would have ended anyway. */
	| {type: 'wipe'; faction: Faction}
	/** Walk into a room outside any dungeon — a one-off fight. */
	| {type: 'enter'; room: Room}
	/** Start a dungeon from its first room, by dungeon id. */
	| {type: 'startDungeon'; dungeon: string}
	/** Move on to the next room of the dungeon you cleared. */
	| {type: 'nextRoom'}
	/** Replay the fight you are in. */
	| {type: 'restart'}
	/** Run the fight clock or stop it. The pause a player took is part of how the fight went, so
	 * it lands in the combat log. */
	| {type: 'running'; value: boolean}
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
			// `Fight.spawn` throws for internal callers, who only pass ids the registry holds. A console
			// can type anything, so the action boundary refuses before the fight ever sees it.
			if (!(action.unit in unitRegistry)) return fail(`Unknown unit: ${action.unit}`)
			return ok(game.fight.spawn(action.unit))

		case 'remove':
			return game.fight.remove(action.unit) ? ok(action.unit) : fail(`No unit with id ${action.unit}`)

		case 'target': {
			if (!action.unit) {
				game.player.selectedTarget = undefined
				return ok(undefined)
			}
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
			// A console can type anything, and a value the rules reject deserves its own refusal —
			// not the "unknown ability" one `setBalanceValue` would fall back on.
			const invalid = validateBalanceValue(action.of, action.value)
			if (invalid) return fail(invalid)
			const applied = setBalanceValue(action.of, action.name, action.key, action.value)
			// Classes are the template; the units already fighting need telling separately.
			if (applied && action.of === 'unit') retuneLiveUnits(game, action.name, action.key, action.value)
			return applied ? ok(action.value) : fail(`Unknown ${action.of}: ${action.name}`)
		}

		case 'resetBalance':
			resetBalance()
			// A reset is a retune of everything: the classes are back at their defaults, so the
			// units already fighting — who copied their base stats at construction — need those
			// defaults told to them the same way a single tune is.
			for (const unit of game.fight.units) retuneLiveUnitFromTemplate(unit)
			return ok(undefined)

		case 'healParty':
			for (const member of game.party) member.health.set(member.health.max)
			return ok(undefined)

		case 'kill': {
			const unit = findUnit(game, action.unit)
			if (!unit) return fail(`No unit with id ${action.unit}`)
			if (protectedByGodMode(game, unit)) return fail('God mode is on — nothing in the party can die')
			kill(game, unit)
			return ok(unit)
		}

		case 'wipe': {
			const doomed = game.fight.units.filter((unit) => unit.faction === action.faction)
			if (doomed.some((unit) => protectedByGodMode(game, unit)))
				return fail('God mode is on — nothing in the party can die')
			for (const unit of doomed) kill(game, unit)
			return ok(undefined)
		}

		case 'enter':
			// Walking into an arbitrary room steps off the dungeon.
			game.dungeonRun = undefined
			game.enter(action.room)
			return ok(undefined)

		case 'startDungeon': {
			const dungeon = dungeonRegistry[action.dungeon]
			if (!dungeon) return fail(`Unknown dungeon: ${action.dungeon}`)
			game.dungeonRun = {dungeon, room: 0, times: []}
			game.enter(dungeon.rooms[0])
			return ok(dungeon)
		}

		case 'nextRoom': {
			const run = game.dungeonRun
			if (!run) return fail('Not in a dungeon')
			if (!game.gameOver || game.outcome !== 'victory') return fail('The room is not cleared yet')
			const next = run.room + 1
			if (next >= run.dungeon.rooms.length) return fail('The dungeon is finished')
			// enter() zeroes the fight clock, so bank this room's time before it does.
			run.times.push(game.elapsedTime)
			run.room = next
			game.enter(run.dungeon.rooms[next])
			return ok(next)
		}

		case 'restart':
			game.enter(game.fight.room)
			return ok(undefined)

		case 'running': {
			if (game.running === action.value) return fail(`Already ${action.value ? 'running' : 'paused'}`)
			if (action.value) game.play()
			else game.pause()
			game.combatLog.add({timestamp: Date.now(), eventType: action.value ? 'GAME_RESUME' : 'GAME_PAUSE'})
			return ok(action.value)
		}

		case 'set':
			game[action.key] = action.value as never
			if (action.key === 'infiniteMana' && action.value && game.player.mana) {
				game.player.mana.set(game.player.mana.max)
			}
			return ok(action.value)
	}
}

const findUnit = (game: GameLoop, id: string): Unit | undefined => game.fight.units.find((unit) => unit.id === id)

/** God mode is the party's, so it is what a party unit cannot be killed past. */
const protectedByGodMode = (game: GameLoop, unit: Unit) => game.godMode && unit.faction === FACTION.PARTY

/**
 * The one death that does not come from a hit. Deliberately not through `applyHit()`: damage big
 * enough to kill would be counted as damage, and a wipe would flatter whoever it was credited to
 * in every number the report prints. So the bar goes to zero and only the death is logged.
 */
function kill(game: GameLoop, unit: Unit) {
	if (!unit.alive) return
	unit.health.set(0)
	game.combatLog.add({
		timestamp: Date.now(),
		eventType: 'UNIT_DIED',
		sourceId: unit.id,
		sourceName: unit.name,
		targetId: unit.id,
		targetName: unit.name,
	})
}

/**
 * A retuned unit type applies to the ones already fighting, matched by `unitId` — never by
 * class name, which the production build minifies into nonsense.
 */
function retuneLiveUnits(game: GameLoop, unitId: string, key: UnitKey, value: number) {
	for (const unit of game.fight.units) {
		if (unit.unitId !== unitId) continue
		unit.setBaseStat(key, value)
	}
}

/** After a reset, push every stat of the class template back onto a live unit. */
function retuneLiveUnitFromTemplate(unit: Unit) {
	const template = unit.unitId ? unitClasses[unit.unitId] : undefined
	if (!template) return
	for (const stat of STAT_KEYS) unit.setBaseStat(stat, template[stat])
}

function interrupt(game: GameLoop): ActionResult<void> {
	log('interrupt')
	if (!game.player.stopCasting()) return fail('Nothing to interrupt')
	return ok(undefined)
}
