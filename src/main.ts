import {render} from './utils'
import {GameLoop} from './nodes/game-loop'
import {Menu} from './components/menu'
import './style.css'
import gsap from 'gsap'
import './components/dev-console'
import {DevConsole} from './components/dev-console'

/**
 * Main entry point for the game.
 * Renders two components, the static "menu" and the "game loop" itself.
 */
function main() {
	const game = new GameLoop()
	game.element = document.querySelector('#webhealer')
	game.render()

	setupDevTools(game)

	// @ts-ignore
	window.webhealer = game

	render(document.querySelector('#menu')!, () => Menu(game))

	gsap.to('.Frame', {opacity: 1, duration: 1})

	const urlParams = new URLSearchParams(window.location.search)

	const muted = urlParams.has('muted')
	if (muted) game.muted = true

	// const debug = urlParams.has('debug')
	// if (true || debug) {
	// gsap.set('.Menu, .Frame-splashImage', {autoAlpha: 0})
	//  gsap.set('.Menu', {autoAlpha: 1})
	// animatedStartGame(game, 1)
	// } else {
	// gsap.to('.Frame', {opacity: 1, duration: 2})
	// }

	// Add a global function to toggle the console (for testing)
	// @ts-ignore
	window.toggleDevConsole = () => {
		if (game.developerConsole) {
			game.developerConsole.toggleConsole()
		}
	}
}

function setupDevTools(game: GameLoop) {
	const devConsole = document.querySelector('dev-console') as DevConsole
	if (!devConsole) {
		console.error('Dev console element not found in the DOM')
		return
	}

	devConsole.init(game)
	game.developerConsole = devConsole
}

main()
