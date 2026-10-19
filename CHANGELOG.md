# Changelog

## 1.5.4 — 2026-10-20

- Start the ghost at P1's lap crossings: lap 2 replays P1's first lap; subsequent laps select the best completed lap from earlier laps in this race.
- Freeze the replay choice during each lap and restart its clock at the next P1 lap crossing. Finished replays wait at the line instead of looping.
- Show the active race lap and the selected source car/lap in Settings; preserve historical records and bundled brains.
- Validate lap 2–5 selection, tied laps, leader changes, playback timing, finish waiting, and race resets in the 64-test regression suite.

## 1.5.3 — 2026-10-20

- Keep tied laps from swapping the ghost's racing line due to floating-point noise; require an improvement greater than 0.01 seconds.
- Identify the replay's source car on its badge and show its generation, car, lap number, and measured time in Settings.
- Reproduce the Gen 5,000 replay with an injected 8.54-second historical record: the current ghost follows the actually recorded 11.20-second lap.

## 1.5.2 — 2026-10-20

- Clear ghost playback at every race start and restart; wait for an actual lap in the current race.
- Replay the fastest recorded lap from that race independently of historical record times and saved trajectories.
- Remove ideal centreline ghost generation and label playback as Race Ghost in both 2D and 3D.
- Preserve historical records and captured brains. Validate the race ghost lifecycle with 64 regression checks.

## 1.5.1 — 2026-10-20

- Make the record ghost easier to see with a brighter cyan body and a readable marker above the car.
- Show when Record Ghost is waiting for a valid lap or outside the current camera view.
- Refresh the ghost marker after the F1 model loads without repeatedly uploading unchanged text.
- Validate ghost visibility transitions and marker caching; 63 regression checks pass.

## 1.5.0 — 2026-10-20

- Bundle 11 organically tested milestone brains through generation 5,000 for first-time players. Both JSON export routes now include captured checkpoints.
- Improve fixed-step motion, car interpolation, camera tracking, contacts, and scenery rendering while retaining skidmarks.
- Default to Auto Director on every load; update car previews, record celebrations, smoke, and gantry framing.
- Simplify the training dashboard to four key tiles with a portrait graph panel, race outcome breakdown, crash map, and S1 pre-crash trace inspector.
- Share a 15-second finish window between live and fast-forward races, favor reliable finishers in breeding, and report observed training progress.
- Improve saved-state recovery and milestone validation. Add 61 regression checks and run them before GitHub Pages deployment.
