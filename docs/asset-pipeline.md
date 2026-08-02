# Image Asset Pipeline

Define assets in `assets/image-assets.json` (type, style, type-prompt, individual prompt). Print the composed Codex prompt, generate in Codex, save approved output under `public/assets/generated/`. Spells are action-bar icons, characters are unit-frame avatars, and scenes are dungeon-room paintings.

A scene is one room painted twice — `<id>.png` wide and `<id>-portrait.png` tall — from the room prompt plus that asset's `portrait` recomposition note, so the room is never written out twice. Rooms name the scene id and `scenePaths()` derives both files; `registry.test.ts` fails if either is missing.

    bun run asset:prompt -- --list                  # list all assets
    bun run asset:prompt -- renew heal              # print prompts by id
    bun run asset:prompt -- --type spell            # filter by type (combine with ids ok)
    bun run asset:prompt -- --type scene            # print every room-painting prompt, both views
    bun run asset:prompt -- --variant portrait      # just the tall views
    bun run asset:optimize -- --dry-run             # preview PNG savings
    bun run asset:optimize -- --max 1024 renew      # shrink in place (default --max 1440)

Optimizer ids are exact, not substrings — `glow` matches nothing, and a portrait variant is its
own id (`glow-tender-portrait`). Optimize every new PNG before jj touches it: the repo refuses to
snapshot new files over 1MiB.

Generation is one-shot from the CLI — pipe the composed prompt (the exact format `asset:prompt`
prints, including the output target path) into codex:

    bun run asset:prompt -- <id> | codex exec --sandbox workspace-write --skip-git-repo-check -C . -

## Composing a scene

[universe.md](./universe.md) is what the place should feel like; this is how it has to sit on a
screen.

- The tall view is the same place **looked at again** for a narrow screen, never a crop of the wide
  one — same landmarks, same hour, same palette, so the two are unmistakably one place.
- It stacks around the combat UI rather than around the eye. Unit frames come down from the top and
  reach two-thirds of the way down a crowded room, so the upper two-thirds is sky, canopy or open
  space that reads fine behind them. The room's defining clue lives low: the strip between
  two-thirds and four-fifths is the only clear air a phone has. Put the bell where it can be seen.
- Adjacent rooms carry landmarks forward — above all the river and the path beside it — so pressing
  Next feels like walking farther into the same country.
- The painting establishes the encounter, it does not illustrate the combat. A narrow ford explains
  an animal holding the crossing; high cover explains an ambush. Unit frames carry the fight.
