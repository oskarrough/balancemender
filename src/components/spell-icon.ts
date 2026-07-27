import {html} from '../utils'
import type {GameLoop} from '../nodes/game-loop'
import type {AbilityClass} from '../nodes/ability'
import {AbilityUse} from '../nodes/ability-use'

function spellIconPath(AbilityClass: AbilityClass) {
	const slug = AbilityClass.icon || AbilityClass.name.toLowerCase().replaceAll(' ', '-')
	return `/assets/generated/spells/${slug}.png`
}

/** Transitional spell-shaped UI over the player's neutral ability collection. */
export function SpellIcon(game: GameLoop, abilityId: string, shortcut: string | number) {
	const player = game.player
	const AbilityClass = player.abilities[abilityId]
	if (!AbilityClass) throw new Error(`no ability ${abilityId}`)

	const realCastTime = (game.elapsedTime || 0) - player.lastCastTime
	const gcdPercentage = realCastTime / game.gcd
	const angle = gcdPercentage ? (1 - gcdPercentage) * 360 : 0
	const refusal = AbilityUse.whyNotUse(player, AbilityClass)
	const cooldownLeft = AbilityUse.cooldownRemaining(player, AbilityClass)
	const cooldown = AbilityClass.cooldown ?? 0
	const cooldownSweep = cooldown ? (cooldownLeft / cooldown) * 360 : 0

	let state = ''
	if (cooldownLeft > 0) state = 'cooldown'
	else if (refusal === 'missing-mana') state = 'unaffordable'
	else if (refusal) state = 'blocked'

	return html`
		<button
			class="Spell"
			data-state=${state}
			onclick=${() => game.perform({type: 'cast', spell: abilityId})}
			.disabled=${game.gameOver}
		>
			<img class="Spell-image" src=${spellIconPath(AbilityClass)} alt="" />
			<div class="Spell-inner">
				<h3>${AbilityClass.name}</h3>
				<p>
					<span>🔵 ${AbilityClass.cost ?? 0} </span>
					<span>🟢 ${AbilityClass.heal ?? 0}</span>
					<span>⏲ ${(AbilityClass.castTime ?? 0) / 1000}s</span>
					${cooldown ? html`<span>⏳ ${cooldown / 1000}s</span>` : null}
				</p>
			</div>
			<div class="Spell-gcd" style=${`--progress: ${angle}deg`}></div>
			${cooldownLeft > 0
				? html`<div class="Spell-cooldown" style=${`--progress: ${cooldownSweep}deg`}>
						<strong>${Math.ceil(cooldownLeft / 1000)}</strong>
					</div>`
				: null}
			${shortcut ? html`<small class="Spell-shortcut">${shortcut}</small>` : html``}
		</button>
	`
}
