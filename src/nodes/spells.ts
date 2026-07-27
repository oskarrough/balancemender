import {Spell} from './spell'
import {PeriodicAura} from './periodic-aura'
import {ShieldAura} from './shield-aura'
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
 * aura on the target, so `heal` is the total it lands over five ticks rather than a
 * lump — the aura divides it. Keeping the number here and handing it to the aura is
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
			new RenewAura(target, player, this.heal)
			AudioPlayer.play('spell_rejuvenation')
		}
	}
}

/**
 * Shares `Renew`'s id deliberately, so the cast and the five ticks it produces report as one
 * spell rather than two things that happen to be spelled the same. This is the one place the
 * "id is the class name" convention is meant to be broken.
 */
class RenewAura extends PeriodicAura {
	static id = 'Renew'
	static name = 'Renew'
	static interval = 2000
	static repeat = 5
}

/**
 * The other half of healing: spend a global cooldown *before* the hit so the hit costs less.
 *
 * It is off the healing-per-mana ladder above on purpose — `heal` here is a pool of absorption
 * rather than health restored, and 150 for 60 mana only looks like the best rate in the game
 * while every point of it is spent. A shield planted on nobody in danger is worth nothing at all,
 * which is the trade the spell is actually made of. It lasts 15s — `ShieldAura.lifetime`.
 *
 * Overrides `cast()` outright for the same reason `Renew` does: the base class heals when `heal`
 * is set, so calling `super.cast()` here would land 150 direct healing alongside the shield.
 */
export class PowerWordShield extends Spell {
	static id = 'PowerWordShield'
	static name = 'Power Word: Shield'
	static cost = 60
	static heal = 150
	static castTime = 0
	// TODO no shield art yet — this wants `public/assets/generated/spells/power-word-shield.png`,
	// which is the slug `SpellIcon` derives from the name. Renew's stands in until it exists.
	static icon = 'renew'

	cast() {
		const player = this.parent
		const target = player.getTarget()
		if (target) {
			new PowerWordShieldAura(target, player, this.heal)
			AudioPlayer.play('spell_cast')
		}
	}
}

/** Shares the spell's id, so the cast and every absorb it pays for report as one thing — see `RenewAura`. */
class PowerWordShieldAura extends ShieldAura {
	static id = 'PowerWordShield'
	static name = 'Power Word: Shield'
}
