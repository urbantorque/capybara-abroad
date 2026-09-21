---
name: capy3-reference-frames
description: "capy3's one mechanic for moving worlds — deck, wind, current — and the four ways it silently fails"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6464407-3e34-4176-9162-c866ef1e3cc8
  modified: 2026-08-19T02:47:11.005Z
---

capybara.js has ONE channel for "the thing I am standing in is itself moving": `platVX/platVZ`,
a REFERENCE FRAME added on at the end of the movement solve. As of 19 Aug 2026 three chapters
use it — the Quay ferry's deck, the Drift's wind, and (new) the Uji's current, via
`game.<biome>.flow(x, z)` in `capyFlowAt`. Any future "moving world" uses this and nothing else.

**Never a force, never a velocity write.** A force is eaten by the speed cap (7.45 walking,
2.6 swimming) — which is exactly what the cap is for. A velocity write deletes the player's
steering, which on a river is the only input there is.

Four failures, all found by measurement, none visible from the symptom:

**1. THE COYOTE TIMER WAS TOO SHORT FOR A JUMP.** It was 0.18 s and described as a
contact-blip guard. A hop off a moving deck lasts ~0.55 s; after 0.18 s the frame was dropped,
`vx` re-derived against the WORLD, and (no stick held) damped toward zero — the animal stopped
dead in mid-air and the vehicle drove out from under it. Nobody found it on the ferry because
you spend the voyage at the wheel. On the chiva, where hopping a cable IS the mechanic, every
successful hop threw you off the roof. Now: `capyPLAT_COYOTE` 0.18 while grounded,
`capyPLAT_AIR` 1.20 while there is no contact at all, then a fade at `capyPLAT_FADE`. Grounded
on something static, or swimming, clears it immediately.

**2. A THROW ONTO A MOVING PLATFORM IS DELETED.** Writing `body.velocity` to knock the animal
off a bus does nothing: the grip damper is 60 (that is what standing still IS), so one frame
of contact with the roof pulls the whole throw back to the roof's own velocity and the capybara
hops politely on the spot. Iceland's geyser works only because the ground under it is static.
Use `capy.launch(vx, vy, vz)` — it clears the frame, lifts 0.30 m off the contact that is still
in the solver's list this step, and refuses to be grounded for 0.20 s. All four parts matter.

**3. EXPRESS THE THROW RELATIVE TO THE VEHICLE.** "Backwards at 5 m/s" reads fine at walking
pace and drops you neatly back onto the luggage rack at seven. The chiva's cable uses
`rel = busSpeed + 5.5`.

**4. A LOCAL-SPACE TEST MUST BE A ROTATION.** `cos(-yaw)/sin(-yaw)` is a reflection, not the
inverse rotation: it silently swaps which tolerance guards which axis. On the chiva that made
the "am I on the roof" box 5.3 m wide and 2.3 m long on a bus that is 3.6 x 9.5. Correct form
is `lx = dx*cos(yaw) - dz*sin(yaw)`, `lz = dx*sin(yaw) + dz*cos(yaw)`. And the vertical
tolerance has to clear a HOP (2.6 m, not 1.8) or the test goes false in the middle of every
successful jump.

`capy.frameVX/frameVZ` are published for exactly this class of bug — read them first.

Related: [[capy3-slip-and-sky]], [[capy3-drift-air-and-gravity]], [[headless-qa-harness]]
