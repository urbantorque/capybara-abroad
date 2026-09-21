---
name: capy3-the-feel-pass
description: "v44 — the five systems aimed at moving about rather than at tasks, and the two design traps they paid for"
metadata: 
  node_type: memory
  type: project
  originSessionId: fb26bf48-6839-4e7d-b0e6-13a3adeeef81
  modified: 2026-08-30T09:08:44.019Z
---

Asked for on 30 Aug 2026: five bold, no-regret lifts to enjoyment. The review that
preceded them is the useful half — this game is so complete that almost every obvious
idea already exists (punch/hitstop/slowmo, records, ghost, par, finds, souvenirs, album,
wardrobe, nine skills, herd, mischief economy, heat, wariness, calm, weather moods,
composite lens, spatial audio, per-room reverb, a golden-hour drift keyed to progress).
**Check CONTRACT.md's section list before proposing anything to this codebase.**

The genuine gap was that **the game had no opinion about moving**. `chaos` answers a bin
going over and `calm` answers a sit-down; a clean two-hundred-metre line at a run — the
most common and most skilful thing anybody does here — read to every system as identical
to standing still.

Five built (see CONTRACT.md "THE FEEL PASS" for the full spec and numbers):
`flow` (a streak beside chaos and calm), the **slide** (Ctrl), the **wake** (foliage parts
around the animal), the **echo** (the wheek comes back off the world), the **crest** (the
camera gives you the view when the ground falls away ahead).

**THE TWO TRAPS, both of which are about REUSING a solved mechanic.**

1. **A slide is not a new movement model — it is `slip`.** capybara.js has had a measured,
   tuned model of slippery ground since chapter 7. Raising `slip` gave the slide low
   friction, reduced steering and the carve skill for free. **But `slip` feeds three things
   and one of them is the top-speed multiplier**: measured on the erg, holding the stick
   through a slide reached **17.9 m/s on the flat**, 2.4× a run, on a keypress. The split
   is the design — `slipG` (ground + belly) for friction/steering/Tobler/skid, `slip`
   (ground alone) for both speed ceilings. A slide carries speed; only gravity may add it.

2. **`biomeLive()` is npc.js's, and the build cannot see that.** The crest's first cut
   called it for the live chapter's api. It resolved — to another module's helper, which is
   hard-coded to Sydney — because the bundler flattens every module into one scope, and the
   unbundled dev build would have thrown ReferenceError on frame one of every chapter.
   `node build.mjs` says "no collisions", which means names do not clash, NOT that a name
   belongs to the file using it. **Same bug family as `noiseBuf`.** The systems.js idiom is
   `game[game.biome.current]`. The scanner in [[capy3-under-the-floor]] missed this one
   because the identifier IS declared — in a different file — so a cross-module check has
   to compare against the file's own declarations, not the union.

   **There is an audit for this now: `qa/xmodule.mjs`.** Per file, is every called name
   declared there, imported there, or a known global. Two things it had to learn, each of
   which produced 187 false findings first: strip block comments over the WHOLE file (this
   codebase's jsdoc is prose full of "the position it is at (x, z)"), and method shorthand
   is not anchored to a line start (`toast() {}, shake() {}, sfx() {}` is one line in
   main.js). Validated by reintroducing both real bugs rather than trusted on a green run.

**Two things worth knowing before extending this.**

- **The wake rollout is the other half of the feature.** A displacement channel with
  nothing opted in is a demo. `swayMesh(m, { auto: true })` takes the window off the
  geometry’s own bounding box, which is the one thing a call site gets wrong (a unit
  cylinder built centred runs −0.5..0.5 and one built based runs 0..1, and backwards
  bends the tuft into the ground). Rounded to 2 dp because lo/hi are in the program
  cache key — that is why Göreme’s 52 meshes share 3 shaders. **3 chapters → 12,
  83 meshes, 24 696 instances**, frame time unchanged, +4–17 programs per chapter.
  Left out on purpose: Antarctica has no plants, the Quay is a boat, and Venice,
  Kowloon, Monaco, Manly and Son Doong keep foliage in MERGED meshes where a
  y-window over a mesh spanning −10..+15 is meaningless. Never sway a flat card
  lying on the ground — the ramp slides it sideways instead of bending it.

- **Sydney has no biome root.** Sixteen chapters put their world under a group named for
  the biome; chapter 1 is built into `environment`. Anything doing
  `scene.getObjectByName(biome.current)` silently does nothing in the first chapter — it
  cost the echo a whole debugging round.

**Harness note:** measuring a new audio channel is impossible while the score is playing —
hooking `AudioContext.prototype.createOscillator` counted 71 music voices against 2 echo
voices. Press **N** (score off) first, then any delayed voice is the thing under test.

Related: [[capy3-under-the-floor]], [[capy3-the-mix]], [[capy3-the-lens]],
[[capy3-nine-skills]], [[headless-qa-harness]]
