import {Unit} from './unit'
import {TankAttack} from './attack'
import {TankAttackCadence} from './cadence'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'

export class Tank extends Unit {
	static maxHealth = 300
	static faction = FACTION.PARTY
	abilities = {TankAttack}
	targeting = new Targeting(this, 'enemy', prefer.first)
	tankAttackCadence = new TankAttackCadence(this)
	name = 'Tank'
	image = '/assets/generated/characters/tank.png'
}
