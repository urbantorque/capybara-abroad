# The character pass: six no-regret changes to the cast

Written 6 Sep 2026 as an art-direction review and a production hand-off. It
sits beside `ROADMAP-FINISH.md` and does not duplicate it: the finish pass was
about wiring, this is about what the animal and the people look like. Nothing
here touches physics, tasks, or the score. Every item keeps the contract's
aesthetic law (flat Lambert, no textures, palette only, no outlines) and the
budget gate, and every item is scoped so it can be reverted by one commit.

Method: read `capybara.js` (the rig, the face, the wardrobe), `npc.js` (the
instanced roster, the hand-built locals, the beasts, the faces), `condor.js`
and the herd in `pantanal.js`; then thirty-eight fresh renders under
`playwright-cli` on the dev server at 5188 with the review's own camera, in
Sydney, Pasto, Venice, Monte Carlo, Antarctica, Kyoto and the Pantanal. The
renders are `qa/AR-*.png`, `qa/AR2-*.png`, `qa/AR3-*.png`, and the review
crops are `qa/art/*.png`. Instruments: `qa/art-review.js`, `qa/art-review2.js`,
`qa/art-review3.js`, `qa/art-review4.js`, `qa/art-thumb.cjs`.

Every render below is the raw scene pass with the review camera, not the
composite: the model is judged as a model. The two `AR-play-*.png` frames are
real `page.screenshot` frames through the composite at playing distance, and
they are the frames every decision here was checked against, because the
game is played at six to nine metres and a change that only reads at two is
a change that exists in the file and not on the screen.

---

## The measured state

| what | value | where |
|---|---|---|
| capybara, bare | 39 meshes, 1 460 triangles | `qa/art-review4.json.png` |
| capybara in black tie / in the parka | 57 meshes, 1 812 tris / 54 meshes, 2 108 tris | same |
| capybara materials | 3 body values + nose + eye, all `matSelf`/`mat`, no vertex colour, no grain | `capybara.js` MATERIALS |
| capybara body | 4 sphere blobs (8x6) + 4 shoulder blobs + 1 tail blob | `capybara.js` RIG |
| capybara head | 2 boxes + brow box + 4-sided nose prism + 2 beads (6x4) + 2 brow bars + 6 whiskers + 2 ear blobs + jaw box + mouth plate | same |
| roster person (Sydney 32, Pasto 13) | 12 to 15 instanced parts, 352 tris per person, one flat colour per part | `npc.js` `npcMakeGeo`, `paColorHuman` |
| roster face | one eye pair + two brow bars, 2 draw calls per cast | `npcFace` |
| hand-built local (chapters 3 to 19) | 15 boxes, 3 draw calls per person for the face, one flat colour per box | `buildLocalFigure` |
| local's hat | a 0.42 x 0.05 x 0.42 plate, no crown | `npc.js:1241` |
| builds | 3 archetypes + child on both casts; height spread 1.58 to 1.83 m | P5 |
| animal's own rim | 0.14 default, per-chapter table 0.048 to 0.26, 62% toward white | `sysSELF`, `matSelf` |
| shadow | PCFSoft, plus the contact pool; whiskers do not cast | `main.js:1664`, `_contact*` |
| budget gate | 5.5 ms cost; triangle line 130k; ratchet per chapter +6 000 | CONTRACT ➜ THE BUDGET |

The animal costs 1.1% of Sydney's triangle count and its 39 draw calls are
the most expensive thing about it. That is the budget this document spends:
**no item below adds a draw call to the animal, and two of them remove some.**

---

## What the renders say

### The capybara

The rig is good and the animation is better than the model. Walk, run, hop
tuck, landing absorb, the loaf, the ear lag, the blink, the sniff and the
wheek all read at playing distance, and the face system (two beads in yawed
sockets, two bars) does what P5 and D8 built it to do. What is left is the
shape and the surface.

1. **The body is three balls.** Barrel, saddle and rump are three 8x6 spheres
   and from the side and the rear three-quarter they read as three objects:
   a seam where the rump meets the barrel, a facet ring round each, and a
   top line that goes up, down, up. A capybara's read is ONE deep barrel that
   rises to the rump; the highest point of the animal is over the hips, not
   the shoulders. `qa/art/capy-side.png`, `qa/art/capy-rear.png`.
2. **The animal is one flat brown.** Three palette values exist and two of
   them are almost never on screen: the belly band is hidden behind the
   shoulder blobs and the legs from every playing angle, and `capyDark` is
   only on the legs, jaw and ears. From above (the resting lens) the animal is
   a single value with facets. A real coat is darker along the spine and
   redder on the flank and pale under the jaw and belly, and that gradient is
   the whole reason a capybara does not look like a brown loaf.
   `qa/art/capy-top.png`, `qa/art/play-sydney.png`.
3. **The muzzle is a brick, and the nose reads pale.** The snout is a box with
   90-degree corners, the nostril pricks are on its FRONT face, and the nose
   pad, whose palette value is 0x5f3d29, renders as a pale grey plate from
   the front and from three-quarter in every daylight shot taken (dark only
   in the wheek shot, where the head is pitched). Real capybaras carry the
   nostrils on TOP of a deep, rounded muzzle, high enough to breathe while
   the rest of the head is under water, and that is the second-strongest
   species tell after the no-neck. `qa/art/capy-head.png`, `qa/art/capy-3q.png`.
4. **The eyes are dark hexagons.** A 6x4 bead at 4.6 cm reads at two metres
   as a black hexagonal hole with a facet edge, and the catchlight bead is
   too small to register. At playing distance both are fine dots; at the
   arrival lens and every marquee they are not. `qa/art/capy-head.png`.
5. **The feet are dice.** Each foot is the unit box, and in the loaf the
   rear feet are the most visible part of the animal, sticking out behind the
   rump as two blocks. `qa/art/capy-3q.png` (rear feet), `qa/art/capy-rear.png`.
6. **At rest, nothing moves but the eyelids.** The idle picker gives the
   animal a shake, a chew, a breath-on-low-stamina and the loaf, and between
   beats the model is frozen for six to seventeen seconds: no ribcage, no
   weight. The crowd already breathes (`animHuman`'s `breathe` on the bob);
   the star does not.

Costumes: the sun hat is the best object in the wardrobe and is worn exactly
right. The dinner jacket's lapels read as two black slabs on the shoulders
from front three-quarter, which is the failure the wardrobe note already
names (two symmetric boxes read as a shard). The parka's eleven-bead ruff
reads as a string of pearls rather than fur. Both are R6 items, not blockers.

### The instanced roster (Sydney, Circular Quay, Pasto)

The box-person is the right idiom for the benchmark and the three builds plus
the child do their job: the crowd no longer reads as one man printed
forty-five times. Four things hold it back, and every one is a colour, not a
shape:

1. **Every part is one flat colour.** Shoes are trouser-coloured because the
   shoe is part of the leg geometry; hands are the arm's colour; the hat has
   no band; the hair has no part. A person at six metres is a stack of five
   flat blocks. `qa/art/tourist-front.png`, `qa/art/gardener.png`.
2. **The eyes are two dark slots.** No white, no lid, so a face at rest reads
   as sunglasses. The brows work (the expression matrix is good) but they are
   the only thing on the face that changes value.
3. **The arms are pegs.** A straight 0.48 m box with a cube on the end and no
   elbow, which is fine in the walk and wrong in every carry pose (the tray,
   the camera, the rake) where the forearm should turn.
4. **There is no underside.** With one colour per part, the underside of the
   hat brim, the under-jaw and the inside of the sleeve are the same value as
   the lit top, so a person has no weight on the ground beyond the shadow.

### The hand-built locals (chapters 3 to 19)

Same idiom as the roster, hand-placed, plus a collar. Two findings:

1. **The hat is a plate.** `buildLocalFigure` puts a 42 cm square, 5 cm thick,
   flat on the head with no crown, so a Venetian in a hat wears a board.
   `qa/art/venice-local.png`.
2. **The face is right and the body is generic.** Kyoto's local in the dark
   kimono-block reads as somebody; Venice's in white reads as anybody. The
   difference is entirely the colour blocking, which is a per-chapter table
   already (`npcLOC_SHIRT` etc.). This is content, not a rig fix, and it is
   not in this roadmap.

### The animals

- **Ibis**: good. Two values, the curved beak from four cylinders, the walk.
  `qa/art/ibis.png`.
- **Condor and fragata**: strong from above, which is the only angle a rider
  has, and the ruff decision is right. From the side the body is a box with a
  white collar that reads as a shirt. Not worth a task.
- **Llama, street dog**: box silhouettes that read at playing distance
  (`qa/art/play-pasto.png`). The dog's collar is already a separate box; the
  llama's face is one value. R6 covers both for free.
- **The herd (Pantanal cattle)**: a brown boulder with legs, small head, no
  horn, no ear read. At the distances the herd is seen it works; a horn box
  would sell it and is a fifteen-minute R6 line.

---

## The roadmap: six changes, ranked

Ranked by impact at playing distance divided by the chance of breaking
something a previous pass measured. All six are inside the aesthetic law.
"No regret" means: no new draw calls on the animal, no change to any number
another system reads (apex, collider, `capyFOOT_Y`, the brow signs, the mouth
anchor), and a revert is one commit.

| # | change | team | impact | risk | cost |
|---|---|---|---|---|---|
| R1 &check; | **The coat.** *(built 6 Sep 2026.)* Vertex-colour gradient and crevice shade on the animal: dark spine, red flank, pale belly and throat, dark in the leg roots and ear cups. | shading | high: fixes finding 2 in every frame of the game | low: 0 draw calls, no geometry, `vertexColors` is already how the crowd is drawn | 2 h |
| R2 &check; | **One hull.** *(built 6 Sep 2026.)* Replace barrel + saddle + rump + four shoulder blobs with one hand-authored low-poly hull, high over the hips. | modelling | high: fixes finding 1 from every angle; the top line becomes the animal's line | low-medium: costume shells are fitted to the old blobs; the ghost bake and `wetParts` list change | 3 h |
| R3 &check; | **The muzzle and the eyes.** *(built 6 Sep 2026.)* Bevelled deep muzzle, nostrils on top, a nose that measures dark, 8x6 eye beads with a real catchlight, a cheek mass under the eye. | modelling | medium-high: the head is what the lens is on at every arrival and marquee | low: contained to the `head` group; sockets, brows, whiskers, jaw, eyewear all keep their transforms | 2.5 h |
| R4 &check; | **Feet, toes, and the loaf.** *(built 6 Sep 2026.)* Chamfered feet with four front toes and three rear, an ankle band, and a loaf that tucks the rear feet under. | modelling + animation | medium: fixes finding 5, and the loaf is the most-photographed pose after the walk | low: leg pivots and `capyFOOT_Y` unchanged | 1.5 h |
| R5 &check; | **Breath and weight.** *(built 6 Sep 2026.)* A resting breath folded INTO the squash writer, a head settle after the landing spring, and a tail that answers the wheek. | animation | medium: fixes finding 6; the animal is alive between idle beats | low, provided the one-writer rule is kept | 1 h |
| R6 &check; | **The second colour, everywhere.** *(built 6 Sep 2026.)* A per-part colour in `npcMakeGeo` so shoes, cuffs, hat bands, eye whites and undersides are baked into the instanced buffers; a real hat for the locals; the tux lapels and parka ruff rebuilt as rings. | shading + modelling | medium-high: touches every person and beast in nineteen chapters at zero draw calls | low: the col attribute already exists and is filled with 1; the change is what gets written into it | 2.5 h |

Not on the list, and why:

- **A fur texture or normal map.** Forbidden by the contract, and not needed:
  the gradient in R1 is what a low-poly coat is.
- **Elbows for the roster.** A forearm node is a new instanced buffer and a
  new draw call per cast, plus a write in `pushInstances` for every carry
  pose. Medium impact, medium risk, and the arms-as-pegs read is inside the
  idiom. Second pass, if ever.
- **A neck for the capybara.** No. The no-neck is the animal.
- **Higher segment counts.** The contract caps spheres at 8x6 and cylinders
  at 8; R2 and R3 stay inside it by hand-authoring the two shapes that matter
  and leaving every bead where it is.

---

## What must not change

Every one of these has been measured by a previous pass and is read by
something else. A hand-off that moves one of them is a regression, however
good the model looks.

- **The hop.** Standing hop 0.93 m, arc 1.37 m. Nothing here touches the
  collider or the launch; assert the apex in the A/B anyway (`qa/skillsoak.js`
  pattern).
- **The collider** is three spheres and is not the model. `capyFOOT_Y` 0.34
  stays; the model's feet stay at model-space y = 0.
- **The brow signs.** `capyFacePose` and `npcFace` are load-bearing on sign;
  R3 moves the eye bead and leaves the socket yaw (±0.62), the brow rest
  height and both tilt constants alone.
- **The mouth anchor** at (0, 0.445, 0.76) in `capyModel` space, outside the
  squash. The muzzle may change shape, not where the held prop hangs.
- **`wetParts`.** Every new body mesh joins the list with a wet twin, or it
  comes out of the harbour a different colour.
- **The ghost bake** walks `capyModel` for visible meshes. A hull is one more
  mesh in that walk; vertex colours are ignored by the bake and that is fine.
- **The wardrobe rule.** Costumes stay two groups, one on `capySquash` and one
  on `head`, built once, hidden, never in `wetParts`.
- **One writer per channel.** `capySquash.scale`, `mesh.scale`, the leg
  phase: R5 adds terms inside the existing writer, never a second writer.
- **The budget.** Animal ≤ 2 000 triangles bare, ≤ 2 600 in any costume;
  0 new draw calls on the animal; 0 new instanced buffers on either cast.
  `qa/budget.js` green, ratchet untouched.
- **The clone trap.** A cloned material loses its rim hook. R1's materials are
  built with `matSelf(color, { vertexColors: true })`, never cloned.

---

## Production hand-off

Units are metres, model space, feet at y = 0, animal facing +z. "Segments"
means the contract's caps. Every task names its acceptance instrument;
"shots" means the review sheet re-run (`playwright-cli -s=art open
http://localhost:5188/` then `run-code --filename=qa/art-review.js`) and the
crops rebuilt with `qa/art-thumb.cjs`, so the after can be laid beside the
before at the same crop.

### R1 · The coat (shading) &check;

**Files.** `capybara.js` MATERIALS and RIG; `shared.js` PALETTE (two new
values).

**What to build.**

- Give each body part its own geometry clone with a `color` attribute.
  `capyGeoBlob` is shared by barrel, rump, saddle, belly, ears, tail and the
  shoulder blobs; a vertex colour on the shared buffer would colour the ears
  with the barrel's gradient. Clone per part, at create, once.
- Materials: `matSelf(PALETTE.capy, { vertexColors: true })` and the same for
  the two wet twins and `mBelly`. `_rimWants` returns true for that option
  set, so the animal keeps its own rim. Do not clone.
- The gradient, as multipliers on the palette value (vertex colour multiplies):

  | region | multiplier (r, g, b) | where |
  |---|---|---|
  | spine, within 0.06 of the dorsal centreline | 0.80, 0.74, 0.70 | barrel, saddle, rump top |
  | flank | 1.00, 1.00, 1.00 | the palette value, unchanged |
  | lower flank into belly | 1.10, 1.06, 0.98 | below y 0.30 in model space |
  | throat, under the jaw | 1.12, 1.08, 1.00 | the 4 cm under the jaw front |
  | leg roots and shoulder crease | 0.78, 0.74, 0.72 | the inner faces of the shoulder blobs and the top of each shin |
  | ear cup interior | 0.70, 0.66, 0.64 | the -z face of each ear blob |

  Write it as a function of the vertex's model-space y and |x|, not as
  hand-painted values, so R2's hull gets the same coat by calling the same
  function.
- Two palette entries so the numbers live where the contract says colours
  live: `capySpine` (0.80 of `capy`, cooled: 0x8d5f3a) and `capyThroat`
  (0xc99a6e). Check both against the wardrobe rule (a costume the colour of
  the animal is a lump): `capyLeather` 0x453729 and `capyParka` 0xc4453d
  are still four levels away.

**Reference.** A capybara's coat is coarse and sparse: guard hairs on the back
are dark reddish-brown to near-black along the midline, the flank is a warm
red-brown, and the belly and throat are yellow-brown with the skin showing
through. The gradient is vertical, not front-to-back.

**Acceptance.** A new probe, `qa/coat-probe.js`: render the top view
(`AR-capy-top`) and the side view, sample the mean luminance in a 12 px box on
the spine and a 12 px box on the lower flank, and report the ratio. Target
spine/flank 0.80 to 0.86; before this task it is 1.00 by construction. The
P1 silhouette contrast (`sysSELF` measurement) must not drop below its
recorded per-chapter number. `qa/wear-smoke.js` unchanged. `qa/fuzz.js` 19/19.


**Built 6 Sep 2026. What it measured, and the two numbers the plan above got
wrong.** The code is `capybara.js` THE COAT (R1) plus the three stops in
`shared.js`; the instruments are `qa/coat-probe.js` (the gradient),
`qa/coat-silh.js` (P1) and `qa/coat-states.js` (the wardrobe and the ghost).

| | planned | built | why |
|---|---|---|---|
| spine band half-width | 0.06 full, 0.10 out | 0.10 full, 0.20 out | at 0.10 the band contains exactly one vertex meridian of an 8x6 sphere and renders as a seam; 0.20 also reaches the skull box's top corners at \|x\| 0.18, and without them the head stays a brighter block in front of a darker back |
| flank | `capy`, unchanged | `capyFlank`, `capy` x 1.077 | see below |
| palette entries | 2 (`capySpine` 0x8d5f3a, `capyThroat` 0xc99a6e) | 3 (`capyFlank` 0xbe8150, `capySpine` 0x985f38, `capyThroat` 0xd58b50) | the two planned values did not equal their own stated multipliers; all three are now derived from the flank and converted through THREE.Color |

**The flank is the finding.** Hung off `capy` with the flank left at 1.00, this
gradient is one wide darkening against two small brightenings, so it does not
redistribute the animal's light; it removes 4.6% of it. That is free contrast
on a bright ground and a straight loss on a dark one, and the loss lands
hardest on the chapter that can least afford it:

| chapter | silhouette contrast, coat off -> on, flank at 1.00 |
|---|---|
| sydney | 41.1 -> 45.8 |
| sahara | 55.0 -> 61.4 |
| antarctic | 49.4 -> 44.8 |
| **cali** | **23.5 -> 17.9**, a quarter of the weakest silhouette in the game |

No gradient raises contrast in every chapter: a darker animal helps on light
ground and hurts on dark. So the target is not "better everywhere", it is
MEAN-NEUTRAL: change the variance and leave the average alone. 1.077 is
the warming that does it. Re-measured with the flank stop in:

| chapter | mean animal luminance | contrast off -> on |
|---|---|---|
| sydney | 104.6 -> 104.4 | 41.1 -> 41.5 (+1.0%) |
| cali | 106.9 -> 106.4 | 21.8 -> 21.3 (-2.5%) |
| sahara | 120.6 -> 120.1 | 56.1 -> 56.8 (+1.3%) |
| antarctic | 110.2 -> 111.5 | 36.8 -> 38.1 (+3.4%) |

Cali's remaining half-grey-level is inside that chapter's own run-to-run
spread: its coat-off baseline came back 23.5, 24.9 and 21.8 on three runs of
the same probe. Do not tune against it further without first making that
number repeatable. It is the fourth instrument in this document that cannot
hold a line.

**The gradient, measured** (`qa/coat-probe.js`, the A/B is the same frame with
the colour buffers flattened, so there is no second lighting state and no
second pose):

- spine/flank in the roadmap's own two boxes: **0.861** broadside and **0.772**
  from above, against 1.032 and 0.917 before. The 0.80 to 0.86 window predicted
  above is bracketed by the two views rather than hit by either.
- the whole vertical cut, coat on over coat off: **0.849 at the top of the back
  to 1.064 at the belly**, a 25% swing where the animal previously had none.

**The gates.** `qa/fuzz.js` 19/19, no errors, no NaN frames, nothing below the
void plane. `qa/wear-smoke.js` unchanged to the mesh: bare 39, black tie 57,
parka 54, ghost bakes the animal and puts the costume back. Budget unchanged
and measured, not asserted: **39 meshes, 1 460 triangles, 140 draw calls, and
the identical figure with the coat flattened.** One extra shader program, once,
at boot: `vertexColors` is part of three's own program cache key, so the
animal's six materials stop sharing the scenery's compiled program. That is a
compile, not a draw.

**Four things the next task should know.**

1. **A fur material with no `color` attribute renders BLACK**, not a warning.
   So the paint is a traverse that finds its meshes by material, and
   `coatAudit().bare` must be 0. It is 0; 31 meshes carry a coat.
2. **Both twins of every soak pair need `vertexColors`.** The swap writes
   `mesh.material` and never touches the geometry, so the pairing is the
   invariant. `coatAudit` reports it for all six at once, which is a stronger
   test than a picture of a wet animal.
3. **A costume re-asserts itself every frame.** `systems.js` calls
   `capy.wear(put)` in its update, so a probe that ticks between `wear` and
   its render photographs a naked animal and reads it as a broken wardrobe.
4. **R2 inherits all of this for free.** The hull calls `capyCoatAt` with a
   model-space position and gets the same coat; `capyCoatNook` gives it the
   crease. Neither knows anything about spheres.

### R2 · One hull (modelling) &check;

**Files.** `capybara.js` RIG; the black-tie and parka shells in THE WARDROBE.

**What to build.**

- One hand-authored `BufferGeometry`, 260 to 320 triangles, flat-shaded (no
  index, per-face normals), replacing barrel, saddle, rump and the four
  shoulder blobs. Seven meshes become one; the bare animal goes from 39
  meshes to 33 and from 1 460 triangles to about 1 250.
- Proportions, in model space, feet at y = 0:

  | station (z) | half-width | top (y) | bottom (y) | note |
  |---|---|---|---|---|
  | +0.34 (shoulder front) | 0.27 | 0.66 | 0.22 | buries the skull's rear face at z 0.08; no seam from behind |
  | +0.10 | 0.32 | 0.70 | 0.17 | deepest station; this is the barrel |
  | -0.15 | 0.31 | 0.72 | 0.18 | the top line is still rising here |
  | -0.38 (over the hips) | 0.28 | 0.735 | 0.24 | the HIGHEST point of the animal |
  | -0.55 (rump) | 0.14 | 0.60 | 0.38 | closes to the tail blob |

  The cross-section is a flattened D: flat-ish along the top, widest a third
  of the way down, tucked under. Eight or nine sides per station is enough;
  more is a smooth shape, and a smooth shape is the wrong shape here.
- Keep the old blobs' outer extents as the hull's maximum, or the costume
  shells stop being proud of the body. The tux shell is 1.5 cm proud of the
  barrel on every axis but the front; refit both shells to the hull with the
  same margin, and the parka's ruff arc keeps its symmetric 0.95 rad gap.
- The belly blob stays as a separate mesh: it is the only `capyLight` on the
  animal and it wants to remain a band under the hull, 1 cm inside the hull's
  lower surface so it emerges rather than z-fights.
- The hull joins `wetParts` with a wet twin. The four shoulder blobs' entries
  come out of the list.
- Run the coat function from R1 over the hull's vertices.

**Reference.** Head-and-body length 1.06 to 1.34 m, shoulder height 0.50 to
0.62 m, the back rises from the withers to the rump, and there is no waist.
The game's animal is deliberately chunky (1.33 m nose to rump, 0.73 m at the
back); keep that.

**Acceptance.** `qa/wear-smoke.js` (31 bare becomes 25; every costume still
+4 to +18; exactly one on after ten swaps). The ghost bake count follows.
`qa/b4-pose.js` for the slope pose (the hull's bottom edge against the
drawn ground on walkable slopes, previously 45 cm foot-to-ground spread was
the bug, not the number to keep). The shots: side and rear three-quarter
must show one top line and no seam at the rump. Triangles and draw calls
in `qa/art-review4.js`'s budget block.


**Built 6 Sep 2026. The table, what it cost, and the two costume parts it
buried.** The code is `capybara.js` THE HULL (R2) plus the four call sites in
the rig and the wardrobe; the instruments are `qa/hull-probe.js` (the top line,
the gradient and the pad), `qa/wear-fit.js` and `qa/wear-parts.js` (the shells),
`qa/hull-stand.js` (the standing pose and the apex).

| | planned | built | why |
|---|---|---|---|
| triangles | ~260-320 | 168 | twelve sides and seven stations reads as a body; the roadmap's count assumed more of both, and a smoother section is the wrong shape here |
| rump station | z -0.55, half-width 0.14, closing on the tail | z -0.55 at 0.19, then a blunt cap at z -0.60 at 0.105 | at 0.14 into a 0.05 cap the animal ends in a BEAK. A capybara's rump is cut off square; the tail nub moved back to z -0.615 to sit on the new cap |
| chest station | z +0.34 is the front | ...and a closing station at z +0.46 | a hull that simply stops at 0.34 is a flat wall under the chin. The cap is at 0.15 half-width and y 0.370-0.580, which is INSIDE the skull box on every axis |
| the four shoulder blobs | deleted | deleted, and their crease moved into `capyCoatAt` | R1 hung that crease on the blobs through the `nook` mechanism. It is a fact about a PLACE, so it is now four soft wells low under the body at the leg roots, and the belly's own corners pick it up for free |
| the breath | not mentioned | moved onto the hull, one factor, pivot at the belly line | see below |

**The top line, measured off the buffer** (`hull-probe`, highest vertex on the
centreline per 10 cm of z, so it cannot be argued with):

| z | +0.5 | +0.3 | +0.1 | -0.2 | **-0.4** | -0.5 | -0.6 |
|---|---|---|---|---|---|---|---|
| top y | 0.577 | 0.656 | 0.696 | 0.716 | **0.731** | 0.612 | 0.542 |

One line, rising the whole way to a single peak over the hips and then falling
to the tail. Before, it was three arcs with two creases in them.

**The budget.** 39 meshes and 1 460 triangles become **35 meshes and 1 356
triangles**: seven body parts became one and R3 added two cheeks. Draw calls
on the animal are its visible meshes, so that is four fewer. No new material
that is not on the same program: the nose pad's `matSelf(..., vertexColors)`
shares the cache key the other six already have.

**What it cost, and it is a real number.** `qa/coat-silh.js` against the animal
as it was before R1, three runs of each build in one session:

| chapter | contrast, old animal | new, coat off | new, coat on | silhouette px, old -> new |
|---|---|---|---|---|
| sydney | 41.07 | 41.39 | 42.45 | 3 435 -> 3 640 |
| sahara | 56.51 | 55.14 | 56.63 | 2 739 -> 3 991 |
| cali | 23.44 | 20.13 | 19.09 | 2 324 -> 2 558 |
| antarctic | 41.45 | 33.90 | 33.10 | 1 737 -> 1 376 |

Cali loses 4.4 grey levels and its own run-to-run spread is 0.36, so that is not
noise. **It is also not the animal getting harder to see, and the split matters
more than the number.** Cali's animal reads 106.5 before and 105.5 after, which
is one level; what moved was the BACKGROUND term, 82.9 to 85.4, because the
silhouette grew 10% and the pixels it grew into are further away and brighter.
P1's contrast is `|animal - the background it covers|`, and a shape change moves
it for a reason that has nothing to do with visibility. Add it to the list of
instruments that cannot be read naively: this one is not unstable, it is
COUPLED, and it answers a different question once the subject changes shape.
(Antarctic is both: its own spread across three runs of the unchanged build is
37.7, 45.6, 41.0.)

**The breath had to move and could not be preserved.** It was
`barrel.scale.set(0.32 + breath * 0.4, 0.26 + breath * 0.7, 0.42)`, which is 1.25 and
2.69 of itself, and the vertical term was INVISIBLE, because the saddle sat
1.7 cm above anything the barrel could reach and capped the silhouette. With one
hull, 2.69 is a pump. It is 1.25 on both axes about a pivot at the belly line,
which moves the top of the back by the same 2.7 cm the barrel's own top used to
move, and this time you can see it. R5 owns this term next and it is deliberately
one number to re-time.

**THE COSTUME SHELLS ARE CUT FROM THE BODY'S OWN TABLE NOW** (`capyHullFit`),
inflated 1.5 cm for the dinner jacket and 1.8 for the parka, with the bottom
RAISED rather than dropped because a jacket that wraps the belly is a onesie.
This was not tidiness. Both shells were ellipsoids fitted by hand to the barrel,
an ellipsoid peaks in the middle, and this animal now peaks over the hips: the
hull came 11 cm through the back of the dinner jacket. A shell cut from the
table cannot go out of date that way: at every station it is outside the body
by construction, and between stations both interpolate identically.

**...and refitting the shell buried two parts of the tux.** `qa/wear-parts.js`
hides one costume mesh at a time and counts changed pixels over six bearings.
Both lapels came back at 6 and 0, and the pocket square at 0: the hull is 11 cm
taller at the shoulder than the barrel was, so all three ended up inside the
animal. Moved up 18 cm and out onto the new surface; all three draw now. The
probe is the only reason this was caught, and it is worth keeping: a costume
part that is drawn and invisible costs exactly what a visible one does.

It also found one that was already like that. The parka's yoke seam was a 56 cm
bar at y 0.435-0.505 inside a shell 67 cm across; solving the old ellipsoid puts
its front corners 4% of a radius outside and every other corner in, so it was
drawn in every Antarctic frame as a sliver at two corners. It is now 3 cm proud
of the shell's top and 40 cm wide.

**The gates.** `qa/fuzz.js` 19/19, nothing flagged. `qa/wear-smoke.js`: bare 39
becomes **35** (the acceptance above says 31 becomes 25; the delta of six was
right and the base was not, and R3's two cheeks put four of them back), every costume still +4 to +18, exactly one on after ten swaps,
an unknown id undresses, the ghost bakes and puts the costume back.
`qa/coat-states.js`: no black pixels in dry, parka, black tie or ghost, so the
hull and both cheeks carry the attribute, `coatAudit().bare` is 0 over 27
meshes. The legs were not touched at all (no leg node, no foot geometry, no
`capyFOOT_Y`), which is why `qa/b4-pose.js`'s numbers, which move by more than
any effect of this change between two runs of one build, are not evidence
either way. Apex asserted: 0.76 m of rise from a standing press, 0.84 from the
crouch.

### R3 · The muzzle and the eyes (modelling) &check;

**Files.** `capybara.js` RIG, head section only.

**What to build.**

- **Muzzle.** Replace the snout box (0.325 x 0.20 x 0.26) with a hand-authored
  bevelled block of the same footprint: the top edge chamfered 0.035 at
  30 degrees, the two front vertical edges chamfered 0.025, the underside
  square (the jaw hinges under it and the flush edge is what keeps the
  closed mouth seamless). About 40 triangles.
- **Nostrils on top.** Move the two nostril pricks from the front face (z
  0.4995) to the top chamfer, at (±0.036, 0.062, 0.445), and make them
  0.018 x 0.010 x 0.014 elongated along z. This is the species read from the
  resting lens, which looks down on the animal.
- **The nose pad.** First measure why 0x5f3d29 renders pale: sample the pad's
  pixel in `AR-capy-head` and `AR-capy-3q` before touching anything. The
  suspects are the flattened prism's top face taking the sun square on, and
  the pad being on `mat()` rather than `matSelf()`. Then rebuild it as a
  bevelled plate wrapping the front-top edge of the muzzle, on `matSelf`
  with `vertexColors`, 0.70 of `capyNose` on its top face. Acceptance is a
  number: the pad's pixel darker than the muzzle's in the same frame.
- **Eyes.** The bead goes from 6x4 to 8x6 and the catchlight bead from 0.30 to
  0.42 of the eye, moved toward the upper-front of the bead (0.15, 0.50, 0.66
  in bead space) so it is visible from the resting lens as well as from the
  front. Both are inside the contract's cap. The socket transforms, the
  brow bars and `capyFacePose` do not change.
- **Cheek.** One small blob (8x6, scale 0.085, 0.06, 0.07) under and behind
  each eye at (±0.155, 0.02, 0.22) in head space, in `mFur`, joins
  `wetParts`. It gives the eye a lower edge to sit on and separates the skull
  from the muzzle in profile, which is currently a straight line.

**Reference.** The muzzle is deep and blunt, the nostrils sit on its top
surface with the eyes and ears in the same plane above them, so a swimming
animal shows nostrils, eyes and ears and nothing else. The bevel is not
softening: it is where the light changes on a real head.

**Acceptance.** `qa/d8-faceshot.js` (rest, wheek, loaf: mood and blink
numbers unchanged), `qa/crop.cjs` on the eye at x4 to site the catchlight
(D8's method), the pad pixel measurement above, `qa/wear-smoke.js` (the
snorkel and the black-tie eyewear copy the socket transforms and must still
sit on the eye planes: `AR-capy-blacktie-head` re-shot).

**Built 6 Sep 2026. THE NOSE PAD WAS NOT PALE BECAUSE OF ITS COLOUR, and this
is the finding of the whole batch.** `qa/pad-why.js` is an in-frame A/B on the pad's own
visibility, so the "muzzle" sample is literally the pixels the pad was covering,
and a black-albedo pass measures the ADDITIVE term exactly rather than inferring
it:

| | resting lens | front | profile |
|---|---|---|---|
| albedo, pad / muzzle | 0.256 | 0.256 | 0.256 |
| RENDERED, pad / muzzle | **1.120** | 0.950 | 0.596 |
| fraction of the pad's pixel that is ADDED after the albedo | **0.731** | 0.659 | 0.454 |
| ...the same fraction on the muzzle beside it | 0.049 | 0.068 | 0.378 |

Three quarters of a dark brown nose was light the shader ADDS. The rim in
shared.js goes onto `outgoingLight`, so it does not care how dark the material
under it is, and at that additive fraction a BLACK pad still renders at 69 grey
levels, and no colour in the palette could have fixed it. It collected that much
because it was a four-sided TAPERED cylinder squashed to 0.30 in z: a
four-segment cylinder puts its vertex normals on the CORNERS, 45 degrees off the
faces they belong to, and `vRimN` is an interpolated varying, so the rim's
Fresnel saw every face as near edge on and lit the lot.

**The general form, which is worth more than the pad.** The rim is a Fresnel on
an interpolated normal. It is NOT a thing that happens at the silhouette, and
the note in the materials block that kept both accents on `mat()` "because they
are never on the outline" was wrong for that reason. Any low-poly part built
from a primitive with few radial segments, especially one under a non-uniform
scale, will rim as though it were edge on across its whole face. Non-indexed
with per-face normals is immune, and every geometry R2 and R3 authored is.

Rebuilt: a hand-authored plate wrapping the muzzle's front-top edge, on
`matSelf` so it is inside the animal's rim budget and not the scenery's, with
`vertexColors` taking the run over the top down to 0.70 for the sun an up-facing
surface gets. Measured after: additive fraction **0.104** from the resting lens
(was 0.731) and the pad renders at **0.455** of the muzzle (was 1.120). Darker
than the muzzle in the same frame from every bearing, which was the acceptance.

| | planned | built | why |
|---|---|---|---|
| catchlight | 0.42 of the eye at (0.15, 0.50, 0.66) | 0.30 at (0.135, 0.452, 0.597) | the direction was the good half of that idea and the size was not. At 0.42 a 6x4 bead stands a quarter of the eye's radius off it and renders as a pale SPIKE between the brow and the eye. Same 0.30 and the same 6% of protrusion the old one had, swung onto the upper front where the resting lens can see it |
| cheek | 8x6 at scale (0.085, 0.06, 0.07), (±0.155, 0.02, 0.22) | (0.048, 0.050, 0.090) at (±0.150, 0.045, 0.235) | at the planned size it is a ball stuck on the jaw, 6 cm proud of the skull. 1.3 cm proud, and raised until its top edge is level with the bottom of the eye, is the LEDGE the eye needed |
| muzzle | ~40 triangles | 44, four of them degenerate | four horizontal rings, because every feature is a function of height: the corner cut ramps in with y and the top chamfer pulls the front face back with y |

The muzzle's underside stays square and that is structural, not tidy: the jaw is
a solid box tucked flush under it and inset 1.25 cm a side, so a corner chamfer
that ran to the bottom would put the jaw's front corners OUTSIDE the muzzle and
open a seam in a closed mouth. The cut ramps in over the first 3.5 cm instead.
The eyes went to 8x6 for the catchlight's sake rather than their own: a 6x4
sphere's top band is four facets, so a highlight on the upper front lands on one
and switches between two as the head turns.

**Four things the next task should know.**

1. **The rim is a Fresnel on the interpolated normal.** Author flat geometry
   non-indexed, or a dark part will render pale and nothing in the palette will
   save it. See the pad above.
2. **A costume part can be drawn and invisible.** `qa/wear-parts.js` is eight
   lines of hiding and diffing and it found three in one run. Anything that
   changes the body's shape must be followed by it.
3. **P1's silhouette contrast is coupled to the SHAPE, not only the value.** Its
   background term is the pixels the animal happens to cover. Split the two
   before calling a move a regression.
4. **R4 inherits the coat's leg-root wells** (`capyCoatAt`, THE LEG ROOTS): the
   shin's own `nook` and the body's wells are gated apart by `limb` so a crease
   never gets two writers. An ankle band belongs on the shin's tag.

### R4 · Feet, toes and the loaf (modelling + animation) &check;

**Files.** `capybara.js` RIG (legs) and the loaf pose constants.

**What to build.**

- A hand-authored foot to replace the unit box scaled to 0.145 x 0.05 x 0.175:
  the same footprint, the top rear edge chamfered, and toe notches cut into
  the front edge: four on the front feet, three on the rear (the real
  count), each notch 0.012 deep. Twenty to thirty triangles per foot; four
  feet is a hundred triangles for the most-visible detail in the loaf.
- A darker band (0.82 multiplier via vertex colour, from R1's function) on
  the lower 0.06 of each shin, so the ankle reads.
- The loaf: `capyLOAF_LEG_R` currently leaves the rear feet outboard of the
  rump. Add a z-tuck term to the rear leg groups during the loaf (position.z
  moved +0.05 and rotation.z toward the body) so the feet sit under the
  rump's edge rather than behind it. Cross-faded on `capyLoaf` like every
  other term in that expression; no second writer.

**Reference.** Front feet four toes, hind feet three, all short, blunt,
partially webbed. In the loaf a capybara sits on its hocks with the rear feet
under the body and the front feet together in front.

**Acceptance.** Shot `AR-capy-3q` at rest (which is the loaf after
`capyLOAF_T`) and the standing three-quarter. The foot's footprint on the
drawn ground: `qa/d2-*` contact figures unchanged. Apex asserted.

**Built 6 Sep 2026. The foot, the ankle, and the pose the numbers said was
wrong.** The code is `capybara.js` THE FOOT (R4), THE SHIN (R4), THE ANKLE BAND
(R4) and THE LOAF SITS ON ITS HOCKS (R4); the instruments are `qa/r4-pre.js`
(the baseline, and the measurement that reframed the task), `qa/r4-foot.js`
(toes, winding and the band off the buffers), `qa/r4-band.js` (the band in
pixels, as an in-frame A/B) and `qa/r4-ar.js` (the acceptance frames).

**THE DEFECT WAS NOT THE ONE THIS TASK NAMED, AND ONLY THE GROUND SAID SO.**
The hand-off says `capyLOAF_LEG_R` "leaves the rear feet outboard of the rump".
It does not. `qa/r4-pre.js` measures every vertex of a foot against the live
biome's own `terrainHeight` under it, and in the loaf:

| in the loaf | front foot | front shin | rear foot | rear shin |
|---|---|---|---|---|
| lowest point, m under the drawn ground | 0.009 | 0.046 | **0.146** | **0.134** |

The rear legs were a third of their length INSIDE THE LAWN. The loaf drops the
model 0.145 m and the rear legs, trailing back and down at 0.85 rad, went with
it. In z they were never outboard at all: the rear foot ended at -0.564 against
a rump that reaches -0.626, so it was already 6 cm inside the animal's own back
edge. The task's remedy, a 5 cm z tuck, is in and it is right, and on its own it
would have moved a buried foot 5 cm sideways.

So both loaf angles were re-derived against the ground instead of adjusted.
With the ankle below holding the foot level, the sole sits 0.175 m below the
hip, and `0.295 cos a + 0.03 sin a = 0.15` solves at -0.837 forward and 1.234
back. Measured after: **front foot 0.005 m into the ground, rear foot 0.006,
rear shin 0.010.** The soles rest on the lawn instead of under it.

| | planned | built | why |
|---|---|---|---|
| toe notches | "four on the front feet, three on the rear" | four TOES and three notches in front, three toes and two notches behind | the count in the reference sentence ("front feet four toes, hind feet three") is the count of toes, and four toes need three notches between them. Built as tips and valleys with the outer two tips ON the corners, because a foot's outer toes are its edges |
| triangles | 20 to 30 a foot, "a hundred triangles" for four | 32 front, 24 rear: 112 for four, against the 48 the four boxes cost | a notched plan is 2·toes+1 points and the count falls straight out of it |
| the loaf | a z tuck and a rotation.z | the z tuck, both leg angles, and an ANKLE | see above for the angles. The ankle is not optional once the foot has toes: a leg folded to 1.234 rad with the foot rigid to it is an animal standing on its heel with its new toes pointing at the sky |
| rotation.z inward | asked for | NOT built, and measured before it was dropped | `qa/r4-post.js` takes the hull's own widest half width within 12 cm of the foot's z, off the buffer: the rear foot's outer edge is at 0.222 against a flank of **0.277**, so it is already 5.5 cm UNDER the body. Rotating it further in puts it under a belly that has 2.8 cm of ground clearance in the loaf. (The front feet are 7.4 cm proud of a 0.148 chest, which is correct: they are out in front of it) |
| the shin | not mentioned | rebuilt: 6 sides, 0.100 to 0.068, 0.29 long, 28 triangles | two separate forcings, below |

**THE BAND HAD NOWHERE TO LIVE, AND THE LEG WAS THE WRONG WAY ROUND.** Two
things a foot with a real footprint forces on the leg above it.

1. **A `CylinderGeometry` cannot carry a band.** With `heightSegments` 1 it has
   vertex rings at its two ends and nowhere else, so a vertex colour meant to
   change 6 cm off the ground has no vertex to change at, and the band comes out
   as a gradient up the whole leg. Raising `heightSegments` buys the one ring
   wanted and three nobody does, at 48 triangles a leg. Hand-authored with
   exactly three rings (sole, ankle, top) and no top cap, because the top of a
   shin is 11 cm inside the hull: 28 triangles against the cylinder's 24.
2. **The taper ran the wrong way.** 0.078 at the top and 0.10 at the BOTTOM: a
   leg that flares at the ankle, and an ankle 20 cm across on a foot 14.5 cm
   wide. With the foot a slab that was invisible. With toes cut into it, the
   shin's bottom cap swallowed them from behind and dug into the ground beside
   them, which is what the first render of this task showed. 0.100 to 0.068 puts
   the ankle inside the footprint; 0.29 rather than 0.32 stops the shin 2 cm
   inside the top of the foot instead of coplanar with the sole.

The shin's bottom rim still passes 4.4 cm below the sole plane when the leg is
folded, and that is fine and was checked rather than assumed: at 0.068 it is
inside the foot's 0.0725 half width and inside its z span, so it is under the
foot and under the ground at the same time and cannot be seen from any bearing.

**IS THE BAND VISIBLE? MEASURED, NOT JUDGED.** `qa/r4-band.js` is the
`wear-parts.js` move applied to a colour: render, divide the banded vertices by
0.82^2.4 to put them back to the flank they would have had, render again, diff.

| | pixels changed | mean grey levels darker | as a fraction |
|---|---|---|---|
| loaf, three-quarter | 12 306 | 10.5 | 0.104 |
| loaf, side | 4 242 | 8.7 | 0.084 |
| standing, three-quarter | 12 055 | 8.2 | 0.087 |
| standing, side | 10 131 | 6.8 | 0.076 |

Ten grey levels is subtle by eye and it is exactly what 0.82 buys. It is a real
band and not a rounding error, and the loaf shows more of it than the standing
pose does, which is the pose the task was for.

**The budget.** 35 meshes and 1 356 triangles become **35 meshes and 1 436**:
the feet 48 to 112 and the shins 96 to 112. No mesh is added or removed, so the
draw call count on the animal is exactly what it was.

**Two things worth checking on any hand-authored geometry, both cheap.**
`qa/r4-foot.js` sums the signed volume of each foot (positive means every face
is wound outward: 0.0011455 on both, against 0.001269 for the box they replace,
the difference being the notches and the chamfer) and dots every side face of
the shin with its own outward radial (24 of 24 outward). A face wound the wrong
way is invisible under backface culling and reads as a modelling mistake.

**The gates.** `qa/wear-smoke.js`: bare 35, and every costume lands on exactly
the count it had before (sunhat 39, ferrycap 40, plumes 51, boater 42, snorkel
41, flycap 49, surfcap 41, cavehelm 42, parka 50, black tie 53), one on after
ten swaps, an unknown id undresses, the ghost puts the costume back.
`qa/coat-states.js`: `coatAudit().bare` 0 over 27 meshes and no black pixels in
dry, parka, black tie or ghost, so the two new buffers carry the attribute.
`qa/wear-parts.js`: nothing newly buried. `qa/fuzz.js` over all nineteen
chapters, run TWICE, once on this build and once on a `git stash`ed baseline in
the same session: **every fault field identical**, NaN frames 0, void falls 0,
camera NaN 0, and the solver-save counter 0 through Venice and 2 from Kowloon on
in BOTH, so that pair of velocity clamps is a background rate the animal's feet
have nothing to do with. `qa/hull-stand.js`: the apex is 0.760
m of rise from a standing press, against 0.759 before. `qa/d2-skate.js`: the
skate ratio is 1.000 at every speed, the sprint 7.26 m/s on a 0.548 m stride,
and the stop and hop traces are unchanged, which they have to be: the hip
pivots, `capyLEG_R`, `capyFOOT_Y` and the collider were not touched.

### R5 · Breath and weight (animation) &check;

**Files.** `capybara.js`, the squash spring and the pose block.

**What to build.**

- **Breath.** A 0.28 Hz sinusoid, amplitude 0.010 on the hull's y scale and
  0.006 on x, added INTO the expression that already writes
  `capySquash.scale` (the `sqXZ, sqY` line), weighted by `1 - capyAirPose` and
  by `(1 - speed)`, so it is zero in the air and at a run. Deeper (0.016) and
  slower (0.20 Hz) when `capyLoaf` is up. It is the fourth term in a writer
  that already has three; it is not a new writer.
- **Head settle.** After the landing spring bottoms out, the head node's
  pitch gets a damped 0.06 rad nod on its own variable, damped at 9, added
  to the `head.rotation.x` line. Not on `capyHeadPitch`, which the gaze
  owns.
- **Tail.** The tail blob has no writer. Give it one: a 0.25 rad flick on
  the wheek (same trigger as `capyPop`) decaying at 6, and a 0.05 rad idle
  sway at 0.7 Hz. Two lines.

**Acceptance.** `qa/d8-body.js`'s pose figures (the flail phase, the four
leg reaches) unchanged; `animAudit()` gains `breath` and `tail` fields so a
probe can assert both are non-zero at rest and zero in the air. The apex.

**Built 6 Sep 2026. Three channels nobody can see in a still, and the two
instruments that disagreed about the first one.** The code is `capybara.js`
BREATH, SETTLE AND TAIL (R5) and the three writers it names; the instruments are
`qa/r5-body.js` (all three as traces over real frames, with the amplitudes
quoted in millimetres of the drawn animal) and `qa/r5-see.js` (the breath in
pixels that move).

Nothing here can be judged from a screenshot: a breath is 1% of an animal, a
settle is 0.06 rad and lasts a third of a second, and a tail flick is one
centimetre. Every number below is a trace.

### The breath is one term in one writer now

R2 left it on `hull.scale`, a second writer on a child of the node that already
owns the body's scale, and said in the code that R5 owned it next. It is now the
fourth term in the `sqXZ, sqY` line, and the node it moved to matters more than
the tidiness: **`capySquash`'s origin is the FOOT PLANE**, because `capyModel`
puts the soles at y = 0. A scale there is a scale about the ground, so the feet
cannot leave it, and the head and the back rise together the way a ribcage makes
them. On the hull it was about the belly line and only the barrel moved.

| | planned | built | why |
|---|---|---|---|
| the weight | `1 - capyAirPose` and `(1 - speed)` | both, but the AIR GATE MULTIPLIES rather than going through the filter | inside the lambda-4 damp the breath is still **0.0036 against a resting 0.010, 36% alive, at the top of a hop**: a quarter-second time constant is longer than a hop. Outside it, 0.00056, and 0.00001 at a settled walk. capyAirPose is itself damped at 13, so it is still a cross-fade |
| `(1 - speed)` | as written | `clamp(1 - speed / 1.20, 0, 1)` | speed is m/s here and reaches 7.3, so `1 - speed` is negative at a crawl. 1.20 m/s is the normalisation, and it replaces a STEP: the old gate was the binary `moving`, true above 0.35 m/s, so an animal creeping up on a picnic stopped breathing |
| x and y separately | 0.010 and 0.006 | one term, x and z both at 0.6 of y | the writer is `set(sqXZ, sqY, sqXZ)`: one number does x and z. Splitting them costs a channel to say 0.6% of fore-and-aft on a body already rising 1% |

**AND THE TWO INSTRUMENTS DISAGREED, WHICH IS THE FINDING.** The obvious
measurement is how far the top of the back moves. Taken frame by frame off the
buffer, with the gait bob, the pop, the landing absorb and the terrain lift all
held still:

| top of the back, peak to peak | before (on the hull) | after (on the body) |
|---|---|---|
| in the loaf | 26.8 mm | **23.2 mm** |
| standing | 26.7 mm | **14.7 mm** |

(The loaf row read 32.5 mm on one of three runs of the same build, and that
is the IDLE BEAT and not the breath: act 4 doubles the amplitude, it fires on
a twelve second cadence, and the sampling window is nine seconds long, so it
is caught about a third of the time. 23.2 mm is the number the arithmetic
also gives, 0.735 m of vertex against 0.032 of peak-to-peak scale, and it is
the one to quote. A window shorter than the idle cadence cannot be assumed
to be free of it.)

Read that alone and R5 halves the resting breath. It does not. `qa/r5-see.js`
holds the animal still, sets the squash node to a candidate's two extremes,
renders both and counts the pixels that move, which is the question actually
being asked:

| y amplitude | px moved, 3 m crop | of an 88 379 px animal | px moved, resting lens | of a 2 340 px animal |
|---|---|---|---|---|
| 0.006 | 20 643 | 23% | 461 | 20% |
| **0.010 (built)** | 27 683 | **31%** | 647 | **28%** |
| 0.016 (the loaf) | 35 782 | 40% | 902 | 39% |
| 0.0182 (what was there) | 39 331 | 45% | 969 | 41% |
| 0.026 | 50 235 | 57% | 1 134 | 48% |

At 0.010 more than a quarter of the animal changes between the two ends of a
breath, and that is at the RESTING LENS, where the whole animal is 2 340 pixels.
A 1% scale relights every facet on the body; a millimetre count at one vertex
cannot see that and reads a much smaller number. **The hand-off's amplitude is
right and the millimetre count is the wrong instrument for it.** Both are kept
in the probes: the millimetres are what you compare across builds, the pixels
are what you compare against zero.

### The settle, and the landing the player actually makes

Not a second trigger on the landing: a LAGGED FOLLOWER of the absorb spring the
model already runs, which is what makes it arrive after that spring bottoms out
rather than with it. Measured, **83 ms after**.

The gain took three goes and every one of them was a measurement. `capyLand`
clamps at -0.30 m and the hand-off's 0.06 rad is 0.20 rad/m off that clamp, but
**a plain hop from standing only takes the spring to -0.090**, and that draws
0.6 degrees: nothing, on the one landing this game makes a hundred times an
hour. Then 0.60 rad/m drew 0.033 and not the 0.054 its own target asked for,
because a lambda-9 follower never reaches a target that is gone in 80 ms.
**1.10 rad/m draws 0.0611 rad, 3.5 degrees**, which is the hand-off's number
arriving on the head instead of in the constant. The cap is on the target, at
0.16 rad, so a forty-metre arrival does not snap the head down.

### The tail could not have a writer until it had a pivot

The nub is a 5 cm sphere that was centred on itself, and **rotating a sphere
about its own centre moves nothing but which way its facets face**. So the
writer the hand-off asked for would have drawn a shimmer, not a flick.

The pivot is INSIDE the body, at z -0.50, where the hull's section runs y 0.32
to 0.65, which is where a tail's root joint is and also the only place it can be
and still show:

| pivot | arm | what 0.25 rad moves the nub |
|---|---|---|
| on the hull's rear cap | 3.9 cm | **9.7 mm** |
| inside the body, z -0.50 | 11.7 cm | **29.2 mm** |

The nub's own position in the animal is unchanged either way. Measured: the
flick is 0.248 rad peak to peak (14.2 degrees), the idle sway is 0.05 rad at 0.7
Hz on the same rest weight the breath uses, and in the air it is 0.0029, three
per cent of the sway.

`animAudit()` gains `breath`, `tail` and `headNod`.

### The gates

`qa/d8-body.js`, run on this build and on the pre-R5 one: the `arms` and `ride`
rows agree to three decimal places on all four legs. The two `talons` rows that
differ are **one frame** and it can be shown rather than assumed: solving
`sin(capyCarryPh + i) * 0.7` for each of the four legs gives phase 3.033 on this
build against 2.801 on the other, one phase for all four, and 0.232 rad at the
flail's own 14 rad/s is 16.6 ms. The probe sampled a frame later. `crowd` is
cast 32 and armMax 1.365 against 1.364; the two `face` rows that move are a
blink and a mood sampled a second after a wheek, both stochastic.

Budget **35 meshes and 1 436 triangles, unchanged**: a pivot is a Group and a
Group is not a mesh. `qa/wear-smoke.js` bare 35 with every costume on the count
it had. `qa/coat-states.js` painted 27, bare 0, range identical to the digit,
which it must be: the tail's position in model space did not move, so the coat
it was painted with is the same coat. The apex is 0.758 m of rise against 0.760
and 0.759 in the two batches before it. `qa/fuzz.js` over all nineteen
chapters, diffed against R4's run: every fault field identical, NaN frames 0,
void falls 0, camera NaN 0, nothing thrown. Zero console and zero page errors in
every run of every probe above.

### R6 · The second colour, everywhere (shading + modelling) &check;

**Files.** `npc.js` (`npcMakeGeo`, the geometry table, `buildLocalFigure`),
`condor.js` is untouched, `pantanal.js` (the herd's body).

**What to build.**

- `npcMakeGeo(parts)` takes an optional `c` per part, a multiplier written
  into the `color` attribute for that part's vertices instead of the 1.0 fill.
  Per-instance colour still multiplies on top, so the same buffer is still
  one draw call for forty-five people. The table:

  | geometry | part | multiplier | reads as |
  |---|---|---|---|
  | `gLeg` | shoe | 0.55, 0.55, 0.58 | a shoe darker than the trouser |
  | `gArm` | hand | 1.0 (instance colour is skin) | unchanged |
  | `gTorso` | shoulders slab, underside | 0.88 | a shirt with weight |
  | `gHead` | nose | 0.94 | the nose has a shadow side |
  | `gHead` | neck | 0.86 | the head sits on something |
  | `gHair` | back block | 0.92 | hair has a part |
  | `gHat` | brim underside | 0.72 | a brim casts on the face |
  | `gEyes` | new: a 0.070 x 0.052 x 0.016 white box BEHIND each pupil, in the same merged geometry, multiplier 2.3 (against instance colour `capyEye` this lands at `sail`) | the eyes have whites |
  | `gGullBeak` | none: already `hiVis` per instance | |
  | `gDogHead` | snout underside | 0.85 | |
  | `gLlamaN` | face | 0.82 | the llama has a face |
  | herd body (`pantanal.js`) | two horn boxes 0.05 x 0.05 x 0.12 at the head, 0.75 | the cattle read as cattle |

  Multipliers above 1.0 need the instance colour to be dark, which is why the
  eye white is written against `capyEye`: 0x2f2118 x 2.3 clamps to the pale
  the face wants. Verify the clamp on the GPU path used (Lambert vertex
  colour is multiplied before lighting; a multiplier over 1 is legal).
- **The locals' hat** becomes the roster's: `gHat`'s brim + crown built as
  two `npcLocPart` boxes plus a 6-segment cylinder for the crown, 0.36 brim
  radius, 0.16 crown, in `o.hat`; the plate goes.
- **The eyes on the locals** get the same white box behind the pupil pair in
  `npcLocEyeGeo`, in `sail`, one merged geometry, still one mesh.
- **Costumes.** The tux lapels become one ring segment (a `capyGeoRing`
  sector, 0.2 rad thick, 0.30 radius round the base of the skull), the way
  Rio's collar already is; the parka's eleven beads become one lathed ring
  (8 segments) with two bead clusters at the jaw for the fur read.

**Reference.** The Goose Game benchmark: people are three or four flat
colours and every one of them is placed where a real garment changes
colour: shoe, cuff, collar, brim. Not more colours; the right edges.

**Acceptance.** Draw calls in Sydney, Venice and Sahara exactly as recorded in
P5 (`+7.8`, `+16.0`, `+18.5` over the pre-P5 baseline): this task adds zero.
`qa/audit-npc.js`, `qa/audit-locals.js`, `qa/p5-face.js` (the expression
matrix) unchanged. Shots: `AR-tourist-front`, `AR-gardener`, `AR-venice-local-a`,
`AR-play-sydney`, `AR-play-pasto` re-taken.

**Built 6 Sep 2026, and it closes the roadmap. The second colour, the eye that
was inverted, and one row that could not be built because it was already
built.** The code is `npc.js` THE SECOND COLOUR (R6) and the table under it,
plus `capybara.js` A BAND and the two costumes; the instruments are
`qa/r6-colour.js` (the cost and the effect, as one in-frame A/B),
`qa/r6-shots.js` (the faces) and `qa/r6-wear.js` (the two costumes from three
bearings).

`npcMakeGeo(parts)` takes `c` per part now, written into the `color` attribute
that was already there and already filled with 1. The final albedo is
`material (sail) x this x the per-instance colour`, so a shoe is darker than the
trouser it hangs off while both still take that person's own trouser colour, and
the same buffer is still one draw call for forty-five people.

`c` IS LINEAR, and two helpers name the space at the call site rather than
leaving a bare number to be guessed at: `npcSRGB(0.88)` for a number a person
reasons about, `npcOf(capyEye, sail)` for the honest ratio of two palette
colours, taken through `THREE.Color` so it uses the REAL sRGB transfer rather
than a power of 2.4, which is 1.65x out at the dark end. Same pair, same names,
same reason as the coat's `capyCoatK` and `capyCoatOf`.

### The eye was the wrong way round, and it is arithmetic, not taste

The hand-off's plan was to keep `capyEye` as the per-instance colour and write
2.3 on the white, "which clamps to the pale the face wants". It does not:

| | |
|---|---|
| albedo of an eye | `sail x capyEye x c` |
| `capyEye` in LINEAR | 0.027 of full |
| ...times the 2.3 asked for | 0.06 |
| ...times 7.3, which is what 2.3 means as an sRGB intent | 0.19, a mid brown |
| what reaching `sail` from there would need | **37 on red, 115 on blue** |

So it is inverted. The INSTANCE colour is white, which makes the eye white the
material's own `sail`, and the PUPIL carries the dark multiplier, derived from
the palette rather than written out twice. Every multiplier in the file is then
at or below 1, which is the direction that cannot clip, and nothing per person
varies about an eye either way.

| | planned | built | why |
|---|---|---|---|
| the white | 0.070 x 0.052 | **0.088 x 0.050** on the roster, 0.078 x 0.044 on the locals | at the planned size the pale stands 6 mm proud at the sides and 4 mm at the top, which is a uniform BORDER: it renders as a pair of spectacles. An eye is a wide white with a dark iris somewhere in it, so the ring has to be about three times wider at the sides than above. Only the render showed it |
| `gHat` brim underside | one entry | the brim is TWO cylinders | `c` addresses a PART, and a brim that is one cylinder cannot have a lit top and a shaded underside. Split at y 0.317, inside the same 0.305 to 0.335 the single one occupied, so the hat's silhouette is untouched and the only new thing in the frame is the shadow a brim throws |
| the locals' hat | brim 0.36, crown 0.16 | brim 0.30, crown 0.14 | 0.36 is the roster's, on a 0.32 m head. A local's head is 0.26 m and 0.72 m of brim on it is a sombrero |
| the herd's horns | two boxes on `pantanal.js` | **NOT BUILT, and it is right twice over** | see below |
| the parka's ruff | one lathed ring and two bead clusters | one band and FOUR beads | a band alone is a smooth rim and reads as moulded plastic; the eleven beads it replaced read as fur because their outline was LUMPY, and two at the cut ends leave the top of the arc, the half the player sees, smooth |

### The horns row could not be built, and both halves of it are wrong

It says: `herd body (pantanal.js) | two horn boxes 0.05 x 0.05 x 0.12 at the
head, 0.75 | the cattle read as cattle`.

1. **The herd in `pantanal.js` is nine CAPYBARAS**, and its own build note is
   explicit about why: "they are the same animal as the player and they must
   READ as the same animal, the whole point of the chapter is that nobody here
   is remarkable". Horns on it would break the chapter's premise.
2. **The cattle are a different mesh and they already have horns.**
   `panBuildCattle` gives each nelore a hump, ears, a dewlap, a muzzle, a
   nose and two horn cones, every one of them its own palette colour, and it
   has since the cattle were built.

Nothing to do, and the useful thing is the shape of the mistake: a row in a
review names a FILE and a colour and never opens either.

### The costumes: drawing and reading are different questions

`qa/wear-parts.js` says all four of the dinner jacket's satin boxes draw. The
render says they read as **four pale flecks on a black coat**, which is the
failure Rio's own collar wrote down two batches ago: "a RING round the base of
the skull, not two slabs on the shoulders: the first version was a pair of boxes
and from three-quarter front they read as one gold shard sticking out of the
animal's side". A probe that asks "is it drawn" cannot answer "does it read",
and this is the second time in this roadmap that the two have parted company.

So Rio's collar was measured before it was copied: `wear-parts.js` was extended
to the plumes and reports it drawing. Then the four boxes became one annulus
with the front left open, tilted to follow the shoulder line, because a
horizontal ring on an animal whose back rises toward the hips is buried at the
back and floating at the front.

`capyBandGeo` is new and had to be: the game could not draw a collar.
`capyGeoRing` is an OPEN TUBE, edge on from the front and therefore a hairline,
and `capyGeoDisc` is solid and would cover the face a ruff exists to frame. An
annulus segment with a rectangular section does both jobs, and it takes an
angular range because the parka's ruff has to keep the gap at the jaw. Its
winding was checked BEFORE it was drawn, by summing the signed volume of the
closed mesh: 0.0054745 against 0.0059020 for the true annulus segment, the 7%
being what eight flat segments lose.

| | before | after |
|---|---|---|
| the dinner jacket's satin | 4 boxes | 1 collar |
| the parka's ruff | 11 beads, 396 triangles | 1 band and 4 beads, 212 triangles |
| meshes with the costume on | black tie 53, parka 50 | **50 and 44** |

### The cost, and an instrument that cannot hold a line

Two measurements, and only one of them is worth anything.

**In frame, same build, same frame:** render with the colours on, scrub every
one of them back to 1 in place, render again. Draw calls **152 / 152** in
Sydney, **160 / 160** in Venice, **186 / 186** in Sahara; and again on a
second run of the same build, **149 / 149, 160 / 160, 185 / 185**. The
absolute number moves between runs and the ON against OFF never does, which
is as tight as this can be measured and is what the acceptance is about.

**Build against build**, this `npc.js` against the pre-R6 one:

| | pre-R6, three runs | R6 |
|---|---|---|
| Sydney | 149, 151, 151 | 152 |
| Venice | 160, 160, 160 | **160** |
| Sahara | 185, 185, 188 | 186 |

**The count moves by 2 in Sydney and 3 in Sahara with nothing changed**, because
it is taken from the live camera and the crowd walks about. Venice is the one
chapter where it holds a line, and there it is identical. Every R6 number is
inside the baseline's own spread, and no mesh was added or removed anywhere in
the change. Triangles do rise, and that is real and countable: Sydney 89 280 to
91 472, which is thirty-two people at 24 for the eye whites and 32 for the split
brim, plus the locals.

**And the table does nothing in two of its own three acceptance chapters.** The
same A/B says 1 570 pixels change in Sydney (505 on the second run, because
the crowd has walked somewhere else) and **zero** in Venice and Sahara on
both: those two are staffed by LOCALS, not by the roster, so the roster's
second colours never appear in them at all. What those two chapters got out
of R6 is the hat and the eyes, and nothing else in the table reaches them.

### The gates

`qa/wear-smoke.js`: bare 35, the ghost restores, an unknown id undresses, and
every costume except the two that were rebuilt lands on exactly the count it
had. `qa/coat-states.js`: `coatAudit().bare` 0 over 27 meshes and no black
pixels in dry, parka, black tie or ghost, which is the gate that matters for a
new mesh here. `qa/wear-parts.js`: the parka now flags only the mouth plate,
which is enclosed by design, and the 29-pixel ruff bead it used to flag is gone.
`qa/audit-npc.js` and `qa/audit-locals.js` report the same populations, and
`qa/p5-face.js` the same three expression shots with the same kinds.
`qa/fuzz.js` over all nineteen chapters, diffed against the run R4 and R5 were
measured against: every fault field identical, NaN frames 0, void falls 0,
camera NaN 0, nothing thrown. Zero console and zero page errors in every run.

---

## Sequencing: three sessions, one commit each

The repo's convention. Each batch is independently revertible and each ends
with the review sheet re-run and the crops rebuilt.

- **C1, colour (R1 and R3's nose measurement done + R6's `npcMakeGeo` table).**
  No geometry changes except the eye-white boxes. About 4 h. This is the
  batch that changes the most pixels for the least risk, and the coat
  function it writes is what C2 paints the hull with.
- **C2, shape (R2, R3 and R4 all done).** The hull, the muzzle, the feet, the
  loaf, the two costume shells refitted. Everything in this batch was inside
  `capybara.js` and the wardrobe, and it is closed: nothing in C2 is
  outstanding, and R4 took the shin and both loaf leg angles with it for
  reasons the built section above records.
- **C3, motion and the rest (R5 and R6 both done).** The breath, the settle,
  the tail, the second colour on every person and beast, the locals' hat and
  eyes, and the two costumes rebuilt. The herd's horns were the one item on
  this roadmap that could not be built, and the built section says why.

**All six are in.** Nothing on this roadmap is outstanding.

After C3: re-run `qa/art-review.js`, `qa/art-review2.js`, rebuild `qa/art/`,
and record the before/after pairs in CONTRACT.md under THE CHARACTER PASS.

---

## Instruments

| script | what it does |
|---|---|
| `qa/art-review.js` | 30 shots: the animal from six angles, gait, hop, wheek, three costumes, the Sydney roster, Pasto's locals, Venice, Monte Carlo, Kyoto |
| `qa/art-review2.js` | gait and hop on an open lawn, the ibis, the herd, the condor from the side and above |
| `qa/art-review3.js`, `qa/art-review4.js` | the beasts by instance position (the llama and dog finders missed; use `AR-play-pasto` for those), and the budget block: meshes and triangles bare and dressed |
| `qa/coat-probe.js` | R1: the gradient as a cut across the animal, coat on against coat off in the same frame, plus the mesh and triangle count with the wardrobe correctly excluded |
| `qa/coat-silh.js` | R1: P1 silhouette contrast in four chapters, both states, one frame each |
| `qa/coat-states.js` | R1: the wardrobe over the coat and the ghost baked from it, checked for black meshes |
| `qa/art-thumb.cjs` | crop by fraction and box-shrink, for the review sheet |
| `qa/crop.cjs` | nearest-neighbour magnify, for siting a bead |
| `qa/wear-smoke.js`, `qa/d8-faceshot.js`, `qa/d8-body.js`, `qa/budget.js`, `qa/fuzz.js` | the existing gates every batch must leave green |

Three traps the review hit, for whoever runs the sheet next:

1. `frameShot` clamps distance to 7 m. A close-up needs its own camera and a
   render in the SAME `page.evaluate` as the `toDataURL`, or the buffer is
   gone (the P5 note, still true).
2. The raw render comes off the canvas at whatever size the adaptive scaler
   left it: 896, 1023 or 1280 wide in the same session. Crop by fraction.
3. Instanced bodies have no node to ask for a position. Decode the instance
   matrix of the torso buffer (72 vertices, count = cast size) and take the
   third column for facing.
