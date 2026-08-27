# BATCH TWO — the light, the floor and the sun

**Est. 5–7 h. Three phases, a commit at each boundary.**

This is the gated batch. Phase 3 is the only change in the pass that can
plausibly cost frame time. Phase 5 re-grades every chapter and **must run last**.
Both want batch ONE settled underneath them — a floor with contact darkening on
it is a different floor to light and a different floor to grade.

**Do not run this before batch ONE.** If ONE was interrupted, finish it first.

Read the shared preamble in `../SKILL.md` — the aesthetic law, the eight harness
traps, and the five conditions that make a phase done.

---

# PHASE 3 — LIGHT THAT LANDS ON SOMETHING

**Est. ~2.5 h.** Dominated by designing the pool so it costs nothing, then
per-chapter placement in three files. Budget a real perf check.

## The finding

Live-visible light census, `qa/na-scan.js`, eight chapters:

    sydney 0   kyoto 0   iceland 0   venice 0
    kowloon 0  palawan 0  monaco 0   hanoi 0      (antarctic: 8)

`grep -n PointLight src/*.js` finds thirteen sites in total, all in `cave.js`,
`antarctic.js` and `pantanal.js`. **Hong Kong, Iceland and Monte Carlo have none
at all** — and those are the three chapters whose entire subject is artificial
light.

Every sign in Mong Kok is `emissive` only. It clears the bloom threshold and
glows, which is correct and is the grade doing its job — but it puts no light on
the street, the stalls, or the capybara standing three metres from it. **Hong
Kong's ground measures a mean luminance of 34.1/255** — it was 34.3 before the
polish pass, so the near octave bought that chapter nothing, because it is
modulating a diffuse that receives almost no light.

`qa/na-monaco.png` is the whole finding in one frame: a lamp burning white-hot
at the right of frame, and the pavement beneath it is the same value as pavement
fifteen metres away. Monte Carlo's own grade comment names "a hundred and forty
windows, a hundred lamps, six chandeliers" as the subject of the chapter.

The composite pass's opening comment says the problem it exists to solve is that
a light which does not spill is a sticker. **It fixed the lens. The lights still
do not spill onto the floor.**

## The budget is not the constraint

Measured, hand-driven tick averaged over 30 steps: **1.42 ms (Hanoi) to 2.01 ms
(Iceland)**. That is a great deal of headroom. It is not a licence to be
careless — it is the reason this is affordable at all.

## The work

### 1. A budgeted pool (`systems.js`)

Not one `PointLight` per sign — that is hundreds of lights and a shader
recompile storm. **Reuse the nearest-N ranking helper batch ONE built for
`sysContact`**; this is the same problem one field over.

- A hard cap, **constant for the life of the program** so three never recompiles
  materials mid-run. That is the classic hitch in this pattern. Start at 8 and
  measure before going to 12.
- Sources register a position, colour and strength; the pool assigns its lights
  to the nearest N to the camera each frame.
- Distance culling, and a **smooth fade in and out of the pool** so a light does
  not pop when the ranking changes. This is the part that will look like a bug
  if it is skipped.
- A light that leaves the pool must not leave a lit patch behind.

### 2. Wire in three chapters

- `kowloon.js` — **one light per major sign cluster, not per sign.** Warm or
  cold per the cluster's own dominant colour, taken from the sign's `emissive`
  so the two can never disagree. The street and the stalls are what should read.
- `iceland.js` — shopfronts, and streetlamps over wet asphalt at half past
  eleven at night.
- `monaco.js` — the casino windows, the lamps, the tunnel sodium, headlights.

## Acceptance

- **Mong Kok before and after, screenshotted and looked at.** The ground's mean
  luminance near a sign must rise measurably from **34.1/255**, and the capybara
  must be visibly lit by the sign it is standing beside. State both numbers.
- The same for Monte Carlo at blue hour and Reykjavík at midnight.
- **Frame time before and after, stated as a number.** This is the one phase in
  the pass that can plausibly cost performance; if it does, lower the cap rather
  than shipping it.
- **No pop as lights enter and leave the pool.** Walk the length of Mong Kok and
  watch for it specifically.
- The three chapters' `sysGRADES` rows still read correctly — more real light on
  the ground may push pixels over a bloom threshold set when there was none.
  Re-check, and adjust the grade rather than the lights if it bites. Note what
  you changed; phase 5 will re-visit every row anyway.

---

# PHASE 4 — A GRAPHIC ON THE FLOOR

**Est. ~2 h.** Four chapters, one idiom, already proven in the codebase.

## The finding

Ground band after the polish pass, bottom third / centre 60%:

| chapter | mean L | SD | colours |
|---|---|---|---|
| **Rio** | 137.4 | **56.25** | **175** |
| Venice | 187.8 | 10.61 | 51 |
| Sydney | 160.8 | 8.78 | 45 |
| Palawan | 226.1 | 7.72 | **19** |
| Cali | 140.6 | **6.11** | 85 |

Rio is **6 to 9 times** the bottom four for one reason and one reason only: it
is the only chapter with a graphic on the floor. `qa/na-rio.png` is the proof.

The polish pass's near octave took these floors from *one colour* to *one colour
with a texture on it*, and that was worth doing — Palawan nearly quadrupled and
Sydney more than doubled. It cannot take them to *a floor with something drawn
on it*. Nothing can except drawing something on it.

## The template, and it is already in the repo

`rioBuildCalcadao` (`rio.js:710`) is forty lines: banded vertex-coloured quad
strips at y = 0.02, z displaced by a sine of x, one `BufferGeometry`, one mesh,
one draw call, no textures, no decals, no `polygonOffset`. Follow it exactly.
Where the ground is a heightfield rather than a plane, sample the chapter's own
`terrainHeight` per vertex and sit the strip a fixed 2 cm above it.

## The four, and what goes on each

| chapter | what | why this one |
|---|---|---|
| **Cali** | the Plaza de Cayzedo's paving — bands and the tree wells | SD 6.11 is the lowest measured anywhere, and the audit before this one already flagged the plaza as bare with a single scatter site |
| **Palawan** | the wet-sand tideline, swash arcs, coral rubble drifts | 19 distinct colours across 226 mean luminance is the worst floor in the game; the tideline also gives the beach a readable edge it does not have |
| **Venice** | Istrian-stone banding across the Piazzetta | historically what is actually there, and Venice is a sheet of white paper without it |
| **Sydney** | worn desire paths across the lawn, and fallen jacaranda that is **not** a flat lilac blob | 45 colours — and the existing lilac decals in `na-sydney.png` are the worst-looking thing in that frame. Replacing them is part of this phase, not a separate one. |

Sydney's is the one with a deletion in it. Do it, and say in the report what the
old decals were replaced with.

## Acceptance

- **Ground-band SD and colour count before and after for all four**, from
  `na-scan.js` and `na-rio.js`. Target: every one of the four above **20 SD**.
  If a chapter cannot get there without the floor becoming louder than the
  chapter, say so and stop at what is right — the number serves the picture, not
  the other way round.
- **Screenshots of all four, looked at.** The test is whether the floor reads as
  a place rather than as a pattern. Rio passes that test; use it as the bar.
- **Draw calls before and after.** One new mesh per chapter, no more.
- **The graphic must not fight the contact darkening from phase 1** or the
  chapter's own shadows. Check Venice, where a pale stone band under a column's
  contact ring is where this will look wrong first.
- **Palawan's tideline must agree with the actual waterline.** It is a chapter
  with a moving sea and a `localWater` hook; a painted tideline in the wrong
  place is worse than none.

---

# PHASE 5 — THE SUN, AND THE LENS

**Est. ~2 h.** The shader edits are half an hour. The rest is **re-validating
twenty grade rows**, because a tone-map changes what `threshold: 1.02` means in
every one of them.

**Run this last.** It re-grades every chapter, so it wants the contact, the
sway, the lights and the floors settled underneath it.

## Three findings, in priority order

### 1. There is no sun in the sky

`sysBuildSky` (`systems.js:5225`) paints a 32x18 dome from a horizon colour and
a zenith colour on a `t^0.62` ramp. The construction is right — 1,100 vertices,
vertex colours, one draw call, `flatShading` off by deliberate exemption — and
**it should stay that way.** But there is no sun disc, no glow around the sun's
bearing, and no moon. In all nineteen chapters the sun is an inference from the
shadow direction rather than a thing in the picture. `qa/na-monaco.png`'s night
sky is flat navy and a dozen specks.

Add a disc and a horizon glow, positioned from the existing `sun` directional
light so they can never drift from the lighting, and a moon in the chapters that
are at night. **Keep it in the vertex colours** — the dome is one draw call and
that is not negotiable. A 32x18 dome gives about 5.6° of angular resolution,
which is too coarse for a sharp disc, so either raise the segment count locally
around the sun's bearing or accept a soft glow and no hard disc. Decide from
looking at it, and say which you did.

### 2. The composite clamps instead of rolling off

`renderer.toneMapping = THREE.NoToneMapping` (`main.js:864`), and
`MAIN_POST_COMP`'s first act is `clamp(c, 0.0, 1.0)` with no filmic curve. The
scene target is half-float, so over-white values do survive as far as the bright
pass — but the visible pixel under a bloom is a hard-edged flat white with a hue
shift toward whichever primary clipped last.

Measured honestly: **clipping is 0.00% in both the ground band and the sky band
in all eight sampled chapters.** This is not causing damage where the player is
looking. It is a roll-off and highlight-colour quality issue concentrated in
skies, water and emissives — and phase 3 has just added real lights, which is
the one thing that can change that. **Re-measure clip% after phase 3 before
deciding how hard to push this.**

Add an ACES-style filmic roll-off **before the sRGB encode** in
`MAIN_POST_COMP`. Then re-check every row of `sysGRADES`. The per-chapter
threshold reasoning is load-bearing and hard-won — read the Venice and
Antarctica comments before touching either. A chapter built out of white stone
cannot have a low threshold; that argument does not change, but the *number*
that expresses it does once values roll off instead of clipping.

### 3. The split tone does not exist

The composite's whole grade is `c = clamp(c * uTint + uLift, 0.0, 1.0)`
(`main.js:681`) — a single global multiply and a global add. And `sysGrade`
(`systems.js:1085`) hard-codes `liftR: 0, liftG: 0, liftB: 0` in its return, so
**no row can set a lift at all** and all twenty are zero by construction.
Monte Carlo's own comment states its intent as "warm
in the highlights and blue in the shadows" — a split tone. The shader has no
luminance-dependent term, so this cannot happen and does not.

Either implement a luminance-dependent split, or correct the comment. **Do not
leave a comment describing behaviour the code cannot produce.**

## Acceptance

- **Every one of the twenty `sysGRADES` rows visited** and either confirmed or
  re-tuned. Say which were changed and why.
- The two chapters the threshold reasoning was written for — **Venice** and
  **Antarctica** — screenshotted before and after. Neither may bloom into one
  sheet of paper; that is the failure this reasoning exists to prevent.
- **Kowloon**, the chapter the composite pass was built for, must not lose its
  neon. Screenshot before and after — and it now has phase 3's lights in it, so
  this is the highest-risk row in the table.
- The dither in `MAIN_POST_COMP` still does its job: check a sky gradient for
  banding after the tone-map, since the curve redistributes exactly the values
  the dither was hiding.
- **The sun disc must agree with the shadows.** Screenshot a chapter where both
  are visible and confirm the shadow direction points away from the disc. If it
  does not, the disc is being placed from something other than `sun`.
- Split tone: implemented and shown on Monte Carlo, **or** the comment
  corrected. State which you did.
- Clip% from `na-scan.js` before and after, eight chapters.

---

## At the end of batch TWO

Commit, then state:

1. The eight-chapter ground table and clip% table, before batch ONE and after
   batch TWO — the whole pass, end to end.
2. Frame time per chapter before and after, and the light-pool cap you settled
   on.
3. Which grade rows changed.
4. What was left undone, and at which phase boundary you stopped if you did.
5. That the aesthetic law still holds — no textures, no image files, no PBR, no
   hex outside `PALETTE`, `mat()` everywhere, one draw call for the sky dome.
