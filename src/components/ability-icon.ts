import {html} from 'uhtml'
import type {GameLoop} from '../nodes/game-loop'
import type {AbilityClass} from '../nodes/ability'
import {AbilityUse} from '../nodes/ability-use'

function iconPath(AbilityClass: AbilityClass) {
	const slug = AbilityClass.icon || AbilityClass.name.toLowerCase().replaceAll(' ', '-')
	return `/assets/generated/spells/${slug}.png`
}

/** One button in the action bar: what the ability costs, what it does, and whether it can be used now. */
export function AbilityIcon(game: GameLoop, abilityId: string, shortcut: string | number) {
	const player = game.player
	const AbilityClass = player.abilities[abilityId]
	if (!AbilityClass) throw new Error(`no ability ${abilityId}`)

	const realCastTime = (game.elapsedTime || 0) - player.lastCastTime
	const gcdPercentage = realCastTime / game.gcd
	const angle = gcdPercentage ? (1 - gcdPercentage) * 360 : 0
	const refusal = AbilityUse.whyNotUse(player, AbilityClass, player.intendedTarget)
	const cooldownLeft = AbilityUse.cooldownRemaining(player, AbilityClass)
	const cooldown = AbilityClass.cooldown ?? 0
	const cooldownSweep = cooldown ? (cooldownLeft / cooldown) * 360 : 0
	// One number per outcome the ability lands, so a composite reads as what it does.
	const magnitudes = AbilityClass.magnitudesFor(player).join(' + ') || 0
	const outcome = AbilityClass.tags.includes('attack')
		? html`<span>🔴 ${magnitudes}</span>`
		: html`<span>🟢 ${magnitudes}</span>`

	let state = ''
	if (cooldownLeft > 0) state = 'cooldown'
	else if (refusal === 'missing-mana') state = 'unaffordable'
	else if (refusal) state = 'blocked'

	return html`
		<button
			class="Frame Ability"
			data-state=${state}
			onclick=${() => game.perform({type: 'use', ability: abilityId})}
			.disabled=${game.gameOver}
		>
			<img class="Frame-image" src=${iconPath(AbilityClass)} alt="" />
			<div class="Frame-inner">
				<h3>${AbilityClass.name}</h3>
				<p>
					<span>🔵 ${AbilityClass.cost ?? 0} </span>
					${outcome}
					<span>⏲ ${(AbilityClass.castTime ?? 0) / 1000}s</span>
					${cooldown ? html`<span>⏳ ${cooldown / 1000}s</span>` : null}
				</p>
			</div>
			<div class="Ability-gcd" style=${`--progress: ${angle}deg`}></div>
			${cooldownLeft > 0
				? html`<div class="Ability-cooldown" style=${`--progress: ${cooldownSweep}deg`}>
						<strong>${Math.ceil(cooldownLeft / 1000)}</strong>
					</div>`
				: null}
			${shortcut ? html`<small class="Ability-shortcut">${shortcut}</small>` : html``}
		</button>
	`
}
