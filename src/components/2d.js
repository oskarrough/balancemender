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
			onMouseMove,
			onUpdate,
			mousePos,
			circle,
		} = k

		const createMob = (vec, mobColor = [50, 50, 200]) =>
			add([
				area(),
				body(),
				rect(64, 64),
				pos(vec),
				color(...mobColor),
				anchor('center'),
				'mob',
			])

		scene('game', () => {
			const player = createMob(vec2(100, 200), [50, 10, 200])

			// Add weapon/aiming indicator
			const weapon = player.add([
				rect(40, 8),
				pos(0, 0),
				anchor('left'),
				color(150, 150, 150),
				rotate(0),
				'weapon',
			])

			// Add eyes to player
			const eyes = player.add([circle(5), pos(15, -10), color(255, 255, 255), 'eyes'])
			const eyes2 = player.add([circle(5), pos(15, 10), color(255, 255, 255), 'eyes'])

			// Add pupils to eyes that will move slightly based on aim direction
			const pupil1 = eyes.add([circle(2), pos(0, 0), color(0, 0, 0), 'pupil'])
			const pupil2 = eyes2.add([circle(2), pos(0, 0), color(0, 0, 0), 'pupil'])

			// Update eyes and weapon on mouse move
			onMouseMove(() => {
				// Convert mouse position to world coordinates
				const worldMousePos = k.toWorld(mousePos())
				const direction = worldMousePos.sub(player.pos)
				const angle = direction.angle()
				
				// Update weapon rotation
				weapon.angle = angle
				
				// Calculate pupil offset (max 2 pixels in the look direction)
				const pupilOffset = direction.unit().scale(2)
				pupil1.pos = vec2(pupilOffset.x, pupilOffset.y)
				pupil2.pos = vec2(pupilOffset.x, pupilOffset.y)
				
				// Flip weapon if pointing left
				if (Math.abs(angle) > 90) {
					weapon.flipY = true
				} else {
					weapon.flipY = false
				}
			})

			const enemy = createMob(vec2(300, 200), [250, 10, 20])

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

			player.onCollide('enemy', () => {
				score.value += 1
				score.text = score.value
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

			// Add camera follow
			onUpdate(() => {
				k.camPos(k.camPos().lerp(player.pos, k.dt() * 3))
			})
		})

		scene('lose', () => {
			add([k.text('loss'), pos(k.width() / 2, k.height() / 2)])
		})

		scene('win', () => {})

		go('game')
	}
}

customElements.define('healer-2d', Healer2d)
