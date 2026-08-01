# How a fight works

Why the combat systems are shaped the way they are — mostly the traps, each of which has cost someone
an afternoon. [glossary.md](./glossary.md) says what the words mean;
[architecture.md](./architecture.md) is the map of the codebase. What each dungeon is supposed to
teach — one pressure apiece, a growing party, one ability per dungeon — is "The journey" in
[universe.md](./universe.md).

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
lifecycle to add an effect, and an effect reads its numbers off the ability as it lands, so tuning
still reaches it. Effects are plain objects, not nodes: a vroum child cannot run in the frame it is
constructed, and nothing instantaneous needs a lifecycle.

What is _not_ shared is who decides. The player has a keyboard and a `BotDriver` weighing the fight;
a fixed schedule has a `Cadence`. A unit that needs real decisions overrides `Cadence.shouldUse()`
rather than growing a bot system.

## A target belongs to one use, not to a unit

Whoever decided to act also decided who it lands on, and hands both to `useAbility(id, target)`.
Validation and every effect then see the same unit, and a cast holds the target it started with:
`Ability.target` is `readonly`, so nothing can be swapped under one.

What a cast cannot hold still is the world around it, and `Ability.land()` re-checks eligibility for
exactly two reasons. The target can die. It can also be **removed** from the fight, and removal is not
death — `Fight.remove()` splices the unit out but leaves its health bar full, so `alive` still
reads true. A guard that only asked `alive` healed a unit that was no longer in the fight and mounted
auras on a node vroum had already detached, which threw inside a microtask where nothing could catch
it.

Who is eligible comes from the ability (`targets`); which of them comes from the driver. The
keyboard's preference is `Player.intendedTarget` — the frame the player selected, falling back to the
tank; the `BotDriver`'s is whatever its bot weighed; a `Cadence` asks its unit's `Targeting.pick(targets)`,
which is a preference and a memory per targets value and nothing else. A unit with no `Targeting` has no
way to choose, so its Cadence says so rather than beating in silence. The selected enemy's frame may
read that memory through `Targeting.current(rule)` to show target-of-target, but it cannot choose or
change one.

A unit used to hold one `currentTarget` that every ability read back, so `Denmother` could not both
bite and mend — the two drivers would have overwritten each other's aim. Now nothing stores a target
on a unit, so it can carry both. Selecting a frame is player UI state and moves nobody else's aim: a
`BotDriver` healing the tank no longer drags the player's selection with it.

Enemy casts are drawn on the caster's own unit frame; the player's has its own `CastingInfo` panel. A
cast nobody can see warns nobody.

## Threat is local to each enemy

Every enemy owns a `Map<Unit, number>` whose party entries begin at zero. Actual damage adds threat
only to the enemy it landed on. Effective healing adds half as much, divided between every living
enemy observing it; overhealing moves no health and adds none. Both are credited from `applyHit()`,
after barriers and health-bar clamping have determined what actually landed, so direct and periodic
effects cannot disagree.

An ability's `threatMultiplier` rides with its hit, including into an aura it plants. Shield Bash uses
a high multiplier; it still earns attention only from the enemy it struck. Holding a pack therefore
needs the tank to work across that pack or gain a multi-target threat ability later — the core
mechanic does not pretend one target was three.

`prefer.threat(enemy)` picks the highest entry. It keeps the current target until a challenger exceeds
it by 10%, and `Targeting.pick()` is still called by a Cadence only when that enemy acts. Dead and
removed units need no threat cleanup because `eligible()` has already removed them from the
candidates. A later taunt can write directly into one enemy's table without changing targeting. A
second argument, `prefer.threat(enemy, 0.2)`, is mischief: those odds per pick of biting someone at
random instead — one wander, then threat pulls it home. The wolf runs on it; a disciplined unit passes
nothing.

## Every health change goes through one place

**Every change to a health bar goes through `applyHit()`** in [`hit.ts`](../src/nodes/hit.ts), which
applies it, floats the number, records the event and announces the death. The `Damage` and `Heal`
effects and `PeriodicAura` are its only callers, and do nothing else about it. Getting logged is not
left to the caller.

That is also why `PeriodicAura` is one class for both heals and damage over time: once the health
change moved into `applyHit`, the only thing left that differed was which way the instalments went,
and that is the aura's own `harms`. An `ApplyAura` effect plants an aura and sizes it, handing over
what its coefficient resolved to along with the ability's school, ready for physical mitigation before
barriers.

`maxStacks` defaults to 1, so recasting replaces what is there — raise it only for an aura that is
_meant_ to stack, because unbounded is not a design. Copies are counted per caster, so two healers
never overwrite each other; the rules and what they are for are on the `Aura` class itself.

`interval` is both the default wait before the first tick and the gap between later ticks. The default
is derived from the aura's subclass interval, so a periodic effect waits one full tick even when it
overrides that interval. An intentionally immediate effect must opt in with `static delay = 0`;
explicit zero matters because reapplying such an aura buys another immediate instalment.

## Condition: how hurt someone is

`Unit.condition` is a pure function of `health.ratio` with no memory — no hysteresis, no latch. That
is what keeps it safe to ask anywhere, and what would break if a threshold `--tune` can move mid-fight
were compared against a latched state. No ability reads it yet; the fight report does.

Its thresholds are balance numbers of kind `rule`, read live where they are used rather than copied
onto an instance at construction — so `rule:Condition.injured=30` lands on the fight already in
progress. Damage variance is another live rule; `gcd` and the five-second rule belong here too, one
day.

Crossing a line logs `UNIT_CONDITION` from `applyHit`, for the same reason `UNIT_DIED` is: the
analyzer could replay the health bar, but not what counts as injured, and one holding the old number
would be confidently wrong. From `Health.set()` it would land before its own cause and carry no
source. The known gap runs the other way — the Balance Lab writes a health bar directly, so setting
health or `max` changes a condition silently.

The bots use their own ratios (0.4, 0.7, 0.9) and deliberately do **not** read these bands. They are
the measuring instrument every sweep quotes against, so unifying the numbers would move every win rate
already recorded and make the sweep circular.

## Danger is burst, not dps

Sustained damage cannot kill anyone a healer is watching: Heal repays 80 hp every 2s, so any enemy
below ~40 dps only slows the fight, at _any_ stat value — measured up to 10× the wolf pup's
strength, the sim's death rate stayed at zero. Turning sustained numbers up produces mana-starved
timeouts before it ever produces deaths, which is a worse fight than an easy one. Watch `timeout%`
next to `win%` when tuning.

What kills is a hit bigger than the heal window, and it must be telegraphed to be fair: give the
ability a `castTime` and the enemy's unit frame shows the wind-up (Pounce). So an enemy's threat
level lives in its burst abilities, its lifespan in its stamina — and in a tankless room stamina is
really a mana tax on the player, which is what decides how forgiving the room is.

## Stats: what a unit brings

A live `Stats` resolves each base stat plus the modifiers owned by auras on that unit. Modifiers are
keyed by their owner rather than undone with subtraction, so one expiring aura removes exactly its own
contribution even when copies stack or one supersedes another.

Stamina is maximum health, intellect grants 15 maximum mana and 2.5 spell power each, strength grants
2 attack power, and spirit is mana regenerated per second. The resource pools keep their current
amount when their maximum rises and clamp only when it falls. Agility deliberately has no derived
effect yet; dodge and crit are later slices.

A unit's tunable numbers are its base stats; resolved modifiers belong to the live unit and never
rewrite its template.
