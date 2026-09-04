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

**Three more, measured in X7.**

`px-cam-walls.js` **does not hold a line and cannot resolve a camera change.**
Run twice against builds differing by one clamp, its aggregate over six chapters
moved `occ` 108 → 127 and `inside` 28 → 16 — and on the legs where the boom was
never cut at all, where the change under test provably cannot act, `occ` moved
78 → 92 and `inside` 15 → 4. The animal walks a different distance each run and
ends up beside a different wall. Use it to FIND a bad leg; use a pinned-position
probe like `qa/px-boom.js` to measure one.

`px-cam-controls`'s **`wheek?`, `slide`, `walk` and `run` columns are all
spawn-local and all move between runs.** Between two runs of the same build:
cali run 4.94 → 1.37, antarctic run 3.11 → 5.11, pasto's "dead" X yaw −0.17 →
−1.83, and five chapters swapped in and out of "SLIDE did not fire". Its stable
columns are the V block, `clearMin` and `err`.

**And the sfx window is four.** `row.wheek = sfx.slice(-4)` reads as "this
chapter's wheek is silent" in any chapter with a busy ambience. It cost X7 a
probe to disprove in Hanoi. Log the whole list and search it.

**Four more from X8, and these are the batch's OWN probes, caught before they were believed.**

**A digit key only travels from the TITLE CARD.** Pressed in a running game it does
nothing at all, so a probe that does one `page.goto` and then loops over nineteen
keys measures Sydney nineteen times. The first `px-carriers.js` run did exactly
that and it looked plausible — 43 kinematic bodies, sensible counts, small
variation between "chapters". The only reason it was caught is that the probe
reports `biome` in every row, which is the rule area 7 already had. **Reload per
chapter (`px-anom.js`'s shape), and assert the biome.** `g.biome.switchTo(name)`
is the faster alternative, and `px-npc-walk.js` uses it.

**The extra-chapter key table is off by one from the obvious guess.**
`sysPICK_EXTRA` maps Minus → 11, Equal → 12, and so on, so **Hong Kong is Minus
and Palawan is Equal**; Antarctica is Comma, Monte Carlo Period, Hanoi Slash,
Manly BracketRight. `px-hk-awn.js` was keyed `Equal` on its first run and
reported a clean camera — truthfully, about Palawan.

**A probe that samples two different objects gives an answer that is not merely
wrong but meaningless.** The first `px-hitch.js` compared `lap()` — the ridden
car's route position, which WRAPS at the lap length — against a body it had
separately picked as "the fastest kinematic one", which need not be the same car.
It reported a shortfall of −6.997 m on a run with no stall in it. Rewritten to
hold ONE body and compare commanded travel against actual travel, it reads
0.203 and −0.129 on clean runs. **Prefer an estimator whose null result is
forced by its own arithmetic.**

**`navBlocked` is the wrong instrument for anything floating.**
`makeSolidIndex().blocked` deliberately skips a box whose top is within
`solidRISE` of the ground — that is a kerb you step onto — so a hull sitting
42 cm over the waterline is invisible to it while being a perfectly real
collider. `px-bodies.js` reported `found: null` across a mooring field that had
thirty-three boxes in it. Ray the physics world instead. And a **body-count
differential** (121 → 154) is the cheapest possible proof that colliders were
added at all.

---

## The batches

Each 2–3 h, one commit, verified with the headless harness and judged from
rendered PNGs as well as numbers. Ordered by what the player feels first per
hour spent. X1, X3 and X4 are the ones that answer the original report.

**All eight landed, X1 through X8, the last of them clearing the shelf.**

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

**LANDED 4 Sep 2026. Item 4 was four false alarms, and item 2 was not the
minimum boom.**

**1. Rio's bird now flies behind the bird's own rig.** Three lines in
systems.js asked for Pasto by NAME and all three were the same mistake:
`inPasto && game.condor.mounted` (the rig), `inPasto ? p.y - groundY` (the
altitude the shadow box and the altimeter are both read off) and
`thermalAt`'s `game.pasto.thermals` (the THERMAL lamp). condor.js publishes
`hosted()` — its own `condorHost()`, as a predicate — and systems.js asks that
instead. Differential on `qa/px-rig.js`, the same walk and the same mount:

| | reach | pitch | altimeter at 95 m up | HUD | thermal lamp in a column |
|---|---|---|---|---|---|
| pasto, before | 24 | 22° | 99 m | on | — |
| **rio, before** | **10.7** | **23°** | **0 m** | **never shown** | **never lit** |
| pasto, after | 24 | 22° | 99 m | on | lit |
| **rio, after** | **24** | **22°** | **96 m** | **on** | **lit** |

Rio was flying a 20 m/s glide behind the WALKING rig, with the flight panel
hidden and the altitude pegged at the 26 m relief cap. The two chapters are now
byte-identical in every column. Pasto is unchanged, which is the point.

**2. The Venice boom: the 1.9 m floor is honest and was never what was wrong.**
It is not a calle either — the leg `px-cam-walls` stops on is the San Marco
ARCADE, and the picture (`qa/px-boom-venice-*.png`) shows the capybara entirely
behind a colonnade column with `clear` reading 0.18 the whole time. The cut was
firing correctly and the frame was a photograph of a pillar, because **the cut
is computed on the desired point and the frame is drawn from the spring.**
`camClearF` takes its new value on the frame the ray finds the wall — "in,
immediately", as the block says — and then hands the boom to a lambda-7 spring
that needs a third of a second to travel the metres just removed. The cut asked
for 1.87 m of boom; the rendered eye sat at 3.37 with a column 0.14 m in front
of the lens.

Fixed with a RADIAL clamp under the spring, the same shape as the second relief
clamp that already exists forty lines down and for exactly the same reason. The
eye may lag in bearing as much as it likes; it may not sit further out along the
boom than the ray said was safe. Damped rather than snapped — a hard clamp moved
the Kowloon boom 8.54 m between two samples, which is a cut and not a camera —
and `sysCAM_CUT_LAMBDA` was swept in the arcade:

| | frames with a solid thing between lens and animal | worst boom travel in 100 ms |
|---|---|---|
| before | 6 / 28 | 3.09 m |
| clamp (instant) | 1 / 28 | 6.58 m |
| lambda 21 | 2 / 28 | 6.58 m |
| lambda 16 | 1 / 28 | 5.97 m |
| **lambda 12** | **1 / 28** | **5.32 m** |

Rising instead of closing was considered and rejected: a rise over an arcade or
a calle puts the eye above the roof looking down at it, which is precisely the
Marrakech souk failure `camCeil` exists to prevent.

**3. The eye-raise has three hands now.** Touch gets a seventh button — the
right-hand column under MENU, held like the slide, with a new `look` glyph in
the sheet. The pad gets R3's HOLD: every button on a standard pad was already
spoken for, so the only free gesture left on the camera hand was the stick
click's second meaning, and it is the same tap-and-hold shape Back already
carries. The tap still recentres on the press edge — a recentre is a reflex and
may not wait 0.20 s to find out whether the thumb is staying down. All three
write the one `eyeAsk` channel; none is a second rig. Measured (`qa/px-eye.js`),
all three identical, sky 0.55 → 0.69 and pitch 25.4° → 20.8°, and the pad TAP
moves the yaw and leaves the pitch alone.

**4. All four "anomalies" are the instrument or the terrain. Nothing fixed, and
that is the finding.** (`qa/px-anom.js` — four points per chapter, four compass
directions each, walk and run measured separately at every one.)

- **Antarctica 1.76 / 3.11 is Tobler's law, exactly.** `capyGRADE_MIN` is 0.42;
  4.2 × 0.42 = 1.764 and 7.4 × 0.42 = 3.108. The spawn sits on a 20.2° slope
  and three of the four directions off it hit the grade floor. The fourth — 
  across the contour — runs at **8.20 m/s**, full speed. Six points measured,
  every one of them on 18–32° of hill. The chapter is a hill.
- **Cali 4.94 was one blocked direction.** At the spawn, W gives 1.88 and
  A/S/D give 7.77 / 7.46 / 7.87. Thirty metres away, all four give 7.40.
- **Monaco 3.62 did not reproduce at all**, at the spawn or away from it: 7.40
  to 8.44 in every direction at every point.
- **Hanoi's silent wheek is `qa/sum-controls.js` keeping only the last FOUR
  sfx.** Hanoi's traffic fires barks and ticks continuously, so the wheek is
  pushed out of the window before the probe reads it. Logged in full, every
  Hanoi row contains `wheek`. The re-run sweep now reports Hanoi as `Y`.

**Also found, not fixed** (both on the shelf below): Kowloon's stair walk plays
inside a drawn-only awning that `sysCamClear` cannot see, and `px-cam-walls.js`
does not hold a line.

---

### Batch X8 — the shelf, cleared

**LANDED 5 Sep 2026. Eight of the nine shelf items. Three of them were not what
the shelf said they were, and one of them uncovered a bug nobody had ever seen.**

The shelf was written as nine independent chores. Measured, three of them are
the same shape: a hook whose publishers do not agree with each other, and a
consumer reading the disagreement without knowing.

#### 1 · `physRUB_G` was a constant 24 in a chapter at 0.36 g — FIXED

Sized 0.2 h and it was. props.js already reads the live number forty lines up
for buoyancy (`-physGame.world.gravity.y`); the rubbish integrator did not, so
every scrap knocked off a table in the Drift fell at nearly three times the rate
of the thing that knocked it. One read, hoisted out of the per-scrap loop.

#### 2 · `manFlowAt` scaled the whole beach by the PLAYER's depth — FIXED

Sized 0.2 h. Manly's bore is a surface thing, so a body that is UNDER it gets
almost none of the push — and the chapter asked that question of
`manGame.capy.depth`, off the global. props.js's `physFlowAt` calls the same
`flow()` hook for every floating prop on that beach, so **a thong bobbing forty
metres up the sand lost its shoreward push the instant the player duck-dived
somewhere else entirely**, and got it back when they surfaced.

The tell was already in the file: the foam had the same problem and had solved
it by keeping a second, depth-free copy of the whole field (`manFlowAtStatic`,
eighteen duplicated lines). Depth is now the third argument of
`flow(x, z, dep)` — the animal passes its own, props and foam pass none — and
the duplicate is deleted.

#### 3 · Monaco's cars against `capyPLAT_VMAX` — MEASURED, then FIXED

Sized 1 h: "ride one and find out". Riding one works, and it works for the wrong
reason. `monBuildCars` puts four sixteen-centimetre rails round the cockpit, and
the solver was making up a 14.5 m/s shortfall by shoving the animal against the
back one. Three legs of four seconds each (`qa/px-ride-mon.js`):

| clamp | leg 1 held | leg 2 | leg 3 | mean speed deficit |
|---|---|---|---|---|
| 12 | **8/40** | 40/40 | 40/40 | 6.40 / 1.95 / 0.68 m/s |
| 30 | 40/40 | 40/40 | 40/40 | 0.16 / 0.09 / −0.32 |

12 was a speed limit, not a sanity clamp. `qa/px-carriers.js` walked all
nineteen chapters: **the fastest moving kinematic body in the game is Monaco's
26.5 m/s and the next fastest is Circular Quay's ferry at 8.6**, so 30 is three
and a half metres a second clear of anything legitimate, and main.js's 90 m/s
cap is still the guard against a real runaway.

#### 4 · Velocity-only kinematic carriers — THE SHELF HAD IT BACKWARDS

The shelf called the position-writing carriers "self-correcting" and asked for
the velocity-only ones to be enumerated. CONTRACT.md rule 2 said the opposite —
"move it with velocity, and NEVER by assigning position" — with three named
exceptions. **Neither statement was right, and rio.js has carried the correct
one in a comment since v37**: "it does not move it twice… the position written
here is authoritative and the velocity is only ever read by the contact solver,
which is exactly who needs it."

Censused with `qa/px-carriers.js` (counts writes by patching `set` on each
body's own position vector) and `qa/px-carriers2.js` (names the writer from a
stack), the moving kinematic bodies split two ways and both are correct:

| pattern | who |
|---|---|
| velocity only | Monaco ×3, Antarctica ×15, Venice ×2, Kowloon ×2, Sydney's ferry, Pasto's chiva, Rio ×2, the cave log |
| velocity **and** position | Quay's big ferry, Iceland's snowcat, Palawan's bangka, Cappadocia's trailer, Marrakech's caravan, the Drift's wanderers ×3, Rio's cabin and its 2 parade floats |

What threw Cali's barrow off — the measurement rule 2 was written from — was a
**zero** velocity, not a written position. A mass-0 body with no velocity is
solid ground to capybara.js's contact sweep, so the controller pins the animal
while a hand carry drags the body, and the two fight.

**And the drift is a hitch, not a refresh rate.** main.js calls the
three-argument `world.step(1/60, dt, 5)`, so cannon owns an accumulator and a
144 Hz display integrates exactly as much time as a 60 Hz one. What does cost
ground is a frame longer than five substeps — 83 ms — because the world
under-steps on purpose while the carrier's bookkeeping advances by the full dt,
and rule 3 forbids looking at the body to notice. Measured on Monaco's fastest
car (`qa/px-hitch.js`), commanded travel minus actual over two seconds:

| run | worst frame | lost |
|---|---|---|
| clean | 30 ms | 0.203 m |
| one 300 ms stall | 312 ms | **3.13 m** |
| clean | 33 ms | −0.129 m |
| one 600 ms stall | 611 ms | **14.12 m** |

600 ms at 26.5 m/s commands 15.9 m and five substeps deliver 2.2, so the 14.1 m
is `MAX_SUBSTEPS` to three significant figures. A carrier that also writes its
position erases the loss on the next frame; a velocity-only one keeps it for
ever. CONTRACT.md rule 2 is rewritten around this, with the census as evidence.

#### 5 · The `localWater` gate — NOT harmless, and one chapter was faking it

Sized 0.5 h and described as "a trap for the fourth chapter that adds a swell".
It was already sprung. capybara.js and systems.js consulted `waterHeightAt` only
when the chapter set `localWater: true`; props.js, weather.js and npc.js asked
unconditionally. Sampled 24 × 24 inside `bounds()` in every chapter
(`qa/px-hooks.js`), four chapters that never set the flag disagree with
themselves:

| chapter | waterHeightAt − waterLevel |
|---|---|
| Monte Carlo | 0.627 m |
| Kyoto | 0.577 m |
| Circular Quay | 0.289 m |
| Cali | 0.100 m |

So in four chapters the animal solved its swim threshold, float target, clamber
ceiling and wake rings against a datum up to 63 cm from the one the props
floating beside it were using — and the camera decided whether the frame was
underwater against the same wrong number.

**Kyoto had already noticed and worked around it**, the only way the gate
allowed: its update rewrote its own published `waterLevel` every frame from the
ANIMAL'S position, so a chapter with two waters 45 cm apart could get the right
one. That fixed the swim and broke the datum for everyone else — a prop's rest
height on a still day swung 45 cm because the player had walked to the river.

Fixed as one exported resolver, `waterYAt(api, x, z, miss)` in shared.js, with
no flag in it, used by all five readers. Kyoto's workaround is deleted.
`localWater` survives as documentation of which chapters have a surface with
shape in it, and nothing branches on it.

Verified after: in eight chapters the animal floats 0.012–0.09 m above the LIVE
surface under it, which is one number rather than two (`qa/px-swim.js`).

#### 6 · `slopeAt` — kept, and made one hook instead of four

Sized 1 h as "delete it or have the animal and the NPCs read it". Neither is
available: capybara.js derives a SIGNED grade along the direction of travel,
because Tobler needs a sign and `slopeAt` is a magnitude, and npc.js's Pasto
chase does the same thing for the same reason. It is a harness hook, and a dozen
QA probes use it.

What the audit missed is that the seventeen publishers do not agree on the
units. Twelve return rise over run. **Cappadocia, Palawan and Venice returned
`atan()` of it — an angle in radians — and Hong Kong returned an angle
differenced along z ONLY**, so a Mong Kok street that climbed east read as flat,
in the one chapter whose premise is that up is a direction. The probes that read
it (`mv-park.js` and `b10-mon2.js` both threshold at 0.75) were comparing
radians with gradients across chapters, and agreeing only because atan(g) ≈ g
below about 20°.

The four outliers now match the twelve. The Drift still returns a constant 0
against terrain that differs from it by 0.72 on average; that is a stub, and it
is recorded rather than fixed because the Drift's relief is drawn, not walked.

#### 7 · Kowloon's stair inside a signboard — FIXED

Sized 1.5 h, and it was the one that costs a picture. `qa/px-hk-awn.js` confirms
X7's reading and kills the first of the two proposed fixes: 16 of 36 frames on
the spawn walk are occluded, 15 of them by a mesh the physics ray reports as
`physHit: null` — and there is no point giving THAT mesh a shell, because **Mong
Kok is one merged mesh 57 × 49 × 110 m** and "which object is in the way" has a
single, useless answer.

So it is `camCeil`, the souk's lever. Mapped on a 2 m grid the length of the
street (`qa/px-hk-awn3.js`), the cover is not a scatter of awnings but one
continuous first-floor overhang along the west shopfronts, running the whole
length from z −40 to 60 over exactly `-hkFACE` to `-hkST_HALF`.

Three things had to be got right that the souk never had to. The souk is one flat
covered market on one level; Mong Kok is a street with a ceiling that is not one
height, a stall the camera never enters, and a scaffold you climb out of the top
of.

- **The number is the lowest band, not the commonest.** On a 1 m grid
  (`qa/px-hk-awn4.js`, 1 070 cells, 813 covered) the cover is banded — 463 cells
  at 4.5–5.0, 102 at 3.5–4.0, 60 below 3.5, minimum 1.18. A ceiling at 4.45 left
  the frame at (−8.5, 20) as one red awning. 3.15 clears 565 of the 813.
- **It is the SIGHT LINE that has to clear, not the lens.** systems.js evaluates
  `camCeil` at `sysDesired` — the camera — which is enough for three hundred
  square metres of souk and useless for a dai pai dong seven metres by ten: with
  the animal at its tables the lens sat at 6.80 out on the carriageway, nothing
  fired, and the frame was the whole green awning with no capybara in it.
  `hkCamCeil` now asks at BOTH ends and takes the lower, reading the animal's
  position the way monaco's `room()` does.
- **And a ceiling has to stop at the boards.** `hkSCAF` stands at `x = -hkFACE`
  with its top at 34.8 — inside the covered strip. A ceiling with no height gate
  would have held the lens at 3.15 while the animal climbed to thirty-four
  metres, and the frame would have been the pavement: the chapter whose premise
  is that up is a direction, broken by the fix for the chapter's own awnings.
  Caught by reading the fix against `hkSCAF`'s constants rather than by a probe,
  then confirmed on a ladder of eight heights (`qa/px-hk-climb.js`). Nothing is
  over your head once you are above the awnings, so nothing clamps.

Result on the spawn walk: **occluded frames 16/36 → 4/37, drawn-only 15 → 1**,
and six spot-checks across the chapter go from two occluded to none. The screens
are `qa/px-hk-*.png`; the dai pai dong goes from a flat green rectangle to the
stall, its tables, its stools and the street behind it.

#### 8 · Quay's moored yachts — REACHABLE, made solid, and thirteen were in a hill

The shelf said "confirm reachability first". `quayBOUNDS` is −420…460 by
−760…120 and all three mooring fields are deep inside it, so they are reachable
by definition — that is what `bounds()` means. The berthed ferries two hundred
lines away already carry the argument and already have their boxes.

Thirty-three static boxes and thirty-three `quayHARD` circles, one per hull
rather than one per field (a single circle round a 34 m cove is 34 m wide and
would push the boat further out than thirteen yachts ever could). Body count
121 → 154, exactly +33. The fairway is unchanged: on a 10 m grid over the
harbour the mooring circles cover 26 cells of 3 465, against 825 for the
shoreline. A new harness hook, `hardAt(x, z)`, exists so that this can be
regressed — a hull test nothing can query is a hull test nobody can regress.

**And then the colliders found a bug that had been invisible for as long as the
yachts existed.** An animal put down on a hull came to rest at y 21.34. Sampled
20 × 20 across each field's own ellipse (`qa/px-moor4.js`):

| field | dry cells of 400 | max terrain |
|---|---|---|
| (−104, −172) | **247** | 26 m |
| (176, −262) | 74 | 24 m |
| (−64, −330) | 0 | 0 m |

Thirteen yachts were drawn at the waterline twenty-one metres inside a headland,
and eleven more were part-buried in another. Nobody had ever seen it, because a
boat inside a hill is a boat you cannot see; it only surfaced when the hulls
became things you could stand on.

The fields are NOT moved — their centres are a composition, and the wet part of
each ellipse is the cove the author was aiming at. A boat now has to find water:
up to twenty candidates round its own arc, scored by how much clear water is at
a hull's length in four directions. After: **33 of 33 hulls over water, max
terrain under a hull 0, and 31 of 33 with all four probes clear.**

#### What X8 did not do

Sydney's ferries and the Harbour Bridge traffic, the ninth shelf item. The
moorings answered the reachability question for things on water; the bridge deck
is a different question and nobody has shown that a player can get onto it. It
stays on the shelf with that written down.

And the four still-open items from the X7 write-up are still open: the X5
walk-into-the-face confirmation, the camera audit's write-up, the Drift's
`slopeAt` stub, and the fact that no chapter has been played end to end by a
person.

---

## The shelf — sized, not scheduled

**Eight of the nine were cleared by batch X8 on 5 Sep 2026, and the entries are
kept below with what they turned out to be, because three of them were wrong
about their own subject and that is the useful part.** Only the last one is
still open.

- ~~**`slopeAt` has seventeen publishers and no runtime consumer.** Either delete
  it or have the animal and the NPCs read it instead of differencing
  `terrainHeight`. 1 h either way.~~ **Neither was available** — both would-be
  consumers need a SIGNED grade along a direction and `slopeAt` is a magnitude.
  Kept as a harness hook; the real fault was that four of the seventeen returned
  radians and one of those differenced only z. See X8 §6.
- ~~**`localWater` gate asymmetry.** props and weather ask `waterHeightAt`
  unconditionally; the animal only asks when the biome also sets the
  `localWater` flag. Harmless today because every non-flag biome returns its
  waterLevel, and a trap for the fourth chapter that adds a swell. 0.5 h.~~
  **Not harmless: four unflagged chapters disagree with themselves by up to
  63 cm, and Kyoto was already faking its way round it.** See X8 §5.
- ~~**Monaco's cars reach 26.5 m/s and the carry frame is clamped at
  `capyPLAT_VMAX` 12.** Ride one and find out. 1 h.~~ **Rode one.** It held,
  because the cockpit is a well and the solver was making up 14.5 m/s by
  shoving. Clamp is 30. See X8 §3.
- ~~**`physRUB_G` is a constant 24**, so rubble particles fall at 1 g in the
  Drift's 0.36 g. Cosmetic. 0.2 h.~~ Done exactly as sized.
- ~~**`manFlowAt` scales its wave push by the capybara's dive depth**, and
  `physFlowAt` calls the same hook — so a floating thong loses its shoreward
  push whenever the player goes under. Pass depth as a third argument from the
  animal only. 0.2 h.~~ Done exactly as sized, and it deleted eighteen lines of
  duplicated field with it.
- ~~**Velocity-only kinematic carriers** drift at refresh rates other than 60 Hz,
  because cannon integrates them for `STEP` per substep and the velocity is
  derived from the frame `dt`. The carriers that also write `position.set` every
  frame are self-correcting; enumerate the ones that do not. 0.5 h each.~~
  **Backwards, and the mechanism was wrong.** cannon owns an accumulator, so
  refresh rate costs nothing; a frame longer than five substeps costs 3.13 m at
  300 ms and 14.12 m at 600. Both patterns are correct and CONTRACT.md rule 2
  has been rewritten. See X8 §4.
- ~~**Kowloon's stair is played from inside a signboard.**~~ **Fixed with
  `camCeil`, not with a shell** — Mong Kok is one merged mesh, so a shell has
  nothing to attach to. Occluded frames 16/36 → 4/37. See X8 §7.
- ~~**Quay's moored yachts** are drawn and not solid.~~ **Reachable by
  `bounds()`, and thirteen of them were buried in a headland.** See X8 §8.
- **Sydney's ferries and the Harbour Bridge traffic** are drawn and not solid.
  Both are on a deck whose reachability is unproven — the moorings settled the
  question for things on water, and the bridge deck is a different one. Confirm
  reachability first; collide only what a player can reach. STILL OPEN.

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
- `qa/px-anom.js` (X7) — put the animal down at N points in a chapter and walk
  and run it in all four compass directions at each, with the resting slope, the
  grounded fraction and the FULL sfx list per point. The instrument that turns
  "this chapter's run is capped" into "this chapter is a hill" or "this one
  direction is blocked".
- `qa/px-boom.js` (X7) — the pinned-position camera probe: one place, one route,
  per-sample boom length, clear fraction, whether a solid thing is between the
  lens and the animal, and the animal's screen-space height and centre. Three
  screenshots through the walk. Use this rather than `px-cam-walls.js` to
  measure a camera change.
- `qa/px-rig.js` (X7) — mount the flier deterministically (press on every frame
  the reach test is true) and read reach, pitch, the altimeter and the thermal
  lamp on the ground, in the air, 90 m up and inside a column.
- `qa/px-eye.js` / `-eye2.js` (X7) — the eye-raise on all three schemes: the key,
  a synthesised touch pointer on the fan button, and a stubbed `getGamepads`
  driving R3 as a tap and as a hold. `-eye2` is the 390 × 844 layout check.
- `qa/px-glyph.js` (X7) — every touch glyph blown up to 78 px on one sheet. A
  mark that reads at 24 px is not a thing numbers can tell you.
- `qa/px-ride-mon.js` (X8) — put the animal on a moving car roof at three points
  of the lap and log, per 100 ms, the carrier's speed, the frame it declares,
  the animal's own speed and how far it has slid. The instrument that says
  whether a ride is a ride or a shove.
- `qa/px-carriers.js` / `-carriers2.js` (X8) — the kinematic census. `-carriers`
  counts position writes per body per second by patching `set` on the body's OWN
  position vector (per-instance, so `Vec3.prototype` is untouched) and records
  the fastest carrier per chapter; `-carriers2` names the writing function from a
  throwaway `Error().stack`, which is how thirty walking NPCs collapse to one
  answer. Between them they replace reading forty constructors.
- `qa/px-hitch.js` (X8) — commanded travel versus actual travel on one carrier,
  sampled on wall-clock so a deliberately stalled main thread contributes its
  whole gap. Reads zero on a clean run by construction, which is the property
  that makes it trustworthy. **Its first version was unsound** — it compared
  `lap()` against a body it picked separately, and `lap()` wraps — and reported
  −6.997 m on a clean run, which is not a small error but a meaningless one.
- `qa/px-hooks.js` (X8) — two published hooks checked against the thing they
  claim to describe, per chapter: `slopeAt` against a central difference of the
  chapter's own `terrainHeight`, and `waterHeightAt` against `waterLevel`. The
  instrument that turned "harmless asymmetry" into four chapters and a number.
- `qa/px-hk-awn.js` / `-awn2` / `-awn3` / `-awn4` (X8) — the drawn-versus-solid
  camera probe and the cover map behind Kowloon's `camCeil`. `-awn` rays lens to
  animal against the SCENE and then fires the same ray at the physics world, so
  `drawnOnly` is a measured column rather than a guess. `-awn3` maps the street
  on a 2 m grid; `-awn4` does the covered strip on a 1 m grid and gives the
  histogram the ceiling height is chosen from. Read `-awn4` before believing any
  single number for a roof: this cover is banded, not flat.
- `qa/px-hk-climb.js` (X8) — the camera up a ladder of eight heights on Kowloon's
  scaffold, which is the test any camera CEILING needs: a chapter you climb out
  of the top of will break under one. **Pin the body every frame**; the first
  version set the position once and waited 1.4 s, and the animal simply fell, so
  every rung above 12 read `capY 0.34` and a camera still damping down from where
  it had been. Pinned, it reads 2.15 → 40.61 as the animal goes 0.39 → 34.89.
- `qa/px-hk-spots.js` (X8) — the camera at six named places in one chapter, with
  boom, clear fraction, the animal's screen-space height and centre, whether
  anything is between the lens and it, and a screenshot each. The shape to copy
  for any chapter that grows a ceiling.
- `qa/px-moor.js` … `-moor5.js`, `qa/px-bodies.js` (X8) — the mooring-field
  suite. `-bodies` is the body-count differential (121 → 154, exactly +33) and
  the swim-into-a-hull test; `-moor4` samples each field's ellipse against
  `isOverWater` and is the probe that found thirteen yachts inside a headland;
  `-moor5` is the per-hull acceptance test. Note in `-bodies` why `navBlocked` is
  the wrong instrument for a floating hull.
- `qa/px-swim.js` (X8) — where the animal floats relative to the LIVE surface
  under it, per chapter. One consistent number across chapters is the assertion;
  it wants deep water, because `isOverWater` is true over Monte Carlo's jetty and
  the animal lands on the pier two metres up and never swims.
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
