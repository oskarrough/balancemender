# Image asset pipeline

This is the canonical execution guide for humans and agents creating image assets. Sorrel owns the
artistic brief and recommends the winning image; Oskar makes the visual decision. This document owns
how prompts become safe files.

## Agent contract

When asked to create or repaint Balance Mender artwork, summon Sorrel and give it the request. Sorrel
reads this document first, grounds the brief in the game, generates candidates, checks them at their
actual display size, and presents a visual choice. Never write directly over approved artwork and
never promote a candidate without an explicit visual decision.

## Route the request

Create deterministic raster requests directly. Do not ask an image model for a solid red 50×50 PNG:

```sh
bun -e "import sharp from 'sharp'; await sharp({create:{width:50,height:50,channels:4,background:'#f00'}}).png().toFile('public/assets/example.png')"
```

Illustrative spells, characters and dungeon scenes go through Sorrel, the manifest, candidate
generation, review and explicit promotion. Generated candidates never write approved public paths.

## 1. Brief and manifest

Sorrel reads the universe and glossary, directs one artistic decision at a time, and records the
approved brief in `assets/image-assets.json`. The manifest owns the house style, type prompts, asset
prompts, output folders and scene variants. Spells and characters are exactly 1024×1024. Scenes use
the exact `sceneVariants.*.size` dimensions.

Inspect composed prompts without generating:

```sh
bun run asset:prompt -- --list
bun run asset:prompt -- renew
bun run asset:prompt -- green-first-blood          # both scene variants
bun run asset:prompt -- green-first-blood --variant portrait
bun run asset:prompt -- --type spell
bun run asset:prompt -- --type scene --variant landscape
```

A scene is one room painted twice: landscape and portrait are separate generation jobs, with the
portrait recomposed rather than cropped. Generate and approve the landscape first; portrait
generation automatically attaches it as a visual reference unless another `--reference` is given.

Scene composition is part of correctness:

- The two views preserve landmarks, hour and palette so they are unmistakably the same place.
- Unit frames cover the upper two-thirds of a crowded phone view. Keep that area as sky, canopy or
  open space; put the room's defining clue in the clear band between two-thirds and four-fifths.
- Carry the river, path and other landmarks into adjacent rooms so **Next** reads as walking onward.
- Establish why the encounter behaves as it does without depicting combat. Unit frames carry the fight.

## 2. Generate candidates

Generation accepts exactly one asset id. Scenes require a variant. Candidate count defaults to one
and is capped at four; candidates run concurrently in isolated temporary workspaces. Repeated
candidates explore drawing and composition, **not reliably a different style**—change the brief or
references when style is the question. The model and reasoning defaults are explicit
(`gpt-5.6-sol`, `low`). References are repeatable and default to the `style` role.

```sh
bun run asset:generate -- renew
bun run asset:generate -- renew --candidates 4
bun run asset:generate -- green-first-blood --variant landscape --candidates 2
bun run asset:generate -- ringing --reference ./gash.png --reference ./rend.png
bun run asset:generate -- roha --reference ./roha-concept.png --reference-role identity
bun run asset:generate -- renew --model gpt-5.6-sol --effort low
```

A `style` reference controls medium, shape language, line treatment, texture and detail while the
written brief retains subject, palette and composition. An `identity` reference also carries subject
anatomy, landmarks, palette, materials and light; portrait scenes select this role automatically.

Each Codex process receives only the fully composed prompt and optional reference images. Runs are
kept under gitignored `tmp/image-assets/<run>/`: candidate PNGs, exact prompts, Codex JSONL, stderr
and metadata including duration, model, effort and exit status. OS temporary workspaces are removed,
and a stuck Codex process is stopped after five minutes. A candidate is retained only if Sharp can
decode it as PNG at the manifest's exact dimensions. If Codex exits unsuccessfully after writing a
valid staged image, the image is recovered, metadata marks it `recovered-after-codex-error`, and the
command still reports failure rather than hiding the bad exit.

## 3. Review and select

Sorrel compares the candidate PNGs against the brief, adjacent assets and actual UI role, then names
one candidate for promotion. Repaint by changing the manifest brief or supplying references and run
generation again. Candidate runs remain unchanged as review evidence.

## 4. Promote explicitly

Approval takes the selected candidate and asset id. Scenes again require the matching variant.
Existing approved files are protected unless `--replace` is explicit.

```sh
bun run asset:approve -- tmp/image-assets/<run>/candidate-1.png renew
bun run asset:approve -- tmp/image-assets/<run>/candidate-2.png green-first-blood --variant landscape
bun run asset:approve -- tmp/image-assets/<run>/candidate-2.png green-first-blood --variant portrait --replace
```

Approval revalidates PNG type and exact dimensions, preserves the candidate, and atomically writes a
palette-optimized delivery copy to the manifest-derived path under `public/assets/generated/`. It
tries palette quality 90 first and lowers it only when needed to stay at or below 1 MiB.

For already-approved legacy PNGs, the separate in-place optimizer remains available:

```sh
bun run asset:optimize -- --dry-run
bun run asset:optimize -- --max 1024 renew
```
