import {html} from 'uhtml'
import {roundOne} from '../utils'
import {Meter} from './bar'
import {Monitor} from './monitor'
import {AbilityIcon} from './ability-icon'
import {register} from './floating-combat-text'
import {GameLoop} from '../nodes/game-loop'
import {UnitFrame} from './unitframe'
import {nextRoom, restartDungeon, restartGame} from '../animations'
import {bringToFront} from './floating-view.js'

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

/** Which dungeon, how far in, which room. Nothing at all outside a dungeon run. */
function RoomInfo(game: GameLoop) {
	const run = game.dungeonRun
	if (!run) return null
	return html`
		<p class="RoomInfo">
			<span class="RoomInfo-dungeon">${run.dungeon.name}</span>
			<span class="RoomInfo-count">${run.room + 1}/${run.dungeon.rooms.length}</span>
			<span class="RoomInfo-room">${run.dungeon.rooms[run.room]?.name}</span>
		</p>
	`
}

/**
 * The post-fight panel. A win splits three ways: a room cleared leads on to the next one, the last
 * room ends the run on its total time, and anything else replays what you just fought.
 */
function GameOver(game: GameLoop) {
	const outcome = game.outcome ?? 'defeat'
	const run = game.dungeonRun
	const copy = GAME_OVER_COPY[outcome]
	let headline = copy.headline
	let blurb = copy.blurb(roundOne(game.elapsedTime / 1000))
	let label = 'Play Again'
	let onclick = () => restartGame(game)

	if (run && outcome === 'victory') {
		if (run.room + 1 < run.dungeon.rooms.length) {
			label = 'Next room'
			onclick = () => nextRoom(game)
		} else {
			const total = run.times.reduce((sum, time) => sum + time, 0) + game.elapsedTime
			headline = 'Dungeon cleared!'
			blurb = `${run.dungeon.name} cleared in ${roundOne(total / 1000)}s.`
			label = 'Play Again'
			onclick = () => restartDungeon(game)
		}
	}

	return html`
		<div
			class="GameOver"
			data-outcome=${outcome}
			onpointerdown=${(event: PointerEvent) => bringToFront(event.currentTarget as HTMLElement)}
		>
			<h2>${headline}</h2>
			<p>${blurb}</p>
			<button class="Button" onclick=${onclick}>${label}</button>
		</div>
	`
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
			${game.gameOver ? GameOver(game) : null} ${RoomInfo(game)}

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
