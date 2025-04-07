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
			visibleTop: 40
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
		}

		this.setupDraggable()

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
			onPress: function() {
				this.applyBounds(self.calculateBounds())
			},
			onDrag: function() {
				self.enforceBounds(this, self.calculateBounds())
			}
		})
	}

	handleResize() {
		const draggable = Draggable.get(this)
		if (draggable) {
			const bounds = this.calculateBounds()
			draggable.applyBounds(bounds)
			this.enforceBounds(draggable, bounds)
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
}

customElements.define('floating-view', FloatingView)
