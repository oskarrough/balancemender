import {describe, expect, it} from 'vitest'
import {settle} from '../test-setup'
import {Loop} from './loop'
import {Task} from './task'

describe('Node lifecycle', () => {
	it('destroys once when independent paths disconnect the same task', async () => {
		class CountingTask extends Task {
			destroyCount = 0

			// Before disconnect was idempotent, the second destroy saw the task as its own root.
			_kill() {}

			protected destroy() {
				this.destroyCount++
			}
		}

		const loop = new Loop()
		const task = new CountingTask(loop)
		await settle()

		task.disconnect()
		task.disconnect()
		await settle()

		expect(task.destroyCount).toBe(1)
		loop.disconnect()
		await settle()
	})
})
