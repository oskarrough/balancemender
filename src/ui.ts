import * as actions from './actions'
import {html, roundOne} from './utils'
import {Meter} from './components/bar'
import Monitor from './components/monitor'
import SpellIcon from './components/spell-icon'
import {WebHealer} from './game-loop'
import Player from './nodes/player'
import Tank from './nodes/tank'

export default function UI(game: WebHealer) {
	const player = game.find(Player)!
	const tank = game.find(Tank)!

	if (!player) return html`woops no player to heal the tank`
	if (!tank) return html`woops can't heal without a tank..`

	function handleShortcuts({key}: {key: string}) {
		if (key === '1') player.castSpell('Heal')
		if (key === '2') player.castSpell('FlashHeal')
		if (key === '3') player.castSpell('GreaterHeal')
		if (key === '4') player.castSpell('Renew')
		if (key === 'a' || key === 's' || key === 'd' || key === 'w' || key === 'Escape') {
			actions.interrupt(game)
		}
	}

	const spell = player.lastCastSpell
	const timeSinceCast = game.timeSince(player.lastCastTime)

	return html`<div class="Game" onkeyup=${handleShortcuts} tabindex="0">
		<div class="PartyGroup">
			${game.gameOver
				? html`<h2>Game Over!</h2>
						<p>You survived for ${roundOne(game.elapsedTime / 1000)} seconds</p>`
				: html``}

			<p>
				<em>"I'm being attacked by an invisible monster! Help! Heal me!"</em>
			</p>

			<img src="/assets/ragnaros.webp" width="120" alt="" />

			${Meter({
				type: 'health',
				value: tank.health,
				max: tank.baseHealth,
				potentialValue: spell?.heal,
				spell: spell,
			})}

			<ul class="Effects">
				${tank.effects.map(
					(effect) => html`
						<div class="Spell">
							<div class="Spell-inner">
								${effect.name}<br />
								<small><span class="spin">⏲</span> ${effect.cycles}</small>
							</div>
						</div>
					`
				)}
			</ul>
		</div>

		<div class="Player">
			<div style="min-height: 2.5rem">
				<p .hidden=${!spell}>
					Casting ${player.lastCastSpell} ${roundOne(timeSinceCast / 1000)}
				</p>
				${spell
					? Meter({
							type: 'cast',
							value: timeSinceCast,
							max: spell.delay,
					  })
					: null}
			</div>

			<p>Mana</p>
			${Meter({type: 'mana', value: player.mana, max: player.baseMana})}
		</div>

		<div class="ActionBar">
			${SpellIcon(game, 'Heal', '1')} ${SpellIcon(game, 'FlashHeal', '2')}
			${SpellIcon(game, 'GreaterHeal', '3')} ${SpellIcon(game, 'Renew', '4')}
		</div>

		${Monitor(game)}

		<audio loop></audio>
	</div>`
}

// ${FCT('Go!')}
// function FCT(value: string | number) {
// 	return html`<div class="FCT">${value}</div>`
// }
