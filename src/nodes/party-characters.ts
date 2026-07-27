import {Character} from './character'
import {TankAttack} from './attack'
import {FACTION} from './types'
import {TargetOppositeFaction} from './targeting-task'

export class Tank extends Character {
	static maxHealth = 300
	static faction = FACTION.PARTY
	targetingTask = new TargetOppositeFaction(this)
	mainhand = new TankAttack(this)
	name = 'Tank'
	image = '/assets/generated/characters/tank.png'
}

// export class Warrior extends Character {
// 	faction = FACTION.PARTY
// 	health = new Health(this, 600)
// 	targetingTask = new TargetOppositeFaction(this)
// 	mainhand = new WarriorAttack(this)
// 	name = 'Bobowarr'
// }

// export class Rogue extends Character {
// 	faction = FACTION.PARTY
// 	health = new Health(this, 300)
// 	targetingTask = new TargetOppositeFaction(this)
// 	mainhand = new RogueAttack(this)
// 	name = 'Kirsten'
// }
