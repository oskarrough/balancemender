import type {CombatEventType} from '../combatlog'
import {Ability} from './ability'
import {ApplyAura, Damage, Interrupt} from './effects'
import {PeriodicAura} from './periodic-aura'
import {StatModifierAura} from './stat-modifier-aura'
import {STAT} from './stats'

export class Nip extends Ability {
	static id = 'Nip'
	static name = 'Nip'
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

/**
 * A slow, telegraphed leap over the front line at whoever its owner has already picked out. Skulker
 * uses it on the healer and Kite on whoever is worst off — the leap is one shape, and who it lands
 * on is the unit's own preference, not the ability's.
 */
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

/**
 * The bellwether putting its whole weight through whoever is squared up in front of it. The wind-up
 * is the instruction — a barrier fits comfortably inside it, and the hit is big enough that the tank
 * feels the difference. Roha teaches the same "answer the wind-up" lesson two rooms later with
 * sound instead of weight, which is why this one arrives first and only asks for a shield.
 */
export class Trample extends Ability {
	static id = 'Trample'
	static name = 'Trample'
	static tags = ['attack', 'melee'] as const
	static school = 'physical' as const
	static targets = 'enemy' as const
	static castTime = 2000
	static sound = 'combat_strong_punch2'
	static eventType: CombatEventType = 'SWING_DAMAGE'
	static effects = [new Damage(1.8)]
}

/** The sound going on after the bell stops, declared before the toll that leaves it. */
export class Ringing extends PeriodicAura {
	static id = 'Ringing'
	static name = 'Ringing'
	static harms = true
	static interval = 1000
	static repeat = 5
	static delay = 1000
}

/**
 * Roha's bell, and the only thing she does. It leaves a ringing in whoever it was swung at, and its
 * sound cuts every cast on that side of the room — the wound is the tank's, the interruption is the
 * healer's. Telegraphed longer than Haruk's arrow because the wind-up is the whole instruction:
 * stop casting before it, start again after. A rhythm you play around, not a number you outheal.
 */
export class Toll extends Ability {
	static id = 'Toll'
	static name = 'Toll'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'enemy' as const
	static castTime = 2500
	static eventType: CombatEventType = 'SPELL_DAMAGE'
	static effects = [new Interrupt(), new ApplyAura(Ringing, 1.25)]
}

/** A pack buff to strength, declared before the howl that plants it. No modifier of its own — the planting effect sizes it. */
export class Frenzy extends StatModifierAura {
	static id = 'Frenzy'
	static name = 'Frenzy'
	static stat = STAT.STRENGTH
	static lifetime = 8000
}

/** A howl that hands a packmate Frenzy instead of hitting anything itself. */
export class Rile extends Ability {
	static id = 'Rile'
	static name = 'Rile'
	static tags = ['spell'] as const
	static school = 'holy' as const
	static targets = 'ally' as const
	static castTime = 2500
	static effects = [new ApplyAura(Frenzy, 0.12)]
}
