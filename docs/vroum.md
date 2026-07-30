# Vroum

[`src/vroum/`](../src/vroum/) is the game's lifecycle and task engine, inlined from
[vroum v1.2.4](https://gitlab.com/jfalxa/vroum/-/tree/v1.2.4). It structures game logic as a
`Loop`, hierarchical `Node`s and timed `Task`s with a shared mount/destroy lifecycle.

## The lifecycle rules that catch people

- **`mount()` and `destroy()` run the whole prototype chain**, base class first — a subclass
  `mount()` does not replace its parent's. That is why `Loop.mount()` starting the frame loop and
  `GameLoop.mount()` wiring listeners both happen.
- **The Loop is one of its own tasks**, so `game.elapsedTime` is the fight clock. Everything
  time-based reads it: the five-second rule, cast bookkeeping, the combat log's `time`. It resets when
  an encounter is loaded.
- **`connect()`/`disconnect()` are deferred to a microtask.** A node is not mounted on the line after
  you construct it, and a dead unit is still in `encounter.party` until the microtask runs. Some of it
  chains — a death takes two hops — so `await settle()` from `test-setup.ts` rather than counting your
  own `Promise.resolve()`s.
- **A `Loop` is thenable**, and vroum resolves that on DESTROY — so `await game` would park on a loop
  that never dies. `GameLoop` overrides `then()` to resolve immediately, which turns a silent 5s
  timeout into an instant `undefined`. A helper that builds a game still should not return it.

## Core Components

- **Loop** – The main game loop (extends `Task`) that drives all tasks using `requestAnimationFrame`.
  - **Lifecycle:** `mount()` starts the frame loop (resets timing and begins updates), `destroy()` stops it (cancels the animation frame).
  - **Function:** On each frame, it updates `frameTime` and calls `run()` on each active Task in its `tasks` list.
  - **Key properties:** `tasks` (array of scheduled tasks), `time`/`lastTime` (timestamp tracking), and `frameTime` (time elapsed since the previous frame).
  - **Usage:** Create a Loop (`const loop = new Loop()`) to start the game loop. Attach tasks by instantiating them with the loop (or a Node under the loop) as parent. Call `loop.disconnect()` to stop the loop when needed.

- **Node** – A base class for objects in the hierarchy (entities/components). Nodes can have parent/child relationships and an event system.
  - **Lifecycle:** `mount()` is called when the Node attaches to a parent (use to initialize state), `destroy()` when it detaches (cleanup). These are automatically triggered via `connect`/`disconnect`.
  - **Key features:** `parent` (reference to parent Node), `root` (top-most ancestor, e.g. the Loop), and static events `Node.MOUNT`/`Node.DESTROY` that are emitted on lifecycle changes.
  - **Event API:** Nodes can broadcast events and listen for them – methods `emit(event, data)`, `on(event, handler)`, `off(event)`, `once(event, handler)` enable communication (e.g. a child Node can emit an event that parent or others handle).
  - **Usage:** Subclass Node for game entities or components. Attach a Node to a parent by passing the parent to its constructor (`new MyNode(parent)`) or using `node.connect(parent)` – this triggers the mount lifecycle. Override `mount()`/`destroy()` in your subclass to handle setup/teardown logic.

- **Task** – A Node that encapsulates time-based behavior (update logic, animations, effects) and runs within the Loop.
  - **Lifecycle:** Inherits Node's lifecycle – on `mount()` it resets timing and registers itself with the root Loop's task list (starting its schedule), and on `destroy()` it stops and removes itself from the Loop. You can also override optional hooks: `mount()` (runs once at start), `beforeCycle()` (each cycle start), `tick()` (each tick/frame – your main update logic), and `afterCycle()` (end of each cycle).
  - **Timing control:** Important properties to configure task timing: `delay` (start offset in ms), `interval` (pause between repeat cycles), `duration` (length of each cycle in ms), `fps` and `ticks` (fixed-rate tick scheduling), and `repeat` (number of cycles, default infinite).
  - **State properties:** `elapsedTime` (ms elapsed since mount), `deltaTime` (time since this task's previous tick), `progress` (the current cycle's completion ratio), `running` (whether active or paused), and `done` (true when the task has finished).
  - **Methods:** Implement your game logic in `tick()` – it's called automatically on each frame (after any delay) as long as `running` is true. Use `play()` and `pause()` to control the task's execution (these also emit Task.PLAY/PAUSE events). You can override `shouldTick()` to skip a tick (e.g. if a condition isn't met) or `shouldEnd()` to stop early (custom end condition) – otherwise the Task ends when the set `repeat` cycles finish.
  - **Usage:** Subclass `Task` for any timed behavior (e.g. a damage-over-time effect or an animation update). Override the relevant hooks (`tick()` at minimum, plus others as needed for setup or per-cycle logic). Instantiate the task with a parent that is in the Loop (often the Loop itself or a Node under it) – this auto-mounts and starts the task. The Loop will then run the task's `tick()` each frame until it completes or you manually pause/stop it. Developers can quickly chain game actions by creating Task instances, and the framework handles the scheduling so you can focus on the logic.

## Design Patterns

### Static vs Instance Properties Pattern

When extending Task or Node for game entities (like spells, bosses, or effects), we use a consistent pattern for properties:

- **Static Properties** define the "template" or "type":

  ```typescript
  class Heal extends Spell {
  	static name = 'Heal'
  	static cost = 295
  	static castTime = 3000
  }
  ```

  These properties describe what the class IS.

- **Instance Properties** hold the runtime state:

  ```typescript
  class Ability extends Task {
  	name = '' // Will be set from static
  	cost = 0 // Will be set from static
  	delay = 0 // Task's timing property
  }
  ```

  These properties track what the instance DOES.

- **Constructor Pattern** copies static to instance:
  ```typescript
  constructor(parent: Node) {
      super(parent)
      const constructor = this.constructor as typeof Ability
      this.name = constructor.name
      this.cost = constructor.cost
  }
  ```

This pattern makes it easy to define new types (spells, bosses, effects) while maintaining proper runtime state for each instance.

The source owns the exact contract:

- [`node.ts`](../src/vroum/node.ts) owns hierarchy, events and lifecycle chaining.
- [`task.ts`](../src/vroum/task.ts) owns scheduling and timed state.
- [`loop.ts`](../src/vroum/loop.ts) owns frame timing and task execution.
