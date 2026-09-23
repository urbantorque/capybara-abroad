# ROADMAP-LIFT3 — the third lift (12 Sep 2026)

The brief: take a game that is functional and enjoyable and make it memorable.
Five review agents (design, art, audio, writing/UX, QA) read the tree and 41
settled frames (`qa/l3-*.png`); this is the synthesis, ranked by what changes
what the game *is* rather than what it has. Nothing in ROADMAP-LIFT2's "still
open" list is repeated here unless it is folded into a batch below.

The measure of "30% better" is not one number. Each area names the instrument
that has to move, because every earlier pass found that a change with no
instrument was a change that did nothing (see memory: terms that cannot bite).

## The two new features

### F1 · THE AUTHORITY, AND THE HIDE
*One person per chapter who can pick you up; and the one verb that answers them.*

Fifteen of nineteen chapters have nobody who can do anything to you. The
notoriety ladder (N1) has five named tiers and at the top a marcher walks over
and says a line: `'they reached you. the chain is over — the card stays.'` The
Sydney gardener has carried the animal out since chapter one (`npc.js:9544`,
`capy.carriedBy`), and Monte Carlo proved a cost that denies nothing — ten
seconds and your dignity.

- One roster local per chapter flagged `authority: true` (the monk, the
  vaporetto inspector, the lifeguard, the ranger, the traffic cop…). At the
  march tier the authority takes the march. On reach, the gardener's carry:
  you are set down at the chapter's way-side edge, the held prop stays where
  it fell, nothing ticked is lost.
- THE HIDE (LIFT2's open verb): `game.addHide({x,z,r})` registry per chapter
  (bushes, under tables, tall grass, behind stalls) plus water with the eyes
  above the surface. Inside a hide spot and still, the march loses the line;
  after `sysHIDE_LOSE` seconds it gives up and the chain ends *without* the
  card. A HUD eye on the paper's foot: open while seen, closing while hidden.
- Composition: chase, getaway, notoriety, the herd, the costume all acquire
  a reason: the jacket halves the eye in Monaco; a herd of fourteen cannot
  hide.

**Instrument.** `qa/l3-authority.js`: drive the ladder to the march tier in
three chapters, assert the authority is the marcher, assert the carry lands
inside the edge radius with the task list unchanged; then the same with the
animal in a hide spot, assert the chain ends with no carry. Effort M–L.

### F2 · THE MELODY
*Fourteen pad palettes are harmony plus dice.*

Every lead voice picks `ch[randInt(0, ch.length - 1)]`; no state carries the
previous pitch. The arrival phrase (`arrive: { deg:[0,1,2,1], dur:[2,1,1,3] }`)
proves the engine can carry a motif in-key across twenty-one keys and is used
for 3.6 s per chapter.

- `sysMUS_CELL` per palette: 3–5 cells of `{deg, dur}` in chord-degree space.
- `musNextDeg(prev)`: P(step ±1) 0.6, P(leap) 0.25, P(repeat) 0.15.
- Every Nth pluck plays a cell through `musLiftNote`, as `musSting` does;
  the arrival contour is every table's cadence cell so the doorbell becomes
  the leitmotif.
- Stingers and ticks snap to the next quaver of `musBarAnchor` in band
  palettes (`musSting`, `sfxTick`).

**Instrument.** `phraseAudit` extended: every cell note in key; a probe that
records 60 s of the lead's MIDI in three palettes and asserts the step ratio
(≥ 55% of intervals ≤ 2 semitones) against the before (≈ 30%). Effort M.

## The five enhancement areas

### E1 · THE FRAME HAS A DARK (art)
Every bright chapter converges on one pale value: fog near planes at 46–110 m,
the composite air at 0.0012–0.0028/m with `airR = fog.color.r`, and far DoF.
Night is a dimmed day with a lifted floor (ambient 0.55–0.62; `uLift` plumbed
and never set).

- Horizon-weighted air in `MAIN_POST_COMP`: `uAirK *= 1 - smoothstep(0, .12, dir.y)`.
- Air colour decoupled from fog: `airCol = fog * 0.86` toward the sky's
  horizon hue, so the far ground is darker than the sky.
- Daylight rows: `airMax` halved, fog near ≥ 120 m, near DoF band off.
- Nights: ambient ≤ 0.2, hemisphere carries the moon/neon, `lift ≈
  (0.02, 0.03, 0.06)` on Iceland/Drift/Kowloon/cave/Monaco; Kowloon bloom
  threshold 0.32 → 0.5; Antarctica exposure +0.08.

**Instrument.** `qa/l3-luma.js`: per chapter, the p5/p50/p95 luma of the
rendered frame and the mean luma of the top 12% (sky band) vs the band
just under the horizon. Target: horizon band ≥ 8% darker than the sky band
in every daylight chapter (today: within 2%); night p5 ≤ 0.06.

### E2 · THE GROUND AND THE GAIT (art / animation)
- Foot plant: stance the slow 60%, swing the fast 40%; foot lift and shin
  shorten in swing; bob peaks at mid-stance. Head leads the turn, tail
  trails it, on `capyYawRate`. Ears flop forward on the landing spring.
- `floorGraphics()` in environment.js: kerb + gutter, paving-joint grid,
  manhole discs, a crossing, tide lines — for Kyoto, Cali, Iceland, Hanoi,
  Venice, Palawan. One merged static mesh per chapter.
- Cloud shadows: drift the broad octave's XZ sample by `_grainTime · wind`
  and gate its gain by the weather's cloud pulse.

**Instrument.** Ground-flatness (the polish pass's measure: value variance in
the bottom 40% of the frame) per chapter, before/after; gait: the foot's
world-y trace over one stride has a flat 60% and a lifted 40%.

### E3 · THE SPINE AND THE VOICE (writing / narrative)
- The keepsakes are the stated quest: one line on the title and one in
  Sydney's opening. The way-on row is shown from the first minute, dimmed,
  with its clue. The finale opens on a keepsake from every place
  (`chapEnough` × 19) with the 100% ledger kept as the complete variant.
- Nineteen cross-chapter callbacks: one line per chapter keyed on a wow done
  elsewhere. The traveller's cameos gate on meetings (`npcTravCount()`).
- The `startled`/`rush` pools — the most-heard lines in the game — rewritten
  to the game's register. Sydney's register kept and named.
- Toasts hold longer for longer text; bubbles honour the text-size setting
  (done in L3-1).

**Instrument.** `qa/lines.mjs` extended: no contraction outside Sydney's
bespoke cast; every callback's `when` resolves to a real task id; the finale
probe passes with `chapEnough` on all 19 and not 234/234.

### E4 · THE ANIMAL SOUNDS AND THE BAND IN TIME (audio)
- Three vocalisations on existing graphs: `grunt` (landings, shoves, the
  barge), `click` (munch, grab, find), `chatter` (denied, shooed,
  incident). Footfalls alternate pan and get a heel/toe at walk.
- A `speakNow` term ducks the pad 18% and drops the filter 220 Hz for 1.2 s
  after a bubble.
- Stingers in time (with F2).

**Instrument.** `qa/s1-spectrum.js` re-run (the S2 shelf must hold); a probe
that counts distinct `sfx` names fired by the capybara in a 90 s Sydney
soak (today 4; target ≥ 7).

### E5 · THE HAND ON THE WHEEL (UX / accessibility / defects)
- The paper tucks: after 4 s of walking with no tick it collapses to a
  one-line tab; expands on stop, tick, or Tab.
- The minimap's distance chip no longer covers the place label.
- The pad legend on the title when a pad has been seen.
- Save export/import on the pause card (clipboard JSON).
- Whatever the QA/performance review ranks as blocking.

**Instrument.** Screenshots under playwright of the tucked/expanded paper;
`npm test` green; `qa/fuzz.js` clean in three chapters.

## Order of work
L3-0 hygiene (done) → L3-1 E5 quick wins + E3 timing (done) → L3-2 E1 →
L3-3 F1 → L3-4 F2 + E4 → L3-5 E3 → L3-6 E2 → L3-7 E5 remainder + QA defects
→ closeout (CONTRACT.md, memory, summary).
