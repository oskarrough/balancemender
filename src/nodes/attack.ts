import type {CombatEventType} from '../combatlog'
import {Ability} from './ability'
import {ApplyAura, Damage} from './effects'
import {PeriodicAura} from './periodic-aura'
import {StatModifierAura} from './stat-modifier-aura'
import {STAT} from './stats'

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

/**
 * The pup's leap. A cast time is the whole point: it puts a bar on the pup's own unit frame, so the
 * hit is one the player watched coming and chose what to do about. Big enough that ignoring it
 * twice in a row is fatal, slow enough that answering it is always possible — the first room's
 * lesson is that a telegraph is an instruction.
 */
export class Pounce extends Ability {
	static id = 'Pounce'
	static name = 'Pounce'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 1500
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(3.5)]
}

export class NastyArrow extends Ability {
	static id = 'NastyArrow'
	static name = 'Nasty Arrow'
	static tags = ['attack', 'ranged'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2000
	static sound = 'combat_arrow'
	static eventType: CombatEventType = 'RANGE_DAMAGE'
	static effects = [new Damage(2.8)]
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

/**
 * The wound Worry leaves, declared before it: `static effects` runs when the class is defined.
 */
export class Gash extends PeriodicAura {
	static id = 'Gash'
	static name = 'Gash'
	static harms = true
	static interval = 1000
	static repeat = 6
	static delay = 1000
}

/** A bite that gnaws rather than tears — the wound outlasts most of a fight's beats. */
export class Worry extends Ability {
	static id = 'Worry'
	static name = 'Worry'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(0.3), new ApplyAura(Gash, 2.8)]
}

/** A slow, telegraphed leap that ignores the tank and runs down whoever it caught looking away. */
export class Ambush extends Ability {
	static id = 'Ambush'
	static name = 'Ambush'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2000
	static sound = 'combat_strong_punch'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(2.5)]
}

/** A pack buff to strength, declared before the howl that plants it. No modifier of its own — the planting effect sizes it. */
export class Frenzy extends StatModifierAura {
	static id = 'Frenzy'
	static name = 'Frenzy'
	static stat = STAT.STRENGTH
	static lifetime = 8000
}

/** A howl that hands a packmate Frenzy instead of hitting anything itself. */
export class Bloodhowl extends Ability {
	static id = 'Bloodhowl'
	static name = 'Bloodhowl'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static castTime = 2500
	static effects = [new ApplyAura(Frenzy, 0.12)]
}
