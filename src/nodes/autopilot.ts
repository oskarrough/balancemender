import {Task} from 'vroum'
import type {Unit} from './unit'
import type {Player} from './player'
import {Tank} from './party-units'
import {playerAbilities, type PlayerAbilityId} from './registry'
import {AbilityUse} from './ability-use'
import type {GameLoop} from './game-loop'

/**
 * A healer that plays itself.
 *
 * It is an ordinary Task on the player, so it casts through the same `perform()` the
 * keyboard does — no special path, no cheating. Attach one to run unattended fights
 * (see `src/sim`), or to watch a policy play in the browser:
 *
 *   new Autopilot(balancemender.player, 'triage')
 */
export class Autopilot extends Task {
	policy: Policy

	constructor(
		public parent: Player,
		policy: Policy | PolicyName = 'triage',
	) {
		super(parent)
		this.policy = typeof policy === 'string' ? policies[policy] : policy
	}

	shouldTick() {
		const player = this.parent
		return player.alive && !player.currentAbility && !player.gcd
	}

	tick() {
		const decision = this.policy(this.parent)
		if (!decision) return
		const game = this.parent.root as GameLoop
		game.perform({type: 'use', ability: decision.ability, target: decision.target.id})
	}
}

export interface Decision {
	ability: PlayerAbilityId
	target: Unit
}

/** Given the player, decide what to cast right now (or nothing). */
export type Policy = (player: Player) => Decision | undefined

/**
 * The same question the action bar asks, so a policy cannot decide to cast something the game
 * would then refuse. This used to compare `cost` to current mana here, which meant the
 * simulator's idea of a castable spell and the game's could drift apart — and would have, the
 * moment spells grew their own cooldowns.
 */
const castable = (player: Player, ability: PlayerAbilityId, target: Unit) =>
	!AbilityUse.whyNotUse(player, playerAbilities[ability], target)
const hasAura = (target: Unit, id: string) => [...target.auras].some((aura) => aura.id === id)

/** The party member in the most trouble, ties broken by lowest absolute health. Never a corpse. */
function mostHurt(player: Player): Unit | undefined {
	const candidates = player.parent.party.filter((member) => member.alive)
	if (!candidates.length) return undefined
	return candidates.sort((a, b) => a.health.ratio - b.health.ratio || a.health.current - b.health.current)[0]
}

/** Cast nothing, ever. The control group: how long does the party last unhealed? */
export const idle: Policy = () => undefined

/**
 * Match the heal to the emergency, and don't top off people who are nearly full.
 *
 * The numbers below are close to `Unit.condition`'s bands and are deliberately not them.
 * These policies are the measuring instrument — every win rate in a sweep is quoted against
 * them — so folding them into a threshold that spells also read makes the sweep circular and
 * silently moves every number we have already recorded. Leave them be.
 */
export const triage: Policy = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.9) return undefined
	if (target.health.ratio < 0.4 && castable(player, 'FlashHeal', target)) return {ability: 'FlashHeal', target}
	if (target.health.ratio < 0.7 && castable(player, 'GreaterHeal', target)) return {ability: 'GreaterHeal', target}
	if (castable(player, 'Heal', target)) return {ability: 'Heal', target}
	return undefined
}

/** Keep a Renew rolling on whoever needs it, fill with Heal. Cheap, but slow to react. */
export const renew: Policy = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.95) return undefined
	if (!hasAura(target, 'Renew') && castable(player, 'Renew', target)) return {ability: 'Renew', target}
	if (target.health.ratio < 0.6 && castable(player, 'Heal', target)) return {ability: 'Heal', target}
	return undefined
}

/**
 * Flash Heal on cooldown. Fast reactions, burns mana, overheals a lot.
 *
 * The only policy with no fallback, so it is the only one a cooldown rewrites: give Flash Heal one
 * and this casts *nothing* while it is down, which turns a spam policy into a fixed-rate one that
 * can beat `triage` on fights it is meant to lose. So `panic` stops measuring bad play the moment
 * Flash Heal gets a cooldown (#41). `triage` and `renew` drop to Greater Heal or Heal, so their
 * throughput never rests on one spell being up.
 */
export const panic: Policy = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.95) return undefined
	if (castable(player, 'FlashHeal', target)) return {ability: 'FlashHeal', target}
	return undefined
}

/**
 * Shield the tank while no shield is on them, otherwise heal as `triage` does. Enough to exercise
 * absorption in a sweep — see #47.
 */
export const shield: Policy = (player) => {
	const tank = player.parent.party.find((member) => member.alive && member instanceof Tank)
	if (tank && !hasAura(tank, 'PowerWordShield') && castable(player, 'PowerWordShield', tank)) {
		return {ability: 'PowerWordShield', target: tank}
	}
	return triage(player)
}

export const policies = {idle, triage, renew, panic, shield}

export type PolicyName = keyof typeof policies
