import {html, render} from 'uhtml'
import {GameLoop} from './nodes/game-loop'
import {UI} from './components/ui'
import {Menu} from './components/menu'
import {buildSplashIntro, buildIntro} from './animations'
import {DevConsole} from './components/dev-console'
import {AnimationDebugger} from './components/animation-debugger'
import {InputManager} from './input-manager'
import {installTooltips, drawTooltip} from './components/tooltip'
import * as perf from './perf'
import {loadFightHistory} from './fight-history'
import {dungeonRegistry} from './nodes/dungeon'
import './components/dev-console'
import './components/animation-debugger'
import {applyDefaultLayout} from './components/floating-view.js'
import './components/floating-view.js'
import './components/combat-log-viewer.js'
import './components/fight-report'
import './components/color-palette.js'
import './components/balance-lab'

/**
 * Main entry point for the game.
 * Renders two components, the splash "menu" and the "game" itself.
 */
function main() {
	// Panels upgrade synchronously when floating-view.js defines the element, so they have
	// their intrinsic size by now and the rails can stack them.
	applyDefaultLayout()
	installTooltips()

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
			}, 100)
		})
	const debugSplash = new URLSearchParams(window.location.search).has('debug-splash')

	const startGame = (dungeonId: string) => {
		splashIntro?.kill()

		// Construct the game only now — vroum's Loop schedules `mount()` and starts ticking immediately on construction.
		const game = new GameLoop()
		game.perform({type: 'startDungeon', dungeon: dungeonId})
		// vroum's mount() runs in a microtask and sets running=true, so a synchronous pause()
		// here would be overwritten. Queue it so it lands after mount.
		queueMicrotask(() => game.pause())
		const element = document.querySelector('#game')
		const menuElement = document.querySelector('#menu')
		// The menu redraws with the game so its Play/Pause toggle tracks state changed elsewhere.
		game.draw = () => {
			perf.interval('frame')
			perf.measure('draw', () => {
				if (element) perf.measure('draw:ui', () => render(element, UI(game)))
				if (menuElement) perf.measure('draw:menu', () => render(menuElement, () => Menu(game)))
				perf.measure('draw:tooltip', () => drawTooltip(game))
			})
		}
		setupDevTools(game)
		// @ts-ignore
		window.balancemender = game
		// @ts-ignore
		window.perf = perf
		const urlParams = new URLSearchParams(window.location.search)
		if (urlParams.has('muted')) game.muted = true

		const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
		animDebugger?.init(game)

		game.render()
		new InputManager(game)

		const intro = buildIntro(game)
		intro.eventCallback('onComplete', () => game.play())
		// ?nosplash jumps the whole intro to its end state — game running on first paint.
		// progress(1) fires onComplete's play() synchronously, but the pause() queued at
		// construction hasn't run yet and would override it — queue play() behind it.
		if (skipSplash) {
			intro.progress(1)
			queueMicrotask(() => game.play())
		}
	}
	// One step: the splash IS the dungeon list. A tap on a dungeon starts the run.
	const prompt = document.querySelector('.Splash-prompt')
	if (prompt && !skipSplash)
		render(
			prompt,
			html`<span class="Splash-dungeonsHeading">Choose your dungeon</span>
				<div class="Splash-dungeons">
					${Object.values(dungeonRegistry).map((dungeon) => {
						const wallpaper = dungeon.rooms[0]?.wallpaper
						return html`
							<button
								class="Button Splash-dungeon"
								type="button"
								style=${wallpaper ? `--dungeon-image: url(${wallpaper})` : ''}
								onclick=${() => startGame(dungeon.id)}
							>
								${dungeon.name}
								<small>${dungeon.rooms.length} rooms</small>
							</button>
						`
					})}
				</div>`,
		)

	if (debugSplash) {
		// Hold the splash up and hand it to the animation debugger so we can scrub the intro/outro.
		const animDebugger = document.querySelector('animation-debugger') as AnimationDebugger | null
		animDebugger?.init(null)
		return
	}

	if (skipSplash) startGame('TheGreen')
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
