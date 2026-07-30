# Simulating fights

> What happens if a tank and a healer take on three wolves? Run it ten times and find out.

There is one game. A simulated fight is the same `GameLoop`, the same units and the same combat
log you get in the browser, with two things swapped: animation frames become a fixed step, so two
minutes of fight resolve in a fraction of a second, and the keyboard becomes a `BotDriver`
performing the same `{type: 'use'}` action a keypress does.

```
roster ──▶ GameLoop + BotDriver ──▶ combat log ──▶ analyze() ──▶ report
   (or you, playing, in the browser) ──▶  ▲
```

That is why the terminal and the in-game Fight report agree: one analysis, one event stream.

## From the terminal

```
bun run sim                                        # the demo fight
bun run sim --enemies 'TinyWolf*3' --bot panic     # three wolves, a bad healer
bun run sim --repeat 20                            # 20 seeds, summarised
bun run sim --repeat 20 --tune 'ability:Heal.cost=40'
bun run sim --json > fight.json                    # every event, for your own analysis
```

`--help` lists the flags for both commands. **Redirect `--json`, never pipe it** — a fight's events
run to hundreds of kilobytes and a pipe truncates mid-object, which reads as a bug in the report.

One fight prints health over time, per-unit and per-ability totals, and deaths:

```
Tank + Player  vs  TinyWolf + TinyWolf
seed 1 · triage · victory in 60.0s

  Tank         ██▇██▇██▇██▇██▇▇██▇███▇████▇███▇███▇████  271/300 (90%)
  Tiny wolf 1  █▇▇▇▆▆▅▅▅▄▄▃▃▃▂▁▁▁▁·····················  dead 28.8s

  unit         dmg  dps  heal  hps  overheal  taken  casts  busy
  Player         0  0.0   562  9.4       30%      0     10   33%
  Tank         507  8.4     0  0.0        0%    591      0    0%

  ability      casts  hits  total  per s   avg  overheal
  Heal            10    10    807   13.4  80.7       30%
  Savage Bite      0    22    121    2.0   5.5        0%
```

`busy` answers "was the healer out of time, or out of mana?" — at 33% they had two thirds of the
fight spare. `per s` is there because a total says nothing about whether a bleed earns its slot
next to a bite that swings three times as often. `--repeat` runs n seeds and prints the same fight
as a distribution: outcomes, durations, and the healer's own throughput kept separate from the
fight's, since enemies heal too.

## Sweeping the curve

`--repeat` answers "how does _this_ fight usually go". `bun run sweep` answers the question above
it — every enemy group against every bot, one table.

```
bun run sweep                                       # 10 seeds, the standard groups
bun run sweep --seeds 200                           # enough to compare two candidates
bun run sweep --enemies 'TinyWolf*3; Nakroth' --bots triage,renew
```

```
enemies     bot     win%  ±   hurt%  timeout%  median  hps   aps   overheal%  mana/s  busy%  casts
TinyWolf*3  idle    0%    14  25%    0%        24.0s   0.0   0.0   0%         0.0     0%     0.0
TinyWolf*3  triage  90%   19  12%    0%        88.8s   11.0  0.0   25%        9.1     37%    16.0
TinyWolf*3  shield  90%   19  7%     0%        88.8s   5.5   6.1   35%        8.2     29%    13.6
Nakroth     triage  100%  14  2%     0%        60.0s   14.9  0.0   12%        11.0    40%    10.2
Nakroth     shield  100%  14  0%     0%        60.0s   3.4   12.7  32%        9.1     28%    9.4
```

[AGENTS.md](../AGENTS.md) has the reading order — `idle`, then `±`, then `hurt%`. Two things it
does not say:

- **`hps` and `aps` only mean something together.** A point healed was taken and paid back; a point
  absorbed was never taken. Read `hps` alone and the `shield` rows look like a healer doing a third
  of the work, when `3.4 + 12.7` beats `triage`'s `14.9` and arrives before the damage rather than
  after — which is also why `shield` halves `hurt%` while winning no more often.
- **±23 points at 10 seeds is not a figure of speech.** A 78→83 reading has been taken as a result
  here; at 200 seeds it was 79→80.

The curve is quadratic on purpose — the tank kills enemies one at a time, so each one added both
raises incoming damage and lengthens the fight. It used to be inverted, three wolves unwinnable
while the boss was free, which is what a sweep is for finding (#40).

## From the browser, and from a test

The **Fight report** panel covers the fight you are playing; its `Simulate 5×` button replays your
composition headlessly, so you can see whether the run you just had was typical. It borrows the
combat log, the clock and the dice and gives them back, and never yields to the event loop while
running — a live frame landing mid-simulation would write into its log.

Fights are deterministic per seed, so they make ordinary assertions:

```ts
const fight = await runFight({enemies: ['TinyWolf', 'TinyWolf'], bot: 'triage', seed: 3})
expect(fight.outcome).toBe('victory')
expect(analyze(fight.events).totals.overhealing).toBeLessThan(500)
```

Pin a seed and an ability that quietly becomes twice as strong fails the build.

## Bots

The healer needs to play somehow. `src/nodes/bot.ts` holds them, deliberately simple to read and
to add to: `idle` never casts and is the control group, `triage` matches the heal to the
emergency, `renew` keeps a heal-over-time rolling, `panic` reaches for Flash Heal every time and
drops to Heal when it cannot, `shield` keeps Shield on the tank, and `smite` follows
triage while anyone needs healing before attacking the lowest-health enemy. Every bot but `idle` has a
spell to fall back on, deliberately: one whose whole output is a single spell stops
measuring play and starts measuring that spell's availability (#41). Comparing bots on one
composition usually tells you more than
comparing compositions — `idle` dying in 15s while `triage` lasts 47s is the encounter's actual
demand. A `BotDriver` is a normal Task, so one can play in the browser:

```js
new (await import('/src/nodes/bot.ts')).BotDriver(balancemender.player, 'triage')
```

## Trying out a number

`--tune 'kind:Name.key=value'` applies before the fights run and prints itself under the report, so
measuring a candidate never means editing a class and remembering to put it back. It repeats, works
on both commands, and goes through [`src/balance.ts`](../src/balance.ts) — the same path the Balance
Lab writes through, so what you measure is what the game would do. A name or key it cannot reach is
an error rather than a shrug, because a tune that quietly misses returns the baseline table and
reads as "this dial does nothing".

**If you tune by hand instead, do not patch a prototype.** Tunables are instance fields copied from
statics by `applyStatics()` at construction, so `SomeClass.prototype.x = 5` is overwritten by every
instance and the sweep hands back your baseline. The tell is a table identical across every value
you tried. A field with no home in `balance.ts` (`ManaRegen.fiveSecondRule` today) wants one —
failing that, write it on the instance from inside a method.

How big an outcome lands is authored on the effect that lands it, as a share of caster power rather
than as hit points — one row per outcome, so a composite ability's parts tune separately:

```sh
bun run sweep --tune 'effect:Renew.renew.coefficient=1.4'
bun run sweep --tune 'effect:SavageBite.rend.coefficient=0.6'
bun run sweep --tune 'rule:Damage.variance=0.1'
```

The first two affect the next ability use or aura application. The damage rule is read when a hit
lands, and changes only direct rolled damage—not healing, barriers, or periodic totals.

## The pieces

| file                | what it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `src/sim/roster.ts` | `'TinyWolf*3'` → a validated list of unit ids              |
| `src/sim/run.ts`    | runs the real loop on a stepped clock, returns the log     |
| `src/sim/report.ts` | pure analysis of a combat log, including health over time  |
| `src/sim/format.ts` | plain-text reports                                         |
| `src/nodes/bot.ts`  | the bots, and the `BotDriver` that runs one                |
| `scripts/sim.ts`    | one fight, or n seeds of it                                |
| `scripts/sweep.ts`  | every enemy group × every bot, over many seeds             |
| `scripts/cli.ts`    | numbers and one-line exits, over `node:util`'s `parseArgs` |

`src/rng.ts` is why any of it repeats: seed it and every damage roll and target choice replays
identically. Unseeded — how the browser plays — it is `Math.random`.

Worth knowing: only units in [`unit-registry.ts`](../src/nodes/unit-registry.ts) can be spawned and
the player is always added; a fight ends when one side is wiped or at `--duration`, and victory
means every enemy dead even if the healer died on the way; the clock steps at 60fps, so anything
depending on frame timing behaves slightly differently at other rates.
