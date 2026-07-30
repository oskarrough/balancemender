type Listener<Data> = (data: Data) => void

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

	constructor(parent?: Node) {
		this.connect(parent)
	}

	protected mount?(): void
	protected destroy?(): void

	connect(parent: this['parent']) {
		if (this.mounted) {
			this.disconnect()
		}

		this.parent = parent
		this.root = parent?.root ?? this

		queueMicrotask(() => {
			this.parent?.on(Node.MOUNT, this._runMount)
			this.parent?.on(Node.DESTROY, this._runDestroy)
			this._runMount(parent)
		})
	}

	disconnect() {
		queueMicrotask(() => {
			this.parent?.off(Node.MOUNT, this._runMount)
			this.parent?.off(Node.DESTROY, this._runDestroy)
			this._runDestroy()
		})
	}

	emit<Key extends keyof EventMap & string>(event: Key, data?: EventMap[Key]) {
		const listeners = this._listeners[event]
		if (!listeners) return
		for (let i = 0; i < listeners.length; i++) {
			listeners[i](data)
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
		this.parent = parent
		this.root = parent?.root ?? this
		this._runLifeCycleChain('mount')
		this.emit(Node.MOUNT, this)
		this.mounted = true
	}

	private _runDestroy = () => {
		if (!this.mounted) return

		this._runLifeCycleChain('destroy')
		this.emit(Node.DESTROY, this)
		this._listeners = {}
		this.parent = undefined
		this.root = this
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
