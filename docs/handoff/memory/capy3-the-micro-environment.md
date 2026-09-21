---
name: capy3-the-micro-environment
description: "The weather.js pass — the mood table, and the five things that measured wrong before they measured right"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7f32c2af-ca9f-4dd7-9a7f-c989d5c37c1d
  modified: 2026-08-23T08:36:45.528Z
---

23 Aug 2026. `src/weather.js` (prefix `wx`), publishing `game.weather`, runs after every
biome and before props/capy/npc/systems. It is the seventeen-chapter micro-weather layer:
a mood row per chapter, four zero-centred signals (drizzle, cloud, pulse, gust) on top of
whatever the chapter already looks like, two instanced emitter fields, and readers in
systems.js, capybara.js and npc.js.

**The design rule the whole thing turns on: it may make an hour WEATHER, and it may not
make it a different hour.** `lock` ('midday', 'night', 'predawn', 'interior', …) is a
LABEL — nothing computes a light from it. Every signal is centred on zero, so `wxBASE`
(the all-zero row a chapter with no entry gets) is a bit-for-bit no-op: sunK/hemiK/fogNK/
fogFK exactly 1, amb/hazeMix/bgMix/bloom/slip exactly 0.

## The five things that measured wrong first

1. **`transparent: true` + `side: DoubleSide` makes three draw the mesh TWICE** — back
   faces, then front faces, to sort transparency within one object. A field of 150 motes
   cost 2 draw calls and 600 triangles instead of 1 and 300. You will never find this by
   reading the code. Opaque, or transparent+FrontSide, costs half.

2. **A draw-call delta must be measured between two ADJACENT frames with one thing
   changed.** Comparing a dry frame with one ninety seconds later reported +113 calls in
   Kowloon — ninety seconds of Kowloon is a Symphony cue, two buses and a crowd. The tell
   was Sydney reporting MINUS six in a chapter where it never rained. (And `autoReset =
   false; reset(); one tick; read` — reading straight after `tick()` returns 1.)

3. **`wetness()` is not `shine()`.** Anything that changes how a chapter PLAYS or how it
   was TUNED to look must key off wetness ABOVE that chapter's baseline. Son Doong's floor
   is wet limestone at 0.52; keying slip off the absolute handed a shipped chapter a
   permanent 0.20 of slide. The one exception is the footstep splash — characterisation,
   not play or grade. See [[capy3-external-forces-on-the-capybara]].

4. **`cold` cannot be inferred from `lock`.** "The dark chapters are the cold ones" is true
   in sixteen places and wrong in Antarctica, which is locked to 'midday' because it IS
   midday there for four months. Measured: huddle 0.00 in a 4.4 m/s katabatic wind while
   Reykjavik, warmer, sat at 0.89. A rung inferred from a different table is a rung waiting
   to be missing. See [[capy3-shared-module-blindness]].

5. **A rain streak points the way it falls, via `setFromUnitVectors`, and is a BOX.** Built
   from Euler angles on the shared quad every drop lay flat and the first shower rendered
   as white tally marks hanging in the air. A petal tumbles so a folded quad always has a
   face turned somewhere; a raindrop is welded to the fall vector, so an edge-on ribbon is
   simply not there.

Also: wetness must SATURATE at the shower's intensity (integrating a rate made Sydney's
lightest sunshower wetter than Kowloon), and the emitter box sits IN FRONT of the lens —
centred on the camera it spends half its instances behind the near plane.

## THE GUST IS NOT `wind()`

`wind()` is **the air as a reference frame**, a chapter-owned mechanic feeding
`platVX/platVZ` beside a ferry deck and a balloon basket. Adding weather.js's ambient gust
to it would slide the capybara across Jemaa el-Fnaa at walking pace with nobody touching a
key, and would fight the one system Cappadocia IS. The gust drives motes, the rain's lean,
the wind bed and which way locals turn — never the controller. See
[[capy3-reference-frames]] and [[capy3-external-forces-on-the-capybara]].

## Scoping note that will come up again

Locals are FIXED POINTS — no nav mesh, no destination. "NPCs gather under shelter" needs a
nav graph in fifteen chapters plus shelter points in fifteen biome files. The huddle pose
is the honest version. And Sydney's/Pasto's richer cast is drawn as instanced boxes, one
InstancedMesh per body part, so a per-person prop (the umbrella) is a whole new buffer and
draw call rather than a mesh you can add — which is why umbrellas are locals-only.

QA: `qa/wx-swing.js` (does the hour still read), `qa/wx-surface.js`, `qa/wx-perf2.js`
(adjacent-frame cost), `qa/wx-frame.js` (rAF frame time), `qa/wx-fuzz.js` (the stock fuzz
with odds forced to 1 — the stock one never sees rain). Cost: +1 call/~300 tris dry, +2
calls/2.5-3.8k tris at the heaviest shower, frame time unmoved at 16.6-16.8 ms median.

Related: [[capy3-the-picture]], [[capy3-the-locals]], [[headless-qa-harness]],
[[capy3-springs-are-clipped]]

## The wet ground is in `grain()`, not only in the grade

Closed the same day. Expressing a wet street ONLY through the composite pass fails in
chapters without lights: a lowered bloom threshold needs something bright on the ground to
bite on, and Kyoto's grass and Venice's stone were exactly as light wet as dry. The wetness
was in the lens and not on the floor.

`wetTick(shine, hemiColour)` sets two shared uniforms (same trick as `grainTick`), and
`grain()` darkens the diffuse and adds a grazing-angle sheen. Three things worth keeping:

- **Gated on `vGrainN.y` squared** — water lies on TOP of things. Measured in Mong Kok at
  full wetness: road −15 %, vertical shop front −0.6 %. That gate is most of what makes it
  convincing, and a per-mesh flag would have been the only alternative.
- **Not applied to water** (`spark > 0` is the existing "this is a sea" marker).
- **Sheen colour comes from the hemisphere**, so it reflects whatever sky the chapter is
  under, and every atmosphere event moves it for free.
- The world normal comes from the EXISTING `begin_vertex` hook — `objectNormal` is defined
  by `<beginnormal_vertex>`, which three emits before `<begin_vertex>`. No second hook.

And the adjacent-frame lesson bit twice: a first attempt compared captures 25 s apart and
reported Kowloon 59 % BRIGHTER when wet, which was the Symphony of Lights.
