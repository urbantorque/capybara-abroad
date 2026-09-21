---
name: capy3-fifth-pass-thirteen-fourteen-fifteen
description: "The 24 Aug 2026 pass over capy3 chapters 13, 14 and 15: a basket with a lid on it, a task you could not finish if you stepped on in the middle, and a cap that truncated a whole chapter geographically"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-24T01:24:20.126Z
  originSessionId: 975f9639-41e4-4456-a69a-f7912efc5ae5
---

Done 24 Aug 2026 over Göreme (13), Manly (14) and the Pantanal (15). All three had
had two to four passes already, so the shape of this one is different again: **the
things still wrong were things NOBODY HAD PHOTOGRAPHED FROM THE RIGHT CAMERA, and
one class of arithmetic bug that was in all three files at once.**

## THE MARQUEE OF CHAPTER 13 HAD NO CAPYBARA IN IT

`gorBuildBalloon` finished the basket with
`M.box(0, h + 0.06, 0, w + 0.16, 0.12, d + 0.16)` — meant as the coping round the
rim, drawn as **a solid three-metre-square slab across the top of it**. The
chapter's flight rig (15 m back, 0.62 rad) exists precisely because it looks DOWN
into the basket, so for the whole life of the chapter the marquee of Cappadocia
was a black rectangle with a flame poking out of it. Measured: capybara 0.58 m
above the balloon datum, coping at 0.68. It never once cleared the lid.

A coping is a RIM — four bars. Same silhouette from the ground, where a rim and a
lid look identical, which is why it survived four passes: **nobody had taken the
shot from the chapter's own rig.** Second time this codebase has shipped "a basket
with a lid on it".

Two more in the same frame while it was open: the burner's `emissiveIntensity`
(0.85) washed the envelope's eight red-and-cream gores into one flat orange dome —
holding E painted out the thing the bag is made of, so 0.50 and the extra went into
the flame. And the basket floor was one dark box: it is pale wicker with three
courses across it and four corner posts now, because from that lens you are looking
straight at it.

## A SPAN, NOT A DISPLACEMENT FROM WHERE YOU STEPPED ON

`the-envelope` ("Walk an envelope, end to end") anchored on the point of first
contact and asked for eleven metres of travel away from it, on a fabric run whose
test band is `|along| < 7.6`. **Step on anywhere in the middle seven metres and the
task is arithmetically impossible** — 7.6 is not 11 and never becomes 11 however
many times you walk up and down. The only escape is to leave the fabric entirely
and step back on at an end, which nothing tells you.

Differential, same script both ways: **old code fails 13 consecutive headings, new
code fires on the first.** Track min/max of `along` while on the same crew and test
the SPAN — it cannot dead-end, it does not care where you got on, and up-and-back
counts the same as up, which is what a crew checking for tears does anyway.

**Generalises: a "travel N from where you started" test on a bounded domain is a
trap whenever N > half the domain.**

## A CAP MUST NEVER BE A `break` ON A SPATIAL SWEEP

The Pantanal's grass loop, for the third time. The previous pass fixed "the seed
counter and the instance counter are the same number" by moving the seeds onto a
jittered grid — and left `n < N` tested inside all three loops. The grid is 35 × 33
cells at 4–8 tufts, which wants ~6,300 against a ceiling of 4,600, so the sweep
filled cells in `gz` order and **stopped twenty-four rows in, at z = +42.**

Everything north of that line had no grass at all: the whole top third of the map,
containing the spawn (z 62) and the fazenda (z 76). Photographed from the fazenda:
**six tufts in the entire frame.** Converting a random 4× shortfall into a
deterministic geographic cut-off made it worse, not better. Budget PER CELL, size
the pool for the whole grid, trim with `mesh.count`.

## ONE BUG IN ALL THREE FILES: `damp()` DOES NOT KNOW ABOUT CIRCLES

`yaw = damp(yaw, Math.atan2(dx, dz), k, dt)`. damp is a plain lerp; atan2 returns
(−π, π]. Cross due south and the error flips from +3.14 to −3.14 and the thing
takes **a full turn on the spot, at damping speed, every time.** Cappadocia's chase
truck found this once and wrapped it by hand in 2026-08; nothing else did, and
there were seven more:

- **The Pantanal's follower herd** — nine capybaras walking the player's own trail,
  spinning on their own axes every time the player rounded a corner through south.
  That is the marquee's own actors.
- Manly's **blue groper**, which swims a closed circle, so it crossed twice a lap
  for ever, in front of the one task that asks you to go and look at it.
- The Pantanal's cattle turning to look at you, its jabiru turning to face the
  nest, its anteater turning to face a mound.

`dampAngle(cur, want, lambda, dt)` in **shared.js** — one line of arithmetic, and
it belongs there rather than in seven files. Grep `rotation.y = damp` and
`yaw = damp` before adding any new turner.

## THE OTHER RECURRING SHAPES, ALL FOUND AGAIN

- **`x % P < dt` is a window on a variable clock.** Named and fixed in the Antarctic
  skua and the Pantanal otters; still live in Manly's dolphins, the Pantanal's
  jabiru and its macaws. Countdown redrawn from a range, always.
- **`game.record()` TOASTS AND CHIMES on every improvement**, so calling it per
  frame on a climbing value fires a personal best sixty times a second. Named and
  fixed on the Pantanal cowbird; still live in Göreme's `three-winds`, where a burn
  from 12 m to 200 would have thrown ~11,000 toasts through the chapter's marquee
  on any second visit. Bank the peak, report once when the flight ends.
- **A kinematic carrier's `prev` position must be reset in onEnter.** `gorBasketPX/
  PY/PZ` still held wherever the last flight ENDED, so re-entering the chapter
  handed the contact solver a basket doing about nine thousand metres a second for
  one frame.
- **A moving floor must DECLARE its frame.** The bell mare — 6.2 m/s horizontally,
  ±9 m/s vertically over the launch-field ramp — was relying entirely on
  capybara.js's contact sniff, and the 11-second ride timer was zeroed by a single
  blank frame. `carryFrame()` plus a 0.45 s grace.
- **A landmark getter returns a shared scratch.** Fourth time; it cost two failed
  probe runs here (`P.caiman()` held across 480 ticks while the hint arrow rewrote
  `panV3b`). Snapshot on read, in probes as well as in code.

## THE TASK THAT COULD NOT BE FAILED

Göreme's chase truck drove to `(gorBalX, gorBalZ)` — the balloon's CURRENT position
— at 9 m/s, and the fastest wind in the chapter is 3.8. So the trailer was directly
under the basket for every second of every flight and `on-the-trailer`, the last
task of the chapter with a distance record attached, completed by letting go of E.
**A task you cannot fail is not a task, it is a delay.** The aim point is a
PREDICTION now (wind × time-to-ground), damped by `gorCHASE_LAG` so a change of
layer buys four seconds of the truck going the wrong way, and his speed falls off
with the slope under the wheels. Still always coming, so it still cannot be
unwinnable.

## AND `praise` / `onTask` HAD NO CONSUMER IN ANY OF THE THREE

npc.js fires the nearest local on `task:complete` and takes `onTask[id]`, then
`praise`, then a chapter-neutral fallback. Nine chapters name their own. **These
three named none** — so the reward for moving the flags on Manly, the largest
consequence any button press has in this game, was a stranger saying
"…was that deliberate?" Twenty-five people now have their own pools.

Same shape one level up: **Göreme had never called `game.say()`** (Manly and the
Pantanal got theirs in the fourth pass), which is the chapter that needs it most —
you spend two minutes suspended above people you cannot walk up to, and a voice
from a point on the ground is the only thing up there that tells you how fast you
are moving. Nine caused lines. And Manly and the Pantanal threw away every
`addLocal` return, so nobody in either could be told anything: `manLocals` /
`panLocals` and a `SaysNow` in each, on the pattern Göreme has had since it shipped.

## SMALLER THINGS WORTH NOT RE-DERIVING

- **A beach is not a scatter, it is a field of camps.** 22 towels and 6 umbrellas at
  independent `rand()` over 120 m is one lonely object every four metres. Sixteen
  FAMILIES — two or three towels at slightly different angles, a bag, two thongs
  kicked off apart, an esky, and an umbrella that is never vertical — reads as a
  full beach for the same geometry. Also: **a beach towel is 0.9 × 1.7 m**, not the
  1.5–2.1 × 2.4–3.2 that was there, which is a double bed.
- **A footprint is a hole, not a tile.** Seven tracks of 16 × 27 cm boxes drawn 12 mm
  PROUD in `manSandWet` at a 52 cm pitch photographed as two rows of pale stepping
  stones. A stride is 73 cm, the prints are a staggered pair 20 cm apart, and what
  you see of one is the shadow IN it: sunk 8 mm, in the shadow tone.
- **A surfboard is a taper, not a box with a dart on it.** Three boxes — narrow tail,
  wide middle, narrow nose — reads; a plank plus a cone is a lawn dart.
- **`cone()` takes a RADIUS and doubles it.** A 1.42 gave a 2.84 m beach umbrella,
  and a contrasting cone inside the canopy makes every one of them a dartboard from
  the only angle this game's camera ever looks from.
- **Duckweed on open water is the Göreme wash-channel mistake on a different
  surface**: 1.6–4.4 m quads in a pale green over an olive bay is forty lime
  RECTANGLES. Small enough not to be resolved (0.4–1.15 m), close in value, and
  OVERLAPPING, or the patch is visibly made of pieces.
- **A ground detail's job is to stop being counted.** Göreme's plaza setts went 1.05 m
  → 0.62; Manly's wind ripples 0.8–2.1 m → 0.5–1.15 at twice the count; its wrack
  line 0.7–2.2 m of saturated `manKelp` → 0.22–0.72 m mostly in sand tones. In all
  three the fix was smaller and more, never fewer and bigger.
- **A worn line across a square has no edges.** Twenty-two 2.6 × 2.2 m quads of
  `gorSoil` nose to tail is a painted stripe; sixty small patches on a wandering
  centreline that thin to nothing at both ends is wear.
- **A control that stops working must say so.** Göreme's `gorCEIL` silently disabled
  the chapter's only lever.
- **A set piece that is a NOISE is worth walking into twice**; a set piece that is a
  TICK is not. `the-mouth` returned early on `gorMouthDone`, so the only interior in
  the chapter went silent the moment its box was ticked. Manly's bommie ticked in
  silence — a wave detonating on a rock you are sitting on now does so every time.
  Manly's sandcastle `visible = false`'d out of existence; it leaves a heap.
- **The marquee needs a clock the player can read.** Cappadocia's sunrise gave one
  toast twenty minutes out and then two silent minutes. Every decor balloon burns
  together over the last twelve seconds, staggered by index so it crosses the sky as
  a wave — which is what those crews actually do, and is a countdown legible from
  the ground, which is the player it is for.

## NUMBERS

Triangles: Göreme **199,294 → 206,206**, Manly **72,234 → 88,342** (+22 %, and it was
the underinvested one by a factor of three), Pantanal **212,162 → 226,260**. Bodies
unchanged in all three (102 / 97 / 92). `audit-tasks` 0 blockers over 199 tasks.
3 × 180 s random-input fuzz: no NaN, no void falls, `state.lastError` null. 99 s
real-clock soak with audio unlocked across all three: **zero console messages.**
Frame time 3.3–4.9 ms median / 4.4–5.8 p95, against an untouched Pasto at 4.0 / 4.9.

**Probe trap worth remembering:** `biome.switchTo()` does NOT move the capybara —
only `biomeGo()` does. Every hand-driven probe lands the animal at whatever
coordinates it was already at, in the new world. Two of this session's screenshots
were of the wrong place before I noticed.

Related: [[capy3-fourth-pass-fourteen-fifteen]], [[capy3-third-pass-twelve-thirteen]],
[[capy3-second-pass-twelve-thirteen-fourteen]], [[capy3-the-herd]],
[[capy3-the-sea-has-a-shape]], [[capy3-dive-and-balloon]], [[capy3-the-locals]],
[[capy3-the-middle-rung]], [[capy3-catch-all-state]], [[headless-qa-harness]]
