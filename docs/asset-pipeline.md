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

Generation is one-shot from the CLI — pipe the composed prompt (the exact format `asset:prompt`
prints, including the output target path) into codex:

    bun run asset:prompt -- <id> | codex exec --sandbox workspace-write --skip-git-repo-check -C . -
