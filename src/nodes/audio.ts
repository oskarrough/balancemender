import {Node} from 'vroum'
import {logger} from '../utils'
import {GameLoop} from './game-loop'

// Simple type for our sound library - keeps TypeScript happy with minimal complexity
type SoundCategory = Record<string, string>
type SoundLibrary = Record<string, SoundCategory>

/**
 * Global sound manager
 * - Single instance should be created on GameLoop
 * - Call AudioPlayer.play('spell.cast') from anywhere
 */
export class AudioPlayer extends Node {
	static global: AudioPlayer | null = null
	folder = '/assets/sounds/'
	disabled = false
	paused = false
	volume = 0.8 
	private _muted = false

	// Sounds by category
	sounds: SoundLibrary = {
		spell: {
			precast: '1694002.ogg',
			precast_deep: '566717.ogg',
			precast_celestial: '568144.ogg',
			cast: '568017.ogg',
			rejuvenation: '1687853.ogg',
			fizzle: '569772.ogg',
		},
		combat: {
			air_hit: 'air-in-a-hit-2161.wav',
			arrow: 'arrow-shot-through-air-2771.wav',
			ball_tap: 'game-ball-tap-2073.wav',
			body_punch: 'body-punch-quick-hit-2153.wav',
			fast_blow: 'fast-blow-2144.wav',
			fast_punch: 'martial-arts-fast-punch-2047.wav',
			punch_through_air: 'punch-through-air-2141.mp3',
			quick_punch: 'soft-quick-punch-2151.wav',
			strong_punch: 'strong-punches-to-the-body-2198.wav',
			strong_punch2: 'impact-of-a-strong-punch-2155.mp3',
			sword_hit: 'strong-punches-to-the-body-2198.wav',
		},
		ui: {
			// UI sounds go here
		},
	}

	audioElements: HTMLAudioElement[] = []

	constructor(parent?: Node) {
		super(parent)

		// Set global audio player if this is attached to GameLoop
		if (parent instanceof GameLoop) {
			AudioPlayer.global = this

			// Set initial mute state from parent
			this.muted = parent.muted

			// Log initial mute state
			logger.debug(`audio: initial mute state: ${this.muted}`)

			// Listen for game pause/resume events directly
			parent.on(GameLoop.PAUSE, () => {
				this.paused = true
				this.stop() // When pausing, immediately stop all sounds
			})

			parent.on(GameLoop.PLAY, () => {
				this.paused = false
			})
		}
	}

	mount() {
		logger.debug(`audio:mount`)
	}

	// Getter and setter for muted property
	get muted(): boolean {
		return this._muted
	}

	set muted(value: boolean) {
		// Only update if value is changing
		if (this._muted !== value) {
			this._muted = value
			logger.debug(`audio: mute state changed to ${value}`)

			// Update all current audio elements
			for (const audio of this.audioElements) {
				audio.muted = value
			}
		}
	}

	/**
	 * Play a sound using category.sound_id format
	 * Examples: 'spell.cast', 'combat.sword_hit'
	 */
	static play(soundId: string, loop?: boolean) {
		if (AudioPlayer.global) {
			return AudioPlayer.global.play(soundId, loop)
		} else {
			logger.debug(`No global AudioPlayer available`)
			return null
		}
	}

	// Set mute state for all audio
	static setMuted(muted: boolean) {
		if (AudioPlayer.global) {
			logger.debug(`audio: global mute set to ${muted}`)
			AudioPlayer.global.muted = muted
			return true
		}
		return false
	}

	/**
	 * Toggle the mute state
	 * @returns The new mute state
	 */
	static toggleMute(): boolean {
		if (AudioPlayer.global) {
			const newState = !AudioPlayer.global.muted
			AudioPlayer.global.muted = newState
			logger.debug(`audio: mute toggled to ${newState}`)
			return newState
		}
		return false
	}

	/**
	 * Play a sound from the library
	 * @param soundId Format: 'category.sound_name' (e.g., 'spell.cast')
	 */
	play(soundId: string, loop?: boolean) {
		// Quick bail-out conditions
		if (this.disabled) {
			logger.debug(`audio: skipping ${soundId} (audio disabled)`)
			return null
		}

		if (!soundId.includes('.')) {
			logger.debug(`audio: invalid format: ${soundId} (use 'category.sound')`)
			return null
		}

		// Parse the sound ID
		const [category, sound] = soundId.split('.')

		// Skip non-UI sounds when paused
		if (this.paused && category !== 'ui') {
			logger.debug(`audio: skipping ${soundId} (game paused)`)
			return null
		}

		// Find the sound filename
		const soundCategory = this.sounds[category]
		if (!soundCategory || !(sound in soundCategory)) {
			logger.debug(`audio: unknown sound: ${soundId}`)
			return null
		}

		// Create and configure the audio element
		logger.debug(`audio: playing ${soundId}`)
		const filename = soundCategory[sound]
		const fullPath = this.folder + filename
		logger.debug(`audio: full path = ${fullPath}`)

		try {
			const audio = new Audio(fullPath)

			// Set properties BEFORE calling play()
			audio.loop = Boolean(loop)
			audio.muted = this.muted // Apply current mute state
			audio.volume = this.volume

			// Add audio to the tracking array before playing
			this.audioElements.push(audio)

			// Set up the onended handler
			audio.onended = () => {
				audio.pause()
				const index = this.audioElements.indexOf(audio)
				if (index !== -1) {
					this.audioElements.splice(index, 1)
				}
				logger.debug(`audio: finished ${soundId}`)
			}

			// Start playback and log any errors
			audio.play().catch((err) => {
				logger.debug(`audio: error playing ${soundId}: ${err.message}`)
			})

			// Log confirmation that we're attempting to play
			logger.debug(
				`audio: started ${soundId}, volume: ${audio.volume}, muted: ${audio.muted}`,
			)

			return audio
		} catch (err) {
			logger.debug(`audio: error creating audio element for ${soundId}: ${err}`)
			return null
		}
	}

	stop() {
		const count = this.audioElements.length
		logger.debug(`audio: stopping ${count} sounds`)

		for (const audio of this.audioElements) {
			audio.pause()
			audio.currentTime = 0
		}
		this.audioElements = []
	}
}

// https://www.wowhead.com/sounds/name:precast
// https://www.wowhead.com/sounds/name:greater+heal#0-5
