import {Task} from 'vroum'
import {applyStatics, log} from '../utils'
import {Character} from './character'

/**
 * Casts a spell at a fixed interval. This is the enemy-side stand-in for the player pressing a
 * key — a driver, and the only thing it contributes is *when*.
 *
 * The split is worth stating, because the obvious reading — that enemies cast differently from
 * the player — is wrong. Casting itself is entirely shared: `Character` owns the spellbook, the
 * global cooldown, the cooldown stamps and the cast in progress, and `SpellCast` refuses for the
 * same seven reasons whoever is asking. What differs is only *who decides*, and the two answers
 * are genuinely different in kind — the player has a keyboard and an `Autopilot` weighing the
 * fight, an enemy has a clock.
 *
 * That mirrors how attacking already works, except that an attack carries its own interval and a
 * cast cannot: `DamageEffect` is a swing and its schedule welded together, while this is the
 * schedule on its own. Unwelding the two is what would let one driver run both — see the glossary.
 * A unit wanting real decisions overrides `chooses()` rather than growing a policy system it does
 * not need.
 *
 * Named for the interval and not for the casting, because `caster` already means "whoever is
 * casting" everywhere else — this class holds no casting logic at all.
 */
export class Cadence extends Task {
	/** Which spell, by the id it is filed under in the caster's own `spellbook`. */
	spell = ''
	/** How long before the first cast. Enemies open with their attacks, not their tricks. */
	delay = 4000
	interval = 8000
	repeat = Infinity

	static spell = ''
	static delay = 4000
	static interval = 8000

	constructor(public parent: Character) {
		super(parent)
		applyStatics(this, 'spell', 'delay', 'interval')
	}

	/**
	 * Whether to cast at all this time round. Always, by default — the interval is the whole
	 * decision. Override for a unit that should read the fight before committing a cast.
	 */
	chooses() {
		return true
	}

	/**
	 * The refusals `SpellCast` would give anyway are checked here too, so a blocked cast does not
	 * burn the cycle: the task simply tries again on its next tick rather than going quiet until
	 * the interval comes round.
	 */
	shouldTick() {
		return this.parent.alive && !this.parent.spell && !this.parent.gcd
	}

	tick() {
		if (!this.chooses()) return
		const result = this.parent.castSpell(this.spell)
		// Refusals are ordinary here — no target, still on cooldown — so this is a log line and
		// not an error. `perform()` is where a caller that wants to know gets told.
		if (!result.ok) log(`caster:${this.parent.name}:${this.spell}:${result.error}`)
	}
}
