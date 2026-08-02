import gsap from 'gsap'
import type {GameLoop} from './nodes/game-loop'

export interface NamedAnimation {
	name: string
	/** Set up DOM/game state so the animation has something to animate (debugger previews use this). */
	prepare?: (game: GameLoop) => void
	build: (game: GameLoop) => gsap.core.Timeline
}

/** Splash entrance. Slams the title in, then the dungeon list — quick and done, nothing loops. */
export function buildSplashIntro(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo(
		'.Splash-titleLine',
		{opacity: 0.001, scale: 1.8, y: -40, rotation: -4},
		{
			opacity: 1,
			scale: 1,
			y: 0,
			rotation: 0,
			duration: 0.4,
			stagger: 0.15,
			ease: 'back.out(1.8)',
		},
	)
	tl.fromTo('.Splash-prompt', {autoAlpha: 0, y: 20}, {autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out'}, '>-0.1')
	return tl
}

/** Splash exit. Punches the title out, fades the overlay. */
export function buildSplashOutro(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.to('.Splash-title', {scale: 1.25, autoAlpha: 0, duration: 0.35, ease: 'power2.in'})
	tl.to('.Splash-prompt', {autoAlpha: 0, y: -20, duration: 0.25, ease: 'power2.in'}, '<')
	tl.to('.Splash', {autoAlpha: 0, duration: 0.3, ease: 'power2.in'}, '>-0.1')
	tl.set('.Splash', {display: 'none'})
	return tl
}

/** Crossfade the game back to its already-rendered dungeon list. */
export function buildLeaveGame(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.set('.Splash', {display: 'grid'})
	// Moving the large title during the full-screen fade forces slow repaints, so reset it while hidden.
	tl.set('.Splash-title', {autoAlpha: 1, scale: 1})
	tl.set('.Splash-titleLine', {opacity: 1, scale: 1, y: 0, rotation: 0})
	tl.set('.Splash-prompt', {autoAlpha: 1, y: 0})
	tl.fromTo('.Splash', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.45, ease: 'power2.inOut'})
	tl.to('.AppChrome', {autoAlpha: 0, duration: 0.45, ease: 'power2.inOut'}, 0)
	return tl
}

/** Full intro: splash outro → game intro, scrubbable as one timeline. */
export function buildIntro(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.add(buildSplashOutro())
	tl.add(buildStartGame(), '>-0.3')
	return tl
}

/** Intro sequence. Pure — assumes the game UI is already rendered. */
export function buildStartGame(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo('.AppChrome', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5})
	tl.fromTo('.IngameMenu', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '<')
	tl.fromTo('.AppChrome-game', {autoAlpha: 0}, {autoAlpha: 1, duration: 0.5}, '>-0.1')
	// A percentage rather than a pixel distance, so the bar keeps sliding exactly its own height in from below however tall the icons get.
	tl.fromTo('.ActionBar', {y: '100%', autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.7}, '<')
	tl.fromTo('.PartyGroup', {y: 20, autoAlpha: 0}, {y: 0, autoAlpha: 1, duration: 0.5}, '<0.2')
	tl.fromTo('.Enemies', {x: 100, autoAlpha: 0}, {x: 0, autoAlpha: 1, duration: 0.92}, '<-0.1')
	return tl
}

/** Game-over flourish. Pure — assumes `gameOver` is already true and the `.GameOver` element is rendered. */
export function buildGameOver(): gsap.core.Timeline {
	const tl = gsap.timeline()
	tl.fromTo(
		'.Enemies, .PartyGroup',
		{scale: 1, filter: 'saturate(1)'},
		{scale: 0.9, filter: 'saturate(0.2)', duration: 0.7, ease: 'power3.out'},
	)
	tl.fromTo(
		'.Enemies, .PartyGroup',
		{x: 0},
		{keyframes: {x: [-10, 10, -7, 7, -3, 3, 0]}, duration: 0.5, ease: 'power2.out'},
		'<',
	)
	tl.fromTo(
		'.GameOver',
		{autoAlpha: 0, scale: 0.3, y: -60, rotation: -4},
		{autoAlpha: 1, scale: 1, y: 0, rotation: 0, duration: 0.7, ease: 'back.out(2.2)'},
		'<0.15',
	)
	tl.fromTo(
		'.GameOver > *',
		{autoAlpha: 0, y: 14},
		{autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.08, ease: 'power2.out'},
		'<0.25',
	)
	return tl
}

/**
 * Game-over → fresh fight transition: fade-out → `load` swaps the fight (mid-timeline
 * `.call`, where `game.play()` also fires) → a snappy fade-in. No intro replay — that's first-load
 * only, so a restart is near-instant instead of paying its ~1.5s runtime again.
 */
function toFreshFight(game: GameLoop, load: () => void): gsap.core.Timeline {
	const animatedGame = '.AppChrome-game, .ActionBar, .Enemies, .PartyGroup'
	const clearAnimationState = () => {
		// Reset GSAP's transform cache as well as the CSS. Clearing the property alone lets a later
		// y-only tween compose itself with the cached game-over scale.
		gsap.set(animatedGame, {x: 0, y: 0, scale: 1, filter: 'none', autoAlpha: 1})
		gsap.set(animatedGame, {clearProps: 'transform,filter,opacity,visibility'})
	}
	const tl = gsap.timeline({
		onComplete: () => {
			// The fade-in tween below is built while the game-over styles still exist, so it can cache
			// those old transforms. Clean once more after its final frame, when nothing can reapply them.
			clearAnimationState()
		},
	})
	const ease = 'power2.in'
	tl.to('.GameOver', {autoAlpha: 0, duration: 0.4, ease})
	tl.to('.ActionBar', {y: '100%', autoAlpha: 0, scale: 0.95, duration: 0.4, ease}, '<')
	tl.to('.Enemies, .PartyGroup', {y: -30, autoAlpha: 0, scale: 0.95, duration: 0.4, ease}, '<')
	tl.call(() => {
		load()
		// Game-over and fade-out tweens leave inline transforms and filters behind. Clear them at
		// the state boundary: the filter greys out the fresh frames, while even a zero transform on
		// `.AppChrome-game` creates a stacking context over the fixed menu and intercepts its clicks.
		clearAnimationState()
		// Fires here, not on the timeline's onComplete below — the player can act while the
		// fade-in below is still playing. Malleable stays paused until its visible Play control.
		if (!game.malleable) game.play()
	})
	tl.fromTo(animatedGame, {autoAlpha: 0}, {autoAlpha: 1, duration: 0.2})
	return tl
}

/** Replay the same fight. */
export function restartGame(game: GameLoop): gsap.core.Timeline {
	return toFreshFight(game, () => game.restart())
}

/** On to the next room of the dungeon run — the action records the room's time and loads it. */
export function nextRoom(game: GameLoop): gsap.core.Timeline {
	return toFreshFight(game, () => game.perform({type: 'nextRoom'}))
}

/** Back to the first room of the same dungeon, with a fresh clock. */
export function restartDungeon(game: GameLoop): gsap.core.Timeline {
	return toFreshFight(game, () => {
		const dungeon = game.dungeonRun?.dungeon.id
		if (dungeon) game.perform({type: 'startDungeon', dungeon})
	})
}

const resetSplashForPreview = () => {
	gsap.set('.Splash', {clearProps: 'all'})
	gsap.set('.Splash-bg, .Splash-title, .Splash-titleLine, .Splash-prompt', {
		clearProps: 'all',
	})
}

export const animations: NamedAnimation[] = [
	{
		name: 'Splash intro',
		prepare: resetSplashForPreview,
		build: buildSplashIntro,
	},
	{
		name: 'Splash outro',
		prepare: () => {
			resetSplashForPreview()
			// Put the splash in its "fully visible" idle state so the outro has something to remove.
			buildSplashIntro().progress(1).kill()
		},
		build: buildSplashOutro,
	},
	{
		name: 'New game',
		prepare: (game) => {
			game.gameOver = false
			game.render()
		},
		build: buildStartGame,
	},
	{
		name: 'Game over',
		prepare: (game) => {
			game.gameOver = true
			game.render()
		},
		build: buildGameOver,
	},
	{
		name: 'Restart (fade + intro)',
		prepare: (game) => {
			game.gameOver = true
			game.render()
		},
		build: restartGame,
	},
]
