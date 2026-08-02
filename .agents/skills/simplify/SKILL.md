---
name: simplify
description: Simplify code without changing behavior. Use automatically when code is ready for human review, and whenever writing or reviewing code comments. Ready means the stated goal works and has been verified by tests and, when needed, human testing. In Balance Mender, never change gameplay or balance.
---

# Simplify

Review changes in the current branch, or only the scope the user names. Make the code easier to read and leave less of it, without changing behavior. Touch only code in scope.

## Hard bounds

- **Do not change gameplay or balance.** Do not alter numbers, timing, probabilities, targeting, ability rules, resource flow, encounter composition, win or loss conditions, action order, or player input behavior.
- Treat unclear gameplay behavior as fixed. Preserve it rather than “cleaning it up.”
- Refactor only when equivalence is clear and covered by existing tests. If proving equivalence would require new design or balance judgment, stop and report the opportunity instead.
- Do not widen the task into nearby cleanup.
- Prefer a net reduction in code and concepts. Do not add an abstraction unless it removes more code or state than it adds and makes the call sites plainer.

## Word choice in code and comments

Variable names, function names, and comments are prose. Apply Orwell's rules from “Politics and the English Language” to each:

> Never use a long word where a short one will do.
>
> If it is possible to cut a word out, always cut it out.
>
> Never use the passive where you can use the active.
>
> Never use a foreign phrase, a scientific word, or a jargon word if you can think of an everyday English equivalent.

Latinate vocabulary such as `reconcile`, `coalesce`, `normalize`, and `reconciliation` sounds technical and abstract. Prefer short, physical words such as `prune`, `run`, `watch`, `stop`, `drop`, and `walk` when they fit.

### Names

1. **One word per concept, one concept per word.** Keep a vocabulary. If `sync` means “pull remote changes,” it cannot also mean “flush edits to disk”; rename one.
2. **Cut words the context already carries.** A module named `workspace-watcher` does not need `startNativeWorkspaceWatcher`; `watchWorkspace` says the same thing.
3. **Treat compound names as a warning.** Ask whether one clear word names the concept better:
   - Avoid: `lastObservedDiskContent`
   - Prefer: `baseline`
4. Use the codebase's established words. Do not invent a synonym for an existing concept.

### Comments

State, in plain English, the constraint the code cannot show: why the non-obvious code exists.

- Add a comment when complex code has a non-obvious reason or constraint.
- Add a doc comment when a function has complex behavior or side effects that its signature cannot show.
- Delete comments that narrate change history or the conversation.
- Delete comments that restate self-evident code.
- Tighten comments with the same care as code. Keep only words that help the next reader avoid a mistake.

## Code structure

1. **Inverted pyramid.** Lead with exported or significant functions and place helpers below them.
2. **Related concepts over monoliths.** Split a large file only when each resulting module owns one clear concept and the split reduces what a reader must hold at once.
3. **Combine overlap.** Merge types, functions, or constants that express substantially the same concept.
4. **Use shared code.** Check for an existing library or utility before writing another copy.
5. **Remove derivable state.** If code can compute a value from data already in scope, do not pass or store it separately. For example, drop `isDirty` when it always means `editorContent !== baseline`.
6. **Delete before rearranging.** Remove dead paths, needless wrappers, aliases, repeated branches, and one-use abstractions before introducing new structure.

## Avoid overfitting

Code must stand on its own. If a change only makes sense to someone who watched it happen, it is overfitted. Write for a reader who arrives with no branch, issue, or chat history.

- Rewrite names and comments against the codebase's own vocabulary.
- Do not preserve compatibility with unshipped code. If an old signature, alias, or data shape existed only earlier in the current branch, delete it and update its callers.
- Do not encode the current test setup as a special case. Keep the general rule visible.

## Review loop

1. Confirm the stated goal already works before simplifying.
2. Read the scoped diff and its callers. Note any gameplay-sensitive code and leave its behavior fixed.
3. Make the smallest edits that reduce code, state, naming burden, or concepts.
4. Re-read the diff as a new maintainer. Remove conversation residue and needless compatibility paths.
5. Check that the result has less code or fewer concepts. If it does not, undo changes that merely move complexity.
6. Run the relevant existing tests and checks after the edits. In this repo, run `bun run check` and `bun run test` before handoff.
7. Report what became simpler and explicitly confirm that gameplay and balance did not change.
