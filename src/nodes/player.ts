import {log} from '../utils'
import {Character, FACTION} from './character'
import {Health} from './health'
import {Mana} from './mana'
import {Spell} from './spell'
import {Heal, FlashHeal, GreaterHeal, Renew} from './spells'
import {GlobalCooldown} from './global-cooldown'

export class Player extends Character {
	faction = FACTION.PARTY
	health = new Health(this, 350)
	mana: Mana = new Mana(this, 600)
	name = 'Player'

	// keep track of spell casting
	lastCastTime = 0
	lastCastCompletedTime = 0
	spell: Spell | undefined
	gcd: GlobalCooldown | undefined

	// owns a list of Spells
	spellbook: Record<string, typeof Spell> = {
		Heal: Heal,
		'Flash Heal': FlashHeal,
		'Greater Heal': GreaterHeal,
		Renew: Renew,
	}

	castSpell(spellName: string) {
		log(`player:cast:${spellName}`)
		if (this.spell) return console.warn('Can not cast while already casting')
		if (this.health.current <= 0) return console.warn('Can not cast while dead. Dummy')
		if (this.gcd) return console.warn('Can not cast during GCD')
		const SpellClass = this.spellbook[spellName]
		if (!SpellClass) {
			console.warn(`Spell ${spellName} not found in spellbook`)
			return
		}

		if (SpellClass.cost && this.mana && this.mana.current < SpellClass.cost) {
			console.warn('Not enough mana to cast spell')
			return
		}

		this.spell = new SpellClass(this)
		this.lastCastTime = this.parent.elapsedTime
	}
}
