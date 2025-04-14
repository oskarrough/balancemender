import kaplay from 'kaplay'

// Game configuration
const GAME_CONFIG = {
	width: 500,
	height: 500,
	debug: true,
	font: 'Proza Libre',
	background: '#eeeeee',
	gravityScale: 0,
}

// Game entities and systems
function createGame(rootElement) {
	const k = kaplay({
		...GAME_CONFIG,
		root: rootElement,
		global: false,
		tagsAsComponents: true,
	})

	return {
		k,
		start() {
			setupScenes(k)
			k.go('game')
		},
	}
}

function setupScenes(k) {
	const {scene} = k

	scene('game', () => createGameScene(k))
	scene('lose', () => createLoseScene(k))
	scene('win', () => {})
}

function createGameScene(k) {
	const {vec2} = k
	const player = createPlayer(k, vec2(100, 200))
	const enemy = createEnemy(k, vec2(300, 200))
	const wall = createWall(k)
	const score = createScoreCounter(k)

	setupCollisions(k, player, enemy, score)
	setupPlayerInput(k, player)
	setupCamera(k, player)
}

function createPlayer(k, position) {
	const {add, rect, pos, area, body, color, anchor, rotate, circle} = k

	const player = add([
		area(),
		body(),
		rect(64, 64),
		pos(position),
		color(50, 10, 200),
		anchor('center'),
		'player',
		'mob',
	])

	// Add weapon/aiming indicator
	const weapon = player.add([
		rect(40, 8),
		pos(0, 0),
		anchor('left'),
		color(150, 150, 150),
		rotate(0),
		'weapon',
	])

	// Add eyes & pupils
	const eyes = [
		player.add([circle(5), pos(15, -10), color(255, 255, 255), 'eyes']),
		player.add([circle(5), pos(15, 10), color(255, 255, 255), 'eyes']),
	]
	const pupils = eyes.map((eye) =>
		eye.add([circle(2), pos(0, 0), color(0, 0, 0), 'pupil']),
	)

	setupAimTracking(k, player, weapon, pupils)

	return player
}

function setupAimTracking(k, player, weapon, pupils) {
	const {onMouseMove, mousePos, vec2} = k

	onMouseMove(() => {
		// Convert mouse position to world coordinates
		const worldMousePos = k.toWorld(mousePos())
		const direction = worldMousePos.sub(player.pos)
		const angle = direction.angle()

		// Update weapon rotation
		weapon.angle = angle

		// Calculate pupil offset (max 2 pixels in the look direction)
		const pupilOffset = direction.unit().scale(2)

		// Update all pupils
		pupils.forEach((pupil) => {
			pupil.pos = vec2(pupilOffset.x, pupilOffset.y)
		})

		// Flip weapon if pointing left
		weapon.flipY = Math.abs(angle) > 90
	})
}

function createEnemy(k, position) {
	const {add, rect, pos, area, body, color, anchor} = k

	return add([
		area(),
		body(),
		rect(64, 64),
		pos(position),
		color(250, 10, 20),
		anchor('center'),
		'enemy',
		'mob',
	])
}

function createWall(k) {
	const {add, rect, pos, area, body, color, outline, height, width} = k

	return add([
		rect(32, height() * 0.6),
		pos(width() / 2 - 35, height() * 0.2),
		outline(3),
		area(),
		body({isStatic: true}),
		color(127, 200, 255),
		'wall',
	])
}

function createScoreCounter(k) {
	const {add, text, pos, color} = k

	return add([
		text('0', {
			size: 20,
			font: 'Proza Libre',
		}),
		pos(16, 16),
		color(20, 10, 10),
		{value: 0},
		'ui',
	])
}

function setupCollisions(k, player, enemy, score) {
	player.onCollide('enemy', () => {
		score.value += 1
		score.text = score.value
	})
}

function setupPlayerInput(k, player) {
	const {onKeyDown, onKeyPress} = k
	const SPEED = 300

	const dirs = {
		left: k.LEFT,
		right: k.RIGHT,
		up: k.UP,
		down: k.DOWN,
		a: k.LEFT,
		d: k.RIGHT,
		w: k.UP,
		s: k.DOWN,
	}

	for (const [dir, vec] of Object.entries(dirs)) {
		onKeyDown(dir, () => {
			player.move(vec.scale(SPEED))
		})
	}

	onKeyPress('space', () => {
		player.moveBy(SPEED, SPEED)
	})
}

function setupCamera(k, player) {
	const {onUpdate} = k

	onUpdate(() => {
		k.camPos(k.camPos().lerp(player.pos, k.dt() * 3))
	})
}

function createLoseScene(k) {
	const {add, text, pos, width, height} = k

	add([text('loss'), pos(width() / 2, height() / 2)])
}

// Web component that orchestrates the game
export class Healer2d extends HTMLElement {
	connectedCallback() {
		const game = createGame(this)
		game.start()
	}
}

customElements.define('healer-2d', Healer2d)
