import {html} from 'uhtml'
import {log} from '../utils'
import {GameLoop} from '../nodes/game-loop'
import {restartGame} from '../animations'

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
				<button class="Button" type="button" onclick=${toggleRunning}>${game.running ? 'Pause' : 'Play'}</button>
				<button class="Button" type="button" onclick=${() => restartGame(game)}>Reset</button>
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
