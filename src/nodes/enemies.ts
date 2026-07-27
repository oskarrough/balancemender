import {Unit} from './unit'
import {FACTION} from './types'
import {Targeting, prefer} from './targeting'
import {NastyArrow, HeavyBlow, QuickStab, SavageBite} from './attack'
import {Mend} from './spells'
import {NastyArrowCadence, HeavyBlowCadence, MendCadence, QuickStabCadence, SavageBiteCadence} from './cadence'

export class Nakroth extends Unit {
	static maxHealth = 500
	static faction = FACTION.ENEMY
	name = 'Nakroth the Destroyer'
	abilities = {HeavyBlow, NastyArrow}
	targeting = new Targeting(this, 'enemy', prefer.tankFirst)
	heavyBlowCadence = new HeavyBlowCadence(this)
	nastyArrowCadence = new NastyArrowCadence(this)
}

export class TinyWolf extends Unit {
	static maxHealth = 240
	static faction = FACTION.ENEMY
	name = 'Tiny wolf'
	image = '/assets/generated/characters/tiny-wolf.png'
	abilities = {SavageBite, QuickStab}
	targeting = new Targeting(this, 'enemy', prefer.atRandom)
	savageBiteCadence = new SavageBiteCadence(this)
	quickStabCadence = new QuickStabCadence(this)
}

/**
 * A wolf that mends the pack instead of biting it. It has one target, spent on allies; a unit that
 * both attacks and heals still needs explicit targeting, which belongs to #56.
 */
export class WolfShaman extends Unit {
	static maxHealth = 180
	static faction = FACTION.ENEMY
	name = 'Wolf shaman'
	abilities = {Mend}
	targeting = new Targeting(this, 'ally', prefer.lowestHealth)
	cadence = new MendCadence(this)
}

export {Mend}
