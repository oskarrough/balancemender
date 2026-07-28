import {Task} from './task'

export class Loop extends Task {
	tasks: Task[] = []

	time: number | undefined
	lastTime: number | undefined
	frameTime = 0

	private _frame: number | undefined

	constructor() {
		super()
	}

	protected mount() {
		this.time = undefined
		this.lastTime = undefined
		this.frameTime = 0
		this._requestNextFrame()
	}

	protected destroy() {
		this._cancelLastFrame()
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

	private _requestNextFrame() {
		this._frame = requestAnimationFrame(this._runTasks)
	}

	private _cancelLastFrame() {
		if (this._frame) cancelAnimationFrame(this._frame)
	}

	private _runTasks = (time: number) => {
		this.time = time
		this.frameTime = this.time - (this.lastTime ?? time)
		this.lastTime = this.time

		if (this.running) {
			for (let i = 0; i < this.tasks.length; i++) {
				this.tasks[i].run()
			}
		}

		this._requestNextFrame()
	}
}
