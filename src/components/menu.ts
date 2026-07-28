import {html} from 'uhtml'
import {log} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {restartGame} from '../animations'

export function Menu(game: GameLoop) {
	// The checkbox reads "Sound", so it is checked when the game is *not* muted.
	const toggleMuted = (event: Event) => {
		const checkbox = event.target as HTMLInputElement
		game.muted = !checkbox.checked
		log(`menu: sound is now ${game.muted ? 'off' : 'on'}`)
	}

	function setVolume(event: Event) {
		const range = event.target as HTMLInputElement
		const volume = parseInt(range.value)
		game.audio.volume = volume / 100
	}

	return html`
		<div class="IngameMenu">
			<menu>
				<button class="Button" type="button" onclick=${() => restartGame(game)}>Reset</button>
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
