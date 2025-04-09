import {Character} from './character'
import {Health} from './health'
import {FACTION} from './types'
import {TankTargeting, RandomTargeting} from './targeting-task'
import {SmallAttack, MediumAttack, HugeAttack} from './damage-effect'

export class Nakroth extends Character {
	faction = FACTION.ENEMY
	name = 'Nakroth the Destroyer'
	health = new Health(this, 750)
	targetingTask = new TankTargeting(this)
	mediumAttack = new MediumAttack(this)
	hugeAttack = new HugeAttack(this)
}

export class Imp extends Character {
	faction = FACTION.ENEMY
	name = 'Annoying Imp'
	health = new Health(this, 400)
	targetingTask = new RandomTargeting(this)
	// attackEffect = new SmallAttack(this)
}
