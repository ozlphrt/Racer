# Racing-line benchmark results

The offline planner is implemented. It uses the whole track map to relax a
path within an asphalt corridor, calculate corner speeds, brake in advance,
and follow the resulting line. It is a separate controller, not an upgraded
or retrained neural brain.

The comparison replays the user's exported generation-11464 champion under
the repository's current default five-lap physics. It does not measure the
current generation-130322 browser population or read its browser saves.

**Follow-up:** a first-lap speed margin now removes the startup excursions.
The selected planner passed twenty normal starts and one hundred perturbed
starts with zero runoff and no recovery. Its mean five-lap time on perturbed
starts is **56.7262 seconds versus 57.4033 seconds** for the saved champion.
The separate local comparison page is `cornering-lab.html`; the main game
still uses its existing neural controller.

## Final reproducible comparison

Two seeded searches tested 640 parameter sets each: **1,280 reference-start
trials** in total. Each search sampled broadly, then refined both fast and
runoff-free candidates. Six finalists per seed were evaluated from all twenty
solo grid starts. Each finalist also received a matched centerline-path
ablation. All tests retain existing tire barriers, grass drag, recovery and
retirement limits. Physics randomness is repeatable per start and separate
from parameter-search randomness.

| Controller | Reference best lap | Mean five-lap race | Finishes without recovery | Starts with runoff |
| --- | ---: | ---: | ---: | ---: |
| Saved champion | 10.7667 s | 57.3883 s | 20/20 | 0/20 |
| Fastest planner with twenty unassisted finishes | 10.6000 s | 56.3817 s | 20/20 | 20/20 |
| Another fast planner with fewer excursions | 10.6333 s | 56.5033 s | 20/20 | 4/20 |
| Fastest mean-race finalist with no runoff at any start | 10.8500 s | 57.5358 s | 20/20 | 0/20 |

The fastest individual reference trial ran 10.5500 seconds, but finished only
14 of twenty starts without recovery. It is not a reliable improvement.
"Without recovery" does not imply a car stayed within track limits: these
counts distinguish brief grass excursions from activation of recovery assist.

The 10.6000-second planner uses a 75% brake cap and no time above 90% brake.
It brakes for about 2.396 seconds per reference flying lap versus 1.908 for
the champion, whose time above 90% brake is about 0.783 seconds. This is a
different line and speed plan, not the old brain with its brakes weakened.
Its excursions reach about 0.817 seconds per race at the worst starting
position. The 10.6333-second finalist reaches about 0.467 seconds.

The nominal planner paths keep their centers at least 14 or 20 world units
inside the asphalt boundary. Vehicle tracking error can still carry body
corners beyond the allowed curb. Actual off-track time is measured using the
same four-corner check as the game, independently of nominal path clearance.

The matched centerline ablation failed to finish all twenty starts for the
fastest candidates. This supports a contribution from the planned path and
its corresponding speed envelope together. It does not isolate the benefit
of the apex path from the speed profile, and it is not a comparison against
an independently optimized centerline controller.

## Initial decision, before startup refinement

**No candidate passes all gates.** The gate requires twenty unassisted
finishes, faster reference best lap and mean race, no per-slot flying-lap
regression over 0.005 seconds, and no additional off-track time beyond one
physics tick. Faster candidates fail the track-limit check; fully contained
finalists are slower than the champion.

The result shows that planning can produce faster measured laps with softer
braking, but it has not established a faster, equally contained replacement.
Do not install these benchmark controllers as captured brains or change live
brake strength. The remaining engineering issue is path tracking and corner
clearance at speed, followed by validation on traffic and other circuits.

The live app, saved champion and milestones are unchanged. The added tests
check path clearance and source-geometry preservation, cyclic braking limits,
and bounded controls through an actual five-lap run. The full regression suite
passes **79 tests**.

## Startup refinement and holdout validation

Excursion traces showed that the 10.6333-second finalist from seed 20261020
only left the track on its launch lap. Its subsequent flying laps stayed
contained. This distinguishes grid-to-line convergence from steady-state
cornering. The faster 10.6000-second finalist also had flying-lap excursions
and was rejected.

Nine launch-lap speed scales were tested on each of those two candidates,
with twenty solo starts per scale. Scaling the target speed on the first lap
to 98% or less removed all excursions for the 10.6333-second candidate.
The path and speed plan revert to their original settings from lap two;
physics, retirement limits and track boundaries remain unchanged.

The selected preview uses a **96% first-lap scale**, retaining more margin
than the fastest passing 98% variant. It passed the original twenty-start gate:
20/20 unassisted finishes, zero off-track time, improved reference best lap
(10.6167 seconds), faster average race, and faster flying average at every
starting position. Its mean five-lap race was 56.7258 seconds versus 57.3883.

An independent set of one hundred starts covers all twenty grid positions,
with lateral and longitudinal offsets within ±2 world units and heading
offsets within ±2 degrees, using seed 54321. Both the saved champion and the
planner receive identical offsets. The selected planner finishes **100/100
without assistance and with zero off-track time**, with faster flying pace
at every paired start. Mean race time is **56.7262 versus 57.4033 seconds**,
a gain of about **0.68 seconds (1.18%)**. The 98% and 94% variants also pass
this holdout set. Full data is in `planner-perturbed-validation.json`.

This is a map-based benchmark with privileged track information, not a
captured neural brain. It has not been validated in car-to-car contact or
on unseen circuits. The isolated comparison page runs the saved brain and
planner independently from the same grid slot with collisions disabled.
Its camera selector and focus selector allow visual review of braking and
cornering. It never reads or writes training saves or captured milestones.

The regression suite now includes a twenty-start replay test for the exact
preview candidate and passes **80 tests**. Normal gameplay is unchanged.

## Optional full-grid mode

The main game's Mode & Track panel now links to **Experimental Planner Race**.
The separate page has a Comparison / 20-car race selector. The full-grid mode
uses the same validated planner on twenty staggered starting positions and the
normal physics and tire barriers. It is explicitly a non-contact mode; avoidance
and car-to-car contact have not been validated for this controller.

A headless full-grid run completes all twenty five-lap races without runoff
or recovery. Its dedicated runtime has no training history, saved best-brain
state or captured-presets collection. It stops after the race rather than
breeding map-based behavior into the neural population. Restart resets all
race metrics, and onboard attachment stays fixed when P1 changes during turns.
The regression suite now passes **81 tests**, and both the main page and the
experimental page build successfully.

Reproduction commands and protocol are in
[OFFLINE-EXPERIMENTS.md](../scripts/OFFLINE-EXPERIMENTS.md). Final raw reports
are `racing-line-final-20261020.json` and `racing-line-final-20261021.json` in
this task's visualization artifact directory; they include every sampled
parameter set, per-start result, rejection reason and planned path.
