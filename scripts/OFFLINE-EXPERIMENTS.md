# Offline corner-lookahead prototype

These scripts do not participate in the browser bundle, write browser saves,
replace the champion, or create captured milestones.

The original eight-input model can be explored independently with:

```powershell
node scripts/explore-cornering.js path/to/export.json path/to/report.json 12 389
```

That search keeps the existing model format and compares corner-sector timing,
braking duration and full-race performance. The following lookahead experiment
uses a separate model format.

`lookaheadBrain.js` converts an 8-12-8-2 genome to a separate 12-12-8-2 model.
It preserves the old weights and adds initially zero-weight inputs for lateral
track position, heading error, and two samples of upcoming centerline curvature.
Zero-weight transfer preserves the original policy exactly. Curvature is averaged
over five track samples and normalized by track half-width. This uses explicit
map information that the original ray-only brain does not receive.

Run prototype tests:

```powershell
node --test scripts/lookahead.test.js
```

Run a seeded search against an exported brain (use a separate output path):

```powershell
node scripts/explore-lookahead.js path/to/export.json path/to/report.json 24 11464 near
node scripts/explore-lookahead.js path/to/export.json path/to/far-report.json 12 389 far
```

`near` samples curvature at 80 and 180 world units; `far` uses 160 and 320.
Search retains both fast-lap and consistent-race candidates. Finalists are rounded
to five-decimal weights, tested from all 20 solo grid starts, and compared with
the source brain. An ablation switches off all four new inputs while retaining
the learned weights. The prototype is evaluated on five-lap races using existing
physics, grass drag, tire barriers and retirement rules.

Reports use `offline-lookahead-v1` and explicitly mark incompatibility with the
live app. They are research artifacts, not importable live milestone brains.
Passing the promotion gate requires faster reference best-lap time, faster mean
full-race time, twenty finishes without recovery assistance, and no flying-pace
regression over 0.005 seconds at any grid position. Search success is never assumed.
