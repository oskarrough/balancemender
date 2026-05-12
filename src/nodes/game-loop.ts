import {Loop} from 'vroum'
import {log, render} from '../utils'
import type {Player} from './player'
import type {Tank} from './party-characters'
import {AudioPlayer} from './audio'
import {Encounter, DemoEncounter} from './encounter'
import {UI} from '../components/ui'
import {DevConsole} from '../components/dev-console'
import {buildGameOver} from '../animations'
import {logCombat} from '../combatlog'

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
	encounter: Encounter = new DemoEncounter(this)

	// Developer mode properties
	godMode = false
	infiniteMana = false
	console!: DevConsole

	/** Swap the active encounter, tearing down the previous one. */
	loadEncounter(Klass: typeof Encounter) {
		this.pause()
		this.encounter.disconnect()
		this.encounter = new Klass(this)
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
		if (!this.element) {
			console.warn('No element to render to')
			return
		}
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
		buildGameOver(this)
	}

	/** Reset state for a fresh encounter. Does not animate — pair with `restartGame()` for the visual transition. */
	restart() {
		this.loadEncounter(DemoEncounter)
	}
}
