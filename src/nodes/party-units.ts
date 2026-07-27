import {Unit} from './unit'
import {ShieldBash} from './attack'
import {ShieldBashCadence} from './cadence'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'

export class Tank extends Unit {
	static maxHealth = 300
	static faction = FACTION.PARTY
	abilities = {ShieldBash}
	targeting = new Targeting(this, 'enemy', prefer.first)
	shieldBashCadence = new ShieldBashCadence(this)
	name = 'Tank'
	image = '/assets/generated/characters/tank.png'
}
