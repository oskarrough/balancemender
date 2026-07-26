import {Task} from 'vroum'
import type {Character} from './character'
import type {Player} from './player'
import {spellRegistry, SpellId} from './registry'
import type {GameLoop} from './game-loop'

/**
 * A healer that plays itself.
 *
 * It is an ordinary Task on the player, so it casts through the same `castSpell()` the
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
		return player.alive && !player.spell && !player.gcd
	}

	tick() {
		const decision = this.policy(this.parent)
		if (!decision) return
		const game = this.parent.root as GameLoop
		game.perform({type: 'cast', spell: decision.spell, target: decision.target.id})
	}
}

export interface Decision {
	spell: SpellId
	target: Character
}

/** Given the player, decide what to cast right now (or nothing). */
export type Policy = (player: Player) => Decision | undefined

const ratio = (c: Character) => c.health.current / c.health.max
const affordable = (player: Player, spell: SpellId) => spellRegistry[spell].cost <= (player.mana?.current ?? 0)
const hasEffect = (target: Character, name: string) => [...target.effects].some((effect) => effect.name === name)

/** The party member in the most trouble, ties broken by lowest absolute health. Never a corpse. */
function mostHurt(player: Player): Character | undefined {
	const candidates = player.parent.party.filter((member) => member.alive)
	if (!candidates.length) return undefined
	return candidates.sort((a, b) => ratio(a) - ratio(b) || a.health.current - b.health.current)[0]
}

/** Cast nothing, ever. The control group: how long does the party last unhealed? */
export const idle: Policy = () => undefined

/** Match the heal to the emergency, and don't top off people who are nearly full. */
export const triage: Policy = (player) => {
	const target = mostHurt(player)
	if (!target || ratio(target) > 0.9) return undefined
	if (ratio(target) < 0.4 && affordable(player, 'Flash Heal')) return {spell: 'Flash Heal', target}
	if (ratio(target) < 0.7 && affordable(player, 'Greater Heal')) return {spell: 'Greater Heal', target}
	if (affordable(player, 'Heal')) return {spell: 'Heal', target}
	return undefined
}

/** Keep a Renew rolling on whoever needs it, fill with Heal. Cheap, but slow to react. */
export const renew: Policy = (player) => {
	const target = mostHurt(player)
	if (!target || ratio(target) > 0.95) return undefined
	if (!hasEffect(target, 'Renew') && affordable(player, 'Renew')) return {spell: 'Renew', target}
	if (ratio(target) < 0.6 && affordable(player, 'Heal')) return {spell: 'Heal', target}
	return undefined
}

/** Flash Heal on cooldown. Fast reactions, burns mana, overheals a lot. */
export const panic: Policy = (player) => {
	const target = mostHurt(player)
	if (!target || ratio(target) > 0.95) return undefined
	if (affordable(player, 'Flash Heal')) return {spell: 'Flash Heal', target}
	return undefined
}

export const policies = {idle, triage, renew, panic}

export type PolicyName = keyof typeof policies
