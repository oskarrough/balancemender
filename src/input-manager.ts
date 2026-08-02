import {GameLoop} from './nodes/game-loop'

/** The keys that are about the game rather than about one spell — the action bar handles those. */
export class InputManager {
	constructor(private game: GameLoop) {
		document.addEventListener('keydown', this.handleKeydown)
	}

	destroy() {
		document.removeEventListener('keydown', this.handleKeydown)
	}

	private handleKeydown = (event: KeyboardEvent) => {
		if (event.code === 'Space' && !event.repeat && !this.game.gameOver && !this.game.malleable) {
			// Space in a dev panel's input is a space, and on a unit button it is native activation.
			if (
				document.activeElement instanceof HTMLInputElement ||
				(event.target instanceof HTMLButtonElement && event.target.matches('.Unit-target'))
			)
				return
			event.preventDefault() // or the page scrolls
			this.game.perform({type: 'running', value: !this.game.running})
		}

		if (event.key === '`' || event.key === '~') {
			event.preventDefault()
			this.game.console?.toggleConsole()
		}

		if (event.key === 'Escape') {
			this.game.perform({type: 'target'})
			if (this.game.console) {
				const floatingView = this.game.console.closest('floating-view')
				if (floatingView && !floatingView.hasAttribute('minimized')) {
					floatingView.setAttribute('minimized', '')
				}
			}
		}
	}
}
