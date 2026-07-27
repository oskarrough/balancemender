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
unit's `id`, which is unique per spawned instance. Anything keyed across a fight uses the
instance `id`; names change mid-fight when a duplicate is spawned.

**Character** — a named unit. Someone rather than something: a proper noun, a hand-tuned kit, and
unique in a fight. `Nakroth the Destroyer` is the only one today; `Diablo` and `Mephisto` are the
shape of the rest. A wolf is a unit and never a character — you can spawn three and they are
interchangeable, which is why `renumber()` gives you "Tiny wolf 1" and "Tiny wolf 2". A character
should never be renumbered, and nothing enforces that yet. Every character is a unit; almost no
unit is a character.

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

**Id** and **name** — every spell, attack and aura has both. The **id** is what everything files
it under: registry, spellbook, balance, `--tune`, the log's `spellId`, cooldowns, stack keys. The
**name** is what a player reads and is used for nothing else. Conventionally the id is the class
name (`FlashHeal`), the name is prose (`Flash Heal`). Renaming a spell should touch one line.

**Spellbook** — what one unit can cast, keyed by spell id. The player's is the whole spell
registry; most units have none. Not every castable spell is registered — `Mend` is a wolf's.

**Busy** — time a unit was committed to a cast or its GCD, and so unable to act. Logged per cast
as `busyFor` so the report never has to know how long a GCD lasts.

**Spell** — something a caster decides to use. **Attack** — a swing on an interval that nothing
decides (`DamageEffect`). The difference is who chooses, not what it does.

**Driver** — what decides to use a spell: the keyboard, an `Autopilot` policy, or a `Cadence`
ticking on an interval. Casting itself is shared — `SpellCast` refuses for the same seven reasons
whoever is asking, and skips the mana check for a caster with no pool. Only deciding differs.

**Cadence** — the driver that casts at a fixed interval, and the whole of what the `Cadence` class
does: it holds no casting logic, only _when_. Say "a boss ability on a 12s cadence". Not a
"caster" — that is the role word for whoever is casting, and every unit that casts is one.

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

Each is a word to reach past, not a word that means nothing. Where a class still carries one, that
is [drift](#drift-worth-fixing) with a plan against it, not a second opinion.

**Actor** — never for a unit. `ActorStats` is the last holdout, and becomes `UnitStats`.

**Character** — never for a unit _in general_: it means a named unit specifically (above), and
using it for a wolf throws that distinction away. The class still covers everyone, which is the
drift.

**Combatant, entity, mob, creature, fighter** — all mean unit. Say unit.

**Effect** as a bare noun in prose — it means three different things in the code today (see
below), so name which one.

## Drift worth fixing

Recorded rather than fixed, and meant to be worked off slowly — these are not issues. Each is a
real collision found while writing this down.

### The plan (temporary — delete when done)

Mechanical first, design after: 4 changes what 5 and 6 should look like, and `DamageEffect` should
only be renamed once.

| #   | Do                                           | Size | Status     |
| --- | -------------------------------------------- | ---- | ---------- |
| 1   | Give spells a real id, split from the name   | M    | **done**   |
| 2   | Report's `roster: UnitInfo[]` → its own word | S    | next       |
| 3   | `Character`→`Unit`, `ActorStats`→`UnitStats` | L    | quiet tree |
| 4   | Settle effect / aura / attack                | —    | decide     |
| 5   | `HugeAttack` → a spell                       | M    | after 4    |
| 6   | Unweld ability from driver (#42)             | L    | after 5    |

**`Character` should be `Unit`.** One thing, three words: `unit` (234 uses — spawning, the
registry, balance, `--tune`, the CLI), `Character` / `character` (160), `actor` (26). The word is
settled — unit — but the class, `character.ts`, `CharacterEffect` and `data-character-id` have
not caught up. `character.id` already means something else, which is part of why the rename is
worth doing rather than the reverse. Plan item 5, not started — it touches nearly every file, so
it wants a quiet tree.

The rename does not retire `Character`, it narrows it: a character is a _named_ unit, and the
class is the base every unit shares. Once `Unit` is the base class, `Character` is free to mean
what it should — the thing `Nakroth` is and `TinyWolf` is not. `ActorStats` becomes `UnitStats`
in the same sweep.

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
what `Cadence` does — but it predates `Cadence` and is a `DamageEffect` instead. So there
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

**~~`spellId` is a name.~~** Fixed. Every spell, attack and aura now carries `static id` alongside
`static name`, and the id is what everything keys on — see
[Ids and names](./architecture.md#ids-and-names). `--tune 'spell:FlashHeal.cost=40'` rather than
`'spell:Flash Heal.cost=40'`.
