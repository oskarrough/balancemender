# Glossary

What the words mean here. Reach for this before naming a new class or field: a second word for
something that already has one is how two halves of the codebase stop being able to read each
other. Fold new terms in rather than inventing synonyms.

This is the vocabulary we want, so a few of these words name things the code has not grown yet.
Definitions only — the reasoning lives in [architecture.md](./architecture.md).

## The fight

**Unit** — anyone in a fight, player or otherwise. Both the class,
[`Unit`](../src/nodes/unit.ts), and the word for one in play. Prefer it in prose and in log
messages.

**Unit id** — the registry key a unit is spawned from (`'TinyWolf'`, `'Tank'`). Distinct from a
unit's `id`, which is unique per spawned instance. Anything keyed across a fight uses the
instance `id`; names change mid-fight when a duplicate is spawned.

**Character** — a named unit. Someone rather than something: a proper noun, a hand-tuned kit, and
unique in a fight. `Nakroth the Destroyer` is the only one today; `Diablo` and `Mephisto` are the
shape of the rest. A wolf is a unit and never a character — you can spawn three and they are
interchangeable, which is why `renumber()` gives you "Tiny wolf 1" and "Tiny wolf 2". A character
should never be renumbered, and nothing in the code knows the difference. Every character is a
unit; almost no unit is a character.

**Faction** — `'party'` or `'enemy'`. A static, so the registry can say which side a unit fights
on without spawning one.

**Encounter** — the live thing in the game tree holding a party and a set of enemies. **Roster** is
the description it is built from, `{party: ['Tank'], enemies: ['TinyWolf']}` — a request, never a
record. Who actually fought is the report's `units`.

**Fight** — one run of an encounter, and the sim layer's word: `FightSpec` is the roster plus how
to run it (a policy, a seed, a duration), and `FightResult` and `FightReport` are what came of one.
Say "encounter" for the thing in the tree and "fight" for a run of it. Never "fight" for the object
itself, however natural it reads.

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

**Target** — who a use of an ability lands on. An argument, not a possession: it is passed to a
use, never stored on the unit. Picking one is two separate questions, and they are two words:

**Target rule** — which units an ability may land on at all: `enemy`, `ally`, `self`. A property
of the ability, because it never changes with who is using it or when. `TargetRule` is the type and
`eligible(unit, rule)` answers it.

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
request. Keep the two words apart. The `SPELL_*` event names are the one exception to everything
here: renaming them would break every log already recorded, so they stay, and WoW lives with the
same wart.

**Ability** — something a unit can use: what it requires and what it does, with no opinion about
when. One live use is a one-shot Task; a driver decides when to create it. **Use** is the verb
covering the whole category, and the combat log already files everything under it — `Hit.abilityId`
is set by spells, swings and auras alike.

**Spell** — a magical ability. **Attack** — an ability that strikes or otherwise directly harms
a target. They are tags, not subclasses, and may overlap: Flash Heal is a spell, Savage Bite is
an attack, and Fireball is both. Neither who triggered an ability nor whether it repeats decides
its tags. Renew is instant and still a spell; Nasty arrow has a wind-up and is still an attack.

**Tag** — a classification an ability may share with any number of others: `spell`, `attack`,
`healing`, `melee`, `ranged`. Tags let rules and equipment ask what an ability counts as without
choosing its execution path.

**School** — the flavour of an ability's power or damage: `physical`, `holy`, `fire`, and so on.
Orthogonal to tags: Fireball can be a spell and an attack of the fire school; Savage Bite is an
attack of the physical school.

**Effect** — one thing an ability does when it lands: heal, damage, or apply an aura. An ability
may have several, so it is a list rather than a field. Not the thing left sitting on the unit
afterwards — that is an aura.

**Cast** — a spell in progress. **Cast time** is how long it takes; **GCD** (global cooldown) is
the shared pause every cast starts, running alongside the cast rather than after it, which is why
a cast costs the longer of the two and not the sum; **cooldown** is one ability's own wait. A unit
**casts** a spell and **swings** an attack; it **uses** either.

**Id** and **name** — every ability and aura has both. The **id** is what everything files it
under: registry, a unit's ability collection, balance, `--tune`, the log's `abilityId`, cooldowns,
stack keys. The
**name** is what a player reads and is used for nothing else. Conventionally the id is the class
name (`FlashHeal`), the name is prose (`Flash Heal`). Renaming an ability should touch one line.

**Ability collection** — what one unit may use, keyed by stable ability id. Every driver looks up
through this collection; the global ability registry is only the catalog. The player's contains
healing spells, a wolf's contains its attacks, and the shaman's contains Mend.

**Busy** — time a unit was committed to a cast or its GCD, and so unable to act. Logged per cast
as `busyFor` so the report never has to know how long a GCD lasts.

**Driver** — what decides when an ability is used: the keyboard, an `Autopilot` policy, or a
`Cadence` ticking on an interval. Using is shared through `AbilityUse`; mana, cast time, GCD and
cooldown restrictions apply only when the ability opts into them. Only deciding differs.

**Cadence** — the driver that uses an ability at a fixed interval, and the whole of what the
`Cadence` class does: it holds no casting logic, only _when_. Say "a boss ability on a 12s
cadence". Repetition belongs to the cadence and never to the ability. Not a "caster" — that is the
role word for whoever is casting, and every unit that casts is one.

**Aura** — something that sits on a unit for a while: it has a source, a lifetime, and it lives in
the unit's `auras` set until it expires. What an apply-aura effect leaves behind. **Buff** and
**debuff** are the same thing by polarity, helpful or harmful — prose words, because nothing in
the code branches on which. `SPELL_AURA_APPLIED` / `REFRESH` / `REMOVED` is how one reaches the
combat log.

**Periodic aura** — an aura that lands an instalment on a cadence. Heal-over-time and
damage-over-time are one class, and a negative `total` is the whole of what makes it a DoT.

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
an aura's wait before its first instalment · **`interval`** the gap _between_ cycles, never before
the first · **`duration`** how long one cycle lasts · **`repeat`** how many cycles (`1` is
one-shot, `Infinity` is standing).

A task lives `delay + repeat × (duration + interval)`. Everything in the game leaves `duration` at
0, so a cycle is a single tick and `repeat` counts ticks — but that is a habit, not the rule.

One use of an ability is one-shot. Repetition belongs to its driver; an aura may repeat because
its persistence is the behavior the Task represents.

## Tuning and measuring

**Balance number** — a number the game plays by, reachable from the Balance Lab, the dev console
and `--tune`. Five **kinds**: `ability`, `cadence`, `aura`, `unit`, `rule`.

**Rule** — a balance number the whole game reads rather than one belonging to a spell or a unit,
such as where the injured line sits. Read live where it is used, so a retune lands on the fight
already running rather than on the next cast.

**Tune** — changing one balance number: `kind:Name.key=value`, e.g. `rule:Condition.injured=30`.

**Statics are the template, instance fields are the state.** A class declares `static heal`;
`applyStatics()` copies it onto the instance at construction. So a retune reaches the next cast or
blow, never the one already in flight; cadence timing reaches the next driver spawned, never a
schedule already running — and patching a prototype does nothing.

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

Each is a word to reach past, not a word that means nothing.

**Actor** — never for a unit. What a fight did to each one is `UnitStats`, in `report.units`. One
unrelated use stays: `hit.ts` bundles the two ends of a hit as `actors` before spreading them into
a log event, which is log fields and not units.

**Character** — never for a unit _in general_: it means a named unit specifically (above), and
using it for a wolf throws that distinction away. No class claims the word, which is the point — it
is held open for the thing `Nakroth` is.

**Combatant, entity, mob, creature, fighter** — all mean unit. Say unit.

**Effect** — never for the thing sitting on a unit. That is an **aura**. Here `effect` means
exactly one thing: what an ability does when it lands.

**Skill** — never for an ability. `skill` is the progression word (#15, #31), kept free for it.
