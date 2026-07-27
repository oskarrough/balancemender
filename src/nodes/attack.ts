import type {CombatEventType} from '../combatlog'
import {Ability} from './ability'
import {PeriodicAura} from './periodic-aura'
import type {Unit} from './unit'

export class SmallAttack extends Ability {
	static id = 'SmallAttack'
	static name = 'Quick Stab'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targetRule = 'enemy' as const
	static minDamage = 5
	static maxDamage = 7
	static sound = 'combat_air_hit'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

export class MediumAttack extends Ability {
	static id = 'MediumAttack'
	static name = 'Heavy Blow'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targetRule = 'enemy' as const
	static minDamage = 15
	static maxDamage = 20
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}

/** The wolf's bite: one immediate hit followed by a short, refreshing wound. */
export class WolfBite extends Ability {
	static id = 'WolfBite'
	static name = 'Savage Bite'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targetRule = 'enemy' as const
	static minDamage = 4
	static maxDamage = 7
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'

	protected afterUse(target: Unit) {
		// The hit may have killed the target and cancelled its auras. Do not plant one afterwards.
		if (target.alive) new WolfBleed(target, this.parent)
	}
}

/**
 * The bleed keeps the bite's id-independent report identity (`Rend`) and waits one full interval
 * before its first tick, so refreshing it does not turn half the wound into immediate damage.
 */
export class WolfBleed extends PeriodicAura {
	static id = 'Rend'
	static name = 'Rend'
	static total = -8
	static interval = 1000
	static repeat = 4
	static delay = 1000
}

export class HugeAttack extends Ability {
	static id = 'HugeAttack'
	static name = 'Nasty arrow'
	static tags = ['attack', 'ranged'] as const
	static school = 'physical' as const
	static targetRule = 'enemy' as const
	static minDamage = 120
	static maxDamage = 180
	static sound = 'combat_arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
}

export class TankAttack extends Ability {
	static id = 'TankAttack'
	static name = 'Shield Bash'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targetRule = 'enemy' as const
	static minDamage = 16
	static maxDamage = 24
	static sound = 'combat_sword_hit'
	static eventType: CombatEventType = 'SWING_DAMAGE'
}
