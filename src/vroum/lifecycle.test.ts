import {describe, expect, it, vi} from 'vitest'
import {settle} from '../test-setup'
import {Loop} from './loop'
import {Node} from './node'
import {Task} from './task'

class ManualLoop extends Loop {
	protected requestFrame() {}
}

class ProbeNode extends Node {
	mountCount = 0
	destroyCount = 0

	protected mount() {
		this.mountCount++
	}

	protected destroy() {
		this.destroyCount++
	}
}

describe('deferred node lifecycle', () => {
	it('supersedes a pending mount without touching the old parent', async () => {
		const first = new Node()
		const second = new Node()
		const child = new ProbeNode(first)

		child.connect(second)
		await settle()

		expect(child.mountCount).toBe(1)
		expect(child.destroyCount).toBe(0)
		expect(child.parent).toBe(second)

		first.emit(Node.DESTROY, first)
		expect(child.destroyCount).toBe(0)

		child.disconnect()
		first.disconnect()
		second.disconnect()
		await settle()
	})

	it('reconnects a mounted node using the old parent identity', async () => {
		const first = new Node()
		const second = new Node()
		await settle()

		const child = new ProbeNode(first)
		await settle()
		const firstOff = vi.spyOn(first, 'off')
		child.connect(second)
		await settle()

		expect(firstOff).toHaveBeenCalledWith(Node.MOUNT, expect.any(Function))
		expect(firstOff).toHaveBeenCalledWith(Node.DESTROY, expect.any(Function))
		expect(child.mountCount).toBe(2)
		expect(child.destroyCount).toBe(1)
		expect(child.parent).toBe(second)

		first.emit(Node.DESTROY, first)
		expect(child.destroyCount).toBe(1)
		second.emit(Node.DESTROY, second)
		expect(child.destroyCount).toBe(2)

		first.disconnect()
		second.disconnect()
		await settle()
	})

	it('leaves no parent listener after rapid connect, disconnect and reconnect', async () => {
		const first = new Node()
		const second = new Node()
		const third = new Node()
		const child = new ProbeNode(first)

		child.disconnect()
		child.connect(second)
		child.disconnect()
		child.connect(third)
		await settle()

		expect(child.mountCount).toBe(1)
		expect(child.parent).toBe(third)

		first.emit(Node.DESTROY, first)
		second.emit(Node.DESTROY, second)
		expect(child.destroyCount).toBe(0)
		third.emit(Node.DESTROY, third)
		expect(child.destroyCount).toBe(1)

		first.disconnect()
		second.disconnect()
		third.disconnect()
		await settle()
	})
})

type CancelPhase = 'begin' | 'beforeCycle' | 'tick' | 'afterCycle' | 'shouldEnd'

describe('task cancellation', () => {
	it('becomes ineligible immediately and stops the current run at every hook', async () => {
		const expected = {
			begin: ['begin'],
			beforeCycle: ['begin', 'beforeCycle'],
			tick: ['begin', 'beforeCycle', 'tick'],
			afterCycle: ['begin', 'beforeCycle', 'tick', 'afterCycle'],
			shouldEnd: ['begin', 'beforeCycle', 'tick', 'afterCycle', 'shouldEnd'],
		} satisfies Record<CancelPhase, string[]>

		for (const phase of Object.keys(expected) as CancelPhase[]) {
			const loop = new ManualLoop()
			const events: string[] = []
			class CancellingTask extends Task {
				constructor(
					private cancelAt: CancelPhase,
					parent: Loop,
				) {
					super(parent)
				}

				private record(name: CancelPhase) {
					events.push(name)
					if (this.cancelAt === name) this.disconnect()
				}

				protected begin() {
					this.record('begin')
				}

				protected beforeCycle() {
					this.record('beforeCycle')
				}

				protected tick() {
					this.record('tick')
				}

				protected afterCycle() {
					this.record('afterCycle')
				}

				protected shouldEnd() {
					this.record('shouldEnd')
				}
			}

			const task = new CancellingTask(phase, loop)
			await settle()
			loop.runFrame(0)

			expect(events).toEqual(expected[phase])
			expect(task.running).toBe(false)
			await settle()
			loop.disconnect()
			await settle()
		}
	})
})

describe('loop animation frames', () => {
	it('clears a fired frame and schedules exactly one replacement', async () => {
		const oldRequest = globalThis.requestAnimationFrame
		const oldCancel = globalThis.cancelAnimationFrame
		const pending = new Map<number, FrameRequestCallback>()
		const cancelled: number[] = []
		let nextId = 0
		globalThis.requestAnimationFrame = (callback) => {
			const id = nextId++
			pending.set(id, callback)
			return id
		}
		globalThis.cancelAnimationFrame = (id) => {
			cancelled.push(id)
			pending.delete(id)
		}

		try {
			const loop = new Loop()
			await settle()
			expect(pending.size).toBe(1)
			const first = [...pending.keys()][0]
			const callback = pending.get(first)!
			pending.delete(first)
			callback(16)
			expect(pending.size).toBe(1)

			const second = [...pending.keys()][0]
			loop.disconnect()
			await settle()
			expect(cancelled).toEqual([second])
			expect(pending.size).toBe(0)
		} finally {
			globalThis.requestAnimationFrame = oldRequest
			globalThis.cancelAnimationFrame = oldCancel
		}
	})

	it('does not reschedule after teardown from a frame callback', async () => {
		const oldRequest = globalThis.requestAnimationFrame
		const oldCancel = globalThis.cancelAnimationFrame
		const pending = new Map<number, FrameRequestCallback>()
		let nextId = 0
		globalThis.requestAnimationFrame = (callback) => {
			const id = nextId++
			pending.set(id, callback)
			return id
		}
		globalThis.cancelAnimationFrame = (id) => {
			pending.delete(id)
		}

		class StoppingLoop extends Loop {
			protected tick() {
				this.disconnect()
			}
		}

		try {
			new StoppingLoop()
			await settle()
			const first = [...pending.keys()][0]
			const callback = pending.get(first)!
			pending.delete(first)
			callback(16)

			expect(pending.size).toBe(0)
			await settle()
			expect(pending.size).toBe(0)
		} finally {
			globalThis.requestAnimationFrame = oldRequest
			globalThis.cancelAnimationFrame = oldCancel
		}
	})

	it('cancels animation frame id zero', async () => {
		const oldRequest = globalThis.requestAnimationFrame
		const oldCancel = globalThis.cancelAnimationFrame
		const cancelled: number[] = []
		globalThis.requestAnimationFrame = () => 0
		globalThis.cancelAnimationFrame = (id) => cancelled.push(id)

		try {
			const loop = new Loop()
			await settle()
			loop.disconnect()
			await settle()
			expect(cancelled).toEqual([0])
		} finally {
			globalThis.requestAnimationFrame = oldRequest
			globalThis.cancelAnimationFrame = oldCancel
		}
	})
})
