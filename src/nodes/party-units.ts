import {Unit} from './unit'
import {TankAttack} from './attack'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'

export class Tank extends Unit {
	static maxHealth = 300
	static faction = FACTION.PARTY
	targeting = new Targeting(this, 'enemy', prefer.first)
	mainhand = new TankAttack(this)
	name = 'Tank'
	image = '/assets/generated/characters/tank.png'
}

// export class Warrior extends Unit {
// 	faction = FACTION.PARTY
// 	health = new Health(this, 600)
// 	targeting = new Targeting(this, 'enemy', prefer.first)
// 	mainhand = new WarriorAttack(this)
// 	name = 'Bobowarr'
// }

// export class Rogue extends Unit {
// 	faction = FACTION.PARTY
// 	health = new Health(this, 300)
// 	targeting = new Targeting(this, 'enemy', prefer.first)
// 	mainhand = new RogueAttack(this)
// 	name = 'Kirsten'
// }
