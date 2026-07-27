import {Spell} from './spell'
import {PeriodicEffect} from './periodic'
import {AudioPlayer} from './audio'

/**
 * Healing per mana is the ladder these four are tuned on, not healing per second:
 * Renew 2.00, Heal 1.60, Greater Heal 1.45, Flash Heal 1.25. The patient spell is the
 * efficient one, so throughput is always bought with mana you will want later.
 */

/** The workhorse. Nothing heals more per mana except a Renew you had time to plant. */
export class Heal extends Spell {
	static id = 'Heal'
	static name = 'Heal'
	static cost = 50
	static heal = 80
	static castTime = 2000
}

/** The panic button: lands in a second, and wastes the most mana doing it. */
export class FlashHeal extends Spell {
	static id = 'FlashHeal'
	static name = 'Flash Heal'
	static cost = 80
	static heal = 100
	static castTime = 1000
}

/** Throughput. The only answer to a big deficit, and you pay for it. */
export class GreaterHeal extends Spell {
	static id = 'GreaterHeal'
	static name = 'Greater Heal'
	static cost = 100
	static heal = 145
	static castTime = 3000
}

/**
 * The one you plant before you need it. Renew heals indirectly, by leaving a periodic
 * effect on the target, so `heal` is the total it lands over five ticks rather than a
 * lump — the effect divides it. Keeping the number here and handing it to the effect is
 * what lets the balance lab tune Renew alongside the other three.
 *
 * Note this overrides `cast()` outright: the base class heals when `heal` is set, and
 * calling `super.cast()` from here would land the whole total twice over.
 */
export class Renew extends Spell {
	static id = 'Renew'
	static name = 'Renew'
	static cost = 60
	static heal = 120
	static castTime = 0

	cast() {
		const player = this.parent
		const target = player.getTarget()
		if (target) {
			new RenewEffect(target, player, this.heal)
			AudioPlayer.play('spell_rejuvenation')
		}
	}
}

/**
 * Shares `Renew`'s id deliberately, so the cast and the five ticks it produces report as one
 * spell rather than two things that happen to be spelled the same. This is the one place the
 * "id is the class name" convention is meant to be broken.
 */
class RenewEffect extends PeriodicEffect {
	static id = 'Renew'
	static name = 'Renew'
	static interval = 2000
	static repeat = 5
}
