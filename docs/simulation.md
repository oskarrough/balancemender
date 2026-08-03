# Testing and simulating fights

> Use tests for contracts, `sim` for one fight, `bench` for an authored room, `sweep` for the curve,
> and a real browser for UI behaviour.

## Choose the smallest useful run

| question                                                    | command                                          |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Does the project typecheck, lint, and format?               | `bun run check`                                  |
| Does behaviour still satisfy its contracts?                 | `bun run test [file]`                            |
| What happened in one exact dungeon room?                    | `bun run sim --room green-howling --bot triage`  |
| How does that room behave across bots or candidate numbers? | `bun run bench --room green-howling --seeds 200` |
| What is the general difficulty curve?                       | `bun run sweep --seeds 200`                      |
| Does the UI look and respond correctly?                     | Run it in a real browser                         |

One deterministic seed makes a good regression test. It does not establish balance. Use roughly 200
seeds when comparing candidates; the default 10 is only a quick read.

Each command owns its flags in `--help`. Prefer that over copying the full CLI reference into docs.

## Run one fight

```sh
bun run sim --room green-howling --bot triage
bun run sim --room green-howling --bot triage --repeat 20
bun run sim --enemies 'Runt*3' --bot panic
```

`--room` reproduces an authored room's enemies, party, location, and abilities granted by that point
in progression. Use `--party` and `--enemies` only for invented compositions. An intentionally empty
party is `--party=`.

One fight prints the health timeline, deaths, unit and ability totals, mana flow, and cast pressure.
Repeated fights summarize outcomes and durations. Redirect full JSON to a file; combat events are
large enough that piping can truncate the document.

```sh
bun run sim --room green-howling --json > fight.json
```

## Compare an authored room

`bench` gives every bot and balance variant the same room and seeds:

```sh
bun run bench --room green-howling --bots idle,triage,renew,panic --seeds 200
bun run bench --room green-howling --seeds 200 \
  --variant 'harder=effect:Rile.frenzy.coefficient=0.2'
bun run bench --room green-howling --seeds 200 --json > benchmark.json
```

The baseline is always present. Repeat `--variant 'name=tune,tune'` for more candidates.

Read the result in this order:

1. `idle` is the control. If it improves, the room got easier without help from the healer.
2. `win%` and `±` describe the outcome and its uncertainty.
3. `clean%`, `player%`, `party%`, and `after fall%` separate healthy clears from victories that
   arrive after someone falls.
4. The pressure table shows each party member's share of enemy hits and damage. Fully absorbed hits
   still count as hits.
5. `hurt%` measures time spent injured. `busy%` measures actual cast commitment, clipped at
   interruption, death, and fight end. Mana distinguishes time pressure from resource pressure.

Use `sweep` when the question is broader than one authored room:

```sh
bun run sweep
bun run sweep --enemies 'Runt*3; Haruk' --bots triage,renew --seeds 200
```

## Try a balance number

Both `sim` and `sweep` accept repeatable `--tune 'kind:Name.key=value'`. `bench` groups the same specs
under named variants. These all go through [`src/balance.ts`](../src/balance.ts), the same path used
by the Balance Lab, and reject unknown targets instead of silently returning a baseline result.

```sh
bun run sim --room green-howling --tune 'ability:Mend.cost=40'
bun run sweep --tune 'effect:Renew.renew.coefficient=1.4'
```

## Write a regression test

Tests run in Vitest under plain Node; there is no fake DOM. [`src/test-setup.ts`](../src/test-setup.ts)
provides the inert animation-frame stub, quiet logging, and `settle()` for vroum's deferred lifecycle.
Use `setLogLevel('info')` in a test file when watching a fight is more useful than a quiet failure.

```ts
const scenario = authoredRoom('green-howling')
const fight = await runFight({...scenario.trial, bot: 'triage', seed: 3})

expect(fight.outcome).toBe('victory')
expect(analyze(fight.events).totals.overhealing).toBeLessThan(500)
```

Pin the smallest deterministic case that proves the contract. Use a benchmark, not hundreds of
seed assertions, for balance distributions.

## Test in the browser

Components are tested in the real browser:

```sh
bun run dev
agent-browser batch --bail \
  "open http://localhost:5173/?nosplash&muted" \
  "wait 1000" \
  "screenshot /tmp/balancemender.png"
agent-browser eval 'balancemender.perform({type: "spawn", unit: "Haruk"})'
```

`window.balancemender` exposes the running game. Mutate it through `perform()`, the same action path
used by buttons and bots. Focus `.Game` before sending ability keys. Use a single-token selector in
batch steps, and run quoted `eval` expressions separately. Move away before hovering the same target
again. Dev panels start minimized; `dblclick floating-view>header` opens the first one. End a fight
with `{type: 'wipe', faction: 'enemy'}` for victory or `'party'` for defeat.

For visual directions, compare variants in a gitignored `public/*-mockup.html` that uses real assets
and includes the current UI as its control.

## Boundaries that keep the harness trustworthy

A simulation uses the real `GameLoop`, actions, units, and combat log. Only the animation clock and
human input are replaced. The log, random-number generator, and audio player belong to each game, so
parallel fights cannot contaminate one another. See [architecture.md](./architecture.md) for these
boundaries and [combat.md](./combat.md) for targeting and threat.

Nothing reachable from `src/nodes/` may require a DOM at import time. Browser-only work belongs at
call time behind an environment check; a bad import fails the Node test suite immediately.
