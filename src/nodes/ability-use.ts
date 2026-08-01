import type {ActionResult} from '../actions'
import {DEFAULT_SWEET_SPOT_WINDOW, type Ability, type AbilityClass} from './ability'
import type {GameLoop} from './game-loop'
import {GlobalCooldown} from './global-cooldown'
import {eligible} from './targets'
import type {Unit} from './unit'

export type AbilityFailure =
	| 'dead'
	| 'global-cooldown'
	| 'already-casting'
	| 'missing-target'
	| 'invalid-target'
	| 'missing-ability'
	| 'missing-mana'
	| 'cooldown'

const failureMessage: Record<AbilityFailure, string> = {
	dead: `Can't use an ability while dead`,
	'global-cooldown': `Can't cast during global cooldown`,
	'already-casting': `Can't cast while casting`,
	'missing-target': `Can't use an ability without a target`,
	'invalid-target': `Can't use that ability on this target`,
	'missing-ability': `Ability not found`,
	'missing-mana': 'Not enough mana',
	cooldown: 'Still on cooldown',
}

/** The one lookup, validation and execution boundary for every ability use. */
export class AbilityUse {
	static use(unit: Unit, abilityId: string, target?: Unit): ActionResult<Ability> {
		// Tap-to-confirm (#33): pressing the very spell already casting, while it opts into a sweet
		// spot, is not a second cast attempt — it never hits `already-casting`, it confirms instead.
		// A castTime-0 ability needs no guard against this: `currentAbility` holds it for at most
		// the one frame between mount and its own tick, not a window a second keypress can land in.
		const casting = unit.currentAbility
		if (casting?.sweetSpot && casting.id === abilityId) {
			return this.confirmSweetSpot(casting)
		}

		const AbilityClass = unit.abilities[abilityId]
		if (!AbilityClass) return {ok: false, error: `Ability ${abilityId} not found in abilities`}
		const failure = this.validate(unit, AbilityClass, target)
		// A missing target is already a refusal; the second half of this is what tells the compiler so.
		if (failure || !target) return {ok: false, error: failureMessage[failure ?? 'missing-target']}

		const ability = new AbilityClass(unit, target)
		if (this.usesCastRules(AbilityClass)) {
			unit.currentAbility = ability
			unit.lastCastTime = (unit.root as GameLoop).elapsedTime
		} else {
			ability.executeNow()
		}
		return {ok: true, value: ability}
	}

	/**
	 * The tap-to-confirm half of the sweet spot (#33). `ability.elapsedTime` is time since the cast
	 * started; a tap inside the last `sweetSpotWindow` ms of `ability.delay` (the cast time) marks
	 * the ability so its effects can reward it — a tap outside logs a miss and changes nothing.
	 */
	static confirmSweetSpot(ability: Ability): ActionResult<Ability> {
		const unit = ability.parent
		// Resolved onto the instance in the constructor whenever `sweetSpot` is on; the fallback
		// here is only for safety, not the mechanism a spell relies on to get a working default.
		const sweetSpotWindow = ability.sweetSpotWindow ?? DEFAULT_SWEET_SPOT_WINDOW
		const remaining = ability.delay - ability.elapsedTime
		const hit = remaining >= 0 && remaining <= sweetSpotWindow
		if (hit) ability.sweetSpotHit = true

		const game = ability.root as GameLoop
		game.combatLog.add({
			timestamp: Date.now(),
			eventType: hit ? 'SWEET_SPOT_HIT' : 'SWEET_SPOT_MISS',
			sourceId: unit.id,
			sourceName: unit.name,
			abilityId: ability.id,
			abilityName: ability.name,
			castId: ability.castId,
		})
		return {ok: true, value: ability}
	}

	static validate(unit: Unit, AbilityClass?: AbilityClass, target?: Unit): AbilityFailure | undefined {
		if (!AbilityClass) return 'missing-ability'
		return this.whyNotAct(unit, AbilityClass) ?? this.whyNotUse(unit, AbilityClass, target)
	}

	/** Restrictions which serialize only abilities explicitly configured as casts. */
	static whyNotAct(unit: Unit, AbilityClass: AbilityClass): AbilityFailure | undefined {
		if (!unit.alive) return 'dead'
		if (!this.usesCastRules(AbilityClass)) return undefined
		if (unit.gcd) return 'global-cooldown'
		if (unit.currentAbility) return 'already-casting'
		return undefined
	}

	/** Restrictions belonging to this ability and the one target the driver named. */
	static whyNotUse(unit: Unit, AbilityClass?: AbilityClass, target?: Unit): AbilityFailure | undefined {
		if (!AbilityClass) return 'missing-ability'
		if (!target?.alive) return 'missing-target'
		if (!eligible(unit, AbilityClass.targets).includes(target)) return 'invalid-target'
		if (this.cooldownRemaining(unit, AbilityClass) > 0) return 'cooldown'
		if (AbilityClass.cost && unit.mana && unit.mana.current < AbilityClass.cost) return 'missing-mana'
		return undefined
	}

	static usesCastRules(AbilityClass?: AbilityClass) {
		return !!AbilityClass && (AbilityClass.castTime !== undefined || AbilityClass.gcd === true)
	}

	static cooldownRemaining(unit: Unit, AbilityClass: AbilityClass): number {
		const until = unit.cooldowns.get(AbilityClass.id)
		if (until === undefined) return 0
		return Math.max(0, until - (unit.root as GameLoop).elapsedTime)
	}

	static mount(ability: Ability) {
		if (!this.usesCastRules(ability.constructor as AbilityClass)) return
		const unit = ability.parent
		if (ability.gcd) unit.gcd = new GlobalCooldown(unit)

		const game = ability.root as GameLoop
		game.combatLog.add({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_START',
			sourceId: unit.id,
			sourceName: unit.name,
			abilityId: ability.id,
			abilityName: ability.name,
			castId: ability.castId,
			value: ability.delay,
			busyFor: Math.max(ability.delay, unit.gcd?.delay ?? 0),
		})

		if (ability.delay) game.audio.play('spell_precast', {loop: true, owner: ability})
	}

	static succeed(ability: Ability) {
		if (!this.usesCastRules(ability.constructor as AbilityClass)) return
		const unit = ability.parent
		const game = ability.root as GameLoop
		game.combatLog.add({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_SUCCESS',
			sourceId: unit.id,
			sourceName: unit.name,
			abilityId: ability.id,
			abilityName: ability.name,
			castId: ability.castId,
		})
	}

	/** Ordinary abilities complete synchronously; cast abilities complete during Task teardown. */
	static complete(ability: Ability) {
		if (this.usesCastRules(ability.constructor as AbilityClass)) return
		this.commit(ability)
	}

	static finish(ability: Ability) {
		if (!this.usesCastRules(ability.constructor as AbilityClass)) return
		const unit = ability.parent
		const game = ability.root as GameLoop
		const completed = ability._cycles > 0
		game.audio.stopOwned(ability)
		if (unit.currentAbility === ability) unit.currentAbility = undefined

		if (completed) {
			unit.lastCastCompletedTime = game.elapsedTime
			this.commit(ability)
		} else {
			game.combatLog.add({
				timestamp: Date.now(),
				eventType: 'SPELL_CAST_INTERRUPTED',
				sourceId: unit.id,
				sourceName: unit.name,
				abilityId: ability.id,
				abilityName: ability.name,
				castId: ability.castId,
			})
		}

		if (ability.delay > 0) unit.gcd = undefined
	}

	/** Public so Steep can pay at cast start (#81); the guard keeps its completed casts from paying twice. */
	static commit(ability: Ability) {
		if (ability._committed) return
		ability._committed = true
		const unit = ability.parent
		const game = ability.root as GameLoop
		if (ability.cooldown) unit.cooldowns.set(ability.id, game.elapsedTime + ability.cooldown)
		if (ability.cost === undefined || !unit.mana) return
		unit.mana.spend(ability.cost)
		game.combatLog.add({
			timestamp: Date.now(),
			eventType: 'RESOURCE_SPENT',
			sourceId: unit.id,
			sourceName: unit.name,
			castId: ability.castId,
			value: -ability.cost,
			extraInfo: 'MANA',
		})
	}
}
