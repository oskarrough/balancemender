import {render} from './utils'
import {GameLoop} from './nodes/game-loop'
import {Menu} from './components/menu'
import {buildStartGame} from './animations'
import {DevConsole} from './components/dev-console'
import {AnimationDebugger} from './components/animation-debugger'
import {InputManager} from './input-manager'
import './components/dev-console'
import './components/animation-debugger'
import './components/floating-view.js'
import './components/combat-log-viewer.js'
import './components/color-palette.js'
import './components/balance-monitor.js'
import './style.css'

/**
 * Main entry point for the game.
 * Renders two components, the splash "menu" and the "game" itself.
 */
function main() {
	const game = new GameLoop()
	game.element = document.querySelector('#balancemender')
	game.render()
	setupDevTools(game)
	new InputManager(game)
	// @ts-ignore
	window.balancemender = game
	render(document.querySelector('#menu')!, () => Menu(game))
	const urlParams = new URLSearchParams(window.location.search)
	const muted = urlParams.has('muted')
	if (muted) game.muted = true

	const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
	animDebugger?.init(game)

	const intro = buildStartGame(game)
	intro.eventCallback('onComplete', () => game.play())
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
