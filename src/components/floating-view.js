import {store} from '../store.js'
import {Draggable} from 'gsap/Draggable'
import {gsap} from 'gsap'
gsap.registerPlugin(Draggable)

let topZ = 100

/** Raise any panel above the floating views and other raiseable panels. */
export function bringToFront(panel) {
	const zIndexes = [...document.querySelectorAll('floating-view, .GameOver')].map((element) =>
		Number.parseInt(getComputedStyle(element).zIndex, 10),
	)
	topZ = Math.max(topZ, ...zIndexes.filter(Number.isFinite)) + 1
	panel.style.zIndex = String(topZ)
}

/** A draggable, resizable, minimizable panel with persisted layout via the store */
class FloatingView extends HTMLElement {
	constructor() {
		super()
	}

	static get config() {
		return {
			minWidth: 200,
			minHeight: 20,
			visibleEdge: 100,
			visibleTop: 40,
		}
	}

	// Calculate boundaries to keep the view within viewport
	calculateBounds() {
		const {visibleEdge, visibleTop} = FloatingView.config
		return {
			minX: 0,
			maxX: Math.max(0, window.innerWidth - visibleEdge),
			minY: 0,
			maxY: Math.max(0, window.innerHeight - visibleTop),
		}
	}

	connectedCallback() {
		this.restoreLayout()
		this.addEventListener('pointerdown', () => bringToFront(this))
		this.draggable()
		this.resizable()
		this.minimizable()
		window.addEventListener('resize', this.handleResize.bind(this))
	}

	restoreLayout() {
		const viewId = this.id || this.getAttribute('data-view-id')
		// getRow() returns {} for a missing row, so ask hasRow() whether this panel was ever saved.
		if (!store.hasRow('floating-views', viewId)) return
		const row = store.getRow('floating-views', viewId)
		const {minWidth, minHeight} = FloatingView.config
		const width = Math.max(minWidth, Math.min(row.width, window.innerWidth))
		const height = Math.max(minHeight, Math.min(row.height, window.innerHeight))
		// Clamp against the panel's own size, not minWidth, so a panel saved near the right edge
		// of a wide screen doesn't restore mostly off-screen on a smaller one.
		const x = Math.max(0, Math.min(row.x, window.innerWidth - width))
		const y = Math.max(0, Math.min(row.y, window.innerHeight - minHeight))
		if (this.hasAttribute('minimized')) {
			gsap.set(this, {x, y})
		} else {
			gsap.set(this, {width, height, x, y})
		}
	}

	draggable() {
		Draggable.create(this, {
			type: 'x,y',
			trigger: this.querySelector(':scope > header'),
			zIndexBoost: false,
			bounds: this.calculateBounds(),
			inertia: true,
			onDragEnd: () => this.saveLayout(),
		})
	}

	resizable() {
		// Create and append the resize handle
		const resizeHandle = document.createElement('div')
		resizeHandle.className = 'resize-handle'
		resizeHandle.innerHTML = '⟋'
		this.appendChild(resizeHandle)

		let startWidth, startHeight, startX, startY
		const {minWidth, minHeight} = FloatingView.config

		let openedOnDrag = false

		const startResize = (e) => {
			e.preventDefault()
			openedOnDrag = false
			startWidth = this.offsetWidth
			startHeight = this.offsetHeight
			startX = e.clientX
			startY = e.clientY
			document.addEventListener('mousemove', resize)
			document.addEventListener('mouseup', stopResize)
		}

		const resize = (e) => {
			if (!openedOnDrag && this.hasAttribute('minimized')) {
				this.style.height = `${startHeight}px`
				this.removeAttribute('minimized')
				openedOnDrag = true
			}
			const width = Math.max(minWidth, startWidth + (e.clientX - startX))
			const height = Math.max(minHeight, startHeight + (e.clientY - startY))
			this.style.width = `${width}px`
			this.style.height = `${height}px`
		}

		const stopResize = () => {
			document.removeEventListener('mousemove', resize)
			document.removeEventListener('mouseup', stopResize)
			this.saveLayout()
		}

		resizeHandle.addEventListener('mousedown', startResize)
	}

	minimizable() {
		this.addEventListener('dblclick', (e) => {
			if (e.target.closest('header') === this.querySelector(':scope > header')) {
				e.currentTarget.toggleAttribute('minimized')
				e.currentTarget.style.height = 'auto'
			}
		})
	}

	saveLayout() {
		const viewId = this.id || this.getAttribute('data-view-id')
		if (!viewId) return

		const width = this.offsetWidth
		const height = this.offsetHeight

		const matrix = new DOMMatrixReadOnly(this.style.transform)
		const x = matrix.m41
		const y = matrix.m42

		if (store.hasRow('floating-views', viewId)) {
			store.setPartialRow('floating-views', viewId, {width, height, x, y})
		} else {
			store.setRow('floating-views', viewId, {width, height, x, y, type: 'view'})
		}
	}

	handleResize() {
		const draggable = Draggable.get(this)
		if (draggable) draggable.applyBounds(this.calculateBounds())
	}
}

customElements.define('floating-view', FloatingView)

const LAYOUT = {
	gap: 8,
	/** Rails start below the in-game menu (.IngameMenu) */
	railTop: 48,
	/** Under this width there is no room beside the game column, so everything shares one rail */
	narrow: 900,
	/** Width to leave clear down the middle for the party frames (.PartyMember is max-width 20rem) */
	gameColumn: 360,
	/** Height to leave clear at the bottom for .ActionBar — one .Ability tall (5rem), of which the last 4px sit below the fold */
	actionBar: 80,
}

/**
 * Position panels that the user has never moved.
 *
 * On a wide screen the game owns the center column (party frames, cast bar, action bar), so panels
 * dock into rails down the left and right edges. Narrow screens have no room beside the column, so
 * everything collapses to title bars in one rail stacked up from above the action bar — the empty
 * strip there is the only space that doesn't cover the frames you need to click.
 *
 * Panels with a saved layout are left alone; this only decides where things land on a fresh visit
 * or after a resize you haven't customised.
 */
export function applyDefaultLayout() {
	const wide = window.innerWidth >= LAYOUT.narrow
	const railY = {left: LAYOUT.railTop, right: LAYOUT.railTop}
	// A rail may not grow into the game column, so panels never cover the party frames.
	const maxWidth = wide
		? (window.innerWidth - LAYOUT.gameColumn) / 2 - LAYOUT.gap * 2
		: window.innerWidth - LAYOUT.gap * 2

	// Narrow screens stack upward from just above the action bar instead of down from the top.
	let narrowY = window.innerHeight - LAYOUT.actionBar

	for (const view of document.querySelectorAll('floating-view')) {
		const viewId = view.id || view.getAttribute('data-view-id')
		if (store.hasRow('floating-views', viewId)) continue

		const rail = wide ? view.getAttribute('data-dock') || 'left' : 'left'
		if (!wide) {
			view.setAttribute('minimized', '')
			// Collapse to the title bar — a markup `height` would otherwise keep the panel full-size.
			view.style.height = 'auto'
		}

		const width = Math.max(FloatingView.config.minWidth, Math.min(view.offsetWidth, maxWidth))
		const x = rail === 'right' ? window.innerWidth - width - LAYOUT.gap : LAYOUT.gap
		let y
		if (wide) {
			y = railY[rail]
			railY[rail] += view.offsetHeight + LAYOUT.gap
		} else {
			narrowY -= view.offsetHeight + LAYOUT.gap
			y = Math.max(LAYOUT.railTop, narrowY)
		}
		gsap.set(view, {x, y, width})
	}
}

window.addEventListener('resize', applyDefaultLayout)
