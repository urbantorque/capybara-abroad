# THE POLISH PASS — what would make this look and sound thirty per cent better

Analysis run 27 Aug 2026. Six chapters photographed under `playwright-cli` at
1440x860, eight chapters measured off the framebuffer, and the audio engine read
end to end. Every number below was measured, not estimated.

Probes left in `qa/`: `vis-shot.js` (screenshot a chapter), `vis-flat2.js`
(ground-variance table). Pictures: `qa/vis-*.png`.

---

## What is already good, so that no batch undoes it

Two things are further along than a reader of this document might assume, and
neither should be touched:

- **The score is genuinely researched per place.** Twenty-one palettes with real
  harmonic identity — son clave 2-3 written out in absolute eighths, samba's
  surdo on the two, a 12/8 gnawa cell, a descending-fifths baroque sequence, the
  yu mode for Hong Kong, hijaz for Cappadocia, dorian for Iceland. Seven bespoke
  ethnic voices are already synthesised: koto, shakuhachi, quena, guzheng, dan
  bau, dan tranh, and a tremolo twang. This is not the weak half of the audio.
- **The composite pass and the per-biome grade.** `sysGRADES` has a hand-tuned
  row per chapter, damped on a 2.2 lambda so it cross-fades at a border. The
  bloom threshold reasoning (high in Venice and Antarctica because they are
  built out of white things; lowest in Sơn Đoòng because only four things make
  light) is correct and hard-won.
- **Per-chapter convolver rooms** for both sfx and music. The acoustic space is
  already a per-place decision.
- **The capybara.** Squash-and-stretch spring, blink, pop, landing squash,
  confetti on a tick. Delight-on-action is covered.

The gaps are in **the picture on the floor**, **light that touches nothing**,
and **the sound of the place as opposed to the music of the place**.

---

## THE MEASUREMENT THAT DRIVES EVERYTHING

Bottom third of the frame, centre 60% — the ground the player is actually
looking at, clear of the to-do card and the minimap. 109k–142k pixels per
sample. `SD` is the standard deviation of luminance; `colours` is the count of
distinct 5-bit-per-channel buckets.

| chapter | mean L | **SD** | **distinct colours** |
|---|---|---|---|
| **Palawan** | 226.4 | **2.05** | **5** |
| **Sydney** | 161.3 | **3.98** | **27** |
| Venice | 188.4 | 9.06 | 68 |
| Monte Carlo | 109.3 | 12.53 | 78 |
| Hong Kong | 34.3 | 15.36 | 109 |
| Iceland | 51.6 | 15.96 | 46 |
| Kyoto | 122.2 | 23.12 | 84 |
| **Rio** | 134.8 | **51.06** | **122** |

**Palawan's ground is five colours across a hundred and forty-two thousand
pixels.** Sydney's is twenty-seven. These figures *include* props, NPCs and cast
shadows falling in the band, so the ground's own variance is lower still.

And Rio is twelve times Sydney and twenty-five times Palawan — because Rio is
the one chapter with a **graphic on the floor**: the Copacabana wave. Nothing
else about Rio's renderer is different. That is the entire proof of concept, and
it is already in the codebase.

### Why the ground is flat

`grain()` in `shared.js` is applied to every big surface, but at ground strength
it runs at `scale: 0.5–0.72` (a period of roughly 1.4–2 metres) and
`amount: 0.12–0.14` (a swing of about ±6%). Its two octaves are only 2.83x
apart, so the highest frequency in the field is still about half a metre. At the
camera's 48° FOV and ~35° overhead pitch, near-field ground fills the bottom of
the frame at a scale where a 1.5 m blob is invisible and a 6% swing is below the
dither floor. The helper is correct; it is simply tuned an octave and a half too
low to be seen.

It also has no distance fade on the grain (only on the sparkle, via `fwidth`),
which is *why* it cannot simply be turned up — a high-frequency term without a
footprint fade aliases into a boiling mess at range. That fade is the enabling
change.

---

## THE FIVE PRIORITIES

### P1 — The ground is 40–55% of every frame and it is one colour

Measured above. This is the single largest, cheapest, most global win and it
does not violate one line of the aesthetic law: no textures, no image files, no
PBR — a second octave in a shader that already exists, plus instanced geometry
of the kind the game already builds.

Three parts:
1. A **near-field octave** in `grain()` (~4–8x the current scale) with an
   `fwidth`-driven fade so it dies before it can alias, exactly the way
   `sparkle` already does.
2. **Ground scatter** in the chapters that have none. `pantanal.js` has 25
   scatter sites and `quay.js` has 16; `monaco.js` and `hanoi.js` have **zero**,
   `rio.js` and `cali.js` have **one each**.
3. **A graphic on the floor** in the two or three places that historically have
   one — Venice's Istrian-stone banding across the Piazzetta, Kyoto's gravel
   raking, Hong Kong's road markings and manhole rings. This is the Rio move,
   repeated.

### P2 — In three chapters, nothing that is switched on lights anything

`grep -n PointLight src/*.js` returns thirteen sites: seven in `cave.js`, two in
`antarctic.js`, one in `pantanal.js`. **Hong Kong, Iceland and Monte Carlo have
none at all.**

Every sign in Mong Kok is `emissive` only. It clears the bloom threshold and
glows — correctly, the grade is doing its job — but it puts no light on the
street, the stalls, or the capybara standing three metres from it. Measured:
Hong Kong's ground reads a mean luminance of **34/255** with a blazing sign
directly beside the animal.

The same is true of Monte Carlo, whose own grade comment describes "a hundred
and forty windows, a hundred lamps, six chandeliers" as the subject of the
chapter, and of Reykjavík's shopfronts at half past eleven at night.

The composite pass's opening comment says the problem it exists to fix is that
"a light that does not spill is a sticker". It fixed the *lens*. The lights
still do not spill onto the *floor*.

A small pool of cheap `PointLight`s — budgeted, culled by distance, one per
major sign cluster — is the other half of that argument.

### P3 — Nothing sits in the world; everything floats on it

Across all 28 modules there is no ambient occlusion, no contact shadow, and no
rim or fresnel term. (There is a grazing-angle sheen in `grain()`'s wet path,
but it is gated on `uGrainWet > 0.001` — it only exists when it is raining.)

The consequence is visible in every screenshot: columns meet the Piazzetta with
a hard seam and no darkening; the capybara is a flat brown silhouette against
flat green with nothing separating the two; props sit *on* the ground rather
than *in* it.

Two shader injections into the Lambert material, in the same `onBeforeCompile`
style `grain()` already establishes, buy most of what a much more expensive
renderer would:
- a **rim term** — a fresnel against the view vector, tinted by the hemisphere's
  sky colour, which is what separates a flat-shaded silhouette from its
  background and is the single strongest "polished low-poly" cue there is;
- a **contact darkening** ring under props and characters, driven off the
  existing shadow-blob position rather than a real AO pass.

### P4 — The soundtrack is researched; the *ambience* is thirteen generic tokens

This is the audio finding, and it is exactly the thing that reads as "each
soundtrack could use more cultural identity" — because the score already has it
and the ambience is what is missing.

The ambience ladder branches correctly per biome (`bio === 'kowloon'`,
`bio === 'goreme'`, and so on). But the vocabulary it draws from is thirteen
names, shared across all nineteen places, distinguished only by a pitch and a
volume:

    bark  cheer  chime  gull  hiss  horn  pop
    rustle  splash  strum  thud  tick  whistle

So Kyoto is `chime` at a pitch. Marrakech is `hiss` and `bark`. Rio is
`horn/cheer/rustle/pop`. Nineteen cultures, one bag of thirteen sounds with a
knob on it. The ambience is *positional and constant*; the player hears far more
of it than of any melodic figure, so this is where a place is most cheaply and
most convincingly established.

The structure is already right — this is purely a vocabulary problem, and new
generators drop into the existing per-biome branches with no architectural work.

### P5 — Three chapters play the wrong instrument

Seven bespoke ethnic voices exist. Three chapters have researched *harmony* and
borrowed *timbre*:

| chapter | harmony | plays it on | should be |
|---|---|---|---|
| **Cappadocia** | hijaz on D — correct | **`quena`**, the Andean flute from chapter 2 | a **ney** (breathier, almost no upper partials, the rim-blown attack) |
| **Palawan** | lydian — correct | **`mallet`**, Sydney's felt mallets | a **kulintang** gong row — the instrument of the southern Philippines |
| **The Pantanal** | major sevenths — correct | **`violin`**, Venice's baroque bowed voice | a **viola caipira**, a ten-string steel guitar — plucked, not bowed |

The source comments already concede two of these in writing ("'violin' is as
near as the synth gets to it"; Cappadocia's lift is documented as deliberately
reusing the condor's flute). `musQuena` is about thirty lines — an oscillator
pair, a fading-in vibrato LFO, and a band-passed noise breath. A new voice is
cheap; three of them is one sitting.

Sydney/Quay/Manly sharing mallets is **correct** and must not be changed — it is
one city and the score says so on purpose. The Drift, Sơn Đoòng and Antarctica
being placeless is also deliberate.

### Runner-up — the lens clamps instead of rolling off

`renderer.toneMapping = THREE.NoToneMapping`, and the composite shader's first
act is `clamp(c, 0.0, 1.0)` with no filmic curve. The scene target is half-float
so over-white values do survive as far as the bright pass, but the *visible*
pixel under a bloom is a hard-edged flat white with a hue shift toward whichever
primary clipped last.

Measured honestly: clipping in the ground band is **0% in all eight chapters**,
so this is not causing damage where the player is looking. It is a roll-off and
highlight-colour quality issue concentrated in skies, water and emissives —
worth doing, ranked below the four above.

Related and cheaper: the grade's `uTint` is a single global multiply and
`uLift` is **zero in every one of the twenty rows**. Monte Carlo's own comment
states its intent as "warm in the highlights and blue in the shadows" — a split
tone. The shader has no luminance-dependent term, so that cannot happen and does
not. Either implement the split or correct the comment.

---

## CHAPTER BY CHAPTER

| # | chapter | picture | sound |
|---|---|---|---|
| 1 | Sydney | ground **SD 3.98 / 27 colours** — near-solid lawn. Needs clover, worn dirt lines, fallen jacaranda. | mallets are right. Ambience is `gull/chime/splash`; wants cicadas, a magpie carol, lorikeets. |
| 2 | Pasto | thin scatter. | **band already correct** (bambuco/sanjuanito, 6/8, charango, bombo, quena). Leave. |
| 3 | Circular Quay | 16 scatter sites — one of the best. | mallets up a fourth + buoy bell. Correct. Wants a real ferry horn and gangway clank. |
| 4 | Kyoto & Uji | SD 23 — acceptable. Gravel raking would lift it. | **koto + shakuhachi correct**. Ambience is `chime` pitch-shifted: wants higurashi cicada, shishi-odoshi clack, a temple bell with a real long decay. |
| 5 | Cali | **1 scatter site.** Plaza is bare. | **salsa correct.** Leave. |
| 6 | Rio | **best in game, SD 51** — the wave pavement. Use as the template. | **samba correct.** Leave. |
| 7 | Iceland | **zero PointLights** on lit shopfronts at midnight. Wet asphalt has no reflection. | dorian + choir correct. Wants wind round a corner, a rope on a mast, gull-in-wind. |
| 8 | Marrakech | dune camp fine. | **gnawa correct.** Ambience `hiss`/`bark`: wants a distant muezzin, hand-drum from another square, cart wheels on stone. |
| 9 | The Drift | placeless by design. | quartal, placeless by design. Leave. |
| 10 | Venice | **SD 9.06** — the Piazzetta is a sheet of paper. Istrian-stone banding is the fix and it is historically real. | **baroque continuo correct.** Wants pigeons en masse, water slapping a fondamenta, a distant campanile. |
| 11 | Hong Kong | **worst light gap.** Zero PointLights; ground mean **34/255** beside a blazing sign. | **hk synth + guzheng correct.** Wants mahjong tiles, a wet-market cleaver, tram bell, aircon drip. |
| 12 | Palawan | **worst ground in the game — SD 2.05, 5 colours.** | **plays Sydney's felt mallets.** Wants a **kulintang**. Both worst-in-class; do this chapter first. |
| 13 | Cappadocia | fine. | **hijaz played on an Andean quena.** Wants a **ney** and a bendir frame drum. |
| 14 | Manly | fine. | mallets shared with Sydney — **correct on purpose.** Leave. |
| 15 | The Pantanal | 25 scatter sites — best in game. | **viola caipira played on a baroque violin.** Wants a plucked ten-string. |
| 16 | Sơn Đoòng | heavy uniform green fog washes all contrast out of the mouth; no light shafts in the chapter that is *about* a shaft of light. Has PointLights already. | quartal + most reverb. Correct. Wants drips with real spacing and a bat wing-clatter. |
| 17 | Antarctica | high threshold, desaturated — **deliberate and correct.** | open fifths, deliberate. Leave. |
| 18 | Monte Carlo | **zero PointLights** in the chapter its own grade calls "the bloom chapter". **Zero ground scatter.** | jazz band correct. Leave. |
| 19 | Hanoi | **zero ground scatter** on the busiest street in the game. | deliberately sparse — correct. Wants a vendor cry and a bowl-and-chopstick clatter. |

---

# THE BATCH

One command:

```
/polish
```

The core batch is a project skill at `.claude/skills/polish/`. It is the 80/20
of everything above: **two global picture changes, two global sound changes**.
Every chapter gets a visible lift; nine get an audible one.

Four phases, **with a commit at every boundary** — that is what makes this one
command instead of four, and the only thing that makes a five-hour run
survivable if it is interrupted. Stop at any boundary and what has landed is
coherent.

| phase | what | est. |
|---|---|---|
| **1 · The floor** | a near-field octave in `grain()` with an `fwidth` fade, opted in across all 19 grounds, plus scatter in `monaco.js`, `hanoi.js`, `cali.js` | ~2 h |
| **2 · The rim** | a sky-tinted fresnel on the Lambert material — the strongest polished-low-poly cue there is, and absent everywhere | ~1 h |
| **3 · The sound of the place** | new ambience generators for Kyoto, Marrakech, Hong Kong, Venice, Hanoi and Sydney | ~2 h |
| **4 · The three wrong instruments** | a ney, a viola caipira and a kulintang | ~1 h |
| | **total** | **5–7 h** |

`/polish list` prints the plan without running anything. The skill carries the
shared preamble — the aesthetic law from `CONTRACT.md`, the eight harness traps
that have each cost an hour in this repo, and the four conditions that make a
phase done — so the phase text stays about the work.

**These estimates are not measurements.** Every other number in this document
came off the framebuffer or out of the source; these came out of scope. Two
things drive them: a verify cycle here is ~5 min because `playwright-cli` must
`close-all` and re-open to defeat the module cache, and an 8-chapter measurement
run is ~5 min of mostly waiting. Phases 1 and 2 are dominated by that rather
than by writing code — phase 2 is forty lines of shader and an hour of looking
at it.

## Deliberately left out of the core

Two slices remain available as `/polish V2` and `/polish V4`. The batch is
instructed to name them in its final report rather than quietly drifting into
them.

| slice | why not in the core |
|---|---|
| **`V2` Point lights** — Hong Kong, Iceland and Monte Carlo have zero between them, so every neon sign blooms but lights nothing | Needs a new pooled subsystem with a frame-time budget. It is the one change in the pass that can plausibly cost performance, and that is not safe to fold into a long unattended run. **The highest-value thing left**, ~1.5–2.5 h. |
| **`V4` The lens** — no tone-mapping, a hard clamp, a split tone that does not exist | Must run **after** the core: it re-grades every chapter, so it wants phases 1–2 settled underneath it. Also measured at 0% clipping in the ground band, so it is quality rather than damage. ~1–2 h. |
| **Contact darkening** (the other half of the P3 finding) | Needs prop-position plumbing. The rim is ~80% of that finding for ~20% of the work. |
| **Floor graphics** — Venice's Istrian banding, Kyoto's raked gravel, Hong Kong's road markings | Per-chapter authoring, not one mechanical change. Best done once phase 1 shows what the grain alone bought. |
| **Iceland and Sơn Đoòng ambience** | Real, but the least culturally distinctive of the eight candidates. Trimmed to keep phase 3 in budget. |

Full phase text — the finding behind each, the work, and its acceptance test —
is in `.claude/skills/polish/batches/CORE.md`.
