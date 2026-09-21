---
name: capy3-carriers-that-drop-you
description: "The zero-velocity carrier bug — three chapters had it, two tasks were uncompletable, and how to test a ride honestly"
metadata: 
  node_type: memory
  type: project
  originSessionId: 635b61f3-76ae-4655-a352-e3df43948b4a
  modified: 2026-08-29T00:57:51.032Z
---

Found 29 Aug 2026 sweeping chapters 5-9 (Cali, Rio, Iceland, Marrakech, the Drift).
Three of the five carriers in those chapters were built one way and two the other, and the
two were both broken so quietly that every earlier pass had signed them off.

## THE BUG, AND IT IS ONE PATTERN

A kinematic carrier written as **`velocity.set(0,0,0)` + `position.set(target)` + adding the
carrier's own displacement to `capy.body.position` every frame** DOES NOT CARRY. The comment
that argues for it (it was in `rioUpdateCabin`, copied into `sahUpdateCaravan`) says an honest
velocity "moves it twice". It does not: cannon integrates a kinematic body inside `world.step`,
which runs BEFORE the module updates, so the position written afterwards is authoritative and
the velocity is only ever read by the contact solver — which is exactly who needs it.

**A body with zero velocity is SOLID GROUND to `capyUpdate`'s contact sweep.** So the
controller holds the animal's world velocity at zero while the hand carry drags it, the two
fight, and the animal walks out of the vehicle.

Measured, animal put down dead centre and never touched again:
- Marrakech's caravan (2.3 m/s): 1.5 m of drift in 1.1 s, off the saddle in four seconds.
  `caravan` was **uncompletable from any starting point**.
- Rio's cable car: 1.43 m in four seconds, out of the car by the fifth, forty metres into the
  bay. `bondinho` was **uncompletable**.

**`carryFrame()` alone does not fix it** — Rio already published one. Frame + hand carry
over-carries (the animal drifts FORWARD off the front). The cure is the pattern the chiva, the
bonde, the snowcat, the Drift's wandering islands and Cappadocia's balloon basket all already
use and all five hold their rider to the centimetre:

    velocity = (newTarget - prevTarget) / dt      // differenced against the TARGET
    position = newTarget ; syncBody()
    carryFrame() returns the same number          // declared beats sniffed
    NO hand carry at all
    vertical only: assign body.velocity.y while genuinely standing in it (there is no
    vertical frame — carryFrame is horizontal by construction)

## TWO THINGS THAT COME WITH IT

- **A bare plate is not a vehicle.** Once the horizontal is right the animal still walks off
  the SIDE of a flat floor the first time the thing leans. Rio's cabin has a red waist band
  drawn round it at 0.46 m and it was not solid; four kerb shapes fixed it. Iceland's snowcat
  had already written this down ("a deck and two rails, the bangka's lesson").
- **The aboard test's height band is load-bearing once it publishes a frame.** Marrakech's was
  2.7 m tall on a blanket the animal stands 52 cm above, and the caravan sets off from the town
  gate — so somebody standing on the GATE read as aboard, and would have been dragged along it.

## A CARRIER CAN ALSO FLY THROUGH THE MAP

Rio's cable car passes straight through the Morro da Urca station. Each station is a solid
6.4 m block whose TOP is the platform; the wire sags 3.2 m, so over the last stretch of a span
the car hangs well below the deck it is aiming at while already inside the building's plan.
Measured entry at (72, 37, -36) against a block at y 36..42.4. The fix is in `rioSpanPoint`,
which both the car AND the drawn cable come from: within 15 m of a station the wire eases up to
that station's own height (which is `terrain + rioCABLE_CLEAR` by construction, so it needs no
new numbers). **It must be a RAMP: a hard footprint test moved the car seventeen metres in one
frame — 1044 m/s — and left the passenger standing in the air.**

## HOW TO TEST A RIDE HONESTLY

Every earlier probe of these rides re-seated the animal on the vehicle every frame, and every
one of them reported the task ticking. **A ride test must put the animal down once and then
touch nothing.** Log the offset in the CARRIER's frame, not the world's. See `qa/rb-car5.js`,
`qa/rb-carry4.js`, `qa/rb-chiva.js`.

Two probe traps paid for here:
- **Place the animal ABOVE the collider, never level with it.** Dropping it at
  `saddleCentre + 0.3` starts it inside the box and it falls straight through — which reads
  exactly like a missing collider.
- **A probe that lands on the wrong thing lies confidently.** Placing at `caravanPoint.y + 4.2`
  put the animal on the town gate, 1.85 m above the camel, and the (too tall) aboard test said
  riding — so the first three runs measured the gate.

Related: [[capy3-the-middle-rung]], [[capy3-external-forces-on-the-capybara]],
[[capy3-reference-frames]], [[headless-qa-harness]], [[capy3-fifth-pass-seven-eight-nine]]
