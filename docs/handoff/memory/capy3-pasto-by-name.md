---
name: capy3-pasto-by-name
description: "X7 — the three lines that hardcoded Pasto, and the clamp that was applied to a point nobody renders from"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1cd09aae-9ae1-4c12-8402-6022ae8c2dc8
  modified: 2026-09-04T14:03:18.286Z
---

Batch X7 of ROADMAP-PHYSICS.md, landed 4 Sep 2026. Three lessons that generalise past the
batch.

**A `game.<chapter>` read is a bug the day a second chapter does the thing.** condor.js was
made chapter-neutral long ago (`condorHost()` — a chapter hosts a flier by publishing
`thermals`), and systems.js was NOT: `inPasto && game.condor.mounted` gated the flight rig,
`inPasto ? p.y - groundY` gated the uncapped altitude that the shadow box AND the altimeter are
both read off, and `thermalAt` read `game.pasto.thermals` for the THERMAL lamp. So Rio's
fragata — same 2,500 lines of aerodynamics — flew a 20 m/s glide behind the WALKING rig with
the flight panel never shown and the altitude pegged at the 26 m relief cap. **Fixing the
module that owns a mechanic does not fix the module that draws it.** When a chapter-neutral
contract lands, grep the CONSUMERS for the old chapter's name, not just the producer.
The fix: condor.js publishes `hosted()` — a predicate, not the host object.

**A clamp applied to where the eye WANTS to be is not applied to the eye.** `sysCamClear` cuts
the boom on `sysDesired`, instantly and deliberately ("a frame spent inside a wall is a frame
the player cannot play") — and then `sysDesired` is handed to a lambda-7 spring that takes a
third of a second to get there. Measured in the San Marco arcade: the cut asked for 1.87 m of
boom, the rendered eye sat at 3.37 with a column 0.14 m in front of the lens, and `camInfo.clear`
read 0.18 the whole time. **The instrument reported a feature that was working while the picture
showed one that was not.** systems.js already had this exact bug once and fixed it once — the
`lift2` relief clamp forty lines below exists for the same reason and its comment says so.
Fix: a radial clamp under the spring (bearing may lag; radius may not), damped at
`sysCAM_CUT_LAMBDA` 12 rather than snapped — a hard clamp moved the Kowloon boom 8.54 m between
two 33 ms samples, which is a cut and not a camera. Occluded frames 6/28 → 1/28.

**Every button on a standard pad was already taken, and the free gesture is a HOLD.** A/B/X/Y,
both bumpers, both triggers, both stick clicks, Start, Back and the whole d-pad are spoken for
in this game. The eye-raise went on R3's hold, with the recentre still firing on the press edge
(a recentre is a reflex; it may not wait 0.2 s to learn whether the thumb is staying down) —
the same tap-and-hold shape the Back button already carries. Three voices, one `eyeAsk` channel,
never a second rig.

**And the right-hand touch column does not survive landscape.** Chart (124 px) + three 58 px
buttons + gaps = 300 px of a 390 px screen, and the WHEEK is 96 px at `bottom:26px`, so MENU has
been sitting on top of the wheek at 844×390 since R5. Below `max-height:520px` the column is a
ROW along the top edge, left of the chart. **Measure a new HUD element in BOTH orientations —
the portrait layout has height and no width and the landscape one is the other case.**

Also from X7: all four "control anomalies" the audit flagged were false. Antarctica's 1.76 walk
and 3.11 run are `capyGRADE_MIN` 0.42 exactly (4.2 × 0.42 = 1.764) on a 20° slope, and it runs
8.20 across the contour. See [[capy3-instruments-that-cannot-hold-a-line]] for the two suites
that produced the other three.

Related: [[capy3-the-second-flier]], [[capy3-lens-and-wall]], [[capy3-the-thumb]],
[[capy3-physics-review]], [[headless-qa-harness]]
