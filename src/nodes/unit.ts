import {Node} from 'vroum'
import {Health, HEALTH_EVENTS} from './health'
import {Mana} from './mana'
import type {Encounter} from './encounter'
import type {PeriodicAura} from './periodic-aura'
import {createId, log} from '../utils'
import {Faction, FACTION, Condition, CONDITION_THRESHOLDS} from './types'
import type {UnitId} from './unit-registry'
import type {Spell} from './spell'
import type {GlobalCooldown} from './global-cooldown'
import {SpellCast} from './spell-cast'

export type Aura = PeriodicAura
export type {Faction} from './types'
export {FACTION} from './types'
export {CONDITION_THRESHOLDS} from './types'
export type {Condition} from './types'

/**
 * Base unit class. Subclasses declare `static maxHealth = N` and the
 * base constructor wires up the Health node — defining `health` as a field
 * initializer in a subclass would create (and orphan) a second one.
 */
export class Unit extends Node {
	readonly id: string
	static maxHealth = 100
	/** Which side this unit fights on. Static so the registry can be read without spawning anyone. */
	static faction: Faction = FACTION.ENEMY

	name = ''
	image = ''
	/** The registry id this unit was spawned from. Survives minification; `constructor.name` does not. */
	unitId?: UnitId
	/** `name` before duplicate numbering, so renumbering stays idempotent. */
	baseName?: string
	health: Health
	mana?: Mana
	auras = new Set<Aura>()
	faction: Faction = (this.constructor as typeof Unit).faction
	currentTarget?: Unit

	/**
	 * Still standing. This — not membership of `encounter.party`/`enemies` — is who is in the
	 * fight: the dead stay in those arrays. See `Encounter.onDeath()`.
	 */
	get alive() {
		return this.health.current > 0
	}

	/**
	 * Which band of its health bar this unit is in — the primitive a spell that cares about how
	 * hurt someone is reads, instead of writing its own percentage.
	 *
	 * A pure function of health, with no memory: no hysteresis, no latch. That is what keeps it
	 * safe to ask anywhere and testable in isolation, and it is what would break the moment a
	 * threshold became tunable mid-fight against a stored state.
	 *
	 * Compared through `ratio` rather than by cross-multiplying `current * 100`: multiplying an
	 * already-inexact health value pushes a unit sitting exactly on a threshold across it — 305
	 * times over the first 2000 max-health values, against none this way.
	 */
	get condition(): Condition {
		const percent = this.health.ratio * 100
		if (percent < CONDITION_THRESHOLDS.injured) return 'injured'
		if (percent > CONDITION_THRESHOLDS.healthy) return 'healthy'
		return 'steady'
	}

	/**
	 * Orthogonal to `alive`, deliberately: a corpse sits at 0% and so reads `injured`. Every
	 * consumer in the game already filters the dead before asking anything else, and a fourth
	 * `'dead'` condition would be a second source of truth for what `alive` already owns.
	 */
	get injured() {
		return this.condition === 'injured'
	}

	get healthy() {
		return this.condition === 'healthy'
	}

	getTarget(): Unit | undefined {
		return this.currentTarget?.alive ? this.currentTarget : undefined
	}

	/**
	 * What this unit can cast. Empty for most of them — a wolf's abilities are attacks, and an
	 * attack is an `Attack` with its own timing welded in rather than a spellbook entry
	 * something has to choose. Nothing about biting being physical keeps it out of here; the weld
	 * does.
	 *
	 * Deliberately not the spell registry: that is the *player's* spellbook, and reading it from
	 * here would close the import loop `unit → registry → spells → spell → unit`. Each
	 * caster names its own; `Player` assigns `spellRegistry`.
	 *
	 * Keyed by each spell's `id`, never its display name — `{Mend}` shorthand is only correct
	 * because that is what the key means.
	 */
	spellbook: Record<string, typeof Spell> = {}

	/**
	 * Casting state. On `Unit` rather than `Player` because nothing about it is the player's:
	 * a cast is a thing with a cast time, a mana cost and a global cooldown, and an enemy that
	 * casts needs every one of them. What stays player-only is *deciding* — the keyboard and the
	 * autopilot on one side, a `Cadence` task on the other.
	 */
	lastCastTime = 0
	lastCastCompletedTime = 0
	spell: Spell | undefined
	gcd: GlobalCooldown | undefined

	/**
	 * When each spell comes off its own cooldown, in fight-clock ms, keyed by spell id.
	 *
	 * Expiry stamps rather than a Task per spell: vroum defers `connect()` to a microtask, so a
	 * cooldown Task started during a cast is not mounted yet when something asks about it in the
	 * same tick. Storing when it ends also means retuning a cooldown mid-fight leaves the one
	 * already running alone, as the rest of balance does. A fight gets fresh units, so there is
	 * nothing to reset between them.
	 */
	cooldowns = new Map<string, number>()

	/** The primitive `perform({type: 'cast'})` composes. Returns why it refused, if it did. */
	castSpell(spellId: string) {
		return SpellCast.cast(this, spellId)
	}

	constructor(public parent: Encounter) {
		super(parent)
		this.id = createId()
		this.health = new Health(this, (this.constructor as typeof Unit).maxHealth)
		this.health.on(HEALTH_EVENTS.EMPTY, this.onHealthEmpty)
	}

	/**
	 * Dying is the encounter's business, not the unit's. This used to call `this.disconnect()`,
	 * which left the corpse half in and half out: vroum's teardown nulls `parent`, but the unit
	 * stayed in `encounter.party`, so anything that walked that array and reached back up the
	 * tree — `Player.getTarget()` reads `this.parent.tank` — threw from the first death onwards.
	 */
	private onHealthEmpty = () => {
		log(`${this.name} is dead`)
		this.parent.onDeath(this)
	}

	damage(amount: number) {
		return this.health.damage(amount)
	}
}
