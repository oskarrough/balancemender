This project uses GitHub issues for tasks. Treat this file as a living field guide, not a second source of truth: surface inconsistencies or contradictions explicitly, follow the authoritative reference, and add only durable general guidance or links that prevent the same stumble recurring.

Always run subagents in the background.

`bun run check` typechecks, lints and formats. `bun run test` runs Vitest in plain Node (never
`bun test`). Run both before committing, not while working. The `main` branch deploys to
balancemender.0sk.ar. [docs/simulation.md](./docs/simulation.md) is the testing and simulation guide.

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

When pinning a design, prefer a one-sentence summary — much easier to communicate that way.

## Testing and balance

One seed cannot establish balance. Use [docs/simulation.md](./docs/simulation.md) to choose between
tests, `sim`, `bench`, `sweep`, and browser checks; use each command's `--help` for its flags.

## Working on the UI

Components are tested in the real browser, never in a simulated DOM. Follow the browser workflow and
interaction gotchas in [docs/simulation.md](./docs/simulation.md#test-in-the-browser).

[docs/performance.md](./docs/performance.md) is how we time a frame — `src/perf.ts` is on in the real
build, and `perf.report()` in the page prints the table. Measure before believing anything is slow.

CSS values stick to a coarse scale — 0.2, 0.4, 0.5 — not 0.35.
