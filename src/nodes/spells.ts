import {Spell} from './spell'
import {PeriodicEffect} from './periodic'
import {AudioPlayer} from './audio'

/**
 * Healing per mana is the ladder these four are tuned on, not healing per second:
 * Renew 2.50, Heal 1.60, Greater Heal 1.45, Flash Heal 1.25. The efficient spell is
 * the slow one, so throughput is always bought with mana you will want later.
 */

/** The workhorse. Nothing heals more per mana except a Renew you had time to plant. */
export class Heal extends Spell {
	static name = 'Heal'
	static cost = 50
	static heal = 80
	static castTime = 2000
}

/** The panic button: lands in a second, and wastes the most mana doing it. */
export class FlashHeal extends Spell {
	static name = 'Flash Heal'
	static cost = 80
	static heal = 100
	static castTime = 1000
}

/** Throughput. The only answer to a big deficit, and you pay for it. */
export class GreaterHeal extends Spell {
	static name = 'Greater Heal'
	static cost = 100
	static heal = 145
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
