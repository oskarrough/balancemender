# Image Asset Pipeline

Define assets in `assets/image-assets.json` (type, style, type-prompt, individual prompt). Print the composed Codex prompt, generate in Codex, save approved output under `public/assets/generated/`. Spells are action-bar icons, characters are unit-frame avatars.

    bun run asset:prompt -- --list                  # list all assets
    bun run asset:prompt -- renew heal              # print prompts by id
    bun run asset:prompt -- --type spell            # filter by type (combine with ids ok)
    bun run asset:optimize -- --dry-run             # preview PNG savings
    bun run asset:optimize -- --max 1024 renew      # shrink in place (default --max 1440)
