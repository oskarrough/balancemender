import type {Loop} from './loop'
import {Node} from './node'

declare global {
	interface EventMap {
		[Task.PLAY]: void
		[Task.PAUSE]: void
	}
}

export class Task extends Node implements PromiseLike<void> {
	static PLAY = 'play-task' as const
	static PAUSE = 'pause-task' as const

	declare root: Loop

	delay = 0
	interval = 0
	duration = 0
	fps = 0
	ticks = Infinity
	repeat = Infinity

	elapsedTime = 0
	deltaTime = 0
	progress = 0

	running = true
	done = false

	_firstRun = true
	_cycles = 0
	_currentTick = 0
	_cycleTime = 0

	private _tickInterval = 0
	private _cycleStartTime = 0
	private _cycleEndTime = 0
	private _lastTick = 0
	private _disconnectRequested = false

	protected begin?(): void
	protected beforeCycle?(): void
	protected tick?(): void
	protected afterCycle?(): void

	protected shouldTick?(): boolean | void
	protected shouldEnd?(): boolean | void

	connect(parent: this['parent']) {
		if (this.mounted) {
			this.running = false
			this._disconnectRequested = true
		}
		super.connect(parent)
	}

	disconnect() {
		this.running = false
		this._disconnectRequested = true
		super.disconnect()
	}

	protected mount() {
		this.running = true
		this.done = false
		this._disconnectRequested = false

		this.elapsedTime = 0
		this._cycleTime = 0
		this._firstRun = true
		// A remount is a fresh start, and these two carry the old one. Left standing, a task that
		// finished its `repeat` cycles disconnects again on its first frame back, and `begin()` —
		// which only fires on cycle zero — never fires again.
		this._cycles = 0
		this._currentTick = 0

		if (this.fps !== 0) {
			this._tickInterval = 1000 / this.fps
			this.duration = this.ticks * this._tickInterval
		}

		this._cycleStartTime = this.delay
		this._cycleEndTime = this._cycleStartTime + this.duration
		this._lastTick = this._cycleStartTime

		this.root._register(this)
	}

	protected destroy() {
		this.running = false
		this.done = true
		this._disconnectRequested = true
		this.root._kill(this)
	}

	play() {
		this.running = true
		this.emit(Task.PLAY)
	}

	pause() {
		this.running = false
		this.emit(Task.PAUSE)
	}

	run() {
		if (!this.running || !this.mounted || this._disconnectRequested) return
		const canContinue = () => this.mounted && !this._disconnectRequested

		if (!this._firstRun) this.elapsedTime += this.root.frameTime
		else this._firstRun = false

		if (this.elapsedTime < this._cycleStartTime) return

		this._cycleTime = Math.min(this.elapsedTime - this._cycleStartTime, this.duration)

		if (this._currentTick === 0) {
			if (this._cycles === 0) this.begin?.()
			if (!canContinue()) return
			this.beforeCycle?.()
			if (!canContinue()) return
		}

		const shouldTick = this.shouldTick?.() ?? true
		if (!canContinue()) return
		if (shouldTick) {
			if (this.fps === 0) {
				// A task with no duration is one instant per cycle, so it is complete the moment it
				// ticks. Dividing by that zero instead left `progress` NaN on every interval task.
				this.progress = this.duration === 0 ? 1 : Math.min(this._cycleTime / this.duration, 1)
				this.deltaTime = this.root.frameTime
				this.tick?.()
				if (!canContinue()) return
				this._currentTick++
			} else {
				const ratio = Math.floor(this._cycleTime / this._tickInterval)
				const dueTick = Math.min(ratio + 1, this.ticks)
				const t0 = this.elapsedTime - dueTick * this._tickInterval

				while (this._currentTick < dueTick) {
					const tick = this._currentTick + 1
					this.elapsedTime = t0 + tick * this._tickInterval
					this.deltaTime = this.elapsedTime - this._lastTick
					this.progress = Math.min(tick / this.ticks, 1)
					this.tick?.()
					if (!canContinue()) return
					this._currentTick = tick
					this._lastTick = this.elapsedTime
				}
			}
		}

		if (!canContinue()) return
		if (this.elapsedTime >= this._cycleEndTime) {
			this.afterCycle?.()
			if (!canContinue()) return

			this._cycles += 1
			this._currentTick = 0

			this._cycleStartTime = this.delay + (this.duration + this.interval) * this._cycles
			this._cycleEndTime = this._cycleStartTime + this.duration
		}

		if (!canContinue()) return
		const shouldEnd = this.shouldEnd?.() ?? false
		if (!canContinue()) return
		if (shouldEnd || this._cycles >= this.repeat) {
			this.disconnect()
		}
	}

	// oxlint-disable-next-line no-thenable -- preserve vroum's public API while it is inlined
	then<T>(onfulfilled: () => T | PromiseLike<T>): PromiseLike<T> {
		if (this.done) return Promise.resolve(onfulfilled())
		return new Promise((resolve) => this.once(Task.DESTROY, () => resolve(onfulfilled())))
	}
}
