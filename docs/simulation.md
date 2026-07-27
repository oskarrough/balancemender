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
bun run sim --repeat 20 --tune 'spell:Heal.cost=40'
bun run sim --json > fight.json                    # every event, for your own analysis
```

| flag         | meaning                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| `--party`    | allies besides you, comma separated (default `Tank`)                      |
| `--enemies`  | enemies; `Name*3` repeats one (default `TinyWolf`)                        |
| `--policy`   | `idle`, `triage`, `renew`, `panic` (default `triage`)                     |
| `--seed`     | the dice; the same seed always plays out the same way (default `1`)       |
| `--repeat`   | run n fights, one seed apart, and summarise                               |
| `--duration` | give up after n seconds of fight time (default 120)                       |
| `--tune`     | change a balance number first — `kind:Name.key=value`, repeatable (below) |
| `--json`     | print the report and events as JSON                                       |

**Redirect `--json`, never pipe it.** A fight's events run to a few hundred kilobytes, and a pipe
truncates mid-object at 64KB — what you get back is a JSON parse error that looks like a bug in the
report. `> fight.json` is fine at any size.

A single fight prints health graphs, per-actor damage and healing, per-spell breakdowns and
deaths:

```
Tank + Player  vs  TinyWolf + TinyWolf
seed 1 · triage · victory in 60.0s

  Tank         ██▇██▇██▇██▇██▇▇██▇███▇████▇███▇███▇████  271/300 (90%)
  Player       ████████████████████████████████████████  160/160 (100%)
  Tiny wolf 1  █▇▇▇▆▆▅▅▅▄▄▃▃▃▂▁▁▁▁·····················  dead 28.8s
  Tiny wolf 2  ██████████████████████▇▆▆▆▆▅▄▄▄▃▃▂▂▂▁▁▁·  dead 60.0s

  actor        dmg  dps  heal  hps  overheal  taken  casts  busy
  Player         0  0.0   562  9.4       30%      0     10   33%
  Tank         507  8.4     0  0.0        0%    591      0    0%
  Tiny wolf 2  401  6.7     0  0.0        0%    255      0    0%

  spell        casts  hits  total  per s   avg  overheal
  Heal            10    10    807   13.4  80.7       30%
  Rend             0    66    132    2.2     2        0%
  Savage Bite      0    22    121    2.0   5.5        0%
```

`busy` is the share of the fight that actor spent committed to a cast or its global cooldown, and
it is the column that answers "was the healer out of time, or out of mana?". A healer at 33% has
two thirds of the fight spare, so a policy that loses there is not losing for want of a free
moment. `per s` is there because a total says nothing about whether a bleed is worth its slot
next to a bite that swings three times as often.

`--repeat` answers the more useful question — how often does this go badly?

```
3 fights · Tank + Player vs TinyWolf + TinyWolf · triage

  victory 3 (100%)   defeat 0 (0%)   timeout 0 (0%)
  duration  avg 56.8s  min 55.2s  max 57.6s
  healing   avg 17.9 hps  overheal 23%
  damage    avg 27.1 dps
  healer    9.4 hps  busy 33%  mana 167
  deaths    Tiny wolf 1 3/3   Tiny wolf 2 3/3
```

The `healing` and `damage` lines are the whole fight; the `healer` line is only the actor the
policy drives. They are separate because enemies heal now — a `WolfShaman` in the roster puts its
own work into the fight's total, and reading that as the player's throughput makes an `idle`
control group look like it healed for 6 a second.

### Sweeping the whole curve

`--repeat` answers "how does _this_ fight usually go". One level up is "is the difficulty curve
the shape we think it is", which needs every roster against every policy:

```
bun run sweep                                       # 10 seeds, the standard rosters
bun run sweep --seeds 200                           # enough to compare two candidates
bun run sweep --rosters 'TinyWolf*3; Nakroth' --policies triage,renew
bun run sweep --json > sweep.json
```

```
roster                  policy  win%  ±   timeout%  median  hps   overheal%  mana/s  busy%  casts
TinyWolf*3              idle    0%    24  0%        24.0s   0.0   0%         0.0     0%     0.0
TinyWolf*3              triage  75%   33  0%        86.4s   10.5  26%        8.9     37%    15.3
TinyWolf*4              renew   75%   33  0%        115.2s  13.5  8%         7.9     25%    15.8
TinyWolf*5              triage  0%    24  0%        41.6s   19.7  14%        14.4    56%    11.5
TinyWolf*2, WolfShaman  triage  0%    24  0%        116.8s  15.9  27%        7.6     31%    14.8
Nakroth                 triage  100%  24  0%        60.0s   15.1  12%        11.1    40%    10.3

  4 seeds per cell. ± is the 95% interval on win%, up to 33 points wide here:
  two cells whose ranges overlap are not different, however different they look.
```

Read the `idle` rows first — they are the control group. A retune that lifts a win rate by making
the healer irrelevant shows up as `idle` climbing alongside `triage` instead of staying at 0%.

Then read `±` before believing any comparison. A win rate is a coin flip counted a few times, and
at 10 seeds a cell near 80% is worth about ±23 points — so a retune that moved `triage` from 78%
to 83% moved nothing you can see. This is not hypothetical: exactly that reading was taken as a
result once, and re-running it at 200 seeds turned 78→83 and 48→43 into 79→80 and 40→38, a wash in
both directions. **10 seeds is for seeing the shape of the curve; comparing two candidates needs
around 200.**

`busy%` is the healer's, and it is how #50 was found: it never exceeds 56% even in fights it loses,
so the healer is short of mana, not of time.

This is how the difficulty curve got its shape checked. It used to be inverted — three trash mobs
were unwinnable while the boss was a guaranteed win — because the tank kills enemies one at a time,
so each wolf added both raises incoming damage and lengthens the fight (#40). It is still quadratic
on purpose: `TinyWolf*5` has to stay a wall, and a flat curve cannot give you one.

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
| `src/sim/tune.ts`        | `--tune` specs → the `balance.ts` setters                            |
| `src/nodes/autopilot.ts` | the healer policies                                                  |
| `scripts/sim.ts`         | the CLI                                                              |
| `scripts/sweep.ts`       | `bun run sweep` — every roster × every policy, over many seeds       |
| `scripts/cli.ts`         | argument parsing both commands share                                 |

`src/rng.ts` is why any of it repeats: seed it and every damage roll and target choice replays
identically. Unseeded — how the browser plays — it is just `Math.random`.

## Limits worth knowing

- Only units in [`src/nodes/unit-registry.ts`](../src/nodes/unit-registry.ts) can be spawned.
  The player is always added.
- A fight ends when one side is wiped, or at `--duration`. "Victory" means every enemy is
  dead, even if the healer died on the way.
- The simulation steps at 60fps by default. Effects that depend on frame timing will behave
  slightly differently at other rates.

## Trying out a number

`--tune` takes `kind:Name.key=value` and applies it before the fights run, so measuring a candidate
never means editing a class and remembering to put it back. It works on both commands, it repeats,
and the value it changed is printed under the report:

```
bun run sweep --seeds 200 --rosters 'TinyWolf*4' --tune 'effect:Rend.total=-16'
bun run sim --repeat 20 --tune 'spell:FlashHeal.cost=100' --tune 'unit:TinyWolf.maxHealth=200'
```

`kind` is `spell`, `attack`, `effect` or `unit` — the four categories in
[`src/balance.ts`](../src/balance.ts), which is the same path the Balance Lab writes through, so
what you measure is what the game would do. A name or key it cannot reach is an error, not a
shrug: a tune that quietly misses returns a table identical to the baseline, and that reads as
"this dial does nothing".

Which is the trap to know about if you tune by hand instead. **Do not patch a prototype.** Most
tunables are instance fields copied from statics by `applyStatics()` at construction, so
`SomeClass.prototype.x = 5` is silently overwritten by every instance and the sweep returns your
baseline. Two separate investigations lost a 600-fight sweep and a whole results table to this — the
tell is a table identical across every value you tried.

If a field has no home in `balance.ts` (`ManaRegen.fiveSecondRule` is the current example, since
`UNIT_KEYS` does not reach it), the fix is to give it one. Failing that, write it on the instance
from inside a method rather than on the prototype.
