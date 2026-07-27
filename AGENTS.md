This project uses GitHub issues for tasks.

To typecheck, lint and format run `bun run check`
To test, run `bun run test` (never run `bun test`)
To simulate fights headlessly, `bun run sim --help` — see [docs/simulation.md](./docs/simulation.md)

For browser testing, `bun run dev` and learn `agent-browser --help`.

The `main` branch deploys to balancemender.0sk.ar

## Where things are

Read [docs/architecture.md](./docs/architecture.md) first — it is the map of the codebase and
covers the vroum lifecycle rules that are easy to get wrong.

- `src/main.ts` boots the splash, then builds a `GameLoop` on the first keypress
- `src/nodes/` is the game: loop, encounter, characters, spells, attacks, resources
- `src/components/` is the UI (plain custom elements + uhtml), re-rendered by the loop each frame
- `src/combatlog.ts` is the event stream every fight writes to
- `src/sim/` runs fights without a browser and turns combat logs into reports
- `src/actions.ts` is the one interpreter — `game.perform(action)` — every mutation goes through
- `src/balance.ts` is the tunable numbers it writes to

## Answering "what happens if…" questions

Don't guess at balance — run it:

```
bun run sim --enemies 'TinyWolf*3' --policy triage --repeat 10
```

Then read the report. The same numbers show up in the in-game "Fight report" panel while you
play, because both come from `analyze()` over the same combat log.

One seed cannot tell a balanced fight from a lucky roll, and one roster cannot tell you the
shape of the difficulty curve. For that, sweep:

```
bun run sweep                                    # the shape of the curve
bun run sweep --seeds 200 --rosters 'TinyWolf*4' --tune 'effect:Rend.total=-16'
```

Read the `idle` column first — it is the control group. A retune that lifts a win rate by making
the healer irrelevant shows up as `idle` climbing too.

Read `±` second. It is the 95% interval on that win rate, and at the default 10 seeds it is
around ±23 points — wider than most retunes. **Comparing two candidates takes ~200 seeds.** Fewer
has been mistaken for a result here more than once.

`--tune 'kind:Name.key=value'` changes a balance number for the run, so a candidate never needs a
source edit you have to remember to undo. Redirect `--json` to a file rather than piping it; a
pipe truncates at 64KB and the parse error looks like a bug in the report.
