import {Node, Loop, Task} from 'vroum'
import {logger} from '../utils'
import type {GameLoop} from './game-loop'

type SoundCategory = 'spell' | 'combat' | 'ui'

interface SoundDef {
	file: string
	category: SoundCategory
}

interface PlayOptions {
	loop?: boolean
	owner?: object
}

/**
 * Friendly-name catalog. Callers reference sounds by these names; category
 * metadata lives here so AudioPlayer can apply pause rules without callers
 * needing to know about it.
 */
const CATALOG: Record<string, SoundDef> = {
	spell_precast: {file: '1694002.ogg', category: 'spell'},
	spell_precast_deep: {file: '566717.ogg', category: 'spell'},
	spell_precast_celestial: {file: '568144.ogg', category: 'spell'},
	spell_cast: {file: '568017.ogg', category: 'spell'},
	spell_rejuvenation: {file: '1687853.ogg', category: 'spell'},
	spell_fizzle: {file: '569772.ogg', category: 'spell'},
	combat_air_hit: {file: 'air-in-a-hit-2161.ogg', category: 'combat'},
	combat_arrow: {file: 'arrow-shot-through-air-2771.ogg', category: 'combat'},
	combat_ball_tap: {file: 'game-ball-tap-2073.ogg', category: 'combat'},
	combat_body_punch: {file: 'body-punch-quick-hit-2153.ogg', category: 'combat'},
	combat_fast_blow: {file: 'fast-blow-2144.ogg', category: 'combat'},
	combat_fast_punch: {file: 'martial-arts-fast-punch-2047.ogg', category: 'combat'},
	combat_punch_through_air: {file: 'punch-through-air-2141.mp3', category: 'combat'},
	combat_quick_punch: {file: 'soft-quick-punch-2151.ogg', category: 'combat'},
	combat_strong_punch: {file: 'strong-punches-to-the-body-2198.ogg', category: 'combat'},
	combat_strong_punch2: {file: 'impact-of-a-strong-punch-2155.mp3', category: 'combat'},
	combat_sword_hit: {file: 'strong-punches-to-the-body-2198.ogg', category: 'combat'},
}

export type SoundName = keyof typeof CATALOG | (string & {})

/**
 * Global sound manager
 * - Single instance should be created on GameLoop
 * - Call AudioPlayer.play('spell_cast') from anywhere
 * - Pass {owner: this} to scope a sound to a node, then stopOwned(this) on cleanup
 */
export class AudioPlayer extends Node {
	static global: AudioPlayer | null = null
	folder = '/assets/sounds/'
	disabled = false
	paused = false
	private _volume = 0.3
	private _muted = false

	private elements: HTMLAudioElement[] = []
	private ownedByElement = new WeakMap<HTMLAudioElement, object>()

	constructor(parent?: Node) {
		super(parent)

		// `Loop` and `Task`, not `GameLoop`, though the parent is always one: naming the concrete
		// class here is a *value* import of game-loop.ts, which value-imports actions.ts and so
		// balance.ts — and balance snapshots spell statics at module-initialisation time. That
		// closes `spells → audio → game-loop → actions → balance → spells` and leaves the snapshot
		// reading a half-built module. PAUSE and PLAY are vroum `Task` statics that `GameLoop`
		// only inherits, so this listens for exactly the same events.
		if (parent instanceof Loop) {
			const loop = parent as GameLoop
			AudioPlayer.global = this
			this.muted = loop.muted

			loop.on(Task.PAUSE, () => {
				this.paused = true
				this.stop()
			})

			loop.on(Task.PLAY, () => {
				this.paused = false
			})
		}
	}

	get muted(): boolean {
		return this._muted
	}
	set muted(value: boolean) {
		this._muted = value
		for (const audio of this.elements) audio.muted = value
	}

	get volume(): number {
		return this._volume
	}
	set volume(value: number) {
		this._volume = value
		for (const audio of this.elements) audio.volume = value
	}

	static play(name: SoundName, opts?: PlayOptions) {
		return AudioPlayer.global?.play(name, opts) ?? null
	}

	/** Stop and forget all sounds scoped to the given owner. */
	static stopOwned(owner: object) {
		AudioPlayer.global?.stopOwned(owner)
	}

	static toggleMute(): boolean {
		if (!AudioPlayer.global) return false
		AudioPlayer.global.muted = !AudioPlayer.global.muted
		return AudioPlayer.global.muted
	}

	play(name: SoundName, opts: PlayOptions = {}) {
		if (this.disabled) return null

		const def = CATALOG[name as string]
		if (!def) {
			logger.debug(`audio: unknown sound: ${name}`)
			return null
		}

		if (this.paused && def.category !== 'ui') return null

		const audio = new Audio(this.folder + def.file)
		audio.loop = Boolean(opts.loop)
		audio.muted = this.muted
		audio.volume = this.volume

		this.elements.push(audio)
		if (opts.owner) this.ownedByElement.set(audio, opts.owner)

		audio.onended = () => {
			audio.pause()
			this.forget(audio)
		}

		audio.play().catch((err) => {
			logger.debug(`audio: error playing ${name}: ${err.message}`)
		})

		return audio
	}

	stopOwned(owner: object) {
		const survivors: HTMLAudioElement[] = []
		for (const audio of this.elements) {
			if (this.ownedByElement.get(audio) === owner) {
				audio.pause()
				audio.currentTime = 0
				this.ownedByElement.delete(audio)
			} else {
				survivors.push(audio)
			}
		}
		this.elements = survivors
	}

	stop() {
		for (const audio of this.elements) {
			audio.pause()
			audio.currentTime = 0
		}
		this.elements = []
	}

	private forget(audio: HTMLAudioElement) {
		const index = this.elements.indexOf(audio)
		if (index !== -1) this.elements.splice(index, 1)
		this.ownedByElement.delete(audio)
	}
}

// https://www.wowhead.com/sounds/name:precast
// https://www.wowhead.com/sounds/name:greater+heal#0-5
