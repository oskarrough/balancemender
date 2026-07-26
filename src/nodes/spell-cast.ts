import {log} from '../utils'
import {logCombat} from '../combatlog'
import {AudioPlayer} from './audio'
import type {GameLoop} from './game-loop'
import {GlobalCooldown} from './global-cooldown'
import type {Player} from './player'
import type {Spell} from './spell'
// Type-only: a value import here would close the loop `actions → balance → spells → spell-cast`
// and leave the balance snapshot reading half-built spell classes.
import type {ActionResult} from '../actions'

type SpellClass = typeof Spell

type CastFailure = 'dead' | 'global-cooldown' | 'already-casting' | 'missing-target' | 'missing-spell' | 'missing-mana'

const failureMessage: Record<CastFailure, string> = {
	dead: `Can't cast while dead`,
	'global-cooldown': `Can't cast during global cooldown`,
	'already-casting': `Can't cast while casting`,
	'missing-target': `Can't cast without a target`,
	'missing-spell': `Spell not found in spellbook`,
	'missing-mana': 'Not enough mana',
}

export class SpellCast {
	/** Refusals come back as `{ok: false, error}` rather than a warning nobody reads. */
	static cast(player: Player, spellName: string): ActionResult<Spell> {
		log(`player:cast:${spellName}`)

		const SpellClass = player.spellbook[spellName]
		const failure = this.validate(player, SpellClass)
		if (failure) {
			const error = failure === 'missing-spell' ? `Spell ${spellName} not found in spellbook` : failureMessage[failure]
			return {ok: false, error}
		}

		const spell = new SpellClass(player)
		player.spell = spell
		player.lastCastTime = (player.root as GameLoop).elapsedTime
		return {ok: true, value: spell}
	}

	/** The two halves below, in the order they always refused in. */
	static validate(player: Player, SpellClass?: SpellClass): CastFailure | undefined {
		return this.whyNotAct(player) ?? this.whyNotCast(player, SpellClass)
	}

	/**
	 * What stops the player acting at all, whatever they meant to cast. True of the whole action
	 * bar at once, and it flickers — the global cooldown is up for a moment after every cast.
	 */
	static whyNotAct(player: Player): CastFailure | undefined {
		if (player.health.current <= 0) return 'dead'
		if (player.gcd) return 'global-cooldown'
		if (player.spell) return 'already-casting'
		return undefined
	}

	/**
	 * What stops this spell landing on this target. `target` is the cast being *considered*, not
	 * always the one the player has selected — the Autopilot picks who to heal and hands the target
	 * over with the cast, and `getTarget()` would answer about a different cast than it meant.
	 */
	static whyNotCast(player: Player, SpellClass?: SpellClass, target = player.getTarget()): CastFailure | undefined {
		// `alive` and not just presence: the default `getTarget()` already filters corpses, so
		// only an explicitly passed target could be a dead one, and healing a corpse is not a cast.
		if (!target?.alive) return 'missing-target'
		if (!SpellClass) return 'missing-spell'
		if (SpellClass.cost && player.mana && player.mana.current < SpellClass.cost) return 'missing-mana'
		return undefined
	}

	static mount(spell: Spell) {
		const player = spell.parent

		player.gcd = new GlobalCooldown(player)

		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_START',
			sourceId: player.id,
			sourceName: player.name,
			spellId: spell.name,
			spellName: spell.name,
			value: spell.delay,
		})

		if (spell.delay) {
			AudioPlayer.play('spell_precast', {loop: true, owner: spell})
		}
	}

	static succeed(spell: Spell) {
		const player = spell.parent

		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_SUCCESS',
			sourceId: player.id,
			sourceName: player.name,
			spellId: spell.name,
			spellName: spell.name,
		})
	}

	static finish(spell: Spell) {
		const player = spell.parent
		const gameLoop = spell.root as GameLoop
		const completed = spell._cycles > 0

		AudioPlayer.stopOwned(spell)

		player.spell = undefined

		if (completed) {
			player.lastCastCompletedTime = gameLoop.elapsedTime
		} else {
			logCombat({
				timestamp: Date.now(),
				eventType: 'SPELL_CAST_INTERRUPTED',
				sourceId: player.id,
				sourceName: player.name,
				spellId: spell.name,
				spellName: spell.name,
			})
		}

		// Instant casts let their GCD task expire naturally; interrupted cast-time spells clear it.
		if (spell.delay > 0) {
			player.gcd = undefined
		}

		if (completed && player.mana) {
			player.mana.spend(spell.cost)
			logCombat({
				timestamp: Date.now(),
				eventType: 'RESOURCE_SPENT',
				sourceId: player.id,
				sourceName: player.name,
				value: -spell.cost,
				extraInfo: 'MANA',
			})
		}
	}
}
