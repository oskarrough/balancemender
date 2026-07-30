import type {CombatEventType} from '../combatlog'
import {Ability} from './ability'
import {ApplyAura, Damage} from './effects'
import {PeriodicAura} from './periodic-aura'

export class QuickStab extends Ability {
	static id = 'QuickStab'
	static name = 'Quick Stab'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_air_hit'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.3)]
}

export class HeavyBlow extends Ability {
	static id = 'HeavyBlow'
	static name = 'Heavy Blow'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.35)]
}

/**
 * The wound a bite leaves. It waits one full interval before its first tick, so refreshing it does
 * not turn half the wound into immediate damage.
 *
 * Declared before the bite that plants it: `static effects` runs when the class is defined.
 */
export class Rend extends PeriodicAura {
	static id = 'Rend'
	static name = 'Rend'
	static harms = true
	static interval = 1000
	static repeat = 4
	static delay = 1000
}

/** The wolf's bite: one immediate hit followed by a short, refreshing wound. */
export class SavageBite extends Ability {
	static id = 'SavageBite'
	static name = 'Savage Bite'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	// The bite lands first, and the wound only if it left something alive to bleed. Two outcomes,
	// each with its own size: `effect:SavageBite.damage` and `effect:SavageBite.rend`.
	static effects = [new Damage(0.275), new ApplyAura(Rend, 0.48)]
}

export class NastyArrow extends Ability {
	static id = 'NastyArrow'
	static name = 'Nasty Arrow'
	static tags = ['attack', 'ranged'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
	static effects = [new Damage(3)]
}

export class ShieldBash extends Ability {
	static id = 'ShieldBash'
	static name = 'Shield Bash'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static threatMultiplier = 5
	static sound = 'combat_sword_hit'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.5)]
}
