# Architecture

A map of the codebase, for whoever has to find their way around it next.
[glossary.md](./glossary.md) says what the words mean; this says why things are the way they are —
mostly the traps, each of which has cost someone an afternoon.

## The shape of it

```
index.html
  └── src/main.ts            splash → on first keypress, builds the game
        └── GameLoop         (vroum Loop) the clock and the root of everything
              ├── Encounter  owns the party + enemies
              │     └── Unit…             Player, Tank, TinyWolf, WolfShaman, Nakroth
              │           ├── Health/Mana (Resource nodes, emit change events)
              │           ├── Targeting   (Task) a rule + a preference → currentTarget
              │           ├── abilities   stable id → one-shot Ability class
              │           ├── Cadence     (Task) requests an ability on an interval
              │           └── auras       HOT / DoT (Tasks)
              ├── AudioPlayer
              └── tick() → renders components/ui.ts into `game.element`
```

Every frame the loop runs each Task, then re-renders the whole UI with
[uhtml](https://github.com/WebReflection/uhtml). There is no state store in between: the
components read the live nodes. `window.balancemender` is the running game, so the browser console
and `agent-browser eval` reach all of it through that.

## vroum, and the parts that surprise people

[vroum](https://gitlab.com/jfalxa/vroum) gives us `Loop`, `Node` and `Task`. [vroum.md](./vroum.md)
covers the API: a Task is configured by `delay`/`interval`/`duration`/`repeat` instead of by
writing timers, and statics are the template that `applyStatics()` copies onto an instance. Four
things bite here that are not in that doc:

- **`mount()` and `destroy()` run down the whole prototype chain**, base class first. A subclass
  `mount()` does not replace its parent's — both run. That is why `Loop.mount()` starting the frame
  loop and `GameLoop.mount()` wiring listeners both happen.
- **The Loop is one of its own tasks**, so `game.elapsedTime` is the fight clock. Everything
  time-based reads it: the five-second rule, cast bookkeeping, the combat log's `time` field. It
  resets when an encounter is loaded.
- **`connect()`/`disconnect()` are deferred to a microtask.** A node is not mounted on the line
  after you construct it, and a dead unit is still in `encounter.party` until the microtask runs.
  Tests and simulations `await Promise.resolve()` to let this settle.
- **A `Loop` is thenable** — `Loop.prototype.then` exists — so `await`ing anything that resolves to
  one never comes back. A test helper that builds a game must not return it; assign it to a
  variable the test already has. The symptom is a 5s timeout with no error.

## Using an ability is shared, deciding is not

Every unit owns one `abilities` collection, keyed by stable ability id. `AbilityUse` is the single
place that looks an ability up, validates it and runs it: the player's `{type: 'use'}` action,
`Autopilot` and every `Cadence` all go through `Unit.useAbility(id)`. One use is a one-shot
`Ability` Task.

Mana, cast time, GCD and cooldown are opt-in data. An ability with a cast time or a GCD takes the
`Unit.currentAbility` slot and follows the cast lifecycle; one with neither runs inside its
driver's tick, spends no mana and ignores a cast already in progress. That difference is data, not
a Spell versus Attack branch in the class tree.

What an ability does when it lands is an ordered list of effects it declares —
[`effects.ts`](../src/nodes/effects.ts) holds `Damage`, `Heal` and `ApplyAura`. Nothing overrides
the lifecycle to add an outcome, and an effect reads its numbers off the ability as it lands, so
tuning still reaches it. Effects are plain objects rather than nodes: a vroum child cannot run in
the frame it is constructed, and nothing instantaneous needs a lifecycle.

What is _not_ shared is who decides. The player has a keyboard and an `Autopilot` weighing the
fight; a fixed schedule has a `Cadence`. A unit that needs real decisions overrides
`Cadence.shouldUse()` rather than growing a policy system.

A unit has **one** `currentTarget`, and casting and attacking both read it. That is why
`WolfShaman` carries no attacks: it spends its target on the ally it heals (`Targeting(this,
'ally', prefer.lowestHealth)`, where attackers take the `'enemy'` rule). A unit that both hit and
healed would need two targets, and nothing does yet.

Enemy casts are drawn on the caster's own unit frame; the player's has its own `CastingInfo`
panel. A cast nobody can see warns nobody.

## One way to change the game

Nothing mutates a fight except `game.perform(action)`. The keyboard, the ability buttons, the dev
console, the Balance Lab, the Autopilot, tests and agents all hand the same typed
[`GameAction`](../src/actions.ts) to the same interpreter, and get back `{ok: true, value}` or
`{ok: false, error}` — a refusal you can print, rather than a missing return value you have to
guess at.

```js
balancemender.perform({type: 'use', ability: 'Heal', target: someId})
balancemender.perform({type: 'spawn', unit: 'Nakroth'})
balancemender.perform({type: 'tune', of: 'ability', name: 'Heal', key: 'cost', value: 40})
```

The dev console is a text adapter over this and nothing more: it parses `/ability Heal cost 40`,
performs the action and prints the result. Adding a capability means one more case in the union,
not a new command plus a panel button plus a test helper.

### Spawning, in particular

An encounter is described by a `Roster` — `{party: ['Tank'], enemies: ['TinyWolf']}` — and every
unit that joins it goes through `Encounter.spawn(unitId)`. Boot, the dev console, the Balance Lab,
a simulation and a test all end up there, so faction routing, duplicate numbering and unknown-id
errors are written once. Nothing reads `constructor.name`: the production build minifies it.

Unit ids live in [`unit-registry.ts`](../src/nodes/unit-registry.ts), deliberately **not** in
`registry.ts`, and that split guards the codebase's one silent failure. A **value** import from
`actions.ts` or `balance.ts` back into `src/nodes/` closes a loop, and the snapshot those modules
take at startup then reads a half-built class. Nothing throws — you get a registry entry with no
value. Type-only imports are erased, so `import type` is the fix. It has happened for real:
`audio.ts` merely naming the `GameLoop` class was enough to leave `balance.abilities` empty.
`registry.test.ts` asserts every entry has a value precisely because the failure is invisible.

`faction` is a static too, so `unitIds('enemy')` answers which side a unit fights on without
spawning one. That is the only reason there is no separate enemy registry.

## Condition: how hurt someone is

`Unit.condition` is a pure function of `health.ratio` with no memory — no hysteresis, no latch.
That is what keeps it safe to ask anywhere, and what would break if a threshold `--tune` can move
mid-fight were compared against a latched state. No ability reads it yet; the fight report does.

Its thresholds are the only balance number of kind `rule`, and the only one read live where it is
used rather than copied onto an instance at construction — so `rule:Condition.injured=30` lands on
the fight already in progress. `gcd` and the five-second rule belong here too, one day.

Crossing a line logs `UNIT_CONDITION` from `applyHit`, for the same reason `UNIT_DIED` is logged
there: the analyzer could replay the health bar, but not what counts as injured, and one holding
the old number would be confidently wrong. From `Health.set()` it would land before its own cause
and carry no source. The known gap runs the other way — the Balance Lab writes a health bar
directly, so setting health or `max` changes a condition silently.

The autopilot's policies use their own ratios (0.4, 0.7, 0.9) and deliberately do **not** read
these bands. Those policies are the measuring instrument every sweep quotes against, so unifying
the numbers would move every win rate already recorded and make the sweep circular.

## Numbers and tuning

`src/balance.ts` snapshots the tunable statics of every ability, cadence, periodic aura and unit,
and writes changes back to the classes. How big an ability lands is one number, `magnitude` — the
healing of `Heal`, the whole heal-over-time of `Renew`, the pool of `PowerWordShield` — so an aura
a spell plants needs no balance entry of its own; only one nothing applies does, like `Rend`.
Everything reaches it through `perform({type: 'tune', …})`; `src/inspectables.ts` is what
the Balance Lab panel lists. `balance.units` is keyed by the same unit ids you spawn with, and
retuning reaches live units by `unitId` — never by class name.

Ability changes apply to newly constructed uses, so healing and damage both change on the next
use. Cadence timing is snapshotted when its unit is constructed, so retuning it affects newly
spawned drivers, not a schedule already running. A `rule` is the exception, above.

### Ids and names

Every ability and aura carries two strings, and mixing them up is how the last round of drift
started. `static id` is the identity: the registry key, the unit collection key, the balance key,
the `--tune` spelling, the cooldown stamp, the stack key and the log's `abilityId`. `static name`
is the label a player reads, and nothing else uses it — the log's `abilityName`, the icon
filename, a Balance Lab title, a report row.

The point is that renaming what a player reads is a one-line change. Abilities used to be split
between display-name-sensitive spell collections and a separate attack registry, so renaming
crossed systems for no reason.

By convention the id is the class name, as `abilityRegistry` and `unitRegistry` do, and the class
is named after the ability rather than after who owns it or how big it is — `QuickStab`, not
`SmallAttack`. The exceptions are the two auras a spell plants, `RenewAura` and
`PowerWordShieldAura`: each takes its spell's id so the cast and what it leaves behind report as
one ability. Both are commented where they are declared.

## The combat log is the interface for analysis

Everything that happens in a fight goes through `logCombat()` in `src/combatlog.ts`: casts, hits,
heals (with the overhealed portion), auras coming and going, condition changes, deaths, encounter
start and end. Events are stamped with `time`, milliseconds into the fight, so a fight simulated in
200ms of wall clock reads the same as one played for real.

That single stream feeds three things — the Combat log panel, the Fight report panel, and the
headless simulator in `src/sim/`. If you add a mechanic, log it, and it shows up in all three.

Log both an id and a name for whoever an event touches. The analyzer keys on the id; the name is
only a label, and it changes mid-fight — spawning a second wolf renames the first one to "Tiny wolf
1", so anything keyed by name splits that unit in two.

The same holds for `abilityId`/`abilityName`, and for a while it did not: both were set to the
display name, so the pair looked like it followed this rule while carrying one string twice. See
[Ids and names](#ids-and-names).

Log enough that the analyzer needs no game constants. `SPELL_CAST_START` carries a `busyFor` — the
cast time or the global cooldown, whichever is longer — which is how the report can say what share
of a fight a unit spent unable to act without importing `GlobalCooldown` to find out how long one
lasts. Anything the analysis would otherwise have to assume belongs in the event.

Getting logged is not left to the caller: **every change to a health bar goes through
`applyHit()`** in [`hit.ts`](../src/nodes/hit.ts), which applies it, floats the number, records the
event and announces the death. The `Damage` and `Heal` effects and `PeriodicAura` are its only
callers, and they do nothing else about it. That is also why `PeriodicAura` is one class for both
heals and damage over time: once the health change moved into `applyHit`, nothing else about them
differed. An `ApplyAura` effect hands the aura the ability's `magnitude` in place of its own
`total`, which is how `Renew` keeps its number where the Balance Lab can tune it, and `maxStacks`
defaults to 1, so recasting replaces what is there — raise it only for an aura that is _meant_ to
stack, because unbounded is not a design.

`interval` is the gap **between** ticks, not before the first one, so by default an aura lands an
instalment the frame it is applied. That is free damage for anything reapplied faster than it
expires — a wolf's bleed refreshed every bite would arrive half as a lump. Set `delay` to
`interval` for the Classic behaviour of waiting a full tick. Renew still front-loads; changing it
is a balance question, not a bug fix (#48).

## Fights without a browser

`src/sim/` runs the real GameLoop on a stepped clock with an `Autopilot` playing the healer. It is
not a second implementation of the game; it is the game with the frame clock and the keyboard
replaced. See [simulation.md](./simulation.md).

## Testing

`bun run test` runs vitest. Tests that touch the game need a DOM — uhtml is imported all the way
down the tree — so start such a file with `// @vitest-environment happy-dom`. Pure code (the combat
log, the report analyzer) runs in the default node environment.

The run is quiet: `src/test-setup.ts` calls `setLogLevel('silent')` so a failing assertion is not
buried under a few hundred lines of pino. Call `setLogLevel('info')` at the top of one file to
watch a fight happen. That setup file runs before _every_ test file including the node-environment
ones, so it must not import anything that reaches uhtml — which is why the level lives in
`combatlog.ts` rather than in `utils.ts` next to `log()`.

**Components cannot be render-tested.** happy-dom is enough to _import_ the game, but uhtml cannot
interpolate an attribute in it — `` html`<div data-type=${x}>` `` throws `Cannot read properties of
null`, while static attributes and interpolated text render fine. That rules out asserting on
rendered markup, so a bug like a unit-frame selector matching nothing has to be caught in the
browser. Test the nodes and `perform()`; drive the DOM with `agent-browser`.

## Driving the real game

```
bun run dev
agent-browser open http://localhost:5173/
agent-browser press Space                      # the splash waits for any key
agent-browser eval 'balancemender.perform({type: "use", ability: "FlashHeal"})'
agent-browser eval 'balancemender.perform({type: "spawn", unit: "Nakroth"})'
agent-browser get text 'fight-report'
```

The dev panels (Balance Lab, Console, Combat log, Fight report, Animation) are `<floating-view>`
elements in `index.html`; their positions persist per panel in localStorage via tinybase.
