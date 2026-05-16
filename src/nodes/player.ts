import {Character, FACTION} from './character'
import {Mana} from './mana'
import {Spell} from './spell'
import {spellRegistry} from './registry'
import {SpellCast} from './spell-cast'
import type {GlobalCooldown} from './global-cooldown'

export class Player extends Character {
	static maxHealth = 160
	static maxMana = 600
	faction = FACTION.PARTY
	name = 'Player'
	image = '/assets/generated/characters/player.png'

	mana: Mana = new Mana(this, (this.constructor as typeof Player).maxMana)

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

	castSpell(spellName: string) {
		return SpellCast.cast(this, spellName)
	}
}
