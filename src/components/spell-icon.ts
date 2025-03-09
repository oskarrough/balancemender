import {html} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {Spell} from '../nodes/spell'

export function SpellIcon(game: GameLoop, spellName: string, shortcut: string | number) {
	const player = game.player
	const SpellClass = player.spellbook[spellName] as typeof Spell

	if (!SpellClass) throw new Error('no spell' + spellName)

	const realCastTime = (game?.elapsedTime || 0) - player.lastCastTime
	/* const castTime = beingCast */
	/* 	? roundOne(realCastTime / 1000) */
	/* 	: roundOne(spell.delay / 1000) */

	const gcdPercentage = realCastTime / game.gcd
	const angle = gcdPercentage ? (1 - gcdPercentage) * 360 : 0

	return html`
		<button
			class="Spell"
			onclick=${() => player.castSpell(spellName)}
			.disabled=${game.gameOver}
		>
			<div class="Spell-inner">
				<h3>${SpellClass.name}</h3>
				<p>
					<span>🔵 ${SpellClass.cost} </span>
					<span>🟢 ${SpellClass.heal}</span>
					<span>⏲ ${SpellClass.castTime / 1000}s</span>
				</p>
			</div>
			<div class="Spell-gcd" style=${`--progress: ${angle}deg`}></div>
			${shortcut ? html`<small class="Spell-shortcut">${shortcut}</small>` : html``}
		</button>
	`
}
