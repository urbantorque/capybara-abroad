---
name: capy3-what-the-place-is-for
description: "B1 of ROADMAP-FUN: the marquee channel, the first time a capy3 chapter was ever timed, and the audio regression the soak found"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T00:44:20.353Z
---

**B1, 7 Sep 2026** (`5060f0a`, branch `character-pass`). The first batch of
`ROADMAP-FUN.md`.

**The channel.** `marquee: { x, z, up, say }` on all nineteen `CHAPTERS`, plus
`game.marqueePoint()` / `sysMarqueePoint`. `up` is metres ABOVE THE GROUND at
(x, z), never absolute — a marquee point is a composition (the middle of the
sails, the shaft of daylight, the crest of the dune) and it must stay the middle
of the thing when terrain is retuned. Resolution order: the live biome's
`marqueeAt()` hook, then the authored point, then `hintTarget(wow)` — LAST,
because a hint target is where you must GO and that is not what you look at.
Only pasto.js publishes `marqueeAt()` (the condor), and it answers null rather
than a stale position while the bird is down.

**The signpost (1b).** Above the act heading on the to-do card, OUTSIDE the
`<ul>` and not in `taskRec`, so it cannot touch `win`, `chapComplete` or the act
derivation. It stands down once its row is genuinely on the paper — the test is
`show[wowId]` computed after the window is filled and before anything is
written, so the duplicate never appears even on the frame the act opens.

**THE NUMBERS NOBODY HAD EVER TAKEN** (`qa/first-five.js`, 19 chapters, 90 s
each, random walk, entered through `hud.cross`):

  - the signpost is up in **19/19**
  - the marquee is seen at all in **6/19**; never once on screen in thirteen
  - on the arrival frame (`qa/arrive-see.js`) it is in the frustum in **8/19**
    and unoccluded in **2** — Venice and the Pantanal, nothing else
  - the first tick lands inside 30 s in **13/19**, and in SIX (Quay, Kyoto,
    Iceland, Marrakech, Hong Kong, Palawan) a wandering player ticks NOTHING in
    ninety seconds. Worse than the roadmap guessed, and it promotes item 2.
  - longest quiet run 31–91.5 s; over a minute in twelve chapters.

**Eighteen of nineteen marquees are in act 2 or 3** (only Kyoto's `uji-run` is
act 1). `qa/p6-static.cjs` prints the split and fails the build on a chapter with
no marquee, a `say` that names a key, or anything but exactly one `wow`.

**The audio regression the soak found.** `ReferenceError: pan is not defined`,
on the game's own error banner. M1's second voice (A6, `33795ba`) reads
`-pan * 0.8` one scope out from the `const pan` inside `if (ch)`, so **A6 had
never played a note** in any of the thirteen chapters whose palette has one. It
hid because the voice only enters above `sysMUS_2ND_AT` = 0.33 of a chapter's
TASKS — every audio probe in this repo opens a fresh chapter at zero — and
because its escape hatch, `musAudit().second`, reports `sysMUS_2ND[musPalN]`:
the TABLE having a row, which stayed true throughout. **A flag saying a feature
is configured is not a way out for a feature that is invisible by design.**
`musAudit().secondN` counts notes actually scheduled now.

Related: [[capy3-the-fun-review]], [[capy3-the-paper]], [[capy3-the-mix]],
[[capy3-names-nothing-publishes]], [[headless-qa-harness]]
