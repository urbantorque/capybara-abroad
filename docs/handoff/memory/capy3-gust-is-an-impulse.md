---
name: capy3-gust-is-an-impulse
description: "Why a gust in capy3 has to be a puff and a cap, and the impulse-to-distance table that says how big the puff must be"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f8abd8c-de8f-4fe9-bade-97adc2a7ed4b
  modified: 2026-08-24T17:32:21.342Z
---

CONTRACT v21 established that a gust cannot blow a prop across a square with
DRAG alone: a prop's terminal velocity under drag IS the wind speed, so there is
a stiction cliff with nothing between its sides — under it nothing stirs, over it
the prop sails four to ten metres and props migrate away from where the player
set them down. v23 (25 Aug 2026) built the two mechanisms that note named.

**THE KICK is a puff, not a force.** An impulse a couple of times a second at a
scattered heading (±0.55 rad — a straight-downwind puff walks a row of props
across a square in formation, which reads as a conveyor belt) with a vertical
component. It arrives all at once, which is exactly what continuous drag cannot
do, and between puffs ordinary friction stops the prop dead. The result is a
skitter: a few centimetres, a pause, a few more.

**THE CAP stops the kick becoming the cliff.** Drag may DECELERATE anything at
any speed — so a thrown frisbee still sheds speed exactly as it did, measured
9 m/s → 0.9 either way — and may not ACCELERATE anything past `physGUST_VMAX`
along the wind. Only the accelerating component along the wind axis is removed.

**AND THE PUFF MUST BE TUNED AGAINST THE CONTACT, NOT AGAINST THE WIND. THIS IS
THE THING TO REMEMBER.** The first cut was 1.6 m/s and gave 3 cm of net drift in
40 s — jiggle, not travel. Single velocity impulses on Manly's sand, friction
0.35, one 0.10 kg prop:

| impulse | travels |
|---|---|
| 0.6 m/s | 1 mm |
| 1.2 m/s | 2 mm |
| 2.0 m/s | 5 mm |
| 3.5 m/s | 6 mm |
| **3.5 m/s + a 1.4 m/s hop** | **0.53 m** |
| 6.0 m/s | 0.52 m |

**There is a cliff in the IMPULSE too, at about 3.5 m/s and only with a hop, and
above it one puff is worth half a metre and no more.** cannon's contact solver
kills a small tangential velocity inside a step or two; only a puff that gets the
prop OFF the ground travels at all. So the puff is 4.5 m/s with a 1.5 m/s hop at
full strength and the ramp is set so only a near-peak gust clears the cliff —
which is what turbulence actually is.

**MEASURING THIS IS A TRAP.** "How far did the light props move" over a whole
chapter is meaningless: a prop that drifts into the surf is carried by
`physFlowAt` and `physBUOY_DRIFT`, which are a CURRENT and not the wind. Measured
in the same run, Manly's dry props moved 1.8 m and its whole light population
"moved" 29 m. Filter on `!p.inWater` and park ONE prop by hand
(`qa/pf-gust2.js`). Prop spawn positions are randomised per load, so a
chapter-wide census is different every run.

Result, 40 s of each chapter's own weather: Manly (0.10 kg) 2.24 m net / 4.94 m
of path, Marrakech (0.35 kg) 0.61 m, Antarctica (0.42 kg) 0.67 m, and Kyoto,
Venice, Göreme and Palawan exactly 0.00. Bounded by `physGUST_ROAM` at 8 m from
home; refused for anything over 0.6 kg, anything held/owned/planted/frozen, and
**every souvenir**.

Also worth knowing: the EFFECTIVE wind is about half the raw gust —
`physWindNow` takes `physGUST_MIN` (2.8) off the SPEED and scales the excess by
`physGUST_K` (1.2) — so a chapter reporting a raw gust of 5.6 has 3.4 m/s of
wind in the solver. Reading `weather.gust()` and comparing it to a props.js
threshold is how you conclude a feature is off when it is on.

Related: [[capy3-payoff-batch-one]], [[capy3-delight-pass]],
[[capy3-external-forces-on-the-capybara]]
