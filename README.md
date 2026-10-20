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

## Reproducing start reliability

For the separate cornering and lookahead research tools, see
[offline experiment instructions](scripts/OFFLINE-EXPERIMENTS.md) and
[measured results](docs/cornering-experiment-results.md). These experiments do
not replace the live driving model or saved champion.

The Training Lab's **Population finish** measures the evolving field, including
mutated offspring. **Champion test → Validate** freezes the latest completed
race winner (or the saved best brain before a new winner exists) and tests it
from 20 solo starts at the selected Lab distance. Results appear only after
the test completes and identify the tested generation; these are not traffic
tests. Validation runs in a background worker, can be cancelled, and never
updates training records or brains. Changing distance, track, physics or
resetting training clears the result. Reloading starts with **Not tested**.

Run `node scripts/analyze-starts.js path/to/brain-export.json 25 10822` to seed
25 training generations from an exported champion with a repeatable random seed.
The JSON output reports completion, crashes, early S1 crashes and grid-slot
results. This uses current repository physics and creates a new offline
population; a brain export does not contain the player's entire population.
Browser training saves are never read or changed.

Use `node scripts/analyze-runoff.js path/to/brain-export.json 25 11187` to
compare completed runoff excursions and replay failed policies with experimental
3.6- and 6-second deadlines. Only failures reproduced at the original 1.8-second
deadline enter that comparison. The experiment runs offline and does not change
game settings, physics, or browser saves.
Append `--compare-recovery` to generate failures with assistance disabled, then
replay those same policies with low-speed recovery and the unchanged 1.8-second
deadline. Recovery uses gentle throttle and a forward centerline target only for
slow AI cars braking in runoff, and releases control once the car is inside the
curb. Manual driving and normal racing continue to use their existing controls.

Use `node scripts/analyze-departures.js path/to/brain-export.json 25 11464` for
sector crash counts, outcomes after assisted rejoins, and S3 traces. The script
replays S3 failures with recovery disabled to distinguish a rejoin problem from
a policy that would otherwise have failed earlier. Results describe newly
seeded offline populations rather than the browser's original population.

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
