# Architecture

A map of the codebase. [glossary.md](./glossary.md) says what the words mean; this says why things
are the way they are — mostly the traps, each of which has cost someone an afternoon.

## The shape of it

```
index.html
  └── src/main.ts            splash → on first keypress, builds the game
        └── GameLoop         (vroum Loop) the clock and the root of everything
              ├── Encounter  owns the party + enemies
              │     └── Unit…             Player, Tank, TinyWolf, WolfShaman, Nakroth
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
`agent-browser eval` reach all of it through that.

## vroum, and the parts that surprise people

[`src/vroum/`](../src/vroum/) contains the inlined [vroum](https://gitlab.com/jfalxa/vroum)
engine: `Loop`, `Node` and `Task`. [vroum.md](./vroum.md) covers the API. Four lifecycle rules
matter throughout the game:

- **`mount()` and `destroy()` run the whole prototype chain**, base class first — a subclass
  `mount()` does not replace its parent's. That is why `Loop.mount()` starting the frame loop and
  `GameLoop.mount()` wiring listeners both happen.
- **The Loop is one of its own tasks**, so `game.elapsedTime` is the fight clock. Everything
  time-based reads it: the five-second rule, cast bookkeeping, the combat log's `time`. It resets
  when an encounter is loaded.
- **`connect()`/`disconnect()` are deferred to a microtask.** A node is not mounted on the line after
  you construct it, and a dead unit is still in `encounter.party` until the microtask runs. Some of
  it chains — a death takes two hops — so `await settle()` from `test-setup.ts` rather than counting
  your own `Promise.resolve()`s.
- **A `Loop` is thenable**, and vroum resolves that on DESTROY — so `await game` would park on a loop
  that never dies. `GameLoop` overrides `then()` to resolve immediately, which turns a silent 5s
  timeout into an instant `undefined`. A helper that builds a game still should not return it.

## Using an ability is shared, deciding is not

Every unit owns one `abilities` collection, keyed by stable ability id. `AbilityUse` is the single
place that looks an ability up, validates it and runs it: the player's `{type: 'use'}` action,
`BotDriver` and every `Cadence` go through `Unit.useAbility(id)`. One use is a one-shot `Ability`
Task.

Mana, cast time, GCD and cooldown are opt-in data. An ability with a cast time or a GCD takes the
`Unit.currentAbility` slot and follows the cast lifecycle; one with neither runs inside its driver's
tick, spends no mana and ignores a cast already in progress. That difference is data, not a Spell
versus Attack branch in the class tree.

What an ability does when it lands is an ordered list of effects it declares —
[`effects.ts`](../src/nodes/effects.ts) holds `Damage`, `Heal` and `ApplyAura`. Nothing overrides the
lifecycle to add an outcome, and an effect reads its numbers off the ability as it lands, so tuning
still reaches it. Effects are plain objects, not nodes: a vroum child cannot run in the frame it is
constructed, and nothing instantaneous needs a lifecycle.

What is _not_ shared is who decides. The player has a keyboard and a `BotDriver` weighing the fight;
a fixed schedule has a `Cadence`. A unit that needs real decisions overrides `Cadence.shouldUse()`
rather than growing a bot system.

### A target belongs to one use, not to a unit

Whoever decided to act also decided who it lands on, and hands both to `useAbility(id, target)`.
Validation and every effect then see the same unit, and a cast holds the target it started with:
`Ability.target` is `readonly`, so nothing can be swapped under one.

What a cast cannot hold still is the world around it, and `Ability.land()` re-checks eligibility
for exactly two reasons. The target can die. It can also be **removed** from the fight, and
removal is not death — `Encounter.remove()` splices the unit out but leaves its health bar full, so
`alive` still reads true. A guard that only asked `alive` healed a unit that was no longer in the
fight and mounted auras on a node vroum had already detached, which threw inside a microtask where
nothing could catch it.

Who is eligible comes from the ability (`targetRule`); which of them comes from the driver. The
keyboard's preference is `Player.intendedTarget` — the frame the player selected, falling back to
the tank; the `BotDriver`'s is whatever its bot weighed; a `Cadence` asks its unit's
`Targeting.pick(rule)`, which is a preference and a memory per target rule and nothing else. A unit
with no `Targeting` has no way to choose, so its Cadence says so rather than beating in silence.
The selected enemy's frame may read that memory through `Targeting.current(rule)` to show
target-of-target, but it cannot choose or change one.

A unit used to hold one `currentTarget` that every ability read back, so `WolfShaman` could not
both bite and mend — the two drivers would have overwritten each other's aim. Now nothing stores a
target on a unit, so it can carry both. Selecting a frame is player UI state and moves nobody
else's aim: a `BotDriver` healing the tank no longer drags the player's selection with it.

Enemy casts are drawn on the caster's own unit frame; the player's has its own `CastingInfo` panel. A
cast nobody can see warns nobody.

### Threat is local to each enemy

Every enemy owns a `Map<Unit, number>` whose party entries begin at zero. Actual damage adds threat
only to the enemy it landed on. Effective healing adds half as much, divided between every living
enemy observing it; overhealing moves no health and adds none. Both are credited from `applyHit()`,
after shields and health-bar clamping have determined what actually landed, so direct and periodic
effects cannot disagree.

An ability's `threatMultiplier` rides with its hit, including into an aura it plants. Shield Bash
uses a high multiplier; it still earns attention only from the enemy it struck. Holding a pack
therefore needs the tank to work across that pack or gain a multi-target threat ability later — the
core mechanic does not pretend one target was three.

`prefer.threat(enemy)` picks the highest entry. It keeps the current target until a challenger
exceeds it by 10%, and `Targeting.pick()` is still called by a Cadence only when that enemy acts.
Dead and removed units need no threat cleanup because `eligible()` has already removed them from the
candidates. A later taunt can write directly into one enemy's table without changing targeting.
A second argument, `prefer.threat(enemy, 0.2)`, is mischief: those odds per pick of biting someone
at random instead — one wander, then threat pulls it home. The wolf runs on it; a disciplined unit
passes nothing.

## One way to change the game

Nothing mutates a fight except `game.perform(action)`. Keyboard, ability buttons, dev console,
Balance Lab, bot driver, tests and agents all hand the same typed
[`GameAction`](../src/actions.ts) to the same interpreter, and get back `{ok: true, value}` or
`{ok: false, error}` — a refusal you can print, rather than a missing return value.

```js
balancemender.perform({type: 'use', ability: 'Heal', target: someId})
balancemender.perform({type: 'spawn', unit: 'Nakroth'})
balancemender.perform({type: 'tune', of: 'ability', name: 'Heal', key: 'cost', value: 40})
```

The dev console is a text adapter over this and nothing more: it parses `/ability Heal cost 40`,
performs the action, prints the result. Adding a capability means one more case in the union, not a
new command plus a panel button plus a test helper.

### Spawning, in particular

An encounter is described by a `Roster` — `{party: ['Tank'], enemies: ['TinyWolf']}` — and every unit
that joins it goes through `Encounter.spawn(unitId)`, so faction routing, duplicate numbering and
unknown-id errors are written once. Nothing reads `constructor.name`: the production build minifies
it.

Unit ids live in [`unit-registry.ts`](../src/nodes/unit-registry.ts), deliberately **not** in
`registry.ts`, and that split guards the codebase's one silent failure. A **value** import from
`actions.ts` or `balance.ts` back into `src/nodes/` closes a loop, and the snapshot those modules
take at startup then reads a half-built class. Nothing throws — you get a registry entry with no
value. Type-only imports are erased, so `import type` is the fix. It has happened for real:
`audio.ts` merely naming the `GameLoop` class left `balance.abilities` empty. `registry.test.ts`
asserts every entry has a value precisely because the failure is invisible.

`faction` is a static too, so `unitIds('enemy')` answers which side a unit fights on without spawning
one. That is the only reason there is no separate enemy registry.

## Condition: how hurt someone is

`Unit.condition` is a pure function of `health.ratio` with no memory — no hysteresis, no latch. That
is what keeps it safe to ask anywhere, and what would break if a threshold `--tune` can move
mid-fight were compared against a latched state. No ability reads it yet; the fight report does.

Its thresholds are the only balance number of kind `rule`, and the only one read live where it is
used rather than copied onto an instance at construction — so `rule:Condition.injured=30` lands on
the fight already in progress. `gcd` and the five-second rule belong here too, one day.

Crossing a line logs `UNIT_CONDITION` from `applyHit`, for the same reason `UNIT_DIED` is: the
analyzer could replay the health bar, but not what counts as injured, and one holding the old number
would be confidently wrong. From `Health.set()` it would land before its own cause and carry no
source. The known gap runs the other way — the Balance Lab writes a health bar directly, so setting
health or `max` changes a condition silently.

The bots use their own ratios (0.4, 0.7, 0.9) and deliberately do **not** read these bands. They are
the measuring instrument every sweep quotes against, so unifying the numbers would move every win
rate already recorded and make the sweep circular.

## Stats: what a unit brings

Every unit declares five base stats: stamina, intellect, strength, agility and spirit. A live
`Stats` resolves each base plus the modifiers owned by auras on that unit. Modifiers are keyed by
their owner rather than undone with subtraction, so one expiring aura removes exactly its own
contribution even when copies stack or one supersedes another.

Stamina is maximum health, intellect grants 15 maximum mana each, and spirit is mana regenerated
per second. The resource pools keep their current amount when their maximum rises and clamp only
when it falls. Strength and agility deliberately have no derived effect yet; coefficients, dodge
and crit are later slices.

## Numbers and tuning

`src/balance.ts` snapshots the tunable statics of every ability, cadence, periodic aura and unit, and
writes changes back to the classes. A unit's tunable numbers are its base stats; resolved modifiers
belong to the live unit and never rewrite its template. How big an ability lands is one number, `magnitude` — the healing
of `Heal`, the whole heal-over-time of `Renew`, the pool of `Shield` — so an aura a spell
plants needs no balance entry of its own; only one nothing applies does, like `Rend`. Everything
reaches it through `perform({type: 'tune', …})`; `src/inspectables.ts` is what the Balance Lab lists.
`balance.units` is keyed by the unit ids you spawn with, and retuning reaches live units by `unitId`
— never by class name.

Ability changes apply to newly constructed uses, so healing and damage both change on the next use.
Cadence timing is snapshotted when its unit is constructed, so retuning it affects newly spawned
drivers, not a schedule already running. A `rule` is the exception, above.

### Ids and names

Every ability and aura carries two strings, and mixing them up is how the last round of drift
started. `static id` is the identity: registry key, unit collection key, balance key, `--tune`
spelling, cooldown stamp, stack key, the log's `abilityId`. `static name` is the label a player
reads, and nothing else uses it — the log's `abilityName`, the icon filename, a Balance Lab title, a
report row. So renaming what a player reads is a one-line change. Abilities used to be split between
display-name-sensitive spell collections and a separate attack registry, so renaming crossed systems
for no reason.

By convention the id is the class name, and the class is named after the ability rather than after
who owns it or how big it is — `QuickStab`, not `SmallAttack`. The exception is `RenewAura`, which
takes its spell's id so the cast and the heal-over-time it leaves behind report as one ability —
commented where it is declared. `Shield` needs no such subclass: `ShieldAura` is used by only one
spell, so its own `static id`/`static name` already default to `'Shield'`.

## The combat log is the interface for analysis

Everything that happens in a fight goes through `logCombat()` in `src/combatlog.ts`: casts, hits,
heals (with the overhealed portion), auras coming and going, condition changes, deaths, encounter
start and end. Events are stamped with `time`, milliseconds into the fight, so a fight simulated in
200ms of wall clock reads the same as one played for real.

That single stream feeds the Combat log panel, the Fight report panel and the headless simulator in
`src/sim/`. Log a new mechanic and it shows up in all three.

Log both an id and a name for whoever an event touches. The analyzer keys on the id; the name is only
a label, and it changes mid-fight — spawning a second wolf renames the first one to "Tiny wolf 1", so
anything keyed by name splits that unit in two. The same holds for `abilityId`/`abilityName`, and for
a while it did not: both were set to the display name, so the pair looked like it followed this rule
while carrying one string twice. See [Ids and names](#ids-and-names).

Log enough that the analyzer needs no game constants. `SPELL_CAST_START` carries a `busyFor` — the
cast time or the global cooldown, whichever is longer — which is how the report can say what share of
a fight a unit spent unable to act without importing `GlobalCooldown`. Anything the analysis would
otherwise have to assume belongs in the event.

Getting logged is not left to the caller: **every change to a health bar goes through `applyHit()`**
in [`hit.ts`](../src/nodes/hit.ts), which applies it, floats the number, records the event and
announces the death. The `Damage` and `Heal` effects and `PeriodicAura` are its only callers, and do
nothing else about it. That is also why `PeriodicAura` is one class for both heals and damage over
time: once the health change moved into `applyHit`, nothing else about them differed. An `ApplyAura`
effect hands the aura the ability's `magnitude` in place of its own `total`, which is how `Renew`
keeps its number where the Balance Lab can tune it. `maxStacks` defaults to 1, so recasting replaces
what is there — raise it only for an aura that is _meant_ to stack, because unbounded is not a
design.

`interval` is both the default wait before the first tick and the gap between later ticks. The
default is derived from the aura's subclass interval, so a periodic effect waits one full tick even
when it overrides that interval. An intentionally immediate effect must opt in with
`static delay = 0`; explicit zero matters because reapplying such an aura buys another immediate
instalment.

## Fights without a browser

`src/sim/` runs the real GameLoop on a stepped clock with a `BotDriver` playing the healer — not a
second implementation, just the game with the frame clock and the keyboard replaced. See
[simulation.md](./simulation.md).

This is a browser game and game code may touch the DOM — `effects.ts` queries for the frame it is
about to shake, `floating-combat-text.ts` builds real elements. The line is _when_, not _whether_:

- **At call time, use it** — behind `typeof document === 'undefined'` if a simulation reaches it.
  That is one line, and the fight goes on without the flourish.
- **At import time, nothing may need a DOM.** `import 'uhtml'` and `class X extends HTMLElement` both
  run on load, so either one anywhere `src/nodes/` can reach means no fight runs headless at all.
  Hence the loop's `draw` slot that `main.ts` fills instead of importing `components/ui`, `utils.ts`
  no longer re-exporting uhtml, and `floating-combat-text.ts` declaring its element inside
  `register()`.

Nothing has to be remembered here: the tests run in plain node, so a bad import fails the suite with
`DocumentFragment is not defined` or `HTMLElement is not defined`.

## Testing

`bun run test` runs vitest in plain node — there is no fake DOM. `src/test-setup.ts` holds what every
test needs: the `requestAnimationFrame` stub vroum asks for the moment a `Loop` is constructed (it
never fires, so a constructed game sits still until something steps it), `setLogLevel('silent')` so a
failing assertion is not buried in pino, and `settle()` for vroum's deferred lifecycle. Call
`setLogLevel('info')` at the top of a file to watch a fight happen.

**Components are tested in a real browser, not a fake one.** Markup is the thing they exist to
produce, so asserting on it in a simulated DOM tests the simulation as much as the component — a bug
like a unit-frame selector matching nothing survives that happily. Run `bun run dev` and drive the
actual game with `agent-browser`. Vitest is for the logic underneath: the nodes, `perform()`, the
analyzer.

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
