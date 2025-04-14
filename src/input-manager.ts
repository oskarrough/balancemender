import {GameLoop} from './nodes/game-loop'
import {logCombat} from './combatlog'

export class InputManager {
	private game: GameLoop

	constructor(game: GameLoop) {
		this.game = game
		this.setupKeyboardHandlers()
	}

	private setupKeyboardHandlers() {
		document.addEventListener('keydown', (event) => this.handleKeydown(event))
	}

	private handleKeydown(event: KeyboardEvent) {
		// Toggle play/pause with spacebar
		if (event.code === 'Space' && !event.repeat && !this.game.gameOver) {
			if (document.activeElement instanceof HTMLInputElement) return
			event.preventDefault() // Prevent scrolling with spacebar
			this.togglePlayPause()
		}

		// Toggle console with backtick/tilde
		if (event.key === '`' || event.key === '~') {
			event.preventDefault()
			this.toggleConsole()
		}

		// Close console with Escape
		if (event.key === 'Escape') {
			this.game.player.currentTarget = undefined
			this.closeConsole()
		}
	}

	togglePlayPause() {
		if (this.game.running) {
			this.game.pause()
			logCombat({eventType: 'GAME_PAUSE'})
		} else {
			this.game.play()
			logCombat({eventType: 'GAME_RESUME'})
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
