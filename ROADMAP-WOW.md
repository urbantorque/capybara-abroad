# ROADMAP-WOW — the third beauty pass: reflections, the foreground, still pixels, and nineteen beats (19 Sep 2026)

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

## Order and ownership

Five waves. A1 is the biggest and the riskiest, so it does not go first.

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
(still no lever); any change to Sơn Đoòng's darkness, Kyoto's lane
width, Monaco's still air or Goreme's still air — the audit's list of
things that are the chapter, not a gap in it.
