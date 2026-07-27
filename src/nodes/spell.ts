import {Task} from 'vroum'
import {AudioPlayer} from './audio'
import {applyStatics, log, naturalizeNumber} from '../utils'
import type {Character} from './character'
import {applyHit} from './hit'
import {SpellCast} from './spell-cast'

export class Spell extends Task {
	repeat = 1

	name = ''
	cost = 0
	heal = 0
	cooldown = 0

	static name = ''
	static cost = 0
	static heal = 0
	/** Cast time in ms. Mirrored onto Task.delay at construction. */
	static castTime = 0
	/**
	 * How long after a completed cast this spell is unavailable, in ms. `0` means only the
	 * global cooldown applies, which is true of every spell today — the numbers are a balance
	 * question, and belong wherever they can be swept. The mechanic is here so they can be.
	 */
	static cooldown = 0
	static icon = ''

	constructor(public parent: Character) {
		super(parent)
		applyStatics(this, 'name', 'cost', 'heal', 'cooldown')
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
		const target = this.parent.getTarget()
		if (!target) return

		applyHit({
			source: this.parent,
			target,
			amount: naturalizeNumber(this.heal),
			spell: this.name,
			eventType: 'SPELL_HEAL',
		})
	}
}
