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
		this._connected = false
		this._draggable = null
		this._resizeHandle = null
		this._resizing = false
		this._pointerDown = () => bringToFront(this)
		this._handleResize = this.handleResize.bind(this)
		this._doubleClick = this.handleDoubleClick.bind(this)
		this._startResize = this.startResize.bind(this)
		this._resize = this.resize.bind(this)
		this._stopResize = this.stopResize.bind(this)
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
		if (this._connected) return
		this._connected = true
		this.restoreLayout()
		this.addEventListener('pointerdown', this._pointerDown)
		this.draggable()
		this.resizable()
		this.minimizable()
		window.addEventListener('resize', this._handleResize)
	}

	disconnectedCallback() {
		if (!this._connected) return
		// Mark detached before teardown: killing a Draggable may synchronously dispatch dragend.
		this._connected = false
		this.removeEventListener('pointerdown', this._pointerDown)
		this.removeEventListener('dblclick', this._doubleClick)
		window.removeEventListener('resize', this._handleResize)
		this.stopResize()

		if (this._resizeHandle) {
			this._resizeHandle.removeEventListener('mousedown', this._startResize)
			this._resizeHandle.remove()
			this._resizeHandle = null
		}

		if (this._draggable) {
			const draggable = this._draggable
			this._draggable = null
			draggable.kill()
		}
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
		if (this._draggable) return
		const draggable = Draggable.create(this, {
			type: 'x,y',
			trigger: this.querySelector(':scope > header'),
			zIndexBoost: false,
			bounds: this.calculateBounds(),
			inertia: true,
			onDragEnd: () => {
				if (this._connected && this._draggable === draggable) this.saveLayout()
			},
		})[0]
		this._draggable = draggable
	}

	resizable() {
		if (this._resizeHandle) return

		// Create and append the resize handle
		const resizeHandle = document.createElement('div')
		resizeHandle.className = 'resize-handle'
		resizeHandle.innerHTML = '⟋'
		this.appendChild(resizeHandle)
		this._resizeHandle = resizeHandle
		resizeHandle.addEventListener('mousedown', this._startResize)
	}

	startResize(e) {
		e.preventDefault()
		this._resizing = true
		this._openedOnDrag = false
		this._startWidth = this.offsetWidth
		this._startHeight = this.offsetHeight
		this._startX = e.clientX
		this._startY = e.clientY
		document.addEventListener('mousemove', this._resize)
		document.addEventListener('mouseup', this._stopResize)
	}

	resize(e) {
		if (!this._resizing) return
		const {minWidth, minHeight} = FloatingView.config
		if (!this._openedOnDrag && this.hasAttribute('minimized')) {
			this.style.height = `${this._startHeight}px`
			this.removeAttribute('minimized')
			this._openedOnDrag = true
		}
		const width = Math.max(minWidth, this._startWidth + (e.clientX - this._startX))
		const height = Math.max(minHeight, this._startHeight + (e.clientY - this._startY))
		this.style.width = `${width}px`
		this.style.height = `${height}px`
	}

	stopResize() {
		document.removeEventListener('mousemove', this._resize)
		document.removeEventListener('mouseup', this._stopResize)
		if (!this._resizing) return
		this._resizing = false
		if (this._connected) this.saveLayout()
	}

	minimizable() {
		this.addEventListener('dblclick', this._doubleClick)
	}

	handleDoubleClick(e) {
		if (e.target.closest('header') === this.querySelector(':scope > header')) {
			e.currentTarget.toggleAttribute('minimized')
			e.currentTarget.style.height = 'auto'
		}
	}

	saveLayout() {
		if (!this._connected) return
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
		if (this._draggable) this._draggable.applyBounds(this.calculateBounds())
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
	/** Height to leave clear at the bottom for .ActionBar — one .AbilityIcon tall (5rem), of which the last 4px sit below the fold */
	actionBar: 80,
}

/**
 * Position panels that the user has never moved.
 *
 * On a wide screen the Journal stays at the top right while the other panels stack up the left edge
 * from above the action bar. Narrow screens have no room beside the game column, so every panel
 * shares that left stack.
 *
 * Panels with a saved layout are left alone; this only decides where things land on a fresh visit
 * or after a resize you haven't customised.
 */
export function applyDefaultLayout() {
	const wide = window.innerWidth >= LAYOUT.narrow
	let rightY = LAYOUT.railTop
	// A rail may not grow into the game column, so panels never cover the party frames.
	const maxWidth = wide
		? (window.innerWidth - LAYOUT.gameColumn) / 2 - LAYOUT.gap * 2
		: window.innerWidth - LAYOUT.gap * 2

	let leftY = window.innerHeight - LAYOUT.actionBar

	for (const view of document.querySelectorAll('floating-view')) {
		const viewId = view.id || view.getAttribute('data-view-id')
		if (store.hasRow('floating-views', viewId)) continue

		const rail = wide ? view.getAttribute('data-dock') || 'left' : 'left'
		if (!wide) {
			view.setAttribute('minimized', '')
			// Collapse to the title bar — a markup `height` would otherwise keep the panel full-size.
			view.style.height = 'auto'
		}

		// The collapsed title bar has its own compact width; measure the panel open so expanding it
		// still reveals the content at its intended width.
		const minimized = view.hasAttribute('minimized')
		if (minimized) view.removeAttribute('minimized')
		const openWidth = view.offsetWidth
		if (minimized) view.setAttribute('minimized', '')
		const width = Math.max(FloatingView.config.minWidth, Math.min(openWidth, maxWidth))
		const x = rail === 'right' ? window.innerWidth - width - LAYOUT.gap : LAYOUT.gap
		let y
		if (rail === 'right') {
			y = rightY
			rightY += view.offsetHeight + LAYOUT.gap
		} else {
			leftY -= view.offsetHeight + LAYOUT.gap
			y = Math.max(LAYOUT.railTop, leftY)
		}
		gsap.set(view, {x, y, width})
	}
}

/** Forget every saved panel position and put the current views back on their default rails. */
export function resetDefaultLayout() {
	store.delTable('floating-views')
	applyDefaultLayout()
}

window.addEventListener('resize', applyDefaultLayout)
