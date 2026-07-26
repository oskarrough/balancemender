# Architecture

A map of the codebase, written for whoever (or whatever) has to find their way around it next.

## The shape of it

```
index.html
  └── src/main.ts            splash → on first keypress, builds the game
        └── GameLoop         (vroum Loop) the clock and the root of everything
              ├── Encounter  owns one fight: party + enemies
              │     └── Character…        Player, Tank, TinyWolf, Nakroth
              │           ├── Health/Mana (Resource nodes, emit change events)
              │           ├── Targeting   (Task) picks currentTarget
              │           ├── DamageEffect(Task) swings on an interval
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

`faction` is a static too, so `unitIds('enemy')` answers which side a unit fights on without
spawning one. That is the only reason there is no separate enemy registry.

## Numbers and tuning

`src/balance.ts` snapshots the tunable statics of every spell, attack and unit, and writes
changes back to the classes. Everything reaches it through `perform({type: 'tune', …})`;
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
