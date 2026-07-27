import {Task} from 'vroum'
import {applyStatics, log} from '../utils'
import {logCombat} from '../combatlog'
import {applyHit} from './hit'
// Type-only both ways: character.ts names this class for its `auras` set.
import type {Character} from './character'

/**
 * Something that lands in instalments — a heal over time, a poison, a bleed.
 *
 * There is deliberately no separate HOT and DoT class: once the health change itself moved
 * into `applyHit`, the only thing left that differed between them was the sign of `total`.
 *
 * The stack rule (`maxStacks`, `stackKey`, `mount`, `supersede`) is about an aura's presence
 * on a unit, not about ticking, so it moves up wholesale the day a non-periodic aura — a
 * shield, a buff — needs an `Aura` base class. Keep it separable.
 */
export class PeriodicAura extends Task {
	id = 'Periodic'
	name = 'Periodic'
	/**
	 * What the aura lands over its whole life, not per tick — each tick applies
	 * `total / repeat`. Negative hurts. Named for the whole because reading it as a
	 * per-tick number is exactly how Renew came to heal a fifth of what it claimed.
	 */
	total = 0
	interval = 3000
	repeat = 5
	/**
	 * How long before the first tick. Zero means the next frame — `interval` is the gap *between*
	 * ticks, so by default an aura lands one instalment the moment it is applied and its last
	 * one an interval before its life is up.
	 *
	 * Set it to `interval` for the Classic behaviour, where a freshly applied aura waits a full
	 * tick before doing anything. That matters most for an aura refreshed faster than it
	 * expires: with no delay, every reapplication buys an immediate instalment, so a rapidly
	 * refreshed aura is partly a direct hit wearing a periodic's name.
	 */
	delay = 0
	/**
	 * How many copies of this aura one target can carry at once. `1` is a refresh: recasting
	 * replaces what is there and the duration starts over, which is Classic Renew and Classic
	 * Shadow Word: Pain. Higher stacks — each cast adds a copy, and past the cap the one closest
	 * to expiring falls off.
	 *
	 * The default is 1 because unbounded stacking is not a design, it is the absence of one:
	 * Renew is instant and the GCD is 1500ms, so uncapped it is 80 healing a second at the best
	 * heal-per-mana in the game, and the ladder in `spells.ts` — where throughput is supposed to
	 * cost efficiency — stops meaning anything. Raise it deliberately, and give the Nth cast a
	 * reason to differ from the first (a bloom on expiry, diminishing stacks) or a stack is only
	 * a multiplier with extra bookkeeping.
	 */
	maxStacks = 1

	casterName = ''
	casterId = ''

	/** Replaced by a fresh copy rather than run out. See `supersede`. */
	superseded = false

	/**
	 * Already torn down. vroum's `disconnect()` is not idempotent — it queues `_runDestroy`
	 * unconditionally, and the second run finds `root` reset to the node itself and throws from
	 * `Task.destroy`'s `this.root._kill(this)`.
	 *
	 * Auras are the one node type several unrelated callers can reach: `supersede()` when a
	 * fresh copy lands, `Encounter.onDeath()` when the unit carrying it falls. Neither can know
	 * about the other, so the guard belongs here rather than at every call site.
	 */
	private detached = false

	/**
	 * Stable key — `balance.auras`, `--tune`, the log's `abilityId`, the stack key. See
	 * `Spell.id`. An aura a spell owns takes that spell's id (`Renew`) so the cast and the ticks
	 * report as one thing; a free-standing one keeps its own (`Rend`).
	 */
	static id = 'Periodic'
	/** Display only. */
	static name = 'Periodic'
	static total = 0
	static interval = 3000
	static repeat = 5
	static delay = 0
	static maxStacks = 1

	/**
	 * `parent` is the unit it lands on; `caster` is who to credit it to. `total` overrides the
	 * class default, so a spell can own its own number — see `Renew`, which keeps it on the
	 * spell where the balance lab can reach it.
	 */
	constructor(
		public parent: Character,
		public caster: Character,
		total?: number,
	) {
		super(parent)
		applyStatics(this, 'id', 'name', 'total', 'interval', 'repeat', 'delay', 'maxStacks')
		if (total !== undefined) this.total = total
		this.casterName = caster.name
		this.casterId = caster.id
	}

	/**
	 * What counts as the same aura for stacking. Id and caster, so two healers can each keep
	 * a Renew on the tank — moot with one player, but it is the rule that survives a second one.
	 * Override to widen it: a debuff that should be unique on the target however many enemies
	 * apply it drops the caster from the key.
	 *
	 * The id rather than the display name, so renaming what a player reads cannot silently split
	 * one aura into two that no longer stack against each other.
	 */
	get stackKey() {
		return `${this.id}:${this.casterId}`
	}

	mount() {
		const existing = [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey)
		// Insertion order is chronological, so the front of the list is closest to expiring.
		// Collect before removing: `supersede` deletes from the set this walked.
		for (const stale of existing.slice(0, Math.max(0, existing.length + 1 - this.maxStacks))) stale.supersede()

		this.parent.auras.add(this)
		const stacks = [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey).length
		this.logAura(existing.length ? 'SPELL_AURA_REFRESH' : 'SPELL_AURA_APPLIED', stacks)
		log('aura:mount', this.name)
	}

	/**
	 * Pushed off by a fresh copy of itself. Leaves `auras` and stops ticking now rather than on
	 * the microtask `disconnect()` defers to, so what the unit frame draws and what `applyHit`
	 * sees never includes an aura that has already been replaced.
	 */
	supersede() {
		this.superseded = true
		this.parent.auras.delete(this)
		this.pause()
		this.disconnect()
	}

	/** Idempotent, unlike the base — see `detached`. */
	disconnect() {
		if (this.detached) return
		this.detached = true
		super.disconnect()
	}

	tick() {
		applyHit({
			source: this.caster,
			target: this.parent,
			amount: this.total / this.repeat,
			abilityId: this.id,
			abilityName: this.name,
			eventType: this.total >= 0 ? 'SPELL_PERIODIC_HEAL' : 'SPELL_PERIODIC_DAMAGE',
		})
	}

	shouldTick() {
		return this.parent.health.current > 0
	}

	destroy() {
		this.parent.auras.delete(this)
		// A superseded aura already logged its replacement as a refresh. Saying it was removed
		// too would read as the target losing an aura it is still carrying.
		if (!this.superseded) {
			const stacks = [...this.parent.auras].filter((aura) => aura.stackKey === this.stackKey).length
			this.logAura('SPELL_AURA_REMOVED', stacks)
		}
		log('aura:destroy', this.name)
	}

	private logAura(eventType: 'SPELL_AURA_APPLIED' | 'SPELL_AURA_REFRESH' | 'SPELL_AURA_REMOVED', stacks: number) {
		logCombat({
			timestamp: Date.now(),
			eventType,
			sourceId: this.casterId,
			sourceName: this.casterName,
			targetId: this.parent.id,
			targetName: this.parent.name || 'Unknown',
			abilityId: this.id,
			abilityName: this.name,
			// Only when there is more than one, so the common case does not read as "(1 stack)".
			...(stacks > 1 && {extraInfo: `${stacks} stacks`}),
		})
	}
}
