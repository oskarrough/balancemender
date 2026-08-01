This project uses GitHub issues for tasks. Treat this file as a living field guide, not a second source of truth: surface inconsistencies or contradictions explicitly, follow the authoritative reference, and add only durable general guidance or links that prevent the same stumble recurring.

`bun run check` typechecks, lints and formats. `bun run test` runs the tests (never `bun test`). Run
both before committing, not while working. The `main` branch deploys to balancemender.0sk.ar

Tests are vitest in plain node — there is no fake DOM. `src/test-setup.ts` holds what every test
needs: the `requestAnimationFrame` stub vroum asks for the moment a `Loop` is constructed (it never
fires, so a constructed game sits still until something steps it), `setLogLevel('silent')` so a failing
assertion is not buried in pino, and `settle()` for vroum's deferred lifecycle. Call
`setLogLevel('info')` at the top of a file to watch a fight happen.

## Where things are

Read [docs/architecture.md](./docs/architecture.md) first — it is the map. In short: `src/nodes/` is
the game (loop, fight, units, abilities, auras, resources), `src/components/` is the UI re-rendered
every frame, `src/actions.ts` is the one interpreter — `game.perform(action)` — every mutation goes
through, `src/balance.ts` the tunable numbers, `src/combatlog.ts` the event stream every fight writes,
and `src/sim/` runs fights without a browser. [docs/combat.md](./docs/combat.md) is why the fight
systems are shaped the way they are, and [docs/vroum.md](./docs/vroum.md) has the lifecycle rules that
are easy to get wrong.

`ast-grep outline src/nodes/` lists the classes, methods and fields of a directory without reading
it — the fastest way to see what a file holds before opening it. Add `--items exports` for the public
surface of a directory, or `--json` to work over it.

[docs/glossary.md](./docs/glossary.md) is what the words mean. Reach for it before naming a new class
or field, and fold a term into it rather than inventing a second word. The one that catches people
out: everything a unit can do is an **ability**, a spell and an attack being tags on one rather than
two classes.

## Answering "what happens if…" questions

Don't guess at balance — run it:

```
bun run sim --enemies 'Runt*3' --bot triage --repeat 10   # how this fight usually goes
bun run sweep --seeds 200                                     # the shape of the curve
```

One seed cannot tell a balanced fight from a lucky roll, and one enemy group cannot tell you the
shape of the curve. [docs/simulation.md](./docs/simulation.md) has the flags, how to read a sweep
table, and `--tune` for measuring a candidate number without a source edit to undo.

## Working on the UI

Components are tested in the real browser, never in a simulated DOM. `bun run dev`, learn
`agent-browser --help`, and open `http://localhost:5173/?nosplash` — it skips the splash and intro so
the fight is running on first paint (`src/main.ts`, also takes `&muted`):

```
agent-browser batch --bail "open http://localhost:5173/?nosplash" "wait 1000" "screenshot /abs/path.png"
agent-browser eval 'balancemender.perform({type: "spawn", unit: "Haruk"})'
```

`window.balancemender` is the running game, so `eval` reaches all of it. A relative screenshot path
lands in the repo root. To press ability keys mid-fight, `focus .Game` first in the same batch — they
only land where DOM focus is. Batch `eval` mangles quoted strings, so run `agent-browser eval '…'` as
its own invocation. A batch step splits on spaces, so `hover .a .b` silently hovers `.a` — use a
single-token selector. Hovering twice in a row without moving away first fires no second
`pointerover`, so a hover test starts by hovering something else. The dev panels start minimized —
`dblclick floating-view>header` opens the first one (Balance Lab).

To reach the game over panel, end the fight on demand — `{type: 'wipe', faction: 'enemy'}` for the
victory side, `'party'` for defeat. Also two buttons in the Balance Lab.

Tooltips are one element for the whole game (`src/components/tooltip.ts`). An icon claims it with
`data-tip="kind:id"` and its component registers what that kind draws — never rendered text, so the
body redraws live with the rest of the UI. Its edge and flip behaviour is easiest to check on a
throwaway mockup page (below) with anchors parked in all four corners.

To explore a UI direction, build a throwaway `public/*-mockup.html` (gitignored, self-contained,
loading real assets by URL) with several variants in one file on a keypress switcher, and one of them
a recreation of the current UI as the control. Screenshot them and compare.

[docs/performance.md](./docs/performance.md) is how we time a frame — `src/perf.ts` is on in the real
build, and `perf.report()` in the page prints the table. Measure before believing anything is slow.

CSS values stick to a coarse scale — 0.2, 0.4, 0.5 — not 0.35.
