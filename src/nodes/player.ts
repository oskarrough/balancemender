import {Character, FACTION} from './character'
import {Mana} from './mana'
import type {Spell} from './spell'
import {spellRegistry} from './registry'
import type {Encounter} from './encounter'

export class Player extends Character {
	static maxHealth = 160
	static maxMana = 600
	/**
	 * Mana per second, once the five-second rule lets it start. Worth roughly a Heal per lull,
	 * which is what makes banking mana during a quiet stretch a real choice rather than a rounding
	 * error — see the note on `ManaRegen`.
	 */
	static manaRegen = 9
	static faction = FACTION.PARTY
	name = 'Player'
	image = '/assets/generated/characters/player.png'

	mana: Mana

	/** Same reason `Character` builds `health` here: a field initializer would orphan a second one. */
	constructor(public parent: Encounter) {
		super(parent)
		const stats = this.constructor as typeof Player
		this.mana = new Mana(this, stats.maxMana, stats.manaRegen)
	}

	/** The player is the one unit that knows every spell. See `Character.spellbook`. */
	spellbook: Record<string, typeof Spell> = spellRegistry

	/**
	 * Falls back to the tank, so the healer always has something to cast on. Only the player
	 * does this — everyone else takes the target their targeting task picked, or nothing.
	 */
	getTarget() {
		const target = super.getTarget()
		if (target) return target
		const tank = this.parent.tank
		return tank?.health.current > 0 ? tank : undefined
	}
}
