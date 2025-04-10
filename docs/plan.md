# Implementation Plan


## TODO

1. Game Loop & Architecture

- [x] Fix spell system (static vs instance properties)
- [x] Fix keyboard shortcuts for spell casting
- [x] Implement HOT effects system
- [x] Fix static props on Boss class. Look at Spells for inspiration
- [x] Complete the core game loop with proper state management
- [x] Implement clean sound system with categorized sounds
- [ ] Implement event-driven architecture for game events
- [ ] Reduce complexity in audio.ts
- [ ] Refactor hot + dots
- Future idea: show combat stats once combat ends: Amount healed, Overhealing, Mana spent

2. Balance updates

spells do percentage dmg

amount of dmg your char can do
spell has a coeffecient based on char dmg

"example attack" has 20% (of your total dmg)

say you have 1k dmg

15%, 5 targets = 150 per swing
50%, 1 target = 500 per swing

if you have 20% bonus dmg, you'd do 500 * 1.2 = 600

if the target has 15% physical armor reduction, you will deal 600 * 0.85 = 510 dmg 

spell dmg ignores armor

# Character/class scaling

- 1 stamina = 1 hp
- 60 int = 1% spell crit
- 1 intellect = 15 mana
- 1 strength = 2 attack power (weird, no?)
- 30 agility = 1% crit
- 20 agility = 1% dodge
- 1 spirit helps mana regen. You generate let's say (spirit/4) + 12 mana every 2 seconds after not casting for 5 seconds.

These are just ideas, not strict formulas. Different characters might receive different stats.

## LATER

2. UI Components

- [x] Basic Action Bar for spell selection
- [ ] Improve Action Bar with cooldown indicators
- [x] Basic Cast Bar implementation
- [ ] Enhance Cast Bar with sweet spot indicator
- [x] Party Frames for target selection and health monitoring
- [x] Basic Health/Mana indicators
- [ ] Improve Health/Mana indicators with animations
- [x] Floating combat text for damage and healing
- [ ] Improve FCT so it works with each character in the UI

3. Spell Casting System

- [x] Fix spell implementation with proper static/instance properties
- [x] Implement Heal Over Time (HOT) effects
- [x] Add sound effects for different spell types
- [x] Fix Global Cooldown (GCD) system for instant cast spells
- [x] Implement basic DoT (Damage over Time) effects
- [ ] Complete remaining spell effects
- [ ] Add spells with cooldowns
- [ ] Implement the sweet spot mechanic

4. Targeting System

- [x] Allow selecting party members via party frames
- [x] Implement enemy targeting for damage spells
- [x] Create a unified Character component for consistent UI

5. Character Stats & Progression

- [ ] Implement core stats (Haste, Spell Power, etc.)
- [ ] Create stat modification system for buffs/debuffs

6. Combat & Boss Mechanics

- [x] Implement boss class with static properties for multiple boss types
- [x] Implement boss attack patterns
- [x] Add combat sounds for various attack types
- [x] Implement basic DoT effects (Poison, Bleed, Burn)
- [ ] Add more complex status effects (debuffs, stuns, healing reduction)
- [ ] Create boss special abilities

7. Development Tools

- [x] Console for command input
- [x] Cheat commands for testing
- [x] GodMode for invulnerability
- [x] InfiniteMana for spell testing
- [x] Toggle for removing enemies
- [x] Web component-based developer console for better encapsulation
- [x] Performance monitor for FPS and game state 
- [x] Combat log for tracking game events
- [ ] Integrate developer tools into a unified debug panel

8. Audio System

- [x] Implement global AudioPlayer with categorized sounds
- [x] Add sound effects for spell casting and interruption
- [x] Add combat sounds for different attack types
- [x] Add sound toggle in menu with proper state management
- [x] Implement proper audio volume and mute control

## NEXT STEPS (Prioritized)

1. Player Experience
   - [x] Add more feedback for player actions
   - [x] Add floating combat text for damage and healing
   - [x] Add sound effects for different spell types
   - [ ] Create more responsive UI for spell casting
   - [ ] Implement the sweet spot mechanic for critical healing

2. Game Balance
   - [ ] Adjust enemy health and damage values for better pacing
   - [ ] Balance spell costs and cooldowns
   - [ ] Create progression curve for difficulty

3. Content Expansion
   - [ ] Create a simple dungeon with multiple encounters
   - [ ] Implement more bosses with unique mechanics
   - [ ] Add different environments for visual variety

4. Performance & Optimization
   - [ ] Optimize rendering for better performance
   - [ ] Implement proper garbage collection for removed effects
   - [ ] Add frame rate limiter for consistent experience

5. Enhanced Combat Logging System
   - [x] Implement structured combat log format (see plan-advanced-logs.md for details)
   - [ ] Create local storage solution using IndexedDB
   - [ ] Develop in-game log viewer with filtering capabilities
   - [ ] Add opt-in system for players to contribute logs
   - [ ] Set up cloud storage with privacy considerations
   - [ ] Build analysis tools for gameplay metrics and statistics
