# Glossary

What the words mean here. Reach for this before naming a new class or field, and fold new terms in
rather than inventing synonyms: a second word for something that already has one is how two halves of
the codebase stop being able to read each other. Definitions only — the reasoning lives in
[combat.md](./combat.md) and [architecture.md](./architecture.md).

## The fight

**Unit** — anyone in a fight, player or otherwise. Both the class,
[`Unit`](../src/nodes/unit.ts), and the word for one in play. Prefer it in prose and in log messages.

**Unit id** — the registry key a unit is spawned from (`'Runt'`, `'Tank'`). Distinct from a
unit's `id`, unique per spawned instance. Anything keyed across a fight uses the instance `id`; names
change mid-fight when a duplicate is spawned.

**Stat** — one of the five primary numbers a unit brings: stamina, intellect, strength, agility and
spirit. Its resolved value is the unit's base plus modifiers owned by live auras. Stamina determines
maximum health, intellect maximum mana and spell power, strength attack power, and spirit mana
regeneration; agility has no derived effect until later dodge or crit work.

**Spell power** and **attack power** — derived output of the caster. Spell power is
`intellect × 2.5`; attack power is `strength × 2`. Physical abilities use attack power and every
other school uses spell power. There is one attack power for both melee and ranged abilities.

**Faction** — `'party'` or `'enemy'`. A static, so the registry can say which side a unit fights on
without spawning one.

**Room** — the plan for one fight: who fights, `{party: ['Tank'], enemies: ['Runt']}`, plus how
the scene is dressed. Every fight is built from a room, even a bare one outside any dungeon — the
sim's ad-hoc groups included. A request, never a record: who actually fought is the report's
`units`. Not "stage" or "phase" — those stay free for a boss that fights in several.

**Fight** — the live thing in the game tree: the party and the enemies built from a room, and the
clock they share. `FightResult` and `FightReport` are what came of one.

**Dungeon** — an ordered sequence of rooms played back to back. Described by data, never live in
the game tree; the game holds progress through one as a dungeon run.

**Spawn** — the one way a unit joins a fight. `Fight.spawn(unitId)` routes it to a side by the
class's own faction, so nothing picks the array itself.

**Alive** — health above zero. Not "in `fight.party`" — the dead stay in those arrays.

**Settle** — what an enemy at zero health does, in anything the player reads: the inflammation
breaks and the animal limps off. The code says `alive`, `kill` and `UNIT_DIED`; the narrator never
does. A boss settling earns a whole sentence — see [universe.md](./universe.md).

**Fall** — what a party member at zero health does, in anything the player reads. Down, not dead.
Same split: `alive`, `kill` and `wipe` stay in the code.

**Condition** — how hurt a unit is: `injured` below 35% health, `healthy` above 80%, `steady`
between. A pure function of the health bar with no memory, and separate from `alive` (a corpse reads
`injured`).

**Hurt** — time spent `injured`. Per unit in the fight report (`injuredTime`); in the sweep, `hurt%`
is the party's worst-off member as a share of the fight.

## Targeting

A unit gets a different word depending on the relationship being discussed. Never general synonyms
for "unit" — reach for them only when the relationship is the point: **player** the one at the
keyboard · **caster** whoever is casting · **attacker** whoever is swinging · **source** and
**target** the two ends of a hit · **ally** a unit of your own faction.

**Target** — who a use of an ability lands on. It belongs to that one use: the driver hands it to
`useAbility(id, target)`, validation and every effect see the same one, and no unit stores it.
Picking it is two separate questions, and they are two words:

**Targets** — which units an ability may land on at all: `enemy`, `ally`, `self`. A property of the
ability, because it never changes with who is using it or when. "Fireball targets an enemy."
`eligible(unit, targets)` answers it.

**Preference** — which of the eligible units to pick. A property of the _driver_ — the keyboard, a
`BotDriver` weighing the fight, or a standing rule like "always the most hurt" — never of the unit
or the ability. One object with two methods that have to agree: `prefers()` picks, `reconsiders()`
decides whether to look again once it has one — a preference for the most hurt ally that does not
re-pick heals someone already topped up. The six are `prefer.first`, `prefer.atRandom`,
`prefer.lowestHealth`, `prefer.tankFirst`, `prefer.healerFirst` and `prefer.threat`. A unit's
standing drivers share one through `Targeting`, which remembers one pick per `targets` value — so a
unit that both attacks and heals holds an enemy and an ally at once — and exposes the settled pick
read-only through `current()`.

**Threat** — one enemy's numerical attention toward each opposing unit. Actual damage earns threat
only from the enemy it landed on; effective healing earns less and is divided between every living
enemy that observed it. Overhealing earns none. Every party unit enters every enemy's table at zero,
and dead entries may remain because eligibility already keeps corpses out of targeting.

**Aggro** — being the unit an enemy currently attacks. Highest threat takes aggro, but a challenger
must exceed the current target by 10%, so two close scores do not trade it back and forth. The enemy
checks only when one of its cadences asks for another target, never every frame.

**Selected** and **intended target** — the player targets by hand. Selected is the unit they
clicked, `Player.selectedTarget` — UI state no other driver reads or writes, so clicking a frame
never moves anyone else's aim. Intended is who a keypress would land on: the selected target, or the
first living ally with tanks preferred while nothing is selected — `Player.intendedTarget`; the
unit frames tick it, the action bar greys itself out against it, `{type: 'use'}` falls back to it.
The hand-picked target is deliberately not a `Preference`: a human choosing is input, not policy.
Only its automatic fallback reuses `prefer.tankFirst`. Every other driver asks `Targeting.pick()`,
and in the sim a bot's preference stands in for the hand.

## Doing things

**Action** — a request to change the game, handed to `game.perform()`. May be refused. Not an event.
There is one for using an ability, `{type: 'use', ability}` — not one per kind, because casting is how
some abilities run and not a separate thing to ask for.

**Event** — a record of something that happened, in the combat log. Never refused, never a request.
Keep the two words apart. The `SPELL_*` event names are the one deliberate wart: they are WoW's
combat-log lingua franca, so swings and auras file under them too.

**Ability** — something a unit can use: what it requires and what it does, with no opinion about
when. One live use is a one-shot Task; a driver decides when to create it. A unit's own abilities
live on `unit.abilities`, keyed by ability id; the global registry is only the catalog. **Use** is
the verb for the whole category, and the combat log already files everything under it:
`Hit.abilityId` is set by spells, swings and auras alike.

**Spell** — a magical ability. **Attack** — an ability that strikes or otherwise directly harms a
target. Tags, not subclasses, and they may overlap: Patch is a spell, Savage Bite is an attack,
Fireball is both. Neither who triggered an ability nor whether it repeats decides its tags. Renew is
instant and still a spell; Nasty Arrow has a wind-up and is still an attack.

**Tag** — a classification an ability may share with any number of others: `spell`, `attack`,
`healing`, `melee`, `ranged`. Tags let rules and equipment ask what an ability counts as without
choosing its execution path.

**School** — the flavour of an ability's power or damage: `physical`, `holy`, `fire`, and so on.
Separate from tags: Fireball is a spell and an attack of the fire school; Savage Bite is an attack of
the physical school. School selects power too: physical takes attack power, everything else spell
power.

**Effect** — one thing an ability does when it lands: heal, damage, apply an aura, or interrupt. An
ability may have several, so it is a list rather than a field. Not the thing left sitting on the unit
afterwards — that is an aura.

**Coefficient** — the fraction of its caster's power one effect claims. Authored on the effect,
because the effect is the thing with a size: `new ApplyAura(RenewAura, 1.2)` is 120% of spell power,
and Savage Bite sizes its bite and its bleed separately. Always positive — which way an outcome goes
is what kind of effect it is, never the sign of how big it is.

**Landing** — one ability arriving on one target, with the caster's side already worked out: the
power, read once when the use was constructed, and whatever scales the whole use, like a sweet-spot
hit. Effects resolve against it, so nothing about an outcome is mutable state on the use.

**Magnitude** — how big one outcome landed, in hit points: healing for a `Heal` effect, damage before
variance, the pool for a barrier, the whole of a periodic aura. Resolved from `power × coefficient`
at the moment it lands; never an authored synonym for coefficient and never "heal amount" — the same
number sizes Shield, which heals nobody.

**Cast** — a spell in progress. **Cast time** is how long it takes; **GCD** (global cooldown) is the
shared pause every cast starts, running alongside the cast rather than after it, which is why a cast
costs the longer of the two and not the sum; **cooldown** is one ability's own wait. A unit **casts**
a spell and **swings** an attack; it **uses** either.

**Interrupt** — cutting a cast short before it lands. Costs the caster the time, never the mana: only
a completed cast is charged for. The player interrupts themselves with `{type: 'interrupt'}`; the
`Interrupt` effect is how an enemy does it, and Roha's `Toll` carries the only one today. It reaches
every unit on the side it landed on, because what interrupts there is a sound.

**Id** and **name** — every ability and aura has both. The **id** is what everything files it under:
registry, a unit's abilities, balance, `--tune`, the log's `abilityId`, cooldowns, stack keys. The
**name** is what a player reads and is used for nothing else. Conventionally the id is the class name
(`SavageBite`) and the name the same words as prose (`Savage Bite`). Name the class after the ability,
not after who owns it or how big it is: `Nip`, never `SmallAttack`. Renaming an ability should
touch one line. Mechanic bases keep neutral identities (`Periodic`, `Barrier`), while an
ability-owned subclass such as `RenewAura` takes its spell's id, so a cast and the aura it leaves
behind report as one ability.

**Busy** — time a unit was committed to a cast or its GCD, and so unable to act. Logged per cast as
`busyFor` so the report never has to know how long a GCD lasts.

**Aura** — something that sits on a unit for a while: a source, a lifetime, and a place in the unit's
`auras` set until it expires. What an apply-aura effect leaves behind. Helpful or harmful is only
prose — a buff or a debuff; nothing in the code branches on which.
`SPELL_AURA_APPLIED` / `REFRESH` / `REMOVED` is how one reaches the combat log.

**Barrier** — an aura with a finite pool that absorbs later damage before it reaches the health bar.
`Shield` is the ability that applies the only barrier today; absorb is what the barrier does.

**Periodic aura** — an aura that lands an instalment on a cadence. Heal-over-time and
damage-over-time are one class, and a negative `total` is the whole of what makes it a DoT.

**Total** — what an aura lands over its whole life, not per tick. **Stacks** — how many copies of one
aura a unit carries; `maxStacks` caps it.

**Hit** — one change to a health bar, applied through `applyHit()`. **Overheal** is the part of a
heal that landed on a full bar and did nothing.

**Resource** — a pool with a max and a current: `Health`, `Mana`. **Ratio** is how full, 0 to 1.
**Five-second rule** — mana only regenerates after five seconds without spending any, so a lull is
worth something.

## Timing

**Driver** — what decides when an ability is used: the keyboard, a `BotDriver` running a bot, or a
`Cadence` ticking on an interval. Using is shared through `AbilityUse`; only deciding differs.

**Cadence** — the driver that uses an ability at a fixed interval, and the whole of what the
`Cadence` class does: no casting logic, only _when_. Say "a boss ability on a 12s cadence".
Repetition belongs to the cadence and never to the ability. `shouldUse()` is where a unit with real
decisions puts them; by default the schedule is the whole decision. Not a "caster" — that is the role
word for whoever is casting.

Everything in the game is a vroum `Task`, and four fields say when it runs. They mean the same thing
everywhere, so read them before inventing a timing word:

**`delay`** how long before the first tick — an ability's wind-up, a cadence's opening wait, an
aura's wait before its first instalment · **`interval`** the gap _between_ cycles, never before the
first · **`duration`** how long one cycle lasts · **`repeat`** how many cycles (`1` is one-shot,
`Infinity` is standing).

A task lives `delay + repeat × (duration + interval)`. Everything in the game leaves `duration` at 0,
so a cycle is a single tick and `repeat` counts ticks — a habit, not the rule.

One use of an ability is one-shot. Repetition belongs to its driver; an aura may repeat because its
persistence is the behavior the Task represents.

## Tuning and measuring

**Balance number** — a number the game plays by, reachable from the Balance Lab, the dev console and
`--tune`. Six **kinds**: `ability`, `effect`, `cadence`, `aura`, `unit`, `rule`. The kind is the
namespace: `ability:Renew.cost` is the cast and `aura:Renew.maxStacks` the heal-over-time it plants;
an effect row names the ability and the outcome, `effect:SavageBite.rend.coefficient`, so a composite
ability's parts tune separately; `unit` rows are keyed by the unit id you spawn with.

**Rule** — a balance number the whole game reads rather than one belonging to an ability or a unit,
such as where the injured line sits. Read live where it is used, so a retune lands on the fight
already running rather than on the next cast.

**Tune** — changing one balance number: `kind:Name.key=value`, e.g. `rule:Condition.injured=30`.

**Statics are the template, instance fields are the state.** A class declares its dials;
construction copies them and reads the caster's current power into the use's landing. So a retune or
stat buff reaches the next use, never the one already in flight; cadence timing reaches the next
driver spawned, never a schedule already running — and patching a prototype does nothing. An
effect's coefficient is template data too, shared by every use, which is what makes retuning it
reach the next use and nothing in flight.

**Bot** — a stand-in for the player, deciding what to cast next: `idle`, `triage`, `renew`, `panic`,
`shield`, `smite`. Which ability, never which target — that is a **preference**. Bots are also the
measuring instrument: every win rate a sweep prints is really "with this bot playing", which is why
they never read the game's own thresholds. `BotDriver` is only the Task that runs one, so a fight can
go with nobody at the keyboard — the bot decides, the driver casts, through the same `perform()` the
keyboard does.

**Idle** — the bot that casts nothing, and so the **control group**: what happens to this fight
without a healer at all.

**Trial** — a room plus how to run it without a browser: a bot, a seed, a duration.
`runFight(trial)` returns a `FightResult`; `analyze()` turns one into a `FightReport`. You play a
room; you run a trial of one — 200 seeds is 200 trials of the same room.

**Outcome** — how a fight ended: `victory` (every enemy dead, even if the healer died on the way),
`defeat`, or `timeout`.

**Report** — what `analyze()` makes of a combat log: per-unit and per-ability totals, deaths, health
over time. Pure, so the terminal and the in-game panel agree by construction.

**Seed** — the number that makes a fight reproducible: same seed, same fight. Not a word for the run
itself — that is a trial. **Sweep** — every enemy group against every bot over many seeds.

## In the UI

**AppChrome** — the app shell. `.AppChrome` wraps `.AppChrome-menu` and `.AppChrome-game`, and the
intro fades it in.

**Plate** — the bevel, the drop shadow and the white-on-black text that an ability icon and an aura
icon share, plus `Plate-image` filling it. Composed onto both. Deliberately holds no size and no
border colours: those are what tell the two apart, so putting either here means one of them spends
declarations undoing the other's.

**AbilityIcon** and **AuraIcon** — the two wearers of Plate: the square action-bar button and the
wide chip on a unit frame. Neither wears it alone, and an aura icon is not an ability icon — nothing
shared between them belongs under either name.

**UnitFrame** — one unit's widget: avatar, health and mana bars, cast bar and aura icons. The
component; its element classes are `.Unit`, `.PartyMember`, `.Enemy`.
