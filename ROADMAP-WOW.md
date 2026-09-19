# ROADMAP-WOW — the third beauty pass: reflections, the foreground, grass, still pixels, the model sheet, the living made round, nineteen beats, and a detail pass on the six weakest (19 Sep 2026)

The brief: every chapter noticeably more beautiful — "like 40 % better,
smoother-looking graphics and more wow factor." LIFT10's audit
(ROADMAP-LIFT10.md, "THE NINETY PASS") is the premise this is built on:
**every tuning dial in the game has already been turned and written
down** — the grade table, the sun table, the fog, the motes, the spawn
bearings — and nearly every chapter that reads restrained reads that way
on purpose, in a paragraph. So this pass does not touch a dial. It adds
**capability the render stack does not have** (Part A), and **one beat per
chapter that its own sentence has been asking for** (Part B), and it makes
"40 %" mean five things a probe can read (below) rather than a feeling.

The law stands: low-poly, flat Lambert, `PALETTE` only, no textures, no
image files. A render target is not a texture (the composite already uses
four). Everything here is pretty-tier only — parked at the governor's
rung 1 the way the far light is (`sysFAR_SHARE`'s block) — and carries a
`game.state.noX` that cuts. A locked 60 stays a locked 60.

## What "40 % better" means here, so it can be measured

Five numbers, all from instruments that already exist or are one edit
from one that does (the corrected depth-bin sweep `qa/l10-depth-sweep.js`,
the still-camera per-pixel diff in `qa/vr-sweep.js`, `qa/leaf-orbit.js`'s
eight-azimuth diff, the interleaved rAF A/B):

1. **Three planes in every arrival frame.** Today 49–97 % of every frame
   is inside 20 m and the first 3–4 m are empty everywhere. Target: the
   0–4 m bin non-empty (5–15 % of rays) with the animal's own screen-line
   clear, AND mid+far ≥ 25 % in the open chapters; enclosed chapters
   (Kyoto's lane, the cave, Kowloon's canyon) are exempt on far and must
   instead show a **lit far layer** — a reflection or a beam.
2. **A reflection wherever water is the subject.** Seven chapters name
   their water as a mirror in their own comments and none of them draw
   one. Measured: the per-pixel diff between the reflection cut and live,
   over the water's screen area, mean ≥ 12 levels.
3. **Still pixels.** The two-frame diff at rest, with the mote and NPC
   layers masked out, is the shimmer floor — thin cables, sparkle specks,
   shadow-edge crawl. Target: −40 % moved pixels per chapter against the
   recorded floor, with intended motion untouched.
4. **A wow beat that is IN the arrival frame**, not forty metres behind
   the lens — 19 of 19, each confirmed from the arrival screenshot.
5. **16.7 ms median / p95 < 18.5 ms** at rung 0 across all nineteen on the
   reference machine, ten interleaved reps, quiet — and every term reads
   as ≤ 0.1 ms on the rAF A/B when cut.

## Part A — five global lifts, ordered by wow-per-millisecond

### A1 — REFLECTIONS (the flagship)

*The pond is called the mirror pond. `PALETTE.panWater`'s own comment
says "the flood, and it is a MIRROR." Monaco's harbour reflection has
been an open beauty item since the first pass. Nothing in 169 000 lines
reflects anything.*

One planar reflection pass for still water: the scene rendered once more
from the camera mirrored through the water plane into a **half-resolution
half-float target** (the composite's own `MAIN_POST` target shape,
`samples: 0` — a reflection is sampled through a wobble and needs no
MSAA), with an oblique clip plane at the water height so nothing below
it leaks, then sampled in the water material's fragment by screen-space
UV, offset by the ripple normal the chapter already has
(`kyoRipple`/`kyoPondAttr`, the Pantanal's sheet, Hanoi's lake), blended
in over the existing Fresnel horizon term (`grain()`'s water path — the
"call site says it is water by asking" rule) so it is strongest at
grazing angles and vanishes looking straight down.

- **Where.** Opt-in per water material via `grain(mat, { reflect: {
  k, blur, wobble } })`, one `sysREFLECT` row per chapter. Flagships:
  **Kyoto** (the mirror pond — its whole job, per `kyoto.js:2504`),
  **the Pantanal** (the flood), **Hanoi** (Hoan Kiem, the pagoda and the
  red bridge doubled), **Monaco** (the basin at blue hour — a hundred and
  forty lit windows, doubled). Then Venice's acqua alta (the square
  becomes the mirror the chapter is named for), the cave's river under
  the shaft, Antarctica's sea between the floes, Iceland's harbour.
  Kowloon's wet street takes the same pass at `blur` high — the fake
  spill's own comment (`shared.js:2147`) says why a smeared reflection
  under neon is right and a sharp one is wrong.
- **What the mirrored camera draws.** A layer mask: the merged world,
  the sky dome (it rides the camera, so the mirrored camera needs its
  own copy or the horizon is black), the emitters, the animal. NOT the
  motes, NOT crowds past 40 m, NOT the props' contact shadows — the
  cheapest half of the scene, which is also the half a reflection
  reads. Shadow pass is not re-run; the reflection reads the same
  shadow map.
- **Cost.** Budget 1.5–2.5 ms at half res on the reference machine;
  measured, not assumed, per chapter. Rung 1 parks it (target left
  allocated, pass skipped, `k` damped to 0) — never freed, for the
  NUM_DIR_LIGHT_SHADOWS recompile reason the far light gives.
- **Named traps, each already paid for once:** the clone-eats-the-shader
  trap (`capy3-clone-eats-the-shader` — a `.clone()` on a grained water
  material loses the hook); `customProgramCacheKey` must change with the
  reflect option or two seas share a program; the swim/dive state
  (`capy3-water-and-witness`) must cut the pass while the eye is under
  the surface; `bounceSnap`-style capture — the A/B is captured
  synchronously or rAF puts the harbour's sparkle in the diff.
- **Instrument:** `qa/wow-reflect.js` — per chapter, arrival frame, the
  water's screen mask from a colour-keyed render, per-pixel diff cut vs
  live inside the mask; frame time both arms.
- **`game.state.noReflect`.**

**W2 reality check (19 Sep 2026): the pass and all four flagships
landed; the cost budget is not confirmed, and one design point above
was wrong.**

- **Shipped** (`1093169`, `6571e70`, `8eaf39e`, and the Pantanal/Monaco
  commits after them): `reflectRender`/`reflectSet` in shared.js above
  `_grainCache`, `grain(..., { reflect: { k, pow, wobble, blur } })`,
  `sysREFLECT` in systems.js, the call in main.js before the scene draw.
  Per chapter, from `qa/wow-reflect.js` (one chapter per run, pretty
  pinned through the prefs file, the frame held by `game.frameShot`),
  in-mask mean diff cut-vs-live: **Kyoto 33-38, Hanoi 28-29, the Pantanal
  33-46, Monaco 34.7** — all over the 12-level target,
  88-99 % of water pixels over 12 each, outside the mask under 0.6, zero
  console errors, the swim cut proven in Hanoi and the Pantanal (`why:
  'eye under'` for the whole dive, `'drawn'` on surfacing). Read by eye:
  the pavilion, the torii run and the heron in the pond; Thap Rua and
  the red bridge in Hoan Kiem; the gallery trees trunk-and-canopy in the
  baía; the far shore's lit windows and the yacht's in the basin.
- **The design point that was wrong: "half res, so a quarter of the
  pixels."** The pass is not pixel-bound. On the Kyoto frame it costs the
  same at a quarter, a third, a half and full resolution
  (`qa/wow-reflect-perf2.js`); it is the second `renderer.render` — the
  scene walk and ~120 draw calls at ~20 us each in the browser
  (`qa/wow-reflect-perf3.js`). What helped: leaving out every mesh that
  subtends under ~5 half-res pixels from the virtual eye (432 of 632
  candidates on the pond frame; swept once a second), skipping the scene
  matrix walk, and a per-row `box` that skips the pass when none of the
  water is in the main frustum. What did not: the target's size, the
  instanced ground-cover rule (no field in Kyoto has more than 720
  instances), wider cull thresholds (0.1 ms).
- **The cost is NOT a quiet-machine number.** Every measurement in W2
  was taken with four to six agents' browsers live; the OFF arm of the
  in-frame A/B read 12-46 ms for a draw that is 10 on a quiet machine.
  Drained pass alone on Kyoto: 2.5-2.8 ms; interleaved in-frame delta
  1.5-4.6 ms across runs; the Pantanal (the whole map is water, so the
  pass always runs, over the biggest scene in the game) read 17 ms of
  delta on a 29 ms OFF arm, which is contamination, not a cost — but it
  is also the chapter most likely to break the budget on the reference
  machine. **W5 must re-measure all four quiet**, and if the Pantanal is
  over 2.5 ms the honest lever is a per-instance cull three cannot do
  (the sugi/gallery forests are one draw each and cheap; it is the 500
  small meshes), or the pass at every other frame in that chapter alone.
- **Kyoto's arrival lens does not see the pond** — it is inside the
  frustum behind a machiya wall 13 m out, so the `box` skip does not
  fire there and the frame pays for a mirror it cannot show. An
  occlusion query (`ANY_SAMPLES_PASSED` on the water's own draw) is the
  right tool and is held; the frustum test still covers every bearing
  that faces away from the water.

**W3 rollout (19 Sep 2026): eight more chapters opted in — the pass is
now in twelve.** Per chapter, `qa/wow-reflect.js` (one chapter per run;
in-mask mean diff cut-vs-live, share of water pixels over 12, outside the
mask, the frame read by eye), all at 0 console errors, all with several
agents' browsers live so no cost number below is a cost:

- **Quay** 46.9 (92.7 % over 12; outside 0.42) — the Freshwater doubled
  hull-and-deckhouse on her berth, the piles, Fort Denison, the buoy and
  both headlands. The bridge deck is above the frame's top edge from the
  apron. `c0ad693`.
- **Cali** 38.5 (99.2 %; 0.009) — the Gato, the painted cats, the lamps,
  the palms and the ceibas in the river. Dive cut proven. `2b8b437`.
- **Kowloon** 25.2 (64 %; 0.84) — NOT a sea. The road slab left the one
  merged street mesh (`hkVC()` would have mirrored every wall) and is its
  own plane at 0.01 on the same grain plus `reflect { k 0.55, pow 1.4,
  wobble 1.5, blur 4 }`; the signs, the taxis' lights and the lamps run
  toward the lens as smeared bands. grain()'s reflect path has NO wetness
  gate (it is on outgoingLight with no uGrainWet term), so it is always on
  at that low k — the palette says the road is always wet. The row and
  the road plane landed in `0f09848` and `183f10c`: two other agents'
  whole-file stages took them from the shared index, so the evidence is
  here and not in a commit of its own.
- **Antarctica** 57.6 (98.5 %; 0.52) — both islands, the pack floe for
  floe, the penguins on the water as paired blobs. antWATER is a constant
  (no tide here). Dive cut proven. `1dc573a`.
- **The cave** 6.5 (12.5 %; 0.13) — **under the target and left there.**
  Three lenses read 7.5 / 7.9 / 6.5: what the river mirrors is dark rock
  on dark water, and k is already 1 (a mix weight). The doubling reads by
  eye in every frame — the glade's trunks, the sky-lit cones, the
  glow-worms as cyan pairs — which is the lit far layer the depth audit
  asked for. The SHAFT ITSELF cannot be in the river from a playable
  lens: a hole 45 m up mirrors to D·h/(h+H) of the eye's ground distance,
  under a metre from the viewer's feet. pow 0.7. `dbaa78e`.
- **Venice** 36.2 (95.6 %; 0.17) — tide-gated: the row's `y` is a
  function, `game.venice.tideY()` while `tide() > 0.6`, NaN below (the
  pass reads 'no water' at arrival, 'drawn' on the plateau). The
  Basilica's front, the clock tower, both arcades, the banners, the
  umbrellas and the pigeons in the flooded square. `817bfb4`.
- **Iceland** 10.0 without the aurora, **23.1 with it** (63.6 %; 0.31) —
  one row at -1.0 serves the sea and the lagoon. The spawn's frame sees no
  water (the harbour is behind the house row) and still pays the pass —
  the Kyoto-arrival case again. `qa/wow-reflect-scout.js` (one position,
  four bearings, the mask of each) picked the pier head. `4e714ed`.
- **Rio** 19.0 (52 %; 0.01) — the wet band is a NEW strip mesh
  (`rioBuildWetBand`: the beach is part of the merged ground), vertex
  alpha fading up the slope, blur 6, sharing the sea's plane; the Atlantic
  itself does not ask (a 1.7 m swell would mirror a sky it shows). 5a9b151.
- **The dive does not engage** in the Quay's harbour or Venice's flooded
  square (swimming yes, `diving` stays false through a held E), so the
  swim cut is provable only where the dive exists; the eye never goes
  under there.
- **Two arrival frames now pay for a mirror they cannot show** (Iceland,
  Kyoto). The occlusion query stays the right tool; W5 should count how
  many of the twelve arrival frames are in this state before deciding.
- **A trap for the next agent on a shared tree:** `git add <file>` puts
  the file in the SHARED index, and the next `git commit` by anyone takes
  it. Four of this rollout's rows and one chapter's code landed in other
  agents' commits that way. Stage and commit in one command, and stage a
  shared file by hunk (`git apply --cached` of the one hunk), never whole.

### A2 — THE FOREGROUND (the near 3 m, empty in nineteen frames)

*"The near 3 m of every frame being empty — foreground framing is the
biggest thing left and the riskiest, because P1 already measured that a
canopy between lens and animal is a camera problem." — the second
beauty pass, and it has stayed open since.*

A biome-keyed foreground row: one or two of the chapter's OWN hanging
or overhanging things placed so they enter the frame's edge at 1.5–3.5 m
from the lens — never on the animal's screen-line. The existing near
depth-of-field ramp (`dofNear0/dofNear1`, `sysDEPTH`) already softens
this band; today it softens nothing because nothing is in it.

- **The rule that makes it safe:** foreground occupies the frame's top
  25 % and its outer 20 % columns only. `sysCamClear`'s boom already
  knows how to cut when geometry is between lens and animal; foreground
  is placed relative to the RESTING lens (`capy3-the-resting-lens`)
  from the spawn bearing in `main.js`'s table — the bearing is the
  contract, the object is placed to it, and a rig that swings 90°
  simply loses it off the edge, which is correct.
- **Per chapter, from things already built** (no new geometry types):
  Sydney a fig bough (one of the fig crown blobs — `envCAM_FIG_R`'s geometry — as a single low branch);
  Pasto a run of bunting overhead; Quay an awning edge; Kyoto a noren
  and a lantern (`sysBOARD_HANG.kyoto` is already `{kind:'lantern', wind:
  0.7}`); Cali a cable and a kite string; Rio a palm frond; Iceland an
  eave and a lamp arm; Sahara an awning fringe; the Drift a fern and a
  lampfly; Venice the arcade's edge; Kowloon a sign's underside (the
  one thing that chapter is made of); Palawan a coconut frond (already
  translucent via `sysLEAF_K`); Goreme a balloon's rope and basket rim;
  Manly a Norfolk pine bough; the Pantanal reeds; the cave a stalactite
  tip and a glow-worm thread; Antarctica an ice lip; Monaco the palm
  frond that is already there (`monBuildPalms` — this is the one
  chapter that has a foreground today, by accident of the boom gap);
  Hanoi a lantern string and a cable.
- **Instrument:** `qa/wow-fore.js` — the NDC grid's 0–4 m bin per
  chapter, the animal's silhouette clear (hide-and-diff on the body
  meshes, `capy3-visibility-metrics`' way, not a raycast), and a
  screenshot per chapter read by eye — the memory says the automated
  proxies lied about framing three times.
- **`game.state.noFore`.** Zero draw calls if it is merged into the
  chapter's own batch; where it must sway it joins the chapter's
  existing `swayMesh` batch.

**W1 reality check (19 Sep 2026): four of the six landed, two did not, and
neither miss was a shape problem.**

- **Kyoto, Hanoi, Kowloon and Cali shipped**, each a static
  `hangThing`/merged-box addition placed once from the live resting
  camera (position + `getWorldDirection` + two cross products, never
  the spawn table's yaw) and confirmed by an actual screenshot per
  chapter (`qa/wow-fore-<name>.png`, gitignored) plus a bounding-box NDC
  proxy in `qa/wow-fore.js`. The real trap on all four was **the object
  read far too large at 1.5-3.5 m** — `sysBOARD_HANG`'s own lengths
  (`len: 1.05`, `2.05`) are sized for a board mounted 5-15 m off, and
  the first placement at those lengths filled a third of the frame;
  every landed chapter needed its `len` cut to roughly half, sometimes
  twice, before it read as a corner accent instead of a curtain.
- **Manly did not ship: the resting camera itself is not deterministic
  on a fresh arrival.** Three separate fresh boots (`hud.cross('manly')`
  from a cold title screen, no state carried over) converged to three
  DIFFERENT stable camera poses — `(9.09, 6.69, 53.62)`,
  `(-0.56, 5.85, 50.95)`, `(6.51, 5.86, 50.84)` — each one confirmed
  settled by a poll (two 1 s-apart reads agreeing within 5 cm), not a
  mid-transition read. A world-space anchor keyed to any one of those
  poses is right about a third of the time and off-frame or behind the
  lens the other two thirds. This is a property of Manly's own rig (the
  windiest chapter in `wxMOOD`, and the resting-lens memory already
  notes it "cuts to 0.80 against a dune" where every other chapter
  reads `clear: 1`) and is out of scope for this item to fix — it needs
  its own investigation into why the yaw settles differently per boot,
  not a foreground object.
- **Sydney did not ship: the arrival frame has no empty corner to give
  it.** The resting camera at the Sydney spawn sits close enough to
  `envFIG_SPOTS[10]` (-11.5, 17.5) that that fig's own crown blobs
  already fill roughly the right two-thirds of the frame, top to
  bottom — confirmed stable across repeated fresh boots, so it is not a
  measurement fluke. The outer-left column is under the to-do card at
  rest, not just during the arrival hold, and the remaining strip of
  open sky is dead centre, not a corner, so a bough hung there reads as
  a leaf floating with nothing near it rather than as part of a tree.
  This is exactly the failure mode the second beauty pass's own line
  at the top of this section names — "a canopy between lens and
  animal is a camera problem" — except here the canopy already fills
  the frame instead of the near 3 m being empty, so this item's fix
  (add something to an empty corner) does not apply to what Sydney's
  spawn actually has wrong with it.

### A3 — STILL PIXELS ("smoother")

The art style is low-poly and MSAA ×4 is what its edges live on. What
still moves at rest is thin things: cables, bunting strings, masts and
rigging (Cali, Hanoi, Kowloon, Quay, Pasto), thresholded specks (the
lawn's daisies, snow flecks, the grain's near octave), sparkle at range
(already has a `fwidth` fade — the only one in the game), and shadow
edges (texel snap exists; acne on the low suns does not).

1. **A minimum screen width for thin cylinders.** A vertex-shader widen
   toward the camera for any cylinder under ~2 texels at the current
   distance — the "line" trick, applied through `grain()` as `thin:
   true` on the material. The single biggest crawl reducer in the four
   cable chapters. Measured by the masked two-frame diff.
2. **The `fwidth` fade on every thresholded speck.** The sparkle's own
   fix ("a sub-pixel speck does not twinkle, it CRAWLS") generalised to
   the daisies (`cut 0.66`), the snow flecks, the pale-ground specks —
   they fade out at the distance where they would be sub-pixel instead
   of shimmering there. One line per call site, same uniform.
3. **Shadow edges on the low suns.** Iceland at 16°, Antarctica at 28°,
   the Pantanal at 30°: a 4-tap rotated-grid PCF in place of the stock
   3×3 for those three (a `sysSHADOW_SOFT` row, the penumbra pass's own
   table `capy3-the-penumbra` finally wired per-chapter), plus a bias
   re-measure — an acne counter that flags a texel flipping between two
   still frames.
4. **Alpha-to-coverage on the mote quads** (`weather.js`'s `moteQuad`)
   so a petal that crosses a threshold at range stops popping.
- **Instrument:** `qa/wow-still.js` — two frames at rest, motes and NPC
  instanced meshes hidden for BOTH, per-pixel diff = shimmer floor;
  recorded per chapter before, target −40 % after.
- **`game.state.noStill`** (one switch for all four, plus per-term
  reads for attribution).

**The shimmer floor, recorded (19 Sep 2026).** `qa/wow-still.js` built
and run: two raw renders 120 ms apart through ONE frozen copy of the
resting camera, the intended motion hidden for both (weather fields at
renderOrder 6, the 72-vertex roster, sway-hooked instanced foliage, the
locals, the animal), per-pixel max-channel diff > 8 levels, the LEAST of
three pairs (a shower's onset is an event, not the floor — the first
single-pair run read Kyoto at 82 % moved for exactly that reason).
Moved % of frame / of the lower third:

sydney 0.95/0.18 · pasto 1.89/1.39 · quay 4.99/6.56 · kyoto 0.32/0 ·
cali 0.79/0 · rio 2.01/2.11 · iceland 1.78/0.30 · sahara 1.69/0.95 ·
drift 0.35/0 · venice 1.05/0.04 · kowloon 3.00/3.22 · palawan 1.86/0.29
· goreme 0.22/0.02 · manly 0.95/0 · pantanal 3.00/2.74 · cave 0.21/0.32
· antarctic 0.45/0.05 · monaco 0.83/0.71 · hanoi 3.19/0.00

The four worst are the Quay (rigging, the harbour's sparkle), Kowloon,
the Pantanal (tufts, the flood's sparkle) and Hanoi (the cables) — the
chapters A3 named before it was measured. These are the "before" for the
−40 % target; anything in A3 is judged against this row, per chapter.

**W1 reality check (19 Sep 2026), before building any of the four —
LIFT10's lesson applied to this item too: check the code before chasing
the description.**

- **The fwidth fade on the daisies is not a gap. It already ships.**
  `grain()`'s `speck` term (`shared.js:5991-6006`) has carried a
  footprint fade since it was written (`skfw = max(fwidth(skq.x),
  fwidth(skq.y))`, `skM *= clamp(1.0 - skfw*0.9, 0, 1)`) — the same
  code path every `speck:` call site shares (`environment.js`, `cali.js`,
  `manly.js`, `kyoto.js`). "The snow flecks, the pale-ground specks"
  named alongside it do not exist as a distinct ground term anywhere —
  every `speck:` call site so far is a grass gate (`skM *=
  smoothstep(0.02, 0.10, diffuseColor.g - max(...))`, `:6004`); a sand
  or snow variant would be a NEW term, not a missing fade on an old one.
  Held, not built — the real four-cable-chapter and four-item framing
  this section opened with does not survive contact with the code
  unchanged; see the next two notes.
- **Shadow softening for the three low-sun chapters SHIPPED (19 Sep
  2026), but not as "a 4-tap rotated-grid PCF" — that already exists
  and is stronger than what this item asked for.** `sysInstallShadowFilter`
  (`systems.js:10927`) globally replaces three's stock PCF-soft chunk
  with a contact-hardening filter — a 5-tap blocker search plus up to a
  12-tap two-ring rotated disc, penumbra WIDTH scaled by measured caster
  depth (`sysPEN_K/MIN/MAX`, `:10919-10921`) — wired once from
  `createSystems()`. What was real and still open: `sysBIO_SH_NB`
  (`:2654`) was a binary flat/tall pair with no row for a low sun angle,
  so Iceland (16°), Antarctica (28°) and the Pantanal (30°) took
  whichever of the two their `cdef.tall` flag happened to give them. A
  named override table, `sysBIO_SH_NB_BY` (`:2660`, `{ iceland: 0.085,
  antarctic: 0.09, pantanal: 0.075 }`), reasoned off the same grazing-
  angle argument the roadmap gave, read ahead of the binary pair in
  `shadowFitBiome` (`:11256`). Verified live (`qa/wow-shadow-bias.js`):
  the three named chapters read their new bias, every other chapter's
  reading is bit-for-bit unchanged, zero console errors.
- **Alpha-to-coverage on the mote quads is the wrong fix for the code as
  it stands, and the real bug is different from the one named.**
  `moteQuad` (`weather.js:647`) is deliberately OPAQUE geometry — no
  alpha channel at all (`weather.js:608-628`'s own comment: doubling
  `transparent + DoubleSide` cost was measured and removed on purpose).
  Alpha-to-coverage converts alpha into MSAA sample coverage; there is
  no alpha here to convert, so the option would be a silent no-op if
  set. The actual "crosses a threshold and pops" culprit is more likely
  the tumble itself: every mote spins on three axes every frame
  (`weather.js:1058-1059`, `wxE1`/`wxQ1`), so a folded quad periodically
  presents edge-on to the camera and its screen footprint collapses to
  a hairline regardless of distance — the same family of problem as
  A3.1's thin cylinders, one call site over, and possibly the same fix
  (a minimum-footprint floor) rather than a material flag. Not sized or
  built this pass; needs its own short instrument (log a mote's screen-
  space bounding width across one spin cycle) before a fix is guessed
  at twice.
- **A3.1 (thin cylinders) narrows, it does not close.** Cali's bunting
  (`cali.js:1015-1022`) and Hanoi's cables (`hanoi.js:1502-1549`,
  explicitly `castShadow: false`) are hand-built thin BOXES, not
  cylinders — a vertex-widen-toward-camera trick keyed to
  `CylinderGeometry` does not touch them. The real cylinder candidates
  are Quay's mast (`quay.js:3189`, r 0.10) and rigging poles
  (`quay.js:1190-1209`), and Pasto's cord (`pasto.js:1621`, r 0.055,
  whose own comment at `pasto.js:1351` already names "a cord thinner
  than a shadow-map texel" as a known, previously unaddressed
  artifact). `grain()` has no vertex-shader injection point today
  (`onBeforeCompile` only edits `shader.fragmentShader` past its one
  `#include <begin_vertex>` world-position tap, `:5783-5794`) — `thin:
  true` needs a new one added, not a flag on an existing hook. Sized for
  two chapters, not four; still open.

  **Checked 19 Sep 2026, not built.** The vertex-widen trick needs one
  more thing Quay's mast does not have. `B.cyl(0, 3.4, -0.2, 0.10, 2.2,
  ...)` (`quay.js:3190`) is one call into the SAME merger as the whole
  ferry hull — walls, roof, wheel, fenders — and `B.build()` bakes
  every part's transform into its vertex positions onto ONE
  `BufferGeometry`/ONE `Mesh`/ONE material (`quay.js:3200`). Reading a
  vertex's raw local `(x, z)` distance from the origin as "the radius
  to widen" is meaningless on a baked, merged vertex — the mast's
  vertices are not centred on the origin any more, and the SAME
  material would try to widen the wheelhouse wall's vertices by the
  identical formula. Pasto's cord is very likely the same shape of
  problem, same file family. The trick needs either its own un-merged
  `Mesh` per thin part (a real if small change to the ferry/cord
  builders, one more draw call each) or a per-vertex attribute the
  merger writes at build time — new plumbing in `makeMerger`, not a
  `grain()` option. Neither is a one-line change; not attempted.

### A4 — RAYS, WHERE THE SUBJECT IS A LIGHT

The cave's shaft has motes, which is what makes its beam a beam; four
other chapters have a light as their subject at arrival and draw it as a
bright shape. A screen-space radial blur of the **existing quarter-res
bright pass** toward the projected light position, composited additively
at low strength — no new scene render, ~0.3 ms.

- **Goreme** — the sunrise ridge and the burners (the chapter's own
  event "the sun clearing the ridge" gets rays through the predawn
  dust). **Sahara** — the sun disc through the haze at noon (the one
  chapter with 36–40 % sky in frame). **Kowloon** — the big pink sign,
  rays through the wet air. **Iceland** — the lamps, which "light
  nothing on the road" (open since the first pass): a spill disc on
  the road under each lamp (`sysSpillScan`/`sysSpillFrame`'s machinery) plus rays through
  the haar. **Monaco** — the terrace lights across the basin, rays
  through the salt haze the weather row already describes.
- A `rays` row in `sysLENS`: `{ k, len, src }`, where `src` is the
  light's world position (the sun via `sysSUN_BY_BIOME`, a named
  emitter otherwise) projected each frame; the term is zero unless the
  projection is inside the frame with margin — the sky is 0 % of most
  frames and this must not paint rays from a sun that is behind the
  lens.
- **Instrument:** the per-pixel diff cut vs live; the rAF A/B.
- **`game.state.noRays`.**

### A5 — CLOUDS FOR THE SIX THAT SHOW SKY, AND THE SUN DISC

The sky is 0 % of the frame in most chapters and this pass respects
that finding: nothing here for the thirteen. For the six that show it —
the Drift 14 %, Sahara 36 %, the Pantanal 24 %, Palawan 23 %, Goreme
22 %, Cali 21 % — a slow noise-shaded cloud band on the shared dome
(one more term in the dome's fragment, drifting on the weather's own
`dir`), and a sun disc with a soft halo in the three daylight ones.
Sydney keeps its own clouds. Cheap, and it is what those six frames'
top fifth is made of.

- **`game.state.noSky2`.**

## Part A′ — what the reference asks for that the law allows (added 19 Sep 2026)

Two reference frames were put beside the game (a smooth-shaded stylised
survival game: a figure walking toward a farmhouse at golden hour, and
the same scene in rain and fog). The game is not that — it is flat-shaded
low-poly by law and stays so — but read closely, what makes those frames
feel smooth and rich is mostly not the shading model. It is five things,
and four of them cost almost nothing here. Ranked by look-per-millisecond;
each is additive, each cuts on a `noX`, none moves a dial.

### G1 — GRASS AS A VOLUME (the single biggest lift toward the reference)

The reference's ground is a *volume* of blades the figure wades through.
Ours is a plane with daisy specks and 14 cm squashed-cone tufts
(`envTuftClump`, environment.js:3488). One instanced draw of flat-shaded
blade fans — three or four triangles each, no quads-with-alpha, so it is
inside the law — in a camera-following box like the mote field's
(`wxBOX_R`, weather.js), ~4–6 k instances, colour taken from the ground's
own vertex colour at the blade's foot (so it is the lawn's green, the
Pantanal's, the Drift's violet-grey, never a new hex), height 0.25–0.6 m
per chapter, a vertex-shader sway driven by the gust the chapter already
publishes (`swayTick`'s wind, so grass and canopies move to the same
breath), a distance fade at the far edge of the box, and a trample: blades
inside 0.5 m of the animal's foot ring lie down along its velocity and
stand back up over ~2 s. Chapters: Sydney, Pasto, the Pantanal, the
Drift, Iceland (tussock), Manly (dune grass above the tide), Cali's
riverbank, Goreme (sparse, dry, short). Not Palawan's sand, not the
cave, not Antarctica.

- **Cost:** +1 draw call, one instanced buffer updated only when the box
  recentres (every ~3 m of travel), the sway entirely in the vertex
  shader. Budget 0.3–0.6 ms. Rung 1 halves the count; rung 2 parks it.
- **Instrument:** `qa/wow-grass.js` — instances in frustum at arrival,
  the rAF A/B, and the still-diff (grass sway is INTENDED motion — mask
  it in `wow-still` the way motes are).
- **`game.state.noGrass`.**

### G2 — DAPPLE UNDER THE CANOPIES

The first reference frame's ground is mottled — light through leaves.
The cloud-shadow term already subtracts direct light through a drifting
noise (`uCloudP`/`uCloudS`, shared.js:2093; the rim-block cloud of the
first beauty pass). A dapple is the same term with a finer noise, keyed
to the ground inside each canopy's footprint rather than to the sky:
`grain(ground, { dapple: { cells, k } })` reading the chapter's canopy
list (the fig crowns, the Pantanal's gallery trees, Kyoto's, Manly's
pines, Cali's cable-street trees) as a small uniform array of
`(x, z, r)`. Moves with the gust like the crowns do. Zero geometry, zero
draw calls, a few instructions per ground fragment.

- **Instrument:** per-pixel diff inside the canopy footprints; the
  cloud term's own A/B harness.
- **`game.state.noDapple`.**

**SHIPPED (19 Sep 2026), four chapters.** `grain(ground, { dapple: {
cells, k, scale } })` in shared.js: at most eight `(x, z, r)` circles baked
into the fragment source as constants (crowns do not move — no uniform
pool), a soft disc per crown (full inside 0.7 r, gone at r, combined by
max), two octaves of `grNoise` at 3.2 cells/m thresholded
`smoothstep(0.34, 0.62)`, one multiply on the albedo by `1 - dap * k`; the
sample drifts on the cloud's own accumulated wind (`_cloudP` bound a third
time as `uGrDapDrift`, independent of the rim branching, because a ground
material is rimmed and never saw `uGrCloudP`). In both cache keys. Zero
draw calls, zero geometry. Sydney: the eight figs nearest the spawn
(`envDAPPLE_FIGS`, r 4.6). Pantanal: the mango tree and seven capoes
(`panDAPPLE`; the gallery forest is `rand()`-placed and cannot be named).
Kyoto: the four sando maples, from one table (`kyoSANDO_MAPLES` — the
build now reads its trunk positions from it). Manly: eight Norfolk pines,
on the terrain AND on the verge mesh whose turf slabs cover every
footprint (a dapple on the terrain alone measured 0.65 %). Cali skipped
(its file was busy).

**The cut is `dappleSet(on)` in shared.js** (a shared `uGrDapK` uniform, 0 is
an exact cut). Nothing in src reads `game.state.noDapple` yet — that wire is
one line in systems.js for W5; the probe calls the setter directly.

Verified live (`qa/wow-dapple.js`, one chapter a run, pretty pinned, an own
camera 6 m off the footprint, on/off in one evaluate, each pixel's ray met
with the ground plane — inside the circle / a control annulus at 1.15–2 r):
Sydney 53.6 % moved, mean 13.2 / control 0.00; Pantanal 24.7 %, 5.7 / 0.00
(understory quads in the mask); Kyoto 60.9 %, 7.6 / 1.38 (the flat-plane
mask on rolling ground, not the shader); Manly 32.7 %, 7.8 / 0.00. Zero
console errors. Every ON frame read by eye: 30–50 cm shade blobs on the
ground under the crown, nothing outside the circles, no lattice.

Found on the way, not fixed: Kyoto's first sando maple (−19.5, 41.7) stands
inside the southern machiya row.

### G3 — GROUND MIST

The second reference frame is three layers of mist with trees dissolving
through them. The cave already builds one (`cavMist`); nothing else
does. Generalise it: two or three very large, very low, very soft quads
per chapter — additive-ish, noise-alpha, drifting on the weather's
`dir`, fading with height above the ground and to nothing at ~0.8 m —
for the chapters whose weather row already describes it in words:
Iceland ("Midnight Haar", a sea mist coming off the water), Goreme
("the dust that hangs in it over the burners"), the Pantanal at dusk,
the Drift ("in the mist", its own spawn comment), Monaco ("the faint
salt haze a Mediterranean evening genuinely has"), Venice at tide. The
rain rows raise it while a shower runs.

- **Cost:** 2–3 transparent quads, sorted last; ~0.1 ms.
- **Instrument:** the diff over the lower third of the frame; the
  weather probe forced on (`odds: 1`, `hold: 14` — trap 35).
- **`game.state.noMist`.**

**SHIPPED (19 Sep 2026), all six.** `wxMIST` in weather.js (the mood
table's own file — a row per chapter, `{ h, alpha, drift, tint, tide? }`,
no per-biome code): three sheets in one geometry under one
`ShaderMaterial`, one draw call, six triangles; value-noise alpha over
world x/z advected by `wxGust`, a radial fade from the animal, a near-lens
fade, `pow(1-h, 1.4)` to nothing at `h` (0.6–0.8 m), and a Beer-Lambert
slab term (`od / cosθ`) so the band thickens toward the far side of the
frame and thins under the lens rather than lying on the ground like a
decal. Rain lifts alpha (+55 %) and h (+30 %) on `rainT`; Venice's row
scales with `waterLevel` between its two tide marks. Tint is a PALETTE
entry per row; no grade, sun, fog or mote row moved. Parks at governor
rung ≥ 1 (allocated, `visible = false`); `state.noMist` cuts it.

Verified live (`qa/wow-mist.js`; pretty pinned via `capy3.prefs.v1
{v:1,pf:1}` because a headless machine under six boots sits at rung 3 on
auto and the band correctly parks): per chapter the lower-third diff,
on vs off, as mean level over the whole band / share of pixels changed —
Iceland 12.5 / 76 %, Goreme 3.3 / 42 %, Pantanal 8.5 / 89 %, Drift 19.6 /
89 %, Monaco 6.1 / 88 %, Venice (low tide) 3.2 / 32 % — against a parked
floor of 0.03–1.3 (motes and water moving between two ticks). Forced
shower on Iceland: `rainT` 0.505 peak, alpha 0.34 → 0.434, h 0.80 → 0.92.
Zero console errors. Every arrival frame read by eye: a low band, never
on the animal's face. The UPPER-third control (same on/off pair, rows
0–h/3, where a band under 0.8 m has no business) reads floor in all six —
Iceland 0.26 / 1.9 %, Goreme 0.34 / 1.9 %, Pantanal 0.72 / 6.8 %, Drift
0.25 / 1.6 %, Monaco 0.24 / 1.9 %, Venice 0.62 / 8.9 % — the two larger
ones being chapters whose parked floor already moves that much (cloud
cards, gulls, water). One chapter per invocation from 19 Sep: a six-boot
sweep is one tool call over ten minutes under load and the harness kills it.

Two things the build taught. (1) **A chapter's fog colour is invisible
as its mist** — the first round tinted every row with its own haze and
measured as nothing in all six; a mist reads against what it hides, so a
pale chapter takes a tint darker than its paving (Venice `venPigeon`,
Goreme `gorShadowFog`) and a dark one a tint lighter than its road
(Iceland `wxHazeWet`, the Drift `driCloud`). (2) **The sheets were wound
face-down** — `(-r,-r)→(r,-r)→(r,r)` over x/z is clockwise from +y, so a
`FrontSide` sheet drew nothing in any chapter, and the "haze" read in an
early Iceland frame was that boot's own variation. A red-tint diagnostic
with `depthTest` off (`qa/wow-mist-diag.js`) is what said so; the
instrument's floor-level numbers had said it first and were not believed.
Goreme's hillside and the Drift's islands both read fine with a level
sheet: mist pools in the low ground, which is what a level sheet does.

### G4 — THE ANIMAL'S RIM, WHEN BACKLIT

The reference's figure has a bright edge against the sky. The game has a
rim block already (the cloud lives in it; Mong Kok's had to back off its
magenta hemisphere). It is a world-wide term. Give the animal its own
rim gain — `capy.model`'s materials only — that rises with how backlit it
is (`dot(view, sunDir)` at the animal, the same test `sysLEAF_K` is
directional on), so the capybara separates from a dark background the
way the figure does, and nothing else in the frame changes. Costs
nothing; the term exists.

- **Instrument:** `qa/leaf-orbit.js`'s eight azimuths, the animal's
  silhouette diffed per pixel (hide-and-diff, not a raycast).
- **`game.state.noCapyRim`.**

**SHIPPED (19 Sep 2026).** `sysSELF`'s per-chapter baseline
(`systems.js:2492`) is a measured constant and stays one — this does not
re-base a row of it. It is multiplied, once a frame, by `1 +
sysCAPY_RIM_GAIN * backlit` (`systems.js:2489-2496` for the constants,
the call site at `:38278-38295`), where `backlit` is `dot` of the
animal-to-camera axis against `sysAxDir` (the leaf term's own
ground-toward-sun axis, reused rather than re-derived) — zero shader
work, a JS scalar computed from vectors already in hand. Verified live
(`qa/wow-capy-rim.js`, Cali, `sysSELF.cali` baseline 0.26): eight
azimuths around the animal read 0.26–0.3824 with the term on and a flat
0.26 at every angle with `noCapyRim` set, zero console errors.

### G5 — THE LIVING ARE ROUND (the one amendment to the law, decided)

*Player: "apply more use of smoother curvature (rather than hard blocky
edges) where appropriate — I think there's benefit applying it a bit to
the capybara and live human-looking NPCs or animals."*

The rule, and it is the split the reference frames make too (a blocky
farmhouse, a soft figure): **the built world is hard-edged; anything
that breathes is round.** Buildings, boats, vehicles, props, the ground,
the trunks — `flatShading: true`, unchanged, the game's look. The
capybara, every human, every animal — smooth.

**Why it costs almost nothing.** Three's `SphereGeometry` carries smooth
per-vertex normals and `BoxGeometry` carries face normals, by
construction; `flatShading: true` throws both away and recomputes faces
in the fragment shader. Turn it OFF on a living thing's material and the
geometry decides: every sphere-built part goes round, every box-built
part on the same figure stays hard. The capybara is `capyGeoBlob`
(8×6 spheres, capybara.js:531) and `capyGeoBead` scaled into body,
head, muzzle and limbs — it rounds in one flag. The ibis, the gull, the
dog, the llama, the herd, the penguins are `npcMakeGeo` part lists with
`k:'sph'` bodies and heads — same. The human roster figure's shirt,
shoulders, hem and placket are boxes and stay crisp, which is right:
**a body is alive, a garment is built.**

1. **The materials.** `matSelf`/`mat` already take `opts` merged over
   `{ flatShading: true }`, so `{ flatShading: false }` is the whole
   change at each living call site — but `mat()` caches by colour, and
   PALETTE.capy is not unique to the capybara (matSelf's own comment),
   so the smooth variant needs its own cache key (`matRound(color,
   opts)`, one wrapper, `_key + ':round'`), or the lawn's fig shares a
   program with the animal.
2. **Heads that are boxes become heads that are spheres.** The roster
   figure's head is a 0.32 m box (npc.js:932); a sphere scaled to the
   same 0.32×0.32×0.31 is a rounded head with the same silhouette
   width, and the nose block and neck stay boxes on it. `npcMakeGeo`'s
   `sph` part takes `r` only — add `sx/sy/sz`. This is the same edit
   ONE PERSON already makes, so it lands with it. Hips and torso stay
   boxes (a shirt has corners); hands and feet, where they exist as
   parts, go `sph`.
3. **A segment step for the two faces the camera lives on.** The
   capybara's body and head blobs 8×6 → 12×8 (a few hundred
   triangles, once; the law's "≤ 8×6" gets the same written exemption
   row the sky dome and `gorBuildSky` have — this animal is the
   subject of every frame in the game). Nothing else changes count.
4. **The condor, the frigatebird, the orca, the manta, the whale, the
   jacaré, the jabiru, the heron, the koi** — each is checked on the
   sheet (W0) for which of its parts are spheres and which are boxes
   that should be, and rounded on the same rule. Wings stay planar.
   *Landed 19 Sep 2026 for npc.js's own kinds — the ibis, the gull, the
   llama, the Pasto and Quay dogs: the animals' instances take
   `matRound(PALETTE.sail, {vertexColors})` through a `round` argument to
   `mkInst` (the people's and props' `instMat` is untouched — ONE PERSON
   decides theirs), and on a part list the GEOMETRY decides: sphere and
   cylinder parts carry smooth normals through `toNonIndexed` and go
   round, every box part stays hard. `npcMakeGeo`'s `sph` takes
   `sx/sy/sz` semi-axes now, and the dog's and the llama's skull boxes are
   spheres of the same silhouette with the snout, face block and ears
   still boxes on them. `game.state.noRound` is live — one material swap
   per animal instance on the edge, polled in `update()`; no recompile,
   since the flat and round materials both already exist. Segment count
   unchanged (6×4): the read is the seams going, not the silhouette.
   Sheet: `qa/wow-round-animals.js`, flat/round pairs from the front
   quarter and the side (`RND-*`), 0 console errors. NOT on it: the
   gentoos (antarctic.js), the herd (pantanal.js), the koi and heron
   (kyoto.js), the puffins (iceland.js), the pigeons (venice.js,
   goreme.js) — chapter-file animals, same rule, their own agents.*
5. **The law is amended in CONTRACT.md's "Aesthetic law" when this
   lands**, in one line: *flat-shaded for the built world; smooth
   normals for anything that breathes.* Written down, not inferred.

- **Cost:** zero per frame; the program count rises by one per living
  colour (the smooth variant); the capybara's own triangle count by
  ~600.
- **Instrument:** the animal's eight-azimuth contact sheet and each
  chapter's three NPC kinds, flat vs round, side by side — read by eye
  (no number decides curvature); `qa/rv-geom.js` re-baselined after.
  `game.state.noRound` puts every living material back to flat for the
  A/B.
- **Wave:** W4, the animal first (with its belly band, eye fleck,
  toenails and whisker nubs — one contact sheet covers all of it), then
  the people with ONE PERSON, then the animals per chapter.

Trees' crowns stay OUT of this item: a tree is alive but a crown is a
mass, not a body, and rounding the fig blobs while the trunks stay
faceted was the taste call the first draft of this item hedged on. It
stays behind `game.state.smoothCrowns`, OFF, judged by eye at the
closeout — the only thing in this pass that still is.

**G5 reality check, the animal (19 Sep 2026) — the description above
was written against a capybara that no longer exists.** "capyGeoBlob
scaled into body, head, muzzle and limbs — it rounds in one flag" was
true before R2–R4. Today the body is a hand-authored hull
(`capyHullGeo`, seven stations, twelve sides), the head a 0.36 m box,
the muzzle a chamfered brick (`capyMuzzleGeo`), the shin a three-ring
tube (`capyLegGeo`) and the feet toed slabs (`capyFootGeo`) — all
non-indexed, all `computeVertexNormals()` on a non-indexed buffer, which
is a FACE normal per vertex, chosen on purpose by each of those
comments for the rim's sake. `flatShading: false` on a face-normal
buffer renders exactly as flat as before. So the flag alone rounded the
belly, the tail, the cheeks, the ears and the eyes and left the body
faceted between them — a soft animal in a hard barrel.

What shipped: the flag on the six fur materials (`matSelf` with
`flatShading: false`, same rim hook, same character key; `matRound()`
in shared.js for the cached eye accent, `+':round'` key), a 12×8
`capyGeoLive` for the seven sphere-built parts (the blob stays 8×6 for
the wardrobe's hood), and an AUTHORED smooth normal set on the hull and
the shin (`capySmoothNormals`: area-weighted across the strip, the caps
— chest, rump, sole — keep their face normals, so the rump stays blunt).
Both normal sets stay on the geometry and `game.state.noRound` swaps
the attribute WITH the flag, because the rim reads the attribute either
way (`_RIM_VS_BEGIN` takes `objectNormal`) and an A/B that flipped only
the flag would be comparing two rims. Live toggle, polled once a frame
in `capyUpdate`, applied on the edge. The skull, muzzle, jaw, brow, nose
pad and toed feet stay hard by the rule's own words (a box-built part on
a living thing stays a box) — the brick skull IS the species tell. On
the sheet (`qa/wow-round.js`, eight azimuths × two states, own camera)
the round hull reads as one soft mass with no seam, `canopyAudit().rim.self`
is 0.086 in both states, and the one thing left for an eye at the
closeout is whether a round body under a brick head wants the skull's
top edges softened too — not done, not decided. `qa/rv-geom.js`'s
baseline is invalidated by the segment step and NOT re-baselined here.

**The animal's own uplift (Part C), same day — two of the four were
already there.** The belly band is R1's coat (`capyCOAT_BELLY`, a `c`
multiplier on the hull's underside, plus the `capyLight` belly part)
and the eye highlight fleck is L6's catchlight (`mCatch`, `matEmit`
over `EMIT_OVER`, a bead on each eye's upper front) — both read on the
sheet at 3 m and in the 7 m play frame before this pass touched
anything. What was missing: **toenails** (one dark box per toe tip on
R4's toed feet, positions read off `capyFootGeo`'s own spacing; 4+4+3+3)
and **whisker nubs** (three dark beads a side on the muzzle flank at
v54's whisker roots, so the sticks leave a follicle rather than a box).
Both in `capyNose`, the palette's existing dark accent for the face —
no new hex — on `mat()`, no shadow, ~360 triangles between them. Read
on the re-shot sheet (`WR2-*`) and the two close-ups
(`qa/wow-round-close.js`): the nails are dark caps at 1.6 m and a dark
tick line along the foot fronts at 7 m; the nubs a dotted pad where the
whiskers come out.


### What the reference has that this game should NOT chase

Real-time volumetric fog (a raymarch; the airlight and G3 together are
its whole visible effect at a hundredth of the cost); a smooth-shaded BUILT world (G5 rounds what breathes and nothing else); textures of any kind;
motion blur; ambient occlusion beyond the crease (already measured to
darken lawns — `capy3-the-depth-pass`). Held, with the rest.

### Where G1–G5 sit in the waves

G2 and G4 join **W1** (zero draw calls, pure shader terms — same safety
class as A3). G1 is its own **W1b**, one agent, after `wow-still` has
recorded the floors (grass sway must be masked as intended motion before
it goes in, or the −40 % target reads as broken). G3 joins **W3** with
the rays. G5 is **W4**, with the animal and ONE PERSON; only the crowns stay behind a switch.

## Part B — nineteen beats, one per chapter, each in its own sentence

The audit's rule: amplify the chapter's own sentence, never write a new
one. Each row names the sentence (the spawn comment or the weather row
that already says what the place is), the beat, which Part-A capability
it rides on, and the one thing to measure. A beat is IN the arrival
frame or it is not a beat.

| # | chapter | its own sentence | the beat | rides on | measure |
|---|---|---|---|---|---|
| 1 | Sydney | "looking down the forecourt at the shells; the figs were planted to frame this" | a jacaranda petal drift on the gust across the forecourt, and the fig bough as foreground; the sails catch the wide bloom at the golden minute | A2, A5 | petal count in frame > 40 at arrival |
| 2 | Pasto | "Galeras across the valley — the whole chapter" | the volcano's plume lit from below at dusk (an emitter on the crater rim, already an event) and the bunting's shadow laid on the plaza — the shadow pass already runs, the bunting is not a caster | A2 | bunting shadow present in the diff |
| 3 | Quay | "the ferry on her berth in the near field and the bridge eighty metres out" | the ferry's wake as a reflected sky-line on the harbour (A1 on the seaMid sheet), gull shadows racing the apron | A1 | reflection diff over the harbour mask |
| 4 | Kyoto | "the mirror pond and the pavilion fill the middle distance" | THE MIRROR POND, mirrored — the flagship; lantern light pooled on wet stone under the eaves; petal cover thickening under the trees | A1, A2 | reflection diff; the pond in the arrival frustum (it is — `qa/l10-kyoto-sightline.js`) |
| 5 | Cali | "down the length of the Río Cali, the painted street" | the cables drawn STILL (A3.1) against a sky with kites in it; the river reflecting the painted row | A3, A1 | cable crawl −40 %; reflection diff |
| 6 | Rio | "the Atlantic straight ahead, the wave paving running out to both edges" | a wet band at the break where the paving goes to mirror (A1 at high blur on the wet-sand material) and the foam glare the grade row already wants | A1 | wet-band reflection present |
| 7 | Iceland | "the stand eight metres up the street and the old harbour beyond" | the lamps finally light the road (A4 spill + rays through the haar); the harbour mirrors the aurora when it comes (A1) | A4, A1 | spill on the road under each lamp in the diff |
| 8 | Sahara | "facing the Koutoubia, 52 m out and 38 m tall" | the sun through the dust (A4), a heat-shimmer band over the far sand (a mild screen-space vertical wobble, sysLENS row, this chapter only), awning fringe as foreground | A4, A2, A5 | rays present; shimmer confined to the far band |
| 9 | the Drift | "at the broken end, 27 m away, with the void past it" | the lantern's beam given the cave's mote treatment (a column you can see), the islands' undersides lit by it; a fern as foreground | A4, A2 | beam visible in the diff |
| 10 | Venice | "the Basilica closes the far end at 83 m" | at acqua alta the square IS the mirror — the Basilica's front doubled (A1 on the flood sheet, tide-gated); the arcade edge as foreground | A1, A2 | reflection diff at tide > 0.6 |
| 11 | Kowloon | "under the signs, with the big one 41 m out" | the wet street reflects the signs for real (A1, blur high), rays through the wet air from the big one (A4), a sign's underside as foreground | A1, A4, A2 | reflection diff over the road mask |
| 12 | Palawan | "out over the bay, with the island a few degrees off the bow" | caustics on the sand under the shallows (a drifting noise multiply on the swash material — `grain()`'s existing water path, one more octave), the manta's shadow on the bed | — | caustic term in the diff over the shallows |
| 13 | Goreme | "at the launch field, 30 m out, the first envelope already up" | the sun clearing the ridge as rays (A4), the envelope's inner glow when the burner fires (an emitter inside the envelope, `EMIT_OVER`), the rope as foreground | A4, A2 | rays present at the event |
| 14 | Manly | "straight out to sea, square to the sets" | the break's spray backlit (the leaf term on the foam batch — `sysLEAF_K`, a foam is translucent), the pine bough as foreground | A2 | foam backlit diff at the seaward azimuth |
| 15 | the Pantanal | "the flood on both sides" | THE FLOOD MIRRORED (A1) — the gallery trees and the jabiru doubled, fireflies doubled at dusk; reeds as foreground | A1, A2 | reflection diff over the flood mask |
| 16 | the cave | "outside, at the mouth — the argument only works if you walk into it" | the river reflecting the shaft (A1) so the lit far layer is in the frame from the passage, not only under the hole; glow-worm stars doubled | A1 | reflection diff over the river |
| 17 | Antarctica | "down the hill at the jetty and the boat, everything else a long way past it" | the sea mirrored between the floes (A1), the ice lip as foreground, blue ice given the leaf term (translucent at the sun's 28°) | A1, A2 | reflection diff; ice translucency at the backlit azimuth |
| 18 | Monaco | "across the basin at a hundred and thirty feet of somebody else's money, the terrace lit above it" | THE BASIN MIRRORED — the open item since the first pass; the terrace lights doubled and the yacht's own; the chandeliers' rays through the salt haze (A4) | A1, A4 | reflection diff over the basin mask |
| 19 | Hanoi | "across the water at the tower and the red bridge" | HOAN KIEM MIRRORED (A1) — the tower, the bridge and the lanterns doubled; the shower's rain-slick road takes the Kowloon treatment while wet; a lantern string as foreground | A1, A2 | reflection diff over the lake mask |

### Beats shipped (19 Sep 2026, running list)

- **Pasto — the bunting's shadow.** Not by making the bunting cast: the
  cord's non-casting was a MEASURED decision (`pasto.js`'s PAPEL PICADO
  note — a 5 cm cord thinner than a texel threw scaffolding bars across
  the paving) and it stands. The flags alone go to their own casting
  mesh (`pastoBuntingFlags`, one more draw call, 1 044 triangles); the
  cords and posts stay in the non-caster. `qa/wow-pasto-flags.js`: the
  cast-vs-not diff shows the six runs as rows of soft coins across the
  plaza (0.9 % of frame moved, faint by design — a 46 cm flag eleven
  metres up through the contact-hardening filter is a soft dot, which
  is what papel picado lays on a square at noon). Cut by flipping that
  mesh's `castShadow`.
- **Manly — the break's spray backlit.** `leafMesh()` on the foam
  streaks (k 0.9) and the lip spray (k 1.1) — the leaf term the canopies
  already carry, a foam being translucent the way a leaf is. Two lines
  in `manBuildFoam`/`manBuildSpray`; cut by the existing `noLeaf`.
  `qa/wow-manly-foam.js` (eight azimuths round the foam field's own
  centroid, the cut's diff against a same-gap control of the foam's own
  motion): 900–3 000 px per frame brightened by 23–36 levels, most at
  the azimuths facing the sun — a frame mean could not see it (0.05
  levels), the leaf pass's own lesson, so the instrument counts the
  pixels the cut moved and the motion did not.
- **A1 in eight more chapters (the W3 rollout)** — Quay, Cali, Kowloon
  (the wet street), Antarctica, the cave, Venice (tide-gated), Iceland
  (the aurora doubled when it comes), Rio (the wet band, a new strip
  mesh). Numbers, frames and the two honest misses (the cave under
  target, Iceland under it until the aurora) in A1's W3 note above.
- **Palawan — caustics on the sand under the shallows.** The row's
  premise was half wrong: the chapter already HAS a caustic — the
  vertex-alpha additive net `palBuildCaustics` (1.77 m cells, 7-10 m
  period, in at 0.35 m, out by 15 m), whose comment records that a
  `grain()` SPARKLE on an additive sheet was tried and rejected for its
  SHAPE (specks, not a web). What shipped is the octave that sheet cannot
  draw: `caustic: { k, scale, speed }` in `grain()`'s shore path (it
  reads the shore's own `sd`), two value-noise fields folded about their
  middle so each is bright along its 0.5 level set — a connected net of
  curves — thresholded 0.74..0.90, summed so the crossings saturate,
  drifting apart on `uGrainT`, gated in over 0.3 m and out by 2.5 m,
  MULTIPLIED onto the albedo; on `palVCG` only (the one sea you can see
  through), k 1.2. Cut: `causticSet()` / `game.state.noCaustic` (read in
  palawan.js's update). Found on the way: a multiply on that bed is
  capped by the bed itself — teal vertex colour × swash darkening ×
  depth tint × 0.55 sea opacity leaves ~30 levels of sand in the pixel,
  so k 0.55 measured 13 levels and k 1.2 measures 32; the chapter's own
  comment ("a caustic is LIGHT") was right about the additive net and
  this rides under it as the fine web. `qa/wow-palawan-caustic.js` (mask
  from geometry: an override material writing metres-below-waterline,
  the sea sheet hidden): from the arrival lens the 0.3-2.5 m band is 2.2 %
  of the frame at a grazing angle 30 m out — 571 px moved, max 25, deep
  0, sky 0, dry 0.1 % (silhouette edges of posts over the strip); from a
  lens 7 m off a metre of water (`-diag.js`) 24 % of the bed moves, max
  32, and the frame reads as a web on the sand, nothing on the dry sand.
  Honest note for the row's own measure: at the ARRIVAL lens neither
  caustic is a picture (the net moves 632 px of the same band) — the
  spawn looks along the beach, not down at the bed, and the spawn row is
  frozen.

## Part C — the model sheet: structures, movers, NPCs and the animal, biome by biome (added 19 Sep 2026)

*Asked for alongside Part A′: "another deep biome-by-biome review and
uplift on key structures, NPCs (the moving objects and side characters)
and major character details (the capybara, the condor, any other key
marquee characters, boats, helicopters etc.)."*

Everything above is about light and air. This is about the THINGS — the
hero building each chapter is built around, the marquee mover its big
one rides on, the people and animals that make it a place, and the
capybara itself. It is a review first and an uplift second, and it goes
FIRST (W0, below), because it is the one part of this pass that has to
be looked at before it can be sized.

### The sheet — how each subject is photographed

`qa/art-review.js` already does this for Sydney, Pasto, Venice, Monaco,
Antarctica and Kyoto: its own camera, the raw scene render with no
composite, so a model is judged as a model (`window.__art.cam / render /
capyShot / personShot`). `qa/wow-sheet.js` extends it to all nineteen:
per chapter, at three angles each (front three-quarter at the play
angle of ~35° overhead-behind, side, and a close head/detail shot):

1. **the hero structure** — the thing the spawn comment points the
   lens at;
2. **the marquee mover** — what the big one rides, drives or flies;
3. **three NPC kinds** — one instanced roster figure (`npcMakeGeo`, the
   24-triangle person with hem and placket), one hand-built local
   (their own meshes — a collar, a hat), and the chapter's own animal
   or vehicle-with-a-driver;
4. **the capybara in that chapter's costume**, and once, at the start
   of the sheet, the plain animal at eight azimuths (the wardrobe pass's
   own eight-shot contact sheet, re-taken).

Roughly 19 × 8 raw frames plus the animal's eight, read by eye — the
memory's own rule (`capy3-visibility-metrics`): no automated proxy has
ever judged a silhouette correctly here.

### The rubric — six reads per subject, each a yes/no at the play distance

- **Silhouette.** Readable from the fixed 35° lens at the distance it is
  normally seen. The aesthetic law's first line, and the only one that
  matters at 40 m.
- **Secondary forms.** A hero needs at least THREE sub-shapes that read
  at distance (the Opera House has its shells and its podium; a box
  with a roof has one). Movers need their moving part as a form:
  rotor, wheels, wake, wings, a flag.
- **Two colours on anything a person wears or drives.** Beauty pass 2's
  finding, generalised: one hex from shoulders to hips reads as a
  bollard. Vehicles the same — a hull and a deck, a body and a roof.
- **Something on every mover moves that is not the whole.** Wheels
  turn, a rotor spins, a wake trails, a flag or a pennant or an aerial
  sways, a rider's head turns. A vehicle that translates as one rigid
  block is a prop, not a mover.
- **One asymmetry.** A satchel on one shoulder, a dent, a patch, a
  different-coloured shutter — the whimsy law's "slightly oversized,
  exaggerated" needs one thing on each subject that is not mirrored.
- **The face.** For the animal and anything with a head: eyes with a
  highlight fleck (an `EMIT_OVER` dot reads at every distance), a nose,
  a mood the pose already carries. For the capybara specifically:
  ears, the blunt muzzle, the eye line, a second colour band on the
  belly, toenails, the tail nub — the six things that make it a
  capybara rather than a loaf.

A subject passes on 5 of 6. The uplift for a failing subject is written
INTO THE SHEET'S FINDINGS TABLE, per subject, with the read it fails —
not decided in advance here.

### ONE PERSON — the people standard (added 19 Sep 2026, from the player: "in Marrakech their heads seem too small and the quality is low compared to Sydney")

It is structural, not a slip. There are at least THREE ways a human is
built in this tree: the roster figure (`npc.js:920–950` — a 0.32 m box
head with a nose, a neck, hair with a part, and the v54 face: both eyes in
one instanced mesh, brows in another; a torso with shoulders, hem and
placket bands), the hand-built locals (their own meshes, a collar, a
hat), and two chapters that roll their own crowd from nothing —
Marrakech (`sahBuildPeople`, sahara.js:1873: a 0.27 m SPHERE head on
6-segment cylinders, a hood cone, a nose block — no eyes, no brows, no
hair, no neck) and Rio (`rioAddPerson`, rio.js:2732, the same shape of
thing). Head-to-height is 0.20 in Sydney and 0.17 in the square, and a
sphere reads smaller than a box of the same width; that is exactly the
"too small, lower quality" the player saw, measured.

**The standard, written once and read by every builder:** `npcPERSON` in
npc.js — head 0.32 box-class with the v54 face (eyes, brows, nose,
neck), hair with a part, shoulders/hem/placket bands on the torso, the
`npcCHILD_HEAD` 1.22 ratio for children, 0.92–1.09 height jitter (the
square's own "not everybody is the same height" rule, kept). A chapter's
costume is a GARMENT LAYER over that skeleton — the djellaba and hood in
Marrakech, the bikini and the canga in Rio, the parka in Antarctica —
never a different skeleton. `sahBuildPeople` and `rioAddPerson` keep
their own instanced pools, their own AI data strides and their own
behaviour (the halqa rings, the fidget clock — none of that moves); only
the GEOMETRY they instance comes from `npcPERSON`, plus the face meshes
wired the way the roster already wires them. Hand-built locals get the
same head and face parts as a drop-in.

- **The reads it fixes on the sheet:** the face (eyes, and a highlight
  fleck that reads at every distance), two colours on every garment (the
  bands), the head ratio — and consistency between chapters, which is
  not a read on the rubric but is the thing a player actually notices.
- **Cost:** the roster head is 40-odd triangles; a hundred and seventy
  Marrakech figures at that is ~7 k triangles, still one draw. The face
  meshes are two more instanced draws per chapter, as in Sydney.
  Nothing per frame.
- **Instrument:** `qa/wow-people.js` — every chapter, every instanced
  person pool: head bounding-box height / figure height within
  0.19–0.21; eyes present; ≥ 2 distinct colours per torso. Plus one
  static row in `qa/l8-catalogue.mjs`'s style: every chapter's crowd
  builder imports `npcPERSON`.
- **Wave:** the first W4 item after the animal — the sheet (W0) will
  name any chapter beyond those two that has also drifted.

**ONE PERSON reality check (19 Sep 2026): both chapters landed, and the
standard itself had two faults nobody could have seen.**

- **`npcPERSON` shipped** (npc.js, before `createNPCs`): the roster's
  twelve part lists exported once — skull, hair, torso bands, eyes, brow,
  mouth, limbs — with `HEAD_Y`, `SHOULDER`, `HIP`, the child ratio and the
  jitter pinned, plus `standing()` (the body at rest pose as one merged
  list, with `legs:false` / `hands:false` for what a garment covers) and
  `face()` / `hair()` in head space. The roster reads the same lists: the
  twelve literals are byte-identical to what `npcMakeGeo` was given before
  (checked against `80c0163~1` with comments and whitespace stripped), so
  its buffers are unchanged by construction. `qa/wow-person.mjs` is in
  `npm test`: exported once, numbers pinned, every `BuildPeople`/
  `AddPerson` file imports and builds from it, no sphere on a body.
- **Marrakech and Rio** keep their own pools, strides and behaviour; each
  gained two instanced draws (`…PeopleHair` = hair + both brows in the
  hair colour, `…PeopleFaces` = eyes + mouth in white) that ride the head
  matrix already composed per frame — two `setMatrixAt` copies, no new
  arithmetic. The djellaba is `sahDJELLABA`, a garment list over
  `standing({legs:false, hands:false})`; Rio's shorts are the old leg grey
  as a hips/legs multiplier. The pursuers got the same torso, skirt and a
  baked face so they stay the men whose stalls you robbed.
- **The standard's own two faults, found because the square's people
  now have faces:** the roster's `mouthN` never had a z (it sat at
  (0, 0.150, 0), inside the head, since L3-9) and `mouthY` 0.150 is inside
  the nose box (0.11..0.17). Nobody tuned a mouth they could not see. It is
  on the face plane at y 0.085 now, in Sydney too.
- **The trap, paid once:** the first Marrakech cut put the hood cone in
  body space at the head's rest height, and a sitter's body is scaled to
  0.62 while the head is not — so on every cross-legged figure the cone
  landed exactly where the skull is and swallowed it. Found by hiding the
  head pool (`qa/WOW2-probe-nohead.png`), fixed as a cowl behind the
  shoulders. The same probe showed the pre-existing head offset
  (`z + rx*1.3`) was a world-axis shove: a leaning sitter's head sat 27 cm
  back inside his chest. It goes through the body's own quaternion now.
- **Read by eye:** `qa/WOW2-sahara-roster.png`, `-group.png`,
  `WOW2-rio-roster.png`, `-group.png` (gitignored) beside
  `WOW-sydney-roster.png`. The square is a crowd of the Sydney figure in
  robes; the halqa rings keep their heads.
- **Measured (`qa/wow-people.js`, nineteen `hud.cross` arrivals, zero
  console errors):** every live instanced person pool has a median skull /
  figure ratio of **0.193** — Sydney's roster (31 standing of 32), Pasto's
  (13), Rio (284 of 308), Marrakech (106 standing of 174; the rest are the
  halqa sitters, excluded by design) and the six pursuers — with the eyes
  pool at the head pool's count in each and 4–7 colours in every torso
  buffer. Note the number: the head box over feet-to-skull-top is 0.193 for
  the roster too, not the 0.20 this section quoted; the 0.20 was a
  rounder read of the same rig, and the 0.17 the square measured against
  it is now 0.193 by the same rule. The other fifteen chapters report no
  instanced person pool within 120 m of the arrival point — their people
  are hand-built `g.locals`, which this instrument does not measure.
- **The instrument's own trap, paid twice:** its first sweep took the
  roster's 1.30 m rake pool for the body (same instance count, taller
  bbox) and read Sydney at 0.316 with one colour; and it required a
  standing body's x scale to equal its y, which the roster's heavy and
  thin builds (a girth on x alone) fail. Body is the torso pool first, a
  ground-based >1 m pool second; standing is head y-scale == body y-scale.
- **The roster's buffers are what they were:** `qa/rv-geom.js` before and
  after, 654 unnamed `Scene/Mesh` rows each side, one row moved — and that
  one (396 → 420 verts) is another agent's concurrent edit in this tree,
  not a roster geometry. `sahPeople` 272 → 504 verts, `rioPeople` 144 →
  540, both heads → the roster's 108-vertex skull (same hash `e24711ef`),
  two new 144/180-vertex pools each.


### What is on the sheet, per chapter (the subjects; the findings come from W0)

| # | chapter | hero structure | marquee mover | NPC kinds to shoot | costume |
|---|---|---|---|---|---|
| 1 | Sydney | the Opera House (shells, podium, steps) | — (the concert is a place) | roster tourist, the gardener, the ibis / the jogger | the sunhat |
| 2 | Pasto | Galeras and the plaza fountain | THE CONDOR (`condor.js`) — wings, primaries, ruff, head | pasto local, the llama, the dog | the ruana |
| 3 | Quay | the Harbour Bridge and the wharf | THE FERRY — hull, deck, wheelhouse, wake, the skipper | the skipper, roster commuter, the gull | — |
| 4 | Kyoto | the torii tunnel, the pavilion, the bridge at Uji | the raft (THE RIVER RUN) | the kyoto local, the heron, the koi | — |
| 5 | Cali | the Ermita and the painted street | THE PARTY BUS — body, roof deck, wheels, lights | the salsa dancers, the cat, the lulada seller | — |
| 6 | Rio | Sugarloaf, the kiosk, the wave paving | THE FRIGATEBIRD | the biscoito Globo man, roster bather, the football | — |
| 7 | Iceland | the church (Hallgrímskirkja), the hot-dog stand, the pier | the whale; the aurora (a light, not a model) | the stand's vendor, roster local under a lamp, the puffins | the parka |
| 8 | Sahara | the Koutoubia, the souk, the desert camp | THE JETPACK (and its rings) | the orange-cart man, the snake charmer, the acrobats | — |
| 9 | the Drift | the lantern plinth, the broken jetty, the islands | the lampflies; the wind itself | the (few) locals of the Shelf | — |
| 10 | Venice | the Basilica, the Campanile, the two columns | the duckboards; the tide (water) | the Piazzetta roster (140), a hand-built local, the pigeons | — |
| 11 | Kowloon | the big sign, the scaffold, the bakery | THE HELICOPTER — rotor, tail, skids, the pilot | the bakery tray, roster shopper, the lion dancers, the bus | — |
| 12 | Palawan | the karst, the bangka, the jetty | THE MANTA; the bangka (outriggers, the boatman) | the boatman, the clam, the fish | — |
| 13 | Goreme | the fairy chimneys, the launch field | THE BALLOON — envelope, basket, burner, ropes, the pilot | the tea man, the mare and the horses, the pigeons | — |
| 14 | Manly | the lifeguard tower, the Norfolk pines, the flags | THE BIG WAVE (water) ; the surfboard | the lifeguard, roster swimmer, the sandcastle | — |
| 15 | the Pantanal | the Transpantaneira bridge, the pen | THE HERD (the other capybaras — each a model) | the cattle, the jacaré, the jabiru, the cowbird | — |
| 16 | the cave | the shaft, the doline, the slot | the log (the drop) | the swiftlets, the glow-worms, the fish | — |
| 17 | Antarctica | the station huts, the jetty, the pack ice | THE ORCA POD; the orange boat (tiller, the skipper) | the gentoos, the station crew, the skua | the parka |
| 18 | Monaco | the Casino, the terrace, the yacht | the red car (THE GRAND PRIX) — wheels, wing, driver | the casino staff, the yacht's crew, roster promenader | the black tie |
| 19 | Hanoi | Long Biên bridge, the Turtle Tower, the shophouses | the train (THE PHO RUN alley); the pho scooter | scooter riders (baskets, helmets), the barber, the pho vendor | — |

The capybara's own row is every chapter: the eight-azimuth sheet once,
then in-costume per chapter where a costume exists (the wardrobe pass
shipped ten, and its own memory lists four ways a hat fails — those are
the first four reads to repeat).

### The uplifts this will most likely name (so the waves can be sized — written as guesses, to be replaced by the sheet)

- **The animal:** a belly band (a second, paler hex on the underside —
  one `c` multiplier in the existing geometry, the roster figure's
  hem/placket trick), an eye highlight fleck, toenails, whisker nubs;
  the ears already flatten and the face already has a mood. The single
  highest-value model in the game and the cheapest to lift.
- **Movers:** wheels that turn (the party bus, the red car, the
  scooters, the tractor-class props), a rotor that spins and a tail
  rotor (the helicopter), a wake (the ferry, the orange boat, the
  bangka — a trailing quad pair on the water's own material), wing
  primaries that fan (the condor, the frigatebird — five fingered tips
  as one extra `c`-banded fan each), a pennant on every hull.
  *Landed 19 Sep 2026 for the six whose files were free — see "The
  movers uplift" under "The sheet said" below: condor, ferry, party bus,
  helicopter, manta + bangka, orca pod. Batch 2, same day, see "The
  movers uplift, batch 2": the frigatebird (both the ridden bird's plume
  and the nine ambient fragatas), the red car (all four tourers), the
  pho scooter (the traffic stays instanced), the lampflies. The balloon
  is goreme.js's and still open.*
- **Heroes:** secondary forms where a hero is one box — window bands,
  a cornice, a base course, a roofline break — reusing the merger's
  `jitter` and the beauty pass's bay-and-course treatment (the Quay
  apron's eleven bays) rather than new geometry types.
- **NPCs:** the roster figure already has hem and placket; the sheet
  will say whether it needs a third band (a collar) and whether the
  hand-built locals each carry one asymmetric thing. Vehicle riders
  (Hanoi's scooters) get a head that turns toward the animal on the
  existing `npc` gaze channel.

### Waves

- **W0 — the sheet.** Before W1. `qa/wow-sheet.js`, ~160 raw frames,
  read by eye, findings table appended to this file under "The sheet
  said", one row per failing read. Two hours of looking; nothing built.

### The sheet said (19 Sep 2026, first pass)

`qa/wow-sheet.js` built and run: per chapter, the LIVE resting camera's
own raw render for the hero (a raycast along the camera's forward axis
finds the hero point with no per-chapter coordinate typed by hand — see
the script's `heroPoint()`), an orbit side and close shot off that
point, the marquee mover where this session found a live accessor for
one, the nearest instanced roster figure, the first `g.locals` entry,
and the animal in costume where a known task id unlocks one. 132 shots,
zero console errors.

**First trap, paid again:** the first run used a raw `Digit2..Digit9…`
key press to move between chapters after chapter one, copying the title
card's own picker keys. It produced eighteen chapters whose `heroPoint`
camera position read within a metre of Sydney's — the picker's digit
keys are wired to the title card alone (`biomeGo`, "a debug jump")
and do nothing once the game has started; `biome.switchTo()` (trap 36)
does not move the camera either. The fix, per `game.hud.cross(name)`'s
own comment ("the only honest arrival"): call that for every chapter
after the first. Re-run, all nineteen `camPos` values are distinct.

**Second finding, about the instrument itself, not the game:** the
raycast-based `heroPoint()` only works cleanly when nothing sits
directly on the camera's forward axis. In twelve chapters (Venice,
Kowloon, Palawan, Goreme, Manly, Pantanal, the cave, Antarctica, Monaco,
Hanoi and others) it read a `dist` under 3 m — it found the nearest
railing, sign or patch of ground, not the hero landmark the wide shot
actually shows. The raw arrival-camera render (unaffected by this) is
sound and is what the findings below are read from; the side/close
orbit shots this instrument produced for those chapters orbit the wrong
point and should not be trusted without a second look. Worth fixing
before this instrument is reused for a full six-read pass — not fixed
this round.

**Read from the nineteen raw arrival frames (hero structures only —
this is a first pass, not the full six-point rubric on all subjects;
side/close/roster/local/costume shots were captured but not yet
individually read):**

- **Sydney — a real camera problem, the P1 kind.** The fig crowns
  (`envCAM_FIG_R`) fill the frame edge to edge at the resting lens and
  the Opera House shells are not visible in the arrival frame AT ALL —
  fully occluded. This is the exact failure A2's own foreground rule
  exists to avoid ("never crosses the animal's screen-line") on the
  HERO rather than the animal; worth a look before Sydney's A2 fig
  bough is added on top of it.
- **Sahara/Marrakech — the ONE PERSON finding, seen, not just
  measured.** The souk crowd reads as plain pale cylinders with small
  cone heads at a glance, visibly lower detail than Sydney's roster in
  the same session's own screenshots. Confirms the player's report and
  this file's existing ONE PERSON section by eye, not just by the head-
  ratio number already cited there.
- **Antarctica already has a wow beat in its arrival frame.** The
  resting camera caught what reads as an active ice-calving event — a
  wall of ice mid-collapse, debris in the air. Whatever built this,
  Antarctica may need less new work under Part B than its row assumes;
  worth confirming this is a repeatable arrival state and not a one-off
  before scoping its beat.
- **Most chapters confirm A2's own premise** — the 0–4 m band in front
  of the animal is empty in the raw frame in the great majority of the
  nineteen. A few already read as having natural foreground by accident
  (Monaco's quay lamp and palm frond, Kowloon's signpost, Palawan's
  near-frame local) — worth checking those against A2's six-chapter W1
  list before adding a second object on top.
- **Goreme's arrival frame has a close red rail crossing the bottom of
  frame** near the animal, and the balloon envelopes read as smooth
  rounded blobs rather than the ribbed-panel silhouette the hero table
  expects — flag for a closer look when Part C's per-chapter uplift
  pass reaches it; not confirmed as a problem, just as a frame worth a
  second look.
- **Not yet done:** the six-point rubric (silhouette / secondary forms
  / two colours / a moving part / one asymmetry / the face) on any
  subject, the side/close hero orbits for the twelve chapters the
  raycast mis-aimed on, and a read of the roster/local/costume shots
  this run also captured. The next W0 session should start there rather
  than re-shooting what already exists in `qa/`.

**A second look at the roster/local shots (same run), the ONE PERSON
section confirmed by eye, not just by the head-ratio number:**
`WOW-sahara-roster.png` is featureless cone-headed cylinder pillars —
no face, no neck, no hair — starkly beside `WOW-sydney-roster.png`'s
proper face and banded garment in the same sheet. Rio's roster
(`WOW-rio-roster.png`) reads plainer too, though not as starkly as
Sahara's. The HAND-BUILT locals, by contrast, are consistently good
wherever this run sampled one — Venice's and Kyoto's
(`WOW-venice-local.png`, `WOW-kyoto-local.png`) both carry a real face,
a hat and a two-tone robe, no worse than the Sydney roster. The gap is
exactly where ONE PERSON already said it is: the two chapters that roll
their own crowd from nothing, not the hand-built locals and not the
shared roster elsewhere.
**The movers uplift (19 Sep 2026, Part C's "Movers" bullet, six
chapters; `qa/wow-movers.js`, one row per chapter, two raw own-camera
frames ~300 ms apart while the mover moves, read by eye, 0 console
errors in every row):**

- **Pasto, the condor** (`condor.js`): five fingers not four, each the
  wing black inboard and the body's warmer dark outboard — an honest
  band but a subtle one, because both hexes are near-black by the
  bird's own law; the ruff gets the beak's tan on its rim. The fan pivot
  now trails the beat (a damped copy of the dihedral, the difference is
  the flex). **Finding, and it was the real defect:** the un-mounted bird
  NEVER DREW A FLAP — `condorFlapT` was only ever set in mounted flight,
  while the AI's sustentation already pulsed on `sin(condorFlapPhase*2)`.
  A summoned condor climbed forty metres on rigid wings. `condorAiBeat`
  (0..1 from the seek's climb demand) blends the glide pose toward that
  same phase; measured, the fan moved against the shoulder in 50/60
  samples (was 3/60) with a 0.50 rad swing (was 0.13).
- **Quay, the ferry** (`quay.js`): she already had a wake ring, a
  rudder-driven wheel and a streaming ensign — the sheet's guess was
  already met. Added the masthead pennant (`hangThing('sock')`, house
  colours, streams aft with speed and leans with the rudder) and one
  asymmetry, a lifebuoy on the port bulwark aft.
- **Cali, the party bus** (`cali.js`): the wheels were baked into the
  body. Four separate meshes now, spun by the ROUTE-DISTANCE delta (not
  `v`, which is unsigned on the return leg where she backs down). A
  spare wheel on the starboard flank, amidships — the first cut put it
  at the rear axle and it read as a doubled wheel in the frame.
- **Kowloon, the helicopter** (`kowloon.js`): the main rotor already
  spun; the TAIL rotor was a disc baked into the hull. Its own mesh, spun
  about X at 52 rad/s × the spool. Skids were already the second colour;
  the pilot is the animal, so the head-turn row is moot.
- **Palawan** (`palawan.js`): the manta's only motion was a scale.y
  breath on the whole animal. The outer three segments a side are hinged
  tips now, curling on the body's own sine a quarter behind it, on both
  mantas. A shadow disc on the sand: the contact pool cannot be fed from a
  chapter (systems.js gathers capy/props/npcs only) and gates out a metre
  above the base, so it is a flat transparent circle placed on the seabed
  and faded with clearance. The bangka: the tiller and the boatman's arm
  on a pivot, a trailing foam-quad pair, one blue band on the port float.
- **Antarctica** (`antarctic.js`): the orange boat already had a wake, a
  rudder-driven tiller and a streaming flag — nothing honest to add, so
  nothing added. Each orca's flukes are on a hinge at the tail-stock,
  pitched a quarter ahead of the porpoise; each dorsal is on a hinge and
  leans against the roll, which is flat on a porpoising back and 0.7 rad
  over on the bull's breach. `podBreach(i)` added to the api for the
  harness.
- **Instrument traps paid this round:** `objShot` from a mover's OWN
  frame follows its roll — a breaching orca dragged the camera into its
  flank; frame from a world point off its quarter instead. A wake trails
  ~9 m astern, which is exactly where a "behind the boat" camera sits:
  the bangka's first pair had the wake out of shot. And a top-level
  `window.` in a run-code script is trap 17's family: it dies before
  the post and the OLD sheet is what you read.
- **`qa/rv-geom.js`'s baseline** is invalidated by all six commits; not
  re-baselined (the rule below).

**The movers uplift, batch 2 (19 Sep 2026, four chapters;
`qa/wow-movers2.js` on the same two-frame own-camera pattern, one
chapter per run, 0 console errors in every row):**

- **Rio, the frigatebird** (`rio.js`): the marquee bird is condor.js's
  model on Rio's plume, so d8e3052's five fingers and trailing fan were
  already on it — and INVISIBLE, because the finger band is `wing`
  inboard / `body` outboard and Rio's two blacks were five grey units
  apart (0x14161a / 0x1b1d22). `body` is 0x352a24 now, a frigatebird's
  brown alar bar: the band reads, and the torso reads against the wing
  from the passenger's own camera. The nine ambient fragatas (one
  InstancedMesh) get five baked two-tone fingers a wing, rooted along
  the chord — all five from one point overlapped back into a paddle on
  the first sheet — and the FORK is a moving part: its own instanced
  mesh hinged at the tail root, scissoring on a 1.1 rad/s cycle per bird
  (scale.x 0.55..1.05) and spreading and pitching up on the beat. **Two
  findings, both older than this pass:** the baked fork's blades
  CONVERGED aft (a +s yaw where a fork needs -s: a spike, not a fork),
  and the birds circled BROADSIDE — `rioUpdateBirds` added a quarter
  turn to the heading nobody needed, and at 40 m a W is symmetric enough
  that nobody saw it. Heading vs velocity is 0.17 rad now (was ~1.57),
  measured off the instance matrix over 300 ms; the bank was re-read
  dead astern after the first guess at its sign had the right wing up
  in a right-hand circle. The outer wing panel was also a 13 cm step
  under the inner one — invisible from above, a gap from the side.
  condor.js untouched: the ridden bird's tail stays the condor's fan,
  not a fork — that hook (a `plume.forkTail`) is a condor.js edit and
  not this agent's.
- **Monaco, the red car** (`monaco.js`): the wheels were baked into all
  four tourers. One mesh PER AXLE now (two draw calls a car, not four),
  hung off the group rather than the leaning body mesh so they stay on
  the road through the hairpin, spun by the lap-distance delta over the
  0.36 m radius (`monCarSpin`; the seam is a wrap, a jump over 20 m is a
  re-place), with a hub-coloured lug on each rim. Measured: 73.0 → 114.8
  rad in 300 ms at 31.8 m/s, which is 15.1 m / 0.36. A rear wing on two
  struts with end plates in the STRIPE colour (marble on the red car,
  gold on the blue). A helmet in the stripe colour with a dark visor and
  shoulders: the pack's drivers in the seat at x -0.36, the red car's
  on the passenger side, clear of the well the animal drives from.
  Instrument: at the start the pack is bunched, and the "starboard side"
  frame of the red car had the silver car between it and the lens.
- **Hanoi, the scooters** (`hanoi.js`): the Cub's two wheels out of the
  merge (tyre, chrome hub, lug), spun by `hanCubV * dt` over 0.30 m (v is
  signed, she backs up), and the FRONT one yaws with the bars (0.27 rad
  with A held, 'YXZ' so the steer sits outside the spin); a chrome fork
  and swingarm where they used to meet the body. The 240 traffic
  scooters stay six instanced merges — a wheel per instance is not
  wanted, and the rider-head-turn row is SKIPPED: their heads are baked
  into the merge and there is no per-rider head channel (npc.js's gaze
  is the capybara's, who IT looks at). Instrument: three seconds of W
  from the stall puts her into the shophouses; the first from-ahead
  frame was taken from inside a wall.
- **The Drift, the lampflies** (`drift.js`): awake, every fly held one
  brightness for ever, so twelve following read as twelve lamps on
  strings. Each blinks on its own rate and phase now — a 2.4–3.4 s cycle,
  lit for the top fifth, a flash not a fade; sampled at 100 ms on the
  instance colour: flat at 0.72 for 1.1 s, 1.47 at the peak, flat again
  — and the halo swells with it. A sleeping one keeps its breath, which
  is its blink. And a half-size head in the rock's dark on the body's
  +z, so a firefly is a dark insect with a lit abdomen (instanceColor
  multiplies both: dark gold awake, dark violet asleep). The x tumble is
  a nod, so the dark end stays an end. One sine more on a loop that
  already ran per fly; no new draw call. Instrument: the spawn is 17 m
  from fly 0 today and the wheek reaches 9.5 — the home's "three steps
  from where you wake up" comment is older than the spawn.
- **Budget, batch 2:** one draw call (the fork mesh) and nine matrices a
  frame in Rio; two meshes a car in Monaco (eight) and two on the Cub,
  each a rotation on an object that already moved; nothing new
  iterated in the Drift. **`qa/rv-geom.js`'s baseline** is invalidated
  by all four commits and by G5's two head conversions; not re-baselined.

- **W4 — the uplifts**, per chapter file, alongside Part B's beats and
  Part A′'s G5 — same files, same agent per chapter. The animal's own
  uplift is its own item in W4 (capybara.js, one agent, first).
- **`qa/rv-geom.js`'s baseline is invalidated by any geometry change**
  — re-baseline after W4, not before, and say so in the commit.

## Part D — the detail, aesthetics and depth pass on the weaker chapters (added 19 Sep 2026)

*Player: "add another detail, aesthetics and depth pass on some of the
weaker biomes visually — to execute and complete as part of this
refinement roadmap."*

Which chapters are the weaker ones is decided by the sheet, not by
taste: the nineteen raw arrival frames in W0 (`qa/WOW-*-hero-arrive.png`),
the corrected depth bins (`qa/l10-depth-sweep.json.png`) and the roster
shots. Six read thinnest, each for a nameable reason, and none of the
reasons is a grade, a sun or a fog row (LIFT10's audit stands — nothing
here re-bases a dial):

| # | chapter | what the sheet showed | what is thin |
|---|---|---|---|
| 8 | Sahara | a flat orange plane, six stalls, cone-headed pillars; the Koutoubia not in the arrival frame | detail: the square has no floor pattern, no rugs, no awnings' shadow; depth: nothing between the stalls and the horizon; the hero is behind the lens |
| 7 | Iceland | a row of one-hex boxes with square yellow windows on a dark street; the church behind the lens | detail: no window frames, sills, corrugated-iron ribs, doorsteps, drainpipes — the things Laugavegur's houses are made of; depth: the street ends in dark |
| 13 | Goreme | round envelope blobs, a rail across the bottom of frame, one lit stall | detail: the fairy chimneys read as blobs, the envelopes as spheres with no gores; depth: the field is two planes |
| 10 | Venice | a flat grey colonnade under a flat grey sky, statues on the parapet the one good detail | detail: the columns have no capitals or bases, the arcade no keystones, the flood-line no algae mark; depth: the Basilica is a box at 83 m |
| 16 | the cave | dark, green blobs, a beach of cones | detail: the wall is one value (measured in L7: 91 % of blocks sd < 2); depth: exempt on far by the audit, must show a lit far layer instead — the A1 river reflection carries that |
| 14 | Manly | a good frame, thin near the animal: the crossing, a bin, a wall | detail: the promenade wall is one slab; the pines are the chapter's best thing and are far; depth: the near plane is a crossing |

### What "a detail pass" builds, per chapter — the same three moves everywhere

1. **Secondary forms on the built things in the arrival frame** (Part
   C's own rubric, "a hero needs at least THREE sub-shapes that read at
   distance"): window frames and sills, a cornice or eave, a base
   course, a roofline break, a door with a step — merged into the
   chapter's own building merger (no new materials, no new draw calls:
   `jitter` and the bay-and-course treatment the Quay's apron already
   has), PALETTE colours already in that chapter's file.
2. **The ground given something to be** — a rug row and a paving
   pattern in the square (Sahara), a drain line and kerb (Iceland), a
   gravel apron round the launch field (Goreme), the algae mark at the
   flood line (Venice, via `grain()`'s `shore` — already written,
   Venice may already ask), a strand line of kelp and shells (Manly),
   the cave's wall given its rock term (`grain(..., { rock })` — L7
   wrote it for exactly this wall).
3. **A middle plane** where the depth bins say there is none: a second
   row of stalls and a caravan silhouette at 40 m (Sahara — the caravan
   accessor `g.sahara.caravan()` exists), a harbour crane and masts
   past the street's end (Iceland), the far chimneys as a ridge line
   (Goreme), the campanile of San Giorgio across the Bacino (Venice —
   one silhouette, 140 m, the chapter's own comment names it), the
   shaft's lit column visible from the passage (the cave — A1's row),
   the point's headland with the Norfolk row on it (Manly).

### Rules, and how it is measured

- Additive only: no chapter loses a thing it has; no grade, sun, fog,
  mote or spawn row moves (LIFT10). Budget: ≤ +6 k triangles and ≤ +1
  draw call per chapter, stated in the commit.
- Measured three ways, before and after, per chapter: the corrected
  depth bins (`qa/l10-depth-sweep.js` — mid+far share must RISE),
  the arrival frame re-shot (`qa/wow-sheet.js`'s hero-arrive frame)
  and read by eye against the W0 original, and `npm test` green.
  The rubric's silhouette and secondary-forms reads on the hero
  structure go from fail to pass or the chapter is not done.
- One agent per chapter file, disjoint from the wave running beside it;
  lands in **W4** alongside Part C's uplifts, closes in W5 with the
  rest.

### Findings — Sahara, Manly, the cave (19 Sep 2026)

Three chapters, three commits, one probe (`qa/partd-probe.js`: title-card
arrival, `l10-depth-sweep`'s bins, the own-camera raw frame, and the
chapter's merged triangle count; baselines by `git stash push -- <file>`
with close/open between). Two things about the instrument first:

- **The resting lens is not deterministic.** Manly settled at two yaws
  0.3 rad apart on consecutive arrivals (dir z −0.20 and −0.51); the cave
  the same. So the probe also measures a PINNED pose — one run's own live
  camera, rebuilt with the live fov — and that is the before/after. Draw
  calls counted on the live lens vary with the settled yaw (Manly 149–153
  before, 132 after; cave 126–147) and are only comparable pinned.
- **The crowd and the jungle are `rand()`-placed per build**, so the bins
  carry a noise floor of a few rays out of 117 (Sahara's two baseline
  runs read mid+far 0.265 and 0.179; the cave's 0.196–0.247).

| chapter | built (all in the chapter's own merger, no new material) | Δ merged tris | Δ draw calls | mid+far before → after | skipped, and why |
|---|---|---|---|---|---|
| Sahara (`6b3abfa`) | a rug and a crate stack at every stall; a 4 m paving grid on the square; a second row of six stalls at z 30; six camels couched at a post at ~39 m (`sahCamelGeo`, `addPainted`); seven riads along z 48 with parapets, terrace stair heads, windows under cedar lintels, a door, a step | +4 696 | 0 (197) | 0.265/0.179 → 0.299 (mid 0.137 → 0.239, sky 0.316 → 0.265) | nothing; the riads were added after the first cut (stalls + camels only) moved the bins the wrong way — at an eye height of 3.9 m nothing under 3 m takes a ray off the sky at 40 m |
| Manly (`e6d2833`) | the seawall's coping course (collider grown to match), a pilaster per 8 m bay, sand drifts at its foot; three step flights through it at 22/44/66 m; the corner pub (three storeys, two verandahs on posts, pediment); five Norfolks climbing the western headland and a scrub band | +2 232 | 0 pinned (meshes 22 → 22) | pinned 0.256 → 0.307; live 0.282 → 0.342 | the rail: the wall top is the route to the sand, a rail blocks it or is walk-through; the strand line: the wrack line exists and was tuned down twice on purpose |
| the cave (see commit) | a rockfall of 34 tipped blocks on both banks of the entrance slope (z 36–49), mossed where the light reaches, short colliders; a curtain of 30 stalactites under the arch in three rows | +2 100 | 0 pinned (147) | pinned 0.205 → 0.188 (−2 rays, inside the noise) | the rock term: `cavVC` already asks `rock: 0.08` (L7) and it is not re-based; `course` at a 0.55 m period on a 60 m cliff would shimmer (A3). **With 0 % sky the cave's mid+far cannot rise by construction** — a near hit is never pushed farther by adding geometry — so the cave is measured by eye only, as its table row already says |

Frames read against W0: `qa/WOW-D-sahara-hero-arrive.png`,
`qa/WOW-D-manly-hero-arrive.png`, `qa/WOW-D-cave-hero-arrive.png` (the
last two from the pinned pose). Sahara's stall ring now carries six
sub-shapes and the riad parapets break the skyline; Manly's wall reads as
a seawall and the pub closes the street; the cave mouth has a toothed lip
and a floor of blocks under it. 0 console errors in every run; `npm test`
green each commit; no grade, sun, fog, mote or spawn row touched.

### Findings — Iceland, Goreme, Venice (19 Sep 2026)

Same probe, copied to `qa/partd-probe-b.js` (adds an instanced-mesh count
under the root) with `qa/partd-look.js` for pinned looks at named places and
`qa/partd-flood.js` for Venice's tide. Three more things about the instrument:

- **A local in the lens.** Two pinned runs (Iceland's before, Iceland's first
  after) read near 0.69 against 0.48 for every other run at the same pose: an
  NPC had wandered to within a metre of the pinned camera
  (`qa/WOW-D-iceland-after-pinned.png`, a red slab over a third of the
  frame). The crowd is a scene child with no name, so it cannot be filtered;
  a pinned reading with near 0.2 above its neighbours is re-run, not recorded.
- **Draw calls are not comparable across minutes** while other agents hold
  uncommitted `main.js`/`systems.js` edits (Goreme's live count read 280, 294
  and 286 across three runs with one instanced mesh added). The honest
  budget number is meshes + instanced meshes under the chapter root.
- **The brief's far plane is not always in the arrival frame.** Both W0 and
  every arrival here look NORTH in Iceland (the harbour is south) and WNW in
  Venice (San Giorgio is south-east). What is built where the brief said
  stands where the player goes next; what is built where the lens looks is
  the geography that is actually there (Venice's Dogana, Göreme's west rim).

| chapter | built (in the chapter's own mergers, no new material) | Δ merged tris | Δ meshes | mid+far before → after (pinned) | skipped, and why |
|---|---|---|---|---|---|
| Iceland (`3ff45bb`) | corrugated ribs on all four faces of every house (standing quads, 2 tris, wall colour × 0.80); frame quad + sill on every street-facing pane; a door with frame and step; the downpipe's shoe; gully grates every 12.5 m in the gutter; rig on the three boats (crosstree, radar, boom, forestay); a 22 m quay crane between the pier and shed five (`qa/WOW-D-iceland-quay.png`) | +5 106 | 0 (60) | 0.222 → 0.411 on paper; honestly unchanged — the live reading at the same pose before any edit was 0.410, the 0.222 was a local in the lens | the brief's middle plane cannot reach the arrival frame: the harbour is behind every northward arrival lens; the frame's far field is the lava NE of the back row |
| Goreme (`e183de2`) | the 26-envelope fleet split BY FACE into its two fabrics (`gorEnvelopeSplit`: odd gores + crown take the instance colour, even gores are gorEnvC — the pair every balloon here uses); one more InstancedMesh, same matrices, dawn line and burner; a west ridge at x −98 with 22 capped spires (`qa/WOW-D-goreme-westridge.png`); a gravel apron and tether stakes round the field | +3 924 | +1 instanced (151) | far 0.085 → 0.103 in both after runs (the ridge); mid+far 0.282 → 0.308 / 0.274 — the 20 m line is where the crowd walks, ±7 rays between identical runs | caps on the valley chimneys (they have them; a sphere is a blob at 80 m); a burner frame on the fleet's baskets (a second instanced mesh, over budget) |
| Venice (see commit) | base moulding, necking and abacus in venStoneDark on every arcade pier, a keystone 6 cm proud on every arch; `shoreTint 0.45 / venCanalPale / shoreDeep 0.9` added to the paving's grain call (tide-gated by construction, `qa/WOW-D-venice-flood.png`); San Giorgio given Palladio's portico, entablature, door, belfry openings and finial; the Dogana on the point at x −74..−52, z 25.5 with tower, Atlases and the globe (solid to the bed); the Giardini Reali — six trees and a railing on the Molo's west end | +2 340 | 0 (29) | 0.393 → 0.376: far 0.085 → 0.051 and mid 0.308 → 0.325 — the gardens at 45 m now stand in front of water at 70 m, which is a middle plane doing what one does; sky unchanged | nothing; San Giorgio is behind the arrival lens, so the in-frame silhouette is the Dogana, which is what the Molo actually looks across at |

Frames read against W0: `qa/WOW-D-iceland-hero-arrive.png` (ribs, white
frames and sills round every pane, a door and step per house — the boxes with
cut-outs are houses now), `qa/WOW-D-goreme-hero-arrive.png` (green/cream,
orange/cream, purple/cream gores on every envelope in frame),
`qa/WOW-D-venice-hero-arrive.png` (dark keystones and capital lines down the
whole arcade, the gardens mid-left, the Dogana's globe across the water). 0
console errors in every run; `npm test` 25/25 each commit; no grade, sun,
fog, mote or spawn row touched.

## Order and ownership

Six waves. W0 is a review (Part C's sheet) and builds nothing; A1 is the biggest and the riskiest, so it does not go first.

- **W0 — the model sheet** (Part C). ~160 raw own-camera frames across
  all nineteen chapters, read by eye, findings appended to Part C. Sizes
  W4.

- **W1 — A3 + A2 (safe, measurable, six chapters).** Still pixels
  everywhere; foreground in Sydney, Kyoto, Cali, Kowloon, Hanoi, Manly.
  Ships the two instruments (`wow-still`, `wow-fore`) and records every
  chapter's shimmer floor before anything else moves. One agent for A3
  (shared.js `grain()` + weather.js), one for A2 (per-chapter files;
  disjoint from A3).
- **W2 — A1 in the four flagships.** Kyoto, the Pantanal, Hanoi, Monaco.
  The pass, the material option, the layer mask, the governor parking,
  the swim cut, `wow-reflect`. One agent, because it is one system;
  landed before any other chapter opts in.
- **W3 — A1 everywhere else it belongs + A4.** Venice (tide-gated),
  Quay, Cali, Rio's wet band, the cave, Antarctica, Iceland, Kowloon's
  blurred street. Rays in the five named chapters and Iceland's spill.
  Two agents: A1 rollout (chapter files), A4 (main.js post chain +
  sysLENS).
- **W4 — A5 + the remaining Part-B beats** that ride on nothing (Palawan's
  caustics, Pasto's bunting shadow, Goreme's envelope glow, Manly's foam,
  Antarctica's ice). Parallel by chapter file.
- **W5 — the closeout.** The corrected depth sweep, the still-pixel
  sweep, the reflection sweep, the rAF A/B on a quiet machine, nineteen
  arrival screenshots read by eye against the five numbers at the top,
  CONTRACT.md's entry, this file's Closed section.

## Rules for every agent

- **Never re-base a grade, a sun, a fog or a mote row.** LIFT10's audit
  is the reason; each is a shipped, commented number. A term that only
  works if the grade moves is the wrong term.
- **Pretty tier only.** Every new term parks at rung 1, and parking means
  allocated-but-skipped, never freed (the recompile rule).
- **Every term cuts** (`game.state.noX`) and earns its keep on a
  per-pixel diff inside a mask, never a frame mean
  (`capy3-the-leaf`, `capy3-the-second-beauty-pass`, twice each).
- **Before/after is a `git stash push -- <files>` differential** with
  close-all/open between; a same-session goto is not one
  (`headless-qa-harness` trap 44).
- **Foreground never crosses the animal's screen-line**, ever, and is
  placed to the spawn bearing, not to the current camera.
- **Frame time on a quiet machine only**, ten interleaved reps; the tell
  of contamination is the OFF arm moving from its own historic 16.7.
- **A reflection reads the existing shadow map, draws the animal, skips
  the motes.** Any agent who finds a chapter where that is wrong writes
  it down before changing the mask.
- Stage by name; never `git add -A`; no `close-all` while another agent
  holds a session; `PORT=5188`.

## Held (named, not built)

Screen-space reflections (SSR) for non-planar surfaces; temporal
anti-aliasing (a history buffer fights the art style's hard edges and
the fixed-camera interpolation contract); a second ambient-occlusion
term beyond the crease; anything texture-shaped; a cloud layer for the
thirteen chapters that show no sky; the composite's blur-tap reduction
(still no lever); smooth normals on anything built (G5 is for what breathes); any change to Sơn Đoòng's darkness, Kyoto's lane
width, Monaco's still air or Goreme's still air — the audit's list of
things that are the chapter, not a gap in it.
