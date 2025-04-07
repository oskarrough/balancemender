Hello future self, and others, welcome.

Here are some paragraphs to briefly explain how this game is made.


- index.html loads src/main.ts
- main.ts creates a `GameLoop`
- main also renders the menu and sets up the dev tools
- The game loop ties everything together. It renders `components/ui.ts` at 60fps to it's `element` DOM node (assigned via main). Actually, should just make it a web component.

The game uses the `vroum` (https://gitlab.com/jfalxa/vroum library). Vroum helps organize everything in a structure of `Nodes` and `Tasks` that run on a (Game)`Loop`.

It uses CSS animations and `gsap` for the less simple animations.

To make it easier to create DOM nodes, we use https://github.com/WebReflection/uhtml.

Okay, that's about it for dependencies for now.