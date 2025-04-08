import {store} from '../store.js'
import {Draggable} from 'gsap/Draggable'
import {gsap} from 'gsap'
gsap.registerPlugin(Draggable)

class FloatingView extends HTMLElement {
	constructor() {
		super()
	}

	// Configuration for the draggable view
	static get config() {
		return {
			visibleEdge: 100,
			visibleTop: 40,
			minWidth: 200,
			minHeight: 20,
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
		// Initialize draggable directly
		Draggable.create(this, {
			type: 'x,y',
			trigger: this.querySelector('header'),
			bounds: this.calculateBounds(),
			inertia: true,
		})

		// Setup resize handle
		this.setupResizable()

		// Setup event handlers
		this.addEventListener('dblclick', (e) => {
			if (e.target.closest('header')) {
				e.currentTarget.toggleAttribute('minimized')
				e.currentTarget.style.height = 'auto'
			}
		})

		window.addEventListener('resize', this.handleResize.bind(this))
	}

	setupResizable() {
		// Create and append the resize handle
		const resizeHandle = document.createElement('div')
		resizeHandle.className = 'resize-handle'
		resizeHandle.innerHTML = '⟋'
		this.appendChild(resizeHandle)

		let startWidth, startHeight, startX, startY
		const {minWidth, minHeight} = FloatingView.config

		const startResize = (e) => {
			e.preventDefault()
			startWidth = this.offsetWidth
			startHeight = this.offsetHeight
			startX = e.clientX
			startY = e.clientY
			document.addEventListener('mousemove', resize)
			document.addEventListener('mouseup', stopResize)
		}

		const resize = (e) => {
			const width = Math.max(minWidth, startWidth + (e.clientX - startX))
			const height = Math.max(minHeight, startHeight + (e.clientY - startY))
			this.style.width = `${width}px`
			this.style.height = `${height}px`
		}

		const stopResize = () => {
			document.removeEventListener('mousemove', resize)
			document.removeEventListener('mouseup', stopResize)
			// Disabled during testing
			// this.saveSize()
		}

		resizeHandle.addEventListener('mousedown', startResize)
	}

	// Store functionality disabled during testing
	/*
	saveSize() {
		const viewId = this.id || this.getAttribute('data-view-id')
		if (!viewId) return

		const width = this.offsetWidth
		const height = this.offsetHeight

		const existingRow = store.getRow('floating-views', viewId)
		if (existingRow) {
			store.setPartialRow('floating-views', viewId, {width, height})
		} else {
			store.setRow('floating-views', viewId, {width, height, type: 'view'})
		}
	}

	savePosition() {
		const viewId = this.id || this.getAttribute('data-view-id')
		console.log('saving', viewId)
		if (!viewId) return

		const matrix = new DOMMatrixReadOnly(this.style.transform)
		const x = matrix.m41
		const y = matrix.m42

		const existingRow = store.getRow('floating-views', viewId)
		if (existingRow) {
			store.setPartialRow('floating-views', viewId, {x, y})
		} else {
			store.setRow('floating-views', viewId, {x, y, type: 'view'})
		}
	}
	*/

	handleResize() {
		const draggable = Draggable.get(this)
		if (draggable) {
			draggable.applyBounds(this.calculateBounds())
		}
	}
}

customElements.define('floating-view', FloatingView)
