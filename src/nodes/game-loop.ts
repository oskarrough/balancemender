import {Loop} from '../vroum'
import {log} from '../utils'
import type {Player} from './player'
import type {Tank} from './party-units'
import {AudioPlayer} from './audio'
import {Encounter, DEMO_ROSTER, Roster} from './encounter'
import type {DevConsole} from '../components/dev-console'
import {buildGameOver} from '../animations'
import {logCombat, setCombatClock, clearLogs} from '../combatlog'
import {perform, type GameAction} from '../actions'

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
 * Main game loop that manages the game state and updates
 */
export class GameLoop extends Loop {
	gameOver = false

	// A global cooldown window that starts after each successful cast. Spells can not be cast during global cooldown.
	gcd = 1500

	/**
	 * How the game draws itself — `main.ts` installs it, a simulation leaves it unset and the
	 * fight happens with nobody watching. A slot rather than an import of `components/ui`, because
	 * that import reaches uhtml, and uhtml needs a DOM the moment it loads. See
	 * [architecture](../../docs/architecture.md).
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

	// Private mute state - use getter/setter to sync with AudioPlayer
	private _muted = true

	audio = new AudioPlayer(this)
	encounter: Encounter

	/** Pass a roster to start on something other than the demo encounter. */
	constructor(roster: Roster = DEMO_ROSTER) {
		super()
		this.encounter = new Encounter(this, roster)
	}

	// Developer mode properties
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

	/** Swap the active encounter, tearing down the previous one. */
	loadEncounter(roster: Roster) {
		this.pause()
		this.encounter.disconnect()
		// The fight clock restarts, so the log has to as well — otherwise the last fight's
		// damage gets divided by this fight's duration and every rate reads high.
		clearLogs()
		this.encounter = new Encounter(this, roster)
		this.gameOver = false
		this.elapsedTime = 0
		// Stamped against a clock that just went back to zero, so it would otherwise read as
		// having happened in this fight's future and never expire.
		this.lastRefusal = undefined
		this.render()
	}

	// Getter and setter for muted property that syncs with AudioPlayer
	get muted(): boolean {
		return this._muted
	}

	set muted(value: boolean) {
		// Only update if value is changing
		if (this._muted !== value) {
			this._muted = value
			log(`game: mute set to ${value}`)

			// Sync with AudioPlayer
			if (AudioPlayer.global) {
				AudioPlayer.global.muted = value
				log(`game: synced mute state with AudioPlayer: ${value}`)
			}
		}
	}

	get party() {
		return this.encounter.party
	}

	get enemies() {
		return this.encounter.enemies
	}

	get player(): Player {
		return this.encounter.player
	}

	get tank(): Tank {
		return this.encounter.tank
	}

	mount() {
		log('game:mount')
		this.on(GameLoop.PLAY, this.handlePlay)
		this.on(GameLoop.PAUSE, this.handlePause)
		// Stamp combat events with fight time instead of wall time.
		setCombatClock(() => this.elapsedTime)

		logCombat({
			timestamp: Date.now(),
			eventType: 'ENCOUNTER_START',
		})
	}

	handlePlay = () => {
		log('game:play')
	}

	handlePause = () => {
		log('game:pause')
	}

	tick() {
		if (this.encounter.isPartyDefeated() || this.encounter.isEnemiesDefeated()) {
			this.gameOver = true
		}
		if (this.gameOver) this.onGameOver()
		this.render()
	}

	render() {
		this.draw?.(this)
	}

	onGameOver() {
		logCombat({
			timestamp: Date.now(),
			eventType: 'ENCOUNTER_END',
		})
		this.audio.stop()
		this.pause()
		// gameOver/render are already set/done by tick() before this fires;
		// also set here so the debugger's manual trigger works from any state.
		this.gameOver = true
		this.render()
		// Only worth animating for someone who is watching it.
		if (this.draw) buildGameOver(this)
	}

	/** Reset state for a fresh encounter. Does not animate — pair with `restartGame()` for the visual transition. */
	restart() {
		this.loadEncounter(this.encounter.roster)
	}
}
