import {setLogLevel} from './combatlog'

/**
 * Silence the game's logging for the whole test run.
 *
 * Every fight logs every event and every lifecycle call through pino, and in a test that goes to
 * stdout as one JSON line each. A single failing assertion arrived buried under a few hundred of
 * them, which meant piping the output through `head` to find out what broke. Nothing is lost:
 * `logCombat` pushes to `combatLogs` before it logs, so the stream tests assert on is untouched.
 *
 * To watch a fight happen, call `setLogLevel('info')` at the top of the one file you are debugging.
 */
setLogLevel('silent')

/**
 * vroum's `Loop.mount()` asks for an animation frame the moment a game is constructed, and node
 * has none to give. A stub that never fires is what the tests want anyway: a constructed loop then
 * sits still until something steps it, rather than ticking away in the background while assertions
 * run. `SimLoop` steps its own clock — see `src/sim/run.ts`.
 */
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}
