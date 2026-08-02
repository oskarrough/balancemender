type Listener<Data> = (data: Data) => void

type PendingConnection = {
	generation: number
	parent?: Node
	connect: boolean
}

declare global {
	interface EventMap {
		[event: string]: any
		[Node.MOUNT]: Node
		[Node.DESTROY]: Node
	}
}

export class Node {
	static MOUNT = 'mount-node' as const
	static DESTROY = 'destroy-node' as const

	root!: Node
	parent?: Node

	protected mounted = false

	private _listeners: Record<string, Listener<any>[]> = {}
	private _mountedParent?: Node
	private _listeningParent?: Node
	private _generation = 0
	private _pending?: PendingConnection

	constructor(parent?: Node) {
		this.connect(parent)
	}

	protected mount?(): void
	protected destroy?(): void

	connect(parent: this['parent']) {
		const generation = ++this._generation
		this._pending = {generation, parent, connect: true}

		// Keep a mounted node on its old parent until the deferred destroy has run. Apart from making
		// `destroy()` truthful during a reconnect, this keeps subclass-owned `parent` fields pointing
		// at the node whose listeners are about to be removed.
		if (!this.mounted) {
			this.parent = parent
			this.root = parent?.root ?? this
		}

		queueMicrotask(() => this._reconcile(generation))
	}

	disconnect() {
		const generation = ++this._generation
		this._pending = {generation, connect: false}
		queueMicrotask(() => this._reconcile(generation))
	}

	private _reconcile(generation: number) {
		const pending = this._pending
		if (!pending || pending.generation !== generation) return

		// A parent that has not mounted yet is still a valid destination. Listen for its MOUNT rather
		// than mounting into a parent that may be superseded by its own deferred disconnect. A parent
		// that was already destroyed has no pending mount to wait for, so do not leave a listener on it.
		if (pending.connect && pending.parent && !pending.parent.mounted) {
			if (pending.parent._pending?.connect !== true) {
				this._pending = undefined
				this._detachParent(this._listeningParent)
				this.parent = undefined
				this.root = this
				return
			}

			if (this.mounted) {
				this._detachParent(this._listeningParent)
				this._runDestroy()
				if (this._pending?.generation !== generation) return
				if (!pending.parent.mounted && pending.parent._pending?.connect !== true) {
					this._pending = undefined
					this.parent = undefined
					this.root = this
					return
				}
			}

			this.parent = pending.parent
			this.root = pending.parent.root
			this._attachParent(pending.parent)
			return
		}

		this._pending = undefined

		if (this.mounted) {
			this._detachParent(this._listeningParent)
			this._runDestroy()
			if (this._pending) return
		}

		if (!pending.connect) {
			this._detachParent(this._listeningParent)
			this.parent = undefined
			this.root = this
			return
		}

		// A destroy hook may have disconnected the destination while the old mount was being torn
		// down. Keep this generation pending and wait for that destination to mount instead, unless
		// that destination was already destroyed and has no mount queued.
		if (pending.parent && !pending.parent.mounted) {
			if (pending.parent._pending?.connect !== true) {
				this._detachParent(this._listeningParent)
				this.parent = undefined
				this.root = this
				return
			}

			this._pending = pending
			this.parent = pending.parent
			this.root = pending.parent.root
			this._attachParent(pending.parent)
			return
		}

		this.parent = pending.parent
		this.root = pending.parent?.root ?? this
		this._attachParent(pending.parent)
		this._runMount(pending.parent)
	}

	private _attachParent(parent?: Node) {
		if (this._listeningParent === parent) return
		this._detachParent(this._listeningParent)
		if (!parent) return

		this._listeningParent = parent
		parent.on(Node.MOUNT, this._onParentMount)
		parent.on(Node.DESTROY, this._onParentDestroy)
	}

	private _detachParent(parent?: Node) {
		if (!parent || this._listeningParent !== parent) return
		parent.off(Node.MOUNT, this._onParentMount)
		parent.off(Node.DESTROY, this._onParentDestroy)
		this._listeningParent = undefined
	}

	private _onParentMount = (parent: Node) => {
		if (parent !== this._listeningParent || this.mounted) return
		const pending = this._pending
		if (!pending?.connect || pending.parent !== parent) return

		this._pending = undefined
		this.parent = parent
		this.root = parent.root
		this._runMount(parent)
	}

	private _onParentDestroy = (parent: Node) => {
		if (parent !== this._listeningParent) return
		this._detachParent(parent)
		if (this.mounted && this._mountedParent === parent) this._runDestroy()
	}

	emit<Key extends keyof EventMap & string>(event: Key, data?: EventMap[Key]) {
		const listeners = this._listeners[event]
		if (!listeners) return
		// Over a copy, because a listener may unsubscribe while it runs — `once` always does.
		// Splicing the live array slides the next listener into an index the loop has passed, and
		// that listener is silently skipped: on DESTROY, a child that never tears down.
		const dispatching = listeners.slice()
		for (let i = 0; i < dispatching.length; i++) {
			dispatching[i](data)
		}
	}

	on<Key extends keyof EventMap & string>(event: Key, listener: Listener<EventMap[Key]>) {
		const listeners = this._listeners[event] ?? []
		if (listeners.indexOf(listener) === -1) listeners.push(listener)
		this._listeners[event] = listeners
	}

	off<Key extends keyof EventMap & string>(event: Key, listener?: Listener<EventMap[Key]>) {
		const listeners = this._listeners[event]
		if (listeners) {
			if (!listener) {
				delete this._listeners[event]
			} else {
				const index = listeners.indexOf(listener)
				if (index > -1) listeners.splice(index, 1)
			}
		}
	}

	once<Key extends keyof EventMap & string>(event: Key, listener: Listener<EventMap[Key]>) {
		const onceListener = (data: EventMap[Key]) => {
			this.off(event, onceListener)
			listener(data)
		}

		this.on(event, onceListener)
	}

	private _runMount = (parent: Node | undefined) => {
		if (this.mounted) return

		this.parent = parent
		this.root = parent?.root ?? this
		this._mountedParent = parent
		this._runLifeCycleChain('mount')
		this.emit(Node.MOUNT, this)
		this.mounted = true
	}

	private _runDestroy = () => {
		if (!this.mounted) return

		this.parent = this._mountedParent
		this._runLifeCycleChain('destroy')
		this.emit(Node.DESTROY, this)
		this._listeners = {}
		this.parent = undefined
		this.root = this
		this._mountedParent = undefined
		this.mounted = false
	}

	// Run each version of a lifecycle method in the prototype chain.
	private _runLifeCycleChain(method: 'mount' | 'destroy') {
		const methods = []

		// Collect distinct versions of the method.
		let prototype = Object.getPrototypeOf(this)
		while (prototype && prototype[method]) {
			if (Object.hasOwn(prototype, method)) methods.push(prototype[method])
			prototype = Object.getPrototypeOf(prototype)
		}

		// Run them from base to most derived class.
		for (let i = methods.length - 1; i >= 0; i--) {
			methods[i].call(this)
		}
	}
}
