---
name: capy3-three-chapters-reported
description: "capy3: the Cappadocia / Marrakech / Pasto bug sweep — a metronome in the ambience, a crowd of statues, and a bird with no fence"
metadata: 
  node_type: memory
  type: project
  originSessionId: 452efda3-488c-4968-b703-dbbc896aab77
  modified: 2026-08-23T14:23:31.072Z
---

24 Aug 2026, from a player report on chapters 13, 8 and 2. Every one of the three turned
out to be a DIFFERENT class of defect than it sounded like, and in each case the fix was
found by measuring rather than by reading.

**"AN AUDIO NOISE THAT REPEATS" WAS A METRONOME, AND THE LOG FOUND IT IN ONE PASS.**
Hook `game.sfx` and log `[t, name, volume, pitch]` for sixty seconds. Cappadocia gave:
`hiss 0.256 1.61` at 8.69, 17.17, 25.64, 34.12, 42.59, 51.07, 59.54, 68.02 — an exact
8.47 s period at parameters identical to three decimals. `gorUpdateFieldBurners` ran on
`(gorTime * 0.118 + ph) % 1` and `gorHeard` is a function of distance, so a listener
standing still hears the same sample forever. **Nothing else in this game's ambience is
periodic**; every other bed is built from `rand()`. Converted to a per-crew countdown
re-drawn from a range, plus jitter on volume and pitch. Same bug, same fix, in the herd's
bell (flat 2.41 s at pitch 1.60).

Second half of it: 26 valley balloons all firing `hiss` into the dispatcher's 1.2 s
throttle. **A throttle keeps whichever arrived FIRST**, which across 26 sources in
instance order is a coin toss — so the burner you heard was never the one you could see.
Collect candidates per frame, fire the LOUDEST, and rate-limit at the source. 40 hisses a
minute became 11.

And `ph: c * 2.1 + 0.4` was meant to spread five crews round the cycle: 2.1 mod 1 = 0.1,
so it put all five inside a 3.4 s volley. Use the golden ratio for any "spread n things
round a cycle" seed.

**"NPCS YOU CAN WALK THROUGH" — merged crowds never got what npc.js's locals did.**
`addLocal` grew a rigid body a while back; `gorFigure`/`sahAddPerson`-style merged and
instanced crowds did not, in any chapter. Fix keeps the crowd as geometry: record each
figure's position while the mesh is being built, then one mass-0 box each afterwards
INSIDE the chapter build so main.js's capture tag owns them. Seated figures need a short
box on the seat, or a man on a stool becomes a 1.7 m invisible wall.
**Marrakech's 173 were deliberately left walk-through**: the pursuers are not physics
bodies, so solid market-goers would be a wall for the player and not for the men chasing
them. Consistency is not worth an unfair chase.

**"THEY DON'T ANIMATE" WAS TRUE AND THE CODE LOOKED FINE.** sahUpdatePeople had a bob and
a sway on every person. Measured in pixels — world-space delta over 0.7 s, divided by
distance, times `(H/2)/tan(fov/2)` — the median visible person moved **0.58 px**. The
amplitudes were defensible; the RATES were 27-second periods. A bigger sine is the wrong
answer (seaweed); people stand still and then move. A per-person decision clock
(`rand(2.6, 8.5)` s, then a damped quarter-turn onto the other foot) took it to 95 of 99
visible people clearing 2 px inside a 12 s window. **Measure crowd life in pixels at the
chapter's own camera distance, never in metres.**

**"DROPS YOU OUTSIDE THE MAP" IS NOT A FALL.** capybara.js's soft floor holds the animal
at `terrainHeight(x,z) + capyFOOT_Y` whether or not a rigid body is there, and every
chapter's terrainHeight is an ANALYTIC law that answers for the whole plane. Dropped at
(-300, -95, -300) in Pasto the capybara does not fall — it stands on the analytic
hillside at y = -18, four hundred metres outside the last heightfield strip, in the fog.
So a "below the world" guard is nearly dead code; the honest test is the RECTANGLE.
Pasto's collision is x ±132, z -130..134 and its visible mesh is ±130, while Galeras
(centre z = -70, radius 70) has its own apron ten metres past the north edge — so flying
up the volcano aims you straight at it. Three fixes: `pasto.bounds()` published;
`condorFence` kills the OUTWARD velocity component past it (a wall you lean on, not one
you hit — it never touches the tangential speed); and `backVoid` in systems.js rescues
anybody outside a chapter's published bounds. `bounds()` is optional, like `camFloor`.

**A THIRD-PERSON CAMERA WITH NO OCCLUSION TEST, IN SEVENTEEN CHAPTERS.** In the Marrakech
souk the eye sat at y = 7.6 with the roof mats at 6.6: above the roof, looking at the top
of it, animal not on screen. Two halves, and the first one does not work on its own:

- **`camCeil(x, z)`**, camFloor's mirror. The roof is RENDER-ONLY geometry — no body to
  ray against, and there should not be one — so the chapter says where its roofs are.
  The relief lift (raise the eye clear of the ground) is exactly wrong indoors.
- **One physics ray a frame**, anchor → desired eye, which may only SHORTEN the boom.
  Skips heightfields and planes (terrain is already handled by the lift, and doing both
  makes the camera breathe on rolling ground — so this can only ever change what happens
  inside a building), anything with mass, triggers, and the animal's own carrier.
  `skipBackfaces:false` matters: the eye is often already inside the wall. Cost measured
  at **2.5 microseconds**, 0.015 % of a frame.

Harness notes: `process.env` is not readable inside a playwright `run-code` script — bake
the value in with sed. A 17-chapter sweep in one script is unreliable (chapters silently
come back as the previous one); one chapter per invocation, `reload` + 5.2 s, is not.
An InstancedMesh with no `.name` is invisible to any audit that walks the scene — name
them (`sahPeople`, `sahPeopleHeads` now are).

Related: [[headless-qa-harness]], [[capy3-put-me-back]], [[capy3-the-locals]],
[[capy3-solid-or-drawn]], [[capy3-things-that-are-simply-there]], [[capy3-shared-module-blindness]]
