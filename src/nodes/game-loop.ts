import {Loop} from 'vroum'
import {log, render} from '../utils'
import type {Player} from './player'
import type {Tank} from './party-characters'
import {AudioPlayer} from './audio'
import {Encounter, DEMO_ROSTER, Roster} from './encounter'
import {UI} from '../components/ui'
import {DevConsole} from '../components/dev-console'
import {buildGameOver} from '../animations'
import {logCombat, setCombatClock, clearLogs} from '../combatlog'
import {perform, type GameAction} from '../actions'

/**
 * Main game loop that manages the game state and updates
 */
export class GameLoop extends Loop {
	gameOver = false

	// A global cooldown window that starts after each successful cast. Spells can not be cast during global cooldown.
	gcd = 1500
	element: HTMLElement | null = null // where to render the UI

	// Private mute state - use getter/setter to sync with AudioPlayer
	private _muted = true

	audio = new AudioPlayer(this)
	encounter: Encounter

	/** Pass a roster to start on something other than the demo fight. */
	constructor(roster: Roster = DEMO_ROSTER) {
		super()
		this.encounter = new Encounter(this, roster)
	}

	// Developer mode properties
	godMode = false
	infiniteMana = false
	console!: DevConsole

	/**
	 * Do something to this game. The only way anything mutates a fight — keyboard, spell
	 * buttons, dev console, Balance Lab, Autopilot, tests, agents. See `src/actions.ts`.
	 */
	perform(action: GameAction) {
		return perform(this, action)
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

	/** No element means we're running headless (a simulation) — the fight still happens, nobody watches. */
	render() {
		if (!this.element) return
		render(this.element, UI(this))
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
		if (this.element) buildGameOver(this)
	}

	/** Reset state for a fresh encounter. Does not animate — pair with `restartGame()` for the visual transition. */
	restart() {
		this.loadEncounter(this.encounter.roster)
	}
}
