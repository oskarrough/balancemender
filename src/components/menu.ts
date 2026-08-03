import {html} from 'uhtml'
import {log} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {restartDungeon, restartGame} from '../animations'
import {resetDefaultLayout} from './floating-view.js'

/** Current dungeon or room title. Dots show dungeon progress; the custom room gets the same bar without them. */
function DungeonPager(game: GameLoop, leave: () => void) {
	const run = game.dungeonRun
	if (!run) {
		if (!game.malleable) return null
		return html`
			<nav class="DungeonPager">
				<button class="Button" type="button" onclick=${leave}>Leave</button>
				<span class="DungeonPager-pages">
					<p class="DungeonPager-pill"><span class="DungeonPager-dungeon">Custom Room</span></p>
				</span>
			</nav>
		`
	}

	const rooms = run.dungeon.rooms
	const dot = (room: (typeof rooms)[number], cleared: boolean) =>
		html`<i
			class="DungeonPager-dot"
			data-cleared=${cleared}
			title=${cleared ? `${room.name} — cleared` : room.name}
		></i>`
	return html`
		<nav class="DungeonPager">
			<button class="Button" type="button" onclick=${leave}>Leave & resume later</button>
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

export function Menu(game: GameLoop, leave: () => void) {
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
					${DungeonPager(game, leave)}
					<div class="Menu-actions">
						<button class="Button Menu-running" type="button" onclick=${toggleRunning}>
							${game.running ? 'Pause' : 'Play'}
						</button>
						<button class="Button" type="button" onclick=${() => restartGame(game)}>Restart room</button>
						${game.dungeonRun
							? html`<button class="Button" type="button" onclick=${() => restartDungeon(game)}>
									Restart dungeon
								</button>`
							: null}
					</div>
				</div>
				<button class="Button" type="button" onclick=${resetDefaultLayout}>Tidy Panels</button>
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
