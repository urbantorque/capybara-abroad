# The beauty pass: five no-regret decisions for the picture

Written 10 Sep 2026 as an art-direction review of the rendered game and a
production hand-off. It sits beside `ROADMAP-CHARACTER.md` (the cast) and the
v45–v50 sections of `CONTRACT.md` (the depth, the leaf, exposure, the airlight,
the penumbra, the blossom), and it does not repeat them: those passes built the
lens. This one is about what the lens is pointed at — the light, the ground,
the water — in the nineteen frames the player actually spends time in.

Every item keeps the contract's aesthetic law (flat Lambert, no textures,
palette only, no outlines), adds no draw call, and can be reverted by one
commit. Every strength below is a starting value to be swept against the
frame, not authored — three passes in a row found the first guess wrong by
4–20x (see `capy3-the-airlight` in the memory notes).

Method: nineteen fresh arrival frames at 1600x900 under `playwright-cli` on the
dev server (`qa/BY-01-sydney.png` … `qa/BY-19-hanoi.png`, ten-second settle so
the atmosphere has arrived), nine 1:1 crops of the near ground
(`qa/BYC-*.png`), and three instruments run over all nineteen chapters:

- `by-light.js` — the live sun, hemisphere, fill and ambient per chapter
  (`qa/by-light.json.png`);
- `by-cast.js` — what fraction of each chapter's visible geometry casts a
  shadow, and which emissive things sit within 30 m of the spawn
  (`qa/by-cast.json.png`);
- the frames themselves, read one at a time.

The probes live in this session's scratchpad; their outputs are in `qa/`.

---

## The measured state

| chapter | sun elev. | sun I | hemi I | casters (of visible meshes) | what the frame says |
|---|---|---|---|---|---|
| sydney | 41.4° | 2.12 | 1.33 | 129 / 166 | a 160 m lawn that is one green with grain on it; no shadow moves |
| pasto | 61.1° | 2.07 | 1.35 | 86 / 110 | noon: benches, llamas and the fountain sit on their contact patch and nothing else |
| quay | 41.4° | 2.17 | 1.33 | 252 / 307 | a third of the frame is one cyan; the pale paving reads as crumpled paper up close |
| kyoto | 41.4° | 2.14 | 1.32 | 278 / 303 | works — the mid-grey lane takes the near octave well |
| cali | 41.4° | 2.11 | 1.33 | 223 / 250 | fine; the lawn is the Sydney lawn again |
| rio | 41.4° | 2.14 | 1.33 | 184 / 199 | the Atlantic is a flat blue with a hard line at the sky; the wave pavement staircases |
| iceland | 61.1° | 1.32 | 1.16 | 213 / 297 | windows light the walls; two street lamps light nothing on the road |
| sahara | 61.1° | 2.71 | 1.32 | 254 / 382 | a souk at noon with no shade under any stall |
| drift | 61.1° | 1.06 | 1.38 | 184 / 253 | works — the chapter is its own thing |
| venice | 41.4° | 1.85 | 1.52 | 199 / 218 | the Piazzetta's near stone is the worst-looking ground in the game at 1:1 |
| kowloon | 61.1° | 0.94 | 1.25 | 268 / 296 | the standard for a night chapter; the reflection pucks are the only flat thing |
| palawan | 61.1° | 2.47 | 1.46 | 168 / 220 | the lagoon is one teal; the sand has no shadow on it |
| goreme | 40.0° | 1.39 | 1.39 | 264 / 389 | **the standard for the whole game** — lamps, cobbles, warm air, long shade |
| manly | 41.4° | 2.36 | 1.40 | 200 / 217 | fine; the sea is a band |
| pantanal | 41.4° | 2.21 | 1.34 | 177 / 196 | the tufts prove what a lawn with something on it looks like; the light is a 41° afternoon in a chapter subtitled "an hour before sundown" |
| cave | 41.4° | 2.23 | 1.43 | 187 / 218 | fine; the mouth's lawn shows its facets |
| antarctic | 61.1° | 2.34 | 1.64 | 162 / 197 | a polar station lit like the equator: flat grey snow, a flat teal sea, no shadow anywhere |
| monaco | 61.1° | 1.02 | 1.14 | 177 / 298 | the lamp is a bulb with a faint pool; the harbour does not reflect a single window |
| hanoi | 41.4° | 1.55 | 1.53 | 337 / 364 | fine; the lake is a flat green sheet |

Two facts fall straight out of the table and neither is visible from a
single frame:

1. **Eight chapters are lit by one star.** `sysSUN_BY_BIOME` hands Pasto's
   61° near-noon equatorial sun to Iceland, the Erg, the Drift, Mong Kok,
   Palawan, Antarctica and Monte Carlo. The table's own comment says it
   "changes nothing today" and that giving a chapter its own sun "is an art
   decision that wants the frame in front of you". The frames are in front
   of us now. At 61° a 1.7 m person throws 0.9 m of shadow, which the
   contact patch already covers; so in four daylight chapters the sun does
   no visible work at all.
2. **Shadows are wired.** 43–96% of the visible geometry casts in every
   chapter. There is no missing `castShadow` to find; the flat frames are a
   sun-angle problem, not a wiring one.

---

## The five decisions

### 1. The star, per chapter — long shadows where the hour says so

Three chapters get the sun their subtitle already describes. The azimuth is
kept (every chapter's shadows already run the way its layout was built for);
only the elevation changes.

| chapter | now | proposed | why |
|---|---|---|---|
| antarctic | 61.1° | ~28° | midday on the Peninsula in January is a 30° sun; long blue shadows across snow are the whole reason the place looks the way it does |
| palawan | 61.1° | ~44° | a mid-afternoon beach; the palms should lay something on the sand |
| pantanal | 41.4° | ~30° | "an hour before sundown"; the gallery trees should reach across the campo |

Not changed, on purpose: Pasto (61° is a measured decision about the church
tower), the Erg (noon is the subject), Iceland (the sun at half past eleven
would sit at 2°, and the chapter is graded as night — that is a bigger art
call and is recorded below as open), Mong Kok, Monaco and the Drift (night;
the "sun" is a moon-ish key and its angle is not visible).

Mechanism: `sysSUN_BY_BIOME` already takes one vector per chapter. Add a
small helper that keeps a star's bearing and sets its elevation, and three
rows. The shadow box is per-chapter too (`sysBIO_SH_HALF`), and a 30° sun
throws a 12 m tree 21 m — Rio already runs a 44 m half-box for its
parasols, so the Pantanal takes 34. `sysSHADOW_SKY` for Antarctica is 1.0
("any extra darkening reads as a bruise"), which was true under a sun that
cast nothing; it is re-judged from the new frame.

Verification: the three arrival frames before and after; the light probe
asserting the elevation landed; a walk under the trees in the Pantanal to
check the box edge never shows.

### 2. Cloud shadows — the one thing that has never moved on the ground

Every daylight chapter's light is a still photograph. Nothing crosses the
lawn, the square or the beach; the only motion on the ground is the animal
and the people. A slow, soft, large cloud shadow drifting across the world
is the cheapest "alive" the picture can buy, and it is the thing every
frame here is missing that a screenshot cannot show.

Mechanism: a term in the rim's existing `<opaque_fragment>` block, which
already compiles into essentially every material in the game and already
carries the fragment's world position (`vRimW`). At that point
`reflectedLight.directDiffuse` is still in scope, so the term subtracts a
fraction of the DIRECT light only — in shade nothing changes, which is
what a cloud does. Two octaves of world-space value noise at a ~50 m
wavelength, drifted along the chapter's wind, shaped by a smoothstep so
coverage is patches rather than a wash. Water and the wet-only prop
material are not rimmed; they take the same term in `grain()` on the
diffuse, bound to the same uniform objects under different GLSL names
(the `uWetK`/`uGrainWet` rule).

Per-chapter one number (`sysCLOUD`), zero for the night chapters, the cave,
the Drift and overcast Kyoto (an overcast sky IS the light; there are no
cloud shadows under it). Damped on a chapter change like every other
atmosphere value. `game.state.noCloud` cuts it.

Cost: one coherent uniform branch and two noise samples on rimmed
fragments when on. Expected at or below the ±0.1 ms noise floor; measured
with the `post.render()` x 60 harness, interleaved, median of five.

### 3. The sea has a horizon — a Fresnel term on every water

Lambert has no view-dependent term, so the far half of every sea is the
same colour as the near half. Real water is dark under your feet and the
colour of the sky at the horizon, and that gradient is most of what makes
a flat plane read as a body of water. The sparkle bought the glitter; this
buys the sheet.

Mechanism: in `grain()`'s water block (`spark > 0`), a grazing-angle term
against the real view vector (`cameraPosition - vGrainW`, exactly as the
wet sheen does it) with the water's normal taken as +Y. It mixes the
diffuse toward a shared "sky at the horizon" uniform written once a frame
from `scene.background` — the same colour the dome's horizon and the fog
already use, so every event that moves the atmosphere moves the reflection
with it. On a transparent sea (Palawan at 0.45) it also raises the alpha
toward 1 at grazing angles, which is what a real lagoon does and hides the
seabed where it should be hidden.

Opt-in per call site (`fresnel: k`), following the house rule that no
existing picture changes until its owner opts in — 21 call sites, one
option each. Strength swept per chapter; the tell for too much is a sea
that goes milky under the animal.

### 4. Pale ground — the near octave gated on albedo

At 1:1 (`qa/BYC-venice.png`, `qa/BYC-quay.png`) the near octave on pale
stone reads as crumpled paper or dirty snow, while the same term on Kyoto's
mid-grey lane and Sydney's lawn reads as ground. The reason is perceptual:
a luminance wobble of ±0.17 on a mid-value surface is texture; the same
wobble on a near-white surface is stains. Venice runs `near: 0.68`, the
highest ground value in the game, on the whitest ground in the game.

Mechanism: a `nearPale` option on `grain()` — a gain on the near octave
that eases in as the fragment's own albedo (after vertex colour) goes
past ~0.55 luma. Default 1.0, an exact no-op. It is an option and not a
retune of `near` because of the chapters whose ground is ONE mesh with a
lawn and a pavement in it (Cali, Kyoto's verges): a single `near` number
cannot be right for both, and the gate can. Opted in on Venice, the Quay,
the Erg, Hanoi's pavement and Antarctica's snow, and measured as the
luma SD of the bottom third of the frame brought into the band the
mid-value chapters already sit in.

### 5. Lawn life — daisies and clover in the near band

Sydney's lawn is the first thing the player sees and it is sixty per cent
of the frame. The Pantanal's tufts (`qa/BY-15-pantanal.png`) show what
ground with something on it looks like against ground with grain on it,
and the difference is not subtle. Geometry across nineteen chapters is a
placement problem (where is the lawn, where is the path) that no
chapter-neutral system can answer without reading every ground builder.

What can be done everywhere for nothing: a `speck` option on `grain()` —
a sparse thresholded high-frequency field that paints small pale specks
(a daisy, a clover head, a fallen petal) into the lawn's diffuse, with the
near octave's own footprint fade so it dies before it can crawl. Zero
geometry, zero draw calls, opt-in per lawn material: Sydney, Cali, Manly,
Kyoto's verges, the cave mouth. Colour from the palette.

This is the lowest-confidence item of the five and the last to build; if
the specks read as noise rather than as flowers at playing distance, it is
reverted rather than tuned.

---

## Recorded, not built

- **Iceland's street lamps light nothing on the road.** The spill scan
  runs on the chapter root; the lamp heads may be under the emissive
  threshold or instanced with their posts. Measure with the live pool
  (`spillUniforms()` from shared.js) before touching anything: if the lamp
  is in the pool and the road is still dark, it is reach; if it is not,
  it is `sysSPL_LUM`.
- **Iceland's sun.** See item 1.
- **Rio's wave pavement staircases** at every stripe edge (`qa/BYC-rio.png`):
  the pattern is vertex colour on a 3.4 m grid and interpolates across it.
  A finer grid under the promenade only, or an analytic stripe in the
  fragment, are the two honest fixes; both are Rio's own work.
- **Monaco's harbour reflects no window.** A planar reflection is a second
  render of the chapter; a spill-fed streak field on the water (the wet
  road's anisotropic smear, on the sea) is the affordable version and
  belongs to the spill, not to this pass.
- **Mong Kok's reflection pucks** are painted ellipses under the signs; the
  spill's wet smear now does the same job on the road and the pucks could
  go.

---

## Order and gates

1 → 2 → 3 → 4 → 5, each its own commit, each verified against the same
nineteen frames and against `qa/fuzz.js` (19/19 clean), `npm test`, and
frame time in the affected chapters (16.x ms median at 1600x900, the same
before and after). Every term gets a `game.state.noX` switch that cuts
rather than fades, so the next pass can measure it away.
