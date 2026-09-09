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
**RE-RANKED IN X9, AND THE NAMED LIST BELOW DID NOT SURVIVE IT. Read the X9
paragraph after this one before using any number here.**

The chest-height ray differential (drawn hit, no physics hit within 2.5 m,
height ≥ 1.6 m, origins inside a collider skipped) leaves a residue that is
mostly instanced vegetation, which is deliberate. What is left after
classification is small and specific — see batch X5. ~~The highest-count
non-vegetation hits are Kowloon at (±5, −65), a Venice block at x −77…−37, the
Göreme town mesh, three Sahara meshes, `palBeach`, and two Cali structures.~~
~~Separately, **ten Göreme cliff samples are "recessed"**: the drawn face is at
0.95 m and the collider at 2.30 m, so you walk 1.35 m into a cliff before it
stops you.~~ **RE-MEASURED AND MOSTLY FIXED, 9 Sep 2026. See CONTRACT.md.**
Re-walked as a player rather than compared as two rays: of the thirty-two
`recessed` samples, eight have no drawn face there any more, three stop you
nowhere at all (7 to 29 m), seven give a DIFFERENT ANSWER on every run because
their chapters' geometry moves, and nine already stop you outside the face.
Five were real, repeatable and all one cause — `faceX` is a curve sampled at
each box's centre across an 8.4 m span, and the row stopped 1.35 m short of the
drawn massif's south end — and they now read −0.41 to +0.16 m.

**X9's re-rank: 99 samples, 14 wall-shaped, and the ranking was wrong at the
top.** Every non-vegetation sample the audit recorded was put through the wall
test — settle, cast at ankle/chest/head, take the world normal
(`qa/px-x5-rerank.js`, 15 chapters, `err` null):

| verdict | n | what it is |
|---|---|---|
| gone | 59 | nothing there on repeat casts |
| **WALL** | **17** | vertical at every height it exists at |
| ground | 9 | drawn terrain rising ahead, normal near-vertical |
| low | 6 | nothing at head height |
| overhang | 5 | normal points DOWN — a ceiling |
| slope | 3 | runs further at head height than at ankle |

**Of the 40 samples that still have geometry in front of them, 23 are not walls.**
Tightening the rule (normal within ±0.2 of horizontal, same distance at every
height) leaves **14**, and no sample landed on top of the structure it was facing,
so `gone` is not a placement artefact — max `onBuilt` across all 59 is 0.41 m.

Named (`qa/px-x5-name14.js`), the fourteen are mostly *not* defects:

| what | n | verdict |
|---|---|---|
| Cali's bridge arch end cap, x −10.3 at `caliBRIDGE_X` −6 | 2 | correct — the arch is the route through |
| Drift instanced **Plane** geometry ×7038 and ×136, green | 2 | foliage the audit's veg filter missed |
| Cali instanced cylinders ×8, `PALETTE.caliCaneStem` | 2 | cane stems — vegetation |
| Palawan (−48, 40), drawn face 0.10 m away | 1 | the animal is INSIDE it; the audit's own filter 2 |
| Göreme (−37, 20), the 135 × 37 × 124 valley mesh | 1 | relief, already disqualified above |
| ~~**Pasto's bunting posts**~~ | 2 | **COLLIDED 9 Sep 2026 — nothing runs through them, and two of the twelve already stopped you. See CONTRACT.md.** |
| ~~**Kyoto's 32 × 22 × 2.4 m mesh at x −50…−18**~~ | 2 | **FIXED 9 Sep 2026 — `kyoZenGarden`: the dry garden's south wall, drawn across a 7 m doorway its own colliders left open. See CONTRACT.md.** |
| ~~**Cave's 32 × 15.6 m slab at z −200**~~ | 1 | **SETTLED 9 Sep 2026 — `cavExitJungle`, scenery behind a solid wall. Stays open. See CONTRACT.md.** |
| Cali (67, −30) | 1 | no hit on the naming pass — moving |

**The one with a name is the one worth arguing about.** `pastoBuildBunting` hangs
six runs across the plaza on twelve posts, each `pastoBox(...0.11, hy*0.5, 0.11)`
— **22 cm square and 11.6 m tall**, drawn and not solid, because `pastoBox` is a
merger push that cannot take a collider. Same class as X5's balloon baskets. It
is left open deliberately here rather than fixed: 22 cm is thin, the plaza is the
chapter's main play space, and this project's own precedent cuts both ways —
Göreme's baskets were collided at 2.4 m, its 1.9 m fan was left open because a
task runs through it. **That is the owner's call, not a probe's.**

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

**Four more from X9, and all three of the items it closed were instrument faults
rather than code faults. That is the batch's whole result.**

**A closing paragraph carried forward is a false comment with the widest blast
radius in the file.** "What this review did not finish" was written on 4 Sep
about that session; X8 copied it into "what is still open" without checking, and
by then X5 had shipped four commits against the first item and X7 had closed
half of the second. It set a whole batch's agenda from a stale sentence.
**Re-derive an open list from the repo before working it**, the same way a
reachability claim gets re-measured rather than re-read.

**A central difference of a piecewise-constant function is not a gradient.**
`px-hooks.js` differenced the Drift's terrain, got 0.72 against a published 0,
and that number went into the roadmap as a defect. Split by island, the interior
gradient is exactly 0 over 275 samples and all of the disagreement is 23 rim
samples averaging 67.97 — cliffs. **The refinement test is the cheap tell:
halve the sample spacing and see whether the answer converges.** This one walks
5.31 → 5.25 → 5.11 → 6.27, so it was never a gradient at all.

**The drawn ray never learnt what fault 4 taught the physics ray.** The solver
ray skips HEIGHTFIELD and PLANE because you walk up a slope rather than stopping
at it. The drawn ray — the half that NOMINATES candidates — has no such filter,
so every hillside, road ribbon and merged relief mesh reads to it as a wall at
chest height, and so does the underside of any overhang. **Take the world normal
and cast at three heights** (`px-x5-norm.js`): a wall is the same distance at
ankle, chest and head with `ny` near 0. Göreme's top candidate reads `ny −0.98`,
which is a ceiling.

**A before/after pair around a key press, taken while the subject is moving,
measures the movement.** The first controlled dive read +7.65° of pitch with V
held and nearly went into this file as "V works better diving than on land" — a
reversal of X9's own finding. A diving animal is descending, so the lens is
moving anyway. The same dive run twice on the same clock, once with V and once
without, attributes **−0.09°** to the key. **Any measurement of a control needs a
leg where the control is not pressed**, and it needs the two legs to start
identically: both of these reach 1.72 m of descent between the samples, which is
what says the legs are comparable at all.

**`page.keyboard.press` can be missed entirely.** It sends down and up about 10 ms
apart, against a 16.7 ms frame, and an input flag assembled once per tick may
never see it. E read as "the dive does not latch" until it was HELD for 800 ms.
Hold the key, and poll for the state rather than sampling once after it.

**A probe that settles the animal must re-read where it settled.** `px-x5-walk4`
dropped the animal, let it slide for 30 ticks, and then cast from the ORIGINAL
x/z with the SETTLED y. It is why a control could be chosen with a face at
0.8–2.0 m and re-measure as `phys: null` one call later, and it is most of why
two chapters were written off as "control did not stop".

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

#### 9 · Sydney's ferries and the bridge traffic — the shelf's last item

Two structures, one rule — collide what a player can reach — and the two of them
land on opposite sides of it. Both answers are now measured rather than assumed,
which is the whole of what this item asked for.

**Sydney's harbour traffic is reachable, and is now solid.** `envBuildTraffic`
carried the claim in its own comment: nine sails and two small ferries, "all of
them beyond z = -46 so they are scenery and nothing else: no colliders … no way
for the player to reach them". The chapter's own `bounds()` disagrees — the
harbour rectangle is x ±140, z −150..−8, and the comment on THAT says "the seabed
body under it is wider still, so swimming to the far shore stays legal". All
eleven boats sit inside it, from z −47.7 to −128.6.

Measured (`qa/px-syd-traf.js`): put down at z −140 the animal swims, is not
outside, and the rescue does not fire; and swimming north from the sea wall on
one held key for twenty seconds it reaches z −66.8 and passes within **6.8 m of
a hull**. They are about half a minute's swim from the shore.

So the eleven get hulls — kinematic, one box each matched to the drawn hull and
scaled per instance, writing velocity AND position for the reason X8 wrote into
rule 2. Verified: every drawn instance has a body exactly on it (worst offset
**0.000 m over 440 samples** across four seconds of sailing); a physics ray
across each beam stops at 3.30 m from centre for a sail and 6.93 for a ferry,
which are the half-extents to the centimetre; Sydney goes 149 → 160 bodies and
43 → 54 kinematic, and Pasto and Circular Quay carry **zero** traffic hulls, so
they detach with the chapter as they must.

And they carry. The decks sit 0.58 m over the waterline — the Quay moorings
measured the same clamber at 0.42 — so climbing onto a passing yacht is now
something a player can do by accident. Twenty-five seconds aboard each of the
two ferries and the widest-ranging sail: **250 of 250 frames on board, zero
frames outside the world.**

That last number needed a fix of its own. **Both ferry legs ran to x ±150 and the
player's harbour is x ±140**, so each of them turned round ten metres outside the
world — which did not matter while they were scenery and matters entirely once
they are things you can stand on: a ride to the end of the leg carries the animal
out of bounds and into the rescue, and being teleported off your own boat is a
worse bug than swimming through it was. Found by accident, by a probe that put
the animal at a ferry's centre and got back seven frames of "outside" and a
rescue instead of a collision. The two legs and one sail that touched −140 are
now ±138; at forty to a hundred metres out, twelve metres of turn is not a
picture.

**The Harbour Bridge deck is NOT reachable, so nothing on it is collided — and
the deck itself has no floor, which is correct.** Thirty-eight cars and a
three-carriage train run along it at 18.5–28.6 m/s and 15.1 m/s. Reading
`quayBuildBridge` first: the pylons, the eight approach piers and the two
abutments all take a `quayStaticBox` and the deck takes none. Measured
(`qa/px-bridge.js`):

- the physics world holds **nothing at deck height between u −150 and +150**.
  Only the abutments answer, from |u| 168 outboard.
- put the animal on the deck at u 0, 60 or 120 and it falls **26.4 m** into the
  harbour and swims. At u 175 it stands, because that is the abutment.

Then whether anyone can get there. Swimming at the landfall bluff, at a pylon and
at an approach pier, from open water, on both keys (`qa/px-bridge5.js`) and then
at the bluff from all four sides on all four keys with Bradleys Head as a control
(`qa/px-bridge6.js`) — **thirty-two legs, and the highest the animal reaches
against any of them is 2.28 m against a deck at 25.** It is never grounded and
never stops swimming. Every face is sheer from the water, and this chapter
publishes no `climbHold`: only Hong Kong, Cappadocia and Sơn Đoòng do, so there
is no climb verb here to find a way up with.

The control is the useful half. `quayBuildLand` carries a comment about Bradleys
Head — "the one you can actually swim to: the animal stands on the rim at 21 m
with four metres of hill over its head" — which if true would mean a headland can
be got onto and the bluff test was too narrow. It cannot: Bradleys Head measures
2.07–2.29 m from all four sides, exactly like the bluff. **That comment was
written from a probe that teleported**, which is the same mistake the first two
versions of this item's own probe made.

So the deck needs no floor and the traffic needs no bodies. The finding is
written into `quayBuildBridge` next to the deck, with the note that a bluff which
ever becomes climbable turns 300 m of drawn carriageway into a hole with cars
driving through it — and which probe to re-run first.

### The reachability-claim sweep (X8c, 5 Sep 2026)

The Bradleys Head note turned out to have been written from a probe that put the
animal on the rim, and Sydney's harbour traffic carried the same mistake with the
sign flipped ("no way for the player to reach them"). Two in one batch is a
class, so `src/` was swept for every comment that asserts the player can, or
cannot, get to a named place, and each was measured with a leg that starts where
the chapter itself agrees there is legal ground or legal water.

**Five claims. Two false, both already fixed; three true and now checked.**

| where | the claim | verdict |
|---|---|---|
| `quay.js` `quayBuildLand` | Bradleys Head is "the one you can actually swim to: the animal stands on the rim at 21 m" | **FALSE** — 2.07–2.29 m from four sides, never grounded |
| `environment.js` `envBuildTraffic` | the eleven boats are beyond z −46 with "no way for the player to reach them" | **FALSE** — all inside `bounds()`; 6.8 m from a hull in twenty seconds |
| `quay.js` `quayIsOverWater` | Bennelong Point is "a podium you can swim to and climb out on" | TRUE — grounds at 2.96 above a 2.60 podium, from the south |
| `antarctic.js` `antGroundSlip` | the whalers' beach is why "the wreck is somewhere you can climb on" | TRUE — grounds 0.87 m up onto the hull, photographed |
| `drift.js` `driBuildArch` | "the ring is over four metres up and out of reach" | TRUE in substance — first uncollided stone at 3.9, jump clears 3.08 |

The two that are true and interesting are true for a reason worth keeping.
**Bennelong works because of its steps** — nine of them, from the podium at 2.60
down to 0.20, which is the waterline — and the north, east and west faces of the
same podium behave exactly like Bradleys Head, topping out at 1.4–2.3 and never
grounding. A headland is a box from the seabed to its crown and has no such
thing anywhere on it. That is the whole difference between the two sentences,
and it is why one of them was safe to write and the other was not.

**And the Drift's number was loose where its conclusion was sound.** The leg
collider runs AY+0.3 to AY+3.9 (`driStaticGroup.add` takes full extents) against
a drawn shaft stopping at AY+3.6, so the first ring stone with nothing in it is
at 3.9 rather than "over four metres"; a standing jump clears 2.53–3.08. Clear
by 0.8 m at worst, so the ring is right to be drawn and not collided.

#### Two ways this sweep's own instruments lied

**Measure the apex over the ground UNDER THE ANIMAL, never over a fixed datum.**
The first Drift run reported a 4.54 m jump and the second reported 0.74–2.73 from
the same start, which is not a measurement. Both were taking `capy.y` minus the
terrain height at the arch centre while the animal ran somewhere else — off the
lip of the island in three legs of four, at which point the subtraction is
meaningless. Against the ground beneath it, the standing jump is 2.53–3.08 twice
over and the running legs disqualify themselves by leaving the island.

**"The lowest drawn thing overhead" is not stable where anything moves.** The
same grid over the arch returned a lowest drawn surface of 2.91 m on one run and
1.42 m on the next: `driBuildRoosts` sits birds along the ring and on the lip
posts, and they were what the ray kept finding. Read the geometry from the
constants that build it when the constants exist, and use the ray to confirm
rather than to discover.

#### What X8 did not do

The shelf is empty; all nine are done. What is still open is the four things the
X7 write-up listed and this batch did not touch: the batch X5 walk-into-the-face
confirmation, the camera audit's write-up, the Drift's `slopeAt` stub, and the
fact that no chapter has been played end to end by a person. Everything above is
instrumented.

**All four were taken up by X9, and three of them are now closed. See below.**

---

### Batch X9 — the four that were left, and a list that was stale

**LANDED 5 Sep 2026.** Three of the four closed. **Not one of them was the job it
was written down as**, and the reason is the same in all three: each was recorded
from an instrument nobody had audited, and auditing the instrument changed the
answer. No colliders were added, one comment was corrected, and the roadmap's own
closing paragraph turned out to be the most wrong thing in the file.

**THE LIST ITSELF WAS STALE, AND THAT IS THE FIRST FINDING.** "What this review
did not finish" was written by the 4 Sep review about its own session, and X8
copied it forward verbatim as "what is still open" without checking it against
the repo. In between, **batch X5 shipped four commits of walk confirmation**
(`d7d1922`, `bb03e7e`, `418238e`, `313d43d`) and X7 landed the eye-raise
bindings. A closing paragraph that is carried forward instead of re-measured is a
false comment with a wider blast radius than any of the ones the X8c sweep
found — it sets the next batch's whole agenda. **Re-derive an open list from the
repo before working it.**

#### 1. The X5 walk confirmation, finished — and the candidate list is empty

X5 left three things unresolved: fault 5 named and not fixed, Venice and Cali
untrusted because their controls never stopped, and two Göreme faces confirmed as
walk-through whose builder was never identified. `qa/px-x5-walk5.js` fixes fault 5
and a sixth nobody had noticed; `qa/px-x5-norm.js` adds the test that decides the
rest. **Every remaining candidate is disqualified, each for a different reason,
and nothing needed colliding.**

**Fault 5, fixed, and it changes an answer.** `place()` put the animal at
`terrainHeight + 0.34`, and terrain is the SEABED under any pier, deck or
pontoon. Dropping from 3 m and ticking until it settles, Kowloon's `(5, −65)`
lands at y **1.30 against a terrain of −4.20 — 5.16 m of built ground under it**,
which is the pontoon deck it was supposed to be standing on all along. From
there, no drawn face within 2.6 m at all. Kowloon's withdrawal was right and is
now proved with the animal in the right place rather than inferred.

**Fault 6, new: it cast its rays from where the animal was PUT, not from where
it ended up.** walk4 settled for 30 ticks and then called both rays with the
original x/z and the settled y. On any slope the animal slides during those
ticks, so the rays start somewhere it is not standing — which is how a control
could be selected with a physics face at 0.8–2.0 m and re-measure as `phys: null`
in the very next call. That single bug is most of why Venice's and Cali's
controls "did not stop": they were never walked from where they were chosen.

**Fault 7, and it is the one that mattered: the DRAWN ray had never been taught
what fault 4 taught the physics ray.** Fault 4 made the solver ray skip
HEIGHTFIELD and PLANE, because a horizontal ray at chest height on a slope hits
terrain and you do not stop at a slope, you walk up it. Nothing ever applied that
to the drawn ray — and the drawn ray is the half that NOMINATES candidates. So
every hillside, road ribbon and merged relief mesh in the game reads to it as a
wall. The test that separates them is the world normal of the hit face, checked
at ankle, chest and head:

| where | ankle | chest | head | what it is |
|---|---|---|---|---|
| kowloon (−30, −46) — the control that STOPS | 1.50 / ny 0 | 1.50 / ny 0 | 1.50 / ny 0 | a wall |
| göreme (−8, 10) | — | 2.49 / **ny −0.98** | 0.03 / ny −0.43 | an overhang, 3 cm over its head |
| göreme (−27, 0) | — | — | — | nothing there, three reps |
| göreme (−70, −46) — its "control" | 0.98 / ny −0.4 | 1.00 / ny 0.4 | 1.36 / ny 0.03 | a slope; never was a wall |
| cali (−12, −5) | — | 1.70 / ny 0 | 1.70 / ny 0 | vertical, and correct — see below |

A wall reads the same distance at all three heights with a horizontal normal.
Göreme's first candidate has a normal of **−0.98**: that is a face pointing
straight DOWN, the underside of something the animal is standing beneath. You do
not walk into a ceiling. Its second returns nothing on three consecutive reps,
so whatever walk4 saw at 1.52 m had moved — a cat or a person, which is X6's
subject and not a wall. And its control was a hillside, which is the whole
explanation for "the control did not stop".

**Cali's is real geometry, correctly not solid, and colliding it would wall off
the bridge.** The face at 1.70 m is at x −10.3, and `caliBRIDGE_X` is −6 with the
arch cylinders running x −10.3…−1.7: it is the end cap of the drawn arch under
the bridge, met by an animal standing on the river bed at y −2.68. walk5 already
records that animal travelling 10.27 m in +x — straight under the bridge, which
is the way through. Same shape as X5's balloon envelopes: **an audit that
collided everything it flagged would have made a shipped route impossible.**

#### 2. The camera audit's write-up

`qa/audit-2026-09-04/audit-controls-camera.md` has read "Status: IN PROGRESS.
Code inventory done; measurements pending" since 4 Sep. Checked against the
source rather than reprinted, **two of its findings are already fixed, one census
is out of date, and its one open measurement is now made.**

| the audit's claim | now |
|---|---|
| flight rig gated `inPasto && game.condor.mounted`, so Rio flies on the ground rig | **fixed in X7**, systems.js:26736 records the change |
| V is KEYBOARD ONLY — no pad or touch | **fixed in X7**: `keys.KeyV \|\| padEye \|\| touchLook` |
| `camCeil` published by cave.js and sahara.js | **four now** — environment.js, kowloon.js (X8), sahara.js, cave.js |
| `camFloor` published by cave.js and palawan.js | still two, correct |
| no keyboard zoom at all | correct; the wheel and the right stick zoom, the keyboard does not |
| "V underwater is largely overridden by the dive rig — to measure" | **measured, and it is not `largely`** |

**The eye raise is worth 5° on land and nothing underwater** (`qa/px-cam-v.js`,
Palawan, one pinned animal, V held against V not held):

| state | Δ pitch | Δ eye height | Δ boom |
|---|---|---|---|
| standing on land | **+5.05°** | −0.55 m | +0.47 m |
| swimming at the surface | **+4.71°** | −0.53 m | +0.36 m |
| submerged, depth 1.61 | **−0.47°** | +0.04 m | **0.000 m** |

Submerged, the boom does not move by a single millimetre and the pitch change is
half a degree in the wrong direction, which is noise. The underwater rig owns the
lens completely — it has already pulled the boom from 11.90 m to 5.25 m and the
eye from 5.71 m over the animal to 1.57 — and V is inert inside it.

**AND NOW FOR A REAL DIVE.** The table above was measured SUBMERGED: `capy.diving`
stayed false throughout, because the probe pinned the body at depth every 16 ms
and a pinned body never satisfies `capySwimming && capyCanDive() && input.action`.
`qa/px-cam-dive.js` floats the animal, HOLDS E — a 10 ms `press` against a 16.7 ms
frame can be missed entirely by an input flag assembled once per tick — and
asserts `capy.diving` before believing anything. The dive latches, and the
conclusion holds:

| leg | Δ pitch | Δ eye | Δ boom | Δ depth |
|---|---|---|---|---|
| diving, V held | +7.49° | −1.055 m | −0.826 m | 1.72 m |
| diving, no V (control) | +7.58° | −1.065 m | −0.822 m | 1.72 m |
| **attributable to V** | **−0.09°** | **0.01 m** | **−0.004 m** | 0 |

**The control leg is the entire point, and without it this reads as a reversal.**
The first pass measured +7.65° with V held and nearly went into this file as "V
works better diving than on land". A diving animal is DESCENDING, so the lens is
moving anyway; a before/after pair around a key press measures the descent. Run
the same dive twice on the same clock, once with V and once without, and the
difference of the differences is −0.09°. **V is inert underwater, dive or no
dive.**

**And the wall probe is still the one that cannot hold a line.** X7 measured
`px-cam-walls.js` moving `occ` 78 → 92 on legs where the change under test
provably could not act. Nothing here rehabilitates it. Use it to FIND a bad leg;
use a pinned-position probe — `px-boom.js`, `px-hk-spots.js`, `px-cam-v.js` — to
measure one. Every number in the table above comes from a pinned animal.

#### 3. The Drift's `slopeAt` stub is correct, and the instrument was wrong

`drift.js` publishes `function driSlope() { return 0; }`, and X8 filed it as the
one publisher that stubs its answer because `qa/px-hooks.js` differenced
`driTerrain` and got 0.72 where it returns 0. **That difference is an artefact.**
`driTerrain` is piecewise-constant — one deck height per island, `driCLOUD_Y`
over the void — so a central difference of it is 0 in an island's interior and a
STEP at its rim, and the quotient at a rim is not a gradient but the cliff height
over the sample spacing.

Split that way (`qa/px-dri-slope.js`), over 298 ground samples and 21 distinct
deck heights:

- **275 interior samples: mean gradient 0, maximum gradient 0.** Exactly flat.
- **23 rim samples: mean 67.97, peak 130.8** — 89 degrees, which is the cliff.
- The aggregate is not a number either: halving the sample spacing walks it
  **5.31 → 5.25 → 5.11 → 6.27** instead of converging. A real gradient is stable
  under refinement; a step is not, and that is the tell.

So 0 is the honest answer everywhere a capybara can stand, and a central
difference here would publish a cliff as a walkable grade. The code is unchanged;
the comment above `driSlope` now carries the measurement, so the next pass does
not re-open it.

#### 4. No chapter has been played end to end by a person — and I cannot close this

This one stays open and it stays open honestly. Everything in this file was
established by instrumentation: probes that pin a position, drive keys, read the
solver and post JSON. An instrumented end-to-end pass is not a substitute and
must never be written up as one — it shares every blind spot with the probes
above, which is precisely how a 0.72 that was a cliff, a control that was a
hillside and an animal on the harbour bed all survived review. **It needs a
person, and it is the owner's to do.**

---

## The shelf — sized, not scheduled

**All nine were cleared by batch X8 on 5 Sep 2026, and the entries are kept below
with what they turned out to be, because four of them were wrong about their own
subject and that is the useful part.** Nothing on this list is open.

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
- ~~**Sydney's ferries and the Harbour Bridge traffic** are drawn and not solid.
  All are on water or on a deck whose reachability is unproven. Confirm
  reachability first; collide only what a player can reach.~~ **The two answers
  are opposite, and both are now measured.** Sydney's eleven are half a minute's
  swim from the sea wall and inside the chapter's own `bounds()`, so they have
  hulls — and carry, which needed both ferry legs pulling inside the world.
  The bridge deck is unreachable: thirty-two swim legs against the bluff, a pylon
  and a pier top out at 2.28 m against a deck at 25, the chapter has no
  `climbHold`, and Bradleys Head measures the same as a control — so the deck
  keeps no floor and the traffic keeps no bodies. See X8 §9.

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
- `qa/px-bridge.js` … `-bridge6.js` (X8) — the reachability suite, and the best
  worked example in this file of a probe lying four times before it told the
  truth. `-bridge` rays the physics world along the carriageway and drops the
  animal on the deck; `-bridge5` swims at the bluff, a pylon and a pier from
  open water on both keys; `-bridge6` does all four sides and all four keys with
  Bradleys Head as a control. **Read the four failures before writing another
  reachability test**: `-bridge` placed the animal at bluff.z + 34 when the bluff
  radius is 42, so it started INSIDE the rock and read the solver's ejection as
  a 25 m climb; `-bridge2` proved that by logging the first sample (already y
  25.34, grounded); `-bridge3` then looked for water with
  `terrainHeight < waterLevel` and found none anywhere, because Quay reports
  terrain 0 over open water against a waterLevel of −0.5; and its first swim
  held the wrong key, because which of W and S faces a target depends on the
  camera's yaw and had been assumed. Only `-bridge5` onward — start in water the
  chapter agrees is water, run every key, keep the leg that closes the distance —
  is worth a number.
- `qa/px-syd-traf.js` … `-traf5.js` (X8) — Sydney's harbour traffic, before and
  after it had hulls. `-traf` tests the reachability claim in the chapter's own
  comment against the chapter's own `bounds()`; `-traf2` checks every drawn
  instance has a body on it (worst offset over 440 samples, which is the test
  that catches a carrier drifting from its picture); `-traf3` rays each beam,
  and its standoff column reads the half-extents back to the centimetre; `-traf4`
  is the unkind one — the animal placed inside a hull and left in the path of
  one; `-traf5` rides each ferry for twenty-five seconds and counts frames
  outside the world. **`-traf2`'s own failure is worth keeping**: it tried to
  shove the animal with a velocity write, and capybara.js owns the animal's
  velocity every frame, so the shove was gone before the next step. Drive it
  with keys or do not drive it.
- `qa/px-claims.js` / `-claims2.js`, `qa/px-drift-hop.js`, `qa/px-drift-arch.js`,
  `qa/px-ant-wreck.js` (X8c) — the reachability-claim sweep. Each takes one
  sentence out of a comment and measures it from legal ground or legal water on
  every key. `px-drift-hop` is the one to copy for a JUMP: it takes the
  clearance over the ground under the animal at every sample and counts the
  samples that left the island, because the first version measured against a
  fixed datum and reported 4.54 m and 0.74 m for the same jump.
- `qa/px-syd-detach.js` (X8) — three chapters, and whether a body added by one of
  them is gone in the other two. `game.env` is Sydney's and stays resident, so
  anything given to it has to be shown to detach; the signature is the shape's
  own half-extents, which is cheaper than tagging.
- `qa/surf-a.js` … `surf-c.js` — the force-channel probes behind batch X4's
  tables: slip speed per surface, the geyser launch, the storm.

- `qa/px-x5-walk5.js` (X9) — the X5 walk rig with faults 5 and 6 out of it. It
  DROPS the animal from 3 m and ticks until it settles, and it reports `onBuilt`,
  the height of the surface it landed on above the terrain datum: Kowloon's
  `(5, −65)` reads 5.16, which is the pontoon deck the old rig walked 3.6 m
  underneath. Both rays now originate at the settled position.
- `qa/px-x5-id.js` (X9) — what the drawn face actually IS: the hit object's full
  ancestor chain, geometry type, material colour and world bounding box. It is
  what turns "belongs to some other builder, still unidentified" into a name.
- `qa/px-x5-norm.js` (X9) — **the wall test.** Casts at ankle, chest and head and
  reports the world normal of each hit. A wall is the same distance at all three
  with `ny` near 0; a slope runs further at head height; an overhang reads
  `ny −0.98`. Repeated three times per point, because a face that moves between
  reps is a person and belongs to X6.
- `qa/px-cam-v.js` (X9) — the eye raise, pinned, in three states. The only way to
  read a camera change is to stop the animal moving; this is the shape to copy.
  It reports Δpitch, Δeye-height and Δboom between V held and V not held.
- `qa/px-x5-rerank.js` (X9) — **the whole candidate list through the wall test.**
  99 non-vegetation samples from `audit-solid.md` over 15 chapters, each settled
  and classified wall / ground / slope / overhang / low / gone. This is the shape
  to re-run whenever the solid audit is re-run; the audit's own instrument
  nominates four different things and calls them all walls.
- `qa/px-x5-name14.js` (X9) — names the survivors: ancestor chain, geometry type,
  instance count, material colour and world bounding box. A list of coordinates
  is raw probe output, which is the criticism X9 levelled at the camera audit.
- `qa/px-cam-dive.js` (X9) — the eye raise during a REAL dive, with a control leg
  that runs the same dive without the key. Holds E rather than pressing it, and
  asserts `capy.diving` before believing a number.
- `qa/px-dri-slope.js` (X9) — the Drift's terrain gradient, split into island
  interiors and island rims, plus the same aggregate at four sample spacings.
  The refinement column is the point: a gradient converges, a step does not.

The five findings files this review produced are in `qa/audit-2026-09-04/`.

## What this review did not finish

**Written 4 Sep 2026, about that session. Batches X5 and X7 closed most of it and
X9 closed the rest; it is kept here as written, with what happened, because
carrying this paragraph forward unchecked is itself the mistake X9 found.**

Said plainly, because the next pass should not assume otherwise. ~~The
walk-into-the-face confirmation for the batch X5 candidates never ran — the
page timed out and the session ended.~~ **It ran, over four X5 commits and again
in X9; the candidate list is empty and nothing needed colliding.** ~~The camera
audit produced its code inventory and its wall probe but never its write-up, so
its findings here are drawn from the raw probe output rather than from an
analysed table.~~ **Written up in X9; two of its claims were already fixed and its
one open measurement is made.** And no chapter was played end to end by a person;
everything above is instrumented. **That one is still true, and it is the only
one of the four that is.**

## What X9 did not finish

One thing, and it cannot be done by an agent: **no chapter has been played end to
end by a person.** See batch X9 item 4.

~~Two smaller debts it created rather than closed.~~ **Both closed the same day.**
The dive is measured with a control leg (`px-cam-dive.js`) and the answer is
unchanged: V is inert underwater. The full candidate list is re-ranked
(`px-x5-rerank.js`, `px-x5-name14.js`) and area 2 above carries the result.

What that leaves is **three named faces and one decision**, all small, none
urgent, and none of them safe for a probe to settle on its own:

- ~~**Pasto's twelve bunting posts** are drawn and not solid, at 22 cm square.
  Collide them or write down that thin plaza furniture stays open — either is
  defensible, and the contract should say which.~~

  **COLLIDED, 9 Sep 2026, and the contract says so.** The test this document
  named is the Göreme one — the fan was left open BECAUSE A TASK RUNS THROUGH
  IT — and it comes out the other way here: all twelve stand at x ±22.5, two
  columns 1.5 m inside the plaza's rim rather than scattered across it, and the
  carroza's line is 10.4 m clear. MEASURED: ten of the twelve went straight
  through and the other two already stopped you on market furniture, which is
  an inconsistency no player could see a reason for. Twelve of twelve stop now,
  at the drawn post's own face to the centimetre. Soaked rather than argued:
  fuzz 19/0/0 with Pasto's stuck-frame count going 466 → 395 across the change.
  `qa/px-pasto-bunting.js`, CONTRACT.md.
- ~~**Kyoto's 32 × 22 × 2.4 m mesh at x −50…−18, z −3…19**~~ and ~~**the Cave's
  32 × 15.6 m slab at z −200**~~ are wall-shaped, unsolid, and their builders are
  not identified. ~~The Cave one matters most: a 32 m face at the end of a chamber
  that is not solid is a way out of the mountain.~~

  **THE CAVE ONE IS SETTLED, 9 Sep 2026, AND IT IS NOT A WAY OUT OF THE
  MOUNTAIN.** It is `cavExitJungle`, the silhouette in front of the bright plane
  in `cavBuildExit`, and it stands beyond the OUTER face of a fourteen-metre
  wall whose inner face is solid: driven at hard from the passage floor and from
  sill height, the animal stops at z −182.3 every time, seventeen metres short of
  it. The slot over the sill is 2.8 m up and the best hop the game has peaks at
  13.86 — 1.44 m short, identically from a standstill, a run and a long run.
  Placed out there by force it falls and the rescue returns it. **It stays open,
  and the four meshes in that function are named now** — the audit could not
  identify a builder because every one of them went in anonymous, which is the
  transferable finding. `qa/px-cave-slab.js`, `qa/px-cave-sill.js`, CONTRACT.md.
  **KYOTO'S IS FIXED, 9 Sep 2026, AND IT WAS THE OPPOSITE FINDING.** It is
  `kyoBuildZen`'s wall round the dry garden, and its south side has been
  collided in two pieces with a gap between them since it was built — *"the
  south wall has a gap in it, or nobody could get in to spoil it"*. The wall
  was DRAWN straight across the full width with a 4.4 m gravel-coloured panel
  painted on the middle, so the player met an unbroken 1.9 m earth wall and
  walked through it. MEASURED, a ray sweep along the whole face: no gap drawn
  anywhere, a 6.5 m gap in the physics, and a walk test that got in at x −37,
  −34 and −32. The wall is two segments now, on the colliders' own numbers, and
  the walk results are identical — nothing about where you can go changed, only
  whether you can see it. `qa/px-kyoto-zen.js`, CONTRACT.md.

  **The two of them together are the lesson.** Same instrument, same words, and
  one is scenery seventeen metres behind a solid wall while the other is a
  doorway in the chapter's main garden. A wall audit cannot tell them apart,
  because both are "drawn geometry with no physics behind it" — what separates
  them is whether a player can stand where the sample was taken, and neither of
  X9's numbers said.
- ~~The audit's `recessed` category was never re-measured at all.~~ **DONE,
  9 Sep 2026.** `qa/px-recessed.js` re-walks all thirty-two as a player and
  `qa/px-recessed-why.js` names what each one is inside. Eighteen of the
  thirty-two were answered by re-walking them rather than by fixing anything:
  the face has gone (8), nothing stops you at all (3), or the number moves
  between identical runs because the chapter does (7 — all five Drift rows,
  plus one Iceland and one Cali; Drift (−47, −110) read −0.35, 1.71 and 1.68 on
  three runs). The Göreme cliff was the one real cause and is fixed; four
  remain, each a single axis-aligned box inside a tapered rock, which is a
  different project from fixing a loop. The talus — 46 boulders 0.5–2 m drawn
  and not collided at the cliff's foot — is the bunting-post question again
  with a bigger object, and is named in CONTRACT.md rather than answered.

  **And the instrument is the lesson, one level up.** A grid-sampled audit
  records a coordinate and a distance, and neither says whether a player can
  stand there, whether the geometry is still there, or whether it holds still
  between two runs.
