# Architecture

A map of the codebase, written for whoever (or whatever) has to find their way around it next.

## The shape of it

```
index.html
  └── src/main.ts            splash → on first keypress, builds the game
        └── GameLoop         (vroum Loop) the clock and the root of everything
              ├── Encounter  owns one fight: party + enemies
              │     └── Character…        Player, Tank, TinyWolf, WolfShaman, Nakroth
              │           ├── Health/Mana (Resource nodes, emit change events)
              │           ├── Targeting   (Task) picks currentTarget
              │           ├── DamageEffect(Task) swings on an interval
              │           ├── SpellCaster (Task) casts on an interval
              │           └── effects     HOT / DoT (Tasks)
              ├── AudioPlayer
              └── tick() → renders components/ui.ts into `game.element`
```

Every frame the loop runs each Task, then re-renders the whole UI with
[uhtml](https://github.com/WebReflection/uhtml). There is no state store in between: the
components read the live nodes. `window.balancemender` is the running game — the browser
console and `agent-browser eval` can reach the whole thing through it.

## vroum, and the parts that surprise people

[vroum](https://gitlab.com/jfalxa/vroum) gives us `Loop`, `Node` and `Task`. Things worth
knowing before you debug something strange (see also [vroum.md](./vroum.md)):

- **`mount()` and `destroy()` run down the whole prototype chain**, base class first. A
  subclass `mount()` does not replace its parent's — both run. That is why `Loop.mount()`
  starting the frame loop and `GameLoop.mount()` wiring listeners both happen.
- **The Loop registers itself as one of its own tasks**, so `game.elapsedTime` is the fight
  clock. Everything time-based (the five-second mana rule, cast bookkeeping, the combat log's
  `time` field) reads it. It resets when an encounter is loaded.
- **`connect()`/`disconnect()` are deferred to a microtask.** A node is not mounted on the line
  after you construct it, and a dead character is still in `encounter.party` until the
  microtask runs. Tests and simulations `await Promise.resolve()` to let this settle.
- **Tasks are configured by `delay` / `interval` / `duration` / `repeat`,** not by writing
  timers. A spell is a Task whose `delay` is its cast time; a HoT is a Task with an interval
  and a repeat count.
- **Statics are the template, instance fields are the state.** Classes declare `static heal`,
  `static interval` and so on, and `applyStatics()` copies them onto the instance at
  construction. This is what lets the Balance Lab retune a spell without touching spells that
  are already in flight.

## Casting belongs to Character, deciding does not

Everything a cast needs lives on `Character`: the `spellbook`, the `gcd`, the `cooldowns` stamps,
the cast in progress. `SpellCast` refuses for the same seven reasons whoever is asking, and a
caster with no `mana` simply skips the mana check — which is how enemies cast for free, limited by
a cadence the way a `DamageEffect`'s interval limits a swing.

What is _not_ shared is who decides. The player has a keyboard and an `Autopilot` weighing the
fight; an enemy has a `SpellCaster`, a Task that casts on an interval. That mirrors attacking
exactly — a `DamageEffect` is a swing nothing chooses. A unit wanting real decisions overrides
`SpellCaster.chooses()` rather than growing a policy system.

One catch worth knowing: a unit has **one** `currentTarget`, and both attacking and casting read
it. `WolfShaman` therefore carries no attacks — it spends its target on the ally it is healing
(`MostHurtAlly`, the same-faction mirror of the attacking tasks). A unit that both hit and healed
would need two targets, and nothing does yet.

Casts other than the player's are drawn on the caster's own unit frame. The player's has its own
`CastingInfo` panel, but an enemy cast is otherwise invisible, and an unseen telegraph is not one.

## One way to change the game

Nothing mutates a fight except `game.perform(action)`. The keyboard, the spell buttons, the
dev console, the Balance Lab, the Autopilot, tests and agents all hand the same typed
[`GameAction`](../src/actions.ts) to the same interpreter, and get back `{ok: true, value}` or
`{ok: false, error}` — a refusal you can print, not a missing return value you have to guess at.

```js
balancemender.perform({type: 'cast', spell: 'Heal', target: someId})
balancemender.perform({type: 'spawn', unit: 'Nakroth'})
balancemender.perform({type: 'tune', of: 'spell', name: 'Heal', key: 'cost', value: 40})
```

The dev console is a text adapter over this and nothing more: it parses `/spell Heal cost 40`,
performs the action and prints the result. Adding a capability means adding one case to the
union, not a new command plus a new panel button plus a new test helper.

Actions go in; combat events come out. They are not the same thing — an action is a request
that may be refused, an event is a record of what happened. Keep them separate.

### Spawning, in particular

A fight is described by a `Roster` — `{party: ['Tank'], enemies: ['TinyWolf']}` — and every
unit that joins it goes through `Encounter.spawn(unitId)`. Boot, the dev console, the Balance
Lab, a simulation and a test all end up there, so faction routing, duplicate numbering and
unknown-id errors are written once.

Unit ids come from [`unit-registry.ts`](../src/nodes/unit-registry.ts), which is deliberately
**not** part of `registry.ts`: `player.ts` imports the spell registry, so naming the `Player`
class from inside `registry.ts` reads it mid-initialisation and silently yields `undefined`.
Spawn ids are also why nothing reads `constructor.name` — the production build minifies it.

The same trap catches the registries generally: a **value** import from `actions.ts` or
`balance.ts` back into `src/nodes/` closes a loop and leaves those snapshots reading half-built
classes. Type-only imports are erased, so they are always safe; `import type` is the fix, and
the symptom is a registry entry that exists with no value.

It is a long loop, and it has been closed for real: `audio.ts` naming the `GameLoop` class was
enough, because `game-loop.ts` imports `actions.ts` which imports `balance.ts` which snapshots
spell statics at module-initialisation time. Importing `registry.ts` before `balance.ts` then
gave an empty `balance.spells`. Nothing threw. `registry.test.ts` asserts every entry has a value
precisely because this failure is silent.

`faction` is a static too, so `unitIds('enemy')` answers which side a unit fights on without
spawning one. That is the only reason there is no separate enemy registry.

## Numbers and tuning

`src/balance.ts` snapshots the tunable statics of every spell, attack, periodic effect and unit,
and writes changes back to the classes. An effect only needs its own entry when nothing casts it —
one a spell owns keeps its magnitude on the spell (see `Renew`), where it is already tunable.
Everything reaches it through `perform({type: 'tune', …})`;
`src/inspectables.ts` is what the Balance Lab panel lists. `balance.units` is keyed by the same
unit ids you spawn with, and retuning reaches live units by `unitId` — never by class name.

Changes apply to newly constructed spells and attacks, so they take effect on the next cast or
the next swing — not retroactively.

## The combat log is the interface for analysis

Everything that happens in a fight goes through `logCombat()` in `src/combatlog.ts`: casts,
hits, heals (with the overhealed portion), deaths, encounter start and end. Events are stamped
with `time`, milliseconds into the fight, so a fight simulated in 200ms of wall clock reads the
same as one played for real.

That single stream feeds three things — the Combat log panel, the Fight report panel, and the
headless simulator in `src/sim/`. If you add a mechanic, log it, and it shows up in all three.

Log both an id and a name for whoever an event touches. The analyzer keys on the id; the name is
only a label, and it changes mid-fight — spawning a second wolf renames the first one to
"Tiny wolf 1", so anything keyed by name splits that unit in two.

Getting logged is not left to the caller: **every change to a health bar goes through
`applyHit()`** in [`hit.ts`](../src/nodes/hit.ts), which applies it, floats the number, records
the event and announces the death. Spells, attacks and periodic effects all call it and do
nothing else about it. `PeriodicEffect` is the one class for both heals over time and damage
over time — a negative `total` hurts — because once the health change moved into `applyHit`,
nothing else about them differed. That `total` is what lands over the effect's whole life, not
per tick; a spell can pass its own, which is how `Renew` keeps its number where the balance lab
can tune it.

How many copies of an effect a unit can carry is `maxStacks`, and it defaults to 1 — recasting
replaces what is there and the duration starts over. Raise it for a spell that is _meant_ to
stack; unbounded is not a design. Effects log `SPELL_AURA_APPLIED`/`REFRESH`/`REMOVED`, so an
effect coming and going reads from the same stream as the hits it lands.

`interval` is the gap **between** ticks, not before the first one, so by default an effect lands
an instalment the frame it is applied. That is free damage for anything reapplied faster than it
expires — a wolf's bleed refreshed every bite would arrive half as a lump. Set `delay` to
`interval` for the Classic behaviour of waiting a full tick. Renew still front-loads; changing it
is a balance question, not a bug fix (#48).

## Fights without a browser

`src/sim/` runs the real GameLoop on a stepped clock with an `Autopilot` playing the healer.
It is not a second implementation of the game; it is the game with the frame clock and the
keyboard replaced. See [simulation.md](./simulation.md).

## Testing

`bun run test` runs vitest. Tests that touch the game need a DOM — uhtml is imported all the
way down the tree — so start such a file with:

```ts
// @vitest-environment happy-dom
```

Pure code (the combat log, the report analyzer) runs in the default node environment.

**Components cannot be render-tested.** happy-dom is enough to _import_ the game, but uhtml
cannot interpolate an attribute in it — `` html`<div data-type=${x}>` `` throws
`Cannot read properties of null`, while static attributes and interpolated text render fine.
That rules out asserting on rendered markup, which is why a bug like a unit-frame selector
matching nothing has to be caught in the browser (see below) and not in vitest. Test the nodes
and `perform()`; drive the DOM with `agent-browser`.

## Driving the real game

```
bun run dev
agent-browser open http://localhost:5173/
agent-browser press Space                      # the splash waits for any key
agent-browser eval 'balancemender.perform({type: "cast", spell: "Flash Heal"})'
agent-browser eval 'balancemender.perform({type: "spawn", unit: "Nakroth"})'
agent-browser get text 'fight-report'
```

The dev panels (Balance Lab, Console, Combat log, Fight report, Animation) are `<floating-view>`
elements in `index.html`; their positions persist per panel in localStorage via tinybase.
