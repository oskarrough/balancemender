import {Character} from './character'
import {FACTION} from './types'
import {TankTargeting, RandomTargeting, MostHurtAlly} from './targeting-task'
import {SmallAttack, MediumAttack, WolfBite, HugeAttack} from './attack'
import {Spell} from './spell'
import {Cadence} from './cadence'

export class Nakroth extends Character {
	static maxHealth = 500
	static faction = FACTION.ENEMY
	name = 'Nakroth the Destroyer'
	targetingTask = new TankTargeting(this)
	mediumAttack = new MediumAttack(this)
	hugeAttack = new HugeAttack(this)
}

export class TinyWolf extends Character {
	static maxHealth = 240
	static faction = FACTION.ENEMY
	name = 'Tiny wolf'
	image = '/assets/generated/characters/tiny-wolf.png'
	targetingTask = new RandomTargeting(this)
	mainhand = new WolfBite(this)
	offhand = new SmallAttack(this)
}

/**
 * The enemy's own heal, and the first spell in the game nothing on the party's side can cast.
 *
 * Costs nothing because enemies have no mana pool — `SpellCast` skips the mana check when the
 * caster has none, so the limiter is the caster's `interval`, exactly as an `Attack`'s
 * interval limits a swing. Give it a `cost` the day an enemy gets a resource to spend.
 */
export class Mend extends Spell {
	static id = 'Mend'
	static name = 'Mend'
	static cost = 0
	static heal = 80
	static castTime = 2500
}

/**
 * A wolf that mends the pack instead of biting it, and the reason enemy casting exists.
 *
 * It carries no attacks at all, which is the point rather than an omission: a unit has one
 * `currentTarget`, and this one spends it on the ally it is healing. A wolf that both bit and
 * healed would need two, and inventing that before anything wants it would be guessing.
 *
 * The 2500ms cast time is what makes it a fight rather than a sponge — it is the longest cast in
 * the game, it is announced by `SPELL_CAST_START` in the log, and it is the hook an interrupt
 * hangs on the day there is one (`SPELL_CAST_INTERRUPTED` is already logged and has never fired).
 * Until then the answer is to kill it first, which is a targeting decision the player does not
 * currently get to make — see #42.
 */
export class WolfShaman extends Character {
	static maxHealth = 180
	static faction = FACTION.ENEMY
	name = 'Wolf shaman'
	targetingTask = new MostHurtAlly(this)
	spellbook = {Mend}
	cadence = new MendCadence(this)
}

/** Which spell, how often. Statics so the cadence is a tunable like every other number. */
export class MendCadence extends Cadence {
	static spell = 'Mend'
	static delay = 4000
	static interval = 8000
}
