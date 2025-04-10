import kaplay from 'kaplay'

export class Healer2d extends HTMLElement {
	connectedCallback() {
		const k = kaplay({
			debug: true,
			width: 500,
			height: 500,
			font: 'Proza Libre',
			// crisp: true,
			root: this,
			global: false,
			background: '#eeeeee',
			tagsAsComponents: true,
		})

		const {
			scene,
			add,
			onKeyPress,
			go,
			rect,
			pos,
			area,
			text,
			body,
			color,
			rotate,
			anchor,
			vec2,
		} = k

		const createMob = (vec) => add([area(), body(), rect(64, 64), pos(vec), 'mob'])
		// const createPlayer = () => add([area(), rect(64, 64)])
		// const createEnemy = () => add([area(), rect(64, 64)])
		// add([
		// 	pos(100, 200),
		// 	rect(64, 64),
		// 	color(50, 10, 200),
		// 	anchor(k.vec2(0, 0)),
		// 	area(),
		// 	body(),
		// 	'player',
		// ])
		// const eyes = player.add([rect(16, 16), anchor(k.vec2(-2, 0)), rotate(0), 'eyes'])

		const gameScene = scene('game', () => {
			const player = createMob(vec2(100, 200))
			player.use(color(50, 10, 200))
			const enemy = createMob(vec2(300, 200))
			enemy.use(color(250, 10, 20))

			const score = add([
				text('0', {
					size: 20,
					font: 'Proza Libre',
				}),
				pos(16, 16),
				color(20, 10, 10),
				{value: 0},
				'ui',
			])

			const wall = add([
				rect(48, k.height() * 0.6),
				pos(k.width() / 2 - 35, k.height() * 0.2),
				k.outline(4),
				area(),
				body({isStatic: true}),
				color(127, 200, 255),
				'wall',
			])

			// onCollide which is fired when the collision starts.
			// onCollideUpdate which is fired during collision.
			// onCollideEnd which is fired when the collision ends.
			player.onCollide('enemy', () => {
				score.value += 1
				score.text = score.value
				// k.destroy(player)
				// go('lose')
			})
			player.onUpdate(() => {
				// if (player.isColliding(bomb)) {
				// }
			})

			const SPEED = 300

			onKeyPress('space', () => {
				console.log('space is the place')
				player.moveBy(SPEED, SPEED)
			})

			const {LEFT, RIGHT, UP, DOWN} = k

			const dirs = {
				left: LEFT,
				right: RIGHT,
				up: UP,
				down: DOWN,
				a: LEFT,
				d: RIGHT,
				w: UP,
				s: DOWN,
			}

			for (const [dir, vec] of Object.entries(dirs)) {
				player.onKeyDown(dir, () => {
					player.move(vec.scale(SPEED))
				})
			}

			// k.onKeyDown('w', () => {
			// 	player.moveBy(0, -speed)
			// })
			// k.onKeyDown('s', () => {
			// 	player.moveBy(0, speed)
			// })
			// k.onKeyDown('a', () => {
			// 	player.moveBy(-speed, 0)
			// })
			// k.onKeyDown('d', () => {
			// 	player.moveBy(speed, 0)
			// })
		})

		scene('lose', () => {
			add([k.text('loss'), pos(k.width() / 2, k.height() / 2)])
		})

		scene('win', () => {})

		go('game')
	}
}

customElements.define('healer-2d', Healer2d)
