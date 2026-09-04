# The physics pass — the floor, the walls, and the forces

Written 4 Sep 2026, after the player reported two things: *"some structures or
objects you can walk through that should be solid"*, and *"sometimes the
capybara sinks a bit too much into terrain"*. This review took both literally
and swept the whole physical layer behind them — ground contact, colliders,
surfaces, external forces, bodies, carriers, camera and controls.

Five read-only audits ran against the live dev server, four of them with real
keyboard events under `playwright-cli`. Their raw findings are in the scratchpad
files named at the foot of this document; every number below cites the probe
that produced it. Line numbers move between batches, so each row carries a
symbol name as well.

**The headline: neither complaint is one bug, and neither is the bug you would
guess.** The animal does not sink into terrain because the contact solver lets
it — that was measured and the steady-state penetration is 70 micrometres. It
sinks because *three separate render-side and lattice-side errors add up*, and
because on a slow frame the landing spring is numerically unstable and swings
the drawn animal 0.76 m peak to peak. And the walk-through structures are not
the ones a screenshot would suggest: the worst confirmed case is **people**, not
buildings — every local who has walked away from their spawn point is
walk-through until they return.

---

## Four numbers first

**1. Nothing penetrates. The contact model is clean.** Body mass 30, three
spheres of r 0.34, gravity −24, `contactEquationStiffness` 1e7. Static
penetration is m·g/k = 7 × 10⁻⁵ m, and the walk probe reads body y = 0.340 on
flat ground to three decimal places in every chapter. **Every visible sink is
render-side or a collider-versus-picture disagreement.** This closes off the
most expensive possible fix before anyone starts.

**2. The landing spring is unstable below 13.5 fps, and the drawn animal swings
0.76 m.** `capyLandVel += (−capyLand·capyLAND_K − capyLandVel·capyLAND_C)·dt`
(capybara.js, next to `capyLAND_K`) is semi-implicit Euler with the raw frame
dt and no sub-stepping, while the pop spring beside it *is* sub-stepped. With
c = 27 the damping term flips sign for dt > 2/c = 0.074 s and grows 1.7× per
step. `game.tick` clamps dt at 0.1 s, so it rings rather than exploding. In the
pose probe, which ran at rdt 0.1, the model's local Y alternates between −0.05
and −0.81 in nine chapters:

| chapter | model Y, alternate frames | soles vs drawn ground |
|---|---|---|
| göreme | −0.23 / −0.81 | +0.27 / −0.24 |
| pasto | −0.23 / −0.81 | +0.21 / −0.35 |
| antarctic | −0.19 / −0.77 | +0.27 / −0.34 |
| rio | −0.17 / −0.73 | +0.24 / −0.30 |
| cali | −0.10 / −0.69 | +0.30 / −0.33 |

A player never sees 10 fps steadily, but they see it during a chapter load, a
shader compile, a tab return, or on a weak laptop — and this is what "sinks a
bit too much into terrain" looks like when it happens. Five lines to fix.

**3. Six chapters draw the ground on one lattice and collide it on another.**
`PlaneGeometry(X1−X0, Z1−Z0, NX, NZ)` steps `(X1−X0)/NX`, which equals the
`CANNON.Heightfield` element size only when the span divides by it. Integrity
block 10 fixed the cave and Monaco and left the rest; this review measured the
whole set, and **two chapters the earlier note recorded as dividing exactly do
not**:

| chapter | drawn step (x, z) | heightfield EL | walkable ground over 15 cm | of which the picture is ABOVE (= sink) |
|---|---|---|---|---|
| rio | 5.00, 4.714 | 5 | 4.8 % | 3.9 % |
| kyoto | 3.70, 4.26 | 5 | 3.9 % | 3.5 % |
| pantanal | 3.00, 2.99 | 4 | 4.1 % | 3.5 % |
| manly | 2.495, 2.494 | 4 | 5.1 % | 1.1 % |
| iceland | 5.35, 4.13 | 5 | 2.4 % | 0.3 % |
| antarctic | 4.00, 4.00 | 5 | 3.0 % | 0.7 % |
| cali | 4.375, 4.20 | 5 | 2.9 % | 0.1 % |
| göreme | 3.20, 3.20 | 5 | 1.0 % | 0.6 % |

The sign is the whole story: in every relief chapter the picture is above the
collider far more often than below it. A finer picture over a coarser collider
cuts the chord under every crest, so the animal reads as sunk on rises and never
as floating. And on a slope the pose then drops the model a further 0.25 m
(30°) to 0.31 m (35°) — computed from the analytic law, not from the facet the
body is actually resting on, **so the two errors add**.

**4. Twenty metres of invisible floor at the edge of two chapters.** Kowloon
draws its ground to z = 100 and collides it to z = 120; Cali draws to z = 150
and collides to 170, and `boundsOf` runs to 221. You can walk out past the last
thing that is drawn and stand on nothing visible. This is also what made the
lattice instrument report Kowloon at −15.7 m mean error: 12.4 % of its samples
are in that strip, and it is not a lattice number at all.

---

## The seven areas

### 1. The floor disagrees with the picture
Numbers 2, 3 and 4 above, plus: `capyGroundY` answers with the biome's analytic
`terrainHeight` (the law), while the body rests on the heightfield facet and the
player looks at the drawn mesh. Three surfaces, three answers, and every
consumer picks a different one. The pose reads the law, the stuck-rescue
measures against the law, the camera and the shadow use the law, and the animal
stands on the facet.

### 2. Things you can walk through
The chest-height ray differential (drawn hit, no physics hit within 2.5 m,
height ≥ 1.6 m, origins inside a collider skipped) leaves a residue that is
mostly instanced vegetation, which is deliberate. What is left after
classification is small and specific — see batch X5. The highest-count
non-vegetation hits are Kowloon at (±5, −65), a Venice block at x −77…−37, the
Göreme town mesh, three Sahara meshes, `palBeach`, and two Cali structures.
Separately, **ten Göreme cliff samples are "recessed"**: the drawn face is at
0.95 m and the collider at 2.30 m, so you walk 1.35 m into a cliff before it
stops you.

### 3. People are not solid, and it is one line
`addLocal` (npc.js) builds each talking local as a `CANNON.Body` with mass 0 and
**no `type`**, which cannon defaults to STATIC. The shuffle and prop-retrieval
code then moves them by writing `body.position` directly. In cannon-es,
`aabbNeedsUpdate` is raised only inside `Body.integrate`, and `integrate` returns
early for a static body — so **a local that has moved keeps its spawn-point AABB
for ever**, and the SAP broadphase never generates a contact pair anywhere else.
Measured: a Hanoi local in the `own` state let the animal pass clean through
(closest approach 0.24 m, animal 0.88 m out the far side) while every stationary
local in the same chapter stopped it at 0.60–0.92 m. Retrieval sends them up to
9 m from spawn.

### 4. Surfaces lie about their own physics
Three confirmed, all in the force layer, all with measured tables in batch X4:
slip is a **speed multiplier in every direction** including uphill (sprint 19.6
m/s up an 18° glacier, 19 m/s across blue ice, and snow at slip 0.18 makes the
animal 30 % faster than paving); `launch()` does not spend the coyote window, so
the grip damper deletes the horizontal component of every geyser, cable and
throw within seven frames; and the sandstorm's continuous `shove` compounds in
the air, so a standing hop in the storm lands 22 m downwind at 23 m/s.

### 5. The rescues fire wrongly, or not at all
The stuck-rescue asks whether the body is more than `capySTUCK_GAP` 0.22 m below
**the law** and has moved less than `capySTUCK_MOVE` 0.05 m vertically for 0.45
s. Both halves are wrong in a measured case each. On the Uji bank in Kyoto the
lattice puts the law 0.37 m above the collider on walkable ground, so the
detector fires every 0.45 s while you walk, teleporting the animal up and then
1.4–2.5 m sideways. On the Pasto plaza platform the animal is ejected *under* a
17 × 15 m static box and walks 9 m beneath the cobbles — and the detector never
fires, because the contact-versus-backstop limit cycle moves the body 0.13 m
per frame pair, which resets the "not moving" timer every frame.

### 6. Camera and controls
The measured control sweep covers all nineteen chapters and most controls answer
everywhere. The exceptions worth acting on: **the flight rig is gated on Pasto
alone** (`inPasto && game.condor && game.condor.mounted`, systems.js) while
`condorHost()` accepts any chapter publishing `thermals`, and Rio publishes them
— so riding the condor in Rio uses the ground rig on a bird doing 20 m/s. In a
Venice alley the boom compresses to 2.32 m with a clear fraction of 0.19. Rio's
V eye-raise does nothing at all at arrival because the arrival lens owns the
pitch. And V has no gamepad or touch binding anywhere.

### 7. Instruments that mislead
Recorded so the next pass does not pay for them again. `qa/px-ground-b3.js`
reports Kowloon and Cali as catastrophic lattice failures when both numbers are
the invisible-floor strips of area 1. The `±0.30` alternation in every sole
measurement is the landing spring of number 2, not a picture of the ground. And
`audit-solid.js` still moves ±5 between runs unless the clock is pinned.

---

## The batches

Each 2–3 h, one commit, verified with the headless harness and judged from
rendered PNGs as well as numbers. Ordered by what the player feels first per
hour spent. X1, X3 and X4 are the ones that answer the original report.

### Batch X1 — the drawn animal stops swinging (area 1)

**Must land.**
1. Sub-step the landing spring exactly as the pop spring beside it is
   sub-stepped: fixed 1/120 s inner steps, remainder carried. Model-only, so
   nothing about physics, tasks or ledges can move.
2. Audit the other explicit-Euler render springs in the same block for the same
   stability limit (`capyPop`/`capyPopVel` is already safe; check the ear lag,
   the idle crouch, the loaf drop and the slide drop).
3. Clamp `rawDt` for the render springs specifically at 0.05 s even though
   `game.tick` allows 0.1: a hitch should freeze the pose, never ring it.

**Verify.** Re-run `qa/px-ground-pose.js` at rdt 0.1 in the same nine chapters.
The model Y alternation must collapse from 0.76 m peak to peak to under 0.05 m,
and the soles must stop crossing the drawn ground. Then run it again at 60 Hz
and confirm apex, airtime and the landing dip are unchanged — `qa/mv-feel.js`
must still read 1.37 m / 0.717 s in seventeen chapters and Drift 4.51 / 2.083.

**Trap.** The landing dip is a *feature* at healthy frame rates and the fix must
not flatten it. Measure the dip depth after a 2 m drop at 60 Hz before and
after; it should stay at about 0.155 m.

**LANDED 4 Sep 2026, and the trap fired the other way round.** Differential on
`qa/px-spring.js`, same 2 m drop, identical −9.56 m/s landing velocity in both
runs: the 60 fps dip went from 0.085 m to **0.132 m**. It did not flatten, it
DEEPENED — the old single step was losing a third of the squash to integration
error, and 0.132 is what `capyLAND_SCALE` has been asking for all along. Kept,
deliberately: every landing in the game is now visibly deeper, and the one-line
undo if that is ever regretted is `capyLAND_SCALE` 0.022 → 0.0142.

The stability result, which is the point of the batch: at 12 and 10 fps the old
spring sat in a permanent limit cycle against its own clamp
(`+0.096, −0.300, +0.096, −0.300 …`, 20 and 17 zero crossings, never settling);
after, it decays monotonically to zero with no crossings and never touches the
clamp at any of 60, 20, 12 or 10 fps. Nine chapters, twelve targets: mean
model-Y swing 0.477 m → 0.056 m, worst 0.811 → 0.121. Iceland is the row that
proves it is not a quieter machine — its after run was SLOWER (rdt 0.100 vs
0.096) and its swing still fell tenfold.

Item 2 resolved by inspection: only two channels in the animal hand-roll an
integrator and both are now sub-stepped; everything else goes through `damp()`,
which is `1 − exp(−λ·dt)` and unconditionally stable. `npc.js`'s flinch spring
(k 34, c 11.7) has a limit of 0.171 s against a worst frame of 0.1 and is fine.
Item 3 was dropped rather than built: the time scale never exceeds 1
(`main.js`) and the frame is already clamped at 0.1, so the sub-step bounds the
inner step at 0.0125 s on its own. A second clamp would only change how a hitch
looks, which is a design choice with no defect behind it.

**And what it does not fix.** Four of the twelve targets got WORSE in the
worst-sole column (pasto slope −0.637 → −0.803, manly −0.382 → −0.708) while
six improved sharply (cali −0.334 → −0.035, rio −0.369 → −0.074). The
oscillation had been half-cancelling a steady sink that is still there. That
residue is real and it belongs to X2 and X3.

### Batch X2 — the ground ends where the picture does (area 1)

**REWRITTEN 4 Sep 2026, after reading all eight chapters.** The original batch
said to copy integrity block 10's "one lattice" fix to eight chapters. That
instruction was wrong, and building it as written would have damaged three
chapters and paid for nothing in the other five. What was actually there:

**Three of the eight warp their ground on purpose and can never share a
lattice.** Rio, Iceland and Göreme push their vertices through a warp function
(`rioWarp`, `iceWarp`, `gorWarp`) to spend triangles where the chapter happens
— Rio's note says 11 200 triangles instead of 17 200, and ~2.4 m cells through
the beach and the avenue instead of 4.0. A `CANNON.Heightfield` is uniform by
construction. There is no lattice these two can share, at any element size.

**The other five are not block 10's bug.** Block 10's defect was a span that
did not divide by its own *intended* element size — one lattice, wrongly
computed. Here the picture is drawn at 2.5–4.3 m and the collider built at
4–5 m *deliberately*, and both sample the same analytic terrain function. The
disagreement is interpolation error between two honest approximations at
different resolutions. Closing it means either a visibly coarser picture or
1.7–2.6× the collision cells (kyoto 9 936 vs 5 984, manly 9 265 vs 3 604).
That is a cost/quality trade to be decided on its merits, not a defect to fix.

**What IS a bug is the extents, and one was worse than this review knew.**
Measured live with `qa/px-extent.js`, which tests both failure modes per
chapter:

| chapter | picture | collider | fault |
|---|---|---|---|
| kyoto | z −230..230 | z −230..**210** | 20 × 340 m of drawn ground with NO collider |
| cali | z −220..**150** | z −220..170 | 20 × 420 m of invisible floor |
| kowloon | z −220..**100** | z −220..120 | 20 × 300 m of invisible floor |
| göreme | x −**140**..180, z −**190**..130 | x −160..180, z −200..130 | 20 m west + 10 m south of invisible floor |
| antarctic | x −212..212 | x −212..**213** | a 1 m sliver; left alone |

**LANDED.** Kyoto's collider extended to cover its picture (`NZ` 88 → 92);
Cali's, Kowloon's and Göreme's pictures extended to cover their colliders.
Extending rather than trimming was the call, because trimming turns standable
ground into void unless the world bounds move with it, and 14 chapters publish
no `bounds()` at all. Göreme needed its warp halves moved with the extent
(160 → 170/165): `gorWarp` maps [−half, +half] onto itself, so leaving the
half alone collapses every new vertex onto the old edge.

**Still open, and now correctly sized.**
1. The resolution trade above. Needs a frame-cost measurement before it is
   worth anyone's opinion. Rio, Iceland and Göreme are excluded by construction.
2. `capyGroundY` answers with the analytic law while the body rests on the
   heightfield facet and the player looks at the drawn mesh — three surfaces,
   three answers. X3 depends on which one the rescues should trust; do that
   thinking there, not here.

**Verify.** `qa/px-extent.js` must report zero non-ok rows outside
Antarctica's sliver. `qa/px-ground-b3.js` in all nineteen: Kowloon's mean
signed error must move off −15.7 m, which was never a lattice number — it was
a ray falling past the edge of the picture onto the harbour skirt 177 m down.

**Trap, and it cost two runs here.** `qa/px-extent.js` lied in both directions
before its control points caught it. A ray from above hits the world-edge
skirt at −141 m and reads as "the picture is there"; filtering to hits near the
law then reads the *topmost* hit, which is whatever scenery stands on the
ground, and declares the centre of Göreme undrawn because a fairy chimney is
16.7 m up. Test the whole column and ask whether ANY hit is near the law. Put a
control point in the middle of every chapter or you will not know.

**Second trap.** The residue after all this is triangulation — `PlaneGeometry`
and `CANNON.Heightfield` split each quad on opposite diagonals, which on a cell
that rises as much as it is wide differs by metres. It only matters on cliffs,
where nothing stands. Do not chase it, and do not "fix" it by shrinking EL.

### Batch X3 — the rescues measure the right thing (area 5)

**Must land.**
1. The stuck detector's "not moving" test reads a low-pass of body Y, or the
   minimum gap over the window, instead of the frame-to-frame delta. This alone
   catches the Pasto plaza case.
2. The "how far under the floor" test judges against the collider — a short
   downward ray, or the live contact set — not against the analytic law. This
   alone stops the Uji bank teleport loop.
3. Interim belt and braces if (2) runs long: raise `capySTUCK_GAP` above the
   worst lattice error on walkable ground, which after X2 should be under 0.15 m.

**Verify.** Walk the Uji bank leg in Kyoto (x −26…−22, z 116) for 20 s: zero
teleports, and body Y continuous. Walk the Pasto plaza box from its lip: the
animal must not end up under the cobbles, and if it does the rescue must fire
inside 1 s. Then run `qa/fuzz.js` in all nineteen and confirm the rescue count
has not gone up anywhere else.

**Trap.** The rescue must keep moving the animal sideways as well as up —
straight up is back inside the thing that ejected it, and `makeSolidIndex`
deliberately reports a deck as not blocked.

### Batch X4 — slip, launch and the storm (area 4)

**Must land.**
1. **Slip stops being an accelerator.** Keep the speed *cap* widened by slip so
   a slide stays a slide, but leave the steering *target* at `topSpeed`, and
   make the along-stick steer one-sided while slip is live: if the velocity
   along the stick already exceeds `topSpeed`, steer only the lateral component
   and never pull the along-stick speed down. Re-enable the Tobler grade block
   on slip, at minimum uphill.
2. **`launch()` spends the coyote window** — one line, `capyAirTime =
   capyCOYOTE`, which the jump block already does and launch forgot. This is why
   everyone comes off Strokkur going perfectly straight up.
3. **The storm becomes a frame in the air.** While not effectively grounded, do
   not add `capyShove` to the velocity at all; express the sandstorm as a frame
   the way the Drift's `wind()` already does. On the ground, apply the shove
   before the grip damper so standing and walking meet the same opposition, then
   re-tune `sahWIND_F` down from 6.2.

**Verify.** A table per surface with the same held key: ice, snow, marble, dune,
wet paving and dry paving, walk and run. Nothing may exceed dry-paving speed on
the flat, and the Iceland glacier must stop being climbable at a sprint. Geyser:
launch 2.5 m off the vent and the landing drift must be about 2.6 m, not 0.04.
Storm: standing drift ≤ 1.5 m/s, hop ≤ 6 m. Regression gate is
`qa/tune-verify.js` — peak airborne speed over takeoff speed must stay in
1.0–1.4 in all nineteen.

**Trap.** The Sahara dune surf is tuned on `sahSURF_SLIP` 0.72 and the Iceland
slide is a designed set piece; both will move. Re-measure and re-tune them in
this batch rather than discovering it in the next.

### Batch X5 — the walls (area 2)

**Must land.**
1. Walk-confirm each candidate before fixing it — real keyboard events into the
   drawn face, because a ray differential is evidence and not proof, and the
   confirmation pass is the half of this audit that the session limit ate.
2. Collide the confirmed set. Named candidates, strongest first: Kowloon (±5,
   −65), h 4.1, mesh bounds x −11…12 / z −157…−53, colour #a1834a, hit from both
   sides at 0.77 m; the Venice block at x −77…−37 / z −56…4, five hits from 2.8
   to 15.1 m; Göreme's town mesh (28 hits) and `gorValley` (10); three Sahara
   meshes; `palBeach`; two Cali structures.
3. The Göreme cliff recess: ten samples where the drawn face is 1.35 m outside
   the collider. Fit the collider to the face.

**Trap.** Read the helper before adding a call — the extents convention is per
module and it is not the same one. `envStaticBox`, `quayStaticBox`,
`kyoStaticBox`, `caliStaticBox` and `manPoolBox`/`panPoolBox` take HALF extents;
`antStaticBox`, `cavStaticBox`, `driStaticBox`, `gorStaticBox`, `iceStaticBox`,
`hkStaticBox`, `monStaticBox`, `palStaticBox`, `rioStaticBox`, `sahStaticBox`,
`venStaticBox`, `hanPoolBox` and **`manStaticBox`/`panStaticBox`** take FULL.
Manly and Pantanal are mixed files and are where this will bite.

### Batch X6 — people are solid (area 3)

**Must land.**
1. Set `r.body.aabbNeedsUpdate = true` after each of the three position writes
   in the local shuffle and retrieval path. One line each, zero behaviour change,
   and it fixes every chapter at once. (The alternative — making locals
   KINEMATIC — also works but then they shove the animal like walkers do and
   need the `npcPlaceBody` hold-off too; prefer the flag.)
2. Sweep for the same defect anywhere else a static body is repositioned:
   `grep` for `body.position` writes on bodies created without a `type`.
3. The crowd figures with no bodies at all: Quay's crowd and pax, Kyoto's tea
   pickers, Cali's dancers and watchers, Rio's pavement crowd, Sahara's people
   and pursuers, Göreme's tea drinkers, Manly's counter staff and diners,
   Venice's crowd, Monaco's watchers. Decide *once* whether a background figure
   is solid, write it in the contract, and apply it. They are currently solid in
   Sydney and Pasto and drawn-only everywhere else, which is the worst of both.

**Verify.** The walk-into-a-person probe in six chapters, before and after: a
local in the `own` state must stop the animal at the same distance as a
stationary one. Then a 60 s NPC soak per chapter for regressions — nobody newly
stuck on their own furniture.

### Batch X7 — the rig follows the bird (area 6)

**Must land.**
1. Replace `inPasto && game.condor.mounted` with a host test that asks the same
   question `condorHost()` does, so Rio's condor gets the flight rig. Check
   `agl` and the shadow-box height on the same line — they carry the same
   `inPasto` assumption.
2. The Venice alley boom: clear fraction 0.19 at 2.32 m. Decide whether the
   minimum boom of 1.9 m is honest in a 3 m calle, or whether the rig should
   rise instead of closing.
3. Bind V (eye raise) to the pad and to touch. It is keyboard-only today, and it
   is the control the player named.
4. Measure before fixing: Antarctica's spawn walk of 1.76 m/s and run of 3.11,
   Monaco's run of 3.62, Cali's run of 4.94, and Hanoi's silent wheek. Each is a
   single anomalous row in the sweep and each could be an obstruction at the
   spawn rather than a bug. Do not fix any of them until it reproduces away from
   the spawn point.

---

## The shelf — sized, not scheduled

- **`slopeAt` has seventeen publishers and no runtime consumer.** Either delete
  it or have the animal and the NPCs read it instead of differencing
  `terrainHeight`. 1 h either way.
- **`localWater` gate asymmetry.** props and weather ask `waterHeightAt`
  unconditionally; the animal only asks when the biome also sets the
  `localWater` flag. Harmless today because every non-flag biome returns its
  waterLevel, and a trap for the fourth chapter that adds a swell. 0.5 h.
- **Monaco's cars reach 26.5 m/s and the carry frame is clamped at
  `capyPLAT_VMAX` 12.** Ride one and find out. 1 h.
- **`physRUB_G` is a constant 24**, so rubble particles fall at 1 g in the
  Drift's 0.36 g. Cosmetic. 0.2 h.
- **`manFlowAt` scales its wave push by the capybara's dive depth**, and
  `physFlowAt` calls the same hook — so a floating thong loses its shoreward
  push whenever the player goes under. Pass depth as a third argument from the
  animal only. 0.2 h.
- **Velocity-only kinematic carriers** drift at refresh rates other than 60 Hz,
  because cannon integrates them for `STEP` per substep and the velocity is
  derived from the frame `dt`. The carriers that also write `position.set` every
  frame are self-correcting; enumerate the ones that do not. 0.5 h each.
- **Sydney's ferries, Quay's moored yachts and the bridge traffic** are drawn
  and not solid. All are on water or on a deck whose reachability is unproven.
  Confirm reachability first; collide only what a player can reach.

## Already clean, so not touched

The contact solver and every contact material. The fixed timestep and its
substep cap — under a long hitch the world runs slow rather than tunnelling.
`mainSaneWorld`'s NaN repair and the 90 m/s clamp. Gravity swapping in and out
of the Drift, measured at all four apex and airtime figures. Sydney, Iceland,
Manly and Hanoi have zero walk-through candidates at chest height. The cave's
ground lattice, fixed in integrity block 10 and still clean. Hop, run, slide,
wheek, grab, recentre and the Z/X yaw answer in all nineteen chapters. The
kinematic carriers that difference their target rather than their own position,
which is now all of them.

## Instruments this review leaves behind

- `qa/px-solid-audit.js` — the chest-height ray differential, per chapter, with
  a named-object rollup. Run tag A (h ≥ 1.6) is the clean instrument; tag B
  (h ≥ 0.7) is noisier and catches kerbs.
- `qa/px-ground-b3.js` — drawn ground versus heightfield, per chapter, with the
  live tile geometry. Read its two known artefacts in area 7 before believing a
  large number.
- `qa/px-ground-pose.js` — the pose separator: body Y, facet, law, drawn ground,
  model offset, pitch, roll and four sole clearances in one row. This is the
  instrument that found the landing-spring ring.
- `qa/px-cam-controls-a.js` / `-b.js` — every control in all nineteen chapters
  with camera pitch, height, distance and clear fraction before and after V.
  Results in `qa/px-controls-a.json.png` / `-b`; `qa/sum-controls.js` condenses
  them to the verdict table and the anomaly list.
- `qa/px-cam-walls.js` — camera occlusion on six wall legs per chapter.
  `qa/px-cam-fly.js`, `qa/px-cam-ride.js`, `qa/px-cam-water.js` cover the other
  three rigs.
- `qa/px-npc-walk.js` — walk into a person, with their state machine logged.
- `qa/surf-a.js` … `surf-c.js` — the force-channel probes behind batch X4's
  tables: slip speed per surface, the geyser launch, the storm.

The five findings files this review produced are in `qa/audit-2026-09-04/`.

## What this review did not finish

Said plainly, because the next pass should not assume otherwise. The
walk-into-the-face confirmation for the batch X5 candidates never ran — the
page timed out and the session ended. The camera audit produced its code
inventory and its wall probe but never its write-up, so its findings here are
drawn from the raw probe output rather than from an analysed table. And no
chapter was played end to end by a person; everything above is instrumented.
