import {html, roundOne} from '../utils'
import {Meter} from './bar'
import {Monitor} from './monitor'
import {SpellIcon} from './spell-icon'
import {register} from './floating-combat-text'
import {GameLoop} from '../nodes/game-loop'
import {UnitFrame} from './unitframe'
import {restartGame} from '../animations'

register()

export function UI(game: GameLoop) {
	const player = game.player
	if (!player) return html`Woops, no player to heal the party...`

	const SHORTCUTS: Record<string, string> = {
		'1': 'Heal',
		'2': 'Flash Heal',
		'3': 'Greater Heal',
		'4': 'Renew',
	}

	function handleShortcuts({key}: {key: string}) {
		const spell = SHORTCUTS[key]
		if (spell) game.perform({type: 'cast', spell})
		// Moving cancels your cast.
		if (key === 'a' || key === 's' || key === 'd' || key === 'w' || key === 'Escape') {
			game.perform({type: 'interrupt'})
		}
	}

	const spell = player.spell
	const timeSinceCast = game.elapsedTime - player.lastCastTime

	return html`
		<div class="Game Debug" onkeyup=${handleShortcuts} tabindex="0">
			${game.gameOver
				? html` <div class="GameOver">
						<h2>Game Over!</h2>
						<p>You survived for ${roundOne(game.elapsedTime / 1000)} seconds</p>
						<button class="Button" onclick=${() => restartGame(game)}>Play Again</button>
					</div>`
				: null}

			<div class="Enemies">${game.enemies.map((enemy) => UnitFrame(enemy, spell, player))}</div>

			<div class="PartyGroup">${game.party.map((member) => UnitFrame(member, spell, player))}</div>

			<div class="CastingInfo">
				${spell
					? html`
							<div class="CastBar" style="min-height: 2.5rem">
								<p>Casting ${spell.name} ${roundOne(timeSinceCast / 1000)}</p>
								${Meter({type: 'cast', value: timeSinceCast, max: spell.delay})}
							</div>
						`
					: null}
			</div>

			<div class="ActionBar">
				${Object.keys(player.spellbook).length > 0
					? Object.keys(player.spellbook).map((name, index) => SpellIcon(game, name, index + 1))
					: ''}
			</div>

			${Monitor(game)}
		</div>
	`
}
