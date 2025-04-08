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
			minHeight: 150,
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

	// Enforce the current position is within bounds
	enforceBounds(draggable, bounds) {
		if (!draggable || !bounds) return

		draggable.x = Math.min(Math.max(draggable.x, bounds.minX), bounds.maxX)
		draggable.y = Math.min(Math.max(draggable.y, bounds.minY), bounds.maxY)
	}

	connectedCallback() {
		const viewId = this.id || this.getAttribute('data-view-id')
		if (viewId) {
			const viewData = store.getRow('floating-views', viewId)
			console.log(viewId, viewData)
			if (viewData?.x && viewData?.y) {
				gsap.set(this, {x: viewData.x, y: viewData.y})
			}
			if (viewData?.width && viewData?.height) {
				gsap.set(this, {width: viewData.width, height: viewData.height})
			}
		}

		this.setupDraggable()
		this.setupResizable()

		this.addEventListener('dblclick', (e) => {
			if (e.target.closest('header')) {
				e.currentTarget.toggleAttribute('minimized')
			}
		})

		window.addEventListener('resize', this.handleResize.bind(this))
	}

	setupDraggable() {
		const self = this
		Draggable.create(this, {
			trigger: this.querySelector('header'),
			bounds: this.calculateBounds(),
			type: 'x,y',
			inertia: true,
			onDragEnd: () => this.savePosition(),
			onPress: function () {
				this.applyBounds(self.calculateBounds())
			},
			onDrag: function () {
				self.enforceBounds(this, self.calculateBounds())
			},
		})
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
			this.saveSize()
		}

		resizeHandle.addEventListener('mousedown', startResize)
	}

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

	handleResize() {
		const draggable = Draggable.get(this)
		if (draggable) {
			const bounds = this.calculateBounds()
			draggable.applyBounds(bounds)
			this.enforceBounds(draggable, bounds)
		}
	}
}

customElements.define('floating-view', FloatingView)
