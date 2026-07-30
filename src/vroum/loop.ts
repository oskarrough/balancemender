import {Task} from './task'

export class Loop extends Task {
	tasks: Task[] = []

	time: number | undefined
	lastTime: number | undefined
	frameTime = 0

	/**
	 * The longest step (ms) a single frame may report, however long it really was.
	 *
	 * Animation frames stop in a backgrounded tab and at a debugger breakpoint, and the frame after
	 * one of those carries the whole stall. Unclamped, every task is handed those seconds at once
	 * and — since `run()` advances one cycle per frame — pays out its backlog a tick per frame: come
	 * back from ten seconds away and an attacker lands ten swings in ten frames. Clamping stops the
	 * fight clock while nobody is watching, which is what a fight clock should do.
	 *
	 * Raise it if you drive the clock yourself in steps longer than this — see `SimLoop`.
	 */
	maxFrameTime = 100

	private _frame: number | undefined

	constructor() {
		super()
	}

	protected mount() {
		this.time = undefined
		this.lastTime = undefined
		this.frameTime = 0
		this.requestFrame()
	}

	protected destroy() {
		this.cancelFrame()
	}

	/**
	 * Run one frame: every task advances to `time`, in ms on whatever clock is driving. The browser
	 * supplies that clock by default; override `requestFrame()` and call this yourself to step the
	 * loop at a fixed rate instead — see `SimLoop` in `src/sim/run.ts`.
	 */
	runFrame(time: number) {
		this.time = time
		this.frameTime = Math.min(time - (this.lastTime ?? time), this.maxFrameTime)
		this.lastTime = this.time

		if (this.running) {
			for (let i = 0; i < this.tasks.length; i++) {
				this.tasks[i].run()
			}
		}
	}

	/** Ask for the next frame. Override as a no-op to drive the clock yourself. */
	protected requestFrame() {
		this._frame = requestAnimationFrame(this._onFrame)
	}

	protected cancelFrame() {
		if (this._frame) cancelAnimationFrame(this._frame)
	}

	_register(task: Task) {
		this.tasks.push(task)

		if (task.priority > 0) {
			this.tasks.sort(Task.compare)
		}
	}

	_kill(task: Task) {
		const index = this.tasks.indexOf(task)
		if (index > -1) this.tasks.splice(index, 1)
	}

	private _onFrame = (time: number) => {
		this.runFrame(time)
		this.requestFrame()
	}
}
