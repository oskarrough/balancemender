import {html} from 'uhtml'
import {log} from '../utils'
import {GameLoop} from '../nodes/game-loop'

export function Menu(game: GameLoop) {
	const toggleMuted = (event: Event) => {
		const checkbox = event.target as HTMLInputElement

		// Use the AudioPlayer to toggle sound and sync with game
		log('menu: toggling sound state')

		// Update game muted state - this will sync with AudioPlayer through the setter
		game.muted = !checkbox.checked

		// Log state for debugging
		log(`menu: sound is now ${game.muted ? 'off' : 'on'}`)

		// Make sure checkbox reflects current state
		checkbox.checked = !game.muted
	}

	function setVolume(event: Event) {
		const range = event.target as HTMLInputElement
		const volume = parseInt(range.value)
		game.audio.volume = volume / 100
	}

	return html`
		<div class="IngameMenu">
			<menu>
				<a class="Button" type="button" href="/">Reset</a>
				<button class="Button" type="button" onclick=${() => game.play()}>Play</button>
				<button class="Button" type="button" onclick=${() => game.pause()}>Pause</button>
				<label class="Button SoundToggle"
					><input type="checkbox" onchange=${toggleMuted} ?checked=${!game.muted} /> Sound
				</label>
				<label class="Button VolumeControl">
					<input type="range" min="0" max="100" value="50" onchange=${setVolume} oninput=${setVolume} />
					Volume
				</label>
			</menu>
		</div>
	`
}
