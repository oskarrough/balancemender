import {Node} from '../vroum'
import {Health, HEALTH_EVENTS} from './health'
import {Mana} from './mana'
import type {Fight} from './fight'
import type {Aura} from './aura'
import {createId, log} from '../utils'
import {Faction, FACTION, Condition, CONDITION_THRESHOLDS} from './types'
import type {UnitId} from './unit-registry'
import type {Ability, AbilityClass} from './ability'
import type {GlobalCooldown} from './global-cooldown'
import type {GameLoop} from './game-loop'
import type {Targeting} from './targeting'
import {AbilityUse} from './ability-use'
import type {ThreatTable} from './threat'
import {Stats, type Stat} from './stats'

/**
 * Base unit class. Subclasses declare their base stats and the constructor derives the resource
 * nodes from them — defining `health` as a field initializer in a subclass would create (and
 * orphan) a second one.
 */
export class Unit extends Node {
	readonly id: string
	static stamina = 100
	static intellect = 0
	static strength = 0
	static agility = 0
	static spirit = 0
	/** The side this class uses unless a spawn overrides it. */
	static faction: Faction = FACTION.ENEMY
	/** A named opponent the fight is about. Only the narration reads it, so far. */
	static boss = false
	/**
	 * Auras an instance field constructs straight onto this unit (`shell = new SapShell(this,
	 * this)`), as opposed to one an ability plants. `balance.ts` walks this the same way it walks
	 * `Ability.effects` for planted auras, so a worn one is tunable through the same door.
	 */
	static wornAuras: (typeof Aura)[] = []

	name = ''
	image = ''
	/** The registry id this unit was spawned from. Survives minification; `constructor.name` does not. */
	unitId?: UnitId
	/** `name` before duplicate numbering, so renumbering stays idempotent. */
	baseName?: string
	readonly stats: Stats
	health: Health
	mana?: Mana
	auras = new Set<Aura>()
	/** The side this instance fights on. */
	faction: Faction
	/**
	 * How this unit's standing drivers choose among the units an ability may land on. A preference
	 * and its settled picks. The UI may read a pick for target-of-target, but only a driver changes
	 * it. The player has none: the keyboard is its own driver.
	 */
	targeting?: Targeting
	/**
	 * What this unit currently thinks of each opposing unit. Enemy units get a table by default;
	 * authored threat targeting can opt in on either faction.
	 */
	threat?: ThreatTable

	/**
	 * Still standing. This — not membership of `fight.party`/`enemies` — is who is in the
	 * fight: the dead stay in those arrays. See `Fight.onDeath()`.
	 */
	get alive() {
		return this.health.current > 0
	}

	/**
	 * Which band of its health bar this unit is in — what an ability reads instead of writing its
	 * own percentage.
	 *
	 * A pure function of health, with no memory: no hysteresis, no latch. That is what keeps it
	 * safe to ask anywhere, and what a threshold tunable mid-fight would break if it were compared
	 * against a stored state.
	 *
	 * Through `ratio`, not `current * 100`: multiplying an already-inexact health value pushes a
	 * unit sitting exactly on a threshold across it.
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

	/** Every ability this unit may use, keyed by stable ability id. Display names never enter lookup. */
	abilities: Record<string, AbilityClass> = {}

	/** Only abilities opting into cast time or GCD occupy this slot; ordinary attacks never do. */
	lastCastTime = 0
	lastCastCompletedTime = 0
	currentAbility: Ability | undefined
	gcd: GlobalCooldown | undefined

	/** Cooldown expiry stamps in fight-clock ms, keyed by stable ability id. */
	cooldowns = new Map<string, number>()

	/**
	 * The neutral primitive every driver uses. The target belongs to this one use: whoever decided
	 * to act also decided who it lands on, and hands both over together.
	 */
	useAbility(abilityId: string, target?: Unit) {
		return AbilityUse.use(this, abilityId, target)
	}

	/**
	 * Cut whatever this unit is casting, whether it changed its own mind or something rang a bell at
	 * it. Disconnecting the ability is what logs `SPELL_CAST_INTERRUPTED`, and the mana was never
	 * taken — only a cast that completes is charged, so a cut one costs time alone. Returns false
	 * when there was nothing to cut.
	 */
	stopCasting() {
		const {currentAbility, gcd} = this
		if (!currentAbility) return false
		// Both slots are read before either disconnect, because finishing the cast clears `gcd`
		// out from under us and would leave the cooldown task running with nobody holding it.
		currentAbility.disconnect()
		gcd?.disconnect()
		this.currentAbility = undefined
		this.gcd = undefined
		;(this.root as GameLoop).audio.play('spell_fizzle')
		return true
	}

	constructor(
		public parent: Fight,
		faction?: Faction,
	) {
		super(parent)
		this.id = createId()
		const bases = this.constructor as typeof Unit
		this.faction = faction ?? bases.faction
		this.stats = new Stats({
			stamina: bases.stamina,
			intellect: bases.intellect,
			strength: bases.strength,
			agility: bases.agility,
			spirit: bases.spirit,
		})
		this.health = new Health(this, this.stats.maxHealth)
		this.health.on(HEALTH_EVENTS.EMPTY, this.onHealthEmpty)
		if (this.faction === FACTION.ENEMY) this.ensureThreatTable()
	}

	/** Return this unit's threat table, creating it from the current opposing side when needed. */
	ensureThreatTable() {
		const opposing = this.faction === FACTION.PARTY ? this.parent.enemies : this.parent.party
		return (this.threat ??= new Map(opposing.map((unit) => [unit, 0] as const)))
	}

	setBaseStat(stat: Stat, value: number) {
		this.stats.setBase(stat, value)
		this.syncDerivedStats()
	}

	addStatModifier(owner: object, stat: Stat, amount: number) {
		this.stats.addModifier(owner, stat, amount)
		this.syncDerivedStats()
	}

	removeStatModifier(owner: object) {
		if (this.stats.removeModifier(owner)) this.syncDerivedStats()
	}

	/**
	 * A higher maximum grants no free health or mana. A lower one only clamps what no longer fits,
	 * matching the live Balance Lab's existing retune rule.
	 */
	private syncDerivedStats() {
		this.health.max = this.stats.maxHealth
		if (this.health.current > this.health.max) this.health.set(this.health.max)

		if (!this.mana) return
		this.mana.max = this.stats.maxMana
		if (this.mana.current > this.mana.max) this.mana.set(this.mana.max)
		this.mana.regen.regenRate = this.stats.manaRegen
	}

	/**
	 * Dying is the fight's business, not the unit's. This used to call `this.disconnect()`,
	 * which left the corpse half in and half out: vroum's teardown nulls `parent`, but the unit
	 * stayed in `fight.party`, so anything that walked that array and reached back up the
	 * tree — including `Player.intendedTarget` — threw from the first death onwards.
	 */
	private onHealthEmpty = () => {
		log(`${this.name} is dead`)
		this.parent.onDeath(this)
	}
}
