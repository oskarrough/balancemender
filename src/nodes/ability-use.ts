import {logCombat} from '../combatlog'
import type {ActionResult} from '../actions'
import {AudioPlayer} from './audio'
import type {Ability, AbilityClass} from './ability'
import type {GameLoop} from './game-loop'
import {GlobalCooldown} from './global-cooldown'
import {eligible} from './target-rule'
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
		if (!eligible(unit, AbilityClass.targetRule).includes(target)) return 'invalid-target'
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

		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_START',
			sourceId: unit.id,
			sourceName: unit.name,
			abilityId: ability.id,
			abilityName: ability.name,
			value: ability.delay,
			busyFor: Math.max(ability.delay, unit.gcd?.delay ?? 0),
		})

		if (ability.delay) AudioPlayer.play('spell_precast', {loop: true, owner: ability})
	}

	static succeed(ability: Ability) {
		if (!this.usesCastRules(ability.constructor as AbilityClass)) return
		const unit = ability.parent
		logCombat({
			timestamp: Date.now(),
			eventType: 'SPELL_CAST_SUCCESS',
			sourceId: unit.id,
			sourceName: unit.name,
			abilityId: ability.id,
			abilityName: ability.name,
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
		const completed = ability._cycles > 0
		AudioPlayer.stopOwned(ability)
		if (unit.currentAbility === ability) unit.currentAbility = undefined

		if (completed) {
			unit.lastCastCompletedTime = (ability.root as GameLoop).elapsedTime
			this.commit(ability)
		} else {
			logCombat({
				timestamp: Date.now(),
				eventType: 'SPELL_CAST_INTERRUPTED',
				sourceId: unit.id,
				sourceName: unit.name,
				abilityId: ability.id,
				abilityName: ability.name,
			})
		}

		if (ability.delay > 0) unit.gcd = undefined
	}

	private static commit(ability: Ability) {
		const unit = ability.parent
		const now = (ability.root as GameLoop).elapsedTime
		if (ability.cooldown) unit.cooldowns.set(ability.id, now + ability.cooldown)
		if (ability.cost === undefined || !unit.mana) return
		unit.mana.spend(ability.cost)
		logCombat({
			timestamp: Date.now(),
			eventType: 'RESOURCE_SPENT',
			sourceId: unit.id,
			sourceName: unit.name,
			value: -ability.cost,
			extraInfo: 'MANA',
		})
	}
}
