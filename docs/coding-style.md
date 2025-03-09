- Prettier preferences: tabs, single colon, no bracket spacing, no semis.
- Only add comments when the code isn't obvious
- Types: While we do use typescript sparingly. Rely on infered types where possible. Do not obsess over linting. Do not use TS enums.

## Code Optimization

1. Remove unnecessary comments - if code is self-explanatory, no comment needed
2. Delete commented-out code completely - don't leave dead code in the repo
3. Remove all console.log statements in production code
4. Group imports from the same module - `import {a, b} from 'module'` not separate lines
5. Remove redundant JSDoc comments that add no value beyond the code itself
6. Simplify conditionals using array methods where appropriate - `if (['a', 'b'].includes(x))` over multiple conditions
7. Keep HTML templates clean with minimal whitespace and tight formatting
8. Keep functions focused and minimal - prefer shorter, cleaner functions over verbose ones
9. Delete obvious explanatory comments - e.g., `// Initialize variable` before `let x = 0`

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
