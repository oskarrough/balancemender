import {html} from 'uhtml'
import {roundOne} from '../utils'
import {Meter} from './bar'
import {Monitor} from './monitor'
import {AbilityIcon} from './ability-icon'
import {register} from './floating-combat-text'
import {GameLoop} from '../nodes/game-loop'
import {UnitFrame} from './unitframe'
import {restartGame} from '../animations'

register()

/** How long a refused action stays on screen, in fight-clock milliseconds. */
const REFUSAL_DURATION = 1200

/** Headline and blurb per `Outcome` — same panel structure, different voice and accent colour. */
const GAME_OVER_COPY: Record<
	NonNullable<GameLoop['outcome']>,
	{headline: string; blurb: (seconds: number) => string}
> = {
	victory: {headline: 'Victory!', blurb: (s) => `Cleared in ${s}s.`},
	defeat: {headline: 'Defeated', blurb: (s) => `You lasted ${s}s.`},
	timeout: {headline: "Time's Up", blurb: (s) => `You held out the full ${s}s.`},
}

export function UI(game: GameLoop) {
	const player = game.player
	if (!player) return html`Woops, no player to heal the party...`

	const SHORTCUTS: Record<string, string> = {
		'1': 'Heal',
		'2': 'FlashHeal',
		'3': 'GreaterHeal',
		'4': 'Renew',
		'5': 'Shield',
		'6': 'Smite',
		'7': 'Wither',
	}

	function handleShortcuts({key}: {key: string}) {
		const ability = SHORTCUTS[key]
		if (ability) game.perform({type: 'use', ability})
		// Moving cancels your cast.
		if (key === 'a' || key === 's' || key === 'd' || key === 'w' || key === 'Escape') {
			game.perform({type: 'interrupt'})
		}
	}

	const casting = player.currentAbility
	const timeSinceCast = game.elapsedTime - player.lastCastTime

	/**
	 * A refusal is shown for a moment and then forgotten, and it renders alongside the cast bar
	 * rather than instead of it — `Can't cast while casting` is a refusal you can only ever get
	 * while the cast bar is up, so hiding one behind the other would silence that case.
	 * Measured on the fight clock, so it holds while paused instead of expiring unseen.
	 */
	const refusal = game.lastRefusal
	const showRefusal = refusal && game.elapsedTime - refusal.at < REFUSAL_DURATION

	return html`
		<div class="Game Debug" onkeyup=${handleShortcuts} tabindex="0">
			${game.gameOver
				? html` <div class="GameOver" data-outcome=${game.outcome ?? 'defeat'}>
						<h2>${GAME_OVER_COPY[game.outcome ?? 'defeat'].headline}</h2>
						<p>${GAME_OVER_COPY[game.outcome ?? 'defeat'].blurb(roundOne(game.elapsedTime / 1000))}</p>
						<button class="Button" onclick=${() => restartGame(game)}>Play Again</button>
					</div>`
				: null}

			<div class="Enemies">${game.enemies.map((enemy) => UnitFrame(enemy, casting, player))}</div>

			<div class="PartyGroup">${game.party.map((member) => UnitFrame(member, casting, player))}</div>

			<div class="CastingInfo">
				${casting
					? html`
							<div class="CastBar" style="min-height: 2.5rem">
								<p>Casting ${casting.name} ${roundOne(timeSinceCast / 1000)}</p>
								${Meter({
									type: 'cast',
									value: timeSinceCast,
									max: casting.delay,
									sweetSpotWindow: casting.sweetSpotWindow,
								})}
							</div>
						`
					: null}
				${showRefusal ? html`<p class="Refusal" role="status">${refusal.error}</p>` : null}
			</div>

			<div class="ActionBar">
				${Object.keys(player.abilities).length > 0
					? Object.keys(player.abilities).map((abilityId, index) => AbilityIcon(game, abilityId, index + 1))
					: ''}
			</div>

			${Monitor(game)}
		</div>
	`
}
