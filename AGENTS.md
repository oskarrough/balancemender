This project uses GitHub issues for tasks.

To typecheck, lint and format run `bun run check`
To test, run `bun run test` (never run `bun test`)
Run those two before committing, not while working.
To simulate fights headlessly, `bun run sim --help` — see [docs/simulation.md](./docs/simulation.md)

For browser testing, `bun run dev` and learn `agent-browser --help`. To screenshot a running
fight, use one `batch` — separate invocations refocus the tab, and the splash ignores input for
200ms after that (`src/main.ts`), so the key never lands:

```
agent-browser batch --bail "open http://localhost:5173" "wait 1500" "press Space" \
  "wait 6000" "find text Play click" "wait 3000" "screenshot /abs/path.png"
```

A key only dismisses the splash, the intro animation then covers Play for ~5s, the loop sits
paused at 0s until Play, and a relative screenshot path lands in the repo root.

To explore a UI direction, build a throwaway `public/*-mockup.html` (gitignored, self-contained,
loading real assets by URL) with several variants in one file on a keypress switcher, and one of
them a recreation of the current UI as the control. Screenshot them and compare.

CSS values stick to a coarse scale — 0.2, 0.4, 0.5 — not 0.35.

The `main` branch deploys to balancemender.0sk.ar

## Where things are

Read [docs/architecture.md](./docs/architecture.md) first — it is the map of the codebase and
covers the vroum lifecycle rules that are easy to get wrong.

- `src/main.ts` boots the splash, then builds a `GameLoop` on the first keypress
- `src/nodes/` is the game: loop, encounter, units, abilities, auras, resources
- `src/components/` is the UI (plain custom elements + uhtml), re-rendered by the loop each frame
- `src/combatlog.ts` is the event stream every fight writes to
- `src/sim/` runs fights without a browser and turns combat logs into reports
- `src/actions.ts` is the one interpreter — `game.perform(action)` — every mutation goes through
- `src/balance.ts` is the tunable numbers it writes to

`ast-grep outline src/nodes/` lists the classes, methods and fields of a directory without reading
it — the fastest way to see what a file holds before opening it. Add `--items exports` for the
public surface of a directory, or `--json` to work over it.

[docs/glossary.md](./docs/glossary.md) is what the words mean. Reach for it before naming a new
class or field, and fold a term into it rather than inventing a second word for something. The
words that catch people out: everything a unit can do is an **ability** (a spell and an attack are
tags on one, not two classes), one **use** of it is a one-shot Task, a **driver** decides when,
`magnitude` is how big it lands, and an **id** is what the code files an ability under while a
**name** is only what the player reads.

## Answering "what happens if…" questions

Don't guess at balance — run it:

```
bun run sim --enemies 'TinyWolf*3' --bot triage --repeat 10
```

Then read the report. The same numbers show up in the in-game "Fight report" panel while you
play, because both come from `analyze()` over the same combat log.

One seed cannot tell a balanced fight from a lucky roll, and one enemy group cannot tell you the
shape of the difficulty curve. For that, sweep:

```
bun run sweep                                    # the shape of the curve
bun run sweep --seeds 200 --enemies 'TinyWolf*4' --tune 'aura:Rend.total=-16'
```

Read the `idle` column first — it is the control group. A retune that lifts a win rate by making
the healer irrelevant shows up as `idle` climbing too.

Read `±` second. It is the 95% interval on that win rate, and at the default 10 seeds it is
around ±23 points — wider than most retunes. **Comparing two candidates takes ~200 seeds.** Fewer
has been mistaken for a result here more than once.

Read `hurt%` third — the share of the fight the party's worst-off member spent below the injured
line. A win at 0% hurt was never in doubt, so an enemy group where `idle` also sits near 0% is not a
fight worth tuning. Between two retunes that win equally often, the one that leaves `hurt%` alone
made the healer better and the one that lowered it made the fight easier.

`--tune 'kind:Name.key=value'` changes a balance number for the run, so a candidate never needs a
source edit you have to remember to undo. The kinds are `ability`, `cadence`, `aura`, `unit` and
`rule` — spells and attacks are both abilities, `cadence` is how often a unit uses one, and a rule
is a number the whole game reads, like where the injured line sits (`rule:Condition.injured=30`),
which unlike the rest lands on the fight already running. How much an ability lands for is
`magnitude` (`ability:Renew.magnitude=140`); damage is `minDamage`/`maxDamage`. Redirect `--json`
to a file rather than piping it; a pipe truncates at 64KB and the parse error looks like a bug in
the report.
