---
name: capy3-lift-pass
description: "The 11 Sep 2026 lift pass — the camera showed the pavement not the place, every task was compulsory, and two undeclared identifiers had killed a whole audio batch"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbc9a4f1-1306-42b5-8c21-f24830c119dc
  modified: 2026-09-10T15:50:47.095Z
---

Branch `lift-pass` off `depth-tier1`, fifteen commits (L1-L11 plus a verification and
three documents). Full write-up is **ROADMAP-LIFT.md**. Six review agents ran in
parallel over the whole tree before a line was written, and two findings came
back independently from more than one of them.

## THE TWO FINDINGS

**1. THE FRAME HAD NO PLACE IN IT.** The horizon's height in the picture is
`tan(pitch)/tan(halfFov)` in NDC and depends on nothing else, so it is exact
rather than judged. Measured on the live camera, eighteen chapters: walking
pitch 28–39° with the horizon at 1.05–1.80 (off the top edge); settled 22.8°
with the horizon at 0.94 — three per cent down from the top. **Sky 0.0% in 18
of 18 in both states.** Venice between the two columns of San Marco was grey
flagstones and two column stumps.

[[capy3-the-second-beauty-pass]] measured the same 0% and concluded that clouds
in twelve skies would never be seen, so they were not built. **That is the
inference to watch for**: the conclusion to draw from a game whose frame has no
sky is not that skies are worthless.

The fix used numbers already in the file. `sysARRIVE_PITCH` is 16° and had been
validated on nineteen arrival PNGs — the game knew its good shot, showed it for
3.6 s, then eased back to the floor plan for forty minutes. `sysCAM_PITCH`
41→34, `sysREST_W` 0.55→0.80, `sysREST_T` 1.5→1.0. Settled pitch 22.8→11.2,
horizon 0.94→0.44, **animal on screen 19/19 walking and 19/19 settled**, boom
cut 1.00 in 18/19. Everything else in the pass compounds with this: the
lighting, the people and the sound now happen somewhere visible.

**2. FINISHING A CHAPTER AND BEING ALLOWED TO LEAVE IT WERE THE SAME QUESTION.**
`jrOpen` gated on `chapComplete`, which demands every row, so all 232 tasks were
compulsory. The fix is a SECOND predicate, never a weaker one: `chapEnough` is
the marquee plus seven rows in ten, and `chapComplete` keeps the souvenir, the
keep, the ledger, the ceremony and the finale. 232 → 170. Verify BOTH orders —
marquee-first and marquee-last are different bargains and only one gets thought
about when it is written.

## THE BUG THAT WAS THE BIGGEST FIND

```js
f.type = lowpass;      f.type = highshelf;
```

Bare undeclared identifiers, the only two such uses in systems.js. A
ReferenceError on the line after the node was made, **inside the panner's try,
whose catch is `{ node = null; acMaster = bus; }`** — so every sound behind or
above the player lost its filter AND ITS STEREO PANNER and arrived as flat
centred mono. The whole of the A2 batch had shipped as measured-and-working.

It survived because the audit hook reported `sysSfxBack`, which is the INPUT to
the branch and was always correct — the same shape as
[[capy3-names-nothing-publishes]] and harness trap 39. Found only by widening
the branch until it fired on nearly every call.

**THE GENERALISABLE LESSON, and it saved the hour the reasoning was costing:
when a measured value is not on the curve at ANY point, stop reasoning about
the curve.** 350 Hz appeared at every distance and the floor of the curve is
780. Twenty minutes of arithmetic produced nothing; one temporary line writing
the computed values to a global answered it instantly — the maths was exactly
right, and **350 is the Web Audio default for BiquadFilterNode.frequency**,
i.e. a node created and never configured. A default value read back is the
signature of an exception between creation and configuration.

## WHAT ELSE SHIPPED

- **L1** `#err`, a raw stack-trace panel across 45% of the screen, shipped to
  players and grew without bound; `game.post.render()` was the one per-frame
  call outside the strike system, and its `finally` is load-bearing (a throw
  mid-pass left the renderer bound to an offscreen target for ever); the score's
  `setInterval` was outside every net.
- **L5** 68 finds existed and the game never said so. One italic line —
  *two things nobody mentions here* — a COUNT, never a name and never a place,
  asserted against thirteen words from the finds' own text.
- **L6** `accentInk` (4.62:1) existed and was used at ten sites, all on the
  title card; `accent` (2.28:1) was still the text colour at 25 in-play sites.
  `qa/uicontrast.js` measures the title card, which is why it never caught it.
- **L8** 760 people got a knee, an elbow, an ankle and shoulder counter-rotation
  for +4–6% draw calls. Knee on `max(0,-cos(phase))²` — bending on the stance
  leg reads as a limp, so measure it (0.07 rad across all of stance).
- **L9** the ending's five witnesses were all strangers. THE TRAVELLER already
  existed in four chapters with a fixed palette and their arc simply stopped;
  they are now on the lawn. Built on `finale:staged`, NOT in sydney.js, or they
  would be standing there in the first minute of a new game.


## TWO MORE THAT SHIPPED

- **L10, a thrown prop that hits somebody.** The gate that matters is that
  `releaseTime` is the WRONG mark — it is stamped by set-downs, npc fumbles and
  the Pasto stall collapse too. A new `thrownT` is stamped only on a launch
  impulse and is SPENT on the first person struck. Differential over 80 throws:
  peak flinch 7.62 -> 20.97 in Marrakech, rule firings 0 -> 18. The baseline is
  not zero, because npc.js has answered bangs since v33; its ceiling is 8.1.

- **L11, and it is the lesson worth keeping: A LATCH, NOT A SCALE.** L2 put the
  boom out to 12.5 m and in a tight place there is nothing to put it into —
  cutting the boom drags the eye up the boom axis, so a blocked crane ACHIEVES
  26 degrees instead of 11 and the frame is the back of the animal head.
  Scaling the ask by camClearF is the obvious fix and it OSCILLATES on a
  five-second cycle, because the crane retracting is what clears the ray that
  cut it. A latch has no path from the crane position back into the ask. Both
  its numbers were wrong first and both came from LOOKING: quay 0.15 bad,
  kowloon 0.38 bad, antarctic 0.53 good, so the threshold is 0.48. Wide shot
  delivered 19/19 after.

  **This is also the argument for looking at every frame rather than the
  table.** L11 exists because I opened all nineteen sweep PNGs; the numbers for
  quay and kowloon were in a column I had already read past twice.

## TRAPS PAID FOR AGAIN

- **Trap 40, and it nearly produced a fix for a working feature.** The rest lens
  measured as dead in all nineteen chapters because `state.started` was false
  for the whole sweep — `hud.cross()` and body writes work perfectly without it.
  Assert `started` in the probe's own output, not just at the top.
- **A frame histogram cannot resolve a small lighting term.** Two runs walk the
  animal to slightly different places and the framing delta swamps it. Iceland's
  frame improved most on every statistic and Iceland's light did not move at all
  (its authored override wins), which is the proof. **The controlled instrument
  for a light is the light.**
- **`git add -A` swept two subagents' in-progress working trees into my
  commits.** Not damaging on a branch, but use targeted paths when agents are
  editing the same tree, and expect one to be mid-`git stash` for a differential.

## NEW INSTRUMENTS

- **`qa/pnghist.mjs`** — frame statistics from a PNG, no dependencies: parse
  IHDR, inflate IDAT with node's zlib, undo the five scanline filters. This is
  the answer to trap 27 / trap 12: the canvas comes back black and a screenshot
  is already a raster PNG. Excludes the two HUD panels (opaque paper in fixed
  corners) or every frame carries the same constant error.
- **`game.gateInfo(n)`** — both chapter predicates and the id list; they live in
  the journal's closure and the only surface the harness had was the picker's
  pixels.
- **`qa/rd-onscreen.js`** — the gate for ANY camera change: is the animal in the
  picture, walking and settled, in all nineteen.
- **`qa/rd-contrast.js`** — the in-play HUD, not the title card.

## STILL OPEN

Background crowds in venice/kowloon/quay/cali are separate InstancedMesh casts
outside npc.js, still one-box, standing next to people who are not ·
`sysSFX_BACK_LP` is audible for the first time and has never been tuned by ear ·
Venice is the measured washed-out outlier (IQR 36, 54% of the frame carrying
colour, against Pasto's 49 and 94%) and its grade was tuned against a frame that
no longer exists · the wide crease octave at ~1.6 m · the theft class ("a theft
ticks when you get AWAY with it") · a hide verb.

Related: [[headless-qa-harness]], [[capy3-the-resting-lens]],
[[capy3-the-second-beauty-pass]], [[capy3-names-nothing-publishes]],
[[capy3-terms-that-cannot-bite]]
