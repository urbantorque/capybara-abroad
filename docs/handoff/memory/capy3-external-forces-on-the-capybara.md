---
name: capy3-external-forces-on-the-capybara
description: "The three ways the world can move capy3's capybara, which one to use, and the arithmetic that proves a bare velocity write is deleted"
metadata: 
  node_type: memory
  type: project
  originSessionId: 25994c8a-e629-4d79-914c-22c2bdeb8481
  modified: 2026-08-28T02:55:11.800Z
---

Settled 19 Aug 2026. There are now THREE channels and they are not interchangeable.

    platVX / platVZ   a FRAME the animal is standing/flying in   deck, wind aloft, current
    capy.launch()     being THROWN, feet off the ground          geyser, cable, wave
    capy.shove()      being LEANED ON, still on its feet         sandstorm, bow wave, crowd

**A bare `capy.body.velocity` write from a biome is deleted, and this is arithmetic.** Every
biome module updates BEFORE capybara.js, whose movement solve re-derives `vx` and damps it at
`capyGRIP_LAMBDA` 60 — which removes 63% of any injected velocity in one 60 Hz frame — and then
snaps anything under `capyGRIP_SNAP` (0.9 m/s) to exactly zero. Marrakech's sandstorm was
pushing `sahWIND_F * storm * dt` = 0.103 m/s per frame into that: steady state ~0.16 m/s, under
the snap, **set to zero every frame**. The chapter's headline weather mechanic moved the animal
a measured nothing, and had since it was written.

`capy.shove(dvx, dvz)` is added AFTER the damper and after the snap, and widens the speed cap by
its own live size, so it is the only channel a sustained ground-level push survives. It takes a
VELOCITY INCREMENT (caller multiplies by dt), so calling it every frame builds to a steady state
against its own decay (lambda 4) rather than jumping.

**SHOVE IS A FORCE CHANNEL AND IT COMPOUNDS IN THE AIR. NEVER PUT A ONE-SHOT THROUGH IT.**
Found 28 Aug 2026, reported by the player as "the run jump is too powerful". The whole of
`capyShove` is added to the velocity EVERY frame, and the velocity already carries what was
added last frame, so the only thing between it and a runaway is whatever opposes it. On the
ground that is the grip damper at lambda 60, which is why a sandstorm settles. In the air there
is nothing: the airborne bleed is `capySTOP_LAMBDA * 0.15`, and the speed cap cannot help
because **the cap is widened by the live shove**. The run-up leap (`capyLEAP_PUSH`, a one-shot
3.2 m/s at takeoff) was the one caller that shoves on the exact frame the feet leave the floor:

    push 0.0   7.4 m/s flat for the whole arc      5.42 m
    push 3.2   7.4 -> 10.6 -> 20.3 -> 25.4 m/s    14.80 m   <- shipped for nine days
    as impulse 7.4 -> 10.1, back to 7.4 in 10f     5.60 m

An impulse goes straight onto `body.velocity` in the launch block, in the PLATFORM's frame
(`lvx/lvz`; body.velocity is local + platform, so a local increment is the right thing to add).
The "a bare write is deleted" rule above is about the GROUND path and its lambda-60 damper — the
jump block already writes `body.velocity.y` there and it survives, because the airborne cap
bleeds at lambda 3 and merely spends the excess over the hop.

The tell is `peak airborne speed / speed at takeoff`. It should be 1.0-1.4; it was 3.4.
`qa/tune-verify.js` reports that ratio for all nineteen chapters and is the regression gate.
Apex and airtime are NOT affected by any of this and must not move — `qa/mv-feel.js` still reads
1.37 m / 0.717 s in seventeen of nineteen, Drift 4.51 / 2.083.

Iceland's geyser had the same disease in a milder form: `velocity.y = 27` survives (nothing damps
vertical) but the `+= dx * 0.6` outward scatter was inside the grip damper on the launch frame,
so everybody came off Strokkur going perfectly straight up. `launch()` fixes it because it clears
the frame, lifts clear of the live contact and refuses to be grounded for `capyLAUNCH_HOLD`.

**A KINEMATIC CARRIER MUST DERIVE ITS VELOCITY FROM ITS TARGET, NOT FROM ITS OWN POSITION.**
cannon integrates kinematic bodies by their velocity inside `world.step`, which runs before every
module update. So `(targetZ - body.position.z) * (1/dt)` is not the distance still to travel, it
is the distance the LAST velocity already carried the body, and the sign flips every frame:
measured on a parked machine, +7, -7, +7 m/s for ever. That is the number capybara.js solves the
deck's frame against, so a passenger is shaken off the moment the vehicle stops. Difference the
TARGET against the PREVIOUS TARGET instead; it is exact at every speed and honestly zero at rest.
This was SYSTEMIC: on 20 Aug 2026 every one of the six carriers in the game had it — the Sydney
ferry, Venice's gondola, the Star Ferry, Mong Kok's swinging neon sign, Cappadocia's basket and
Palawan's bangka. All six now difference the target. The Quay ferry is the counter-example that
was always right, and is the one to copy.

And a rideable deck has to be REACHABLE: the capybara steps up 0.4 m by itself and hops 1.4 m, so
a deck above that is scenery. Iceland's snowcat was authored at 2.7 m first and could be admired
and never boarded; 0.9 m is a deliberate hop and nothing more.

Related: [[capy3-reference-frames]], [[capy3-slip-and-sky]], [[capy3-biome-build-gotchas]]
