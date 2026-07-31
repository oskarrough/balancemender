# Measuring performance

`src/perf.ts` times things in the running game — two clock reads and a ring-buffer write per sample,
so it stays on in the real build. `main.ts` wires `frame`, `draw`, `draw:ui` and `draw:menu`; wrap
anything else you suspect in `measure()` and delete it when the question is answered.

```js
perf.measure('label', () => work()) // time a call
perf.interval('frame') // time the gap between successive calls
perf.report() // {label: {count, mean, p50, p95, max}} in ms — last 240 samples
perf.reset()
```

## Taking a measurement

`window.perf` and `window.balancemender` make a run a few evals. Set the scene, **then** reset and
sample a steady state — spawn frames are not the frames you are asking about, and the buffer holds
only ~4s at 60fps.

```
agent-browser batch --bail "open http://localhost:5173/?nosplash&muted" "wait 3000"
agent-browser eval 'for (const u of ["TinyWolf","WolfPup","Snapjaw","Skulker","Howler","WolfShaman"]) balancemender.perform({type:"spawn",unit:u}); for (let i=0;i<4;i++) balancemender.perform({type:"spawn",unit:"Tank"}); setInterval(()=>balancemender.perform({type:"healParty"}), 400); import("/src/nodes/bot.ts").then(m => new m.BotDriver(balancemender.player, "triage"))'
agent-browser eval 'perf.reset()'                    # a few seconds in
agent-browser eval 'JSON.stringify(perf.report())'   # ~5s later
```

A `BotDriver` keeps casts, auras and floating combat text in flight — the load an idle frame lacks.
The `healParty` interval is what makes an overloaded fight last long enough to sample; nine enemies
wipe the party in about sixteen seconds otherwise.

## What we know

**Full-UI re-render, worst honest case** (2026-07-31,
[#64](https://github.com/oskarrough/balancemender/issues/64)): nine enemies, five party units, bot
casting, auras, floating combat text, dev panels open.

| series | mean | p50  | p95  | max  |
| ------ | ---- | ---- | ---- | ---- |
| draw   | 0.31 | 0.3  | 0.4  | 1.6  |
| frame  | 16.7 | 16.7 | 17.0 | 17.7 |

~2% of the 16.6ms budget, frame interval never off 60fps. Re-rendering the whole UI every frame is
noise. Measure again if the UI grows a lot more per-unit detail.
