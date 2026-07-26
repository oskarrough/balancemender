import {Character} from './character'
import {TankAttack} from './damage-effect'
import {FACTION} from './types'
import {TargetOppositeFaction} from './targeting-task'

export class Tank extends Character {
	static maxHealth = 300
	static faction = FACTION.PARTY
	targetingTask = new TargetOppositeFaction(this)
	attackEffect = new TankAttack(this)
	name = 'Tank'
	image = '/assets/generated/characters/tank.png'
}

// export class Warrior extends Character {
// 	faction = FACTION.PARTY
// 	health = new Health(this, 600)
// 	targetingTask = new TargetOppositeFaction(this)
// 	attackEffect = new WarriorAttack(this)
// 	name = 'Bobowarr'
// }

// export class Rogue extends Character {
// 	faction = FACTION.PARTY
// 	health = new Health(this, 300)
// 	targetingTask = new TargetOppositeFaction(this)
// 	attackEffect = new RogueAttack(this)
// 	name = 'Kirsten'
// }
