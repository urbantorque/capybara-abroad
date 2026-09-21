---
name: capy3-world-life
description: "D7 — the five world-life systems, the anchor that made hanging things affordable, and the six instruments that lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 60501ba9-888e-42ec-bf5f-6720ba5e13a0
  modified: 2026-09-03T09:30:43.548Z
---

D7 (3 Sep 2026), area 3's five remaining systems. Contract section **WORLD LIFE
— D7**; instruments `qa/d7-life.js` (the baseline), `qa/d7-anchor.js`,
`qa/d7-hang.js`, `qa/d7-beat.js`, `qa/d7-flock.js`, `qa/d7-act.js`,
`qa/d7-touch.js`, `qa/d7-diff.cjs` (a dependency-free PNG A/B).
Follows [[capy3-wires-not-systems]] and [[capy3-the-door-is-an-object]].

**What shipped.** `game.hang()` (props.js) — a single-bone damped pendulum;
`hangThing()` (shared.js) — five shapes; `sysBOARD_HANG` — one hung off every
exit board. `beat` on `addLocal` — three shapes (work / reach / rock), 43
people in 17 chapters. `game.flockOffer` — scatter on a run + drift to food, on
the HERD'S OWN `count`/`at`/`put` contract. `sysAMB_AT` — 40 anchored ambient
voices in 17 chapters. `sysACT_LIGHT` — a grade+airlight DELTA lerped by act
index, 7 chapters.

**THE ANCHOR IS THE COST, NOT THE OBJECT.** A hanging thing needs a point in
the air that is attached, level, not inside a wall and not far from anywhere
the player goes — and finding nineteen of those by hand is what D6b cost twice.
There is exactly one such point per chapter already measured and already
photographed: **the header of the exit board**. Nineteen hung things for one
table and no new measurement. Generalise this: when a batch needs a per-chapter
anchor, look for one a previous batch already paid for.

**THE PROPS' WIND IS NOT THE PENDULUM'S WIND.** `physWindNow` subtracts
`physGUST_MIN` so a ticket stays where the player put it, which reads 0.000 in
nine chapters. A wind chime exists to show air you cannot see. `physAirNow` is
the raw sum. Same shape: `physWHEEK_R` is 5.0 m so a shout cannot walk a prop
off a ledge — and 5.0 m does not even REACH the lantern at the end of an exit
board (measured 5.44 m in Son Doong, the one chapter with no air, where the
shout is the only thing that can move it). `physHANG_WHEEK_R` is 9.0.

**SIX INSTRUMENTS THAT LIED:**

1. **`canvas.toDataURL()` writes blank white** (no preserveDrawingBuffer): six
   chapters, six byte-identical 21 956-byte PNGs of nothing. `page.screenshot`.
   Harness trap 12, paid again.
2. **The browser caches ES modules across `page.goto` inside one run-code
   session.** A source edit between two `run-code` calls is not picked up: the
   hang sweep returned numbers identical to four decimal places after a change
   that must have tripled them. `close` then `open` before any run that follows
   an edit.
3. **`camYaw` is the bearing from the animal TO the camera**, so W walks it
   along MINUS (sin, cos). Written the intuitive way the probe sprinted in the
   wrong direction and reported a contact channel that does nothing.
4. **A four-key closed loop oscillates.** Aim with the camera instead: settle,
   THEN read camYaw, THEN put the animal on that line, THEN hold W within a
   quarter of a second — camYaw is damped and drifts while you wait.
5. **A drop test finds floors, a walk finds routes** ([[headless-qa-harness]]
   trap 24, again): the walk-through test ran in Hanoi, whose board is on the
   Long Biên bridge, and spent fourteen seconds against a steel truss.
6. **localStorage survives the reload** (trap 8, again): the second act-light
   run opened Monte Carlo already in its third movement and photographed the
   end of the chapter three times.

**FOUR THINGS THE ROADMAP HAD WRONG,** all found by measuring first:

- There are **no one-person chapters**. Smallest cast is six, largest thirteen;
  the only two with no `locals` are the two with a `humans` cast. What is true
  is bigger: all ~150 people were doing nothing at all.
- **The train was already off the line.** Hanoi's horn and Kyoto's bell are
  positional through their own cue helpers; the AMBIENT ladder over them was
  not.
- **Eleven chapters must NOT get an act light.** Four already animate their own
  hour (Göreme's clock, Marrakech's dusk, Palawan's dive, the Pantanal's
  evening) — two writers on one look. Seven chapters' acts are about PLACE.
- **A chapter that builds its addLocal call field by field drops anything new
  in its table.** The Drift does; two beats vanished in silence.

**AN ACT ROW IS A DELTA, NOT A SECOND GRADE** — a second full row goes stale,
and `sysLENS` writes `wide`/`splitW`/`splitC` into these rows AFTER the table
is built, so a hand-written copy silently loses a chapter's lens. And the snap
on a chapter swap must re-read the act first: `sysActWant` is 0.25 s stale by
design and a stale snap lands the new chapter's light on the last chapter's
act.

**THE FLOCK MUST OWN THE POSITION IT WRITES.** An incremental nudge (step from
`at`, put the result back) loses to a chapter that damps its own birds home
every frame: Manly's gulls came down for a chip and made 4 424 puts in ten
seconds without one bird arriving. THE HERD does not have this problem because
it writes an ABSOLUTE point. Keep a per-bird copy, seed it once, write that —
and release it (`go = 0`) the moment the flock loses interest, or the chapter
never gets its birds back.

**`land` is the callback nobody expected.** Manly already had a come-down state
on a random 26 s timer with the comment "they come down for the chips" over it,
and it had never once been connected to an actual chip.

Related: [[capy3-the-herd-anywhere]], [[capy3-things-that-are-simply-there]],
[[capy3-sounds-people-make]], [[capy3-the-micro-environment]],
[[capy3-external-forces-on-the-capybara]], [[capy3-springs-are-clipped]]
