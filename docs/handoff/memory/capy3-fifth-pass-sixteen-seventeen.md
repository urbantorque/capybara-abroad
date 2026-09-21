---
name: capy3-fifth-pass-sixteen-seventeen
description: "The fifth pass over capy3 chapters 16 and 17: a camera floor measured in world Y, a stalagmite nobody could climb, a task with no object, and a colony standing on clean plaster"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f5874f1-bcbf-4d7d-9f44-3f55e90277eb
  modified: 2026-08-24T04:03:42.909Z
---

Done 24 Aug 2026, a deep pass over Sơn Đoòng (16) and Antarctica (17), after
[[capy3-fourth-pass-sixteen-seventeen]]. That pass was about things that were
described and not built. This one kept finding the same thing one level down:
**a feature that is built, correct, and cannot be reached — by the animal, by
the camera, or by the eye.**

## THE CAMERA FLOOR IS A NUMBER ABOUT SEA LEVEL, AND CHAPTER 16 IS NOT AT SEA LEVEL

`sysCAM_FLOOR` is **1.7 in WORLD Y** and the contract's own note has always
said it "is right for every chapter whose ground is at zero and wrong for the
one whose ground is at minus eleven". Sơn Đoòng's floor runs +4 at the spawn,
−6.3 under the doline, −7.4 in the river, −10.5 at the foot of the Great Wall.
**Measured standing in the marquee at (−4, −40): capybara −6.31, eye 1.70** —
the clamp exactly, so the lens rode eight to twelve metres over an animal it is
supposed to sit six behind, everywhere, for the whole chapter. Palawan
published `camFloor` for exactly this and was the only chapter that ever had.
`camFloor = cavTerrain + 1.1` and `camCeil = cavRoofH − 1.8` (the roof was
RAISED to 27 m in an earlier pass to work around the missing hook).

**AND THE CHAPTER LOOKS UP NOW.** Every vertical thing in it — a hole 140 m
across, 210 m of shaft, a 200 m fall, an arch with a cloud coming out of it,
the slot — is ABOVE the animal and the rig looks 41° DOWN. `skyward()` has
existed since chapter 7 and only Iceland ever asked. 0.92 in the doline, 0.34
at the slot, 0.40 under the arch, and zero while climbing/swimming/on the log.
The marquee went from a photograph of some ferns to a jungle glade with the
rim, the canopy, the shaft and the Hand of Dog in the frame.

## THE HAND OF DOG COULD NOT BE CLIMBED, AND NEVER COULD

'Top out on the biggest stalagmite'. Nine ledges, `base + 1.0 + k * 2.45`.
**Measured: a capybara's standing hop in this chapter is 1.09 m.** The second
ledge of nine was unreachable by every verb the animal owns; nothing here
publishes `climbHold` but the Great Wall; and the trunk collider was ONE BOX
(7.0 half-width) for a cone that tapers 7.5 → 1.6, so the top four ledges were
buried in five metres of invisible rock as well.

Three attempts, and the third is the lesson:

1. 32 shelves at 0.78 — inside the hop, and it failed anyway: **a spiral of
   two-metre discs at a fixed angle per step OVERLAPS ITSELF at the top**,
   where the spire is two metres across. The animal stood on shelf 24 with
   shelf 25 seventy-eight centimetres over its head and could not stand up.
   **A helix has to be checked for HEADROOM as well as for rise.**
2. A ramp of 120 segments, collided every OTHER one: 1.6 m boxes 1.9 m apart is
   a thirty-centimetre hole in the floor between each pair, and it fell off on
   its fourth step. **A ramp made of discrete boxes has to have them OVERLAP.**
3. And the trunk octagon must be sized from each level's TOP, not its middle —
   sized from the middle the corner is fatter than the flank over the upper
   half, so once a turn the animal walked into invisible rock and was pushed
   off a shelf twelve metres up (it made a third of the way, then fell 3.2 m,
   which is one level).

Final: 120 segments, 0.20 rise, 0.95 chord, all collided, 3.56 turns, 114 m of
walking for 24 m of height, 12°. **You walk it.** A box collider for anything
round is two boxes at 45° — 1.082 of circumradius instead of 1.414 — and
`cavPoolBox` takes a yaw now, which cannon's `addShape` always accepted and
this helper threw away.

## 'FIND THE GARDEN THAT LEANS' HAD NO OBJECT, AND THE ARROW POINTED INTO THE RIVER

`cavPHYTO` was (−12, −34). The river is `cavRIVER_X` −20 ± `cavRIVER_W` 15, so
it occupies x ∈ [−35, −5] — the landmark was **eight metres inside the river**,
the tick fired while swimming, and there was nothing built there at all: the
note by the doline wood says the leaning trees are "also the answer to the
phytokarst line", and they are twenty metres away and are trees.

Moved to (15, −28), on the east rim, and built: 104 rock fins, **green on the
face that points at the hole and bare grey on the other**, every one aimed at
the middle of the doline, so the field is a compass needle for a light you
cannot see yet. And it got a verb — a wheek in it puts a cloud of spores in the
air, lit by the shout that made it, and that is the tick.

Two sizing lessons, both already in this codebase: 0.35–1.15 m fins photograph
as **green confetti** (the flat-mark rule again — a blade seen from 40° is only
a blade if it is tall enough to present its face), and a fin in `cavRockDk` at
ambient 0.11 is a **black slab**; the unlit side of a blade is pale limestone
and it is the CONTRAST that carries the read.

## AND THE DOLINE'S BREAKDOWN WAS DRAWN THREE TIMES TALLER THAN IT WAS SOLID

Drawn `s * 0.44`, collided `s * 0.15` half-height: a block standing a metre and
a half out of the floor was a knee-high kerb to everything that reasons about
the world. systems.js pulls the boom in when a BODY is in the way, and there
was no body — the clearance ray sailed over the collider and the mesh filled
the frame. Drawn at the height it is collided at now, plus **nine proper
boulders out at the rim**, which are solid, are worth going round, and are
behind the lens rather than between it and the animal.

## ANTARCTICA: FOUR THINGS THAT WERE IN THE PALETTE AND COULD NOT BE SEEN

**The colony stain**, for the third time. It was `1 - d / (r * 1.35)` — LINEAR
from the exact centre — so a bird nine metres out sat on gk 0.45, and after the
power and the blotch that is a quarter of the way from snow to brown. Sampled
off the ground mesh: **(0.675, 0.721, 0.723) nine metres out and (0.722, 0.783,
0.792) at the rim.** That is white, twice. And the penguin highway starts AT
`antCOLONY` exactly, so a five-metre stripe of `antIceSh` was painted OVER the
strongest part of it and never repainted — the centre carried (0.448, 0.558,
0.614), which is ice-shade. **A colony stain is not a radial gradient**: it is
flat across the ground the birds stand on and it stops, raggedly, where they
do. Plateau to `r * 1.52`, 9.5 m of lobed edge, blotchy at two sizes, and the
track goes UNDER it.

**The leopard seal** was `antSealHide` 0x6d7a79 — 0.43 albedo, and this
continent saturates anything over about 0.25. The one alarming animal in the
chapter was the colour of the brash it was swimming through. 0x323d3f.

**The chorus was a wave in the mix and a flashbulb in the picture.** Three
calls at 0.10/0.55/1.25 s spread outward beautifully; what the eye saw was one
probability applied to all 174 birds, so the whole rookery threw its head back
on the same frame. One front from wherever the noise came from, 13.5 m/s, with
a 17 m tail behind it — and the local's "do it again, I want to see if it goes
all the way up the hill" is a promise the picture keeps now.

**And the spy-hop toast fired twelve times.** `antSpyT > 1.2 && antSpyT < 1.4`
is a 200 ms window on a 60 Hz clock. `completeTask` is idempotent; `toast` is
not, and it keeps the last four.

## 'SIT DOWN INSIDE THE WHALE' WAS UNCOMPLETABLE AT THE POINT THE ARROW AIMED AT

MEASURED at the exact centre of the skeleton: inZone true, `sp` max 0.17, y 5.95
over a waterline of −0.6, held for 8.5 s — and it never ticked. Cannon is
ejecting the animal from the spine collider on every step, `antUpdateTasks`
runs on the far side of that step, and capybara.js damps the ejection away
before anything else can see it. **A speed gate read after the solver is
reading the solver's own shove.** The landmark moved 2.8 m off the backbone
into the rib cage, and the gate went 0.6 → 1.2 m/s.

## WHAT ELSE WENT IN

Chapter 16: swifts spiralling the whole 200 m down inside the column and leaves
falling through it (both silhouettes — the only kind of detail that survives
being drawn against the brightest surface in the chapter, and both only
readable at all because the rig cranes now); the seven locals given `onTask`,
`praise`, `after`/`before` lines and cave-register reaction pools (the surveyor
who says "do not take the pearls, everybody takes the pearls" now has a
different line once you have, and the man at the entrance stops explaining what
your voice is for once you have found out); and **ACTS** — THE MOUTH / THE
GREAT PASSAGE / THE FAR SIDE, which is the most literal three-act shape in the
game and was a flat list of twelve switches.

Chapter 17: the leopard seal became an ENCOUNTER — she watches for two seconds,
slides off the pan, shadows you at 5.6 m abeam, surfaces on a 4.6 s cycle with
a **trapezoidal** hold (a triangle is not a surfacing; this sea is opaque and it
is the same trap the pod fell into), breathes each time she comes up, and gets
bored after thirty seconds; `seal()` reports HER now and not the pan; she
re-hauls on the nearest floe, because her own is on the same conveyor that
recycles 480 m north; and her pitch is `YXZ`, because default XYZ applies the
pitch about the WORLD x axis after the yaw and a seal heading east came up
rolled onto her side. Six locals got the same dialogue treatment.

## MEASURED AFTER

`qa` fuzz clean on both (no NaN, no void falls, no console errors, no
`lastError`, maxTele 0.21/0.18). Real-time playwright soak with trusted keys
and unlocked audio: zero console messages. Kinematic audit: zero teleports,
nothing out of the world. Solidity **cave 4 → 2**, antarctic 4 (brash in open
water and the bastion talus, both pre-existing). `audit-tasks` 0 blockers over
199 tasks. All thirteen locals speaking, conditional lines resolving.

**Every task in both chapters verified completable by script**, including the
two that were not: `hand-of-dog` (walked the ramp from the floor, ticked at
y = 20.1) and `whale-bones`. `great-wall` needs E HELD against the face —
`wantCling = !!hold && input.action` — which is not a bug and cost twenty
minutes to rediscover.

Related: [[capy3-fourth-pass-sixteen-seventeen]], [[capy3-the-dark]],
[[capy3-the-pack-and-the-pod]], [[capy3-solid-or-drawn]], [[capy3-the-locals]],
[[capy3-render-pose-heuristics]], [[headless-qa-harness]]
