# Changelog

## 1.5.8 — 2026-10-20

- Separate population completion from champion validation inside the existing completion tile. Label historical finish charts and training summaries as population measurements.
- Add an explicit champion test: freeze the latest completed-race winner (fall back to the saved best brain), run 20 solo starts at the selected Lab distance in a dedicated worker, and display only measured results with their generation and lap count.
- Keep validation separate from training, records and milestone captures. Support cancellation and clear results when their context changes; do not manufacture or restore a success value on reload.
- Preserve the latest completed-race champion in saves. Verify success and failure counting, configuration restoration, champion save/reload, and track changes in 73 passing regression checks. Confirm the compact dashboard fits without scrolling.

## 1.5.7 — 2026-10-20

- Help slow AI cars stranded while braking in runoff rejoin through gentle throttle and forward centerline steering. Release the assistance inside the curb; exclude manual controls, normal racing, fast departures and cars beyond the hard boundary.
- Preserve grass drag, off-track penalties and the 1.8-second runoff deadline. Include runoff assistance in existing recovery traces.
- Across two seeded 25-generation tests from the Gen 11187 export, completion increases from 698/1000 to 767/1000 and runoff retirements fall from 138 to 9, with the same 10.7667s best lap. Direct replay of 67 previously stranded cars returns all 67 to the track and finishes 48 within the standalone race limit; others still fail later. These tests seed new offline populations, not the browser's full population.
- Add repeatable runoff comparisons and five regression checks for rejoining, control exclusions, hard limits, traces and unchanged healthy-brain trajectories. All 71 checks pass.

## 1.5.6 — 2026-10-20

- Breed 60% of ordinary offspring through small mutations of complete finisher networks; retain elites, pace champions, exploration, crossover and manual bursts.
- Reproduce Gen 10822's champion finishing five laps from all 20 grid slots. In two seeded 25-generation offspring tests, completion improves from 546/1000 to 716/1000; early S1 crashes fall from 159 to 107 and best lap remains 10.8167s. These are offline seeded populations, not a replay of the browser's full population.
- Add the repeatable start-analysis command and a regression check for intact finisher inheritance. Preserve physics, runoff retirement limits, saves and captured brains.

## 1.5.5 — 2026-10-20

- Record the first start/finish-line crossing and trim countdown/grid travel from the first-lap ghost replay.
- Start the lap-2 ghost at that crossing immediately, using actual circuit samples and their elapsed times.
- Preserve race timing and historical records. Verify immediate lap-2 movement and 65 passing regression checks.

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
