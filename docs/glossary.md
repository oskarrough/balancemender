# Glossary

What the words mean here. Reach for this before naming a new class or field: a second word for
something that already has one is how two halves of the codebase stop being able to read each
other. Fold new terms in rather than inventing synonyms.

Definitions only — the reasoning lives in [architecture.md](./architecture.md). What we would
rename given a free afternoon is at the [bottom](#drift-worth-fixing).

## The fight

**Unit** — anyone in a fight, player or otherwise. The class is
[`Character`](../src/nodes/character.ts); "unit" is the word for one in play. Prefer it in prose
and in log messages.

**Unit id** — the registry key a unit is spawned from (`'TinyWolf'`, `'Tank'`). Distinct from a
character's `id`, which is unique per spawned instance. Anything keyed across a fight uses the
instance `id`; names change mid-fight when a duplicate is spawned.

**Faction** — `'party'` or `'enemy'`. A static, so the registry can say which side a unit fights
on without spawning one.

**Encounter** — one fight: a party and a set of enemies. **Roster** is the description it is
built from, `{party: ['Tank'], enemies: ['TinyWolf']}`.

**Spawn** — the one way a unit joins a fight. `Encounter.spawn(unitId)` routes it to a side by
the class's own faction, so nothing picks the array itself.

**Alive** — health above zero. Not "in `encounter.party`" — the dead stay in those arrays.

**Condition** — how hurt a unit is: `injured` below 35% health, `healthy` above 80%, `steady`
between. A pure function of the health bar with no memory, and orthogonal to `alive` (a corpse
reads `injured`).

**Hurt** — time spent `injured`. Per unit in the fight report (`injuredTime`); in the sweep,
`hurt%` is the party's worst-off member as a share of the fight.

### Role words

A unit gets a different word depending on the relationship being discussed. These are never
general synonyms for "unit" — reach for them only when the relationship is the point.

**Player** the one at the keyboard · **caster** whoever is casting · **attacker** whoever is
swinging · **source** and **target** the two ends of a hit · **ally** a unit of your own faction.

**Target** — `currentTarget`, and a unit has exactly one. Attacking and casting both read it,
which is why nothing in the game both hits and heals. `getTarget()` filters the dead; the
player's also falls back to the tank, so the healer always has someone to heal.

**Targeting** — the Task that picks a target. `TargetOppositeFaction` for anything that hits,
`TargetOwnFaction` for anything that helps; `prefers()` chooses and `reconsiders()` decides
whether to look again once it has one.

## Doing things

**Action** — a request to change the game, handed to `game.perform()`. May be refused. Not an
event.

**Event** — a record of something that happened, in the combat log. Never refused, never a
request. Keep the two words apart.

**Cast** — a spell in progress. **Cast time** is how long it takes; **GCD** (global cooldown) is
the shared pause after any cast; **cooldown** is one spell's own wait.

**Spellbook** — what one unit can cast, keyed by spell name. The player's is the whole spell
registry; most units have none. Not every castable spell is registered — `Mend` is a wolf's.

**Busy** — time a unit was committed to a cast or its GCD, and so unable to act. Logged per cast
as `busyFor` so the report never has to know how long a GCD lasts.

**Spell** — something a caster decides to use. **Attack** — a swing on an interval that nothing
decides (`DamageEffect`). The difference is who chooses, not what it does.

**Driver** — what decides to use a spell: the keyboard, an `Autopilot` policy, or a `SpellCaster`
ticking on an interval. Casting itself is shared — `SpellCast` refuses for the same seven reasons
whoever is asking, and skips the mana check for a caster with no pool. Only deciding differs.

**Effect** — something that sits on a unit for a while. Today that is `PeriodicEffect`, one class
for both heal-over-time and damage-over-time; a negative `total` hurts. **Aura** is the same
thing seen from the combat log, which is where the WoW-shaped event names come from.

**Total** — what an effect lands over its whole life, not per tick. **Stacks** — how many copies
of an effect one unit carries; `maxStacks` caps it.

**Hit** — one change to a health bar, applied through `applyHit()`. **Overheal** is the part of
a heal that landed on a full bar and did nothing.

**Resource** — a pool with a max and a current: `Health`, `Mana`. **Ratio** is how full, 0 to 1.
**Five-second rule** — mana only regenerates after five seconds without spending any, so a lull
is worth something.

### Task dials

Everything in the game is a vroum `Task`, and four fields say when it runs. They mean the same
thing everywhere, so read them before inventing a timing word.

**`delay`** how long before the first tick — a spell's cast time, an attack's opening wait ·
**`interval`** the gap _between_ ticks, never before the first · **`repeat`** how many ticks
(`1` is one-shot, `Infinity` is standing) · **`duration`** how long it lives.

Whether something repeats is a dial, not a category. A one-tick `PeriodicEffect` is a direct hit.

## Tuning and measuring

**Balance number** — a number the game plays by, reachable from the Balance Lab, the dev console
and `--tune`. Five **kinds**: `spell`, `attack`, `effect`, `unit`, `rule`.

**Rule** — a balance number the whole game reads rather than one belonging to a spell or a unit,
such as where the injured line sits. The only kind read live where it is used, so a retune lands
on the fight already running.

**Tune** — changing one balance number: `kind:Name.key=value`, e.g. `rule:Condition.injured=30`.

**Statics are the template, instance fields are the state.** A class declares `static heal`;
`applyStatics()` copies it onto the instance at construction. So a retune reaches the next cast
and the next swing, never the one already in flight — and patching a prototype does nothing.

**Policy** — a rule for what the autopilot casts next: `idle`, `triage`, `renew`, `panic`. The
fake player's personality. Which ability, never which target — choosing among the units an ability
may land on is a **preference**.

**Autopilot** — the Task that plays the healer, so a fight can run with nobody at the keyboard.
It casts through the same `perform()` the keyboard does.

**Idle** — the policy that casts nothing, and so the **control group**: what happens to this
fight without a healer at all.

**Outcome** — how a fight ended: `victory` (every enemy dead, even if the healer died on the
way), `defeat`, or `timeout`.

**Report** — what `analyze()` makes of a combat log: per-unit and per-spell totals, deaths,
health over time. Pure, so the terminal and the in-game panel agree by construction.

**Seed** — one deterministic run. **Sweep** — every roster against every policy over many seeds.

**±** — half the 95% interval on a win rate, in points. At 10 seeds it is about ±23, wider than
most retunes; comparing two candidates takes roughly 200.

## Words we don't use

**Actor** — not a synonym for unit. It survives in `ActorStats` and `healerOf`, meaning a row of
totals keyed by id, which is a different thing from a unit and should probably be renamed anyway.

**Character** — reserved for persistent or narrative identity, not for a combatant. The class is
still called `Character`; see below.

**Combatant, entity, mob, creature, fighter** — all mean unit. Say unit.

**Effect** as a bare noun in prose — it means three different things in the code today (see
below), so name which one.

## Drift worth fixing

Recorded rather than fixed. Each is a real collision found while writing this down.

**`Character` should be `Unit`.** One thing, three words: `unit` (234 uses — spawning, the
registry, balance, `--tune`, the CLI), `Character` / `character` (160), `actor` (26). The word is
settled — unit — but the class, `character.ts`, `CharacterEffect` and `data-character-id` have
not caught up. `character.id` already means something else, which is part of why the rename is
worth doing rather than the reverse. Plan item 5, not started — it touches nearly every file, so
it wants a quiet tree.

**"Effect" means three unrelated things.** `DamageEffect` is a swing (already called an attack by
`attackRegistry`, `ATTACK_KEYS` and the `attack` balance kind); `PeriodicEffect` is something
carried by a unit (already called an aura by every `SPELL_AURA_*` event); the `effect` balance
kind means only "an aura nothing casts", because one a spell owns keeps its number on the spell.
Under discussion. The leading candidate is to retire `effect` as a standalone noun — attack for
the swing, aura for the carried thing — and reserve `SpellEffect`, unused, for the day a spell
needs to declare more than one thing it does. WoW's own model is worth knowing here: a spell has
N _effects_ (heal, damage, apply-aura), and an _aura_ is the runtime result of the apply-aura
kind. Buff, debuff, HoT and DoT are all auras; they differ in what they do while attached.

**`HugeAttack` is misfiled.** "Nasty arrow" is a boss ability on a 12s cadence, which is exactly
what `SpellCaster` does — but it predates `SpellCaster` and is a `DamageEffect` instead. So there
are two mechanisms for "a thing on a cadence", and `enemies.ts` says so out loud. Making it a
spell would leave `DamageEffect` meaning purely "the swing" and the naming would follow.

**Ability, cast and driver are three layers, and `DamageEffect` welds two of them.** `WolfBite` is
both _what happens_ (4-7 damage, plant a Rend) and _when_ (every 3800ms, forever). A `Spell`
carries only the first; the timing comes from a driver. That weld is the reason Savage Bite can't
go on the action bar — not that it's an attack. Unwelding it would also need a spell to declare
whether it wants a friend or an enemy, since a unit has one target and the player's falls back to
the tank (#42).

**"Roster" means three things.** `{party, enemies}` in `Encounter`; enemies only in
`sweep --rosters`; and "the units that fought" (`UnitInfo[]`) in the report.

**`spellId` is a name.** Every `logCombat` call sets `spellId` and `spellName` to the same string,
and `SpellId` in the registry is a display name too. Either the id should become one or the field
should go.
