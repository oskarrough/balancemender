import {GameLoop} from './nodes/game-loop'
import {logCombat} from './combatlog'

/** The keys that are about the game rather than about one spell — the action bar handles those. */
export class InputManager {
	constructor(private game: GameLoop) {
		document.addEventListener('keydown', (event) => this.handleKeydown(event))
	}

	private handleKeydown(event: KeyboardEvent) {
		if (event.code === 'Space' && !event.repeat && !this.game.gameOver) {
			// Space in a dev panel's input is a space, not a pause.
			if (document.activeElement instanceof HTMLInputElement) return
			event.preventDefault() // or the page scrolls
			this.togglePlayPause()
		}

		if (event.key === '`' || event.key === '~') {
			event.preventDefault()
			this.toggleConsole()
		}

		if (event.key === 'Escape') {
			this.game.player.selectedTarget = undefined
			this.closeConsole()
		}
	}

	togglePlayPause() {
		if (this.game.running) {
			this.game.pause()
			logCombat({timestamp: Date.now(), eventType: 'GAME_PAUSE'})
		} else {
			this.game.play()
			logCombat({timestamp: Date.now(), eventType: 'GAME_RESUME'})
		}
	}

	toggleConsole() {
		this.game.console?.toggleConsole()
	}

	closeConsole() {
		if (this.game.console) {
			const floatingView = this.game.console.closest('floating-view')
			if (floatingView && !floatingView.hasAttribute('minimized')) {
				floatingView.setAttribute('minimized', '')
			}
		}
	}
}
