# Simulating fights

> What happens if a tank and a healer take on three wolves? Run it ten times and find out.

There is one game. A simulated fight is the same `GameLoop`, the same units and the same combat
log you get in the browser, with two things swapped: animation frames become a fixed step, so two
minutes of fight resolve in a fraction of a second, and the keyboard becomes a `BotDriver`
performing the same `{type: 'use'}` action a keypress does.

```
room ──▶ GameLoop + BotDriver ──▶ combat log ──▶ analyze() ──▶ report
   (or you, playing, in the browser) ──▶  ▲
```

That is why the terminal and the in-game Fight report agree: one analysis, one event stream.

## From the terminal

```
bun run sim                                          # the demo fight
bun run sim --enemies 'Runt*3' --bot panic           # three wolves, a bad healer
bun run sim --repeat 20                              # 20 seeds, summarised
bun run sim --repeat 20 --tune 'ability:Mend.cost=40'
bun run sim --room green-howling --bot triage        # an authored dungeon room
bun run sim --json > fight.json                      # every event, for your own analysis
bun run sim --party= --enemies Pup                   # an invented fight with no tank
```

`--help` lists the flags for both commands. **Redirect `--json`, never pipe it** — a fight's events
run to hundreds of kilobytes and a pipe truncates mid-object, which reads as a bug in the report.

**`--party` defaults to the Tank alone.** A room's verdict is only real with that room's full
party from `dungeon.ts` — `--party 'Tank,Wren,Clover'` for the late dungeons. A 2-body run of a
3-body room reports catastrophe that is not there.

**Prefer `--room` when judging a dungeon room.** It resolves the exact enemies, party, and abilities
available at that point in progression, including grants from earlier dungeons. `--party` and
`--enemies` remain useful for invented compositions, but cannot reproduce progression on their own.

**An ad-hoc empty party needs `--party=`, glued together.** `--party ''` exits with "argument is
ambiguous" — `parseArgs` cannot tell an empty value from a missing one. For the authored solo opener,
use `--room green-stray-pup` instead.

One fight prints health over time, per-unit and per-ability totals, and deaths:

```
Oak + Player  vs  Runt + Runt
seed 1 · triage · victory in 60.0s

  Oak          ██▇██▇██▇██▇██▇▇██▇███▇████▇███▇███▇████  271/300 (90%)
  Runt 1  █▇▇▇▆▆▅▅▅▄▄▃▃▃▂▁▁▁▁·····················  dead 28.8s

  unit         dmg  dps   heal  hps  overheal  taken  casts  busy
  Player         0  0.0  558.6  9.3       65%  257.6     11   55%
  Oak          511  8.5      0  0.0        0%  362.6      0    0%

  mana       cost  drained  gain  net    end
  Player      660        0   135 -525  75/600

  ability      casts  hits  total  mana  per s    avg  overheal
  Mend            11    11   1594   660   26.6  144.9       65%
  Savage Bite      0    22    130     0    2.2    5.9        0%
```

`busy` answers "was the healer out of time, or out of mana?" — at 55% they had nearly half the
fight spare. The mana row separates chosen costs from enemy drain and shows what regeneration
returned and what remained. `per s` is there because a total says nothing about whether a bleed earns its slot
next to a bite that swings three times as often. `--repeat` runs n seeds and prints the same fight
as a distribution: outcomes, durations, and the healer's own throughput kept separate from the
fight's, since enemies heal too.

## Sweeping the curve

`--repeat` answers "how does _this_ fight usually go". `bun run sweep` answers the question above
it — every enemy group against every bot, one table.

```
bun run sweep                                       # 10 seeds, the standard groups
bun run sweep --seeds 200                           # enough to compare two candidates
bun run sweep --enemies 'Runt*3; Haruk' --bots triage,renew
```

```
enemies  bot     win%  ±   hurt%  timeout%  median  hps   aps  overheal%  cost/s  drain/s  gain/s  busy%  casts
Runt*3   idle    0%    14  31%    0%        23.0s   0.0   0.0  0%         0.0     0.0      0.0     0%     0.0
Runt*3   triage  100%  14  7%     0%        86.4s   12.9  0.0  45%        9.6     0.0      3.1     49%    13.8
Runt*3   shield  100%  14  7%     0%        88.8s   5.9   6.3  58%        9.2     0.0      3.5     39%    13.4
Haruk    triage  100%  14  1%     0%        60.0s   15.5  0.0  29%        8.9     0.0      1.8     47%     8.8
Haruk    shield  100%  14  0%     0%        60.0s   2.6   13.2 67%        9.3     0.0      2.5     31%     9.2
```

Read it in this order:

- **`idle` first.** It is the control group — it never casts. A retune that lifts a win rate by making
  the healer irrelevant shows up as `idle` climbing too.
- **`±` second.** It is the 95% interval on that win rate, around ±23 points at the default 10 seeds —
  wider than most retunes. **Comparing two candidates takes ~200 seeds.** ±23 points is not a figure
  of speech: a 78→83 reading has been taken as a result here; at 200 seeds it was 79→80.
- **`hurt%` third** — the share of the fight the party's worst-off member spent below the injured line.
  A win at 0% hurt was never in doubt, so a group where `idle` also sits near 0% is not a fight worth
  tuning. Between two retunes that win equally often, the one that leaves `hurt%` alone made the healer
  better and the one that lowered it made the fight easier.
- **`hps` and `aps` only mean something together.** A point healed was taken and paid back; a point
  absorbed was never taken. Read `hps` alone and the `shield` rows look like a healer doing a third
  of the work, when `3.4 + 12.7` beats `triage`'s `14.9` and arrives before the damage rather than
  after — which is also why `shield` halves `hurt%` while winning no more often.

The curve is quadratic on purpose — the tank kills enemies one at a time, so each one added both
raises incoming damage and lengthens the fight. It used to be inverted, three wolves unwinnable
while the boss was free, which is what a sweep is for finding (#40).

## Benchmarking one authored room

`bench` compares play styles and candidate balance numbers without printing hundreds of individual
fight reports:

```sh
bun run bench --room green-howling --bots idle,triage,renew,panic --seeds 200
bun run bench --room green-howling --seeds 200 \
  --variant 'harder=effect:Rile.frenzy.coefficient=0.2'
bun run bench --room green-howling --seeds 200 --json > benchmark.json
```

Every run includes the baseline. Repeat `--variant 'name=tune,tune'` to compare candidates against
the same seeds; JSON contains only the compact summaries, not combat events.

The outcome table distinguishes ordinary wins from **clean wins** where the whole party survives,
and calls out wins that arrive after the player falls. The pressure table shows who receives the
enemy hits and damage, plus survival by party member. Together those columns reveal a room that wins
at the intended rate while barely attacking the tank. `busy%` counts actual casting time only:
interrupted casts and casts still in progress at death or fight end are clipped to their real span.

## From the browser, and from a test

The **Fight report** panel covers the fight you are playing; its `Simulate 5×` button replays your
composition headlessly, so you can see whether the run you just had was typical. Each simulated
fight owns its combat log, its clock and its dice, so it cannot reach the fight you are playing —
or another simulation running beside it (#67).

Fights are deterministic per seed, so they make ordinary assertions:

```ts
const fight = await runFight({room: {enemies: ['Runt', 'Runt']}, bot: 'triage', seed: 3})
expect(fight.outcome).toBe('victory')
expect(analyze(fight.events).totals.overhealing).toBeLessThan(500)
```

Pin a seed and an ability that quietly becomes twice as strong fails the build.

## Bots

The healer needs to play somehow. `src/nodes/bot.ts` holds them, deliberately simple to read and
to add to: `idle` never casts and is the control group, `triage` matches the heal to the
emergency, `renew` keeps a heal-over-time rolling, `panic` reaches for Patch every time and
drops to Mend when it cannot, `shield` keeps Shield on the tank, `lance` and `nettle` follow
triage while anyone needs healing before attacking the lowest-health enemy, and `steep` follows
triage but reaches for Steep where it would reach for Mend — the one bot that ever casts it, for
measuring the pays-out-after-interrupt heal against Roha's toll (#81). Every bot but `idle` has a
spell to fall back on, deliberately: one whose whole output is a single spell stops
measuring play and starts measuring that spell's availability (#41). Comparing bots on one
composition usually tells you more than
comparing compositions — `idle` dying in 15s while `triage` lasts 47s is the fight's actual
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

Effect size is authored on the effect that lands it, as a share of caster power rather than as hit
points — one row per effect, so a composite ability's parts tune separately:

```sh
bun run sweep --tune 'effect:Renew.renew.coefficient=1.4'
bun run sweep --tune 'effect:SavageBite.rend.coefficient=0.6'
bun run sweep --tune 'rule:Damage.variance=0.1'
```

The first two affect the next ability use or aura application. The damage rule is read when a hit
lands, and changes only direct rolled damage—not healing, barriers, or periodic totals.

## Nothing may need a DOM at import time

This is a browser game and game code may touch the DOM — `effects.ts` queries for the frame it is
about to shake, `floating-combat-text.ts` builds real elements. The line is _when_, not _whether_:

- **At call time, use it** — behind `typeof document === 'undefined'` if a simulation reaches it. That
  is one line, and the fight goes on without the flourish.
- **At import time, nothing may need a DOM.** `import 'uhtml'` and `class X extends HTMLElement` both
  run on load, so either one anywhere `src/nodes/` can reach means no fight runs headless at all.
  Hence the loop's `draw` slot that `main.ts` fills instead of importing `components/ui`, `utils.ts`
  no longer re-exporting uhtml, and `floating-combat-text.ts` declaring its element inside
  `register()`.

Nothing has to be remembered here: the tests run in plain node, so a bad import fails the suite with
`DocumentFragment is not defined` or `HTMLElement is not defined`.

## The pieces

| file                | what it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `src/sim/roster.ts` | `'Runt*3'` → a validated list of unit ids                  |
| `src/sim/run.ts`    | runs the real loop on a stepped clock, returns the log     |
| `src/sim/report.ts` | pure analysis of a combat log, including health over time  |
| `src/sim/format.ts` | plain-text reports                                         |
| `src/sim/room.ts`   | authored room ids, exact lineups, and progression grants   |
| `src/nodes/bot.ts`  | the bots, and the `BotDriver` that runs one                |
| `scripts/sim.ts`    | one fight, or n seeds of it                                |
| `scripts/sweep.ts`  | every enemy group × every bot, over many seeds             |
| `scripts/bench.ts`  | one authored room × bots × candidate variants              |
| `scripts/cli.ts`    | numbers and one-line exits, over `node:util`'s `parseArgs` |

`src/rng.ts` is why any of it repeats: `new GameLoop(room, seed)` gives that fight an `Rng` of its
own, and every damage roll and target choice replays identically. Unseeded — how the browser
plays — it is `Math.random`. A wobble nobody replays (the UI's jitter) must stay out of that stream
or the same seed stops meaning the same fight.

Worth knowing: only units in [`unit-registry.ts`](../src/nodes/unit-registry.ts) can be spawned and
the player is always added; a fight ends when one side is wiped or at `--duration`, and victory
means every enemy dead even if the healer died on the way; the clock steps at 60fps, so anything
depending on frame timing behaves slightly differently at other rates.
