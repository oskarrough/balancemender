Tactical Healing Game – Technical Specification
Project Overview

A web-based tactical healing game inspired by MMO healer roles (e.g., World of Warcraft). The player, as a healer, must keep an AI-controlled party alive through increasingly difficult boss encounters. Gameplay extends beyond pure healing to include buffing allies, debuffing enemies, and dealing indirect damage, adding strategic depth to each fight.
Core features include a timing-based spellcasting system with a "sweet spot" critical success mechanic, careful mana/resource management, and progression through multi-encounter dungeons with item loot drops.

Core Game Systems

Spell Casting System

Basic Mechanics: Spells are categorized by their role – healing (direct heals or heal-over-time), protective shielding, buffing (ally enhancements), or indirect damage (offensive spells).
Cast times vary by spell (some are instant, others require channeling) and all spells respect a global cooldown (GCD) after casting.
Mana is the primary resource for casting spells, and many spells also have individual cooldowns to limit their frequency

Timing-Based "Sweet Spot" Mechanic:
Certain spells feature a timing mini-game to maximize their effect.
A horizontal timing bar is displayed with a moving indicator ("pill") and a marked sweet spot zone (~10% of the bar).
The player must activate/release the spell at the moment the indicator is within the sweet spot. Hitting this zone grants enhanced spell effectiveness (e.g., extra healing or damage).
Character stats can influence this mechanic – for example, a high Mastery stat makes sweet spot bonuses more potent or easier to achieve.
Different spell types might have unique sweet spot behaviors (e.g. varying sweet spot sizes or speeds) to diversify the challenge

Spell Properties: Each spell is defined by properties such as cost (mana cost), castTime (casting duration in milliseconds; 0 for instant), cooldown (time before the spell can be reused), and effect (the outcome of the spell – healing amount, damage dealt, buff details, etc.). These properties drive the spell's behavior in the game logic. (Internally, spell effects are executed via the game's task system on each tick of the game loop to handle timing and durations.)

Spell Casting Flow: To cast a spell, the player selects a target and then activates the desired spell:
Target Selection – The healer chooses an ally (or enemy for damage spells) via the party frame UI as the spell's target.
Spell Activation – The player selects a spell from the action bar (or presses its hotkey) to begin casting. If the spell has a cast time, a cast bar appears showing progress.
Sweet Spot Timing – If the spell uses the sweet spot mechanic, the timing bar is displayed during the cast. The player attempts to hit the sweet spot zone before the cast completes.
Effect Resolution – Once casting finishes (or immediately for instant spells), the spell's effects are applied to the target. The target's health is adjusted (healing or damage), buffs/debuffs are applied, etc. The caster's mana is deducted and the spell enters its cooldown period.

Targeting System

    Primary method of targeting is via party frames representing each party member's status.
    The player typically selects a target first, then casts a spell which will automatically apply to that selected target.
    Only one target can be actively selected by the player at a time (usually the tank or a party member in most need of healing). Healing and buff spells require an ally target, while damage spells require an enemy target.
    Future targeting improvements may include tab targeting (cycling through enemies) and area-of-effect targeting for spells that affect multiple characters.
    Certain spells could implement contextual targeting logic. For example, a "smart heal" might automatically find the party member with the lowest health if no specific target is chosen.

Character Stats

    Core Stats: The healer character (and possibly allies) have RPG-style attributes that influence gameplay:
        Haste – Affects casting speed and reduces the global cooldown duration.
        Spell Power – Increases the potency of spells (more healing done or damage dealt).
        Intellect – Increases the maximum mana pool, allowing more spells to be cast.
        Spirit – Improves mana regeneration rate over time (out of combat or during longer fights).
        Critical Strike – Grants a chance for spells to have an enhanced effect (e.g., double healing output).
        Mastery – Enhances the benefits of the sweet spot mechanic and other class-specialty bonuses.
    These stats grow with the character's progression (level-ups and gear) and directly affect combat efficiency. For instance, high Haste allows faster heals, and high Spirit ensures mana longevity.

Combat System

    Party Composition: The game assumes a party with one player healer and 2–3 AI teammates.
    Typically this includes one Tank (a durable character who absorbs boss aggression) and one or two DPS (damage-dealers). The healer must primarily keep the tank alive, as the tank soaks most damage.
    Boss Mechanics: Each boss encounter features unique attack patterns and challenges for the healer.
    Some bosses deal heavy, infrequent hits that require large heal bursts, while others apply constant chip damage that tests sustained healing. Bosses may introduce unpredictable timing variations to keep the player on their toes, and some have damage ramp-up phases where incoming damage intensifies over time.
    They can also inflict status effects like stuns, debuffs, or healing reductions on players, adding urgency for the healer to respond.
    Environmental hazards or positional requirements might be involved (e.g., avoid standing in fire), and bosses often telegraph powerful special attacks that the healer must prepare for or counter specifically (such as a big attack that requires pre-shielding the tank)
    Failure State: If the tank dies, the encounter is usually lost (game over).
    Bosses will then quickly overwhelm the healer or other party members if the tank isn't alive to hold aggro. The game may allow limited recovery options – for example, a battle resurrection spell or item might revive a fallen ally once per fight, providing a chance to recover from a mistake.
    However, these are limited to maintain the challenge.

Progression System

    Gear Progression: Defeating bosses yields loot drops to improve the healer's capabilities.
    Each boss has a predefined loot table of possible drops.
    Items come in varying rarities, with some rare drops (~2% drop chance) being particularly powerful or desirable.
    Equipping better gear increases character stats; additionally, certain items belong to sets that grant bonus effects when multiple pieces of the set are worn together
    Character Progression: The healer gains experience points (XP) by defeating encounters, eventually leveling up.
    Leveling up grants stat points that can be allocated to increase core stats, improving the healer's effectiveness.
    (A talent or specialization system is envisioned for the future, which would allow customization of playstyle, but in the initial implementation this may not be present.)

Dungeon Structure

    The game's content is organized into dungeons composed of multiple encounters. Progression through a dungeon is node-based.
    Each dungeon level contains 3–4 encounter nodes, and a dungeon consists of ~3 levels (for about 9–12 encounters total)
    Each node represents a boss fight or a special event. Players move linearly from node to node within a level, but there may be branching paths or optional encounters between levels.
    This provides some choice in the order of encounters or optional bosses.
    In the prototype, dungeons will be relatively small (e.g., 2–3 boss encounters in total for testing purposes), but future dungeons can be larger and more complex.

User Interface

Combat UI

    Action Bar – Displays spell icons with associated hotkeys, allowing the player to click or press keys to cast spells
    Cast Bar – Shows the progress of the current spell being cast (filling up over the spell's cast time)
    Sweet Spot Bar – A special timing bar that appears for spells using the sweet spot mechanic, indicating when to stop the cast for a bonus
    Party Frames – UI elements showing each party member's health (and possibly mana or other resources), used for selecting targets and monitoring teammate status
    Health/Mana Indicators – Prominent displays of the player's current mana pool and possibly the boss's health, to keep track of resource and boss status
    Buff/Debuff Icons – Visual indicators near character frames showing active buffs (positive effects) or debuffs (negative effects) on that character
    Floating Combat Text – Numbers and text that appear over characters to indicate healing done, damage taken, critical hits, etc., providing immediate feedback during combat
    Boss UI and Alerts – The boss's health bar and cast bar are displayed, along with timers or warning indicators for upcoming boss abilities.
    This helps the player anticipate heavy damage or special mechanics.
    Minimap/Dungeon Map – A small map indicating the player's progress through the dungeon nodes.
    It shows the current encounter location and possible paths.

Development Tools

    Slash Command Console – A text-based console allowing special developer commands (e.g., "/spawn Boss2") to be entered.
    This helps in testing by jumping to certain encounters or altering game state.
    Cheat Commands – Commands for modifying stats, healing or damaging characters, spawning or despawning entities, etc., to facilitate rapid iteration
    Playground Mode – A mode where the player can practice spell mechanics without pressure.
    For instance, the healer can cast spells on dummy targets to test timing or effects.
    Live Parameter Tuning – Tools to adjust game parameters on the fly (cooldown durations, boss damage output, etc.) to quickly balance the game.
    Changes can be made in real-time to see their effect immediately.
    These development features are built in to speed up testing and balance tuning, making the game easier to refine.

Technical Implementation
Architecture

    Engine & Framework: The game is built on a node-based architecture provided by the Vroum library.
    Vroum supplies foundational constructs for the game loop and timed events:
        Loop – The main game loop that uses requestAnimationFrame to update game state at each frame. It drives all timed processes (cooldowns, animations, etc.) in sync with the browser's refresh rate.
        Node – The base class for all game entities (players, enemies, UI components, etc.). Nodes can contain child nodes, enabling a hierarchical scene graph of game objects. Nodes also handle event dispatch/subscription, so different parts of the game can communicate in a decoupled way.
        Task – A scheduling construct for timing-based operations. Tasks can be one-time or repeating; they support delays, durations, intervals, and repeats to easily implement cooldown timers, periodic effects, or delayed actions. The game loop processes these tasks (e.g., decrementing timers, triggering effects when time is up).

    Design Patterns:
        Static vs Instance Properties: Game entities (spells, bosses, effects) use a consistent pattern:
            - Static properties define the "template" (e.g., a spell's base cost, name, cast time)
            - Instance properties hold runtime state (current cast progress, active effects)
            - Constructors copy static properties to new instances
        This pattern makes it easy to define new entity types while properly managing their runtime state.

    Event-Driven Design: The architecture is largely event-driven.
    For example, when a character's health changes, the Health component (see below) emits an event that UI components listen for to update the health bar.
    This decoupling means gameplay logic and UI remain separate and easier to manage. A central event dispatcher or message bus coordinates these events (the "central dispatcher" for state management)
    State Management: Game state updates (like applying a heal or a boss attack) are handled in a controlled manner. A command parser interprets player input (e.g. key presses or commands) into game actions, which are then dispatched as events or function calls.
    State changes are implemented as much as possible with pure functions (given the same input state and action, they produce the same output state).
    This makes behavior predictable and easier to test.

Character & Entity Systems

    Character Objects: All characters in the game (player healer, tank, DPS allies, bosses) are represented as objects that extend the base Node class.
    This means characters can have child nodes/components and can send/receive events like any Node.
    Health Component: Each character Node has an associated Health component that manages its hit points.
    This component provides methods to apply healing or damage to the character, automatically clamping between 0 and the max HP. Whenever health changes, the Health component emits events (e.g., "healthChanged") so that other systems (UI, AI scripts) can respond.
    For instance, the party frame listens to update the health bar, and a boss AI might listen to its own health to trigger phase changes at certain thresholds.
    Stats and Attributes: Characters have a set of stats (Haste, Intellect, etc. as described above) that are stored in the character object. These stats influence calculations in spells and combat (for example, healing amount = base heal * (1 + SpellPower)).
    Effects System: Characters maintain a list of active Effects currently on them, such as buffs (positive effects) or debuffs/Damage-over-Time effects (negative effects). Under the hood, an Effect is typically a specialized Task attached to the character, defining a timed influence on that character.
    For example, a HealOverTime effect might heal the character every few seconds for a duration

    , or a Shield effect might absorb incoming damage until it expires.
    Effects are applied by spells or boss abilities and are removed when their duration ends or they are dispelled. The effect system uses the Task scheduler to handle periodic ticks (e.g., a HoT ticking every 1 second) and expiration.

Spell Implementation

    Spell Objects: Spells are implemented using the task and node system to handle casting delays and effect application.
    When a spell is cast, it may create one or more Task instances: one for the cast time (if any) and others for the actual effects. Instant spells (like a quick heal) simply skip the cast delay task and go straight to effect. Channeled or cast-time spells schedule a Task for the cast duration, which upon completion triggers the effect Tasks.
    Mana Cost & Cooldowns: Each spell deducts its mana cost from the caster when cast and starts its cooldown timer. The cooldown is tracked either via a Task or timestamp comparison before the spell can be used again. The global cooldown (GCD) is a short (e.g. 1.5s) shared cooldown Task that triggers on any spell cast to prevent immediate recasting.
    Spell Effects & Tasks: The outcome of a spell is achieved by spawning effect tasks on targets. A direct heal spell will invoke a heal effect on the target's Health component immediately.
    A Heal-over-Time spell (HoT) like Renew applies a HealOverTime effect task to the target that ticks healing periodically.
    Damage spells create damage effect tasks (instant or damage-over-time). Buff spells attach a Buff effect to the target, modifying their stats for a duration.
    Shield spells apply a Shield effect that absorbs damage. All such effects are instances of the Effect system described above, utilizing the Task scheduler for timing.
    Example Spells: The initial spell set for the healer focuses on a mix of healing and support abilities:
        Heal – A standard, efficient heal with a moderate cast time (basic single-target heal spell).
        Flash Heal – A fast but mana-costly heal for emergencies (short cast time, higher mana per amount healed).
        Renew – A heal-over-time spell that continuously heals the target over several seconds (applied as a periodic effect).
        Shield – A protective shield that absorbs damage instead of healing (applies a damage absorption effect on the target).
        Smite – A minor offensive spell that deals damage to the enemy (allows the healer to contribute some DPS when healing is light).
        Power Infusion – A buff spell that temporarily increases a party member's casting speed or power (enhances stats for a short duration).

Rendering

    The prototype uses a DOM-based approach for rendering the game interface.
    All UI elements (health bars, action bars, etc.) are HTML/CSS, updated via the game's state changes and events. This makes it easy to build and modify UI with standard web technologies.
    While DOM rendering is sufficient for the initial version, the design anticipates possibly moving to a canvas or WebGL-based rendering for more advanced visuals and animations in the future

    We use uhtml for creating and rendering DOM nodes (render + html).

This would allow richer graphical effects (spell animations, boss telegraphs, etc.) once the core gameplay is solid.
The UI is designed to be responsive, so it can adapt to different screen sizes or window layouts without breaking.
This is important for a web-based game to support various devices.

Data Persistence

    Game state persistence is handled via local storage in the browser.
    For example, a player's character profile (stats, gear) and progression in a dungeon can be saved so that the game can be resumed later.
    The prototype will support save/load functionality – allowing the player to take a break mid-dungeon and continue where they left off.
    Key data like current dungeon node, party health, and cooldowns will be stored.
    Multiple character profiles could be stored, enabling players to experiment with different stat builds or start new playthroughs without losing progress on another.
    (Full account systems or cloud saves are beyond the scope of the prototype but could be added later.)

Prototype Scope
Content

    Playable Class: 1 healer player character (with the 5 abilities listed above).
    All these abilities utilize the core timing mechanics and resource systems.
    Allied NPCs: 2 AI-controlled party members – one Tank and one DPS – to form the rest of the party.
    They have basic AI to perform their roles (the tank will attempt to hold boss aggro and the DPS will deal damage).
    Boss Encounters: 2–3 boss fights with distinct mechanics to showcase different challenges.
    For example, one boss might hit very hard infrequently (testing burst healing), while another applies steady damage or debuffs.
    Loot System: A basic loot table with around 10 items of varying rarity that can drop from bosses.
    This includes common gear upgrades and a couple of very rare items (~2% drop rate) to entice replay.
    Dungeon Map: One simple dungeon area consisting of 3–4 nodes per level and about 3 levels deep.
    This provides a small series of encounters (with possibly a fork in the path) to simulate dungeon progression on a smaller scale.

Technical Features

    Sweet Spot Mechanic: Fully implemented timing-based casting mechanic for spells that require it.
    This includes the UI bar and the logic for determining success/bonus or failure.
    Targeting System: Functional party frame targeting – the player can select party members and cast heals on them reliably.
    Enemy targeting for damage spells (like Smite) is also supported, usually defaulting to the current boss.
    Stat System: Core stat effects are in place so that gear and leveling change the character's performance (e.g., noticeable difference in cast speed with high Haste).
    The numbers can be adjusted easily for balancing.
    Developer Commands: Slash command tools are available in the prototype for quickly adjusting scenarios (such as healing the party to full, spawning a boss, or giving the player mana) to facilitate testing
    Saving Progress: Local storage saving/loading is implemented, so a player can reload the page and continue a saved dungeon run

Future Expansion Possibilities

    Community customization features (e.g. ability to create or tweak spells and character abilities)
    Many additional spells and abilities to expand the healer's toolkit (and possibly introduce other classes or specializations)
    More complex and varied boss mechanics, including multi-phase fights, more debuffs, and environmental challenges
    Enhanced targeting options, such as tab-targeting through enemies or ground-targeted area heals
    A talent or specialization system to further customize the healer's playstyle (e.g., focusing more on shields vs. pure healing)
    Additional party roles or members, like adding an AI healer or support, or having a larger raid-style group
    A boss encounter editor or modding support, allowing designers or players to create new encounters
    Extended loot and crafting systems for deeper itemization (craft your own potions, upgrade items, etc.)
    Improved graphics and visualization, such as moving to Canvas/WebGL for animations and effects
    Multiplayer co-op, enabling multiple human players to coordinate (e.g., one plays healer, others could play different roles)
    Event sourcing with mobx so we have undo/redo?
