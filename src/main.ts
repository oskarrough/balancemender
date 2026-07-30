import {render} from 'uhtml'
import {GameLoop} from './nodes/game-loop'
import {UI} from './components/ui'
import {Menu} from './components/menu'
import {buildSplashIntro, buildIntro} from './animations'
import {DevConsole} from './components/dev-console'
import {AnimationDebugger} from './components/animation-debugger'
import {InputManager} from './input-manager'
import {loadFightHistory} from './fight-history'
import './components/dev-console'
import './components/animation-debugger'
import {applyDefaultLayout} from './components/floating-view.js'
import './components/floating-view.js'
import './components/combat-log-viewer.js'
import './components/fight-report'
import './components/color-palette.js'
import './components/balance-monitor.js'
import './components/balance-lab'

/**
 * Main entry point for the game.
 * Renders two components, the splash "menu" and the "game" itself.
 */
function main() {
	// Panels upgrade synchronously when floating-view.js defines the element, so they have
	// their intrinsic size by now and the rails can stack them.
	applyDefaultLayout()

	void loadFightHistory().catch((err) => console.error('Failed to load fight history', err))

	const skipSplash = new URLSearchParams(window.location.search).has('nosplash')

	// Wait for web fonts before animating the splash — otherwise "Rubik 80s Fade" swaps in mid-tween
	// and re-rasterizes the giant title, which reads as jank no matter what GSAP does.
	let splashIntro: ReturnType<typeof buildSplashIntro> | null = null
	if (!skipSplash)
		void document.fonts.ready.then(() => {
		// Small breather so any final layout/paint settles before the title slams in.
			setTimeout(() => {
				splashIntro = buildSplashIntro()
			}, 500)
		})
	const debugSplash = new URLSearchParams(window.location.search).has('debug-splash')

	if (debugSplash) {
		// Hold the splash up and hand it to the animation debugger so we can scrub the intro/outro.
		const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
		animDebugger?.init(null)
		return
	}

	// Ignore the first pointer/key event right after the tab regains focus — clicking back
	// into the window to refocus shouldn't count as "press any key to start".
	let ignoreUntil = 0
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') ignoreUntil = performance.now() + 200
	})

	const startGame = (e?: Event) => {
		if (performance.now() < ignoreUntil) return
		// Ignore clicks/keys that originate inside a floating dev panel — those are for tooling, not "start the game".
		if (e && (e.target as Element | null)?.closest('floating-view')) return
		window.removeEventListener('keydown', startGame)
		window.removeEventListener('pointerdown', startGame)
		splashIntro?.kill()

		// Construct the game only now — vroum's Loop schedules `mount()` and starts ticking immediately on construction.
		const game = new GameLoop()
		// vroum's mount() runs in a microtask and sets running=true, so a synchronous pause()
		// here would be overwritten. Queue it so it lands after mount.
		queueMicrotask(() => game.pause())
		const element = document.querySelector('#game')
		if (element) game.draw = () => render(element, UI(game))
		setupDevTools(game)
		// @ts-ignore
		window.balancemender = game
		const urlParams = new URLSearchParams(window.location.search)
		if (urlParams.has('muted')) game.muted = true

		const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
		animDebugger?.init(game)

		game.render()
		render(document.querySelector('#menu')!, () => Menu(game))
		new InputManager(game)

		const intro = buildIntro(game)
		intro.eventCallback('onComplete', () => game.play())
	}
	window.addEventListener('keydown', startGame)
	window.addEventListener('pointerdown', startGame)
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
