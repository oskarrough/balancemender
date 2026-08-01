import {Task} from '../vroum'
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
		// The target the bot weighed is the target the use gets. It used to be written into the
		// player and read back out by the spell, which meant a bot moved the player's aim.
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

/** Whoever is closest to death, ties broken by lowest absolute health. Never a corpse. */
const weakest = (units: Unit[]): Unit | undefined =>
	units
		.filter((unit) => unit.alive)
		.sort((a, b) => a.health.ratio - b.health.ratio || a.health.current - b.health.current)[0]

/** The party member in the most trouble — who a healing bot reaches for. */
const mostHurt = (player: Player) => weakest(player.parent.party)

/** The enemy closest to death, so damage finishes one target rather than spreading out. */
const lowestHealthEnemy = (player: Player) => weakest(player.parent.enemies)

/** Cast nothing, ever. The control group: how long does the party last unhealed? */
export const idle: Bot = () => undefined

/**
 * Match the heal to the emergency, and don't top off people who are nearly full. The ratios below
 * are near `Unit.condition`'s bands and deliberately not them — sharing would make sweeps circular.
 */
export const triage: Bot = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.9) return undefined
	if (target.health.ratio < 0.4 && castable(player, 'Patch', target)) return {ability: 'Patch', target}
	if (target.health.ratio < 0.7 && castable(player, 'Mend', target)) return {ability: 'Mend', target}
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
 * Reach for Patch every time, and Heal when it is out of reach. Fast reactions, burns mana,
 * overheals a lot — the trap the spell ladder is built around.
 *
 * The Heal fallback is what keeps it a bot about spell *choice* (#41). A bot whose whole output is
 * one spell is not measuring bad play once that spell can be unavailable: it idles while the spell
 * is down, banking the mana it was supposed to waste, and a cooldown meant to punish it reads as a
 * buff instead. Any bot added here wants the same — a second spell to fall to.
 */
export const panic: Bot = (player) => {
	const target = mostHurt(player)
	if (!target || target.health.ratio > 0.95) return undefined
	if (castable(player, 'Patch', target)) return {ability: 'Patch', target}
	if (castable(player, 'Heal', target)) return {ability: 'Heal', target}
	return undefined
}

/** Shield a tank that has none, else heal as `triage`. Exercises absorption in a sweep (#47). */
export const shield: Bot = (player) => {
	const tank = player.parent.party.find(
		(member) =>
			member.alive && member instanceof Tank && !hasAura(member, 'Shield') && castable(player, 'Shield', member),
	)
	if (tank) return {ability: 'Shield', target: tank}
	return triage(player)
}

/** Heal exactly as `triage` while anyone needs it; only spend safe GCDs attacking. */
export const lance: Bot = (player) => {
	const hurtAlly = mostHurt(player)
	// Do not turn an unavailable heal into permission to deal damage. At exactly 90%, triage still
	// considers the ally hurt, so this boundary deliberately matches its `> 0.9` early return.
	if (hurtAlly && hurtAlly.health.ratio <= 0.9) return triage(player)

	const target = lowestHealthEnemy(player)
	if (target && castable(player, 'Lance', target)) return {ability: 'Lance', target}
	return undefined
}

/** Heal exactly as `triage`; keep Nettle ticking on the target, then fill with Lance. */
export const nettle: Bot = (player) => {
	const hurtAlly = mostHurt(player)
	if (hurtAlly && hurtAlly.health.ratio <= 0.9) return triage(player)

	const target = lowestHealthEnemy(player)
	if (target && !hasAura(target, 'Nettle') && castable(player, 'Nettle', target)) {
		return {ability: 'Nettle', target}
	}
	if (target && castable(player, 'Lance', target)) return {ability: 'Lance', target}
	return undefined
}

export const bots = {idle, triage, renew, panic, shield, lance, nettle}

export type BotName = keyof typeof bots
