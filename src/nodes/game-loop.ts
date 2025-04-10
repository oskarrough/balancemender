import {Loop} from 'vroum'
import {log, render} from '../utils'
import {Player} from './player'
import {Nakroth, TinyWolf} from './enemies'
import {Tank, Rogue, Warrior} from './party-characters'
import {AudioPlayer} from './audio'
import {UI} from '../components/ui'
import {DevConsole} from '../components/dev-console'
import gsap from 'gsap'
import {logCombat} from '../combatlog'

/**
 * Types of characters in the game
 */
type Character = Player | Tank | Warrior | Rogue
type Enemy = Nakroth | TinyWolf

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

	// Game state arrays
	party: Character[] = []
	enemies: Enemy[] = []

	// Developer mode properties
	godMode = false
	infiniteMana = false
	console!: DevConsole

	constructor() {
		super()
		this.prepareEncounter()
	}

	/** A demo encounter while we're testing. Set up your party and enemy characters here */
	prepareEncounter() {
		const tank = new Tank(this)
		// const warrior = new Warrior(this)
		const player = new Player(this)
		player.currentTarget = player
		this.party.push(tank, player)
		// const boss = new Nakroth(this)
		this.enemies.push(new TinyWolf(this))
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

	get player(): Player {
		return this.party.find((x) => x instanceof Player) as Player
	}

	get tank(): Tank {
		return this.party.find((char) => char instanceof Tank) as Tank
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

	handlePlay() {
		log('game:play')
	}

	handlePause() {
		log('game:pause')
	}

	tick() {
		if (this.isPartyDefeated()) this.gameOver = true
		if (this.gameOver) this.onGameOver()
		this.render()
	}

	/* @returns true if all party members are dead */
	isPartyDefeated() {
		if (this.party.length === 0) return true
		const anyAlive = this.party.some(
			(character) => character.health && character.health.current > 0,
		)
		return !anyAlive
	}

	render() {
		if (!this.element) {
			console.warn('No element to render to')
			return
		}
		render(this.element, UI(this))
	}

	onGameOver() {
		log('game:over, pausing game loop')
		this.audio.stop()
		this.pause()

		// Add GSAP animations for game over effect
		// Scale down and fade enemies and party
		gsap.to('.Enemies, .PartyGroup', {
			scale: 0.95,
			// opacity: 0.7,
			duration: 0.8,
			ease: 'power2.out',
		})

		// Make game over screen more visible with animation
		gsap.fromTo(
			'.GameOver',
			{opacity: 0, scale: 0.9, y: -20},
			{opacity: 1, scale: 1, y: 0, duration: 1, delay: 0.3, ease: 'back.out(1.4)'},
		)
	}
}
