# Braking comparison: exported generation 11464

The saved champion was replayed over five laps from each of twenty solo grid
positions. Eight control policies were tested with existing physics, tire
barriers and retirement rules. No browser training or saved brain was changed.
The unchanged-controller wrapper reproduces the original controller exactly at
all twenty starts. This export is a historical checkpoint, not the current live
population shown in the generation-130322 screenshot.

| Policy | Finished | Without recovery | Mean five-lap race | Reference best lap |
| --- | ---: | ---: | ---: | ---: |
| Original | 20/20 | 20/20 | 57.388 s | 10.767 s |
| Brake capped at 90% | 20/20 | 20/20 | 57.746 s | 10.883 s |
| Brake capped at 75% | 20/20 | 0/20 | — | 12.733 s |
| Brake capped at 60% | 20/20 | 20/20 | 58.912 s | 11.133 s |
| Brake onset limited to 3 units/s | 0/20 | 0/20 | — | No completed lap |
| Brake onset limited to 6 units/s | 19/20 | 19/20 | — | 11.150 s |
| Brake onset limited to 12 units/s | 20/20 | 20/20 | 58.387 s | 11.050 s |
| 75% cap plus 6 units/s onset | 0/20 | 0/20 | — | 11.317 s |

The ramp limits the decrease of the signed pedal command per second; it retains
the source controller's throttle and brake-release decisions. It is not a fixed
time delay. Means are reported only when all twenty starts finish unassisted.
Reference best lap is from grid slot zero, including completed laps before any
subsequent retirement. Full results retain individual starts and assistance flags.

## Where the softer brake loses time

Four sharp bends were selected by centerline heading change, separated by at
least 160 world units. They are numbered by progress from the start; these are
diagnostic labels, not official turn numbers. Each measurement covers roughly
100 world units before and after the selected apex, at physics-tick resolution.
Each following mean uses 80 completed flying-lap passages (four per grid start).

| Bend progress | Original entry / minimum / exit | 90% cap entry / minimum / exit | Window time change |
| --- | --- | --- | ---: |
| 26.0% | 263 / 150 / 173 km/h | 267 / 152 / 175 km/h | −0.002 s |
| 58.3% | 262 / 135 / 236 km/h | 263 / 134 / 233 km/h | +0.014 s |
| 83.0% | 199 / 157 / 237 km/h | 209 / 155 / 235 km/h | +0.002 s |
| 88.3% | 237 / 157 / 205 km/h | 235 / 148 / 197 km/h | +0.023 s |

The original requests approximately full braking at every selected bend. With
the 90% cap, braking lasts longer at all four; at the final bend it increases
from 0.169 to 0.198 seconds and exit speed falls by about 8 km/h. Softer braking
does not automatically preserve more speed because the existing steering and
braking trigger points were learned together.

These window times do not sum to the full-race difference: they exclude other
track sections and the launch lap, and one window's exit affects the next section.
The 60% cap is worse overall despite slightly improving one measured window.

## Decision

None of these policies passes the pace and reliability gate. Keep the current
live controller. The next useful experiment is a coordinated racing-line and
speed plan that can brake earlier, release before turning, and select an apex
within track limits. These results do not prove that the champion's line is
optimal, nor that a retrained softer-braking policy cannot improve it.

Reproduce using `scripts/analyze-braking.js` and the generation-11464 export.
