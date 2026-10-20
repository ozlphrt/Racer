# Cornering and lookahead experiments

These offline experiments used the supplied Gen 11464 export on the Grand Prix
circuit with five-lap races, existing 60 Hz physics, tire barriers and retirement
rules. Browser saves and the live champion were not changed. The original-model
search tested 1,776 variant trials; none of its validated finalists beat the
10.7667-second fastest lap. Modest race-average improvements motivated a separate
lookahead prototype.

## Lookahead prototype

The offline 12-12-8-2 model adds lateral position, heading error and two upcoming
curvature inputs to the original rays and speed. Conversion preserves the old
weights and initializes new connections to zero. Three automated tests verify
exact policy preservation, bounded features and unchanged five-lap trajectories.

| Curvature horizon (world units) | Seed | Rounds | Variant trials |
|---|---:|---:|---:|
| 80, 180 | 11464 | 24 | 863 |
| 80, 180 | 2026 | 24 | 863 |
| 160, 320 | 389 | 12 | 432 |

Nine finalists from these 2,158 trials were rounded to five-decimal weights and
validated from all 20 solo grid positions. All nine finished 20/20 starts without
wrong-way or runoff recovery assistance. None passed the full promotion gate.

## Strongest race-average finalist

| Measure | Original champion | Prototype |
|---|---:|---:|
| Best lap across 20 starts | 10.7667s | 10.7667s |
| Mean five-lap race across 20 starts | 57.3883s | 57.1800s |
| Starts finished without recovery | 20/20 | 20/20 |
| Mean flying lap, reference grid slot | 10.8375s | 10.7792s |
| Time above 90% brake per flying lap, reference slot | 0.7833s | 0.7208s |

The prototype saves 0.2083 seconds per race on average (about 0.36%) and spends
about 8% less time at near-full brake in the reference-slot test. Its fastest lap
does not improve, and some starting positions regress. Switching off all four
added inputs while retaining this finalist's weights restores the reference-slot
mean flying lap to 10.8375 seconds and hard-braking duration to 0.7833 seconds.
This supports a contribution from the added inputs as a group, but does not
isolate curvature preview or demonstrate a better wide-entry/apex/exit line.

Promotion requires a faster reference best lap, faster mean full-race time,
twenty unassisted finishes and no flying-pace regression over 0.005 seconds in
any tested grid position. No candidate met all requirements. The live app keeps
its existing model, saved champions and captured milestones. The separate
prototype format is explicitly marked incompatible with the live brain loader.

These finite searches do not establish a physical lap-time ceiling. Results
cover this circuit and solo-start configuration, not traffic or unseen tracks.
See [reproduction instructions](../scripts/OFFLINE-EXPERIMENTS.md).
