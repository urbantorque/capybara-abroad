# ROADMAP-PAGES — master and public browser

Requested 22 September 2026 after the REIMAGINE playtest.

## Scope

- Audit every local/remote branch for valuable changes missing from redesign.
- Preserve the authored reflections, prove their visible contribution, and
  explain the existing auto/pretty/fast quality trade-off in Settings.
- Investigate the Monaco speed warning without weakening the fuzz gate.
- Build/test, merge into master, push, verify the Pages artifact and play it
  in a real browser at the public HTTPS URL.

No new save fields, visual terms, audio terms or performance flags.

## Branch decisions

`master`, `lift-pass`, `depth-tier1` and the remaining historical worktree
branch are ancestors of `codex/redesign-delight`: all their features survive.
The only unique commit is `score-w2-wip`'s `befaf28`. Its shallower sidechain
and removal of walking pad attenuation are already implemented in REIMAGINE.
Do not import its unfinished 1.7x pad boost over the measured foreground mix.

Original planar reflections (`1093169`) are already in both master and
redesign. The later underwater mirror (`c688914`) and rain-gated street
reflection (`06cbb58`) reach master through this integration. No reflection
code was removed by REIMAGINE. The existing governor parks the pass above
rung zero; Pretty pins zero. Settings now names that trade-off explicitly.

## Narrow Monaco repair

The proximity safety clamp activated at car speed +2 but wrote car speed +4.
That accelerated an animal inside that interval. Its trigger now matches
the unchanged +4 ceiling; 16 source-extracted scenarios, 88 checks prove
non-acceleration, preserved direction/vertical velocity, range and labels.
This independently proven bug does not establish the cause of the older
33.1975 m/s fuzz peak. Keep that failure and the unchanged 30 m/s gate.

## Evidence

Local headful Edge, real GPU, 1280x760: all 12 browser assertions pass.
Real controls move the animal and select Pretty/Fast, audio context runs,
score pad and scheduled notes are present, Kyoto/Hanoi arrivals work, and
Hanoi chapter plus Pretty preference survive reload. No console/runtime
errors or failed requests. This is technical audio proof, not a listening
review or an end-to-end earned journey.

Kyoto's staged photographic pose uses the existing wow-reflect fixture.
Frozen-camera masked hide-and-diff: 191,473 water pixels, 171,749 changed by
at least 12 levels; mean maximum-channel difference 34.19. Screenshot read
by eye: pavilion, trees and red structure visibly mirrored across the pond.
Fast parks the mirror at rung 3. Auto happened to remain rung 0 in this run;
the player's earlier missing-reflection cause cannot be inferred from that.

Focused post-fix Monaco inherited fuzz: 45 seconds, pass, peak 15.1 m/s,
zero NaN/void/runtime errors, two solver recoveries (within inherited gate).
This run did not reproduce the historical 33.1975 m/s contact sequence.
Public deployment and hosted verification pending.
