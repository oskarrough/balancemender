import {Task} from 'vroum'
import {AudioPlayer} from './audio'
import {fct} from '../components/floating-combat-text'
import {applyStatics, log, naturalizeNumber} from '../utils'
import {Player} from './player'
import {logCombat} from '../combatlog'
import {SpellCast} from './spell-cast'

export class Spell extends Task {
	repeat = 1

	name = ''
	cost = 0
	heal = 0

	static name = ''
	static cost = 0
	static heal = 0
	/** Cast time in ms. Mirrored onto Task.delay at construction. */
	static castTime = 0
	static icon = ''

	constructor(public parent: Player) {
		super(parent)
		applyStatics(this, 'name', 'cost', 'heal')
		this.delay = (this.constructor as typeof Spell).castTime
	}

	mount() {
		log('spell:mount')
		SpellCast.mount(this)
	}

	tick() {
		log('spell:tick')
		SpellCast.succeed(this)
		this.cast()
	}

	/**
	 * What the spell does once the cast lands. Subclasses override this rather than
	 * `tick()`, so the cast is logged no matter what the spell itself does.
	 */
	cast() {
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
		SpellCast.finish(this)
	}

	applyHeal() {
		const player = this.parent
		const target = player.getTarget()
		if (!target) return

		const healAmount = naturalizeNumber(this.heal)

		// Apply healing directly to target's health node
		const before = target.health.current
		target.health.heal(healAmount)
		const overheal = healAmount - (target.health.current - before)

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
			overheal,
		})
	}
}
