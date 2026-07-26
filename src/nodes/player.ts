import {Character, FACTION} from './character'
import {Mana} from './mana'
import {Spell} from './spell'
import {spellRegistry} from './registry'
import {SpellCast} from './spell-cast'
import type {GlobalCooldown} from './global-cooldown'
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

	spellbook: Record<string, typeof Spell> = spellRegistry

	getTarget() {
		const target = super.getTarget()
		if (target) return target
		const tank = this.parent.tank
		return tank?.health.current > 0 ? tank : undefined
	}

	// keep track of spell casting
	lastCastTime = 0
	lastCastCompletedTime = 0
	spell: Spell | undefined
	gcd: GlobalCooldown | undefined

	/**
	 * When each spell comes off its own cooldown, in fight-clock ms, keyed by spell name.
	 *
	 * Expiry stamps rather than a Task per spell: vroum defers `connect()` to a microtask, so a
	 * cooldown Task started during a cast is not mounted yet when something asks about it in the
	 * same tick. Storing when it ends also means retuning a cooldown mid-fight leaves the one
	 * already running alone, as the rest of balance does. A fight gets a fresh Player, so there is
	 * nothing to reset between them.
	 */
	cooldowns = new Map<string, number>()

	/** The primitive `perform({type: 'cast'})` composes. Returns why it refused, if it did. */
	castSpell(spellName: string) {
		return SpellCast.cast(this, spellName)
	}
}
