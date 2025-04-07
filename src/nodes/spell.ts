import {Task} from 'vroum'
import {AudioPlayer} from './audio'
import {GlobalCooldown} from './global-cooldown'
import {fct} from '../components/floating-combat-text'
import {log, naturalizeNumber} from '../utils'
import {Player} from './player'
import {GameLoop} from './game-loop'
import { logCombat } from '../combatlog'

export class Spell extends Task {
	repeat = 1

	// Instance properties
	name = ''
	cost = 0
	heal = 0
	// We'll use castTime instead of delay to avoid conflicts with Task API

	// Track active audio elements for this spell
	private spellSounds: HTMLAudioElement[] = []

	// Static properties for spell definitions
	static name = ''
	static cost = 0
	static heal = 0
	static castTime = 0 // Cast time in milliseconds

	constructor(public parent: Player) {
		super(parent)

		// Copy static properties to instance
		const constructor = this.constructor as typeof Spell
		this.name = constructor.name || this.name
		this.cost = constructor.cost || this.cost
		this.heal = constructor.heal || this.heal
		this.delay = constructor.castTime || 0 // Set Task.delay from castTime
	}

	mount() {
		log('spell:mount')
		this.parent.gcd = new GlobalCooldown(this.parent)

		// Log spell cast start to combat log
		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_START',
			sourceId: this.parent.id,
			sourceName: this.parent.name,
			spellId: this.name,
			spellName: this.name,
			value: this.delay // Cast time
		})

		// Only play for spells with a cast time
		if (this.delay) {
			// Play and track the precast sound
			log(`spell:${this.name}:playing precast sound`)
			const audio = AudioPlayer.play('spell.precast', true)
			if (audio) {
				this.spellSounds.push(audio)
				log(`spell:${this.name}:tracked precast sound`)
			} else {
				log(`spell:${this.name}:failed to play precast sound`)
			}
		}
	}

	tick() {
		log('spell:tick')

		// Log spell cast success to combat log
		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_SUCCESS',
			sourceId: this.parent.id,
			sourceName: this.parent.name,
			spellId: this.name,
			spellName: this.name
		})

		if (this.heal) this.applyHeal()

		this.stopSounds()

		// Play and track the cast sound
		log(`spell:${this.name}:playing cast sound`)
		const audio = AudioPlayer.play('spell.cast')
		if (audio) {
			this.spellSounds.push(audio)
			log(`spell:${this.name}:tracked cast sound`)
		} else {
			log(`spell:${this.name}:failed to play cast sound`)
		}
	}

	// Stop only this spell's sounds
	stopSounds() {
		const count = this.spellSounds.length
		if (count === 0) return

		log(`spell:${this.name}:stopping ${count} sounds`)
		// Stop all audio elements tracked by this spell
		this.spellSounds.forEach((audio) => {
			try {
				audio.pause()
				audio.currentTime = 0
			} catch (e) {
				log(`spell:error stopping sound: ${e}`)
			}
		})
		this.spellSounds = []
	}

	destroy() {
		log(`spell:${this.name}:destroy`)

		// Make sure to stop any sounds when the spell is destroyed
		this.stopSounds()

		const player = this.parent
		const gameLoop = this.root as GameLoop

		player.spell = undefined

		// Track when spell was completed (used for mana regen)
		if (this.cycles > 0) {
			player.lastCastCompletedTime = gameLoop.elapsedTime
		} else {
			// Log spell cast interrupted since it didn't complete any cycles
			logCombat({
				timestamp: Date.now(),
				eventType: 'SPELL_CAST_INTERRUPTED',
				sourceId: this.parent.id,
				sourceName: this.parent.name,
				spellId: this.name,
				spellName: this.name
			})
		}

		// For instant cast spells (delay === 0), let the GCD expire naturally
		// Only clear GCD immediately for spells that were interrupted before completion
		if (this.delay > 0) {
			player.gcd = undefined
		}

		// If the spell finished at least once, consume mana
		if (this.cycles > 0 && player.mana) {
			player.mana.spend(this.cost)
			
			// Log mana consumption
			logCombat({
				timestamp: Date.now(),
				eventType: 'RESOURCE_CHANGE',
				sourceId: this.parent.id,
				sourceName: this.parent.name,
				value: -this.cost,
				extraInfo: 'MANA'
			})
		}
	}

	applyHeal() {
		const gameLoop = this.root as GameLoop
		const player = this.parent

		// Use the player's current target if set, otherwise fall back to the tank
		const target = player.currentTarget || gameLoop.tank
		if (!target) return

		const healAmount = naturalizeNumber(this.heal)

		// Apply healing directly to target's health node
		const actualHeal = target.health.heal(healAmount)

		// Display and log the healing
		fct(`+${actualHeal}`)
		log(`spell:${this.name}:applyHeal`, actualHeal)
		
		// Log healing to combat log
		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_HEAL',
			sourceId: this.parent.id,
			sourceName: this.parent.name,
			targetId: target.id,
			targetName: target.name || 'Unknown',
			spellId: this.name,
			spellName: this.name,
			value: actualHeal
		})
	}
}
