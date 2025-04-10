import gsap from 'gsap'
import {render} from '../utils'
import {InputManager} from '../input-manager'
import {GameLoop} from '../nodes/game-loop'
import {Menu} from '../components/menu'

export class WebHealer extends HTMLElement {
	connectedCallback() {
		// const urlParams = new URLSearchParams(window.location.search)
		// const muted = urlParams.has('muted')
		// if (muted) game.muted = true

		this.createGame()
	}

	createGame() {
		const game = new GameLoop()
		window.webhealer = game
		game.element = this
		this.setupDevTools(game)
		new InputManager(game)
		render(document.querySelector('#menu'), () => Menu(game))
		game.render()
		// gsap.to('.Frame', { opacity: 1, duration: 1 })
		gsap.set('.Frame', {opacity: 1})
	}

	setupDevTools(game) {
		const devConsole = document.querySelector('dev-console')
		if (!devConsole) {
			console.error('Dev console element not found in the DOM')
			return
		}
		devConsole.init(game)
		game.console = devConsole
	}
}

customElements.define('web-healer', WebHealer)

