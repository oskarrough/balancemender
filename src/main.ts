import {render} from './utils'
import {GameLoop} from './nodes/game-loop'
import {Menu} from './components/menu'
import gsap from 'gsap'
import {DevConsole} from './components/dev-console'
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

	// Initialize developer tools outside of the game loop
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
	gsap.to('.Frame', {opacity: 1, duration: 2})
	// }
}

/**
 * Setup developer tools
 */
function setupDevTools(game: GameLoop) {
	console.log('Setting up dev tools...')

	const devConsole = document.querySelector('dev-console') as DevConsole
	if (!devConsole) {
		console.error('Dev console element not found in the DOM')
		return
	}

	devConsole.init(game)
	game.console = devConsole
	console.log('Dev console initialized and assigned to game')
}

main()
