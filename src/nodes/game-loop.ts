import {Loop} from '../vroum'
import {log, logger} from '../utils'
import type {Player} from './player'
import {AudioPlayer} from './audio'
import {Fight, DEMO_ROOM, Room} from './fight'
import {playerAbilities} from './registry'
import type {Dungeon} from './dungeon'
import type {DevConsole} from '../components/dev-console'
import {buildGameOver} from '../animations'
import {CombatLog} from '../combatlog'
import {Rng} from '../rng'
import {perform, type GameAction} from '../actions'
import {unitsOf, type Outcome} from '../sim/report'
import {saveFight} from '../fight-history'

declare global {
	interface Window {
		balancemender?: GameLoop
	}
}

/**
 * The running game, or undefined while we are still on the splash.
 *
 * `main()` parks the game on `window.balancemender` so the console (and the dev panels) can
 * reach it. The `instanceof` is not paranoia: any element with `id="x"` also shows up as
 * `window.x`, so a truthiness check here silently hands out a DOM node instead.
 */
export function currentGame(): GameLoop | undefined {
	return window.balancemender instanceof GameLoop ? window.balancemender : undefined
}

/**
 * A dungeon being played: which one, which room you are in, and the fight-clock ms of each room
 * already cleared. The room you are in is not in `times` yet — it reads `elapsedTime`.
 *
 * Data, not a `Node`. A run has nothing to tick, so it is state the game holds rather than a
 * branch of the tree. The `Fight` is the live thing; this only says which one to build next.
 */
export interface DungeonRun {
	dungeon: Dungeon
	room: number
	times: number[]
}

/** The clock and the root of everything. See [architecture](../../docs/architecture.md). */
export class GameLoop extends Loop {
	gameOver = false

	/** How the fight ended — unset until `gameOver` flips. See `Outcome` in the glossary. */
	outcome?: Outcome

	/** How long a cast locks the caster out of the next one. See `GlobalCooldown`. */
	gcd = 1500

	/**
	 * How the game draws itself — `main.ts` installs it, a simulation leaves it unset and the
	 * fight happens with nobody watching. A slot rather than an import of `components/ui`, because
	 * that import reaches uhtml, and uhtml needs a DOM the moment it loads. See
	 * [simulation](../../docs/simulation.md).
	 */
	draw?: (game: GameLoop) => void

	/**
	 * Awaiting a game returns nothing, immediately — it does not wait for the fight to end.
	 *
	 * vroum makes every Loop thenable and resolves that on DESTROY, so `await game` parks on a loop
	 * that never dies: a 5s test timeout with no error and nothing pointing at the cause. Resolving
	 * now turns that into `undefined` and a TypeError on the next line, which says where to look.
	 * A helper that builds a game still must not return it — assign it to a variable the caller has.
	 */
	// oxlint-disable-next-line no-thenable -- vroum already made it thenable; this defuses it
	then<T>(onfulfilled: () => T | PromiseLike<T>): PromiseLike<T> {
		return Promise.resolve(onfulfilled())
	}

	private _muted = true

	/** Guards against `onGameOver` firing twice — the tick loop and the animation debugger both can. */
	private gameOverHandled = false

	audio = new AudioPlayer(this)

	/**
	 * This game's event stream, stamped from its own clock. Everything a fight does reaches it
	 * through `(node.root as GameLoop).combatLog` — the pointer vroum already set on connect.
	 */
	combatLog = new CombatLog(() => this.elapsedTime)

	/** This game's dice. Seeded from the constructor, so two fights never share a stream. */
	rng: Rng

	fight: Fight

	/**
	 * Progress through a dungeon, or undefined for a one-off fight. See `DungeonRun`.
	 */
	dungeonRun?: DungeonRun

	/**
	 * Pass a room to start on something other than the demo fight, and a seed to fix its dice —
	 * the browser passes neither and plays a random fight, a simulation passes both.
	 */
	constructor(room: Room = DEMO_ROOM, seed: number | null = null) {
		super()
		this.rng = new Rng(seed)
		this.fight = new Fight(this, room)
	}

	godMode = false
	infiniteMana = false
	console!: DevConsole

	/**
	 * Why the last action was refused, on the fight clock. One slot, not a queue: only the most
	 * recent refusal is worth showing, and a player leaning on an unaffordable spell should read
	 * one steady message rather than a backlog. The UI decides how long it stays — see
	 * `src/components/ui.ts`.
	 */
	lastRefusal?: {error: string; at: number}

	/**
	 * Do something to this game. The only way anything mutates a fight — keyboard, ability buttons,
	 * dev console, Balance Lab, BotDriver, tests, agents. See `src/actions.ts`.
	 *
	 * Refusals are recorded here rather than at each call site, so a caller cannot forget to tell
	 * the player why nothing happened and leave a dead click.
	 */
	perform(action: GameAction) {
		const result = perform(this, action)
		if (!result.ok) this.lastRefusal = {error: result.error, at: this.elapsedTime}
		return result
	}

	/** Walk into a room: build its fight and tear down the one you were in. */
	enter(room: Room) {
		this.pause()
		this.fight.disconnect()
		// The fight clock restarts, so the log has to as well — otherwise the last fight's
		// damage gets divided by this fight's duration and every rate reads high.
		this.combatLog.clear()
		this.fight = new Fight(this, room)
		if (this.dungeonRun) {
			// Dungeon runs start with 2 spells and learn one per room, accumulated so far.
			const run = this.dungeonRun
			const granted = run.dungeon.rooms.slice(0, run.room + 1).flatMap((r) => r.grants ?? [])
			this.player.abilities = Object.fromEntries(granted.map((id) => [id, playerAbilities[id]]))
		} else {
			// Learned spells belong to the run. Walking off the dungeon — into a one-off room, an
			// arena fight, a fresh boot — hands the whole bar back.
			this.player.abilities = playerAbilities
		}
		this.gameOver = false
		this.outcome = undefined
		this.elapsedTime = 0
		// Stamped against a clock that just went back to zero, so it would otherwise read as
		// having happened in this fight's future and never expire.
		this.lastRefusal = undefined
		this.gameOverHandled = false
		this.render()
	}

	get muted(): boolean {
		return this._muted
	}

	/** Kept in step with the speaker, which the menu and the `muted` URL param both reach through here. */
	set muted(value: boolean) {
		this._muted = value
		this.audio.muted = value
	}

	get party() {
		return this.fight.party
	}

	get enemies() {
		return this.fight.enemies
	}

	get player(): Player {
		return this.fight.player
	}

	mount() {
		log('game:mount')
		this.combatLog.add({timestamp: Date.now(), eventType: 'FIGHT_START'})
	}

	tick() {
		// Checked in this order so a mutual wipe (both sides dead the same tick) reads as a
		// defeat, matching the sim's `runFight()`.
		if (this.fight.isPartyDefeated()) {
			this.gameOver = true
			this.outcome = 'defeat'
		} else if (this.fight.isEnemiesDefeated()) {
			this.gameOver = true
			this.outcome = 'victory'
		}
		if (this.gameOver) this.onGameOver()
		this.render()
	}

	render() {
		this.draw?.(this)
	}

	onGameOver() {
		if (this.gameOverHandled) return
		this.gameOverHandled = true
		this.combatLog.add({timestamp: Date.now(), eventType: 'FIGHT_END'})
		this.audio.stop()
		this.pause()
		// gameOver/render are already set/done by tick() before this fires;
		// also set here so the debugger's manual trigger works from any state.
		this.gameOver = true
		// The debugger's manual trigger flips gameOver without going through tick(), so fall
		// back to reading the fight directly rather than showing no outcome at all.
		if (!this.outcome) this.outcome = this.fight.isPartyDefeated() ? 'defeat' : 'victory'
		const outcome = this.outcome
		this.render()
		// Only worth animating — or saving — for someone who is watching it. Headless SimLoop
		// fights have no draw and must never be persisted.
		if (this.draw) {
			buildGameOver(this)
			saveFight({
				outcome,
				duration: Math.round(this.elapsedTime),
				events: this.combatLog.events.slice(),
				units: unitsOf(this),
			}).catch((err) => logger.error({err}, 'Failed to save fight history'))
		}
	}

	/** Reset state for a fresh fight. Does not animate — pair with `restartGame()` for the visual transition. */
	restart() {
		this.enter(this.fight.room)
	}
}
