---
name: capy3-number-and-first-frame
description: "Batch 6 of the Lift Pass — the live record line, the done-flag that freezes a record, and the arrival lens"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0656af9c-a9b9-4985-8982-a9141d1bf47f
  modified: 2026-08-26T17:20:44.735Z
---

Run 27 Aug 2026. `qa/BATCH6.md` carries the full log; this is what is worth carrying forward.

**The live record line is one channel, two verbs, and a watchdog.** `game.recordLive(id, value)`
every frame the attempt is open, `game.recordEnd(id)` when it closes. The watchdog
(`sysREC_STALE`, 1.6 s) is the load-bearing part: it makes "no attempt open" the resting state
of the mechanism instead of a promise nineteen chapters have to keep. Wired in **31 places
across 19 of 19 chapters**; `recText` already did all the formatting.

**FOUR WAYS A LIVE READOUT BECOMES HUD FURNITURE, all measured over a 60 s soak per chapter at
ten samples a second (605 samples):**

1. **The attempt opens itself.** The Pantanal cowbird lands on the animal two seconds after the
   spawn and rides for up to seventy — 60 of 60 samples standing still. Gating it on the animal
   moving only took it to 562 of 605. It got no line at all: *the line belongs to things a
   player goes and does.* It was on the brief's list and the brief was wrong about it.
2. **The trigger zone is most of the chapter.** Rio's `take-a-wave` and Manly's ride are `on`
   for any swim in the shore break: 187 and 310 of 605. A **two-metre floor** fixed both — on
   the sand, same sixty seconds, 0 of 603 with the animal wet for 145 of them. Every wired ride
   should borrow its floor from the figure the record itself already refuses below.
3. **A done-flag that freezes the record.** SIX measured runs stopped counting the moment their
   task ticked: `salsa-dance`, `samba-parade`, `selaron-steps`, `cart-run`, `the-floor` (five
   fixed) and the Quay's `manly-voyage` (correct — `onEnter` re-arms the whole voyage). **The
   task happens once; the counting does not stop.** A record that cannot be beaten is not a
   record, and records are the only reason to re-enter a finished chapter — so this defect is
   the one P4 exists to fix, one layer down. Iceland's glacier and Venice's passerelle are the
   right shape.
4. **A seeded save is wiped before you can read it.** `jrFileCount` is `jrFile.tasks.length`;
   with an empty task list the title card offers *begin*, and Enter then takes `startGame`'s
   non-restore branch, which calls `saveClear()`. Seed at least one task and enter through
   **carry on**. Cost one run reporting "no best yet" on a file with 28 bests in it. See
   [[headless-qa-harness]] traps 8 and 10 — this is the third member of that family.

**THE ARRIVAL WAS USING THE WALKING-ABOUT LENS, AND `yaw` ALONE FIXED ALMOST NOTHING.** Setting
the bearing on all nineteen spawns produced nineteen correct headings and nineteen pictures of
the ground: at `sysCAM_PITCH` (41 degrees down) against a 24 degree half-FOV the horizon is
seventeen degrees *above the top edge*, so the Opera House at 38 m, the Koutoubia at 52 and
Galeras at 104 were all out of frame while pointed straight at them. `sysARRIVE_PITCH` 0.28 rad
and `sysARRIVE_RAISE` 2.0 m, held by `frameShot` for `sysARRIVE_HOLD` — 0.55 in + 1.95 + 1.10
out = 3.60 s, which is `sysFADE_CARD` exactly, so the shot is over on the frame the card leaves.
`teleportCapy(sp, arrive)`: only an arrival composes: a stuck-rescue that pinned the lens would
be taking the camera away from a player who has just been stuck. See
[[capy3-visibility-metrics]] — the bearing was right and the picture was wrong, again.

**`camera.fov` IS THE VERTICAL ANGLE.** Half of 48 is 24, but the frame is 16:9, so the
horizontal half-angle is `atan(tan(fov/2) * aspect)` = **38.4 degrees**. A bearing separation
measured against 24 says "these two things cannot share a frame" about pairs that can. It cost
one wrong conclusion about Monte Carlo's Casino (28.5 degrees off the yacht, and in frame).

**A CAMERA BOOM HAS TO HAVE SOMEWHERE TO STAND.** Monte Carlo's quay carries a palm every 9.1 m
along z = −84.5, and the boom swings *south* of the animal for any bearing that looks across
the basin — so at the old spawn every candidate pose put the lens inside a crown, and one
screenshot is the inside of a palm tree. The fix was to move the spawn 20 m west onto a gap
(x = 10.15, 19.25, 28.35) and keep the heading. **Framing can be a position problem, not an
angle problem.**

**`placeCue` was used by four modules and imported by none.** `manly.js`, `antarctic.js`,
`palawan.js`, `pantanal.js`, twelve call sites. `build.mjs` concatenates everything into one
scope so `dist` resolves it and it has never been visible there; the unbundled path the dev
server serves throws a ReferenceError inside a biome update — see
[[capy3-module-drop-failure]]. Found by a soak, not by reading. **A name from `shared.js` is
only in scope in `dist`.** Worth grepping for other bare uses of shared exports.

Related: [[capy3-the-paper]], [[capy3-lens-and-wall]], [[capy3-the-picture]],
[[capy3-instruments-that-cannot-hold-a-line]]
