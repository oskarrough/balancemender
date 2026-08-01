# Architecture

The map of the codebase: what is where, and the few rules that hold across all of it.
[glossary.md](./glossary.md) says what the words mean, [combat.md](./combat.md) why the fight is
shaped the way it is, [vroum.md](./vroum.md) the engine underneath,
[simulation.md](./simulation.md) how a fight runs without a browser, and
[performance.md](./performance.md) how to measure the running game.

## The shape of it

```
index.html
  └── src/main.ts            splash → on first keypress, builds the game
        └── GameLoop         (vroum Loop) the clock and the root of everything
              ├── dungeonRun progress through a Dungeon (data in nodes/dungeon.ts), if any
              ├── Fight  owns the party + enemies
              │     └── Unit…             Player, Tank, Pup, Runt, Denmother, Haruk
              │           ├── Stats       base + owned modifiers → health, mana, mana regen
              │           ├── Health/Mana (Resource nodes, emit change events)
              │           ├── Targeting   a preference its drivers ask for one target at a time
              │           ├── abilities   stable id → one-shot Ability class
              │           ├── Cadence     (Task) requests an ability on an interval
              │           ├── threat      enemy-local attention table
              │           └── auras       HOT / DoT (Tasks)
              ├── AudioPlayer
              └── tick() → game.draw(), which main.ts points at components/ui.ts
```

Every frame the loop runs each Task, then re-renders the whole UI with
[uhtml](https://github.com/WebReflection/uhtml). There is no state store in between: components read
the live nodes. `window.balancemender` is the running game, so the browser console and
`agent-browser eval` reach all of it through that. The dev panels are `<floating-view>` elements in
`index.html`, their positions persisted per panel in localStorage via tinybase.

## One way to change the game

Nothing mutates a fight except `game.perform(action)`. Keyboard, ability buttons, dev console, Balance
Lab, bot driver, tests and agents all hand the same typed [`GameAction`](../src/actions.ts) to the
same interpreter, and get back `{ok: true, value}` or `{ok: false, error}` — a refusal you can print,
rather than a missing return value.

```js
balancemender.perform({type: 'use', ability: 'Heal', target: someId})
balancemender.perform({type: 'spawn', unit: 'Haruk'})
balancemender.perform({type: 'tune', of: 'ability', name: 'Heal', key: 'cost', value: 40})
```

The dev console is a text adapter over this and nothing more. Adding a capability means one more case
in the union, not a new command plus a panel button plus a test helper. Spawning goes further: every
unit that joins a fight goes through `Fight.spawn(unitId)`, so faction routing, duplicate
numbering and unknown-id errors are written once.

`src/balance.ts` snapshots the tunable statics of every ability, effect, cadence, aura and unit and
writes changes back to the classes; `src/inspectables.ts` is what the Balance Lab lists. The kinds and
key spellings are in [glossary.md](./glossary.md#tuning-and-measuring).

## The combat log is the interface for analysis

Everything that happens in a fight goes through `game.combatLog.add()`: casts, hits, heals (with the
overhealed portion), auras coming and going, condition changes, deaths, fight start and end. Events
are stamped with `time`, milliseconds into the fight, so a fight simulated in 200ms of wall clock
reads the same as one played for real. That single stream feeds the Combat log panel, the Fight
report panel and the headless simulator in `src/sim/` — log a new mechanic and it shows up in all
three.

The log belongs to one `GameLoop`, as its dice (`game.rng`) and its speaker (`game.audio`) do.
Reach them from anywhere in the fight through the pointer vroum already set: `(this.root as
GameLoop).combatLog`. Nothing here is module state, which is what lets two fights run at once
without writing into each other (#67).

- **Log both an id and a name** for whoever an event touches. The analyzer keys on the id; the name is
  only a label, and it changes mid-fight — spawning a second wolf renames the first one to "Runt
  1", so anything keyed by name splits that unit in two.
- **Log enough that the analyzer needs no game constants.** `SPELL_CAST_START` carries a `busyFor` —
  the cast time or the global cooldown, whichever is longer — which is how the report can say what
  share of a fight a unit spent unable to act without importing `GlobalCooldown`.

## Two things that fail silently

- **A value import from `actions.ts` or `balance.ts` back into `src/nodes/` closes a loop**, and the
  snapshot those modules take at startup then reads a half-built class. Nothing throws — you get a
  registry entry with no value. `import type` is erased and is the fix. It has happened for real:
  `audio.ts` merely naming the `GameLoop` class left `balance.abilities` empty. `registry.test.ts`
  asserts every entry has a value precisely because the failure is invisible. This is also why unit
  ids live in [`unit-registry.ts`](../src/nodes/unit-registry.ts) and not in `registry.ts`.
- **Nothing may need a DOM at import time**, or no fight runs headless at all — see
  [simulation.md](./simulation.md#nothing-may-need-a-dom-at-import-time).

Nothing reads `constructor.name` anywhere: the production build minifies it.
