import {html} from 'uhtml'
import {log} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {restartGame} from '../animations'

/**
 * Which dungeon, how far in, which room. Nothing at all outside a dungeon run.
 * Pager dots flank the pill — cleared rooms filled on the left, upcoming hollow on the
 * right, the pill itself standing in for the current room.
 */
function DungeonPager(game: GameLoop) {
	const run = game.dungeonRun
	if (!run) return null
	const rooms = run.dungeon.rooms
	const dot = (room: (typeof rooms)[number], cleared: boolean) =>
		html`<i
			class="DungeonPager-dot"
			data-cleared=${cleared}
			title=${cleared ? `${room.name} — cleared` : room.name}
		></i>`
	return html`
		<nav class="DungeonPager">
			<button class="Button" type="button" onclick=${leaveDungeon}>Leave</button>
			<span class="DungeonPager-pages">
				<span class="DungeonPager-dots">${rooms.slice(0, run.room).map((room) => dot(room, true))}</span>
				<p class="DungeonPager-pill">
					<span class="DungeonPager-dungeon">${run.dungeon.name}</span>
					<span class="DungeonPager-count">${run.room + 1}/${rooms.length}</span>
					<span class="DungeonPager-room">${rooms[run.room]?.name}</span>
				</p>
				<span class="DungeonPager-dots">${rooms.slice(run.room + 1).map((room) => dot(room, false))}</span>
			</span>
		</nav>
	`
}

/** Dungeon choice is the app's start state, so leaving is a clean return rather than a half-reset fight. */
function leaveDungeon() {
	window.location.assign(window.location.pathname)
}

export function Menu(game: GameLoop) {
	// The checkbox reads "Sound", so it is checked when the game is *not* muted.
	const toggleMuted = (event: Event) => {
		const checkbox = event.target as HTMLInputElement
		game.perform({type: 'set', key: 'muted', value: !checkbox.checked})
		log(`menu: sound is now ${game.muted ? 'off' : 'on'}`)
	}

	function setVolume(event: Event) {
		const range = event.target as HTMLInputElement
		const volume = parseInt(range.value)
		game.audio.volume = volume / 100
	}

	// Pausing stops the frames that would repaint this menu, so repaint it by hand.
	const toggleRunning = () => {
		game.perform({type: 'running', value: !game.running})
		game.render()
	}

	return html`
		<div class="IngameMenu">
			<menu>
				<div class="Menu-dungeon">
					${DungeonPager(game)}
					<div class="Menu-actions">
						<button class="Button Menu-running" type="button" onclick=${toggleRunning}>
							${game.running ? 'Pause' : 'Play'}
						</button>
						<button class="Button" type="button" onclick=${() => restartGame(game)}>Reset</button>
					</div>
				</div>
				<label class="Button SoundToggle"
					><input type="checkbox" onchange=${toggleMuted} ?checked=${!game.muted} /> Sound
				</label>
				${game.muted
					? null
					: html`<label class="Button VolumeControl">
							<input
								type="range"
								min="0"
								max="100"
								value=${Math.round(game.audio.volume * 100)}
								onchange=${setVolume}
								oninput=${setVolume}
							/>
							Volume
						</label>`}
			</menu>
		</div>
	`
}
