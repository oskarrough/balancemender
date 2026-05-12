import {Character} from './character'
import {FACTION} from './types'
import {TankTargeting, RandomTargeting} from './targeting-task'
import {SmallAttack, MediumAttack, HugeAttack} from './damage-effect'

export class Nakroth extends Character {
	static maxHealth = 750
	faction = FACTION.ENEMY
	name = 'Nakroth the Destroyer'
	targetingTask = new TankTargeting(this)
	mediumAttack = new MediumAttack(this)
	hugeAttack = new HugeAttack(this)
}

export class TinyWolf extends Character {
	static maxHealth = 240
	faction = FACTION.ENEMY
	name = 'Tiny wolf'
	image = '/assets/generated/characters/tiny-wolf.png'
	targetingTask = new RandomTargeting(this)
	mainhand = new MediumAttack(this)
	offhand = new SmallAttack(this)
}
