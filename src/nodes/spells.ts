import {Ability} from './ability'
import {ApplyAura, Damage, Heal as HealEffect} from './effects'
import {PeriodicAura} from './periodic-aura'
import {BarrierAura} from './barrier-aura'

/**
 * Magical healing abilities opt into mana, cast timing and the global cooldown independently.
 *
 * The healing effect is imported as `HealEffect` only because the first spell below is itself
 * called Heal; everywhere else it is just `Heal`.
 */
export class Heal extends Ability {
	static id = 'Heal'
	static name = 'Heal'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 50
	static castTime = 2000
	static cooldown = 0
	static gcd = true
	static effects = [new HealEffect(0.8)]
}

export class FlashHeal extends Ability {
	static id = 'FlashHeal'
	static name = 'Flash Heal'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 80
	static castTime = 1000
	static cooldown = 0
	static gcd = true
	static effects = [new HealEffect(1)]
}

export class GreaterHeal extends Ability {
	static id = 'GreaterHeal'
	static name = 'Greater Heal'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 100
	static castTime = 3000
	static cooldown = 0
	static gcd = true
	static effects = [new HealEffect(1.45)]
	// Sweet spot experiment (#33): the one line it takes to opt an ability in. A long enough cast
	// to give the default window something to land in; no override needed to try the defaults.
	static sweetSpot = true
}

/** The player's holy ranged attack. Its inherited event type records the hit as spell damage. */
export class Smite extends Ability {
	static id = 'Smite'
	static name = 'Smite'
	static tags = ['spell', 'attack', 'ranged'] as const
	static school = 'holy' as const
	static targetRule = 'enemy' as const
	static cost = 40
	static castTime = 1500
	static cooldown = 0
	static gcd = true
	static effects = [new Damage(0.2)]
}

/**
 * An aura a spell leaves behind is declared before the spell that plants it: `static effects` runs
 * when the class is defined, so a class named further down the file is not there yet.
 */

/** Shares the cast's id so its ticks report as the same ability. */
class RenewAura extends PeriodicAura {
	static id = 'Renew'
	static name = 'Renew'
	static interval = 2000
	static repeat = 5
}

export class Renew extends Ability {
	static id = 'Renew'
	static name = 'Renew'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 60
	static castTime = 0
	static cooldown = 0
	static gcd = true
	static sound = 'spell_rejuvenation'
	// The coefficient sizes the whole heal-over-time, tunable as `effect:Renew.renew`.
	static effects = [new ApplyAura(RenewAura, 1.2)]
}

/** Renew's organic mirror: decay over time instead of life over time. Shares the cast's id. */
class WitherAura extends PeriodicAura {
	static id = 'Wither'
	static name = 'Wither'
	static harms = true
	static interval = 2000
	static repeat = 6
}

export class Wither extends Ability {
	static id = 'Wither'
	static name = 'Wither'
	static tags = ['spell', 'attack', 'ranged'] as const
	static school = 'holy' as const
	static targetRule = 'enemy' as const
	static cost = 40
	static castTime = 0
	static cooldown = 0
	static gcd = true
	static effects = [new ApplyAura(WitherAura, 0.3)]
}

export class Shield extends Ability {
	static id = 'Shield'
	static name = 'Shield'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 60
	static castTime = 0
	static cooldown = 0
	static gcd = true
	// This direct use carries Shield's identity; another barrier ability subclasses BarrierAura.
	// The coefficient is the size of the pool, not healing — nothing here moves a health bar.
	static effects = [new ApplyAura(BarrierAura, 1.5)]
}

/** The shaman's own ability. It is registered like every other ability but not owned by the player. */
export class Mend extends Ability {
	static id = 'Mend'
	static name = 'Mend'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 0
	static castTime = 2500
	static cooldown = 0
	static gcd = true
	static effects = [new HealEffect(1.6)]
}
