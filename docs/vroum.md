**Vroum** – A lightweight TypeScript library for game loops and timed tasks. It provides a simple framework to structure game logic into a **Loop** (main update loop), **Node** (hierarchical object), and **Task** (timed action), all with a consistent mount/destroy lifecycle.

## Core Components

- **Loop** – The main game loop (extends `Task`) that drives all tasks using `requestAnimationFrame` (at a target `maxFPS`).
  - **Lifecycle:** `mount()` starts the frame loop (resets timing and begins updates), `destroy()` stops it (cancels the animation frame).
  - **Function:** On each frame, it updates `deltaTime` and calls `run()` on each active Task in its `tasks` list.
  - **Key properties:** `tasks` (array of scheduled tasks), `time`/`lastTime` (timestamp tracking), `deltaTime` (time elapsed per frame), `maxFPS` (frame rate cap).
  - **Usage:** Create a Loop (e.g. `const loop = new Loop(60)`) to start the game loop. Attach tasks by instantiating them with the loop (or a Node under the loop) as parent. Call `loop.disconnect()` to stop the loop when needed.

- **Node** – A base class for objects in the hierarchy (entities/components). Nodes can have parent/child relationships and an event system.
  - **Lifecycle:** `mount()` is called when the Node attaches to a parent (use to initialize state), `destroy()` when it detaches (cleanup). These are automatically triggered via `connect`/`disconnect`.
  - **Key features:** `parent` (reference to parent Node), `root` (top-most ancestor, e.g. the Loop), and static events `Node.MOUNT`/`Node.DESTROY` that are emitted on lifecycle changes.
  - **Event API:** Nodes can broadcast events and listen for them – methods `emit(event, data)`, `on(event, handler)`, `off(event)`, `once(event, handler)` enable communication (e.g. a child Node can emit an event that parent or others handle).
  - **Usage:** Subclass Node for game entities or components. Attach a Node to a parent by passing the parent to its constructor (`new MyNode(parent)`) or using `node.connect(parent)` – this triggers the mount lifecycle. Override `mount()`/`destroy()` in your subclass to handle setup/teardown logic.

- **Task** – A Node that encapsulates time-based behavior (update logic, animations, effects) and runs within the Loop.
  - **Lifecycle:** Inherits Node's lifecycle – on `mount()` it resets timing and registers itself with the root Loop's task list (starting its schedule), and on `destroy()` it stops and removes itself from the Loop. You can also override optional hooks: `mount()` (runs once at start), `beforeCycle()` (each cycle start), `tick()` (each tick/frame – your main update logic), and `afterCycle()` (end of each cycle).
  - **Timing control:** Important properties to configure task timing: `delay` (start offset in ms), `interval` (pause between repeat cycles), `duration` (length of each cycle in ms), `frames` (alternative to duration – length in frames), and `repeat` (number of cycles, default infinite). These can be combined (e.g. run for X ms or Y frames, repeat N times with Z ms gap).
  - **State properties:** `elapsedTime` (ms elapsed in current cycle), `cycleTime` (time into current cycle), `ticks` (frames progressed in current cycle), `cycles` (how many cycles completed), `running` (whether active or paused), and `done` (true when task has finished all cycles).
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
  class Spell extends Task {
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
      const constructor = this.constructor as typeof Spell
      this.name = constructor.name
      this.cost = constructor.cost
  }
  ```

This pattern makes it easy to define new types (spells, bosses, effects) while maintaining proper runtime state for each instance.

This is how the `Task` class is defined from the `vroum` dependency.

```ts
export class Task extends Node implements PromiseLike<void> {
  static PLAY = "play-task" as const;
  static PAUSE = "pause-task" as const;

  declare root: Loop;

  delay = 0;
  interval = 0;
  duration = 0;
  frames = 0;
  repeat = Infinity;

  elapsedTime = 0;
  cycleTime = 0;

  cycles = 0;
  ticks = 0;

  running = true;
  done = false;

  private _cycleStartTime = 0;
  private _cycleEndTime = 0;

  protected begin?(): void;
  protected beforeCycle?(): void;
  protected tick?(): void;
  protected afterCycle?(): void;

  protected mount() {
    this.running = true;
    this.done = false;

    this.elapsedTime = 0;
    this.cycleTime = 0;

    this.cycles = 0;
    this.ticks = 0;

    if (this.frames !== 0) {
      this.duration = Math.ceil((this.frames * 1000) / this.root.maxFPS);
    } else if (this.duration !== 0) {
      this.frames = Math.ceil((this.duration * this.root.maxFPS) / 1000);
    }

    this._cycleStartTime = this.delay;
    this._cycleEndTime = this._cycleStartTime + this.duration;

    // add task to root loop
    this.root.tasks.push(this);
  }

  protected destroy() {
    this.running = false;
    this.done = true;

    // remove task from root loop
    const index = this.root.tasks.indexOf(this);
    if (index > -1) this.root.tasks.splice(index, 1);
  }

  play() {
    this.running = true;
    this.emit(Task.PLAY);
  }

  pause() {
    this.running = false;
    this.emit(Task.PAUSE);
  }

  protected shouldTick() {
    const isInstant = this.duration === 0;
    const isDelayPassed = this.elapsedTime >= this._cycleStartTime;
    const isFramesReached = this.ticks >= this.frames;

    return isDelayPassed && (isInstant || !isFramesReached);
  }

  protected shouldEnd() {
    return this.cycles >= this.repeat;
  }

  // ,..... and more

```
