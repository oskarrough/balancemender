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

**Encounter** — the live thing in the game tree holding a party and a set of enemies. **Roster** is
the description it is built from, `{party: ['Tank'], enemies: ['TinyWolf']}` — a request, never a
record. Who actually fought is the report's `units`.

**Fight** — one run of an encounter, and the sim layer's word: `FightSpec` is the roster plus how
to run it (a policy, a seed, a duration), and `FightResult` and `FightReport` are what came of one.
Say "encounter" for the thing in the tree and "fight" for a run of it. Never "fight" for the object
itself, however natural it reads — most of the codebase's prose still does, which is
[drift](#drift-worth-fixing).

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

**Target** — who a use of an ability lands on. An argument, not a possession: `whyNotCast(caster,
SpellClass, target)` already takes it as one, and the Autopilot already hands one over. Today it
also exists as a stored slot, `currentTarget`, and a unit has exactly one — which is why nothing
in the game both hits and heals, and why the player's `getTarget()` falls back to the tank. That
slot is [drift](#drift-worth-fixing).

Picking one is two separate questions, and they are two words:

**Target rule** — which units an ability may land on at all: `enemy`, `ally`, `self`. A property
of the ability, because it never changes with who is using it or when. `TargetRule` is the type and
`eligible(unit, rule)` answers it. No ability carries one yet — the unit's `Targeting` holds it,
which is as close as it gets until item 8 gives abilities somewhere to put it.

**Preference** — which of the eligible units to pick. A property of the _driver_, not the unit and
not the ability: the keyboard, an `Autopilot` weighing the fight, or a standing rule like "always
the most hurt". One object with two methods: `prefers()` picks, `reconsiders()` decides whether to
look again once it has one. They stay together because they have to agree — a preference for the
most hurt ally that does not re-pick heals someone already topped up. The four are `prefer.first`,
`prefer.atRandom`, `prefer.lowestHealth` and `prefer.tankFirst`, and a unit is handed one alongside
a rule: `new Targeting(this, 'ally', prefer.lowestHealth)`.

**Selected target** — the one the player clicked. UI state, kept because a player needs to see
what they are aiming at; not what an ability reads.

## Doing things

**Action** — a request to change the game, handed to `game.perform()`. May be refused. Not an
event.

**Event** — a record of something that happened, in the combat log. Never refused, never a
request. Keep the two words apart. The `SPELL_*` event names predate this vocabulary and stay as
they are: renaming them would break every log already recorded, and WoW lives with the same wart.

**Ability** — something a unit can use: what it requires and what it does, with no opinion about
when. One live use is a one-shot Task; a driver decides when to create it. **Use** is the verb
covering the whole category. There is no `Ability` class yet — a spell is a `Spell`, an attack is
an `Attack`, and they share no base — but the umbrella already exists in the combat log, in
`Hit.abilityId`, set by spells, swings and auras alike. See [drift](#drift-worth-fixing).

**Spell** — a magical ability. **Attack** — an ability that strikes or otherwise directly harms
a target. They are tags, not subclasses, and may overlap: Flash Heal is a spell, Savage Bite is
an attack, and Fireball is both. Neither who triggered an ability nor whether it repeats decides
its tags. Renew is instant and still a spell; Nasty arrow has a wind-up and is still an attack.

**Tag** — a classification an ability may share with any number of others: `spell`, `attack`,
`healing`, `melee`, `ranged`. Tags let rules and equipment ask what an ability counts as without
choosing its execution path. No field carries them yet.

**School** — the flavour of an ability's power or damage: `physical`, `holy`, `fire`, and so on.
Orthogonal to tags: Fireball can be a spell and an attack of the fire school; Savage Bite is an
attack of the physical school. No field carries it yet.

**Effect** — one thing an ability does when it lands: heal, damage, or apply an aura. An ability
may have several, so it is a list rather than a field. Not the thing left sitting on the unit
afterwards — that is an aura.

**Cast** — a spell in progress. **Cast time** is how long it takes; **GCD** (global cooldown) is
the shared pause after any cast; **cooldown** is one ability's own wait. A unit **casts** a spell
and **swings** an attack; it **uses** either.

**Id** and **name** — every ability and aura has both. The **id** is what everything files it
under: registry, spellbook, balance, `--tune`, the log's `abilityId`, cooldowns, stack keys. The
**name** is what a player reads and is used for nothing else. Conventionally the id is the class
name (`FlashHeal`), the name is prose (`Flash Heal`). Renaming an ability should touch one line.

**Spellbook** — what one unit can cast, keyed by spell id. The player's is the whole spell
registry; most units have none. Not every castable spell is registered — `Mend` is a wolf's.

**Busy** — time a unit was committed to a cast or its GCD, and so unable to act. Logged per cast
as `busyFor` so the report never has to know how long a GCD lasts.

**Driver** — what decides when an ability is used: the keyboard, an `Autopilot` policy, or a
`Cadence` ticking on an interval. Using is shared — `SpellCast` refuses for the same seven reasons
whoever is asking, and skips the mana check for a caster with no pool. Only deciding differs.

**Cadence** — the driver that uses an ability at a fixed interval, and the whole of what the
`Cadence` class does: it holds no casting logic, only _when_. Say "a boss ability on a 12s
cadence". Repetition belongs to the cadence and never to the ability. Not a "caster" — that is the
role word for whoever is casting, and every unit that casts is one.

**Aura** — something that sits on a unit for a while: it has a source, a lifetime, and it lives in
the unit's `auras` set until it expires. What an apply-aura effect leaves behind. **Buff** and
**debuff** are the same thing by polarity, helpful or harmful — prose words, because nothing in
the code branches on which. `SPELL_AURA_APPLIED` / `REFRESH` / `REMOVED` is how one reaches the
combat log. `Aura` is the word and the type, but only as an alias for `PeriodicAura` — a real base
that other shapes (a shield, a stat change) could share is still open, see
[drift](#drift-worth-fixing).

**Periodic aura** — an aura that lands an instalment on a cadence. Heal-over-time and
damage-over-time are one class, and a negative `total` is the whole of what makes it a DoT. It is
the only shape an aura can take today; an always-on stat change or an absorb pool has nowhere to
live yet (#34, #47).

**Total** — what an aura lands over its whole life, not per tick. **Stacks** — how many copies of
one aura a unit carries; `maxStacks` caps it.

**Hit** — one change to a health bar, applied through `applyHit()`. **Overheal** is the part of
a heal that landed on a full bar and did nothing.

**Resource** — a pool with a max and a current: `Health`, `Mana`. **Ratio** is how full, 0 to 1.
**Five-second rule** — mana only regenerates after five seconds without spending any, so a lull
is worth something.

### Task dials

Everything in the game is a vroum `Task`, and four fields say when it runs. They mean the same
thing everywhere, so read them before inventing a timing word.

**`delay`** how long before the first tick — an ability's wind-up, a cadence's opening wait, or
an aura's wait before its first instalment · **`interval`** the gap _between_ ticks, never before
the first · **`repeat`** how many ticks (`1` is one-shot, `Infinity` is standing) · **`duration`**
how long it lives.

One use of an ability is one-shot. Repetition belongs to its driver; an aura may repeat because
its persistence is the behavior the Task represents.

## Tuning and measuring

**Balance number** — a number the game plays by, reachable from the Balance Lab, the dev console
and `--tune`. Five **kinds**: `spell`, `attack`, `aura`, `unit`, `rule`.

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

**Report** — what `analyze()` makes of a combat log: per-unit and per-ability totals, deaths,
health over time. Pure, so the terminal and the in-game panel agree by construction.

**Seed** — the number that makes a fight reproducible: same seed, same fight. Not a word for the
run itself — that is a fight. **Sweep** — every enemy group against every policy over many seeds.

**±** — half the 95% interval on a win rate, in points. At 10 seeds it is about ±23, wider than
most retunes; comparing two candidates takes roughly 200.

## Words we don't use

Each is a word to reach past, not a word that means nothing. Where a class still carries one, that
is [drift](#drift-worth-fixing) with a plan against it, not a second opinion.

**Actor** — never for a unit. `ActorStats` is the last holdout, and becomes `UnitStats` with the
report's `actors` becoming `units`. The one other use is unrelated and stays: `hit.ts` bundles the
two ends of a hit as `actors` before spreading them into a log event, which is log fields and not
units.

**Character** — never for a unit _in general_: it means a named unit specifically (above), and
using it for a wolf throws that distinction away. The class still covers everyone, which is the
drift.

**Combatant, entity, mob, creature, fighter** — all mean unit. Say unit.

**Effect** — never for the thing sitting on a unit. That is an **aura**. Here `effect` means
exactly one thing: what an ability does when it lands.

**Skill** — never for an ability. `skill` is the progression word (#15, #31), kept free for it.

## Drift worth fixing

Recorded rather than fixed, and meant to be worked off slowly — these are not issues. Each is a
real collision found while writing this down.

### The plan (temporary — delete when done)

The words are settled; what is left is renaming. Do the mechanical ones first — they are safe in
any order — and let the two structural ones wait for the issues that teach us what the base needs.

| #   | Do                                                | Size | Status      |
| --- | ------------------------------------------------- | ---- | ----------- |
| 1   | Give spells a real id, split from the name        | M    | **done**    |
| 2   | Settle ability / spell / attack / aura            | —    | **decided** |
| 3   | `roster` → `units` / `--enemies`                  | S    | **done**    |
| 4   | The aura renames                                  | M    | **done**    |
| 5   | `Character`→`Unit`, `ActorStats`→`UnitStats`      | L    | ready       |
| 6   | Extract the `Aura` base                           | M    | with #47    |
| 7   | Split `Targeting` into rule + preference          | S    | **done**    |
| 8   | Unweld ability from driver; `Ability` class (#42) | L    | after 6, 7  |
| 9   | Stop the prose calling an encounter a fight       | S    | **done**    |
| 10  | `report.spells` → `abilities`, keyed as it is     | S    | **done**    |

**`Character` should be `Unit`.** One thing, three words: `unit` (234 uses — spawning, the
registry, balance, `--tune`, the CLI), `Character` / `character` (160), `actor` (26). The word is
settled — unit — but the class, `character.ts` and `data-character-id` have not caught up.
`character.id` already means something else, which is part of why the rename is worth doing
rather than the reverse. Plan item 5, not started — it touches nearly every file, so it wants a
quiet tree.

The rename does not retire `Character`, it narrows it: a character is a _named_ unit, and the
class is the base every unit shares. Once `Unit` is the base class, `Character` is free to mean
what it should — the thing `Nakroth` is and `TinyWolf` is not. `ActorStats` becomes `UnitStats`
in the same sweep, and the report's `actors` field becomes `units`.

**`HugeAttack` is misfiled, but not in the way we thought.** "Nasty arrow" is a boss ability on a
12s cadence, and there are two mechanisms for that — `Cadence`, and an `Attack` with a long
`interval`, which is what this is. Under the old "a spell is what someone chooses" rule the fix
looked like converting it to a spell. It is not: it is fired from a bow, it logs `RANGE_DAMAGE`,
and it is an **attack**. What it needs is a `Cadence` driving it, which is plan item 8 and not a
rename.

**Ability and driver are two layers, and `Attack` welds them.** `WolfBite` is both _what
happens_ (4-7 damage, plant a Rend) and _when_ (every 3800ms, forever). A `Spell` carries only the
first. That weld — not the fact that it is an attack — is the reason Savage Bite cannot go on the
action bar, and it is why we had no word for the umbrella: with timing baked in, a spell and an
attack looked like different things. Unwelded, they share one execution path, so the endpoint is
one `Ability` class whose effects are child nodes and whose classifications are data:

```ts
FlashHeal   tags [spell, healing]         school holy      effects [Heal(100)]
SavageBite  tags [attack, melee]          school physical  effects [Damage(4, 7), ApplyAura(Rend)]
Fireball    tags [spell, attack, ranged]  school fire      effects [Damage(80)]
```

Two things have to arrive with it. `targets` — the target rule — becomes a field on `Ability`, for
the same reason `tags` and `school` do: it is a fact about what the ability is. The shared parts
of `SPELL_KEYS` and `ATTACK_KEYS` merge. An attack's current `interval` does not become an ability
cooldown: it moves to the cadence that drives it, while cooldown remains a restriction on the
ability itself.

**One target slot, doing two jobs.** `Character.currentTarget` holds both what the unit's
`Targeting` picked and what the player clicked, and a unit gets one of it. That is the whole reason
`WolfShaman` carries no attacks — it spends its single target on the ally it heals — and the reason
`Player.getTarget()` falls back to the tank while nothing else does.

The endpoint is that a target is **passed to a use**, not stored on a unit. Half the code already
works this way — `whyNotCast(caster, SpellClass, target)` takes it as an argument with the slot as
a mere default, and the Autopilot validates against an explicit target, then routes it through
`currentTarget` (`perform({type: 'cast', target})`) purely so `applyHeal()` can read it back out.
The slot is a round trip. What survives it is a **selected target** for the UI, one **preference**
per driver, and the rule on the ability.

The rule cannot move onto abilities until there is an `Ability` to hold it: putting it on `Spell`
and `Attack` separately — they share no base — would write it twice, which is the shape item 7 just
undid one layer down. So it waits for item 8.
