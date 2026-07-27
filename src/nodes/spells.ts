import {Ability} from './ability'
import {PeriodicAura} from './periodic-aura'
import {ShieldAura} from './shield-aura'
import {AudioPlayer} from './audio'

/** Magical healing abilities opt into mana, cast timing and the global cooldown independently. */
export class Heal extends Ability {
	static id = 'Heal'
	static name = 'Heal'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 50
	static heal = 80
	static castTime = 2000
	static cooldown = 0
	static gcd = true
}

export class FlashHeal extends Ability {
	static id = 'FlashHeal'
	static name = 'Flash Heal'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 80
	static heal = 100
	static castTime = 1000
	static cooldown = 0
	static gcd = true
}

export class GreaterHeal extends Ability {
	static id = 'GreaterHeal'
	static name = 'Greater Heal'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 100
	static heal = 145
	static castTime = 3000
	static cooldown = 0
	static gcd = true
}

export class Renew extends Ability {
	static id = 'Renew'
	static name = 'Renew'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 60
	static heal = 120
	static castTime = 0
	static cooldown = 0
	static gcd = true

	effect() {
		const target = this.target
		if (target) {
			new RenewAura(target, this.parent, this.heal)
			AudioPlayer.play('spell_rejuvenation')
		}
	}
}

/** Shares the cast's id so its ticks report as the same ability. */
class RenewAura extends PeriodicAura {
	static id = 'Renew'
	static name = 'Renew'
	static interval = 2000
	static repeat = 5
}

export class PowerWordShield extends Ability {
	static id = 'PowerWordShield'
	static name = 'Power Word: Shield'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 60
	static heal = 150
	static castTime = 0
	static cooldown = 0
	static gcd = true
	static icon = 'renew'

	effect() {
		const target = this.target
		if (target) {
			new PowerWordShieldAura(target, this.parent, this.heal)
			AudioPlayer.play('spell_cast')
		}
	}
}

/** Shares the cast's id so absorption reports as the same ability. */
class PowerWordShieldAura extends ShieldAura {
	static id = 'PowerWordShield'
	static name = 'Power Word: Shield'
}

/** The shaman's own ability. It is registered like every other ability but not owned by the player. */
export class Mend extends Ability {
	static id = 'Mend'
	static name = 'Mend'
	static tags = ['spell', 'healing'] as const
	static school = 'holy' as const
	static targetRule = 'ally' as const
	static cost = 0
	static heal = 80
	static castTime = 2500
	static cooldown = 0
	static gcd = true
}
