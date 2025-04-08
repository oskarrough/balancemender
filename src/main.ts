import {render} from './utils'
import {GameLoop} from './nodes/game-loop'
import {Menu} from './components/menu'
import gsap from 'gsap'
import {DevConsole} from './components/dev-console'
import {InputManager} from './input-manager'
import './components/dev-console'
import './components/floating-view.js'
import './components/combat-log-viewer.js'
import './components/color-palette.js'
import './style.css'

/**
 * Main entry point for the game.
 * Renders two components, the splash "menu" and the "game" itself.
 */
function main() {
	const game = new GameLoop()
	game.element = document.querySelector('#webhealer')
	game.render()
	setupDevTools(game)
	new InputManager(game)
	// @ts-ignore
	window.webhealer = game
	render(document.querySelector('#menu')!, () => Menu(game))
	gsap.to('.Frame', {opacity: 1, duration: 1})
	const urlParams = new URLSearchParams(window.location.search)
	const muted = urlParams.has('muted')
	if (muted) game.muted = true
	gsap.to('.Frame', {opacity: 1, duration: 2})
}

function setupDevTools(game: GameLoop) {
	const devConsole = document.querySelector('dev-console') as DevConsole
	if (!devConsole) {
		console.error('Dev console element not found in the DOM')
		return
	}
	devConsole.init(game)
	game.console = devConsole
}

main()
