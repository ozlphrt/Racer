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

For a direct braking ablation without retraining:

```powershell
node scripts/analyze-braking.js path/to/export.json path/to/braking-report.json
```

This compares the original controller with three brake caps, three brake-onset
ramps, and one combined policy across all twenty solo grid starts. Physics,
steering decisions and retirement limits remain unchanged. The baseline wrapper
is checked against the unwrapped controller on every start. Four distinct sharp
centerline bends are selected geometrically; completed flying-lap windows report
entry, minimum and exit speed, braking duration, slip and lateral excursion.
Corner aggregates include only unassisted finishers and state their sample count.
These are control ablations, not learned racing lines; changing the pedal alone
does not test the potential of coordinated earlier braking and apex planning.

## Map-based racing-line benchmark

```powershell
node scripts/benchmark-racing-line.js path/to/export.json path/to/planner-20261020.json 640 20261020
node scripts/benchmark-racing-line.js path/to/export.json path/to/planner-20261021.json 640 20261021
node --test scripts/racingLinePlanner.test.js
```

`racingLinePlanner.js` creates several relaxed paths inside a conservative
asphalt corridor, computes curvature-based target speeds, propagates braking
requirements backward around the circuit, and follows the path with a separate
controller. It has privileged access to the entire map. This is a benchmark,
not a learned neural brain and not compatible with the live brain importer.

Search first samples controller settings, then refines fast and runoff-free
islands. It evaluates each trial from grid slot zero. Finalists include both
the fastest and the fastest runoff-free reference trials and are checked at all
twenty solo starting positions over five laps. A matched centerline ablation
removes the relaxed path and recalculates the speed profile, retaining controller
settings. This tests the path and its speed envelope together, not either alone.

The benchmark retains normal physics, recovery, grass drag and barriers, and
measures actual vehicle off-track time independently of nominal path clearance.
Its gate requires twenty unassisted finishes, a faster reference best lap and
mean race, no per-slot flying regression above 0.005 seconds, and no extra
off-track time above one physics tick. Passing this solo benchmark would still
require a separate integration and traffic test before any live replacement.

Startup refinement and independent disturbed-start validation:

```powershell
node scripts/refine-planner-starts.js path/to/export.json path/to/planner-20261020.json path/to/refinement.json
node scripts/validate-planner-starts.js path/to/export.json path/to/refinement.json path/to/validation.json
```

The refinement scales target speed only on the launch lap, when the car is
converging from a staggered grid onto the planned line. It tests nine scales
against each source finalist that finished all twenty starts and improved the
reference best lap. The validator checks passing 98%, 96% and 94% variants at
one hundred paired starts with independently seeded position/heading offsets.
It uses the same pace, containment and assistance requirements. Neither script
writes back to the source brain.

`cornering-lab.html` is an isolated 3D preview using the selected 96% variant
and an explicit copy of the saved generation-11464 reference genome. Both cars
run independent solo five-lap simulations from the same grid slot; the focus
selector changes which car is rendered. It does not import the storage or
breeding system. Main gameplay continues to use the existing neural controller.

The page also supports `?mode=grid` for a twenty-car, five-lap planner race.
`js/plannerRace.js` owns that race independently of the training simulation:
there are no captures, save writes or genetic breeding. It uses non-contact
driving and existing tire barriers. `js/racingLinePlanner.js` is the shared
controller; the original script path re-exports it for experiment compatibility.
The main game's Mode & Track panel links to this optional mode in a separate tab.
