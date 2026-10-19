# Changelog

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
