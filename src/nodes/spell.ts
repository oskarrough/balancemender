import {Task} from 'vroum'
import {AudioPlayer} from './audio'
import {GlobalCooldown} from './global-cooldown'
import {fct} from '../components/floating-combat-text'
import {log, naturalizeNumber} from '../utils'
import {Player} from './player'
import {GameLoop} from './game-loop'
import {logCombat} from '../combatlog'

export class Spell extends Task {
	repeat = 1

	// Instance properties
	name = ''
	cost = 0
	heal = 0
	// We'll use castTime instead of delay to avoid conflicts with Task API

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
			value: this.delay, // Cast time
		})

		if (this.delay) {
			AudioPlayer.play('spell_precast', {loop: true, owner: this})
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
			spellName: this.name,
		})

		if (this.heal) this.applyHeal()

		AudioPlayer.stopOwned(this)
		AudioPlayer.play('spell_cast', {owner: this})
	}

	/** Stop sounds owned by this spell (used by external interrupts). */
	stopSounds() {
		AudioPlayer.stopOwned(this)
	}

	destroy() {
		log(`spell:${this.name}:destroy`)

		AudioPlayer.stopOwned(this)

		const player = this.parent
		const gameLoop = this.root as GameLoop

		player.spell = undefined

		// Track when spell was completed (used for mana regen)
		if (this._cycles > 0) {
			player.lastCastCompletedTime = gameLoop.elapsedTime
		} else {
			// Log spell cast interrupted since it didn't complete any cycles
			logCombat({
				timestamp: Date.now(),
				eventType: 'SPELL_CAST_INTERRUPTED',
				sourceId: this.parent.id,
				sourceName: this.parent.name,
				spellId: this.name,
				spellName: this.name,
			})
		}

		// For instant cast spells (delay === 0), let the GCD expire naturally
		// Only clear GCD immediately for spells that were interrupted before completion
		if (this.delay > 0) {
			player.gcd = undefined
		}

		// If the spell finished at least once, consume mana
		if (this._cycles > 0 && player.mana) {
			player.mana.spend(this.cost)
			logCombat({
				timestamp: Date.now(),
				eventType: 'RESOURCE_SPENT',
				sourceId: this.parent.id,
				sourceName: this.parent.name,
				value: -this.cost,
				extraInfo: 'MANA',
			})
		}
	}

	applyHeal() {
		const player = this.parent
		const target = player.getTarget()
		if (!target) return

		const healAmount = naturalizeNumber(this.heal)

		// Apply healing directly to target's health node
		target.health.heal(healAmount)

		// Display and log the healing
		fct(`+${healAmount}`)

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
			value: healAmount,
		})
	}
}
