# Balance Mender

A tactical game inspired by healing raids and five-man dungeons back in Azeroth. Who remembers Heal Rank 2? Keep your party alive, kill the enemies.

🎮 Play on https://balancemender.0sk.ar

The game is an evening hobby project in progress and happy to welcome new contributors.

## Development

```
bun install
bun dev
bun run sim --repeat 10   # play out fights headlessly and report on them
```

## Documentation

This is a website and uses vite as build system.

→

1. [`index.html`](./index.html) loads [`src/main.ts`](./src/main.ts)
2. main.ts renders the menu and sets up the dev tools
3. main.ts also creates a [`GameLoop`](./src/nodes/game-loop.ts). The game loop ties everything together. It continuously renders [`components/ui.ts`](./src/components/ui.ts) to its `element` DOM node (assigned via main). Actually, should just make it a web component.

The game engine in [`src/vroum/`](./src/vroum/) provides `Node` and `Task` primitives that run on a `Loop`. It is inlined from [`vroum`](https://gitlab.com/jfalxa/vroum).

To render DOM nodes, https://github.com/WebReflection/uhtml is used.

Animations are made using CSS and `gsap`.

See the [`docs/`](./docs/) folder for more — [architecture](./docs/architecture.md) is the map,
[simulation](./docs/simulation.md) explains how fights are run and analysed without a browser.

## Notes

- Most spells trigger a global cooldown (GCD) of 1.5 seconds. During this time you cannot cast any other spells
- Mana regen is paused for X seconds after a cast completes

## References

- Games as World of Warcraft, Mini Healer, Little Healer
- https://gameprogrammingpatterns.com/game-loop.html
- https://www.askmrrobot.com/wow/theory/mechanic/spell/heal?spec=PriestHoly&version=live
- http://www.musinggriffin.com/blog/2015/10/26/mechanics-damage-over-time
- https://www.reddit.com/r/wow/comments/3hrgp5/little_healer_wow_healer_simulator_nostalgia/
- https://flotib.github.io/WoW-Healer-Training/index.html
- https://questionablyepic.com/
- https://docs.google.com/spreadsheets/d/1rD3V8v3pm8BdjqOs6izsFhw79qvZ-vp3uYZYMTz62WU/edit#gid=0
- https://www.wowhead.com/classic/spells/name:renew#0-2+20
- https://mksf-birdup.itch.io/mmo-healing-simulator
- https://html.itch.zone/html/10666420/6-13-24/index.html
