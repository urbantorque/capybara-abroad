# BRIEF — lift the five underinvested chapters

Paste this whole file as the prompt. Measured 23 Aug 2026 against the shipped
build; every number below came out of the engine, not out of a guess.

---

Do a deep pass over **the Drift (9), Iceland (7), Circular Quay (3), Göreme (13)
and the Sahara (8)** — the five least-developed chapters in the game by a
measured asset census. Work through them **one at a time, finishing each before
starting the next**, and if the session runs short, stop cleanly at a chapter
boundary rather than leaving two half-done. The Drift and Iceland are the two
worst and should go first.

For each chapter deliver, in this order:

1. **Density and detail** — hit the triangle and object targets in the table
   below. This is the headline ask.
2. **NPCs and environment characters** — visually at least as good as Sydney,
   Pasto and Circular Quay, with dialogue and behaviour that create delight.
3. **Marquee and mini-wow moments** — improve what is there and add what is
   missing.
4. **Soundtrack and audio juice** — thoughtful, tasteful, positional.
5. **A bug sweep** — at least 4 real bugs per chapter, more if you find them.

## The measured baseline and the targets

Denominator is **actual land area** (4 m grid, terrain above the waterline), not
the bounding box — Sahara has 94,128 m² of walkable ground and Sydney has
14,608, so equal triangle counts mean nothing. The Drift is flown, so it uses
its footprint.

| Chapter | Land m² | Tris now → target | Draw objs | Instances | Geoms | People | Props |
|---|---:|---|---|---|---|---|---|
| **Drift** (9) | 52,800† | 83,136 → **205k (+147%)** | 125 → 211 (+69%) | 1,519 → 2,431 (+60%) | 98 → 141 (+44%) | **2 → 8 (+300%)** | 9 ok |
| **Iceland** (7) | 81,952 | 121,638 → **205k (+69%)** | 147 → 328 (+123%) | **576 → 3,773 (+555%)** | 126 → 141 (+12%) | 6 → 8 (+33%) | 10 ok |
| **Quay** (3) | 80,304 | 83,273 → **205k (+146%)** | 232 → 321 (+38%) | 3,124 → 3,697 (+18%) | 178 ok | 10 ok | **6 → 10 (+67%)** |
| **Göreme** (13) | 39,168 | 115,338 → **205k (+78%)** | 150 → 220 (+47%) | **588 → 1,803 (+207%)** | 129 → 141 (+9%) | 7 → 10 (+43%) | 11 ok |
| **Sahara** (8) | 94,128 | 122,596 → **205k (+67%)** | 192 → 376 (+96%) | 7,848 ok — **diversify** | 168 ok | 10 ok | 11 ok |
| *17-chapter median* | | 2,881 tris/1k m² | 4.00 /1k m² | 46.0 /1k m² | 141 | 8 | 10 |
| *Kowloon, the best* | 16,704 | 151,674 (9,080/1k) | 14.85 /1k | 112.3 /1k | 183 | 10 | 11 |

† footprint, not land — only 10% of the Drift is ground.

**205,000 triangles is the proven-safe ceiling**: Pantanal runs 213,208 at
16.7 ms median / 19.2 p95, one draw call, on this machine. Do not exceed it.
Anything above is unmeasured.

## The specific diagnosis for each

- **Iceland** — the clearest single failure in the game: **7 instances per
  1,000 m² against a median of 46**, the lowest scatter density by a factor of
  six, over 82,000 m² of ground the player walks the whole of. 576 instances
  total; Sahara has 7,848. This is the same shape as the Antarctic failure
  fixed in the last pass — one big landform with nothing on it. Fix the scatter
  and it stops being last.
- **Göreme** — the same disease at 588 instances, in a valley of fairy chimneys
  that ought to be the easiest world in the project to scatter (tufa blocks,
  scree, vines, dovecote holes, pigeon lofts, vine terraces).
- **The Drift** — **2 locals**, a third of the next-loneliest chapter and a
  sixteenth of Sydney. The only place in the game where that reads as an
  oversight rather than a decision. Also the fewest unique geometries (98).
- **Circular Quay** — **6 grabbable props over 80,000 m²**, the lowest absolute
  count in the game. Its low triangle density is largely honest (it is a
  harbour), so put the investment on the **foreshore**, not on the water.
  Geometry count (178) and people (10) are already above median — leave them.
- **Sahara** — the odd one out: second-highest instance count in the game but
  second-lowest triangle density and 24th-percentile object density. It is a
  lot of *one thing* repeated over the biggest land area in the project. It
  does not need more scatter, it needs **variety** (+96% draw objects), which
  is a different job.

## Hard constraints

- **CONTRACT.md is law.** Read it first. Low-poly, `MeshLambertMaterial` with
  `flatShading` via `mat()` only, colours from `PALETTE` in shared.js, no
  textures, no external assets, one module per file, every top-level name
  prefixed with the module tag.
- **Do not add new tasks.** Chapter registration is fourteen places (see
  `capy3-progression-chain`) and `qa/audit-tasks.mjs` only catches five of them.
  A moment does not need a line on a card to be a moment — the gate in
  chapter 17 has no task and works.
- **Do not change any published biome API** (`terrainHeight`, `isOverWater`,
  `climbHold`, `carryFrame`, landmark getters …) without checking every reader
  in systems.js and capybara.js first.
- **Budget the shadow pass, not just the triangles.** Iceland flags 84% of its
  geometry `castShadow`, Göreme 82%, the Quay 65%, Sahara 91%, the Drift 72% —
  and a casting triangle is drawn twice. Split ground-hugging decals, water,
  distant scenery and anything below the lens into a second merged mesh with
  `castShadow = false`, the way antarctic.js's glacier does (it sits at 43%).
  Do this **before** adding density and the uplift is close to free.

## Traps that have cost time before — read these

1. **A flat plate photographs as a sheet of paper.** The camera looks down at
   about 40°, so anything held within a quarter of a radian of horizontal shows
   its whole top face. It has bitten Manly's rock pools, the Pantanal's lily
   rims, the cave's moss discs, the Antarctic sastrugi and the jungle's palm
   fronds. Pitch leaves to ~0.6 rad; make drifts and cushions squashed spheres,
   never stacked boxes; keep surface marks under ~10 cm of relief.
2. **A feature narrower than the grid cell it is drawn in does not exist.** The
   glacier's crevasse term was `pow(sin, 8)` on a 4 m mesh. Draw such things as
   geometry laid on the surface instead.
3. **Watch the albedo ceiling.** Measure a vertex colour and then look at the
   render before trusting a palette number. In Antarctica anything over ~0.25
   of albedo saturates to white; that is why the guano stain and the black
   beach were both invisible. Iceland and the Sahara have the same very bright
   ambient-plus-hemisphere setup — check before you paint.
4. **A bare `BoxGeometry` in a `vertexColors: true` material renders BLACK.**
   Three feeds the shader a missing attribute. Use a plain `mat()` and
   `instanceColor`, or give the geometry a colour attribute.
5. **`mat()` returns a SHARED cached material.** Clone before writing anything
   on it per frame. Same for `grain()`.
6. **Check `castShadow`/`vertexColors`/`fog` on every new mesh** — a
   `fog: false` horizon plate is visible through a mountain from 270 m.
7. **A collision or friction penalty must be a RATE** (`speed *= 1 -
   clamp(rate*dt, 0, cap)`), never a per-frame constant.
8. **Every kinematic carrier**: never asleep, moved by velocity, differenced
   against the PREVIOUS TARGET — except on the frame it wraps, where you zero
   the velocity, write both targets and `continue`.
9. **Scatter recycling must respect the player's furniture.** A wrapped
   Antarctic floe could be dropped on the moored tender and on the jetty.
10. **Sample inside the places there is land**, not over the bounding box, or
    95% of your scatter lands in the sea.
11. **A mosaic field needs a period shorter than the frame**, and a linear
    `clamp` ramp has a visible corner — use `smoothstep`.

## Verification protocol — do not report done without it

The Browser pane cannot composite in an unattended run. Use the headless
harness (`headless-qa-harness` in memory):

```bash
PORT=5188 node server.mjs
```

then `playwright-cli -s=capy open http://localhost:5188/` and `run-code` with a
bare `async page => { … }`. Get data out by POSTing base64 JSON to
`/shot?name=x.json` and reading `qa/x.json.png`.

- **The wheek is `KeyQ`, not Space.** Space is hop. Two probes and half an hour
  went on this. To test anything downstream of the voice, emit
  `game.events.emit('capy:wheek', {position: game.capy.position})` directly.
- Judge every change **from a screenshot taken with the real follow rig at the
  place the moment happens**, not from a hand-placed camera. Check the camera is
  not inside the terrain or a tree first — a grazing camera produces artefacts
  that look like geometry bugs.
- Re-run and report: `qa/fuzz.js` (NaN, void falls, console errors,
  `lastError`), `qa/kine.js` (kinematic teleports, bodies out of world),
  `qa/audit-solid.js` (walk-through geometry), `qa/pointers.js`,
  `node qa/audit-tasks.mjs`, and `qa/audit-locals.js`.
- Re-run the census (`qa/cb-census2.js`), the area probe (`qa/cg-area.js`) and
  the frame-time probe (`qa/cc-perf17.js`) and give me the before/after table.
  **Frame time must stay in the 16.3–16.7 ms median / ≤20 ms p95 band** that all
  seventeen chapters currently hold.
- `playwright-cli close-all` at the end.

Write what you learn to memory when you are done, in the style of the existing
`capy3-*-pass-*` files: what measured wrong before it measured right, and why.
