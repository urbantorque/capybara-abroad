# ROADMAP-LIFT4 — the fourth lift (12 Sep 2026)

The brief, again: functional and enjoyable → memorable, beautiful, engaging;
five to seven areas lifted in detail and three to four features that change
what the game is; nothing broken. Six reviewers read the tree, the 39 settled
frames (`qa/l4-*.png`) and — this time — PLAYED it with real keys: game
design, art, audio, writing/UX, QA/performance, and a fresh-eyes playtest.
Their reports are the six `review-*.md` files of this pass's scratchpad;
every item below carries a file:line from one of them and an instrument.

What the six agreed on, said once:

- **The systems are deep and the game hides them.** The chapter signpost
  had been `display:none` in all nineteen chapters since this morning
  (fixed first, L4-0). The prose only shows at 100 %. The best twenty
  seconds of each chapter are never kept as a picture. The first minute
  shouts fourteen toasts; the last minute is a chime.
- **The daylight frame has no dark in it, and the reason is the light rig.**
  Direct sun on a horizontal is LESS than the diffuse light in almost every
  daylight chapter (Venice 1.15 vs 2.49); the darkest one per cent of Venice
  is 82/255; the driving-lens DoF blurs everything past 15 m. Measured, per
  frame, by `qa/l4r-art-value.mjs`.
- **The score lives under 250 Hz.** Spectral centroid 80–147 Hz in every
  chapter and every mix state; 0.0 % of the score's energy above 2 kHz. On a
  laptop speaker it is a tapping. A chase makes it DARKER.
- **The machine is sound but four instruments lied**: the fuzz suite had
  been passing against the title card; the pasted save is undone by its own
  reload; the Karplus–Strong string does not load from `file://`; the
  resolution governor drifts back to full pixels at 8 fps.

## The four features

### F1 · THE CAMERA, AND THE CHAPTER TOLD BACK
*Photo mode becomes a camera; the game photographs the big one itself; the
close and the departure are your picture and your story.*
(design F2 + #6, art F1, writing A, the player's first wish)

- F1a. K pauses the world clock and hands the lens to a free orbit: drag
  orbit, wheel dolly 2–30 m, W/S pitch −10…+35°, 1–4 focal lengths
  (24/35/50/85 mm through the fov and `uFocalPx`), click-to-focus with the
  DoF at full strength, R/F roll, Q cycles the animal's pose (loaf / look
  here / held wheek), head aims at the lens. Enter keeps a full-width album
  entry. Three looks through `photoLens` (as is / golden / Kodachrome).
- F1b. `albAdd(place, wowName, 2)` on the first rendered frame after a
  marquee's slow-mo engages — tag 2, never evicted by tag 1. `chapRecap(n)`:
  ≤ 3 lines ranked by rarity from the per-chapter counters (`jrChapInc`,
  `jrChapPho`, `jrChapFed`, carries, names earned here, record vs par).
  `showDone` takes `albBest(place, 2)` as its art and the lines under the
  note; the ledger leaf shows the tag-2 thumbnail; the postcard's back prints
  the lines.

**Instrument.** `game.photoAudit()` grows `orbit/pitch/fov/focusM/pose`; a
probe orbits 90° in Pasto, focuses at 4 m, asserts `dof ≥ 0.6`, an NPC's
position identical across 2 s (world paused), album entry width ≥ 1280.
`albAll()` holds a tag-2 shot after each marquee probe (`qa/x1..x5`, the
condor, the flood); `chapRecap(n)` ≥ 2 lines in every chapter on a seeded
save. Effort L / risk low–med.

### F2 · THE HOUR TURNS
*Finishing a place buys its evening.* (art F2)

At ENOUGH (`chapEnough`) in the fourteen daylight chapters, a 240 s scalar
lowers the sun to a per-chapter `evening.elev` (≈12°) through `sunAxes`
(elevation only), `atmosApply` via `sysSunLow`, the dome's lobe, the shadow
box top, the grade's split-tone weight. Night chapters and Göreme (which
does the reverse) opt out. Saved as `eve`. weather.js's law gains one line.

**Instrument.** `qa/l4r-art-sunaz.js` at ENOUGH + 250 s: sun elevation
≤ 14°, ground-shade share ≥ 2× arrival; evening frame p01 ≤ 35, saturation
≥ arrival + 0.06, over-230 ≤ 6 %. Effort M / risk med.

### F3 · THE CHASE, SCORED — AND THE SONG THAT ASSEMBLES
(audio #2 and its feature)

- A `chase` layer in the pad palettes: a pulse on the existing drum bus
  (`musBendir` / `musBombo` on 1 and 3, `musClap` on the and-of-2 at 25 %)
  at a per-palette `chaseBpm`, the lean inverted (filter +1100, pad −15 %,
  bass +0.03) so the centroid RISES, a lead doubled an octave up while
  intensity > 0.6; `npc:lost`/`npc:caught` cut `musChaseT` to 0.6 s — the
  hide becomes audible.
- Progress layers: `sysMUS_LAYERS` — second voice at 25 % (exists), a slow
  pulse at 50 %, a counter-line on the second voice's instrument at 75 %,
  the theme as an ostinato at 100 % — gains as damped terms in the one
  writer block, schedulers gated on the same scalars.

**Instrument.** `qa/l4r-audio-states.js`: chase centroid > calm centroid
(today 94 < 131); envelope autocorrelation peak at 60/bpm during a chase;
`musAudit().layers` monotone in `chapProg`, RMS +≥1.5 dB per layer.
Effort M / risk med.

### F4 · THE DEPARTURE, AND THE CODA
(design #5 + F3, audio #3, writing #2 and B)

- Leaving: in `jrTravel`, before the fade — `frameShot` on the ceremony's
  pull-back rig held 2.2 s, a `chapter:leave` event (heads turn, the nearest
  three say a farewell, the regular's line), the fade delayed 2.4 s, the
  horn at the cut; a departure card when `chapEnough`: *that will do here* ·
  NAME · `def.note` · *you are taking · <keep>* — the epitaph read by
  everyone who leaves, not only the 100 % player.
- The coda: `sysMUS_STING.finale` — nineteen notes, one per palette's lead
  in chapter order, panned by the route's longitude, on the current chord;
  then `music.hush()` — the first deliberate silence in the game — held
  until the ledger; the camera on the title's drift rig round the
  horseshoe; each keepsake takes a flash as its note sounds.
- Sydney's way-on honest: `jrOpen(2)` gated on `chapEnough(1)` and the door
  authored at ten (`door:` on CHAPTERS overrides 0.70), so the first border
  is ~12 minutes away, not 30.

**Instrument.** Travel out of fifteen chapters: ≥ 1 farewell bubble 15/15,
camera distance at the cut ≥ resting + 4 m. `hud.stingAudit('finale') ===
19`; seeded finished save: peak ≥ +6 dB over the bed, then ≥ 2 s under
−45 dBFS before the ledger. Fresh file: `chapEnough(1)` by minute ≤ 12 in
a directed run. Effort M / risk low–med.

## The seven enhancement areas

### E1 · THE KEY LIGHT AND THE LENS (art #1, #2, #3, #6, #8)
- Sun ≥ 3× (hemi + amb + fill) on a horizontal in every daylight row
  (`sysDAY_HEMI_I` 1.35 → ~0.75, amb 0.12 → 0.06, `sysFILL_K` 0.30 → 0.20,
  the eight overrides); lit value held with `sysEXPOSURE` (p50 within ±8);
  `sysSHADOW_SKY_DEF` 0.45 → 0.30 and the shade bluer.
- Driving-lens DoF: `dof` 0.50–0.65 → 0.25–0.30, `dofK` → 2.4–2.8 in the
  daylight rows; full strength kept for photo mode and slow-mo.
- `sysCAM_PITCH` 34 → 24, `sysFOV_BASE` 48 → 52, `sysCAM_DEF` 9.5 → 10.5;
  re-measure the boom cut and clamp.
- Kowloon's light pools as one radial-ramp disc; Monaco quay darker than
  its sky; bus glazing under the bloom threshold.
- The animal looks at the lens: an idle beat yawing the head toward
  `game.camera` once the rest lens has opened; the rest lens drifts 20°
  round the flank.

**Instrument.** `node qa/l4r-art-value.mjs qa/l4-*.png`: every daylight
frame p01 ≤ 40, under-64 share 5–15 %, p50 within ±8, over-230 ≤ 6 %;
`l4r-art-sunaz` ground-shade mean ≥ 60; edge density ≥ 1.6× on Venice,
Sahara, Pasto, Sydney arrivals; walking horizon ≤ 0.95 in 19/19.

### E2 · THE SCORE, VOICED (audio #1, #4, #5, #6, #7)
- Out of the sub: a second-harmonic partial on the bass, the sine −4 dB;
  pad `cut` ×1.35, Q 0.5; `musPluckDry` 0.42 → 0.60, KS pluck position
  0.28 → 0.20; a tilt on `musVol` (+3 dB @ 1.2 k, −2 dB @ 120); spectra
  re-trimmed; the S2 ceiling kept (share > 5 kHz < 1 %).
- The world makes room: one writer on `acSfxIn.gain` (stings, the lift,
  the arrival hold). Speech duck only within 14 m with a 2 s refractory —
  Sydney's pad stops flickering.
- Nine footstep materials (`mat:` beside `pitch`): grass, sand, gravel,
  stone, timber, metal, snow, ice, plus the wet layer. Blue ice stops
  playing as a plank.
- Distance has wetness: a per-call room send rising with distance for
  placed sounds and movers.
- The herd answers one by one: each answer at `dist/343 + rand(0.12, 0.85)`,
  placed, pitch folded to the chord, capped at eight.

**Instrument.** `qa/s1-spectrum.js`: share ≥ 500 Hz ≥ 25 % in 15/19
palettes (today 2/19), centroid ≥ 350 Hz in all pad palettes; a
"laptop" metric (HP 200 Hz) within −6 dB of the full score. `musAudit()
.speak` mean < 0.15 in a Sydney stand. `qa/l4r-audio-steps.js`: ≥ 8
distinct clusters ≥ ⅓ octave apart. Cave far/near tail ratio ≥ 3. Herd:
≥ 5 placed answers within 1.2 s of one wheek.

### E3 · THE FIRST MINUTE, AND THE HAND ON THE VERB (design #2, #3;
writing #4, #5; player #2, #5, #6)
- A toast budget for the first 180 s of a fresh file (teaching lines ≥ 6 s
  apart, never within 2.5 s of a tick pill); the ambient-narration toasts
  become bubbles or wait for quiet.
- `most-wanted` needs ≥ 8 sustained 4 s; `wrung-out` needs the shake-dry
  after ≥ 20 s wet; chapter-neutral finds silent for the first 5 min of a
  fresh file; no rung counts until the first deliberate tick or 90 s;
  FOUND toasts say *noticed*.
- The grab has a whiff: E with nothing in reach plays `click` low, the
  nearest grabbable inside 2.5 m takes the rim highlight while E is held.
- Grey reward toasts and the arrival card get a paper wash / contrast ≥
  4.5:1; `tXs` floor 9 → 10 px; a fourth text stop; the par line dropped
  when untimed; Hanoi's paper ≤ 8 lines.

**Instrument.** 3-minute naive drive in Sydney/Kyoto/Hanoi: toasts/min ≤ 6
in minute one (today 20–25); `findDone() === 0` at 3 min on a fresh file
19/19; first incident card ≥ 60 s in Sydney (today 23 s). Contrast of the
toast ink vs the pixels under it ≥ 4.5:1 in cave and Iceland.

### E4 · EVERY MARQUEE A NUMBER (design #1, #4, #7)
- Eleven RECORDS rows for the wows without one (`opera-stage`,
  `condor-ride`, `chiva-mirador`, `fragata-ride`, `aurora`, `lantern`,
  `acqua-alta`, `symphony`, `the-manta`, `sunrise`, `the-column`), each
  par measured against a scripted floor; the chapter's existing live
  quantity routed through `game.recordLive`.
- A third paper state `.marq` while `wowLive` is fresh or `capy.atHelm`:
  rows fold, the signpost, live line and bar stay.
- Five movement names into `repEv` from capybara.js's edges (slide → lip →
  hop, climb-kick into water, mounting a moving carrier, a throw landing in
  water from > 10 m, a vault chain).

**Instrument.** `qa/audit-tasks.mjs` wows-with-record 19/19 (today 8/19);
`.capyui-todo` height ≤ 40 % of today's while `wowLive` is fresh; a
3-minute movement soak in Kyoto and Kowloon earns ≥ 2 movement names.

### E5 · THE VOICE IN SYDNEY AND PASTO (writing #3, #8; player #8)
- A regular for `sydney` (the waiter — *Table Four*) and `pasto` (the
  woman with the broom); both casts routed through `localLine`'s bag;
  `npcRumArm` so Pasto says *Word came up from Sydney.*
- A per-line cooldown in `pickLine` (six-deep echo ring as the locals
  have); the `slide` pool in the game's register; the duplicate lines
  across pools removed; `riddleTold` saved; digits through `sysNumWord`.

**Instrument.** `qa/lines.mjs` 120 s Sydney and Iceland soaks:
distinct/total bubbles ≥ 0.85 (Iceland today: one line ×7 in 5 min);
`npcPAL.sydney/.pasto` tier-3 line fires in a seeded save.

### E6 · THE MACHINE (qa #1–#11; player #1)
- `qa/fuzz.js` starts with Enter and FAILS on `started !== true` or
  `maxSpeed < 1`; the keepsake teleport read after the sweep.
- `saveLocked` latch so the pasted journey survives its own reload.
- The worklet from a `data:` URL first, the Blob second; `musAudit().ks`
  true from `file://`.
- The governor on absolute frame time with a floor on the ceiling, a
  second rung (shadow 2048 → 1024) — and said on the settings card.
- `SAPBroadphase.collisionPairs` tests bounds first (Kyoto 118k → ~5k
  pair tests per substep); collision groups for kinematic carriers;
  `castShadow` off under 0.35 m; the errand prop filed under its biome.
- Pause keeps the held beat (`time.step` returns without `clear()`).
- The perf overlay reports real calls; `npm test` runs `build.mjs`.
- The Sydney camera under the forecourt slab (player frames sydney-13/14):
  the keep-out pushes the lens through the podium; clamp the boom to the
  first wall in that case as everywhere else.

**Instrument.** `qa/l4r-qa-fuzz.json` started/maxSpeed; `l4r-qa-save2`
marker survives; `l4r-qa-ks` file.ks true; `l4r-qa-bp` Kyoto nbcPerSub
< 10k; `l4r-qa-phys` hfPairsPerSub ≤ 3 in Venice/Antarctica; `l4r-qa-ab`
smallCasters < 20; `l4r-qa-leak` kin stable; `l4r-qa-input` slowmo
resumes at 0.4.

### E7 · THE SKY AND THE WATER (art #4, #5)
- A sun billboard (emissive over 1.0, blooms) at the sun's bearing in the
  daylight chapters; clouds as two or three layered soft cards tinted
  top = sun / base = `skyBottom`, drifting on the cloud-shadow field so
  cloud and shadow are one object.
- Monaco's harbour and the Quay take `hkBuildWetRoad`'s yawed additive
  streaks under the window rows, lamps and sails.

**Instrument.** Sky-band luma sd ≥ 1.5× today on daylight arrivals; a
> 230 cluster at the sun's screen position when in frame; Monaco water
band pixels over luma 180 ≥ 1.5 % (today 0).

## Order of work
L4-0 the signpost (done) → L4-1 E6 (the instruments first, so every later
batch is measured by a suite that can fail) → L4-2 E1 → L4-3 E2 → L4-4 E3
→ L4-5 F1 → L4-6 E4 → L4-7 F4 → L4-8 F2 → L4-9 F3 → L4-10 E5 → L4-11 E7 →
closeout (CONTRACT.md, memory, the summary). Every batch: `npm test`
green, `node build.mjs` green, its own instrument moved, the nineteen
settled frames re-taken where the picture changed.

## Not taken, and why
- A mischief score with multipliers: refused three times in the repo's own
  voice; F1b gives the score's job to a recap.
- A day/night cycle: `sysACT_LIGHT` walks the hour by act; F2 is the
  version that is a reward rather than a clock.
- THE STOWAWAY (one animal comes with you across a border): the best idea
  in the design review and the largest; held as the stretch item after
  L4-11 if the budget allows, because a biome-less living follower touches
  `mainMakeBiomes`' detach, the herd, the hide and the save at once.
- New Game+: the ladder, the regulars and the costumes already persist;
  E4 and F4 make a second visit worth more than a second lap.
