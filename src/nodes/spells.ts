import {Spell} from './spell'
import {PeriodicEffect} from './periodic'
import {AudioPlayer} from './audio'

export class Heal extends Spell {
	static name = 'Heal'
	static cost = 50
	static heal = 75
	static castTime = 2000
}

export class FlashHeal extends Spell {
	static name = 'Flash Heal'
	static cost = 75
	static heal = 100
	static castTime = 1000
}

export class GreaterHeal extends Spell {
	static name = 'Greater Heal'
	static cost = 100
	static heal = 150
	static castTime = 3000
}

/** Renew heals indirectly, by leaving a periodic effect on the target. */
export class Renew extends Spell {
	static name = 'Renew'
	static cost = 60
	static castTime = 0

	cast() {
		const player = this.parent
		const target = player.getTarget()
		if (target) {
			new RenewEffect(target, player)
			AudioPlayer.play('spell_rejuvenation')
		}
	}
}

class RenewEffect extends PeriodicEffect {
	static name = 'Renew'
	static amount = 30
	static interval = 2000
	static repeat = 5
}
