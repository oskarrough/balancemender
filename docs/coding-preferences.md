# Coding preferences

Use [the glossary](./glossary.md) for domain names, [the architecture guide](./architecture.md) for
data flow and [vroum.md](./vroum.md) for lifecycle. The glossary is the vocabulary we want; where the code still says
something else, do not spread it further.

- Prefer direct, domain-named code over wrappers and generic abstractions.
- A method should add behavior; otherwise use direct property access.
- Let TypeScript infer local types. Do not use enums or casts that hide errors.
- Comments explain surprising constraints and decisions, not what the code already says.
- Pass context for one use, such as its target, as an argument rather than relaying it through unit
  state.
- Keep an ability separate from its driver: the ability says what it requires and does; the driver
  decides when to use it and which eligible target it prefers.
