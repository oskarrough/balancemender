- Prettier preferences: tabs, single colon, no bracket spacing, no semis.
- Only add comments when the code isn't obvious
- Types: While we do use typescript sparingly. Rely on infered types where possible. Do not obsess over linting. Do not use TS enums.

## Method Naming and API Design

1. Aim for self-documenting method names - `prefers()` over `getPreferredTarget()`
2. Use verb-based method names for clarity - `reconsiders()` explains intention
3. Express domain concepts directly - make code read like natural language
4. One method, one responsibility - `prefers()` handles all target selection logic
5. Avoid duplication through smart abstractions - unified targeting in base class
6. Let domain language drive design - "reconsider" captures intent better than "switch"

## Direct Property Access

1. Prefer direct property access over getters/setters when they add no value.
2. Only create wrapper methods when they provide additional functionality beyond simple property access (validation, transformation, logging, etc).
3. Avoid creating methods like `getHealth()` that simply return `health.current` or `takeDamage()` that just call `health.damage()`.
4. Keep the code path direct and clear - each unnecessary abstraction layer makes the code harder to follow.

Remember: Methods should do something meaningful beyond simple property access or delegation.

## Character Targeting and Attacks

- Use `TargetingTask` and `this.currentTarget`
- Add attacks and effects to the class directly
- Attack constructors should accept just the attacker, since target relies on `this.currentTarget`
- The base Character class should be minimal and not include targeting logic
- Keep the existing API in DamageEffect that expects (attacker, target)
- The TargetingTask sets character.currentTarget when a target is found
- In the DamageEffect's tick method, we check if attacker.currentTarget exists and use that instead
