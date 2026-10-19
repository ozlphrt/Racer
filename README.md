# AI Racer

A population of neural-network cars learns to stay on track and race faster using neuroevolution (a genetic algorithm), in plain HTML, JS and Canvas.

## Run

```bash
npm run dev          # launches Vite dev server on http://localhost:5173 (with Hot Module Reloading)
npm run build        # bundles production release to dist/
npm run preview      # locally previews production build
npm run test:headless # trains 60 generations in Node headlessly and prints stats
```

## Bundled milestone brains

The captured-brain picker includes shipped, organically tested milestones even on a first visit. Personal captures take precedence at the same generation. Bundled checkpoints remain available after a training reset and are filtered for compatible track, physics, and network settings.

To ship more actual captures, use **Export captured brains** in the picker, then run:

```bash
npm run bundle:brains -- path/to/ai-racer-captured-milestones.json
npm run build
```

The import command validates the exported checkpoints and embeds them in `js/presetBrains.js`. It does not synthesize untested generations or invent benchmark values.

## How it works

- **Inputs (8):** 7 raycast wall distances (-90°…+90°) and speed
- **Brain:** MLP 8 → 12 → 8 → 2 (tanh) → steer, throttle/brake
- **Fitness:** distance progressed + lap bonus + faster-lap bonus − crash penalty
- **Evolution:** 80 cars, 2 elites, tournament selection, uniform crossover, Gaussian mutation
- A car is eliminated on a wall hit, no progress for 3 s, or driving the wrong way. A generation ends when all cars are out or 40 s pass.

All tunables live in [`js/config.js`](js/config.js).

## Captured milestone brains

Reset learning to start a fresh capture run. A milestone appears only after its
generation completes (1, 2, 5, 10, 50, 100, and later checkpoints). Its brain,
best lap, peak speed, and completed laps come from that generation's actual
champion. A brain that has not completed a lap shows no lap time.

Captures work during normal play and fast-forward training, persist with the
training save, and can be downloaded together using **Export captured brains**
in the captured-brains menu. Test distance and contact settings accompany each
capture. Replays and imported brains do not create checkpoints. Resetting
learning clears captures; switching circuits clears them and requires a fresh
reset to start a new capture run. Changed physics hide incompatible captures.

For an offline fresh run, use
`node scripts/generate-milestone-presets.js grand-prix 180`. This writes only
actually reached checkpoints to `public/captured-presets.json`; it does not
synthesize later generations or install them as browser presets.

## Controls

| Key | Action |
|---|---|
| Space | Pause / resume |
| O | Toggle 3D Orbit Camera / 2D Top-Down View |
| Mouse Drag (3D) | Orbit & rotate camera in 360° |
| Scroll (3D) | Zoom in / out |
| Right-click Drag (3D) | Pan camera position |
| T | Turbo (as fast as the CPU allows) |
| F | Follow the leader car |
| V | Toggle sensors |
| G | Toggle population ghosts |
| M | Drive yourself (arrow keys) |
| R | Reset training |
