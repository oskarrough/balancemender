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
	targeting = new Targeting(this, prefer.tankFirst)
	heavyBlowCadence = new HeavyBlowCadence(this)
	nastyArrowCadence = new NastyArrowCadence(this)
}

export class TinyWolf extends Unit {
	static maxHealth = 240
	static faction = FACTION.ENEMY
	name = 'Tiny wolf'
	image = '/assets/generated/characters/tiny-wolf.png'
	abilities = {SavageBite, QuickStab}
	targeting = new Targeting(this, prefer.atRandom)
	savageBiteCadence = new SavageBiteCadence(this)
	quickStabCadence = new QuickStabCadence(this)
}

/**
 * A wolf that mends the pack instead of biting it. Nothing stops it from carrying attacks too —
 * each use is handed its own target, so a bite and a mend no longer compete for one slot — but
 * giving it one is a balance question (#51), not a modelling one.
 */
export class WolfShaman extends Unit {
	static maxHealth = 180
	static faction = FACTION.ENEMY
	name = 'Wolf shaman'
	abilities = {Mend}
	targeting = new Targeting(this, prefer.lowestHealth)
	cadence = new MendCadence(this)
}

export {Mend}
