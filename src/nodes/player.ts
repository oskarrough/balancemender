import {log} from '../utils'
import {Character, FACTION} from './character'
import {Health} from './health'
import {Mana} from './mana'
import {Spell} from './spell'
import {Heal, FlashHeal, GreaterHeal, Renew} from './spells'
import {GlobalCooldown} from './global-cooldown'

export class Player extends Character {
	static maxHealth = 160
	static maxMana = 600
	faction = FACTION.PARTY
	name = 'Player'
	image = '/assets/generated/characters/player.png'

	health = new Health(this, (this.constructor as typeof Player).maxHealth)
	mana: Mana = new Mana(this, (this.constructor as typeof Player).maxMana)

	// targetingTask = new TargetOppositeFaction(this)
	// attackEffect = new MediumAttack(this)

	spellbook: Record<string, typeof Spell> = {
		Heal: Heal,
		'Flash Heal': FlashHeal,
		'Greater Heal': GreaterHeal,
		Renew: Renew,
	}

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
		log(`player:cast:${spellName}`)
		if (this.health.current <= 0) return console.warn(`Can't cast while dead`)
		if (this.gcd) return console.warn(`Can't cast during global cooldown`)
		if (this.spell) return console.warn(`Can't cast while casting`)
		if (!this.getTarget()) return console.warn(`Can't cast without a target`)

		const SpellClass = this.spellbook[spellName]
		if (!SpellClass) {
			return console.warn(`Spell ${spellName} not found in spellbook`)
		}
		if (SpellClass.cost && this.mana && this.mana.current < SpellClass.cost) {
			return console.warn('Not enough mana')
		}

		this.spell = new SpellClass(this)
		this.lastCastTime = this.parent.parent.elapsedTime
	}
}
