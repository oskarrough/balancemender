import {setLogLevel} from './combatlog'

/**
 * Silence the game's logging for the whole test run.
 *
 * Every fight logs every event and every lifecycle call through pino, and in a test that goes to
 * stdout as one JSON line each. A single failing assertion arrived buried under a few hundred of
 * them, which meant piping the output through `head` to find out what broke. Nothing is lost:
 * `logCombat` pushes to `combatLogs` before it logs, so the stream tests assert on is untouched.
 *
 * Imports `combatlog.ts` and nothing else on purpose. This file runs before *every* test file,
 * including the ones in the plain node environment, and `utils.ts` re-exports uhtml — reaching
 * its logger directly from here fails three suites with `DocumentFragment is not defined`.
 *
 * To watch a fight happen, call `setLogLevel('info')` at the top of the one file you are debugging.
 */
setLogLevel('silent')
