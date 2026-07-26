# Simulating fights

> What happens if a tank and a healer take on three wolves? Run it ten times and find out.

There is one game. A simulated fight is the same `GameLoop`, the same characters, spells and
combat log you get in the browser, with two things swapped:

- the browser's animation frames are replaced by a fixed step, so two minutes of fight
  resolve in a fraction of a second, and
- the keyboard is replaced by an `Autopilot` — a Task that performs the same
  `{type: 'cast'}` action a keypress does.

Everything else is untouched. What comes out is an ordinary combat log, which `analyze()`
turns into a report. That is why the terminal and the in-game "Fight report" panel agree: they
run the same analysis over the same events.

```
roster ──▶ GameLoop + Autopilot ──▶ combat log ──▶ analyze() ──▶ report
   (or you, playing, in the browser) ──▶  ▲
```

## From the terminal

```
bun run sim                                        # the demo fight
bun run sim --enemies 'TinyWolf*3' --policy panic  # three wolves, a bad healer
bun run sim --party Tank --enemies Nakroth         # the boss
bun run sim --repeat 20                            # 20 seeds, summarised
bun run sim --json > fight.json                    # every event, for your own analysis
```

| flag         | meaning                                                             |
| ------------ | ------------------------------------------------------------------- |
| `--party`    | allies besides you, comma separated (default `Tank`)                |
| `--enemies`  | enemies; `Name*3` repeats one (default `TinyWolf`)                  |
| `--policy`   | `idle`, `triage`, `renew`, `panic` (default `triage`)               |
| `--seed`     | the dice; the same seed always plays out the same way (default `1`) |
| `--repeat`   | run n fights, one seed apart, and summarise                         |
| `--duration` | give up after n seconds of fight time (default 120)                 |
| `--json`     | print the report and events as JSON                                 |

A single fight prints health graphs, per-actor damage and healing, per-spell breakdowns and
deaths:

```
Tank + Player  vs  Nakroth
seed 1 · triage · defeat in 20.0s

  Tank                   ███████████████·························  dead 8.0s
  Player                 ██████████████████████████████▇▇▇▇█████·  dead 20.0s
  Nakroth the Destroyer  ████████████████████████████████████████  665/750 (89%)

  actor                   dmg   dps  heal  hps  overheal  taken  casts
  Nakroth the Destroyer  1240  61.9     0  0.0        0%     85      0
  Tank                     85   4.2     0  0.0        0%    657      0
  Player                    0   0.0    39  1.9       74%    583      3

  spell        casts  hits  total   avg  overheal
  Nasty arrow      2     2   1150   575        0%
  ...
```

`--repeat` answers the more useful question — how often does this go badly?

```
5 fights · Tank + Player vs TinyWolf*3 · triage

  victory 0 (0%)   defeat 5 (100%)   timeout 0 (0%)
  duration  avg 47.2s  min 45.8s  max 52.8s
  healing   avg 16.0 hps  overheal 16%
  deaths    Tiny wolf 1 5/5   Player 5/5   Tank 5/5
```

## From the browser

The **Fight report** panel shows the fight you are playing right now — health graphs, healing,
overhealing, casts — and its `Simulate 5×` button replays your current composition headlessly
so you can see whether the run you just had was typical.

Simulating from inside a live game borrows the combat log, the clock and the dice and gives them
back, so your own log survives it. The panels hear nothing while it runs, and it deliberately
never yields to the event loop once started — a live frame landing in the middle would write
into the simulation's log and vice versa. Five fights take about a fifth of a second.

## From a test

Deterministic per seed, so fights make ordinary assertions:

```ts
// @vitest-environment happy-dom
import {runFight} from './run'
import {analyze} from './report'

const fight = await runFight({enemies: ['TinyWolf', 'TinyWolf'], policy: 'triage', seed: 3})
expect(fight.outcome).toBe('victory')
expect(analyze(fight.events).totals.overhealing).toBeLessThan(500)
```

This is how a balance change gets a regression test: pin a seed, assert the shape of the
outcome, and a spell that quietly becomes twice as strong will fail the build.

## Policies

The healer needs to play somehow. `src/nodes/autopilot.ts` has four, and they are deliberately
simple to read and easy to add to:

| policy   | plays like                                                    |
| -------- | ------------------------------------------------------------- |
| `idle`   | never casts — the control group                               |
| `triage` | matches the heal to the emergency, ignores anyone nearly full |
| `renew`  | keeps a HoT rolling, fills with Heal                          |
| `panic`  | Flash Heal on cooldown — fast, expensive, overheals           |

Comparing policies on the same composition is usually more informative than comparing
compositions: `idle` dying in 15s while `triage` lasts 47s and `panic` runs out of mana at 25s
tells you what the encounter actually demands.

An Autopilot is a normal Task, so you can watch one play in the browser:

```js
new (await import('/src/nodes/autopilot.ts')).Autopilot(balancemender.player, 'triage')
```

## The pieces

| file                     | what it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `src/sim/roster.ts`      | `'TinyWolf*3'` → a validated list of unit ids                        |
| `src/sim/run.ts`         | runs the real loop on a stepped clock, returns the log               |
| `src/sim/report.ts`      | pure analysis of a combat log, including rebuilding health over time |
| `src/sim/format.ts`      | plain-text reports                                                   |
| `src/nodes/autopilot.ts` | the healer policies                                                  |
| `scripts/sim.ts`         | the CLI                                                              |

`src/rng.ts` is why any of it repeats: seed it and every damage roll and target choice replays
identically. Unseeded — how the browser plays — it is just `Math.random`.

## Limits worth knowing

- Only units in [`src/nodes/unit-registry.ts`](../src/nodes/unit-registry.ts) can be spawned.
  The player is always added.
- A fight ends when one side is wiped, or at `--duration`. "Victory" means every enemy is
  dead, even if the healer died on the way.
- The simulation steps at 60fps by default. Effects that depend on frame timing will behave
  slightly differently at other rates.
