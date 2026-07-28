import {Task} from 'vroum'
import type {Unit} from './unit'
import type {Player} from './player'
import {Tank} from './party-units'
import {playerAbilities, type PlayerAbilityId} from './registry'
import {AbilityUse} from './ability-use'
import type {GameLoop} from './game-loop'

/**
 * Runs a `Bot` as an ordinary Task on the player, so it casts through the same `perform()` the
 * keyboard does. `new BotDriver(balancemender.player, 'triage')` watches one play in the browser.
 */
export class BotDriver extends Task {
	bot: Bot

	constructor(
		public parent: Player,
		bot: Bot | BotName = 'triage',
	) {
		super(parent)
		this.bot = typeof bot === 'string' ? bots[bot] : bot
	}

	shouldTick() {
		const player = this.parent
		return player.alive && !player.currentAbility && !player.gcd
	}

	tick() {
		const decision = this.bot(this.parent)
		if (!decision) return
		const game = this.parent.root as GameLoop
		game.perform({type: 'use', ability: decision.ability, target: decision.target.id})
	}
}

export interface Decision {
	ability: PlayerAbilityId
	target: Unit
}

/**
 * A stand-in for the player: what to cast right now, or nothing. Also the measuring instrument —
 * every win rate a sweep prints is "with this bot playing", which is why `idle` counts as one.
 */
export type Bot = (player: Player) => Decision | undefined

/**
 * The same question the action bar asks, so a bot cannot decide to cast something the game would
 * refuse. Comparing `cost` to mana here instead would drift the moment spells grow cooldowns.
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
export const idle: Bot = () => undefined

/**
 * Match the heal to the emergency, and don't top off people who are nearly full. The ratios below
 * are near `Unit.condition`'s bands and deliberately not them — sharing would make sweeps circular.
 */
export const triage: Bot = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.9) return undefined
	if (target.health.ratio < 0.4 && castable(player, 'FlashHeal', target)) return {ability: 'FlashHeal', target}
	if (target.health.ratio < 0.7 && castable(player, 'GreaterHeal', target)) return {ability: 'GreaterHeal', target}
	if (castable(player, 'Heal', target)) return {ability: 'Heal', target}
	return undefined
}

/** Keep a Renew rolling on whoever needs it, fill with Heal. Cheap, but slow to react. */
export const renew: Bot = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.95) return undefined
	if (!hasAura(target, 'Renew') && castable(player, 'Renew', target)) return {ability: 'Renew', target}
	if (target.health.ratio < 0.6 && castable(player, 'Heal', target)) return {ability: 'Heal', target}
	return undefined
}

/**
 * Flash Heal on cooldown. Fast reactions, burns mana, overheals a lot. The only bot with no
 * fallback, so it stops measuring bad play the moment Flash Heal gets a cooldown (#41).
 */
export const panic: Bot = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.95) return undefined
	if (castable(player, 'FlashHeal', target)) return {ability: 'FlashHeal', target}
	return undefined
}

/** Shield the tank when they have none, else heal as `triage`. Exercises absorption in a sweep (#47). */
export const shield: Bot = (player) => {
	const tank = player.parent.party.find((member) => member.alive && member instanceof Tank)
	if (tank && !hasAura(tank, 'PowerWordShield') && castable(player, 'PowerWordShield', tank)) {
		return {ability: 'PowerWordShield', target: tank}
	}
	return triage(player)
}

export const bots = {idle, triage, renew, panic, shield}

export type BotName = keyof typeof bots
