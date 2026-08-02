import {html} from 'uhtml'
import {roundOne} from '../utils'
import {Meter} from './bar'
import {Monitor} from './monitor'
import {AbilityIcon} from './ability-icon'
import {register} from './floating-combat-text'
import {GameLoop} from '../nodes/game-loop'
import {scenePaths} from '../nodes/fight'
import {UnitFrame} from './unitframe'
import {nextRoom, restartDungeon, restartGame} from '../animations'
import {bringToFront} from './floating-view.js'
import {RoomEditor} from './room-editor'
import {AbilityEditor} from './ability-editor'

register()

/** How long a refused action stays on screen, in fight-clock milliseconds. */
const REFUSAL_DURATION = 1200

/** Headline and blurb per `Outcome` — same panel structure, different voice and accent colour. */
const GAME_OVER_COPY: Record<
	NonNullable<GameLoop['outcome']>,
	{headline: string; blurb: (seconds: number) => string}
> = {
	victory: {headline: 'Mended.', blurb: (s) => `Cleared in ${s}s.`},
	defeat: {headline: 'The party falls', blurb: (s) => `You lasted ${s}s.`},
	timeout: {headline: "Time's Up", blurb: (s) => `You held out the full ${s}s.`},
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
			label = `Next: ${run.dungeon.rooms[run.room + 1]?.name}`
			onclick = () => nextRoom(game)
		} else {
			const total = run.times.reduce((sum, time) => sum + time, 0) + game.elapsedTime
			headline = 'Dungeon cleared!'
			blurb = `${run.dungeon.name} cleared in ${roundOne(total / 1000)}s.`
			label = 'Play Again'
			onclick = () => restartDungeon(game)
		}
	}

	// The pager's dots, repeated here: the panel is where you decide to go on, so it carries
	// the run's position too. A won room counts as cleared even though the pager hasn't advanced.
	const cleared = run ? run.room + (outcome === 'victory' ? 1 : 0) : 0
	const rooms = run
		? html`<p class="GameOver-rooms">
				${run.dungeon.rooms.map(
					(room, index) => html`<i class="DungeonPager-dot" data-cleared=${index < cleared} title=${room.name}></i>`,
				)}
			</p>`
		: null

	return html`
		<div
			class="GameOver"
			data-outcome=${outcome}
			ref=${bringToFront}
			onpointerdown=${(event: PointerEvent) => bringToFront(event.currentTarget as HTMLElement)}
		>
			<h2>${headline}</h2>
			<p>${blurb}</p>
			${rooms}
			<fight-report mode="result"></fight-report>
			<button class="Button" onclick=${onclick}>${label}</button>
		</div>
	`
}

export function UI(game: GameLoop) {
	const player = game.player
	if (!player) return html`Woops, no player to heal the party...`

	// Key N is the Nth ability on the bar, matching the on-screen numbers below.
	const SHORTCUTS: Record<string, string> = Object.fromEntries(
		Object.keys(player.abilities).map((id, index) => [String(index + 1), id]),
	)

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

	const scene = game.dungeonRun?.dungeon.rooms[game.dungeonRun.room]?.scene
	const painting = scene ? scenePaths(scene) : null
	const sceneClass = game.dungeonRun?.dungeon.id === 'TheRust' ? 'Game-bg Game-bg--rust' : 'Game-bg'

	return html`
		<div class=${game.malleable ? 'Game Debug Game--malleable' : 'Game Debug'} onkeyup=${handleShortcuts} tabindex="0">
			${painting
				? html`<picture class=${sceneClass}>
						<source media="(orientation: portrait)" srcset=${painting.portrait} />
						<img src=${painting.landscape} alt="" />
					</picture>`
				: null}
			${game.gameOver ? GameOver(game) : null} ${game.malleable ? RoomEditor(game) : null}

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

			${game.malleable
				? AbilityEditor(game)
				: html`<div class="ActionBar">
						${Object.keys(player.abilities).map((abilityId, index) => AbilityIcon(game, abilityId, index + 1))}
					</div>`}
			${Monitor(game)}
		</div>
	`
}
