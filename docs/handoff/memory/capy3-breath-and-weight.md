---
name: capy3-breath-and-weight
description: "R5 of the character pass: the breath, the landing settle and the tail, and the two instruments that disagreed about how big a breath should be"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f23f324-c22a-414b-bd61-cbad7fb270fa
  modified: 2026-09-06T11:05:36.296Z
---

Built 6 Sep 2026, after [[capy3-feet-and-the-loaf]]. Code: `capybara.js` BREATH,
SETTLE AND TAIL (R5). Instruments `qa/r5-body.js` (traces) and `qa/r5-see.js`
(pixels). Budget unchanged at 35 meshes / 1 436 tris. Left uncommitted with
R1-R4.

**A SAMPLING WINDOW SHORTER THAN THE IDLE CADENCE IS NOT CLEAN.** The same
loaf measurement read 23.2 mm twice and 32.5 mm once on one unchanged build:
idle act 4 DOUBLES the breath, fires every ~12 s, and the window is 9 s, so it
is caught about a third of the time. The arithmetic (0.735 m of vertex times
0.032 of scale) says 23.5, which is how the odd run was identified as the beat
rather than the breath.

**MILLIMETRES AND PIXELS ARE DIFFERENT MEASUREMENTS AND ONLY ONE ANSWERS THE
QUESTION.** Moving the breath from the hull's node to the body's halved the
peak-to-peak travel of the top of the back standing (26.7 mm to 14.7) and I
nearly retuned it back. `qa/r5-see.js` sets the squash node to a candidate's two
extremes, renders both and counts the pixels that move: at the built amplitude
**28% of the animal's pixels change, at the resting lens, where the whole animal
is 2 340 px**. A 1% scale RELIGHTS EVERY FACET, and a single-vertex travel
measurement cannot see that. Millimetres are for comparing builds; pixels are
for deciding whether a thing is visible at all. Family of
[[capy3-visibility-metrics]].

**A DAMPED CHANNEL CANNOT BE GATED INSIDE ITS OWN FILTER.** The breath's air
gate was written as part of the target of a lambda-4 damp, and the breath was
still 36% alive at the top of a hop, because a quarter-second time constant is
longer than a hop. Multiplying by `(1 - capyAirPose)` OUTSIDE the filter takes
it to 5.6%, and it is still a cross-fade because capyAirPose is itself damped.
**Anything that has to be OFF in a state that lasts under a second has to be
gated outside the filter, not inside it.**

**AND A LAGGED FOLLOWER NEVER REACHES ITS TARGET.** The head settle is a
lambda-9 follower of the landing spring (which is what makes it arrive 83 ms
after that spring bottoms out, rather than with it). Two separate corrections,
both measured: capyLand's clamp is -0.30 m but **a plain hop from standing only
reaches -0.090**, so the hand-off's gain drew 0.6 degrees on the landing the
game makes constantly; and then 0.60 rad/m drew 0.033 against its own target of
0.054. 1.10 rad/m draws the 0.06 rad that was asked for. **Tune a follower
against what it DRAWS, on the input the game actually produces.**

**A SPHERE CENTRED ON ITSELF CANNOT BE ANIMATED.** The tail nub had no writer
and could not be given one: rotating a sphere about its own centre moves nothing
but which way its facets face. It needed a pivot, and the pivot's ARM is the
whole story: on the hull's rear cap the arm is 3.9 cm and 0.25 rad moves the nub
9.7 mm; put INSIDE the body at z -0.50 the arm is 11.7 cm and the same angle
moves it 29.2 mm. A joint belongs inside the thing it hinges on. A Group is not
a mesh, so this cost 0 draw calls and 0 triangles.

**HOW TO READ qa/d8-body.js's CARRY ROWS.** Its four leg reaches are sampled off
`capyCarryPh`, which runs at 14 rad/s, so two runs a single frame apart differ by
0.23 rad and look like a behaviour change. Solve `sin(capyCarryPh + i) * 0.7` for
each of the four legs: if all four give the SAME phase, the rows differ by
sampling and nothing else. That turned a scary-looking diff into 16.6 ms.
Add to [[capy3-instruments-that-cannot-hold-a-line]].

Related: [[capy3-the-character-pass]], [[capy3-springs-are-clipped]],
[[capy3-the-body-second-half]], [[headless-qa-harness]]
