---
name: capy3-lens-and-wall
description: "Batch 5 of the Lift Pass — the eye-raise, the dolly that flattens, and the climb that finally left Hong Kong"
metadata: 
  node_type: memory
  type: project
  originSessionId: a368f17c-7b9d-43f0-b059-f9dba60f7976
  modified: 2026-08-26T15:03:50.058Z
---

Run 26 Aug 2026. Contract §**THE LIFT PASS, BATCH FIVE (v31)**. Both features already existed
and neither could be reached — the same shape the dive had, and the same fix.

**`skyward()` had been in the rig since chapter 7 and five chapters published it.** The camera
always knew how to look up; there was no way to ask it. Held **V** is now another voice on that
same channel — 0.7 of the crane's blend (20° pitch, ~12 m boom, look target 1.9 m up) and NOT
a second rig, because two things fighting over one pitch is the mistake every comment in that
block warns about. It borrows none of the crane's timing: `sysSKY_LAMBDA` is three seconds and
a verb that answers in three seconds reads as broken, so `sysEYE_LAMBDA` = 2.6 while the hand
is on the key. Measured: horizon in frame at a standstill **0 of 19 → 19 of 19**.

**The speed dolly's obvious extension is arithmetically backwards, and this cost a measurement
pass.** `sysCAM_DOLLY` lengthens the boom, and lengthening a boom at a FIXED boom angle raises
the eye in exactly the proportion it moves it back — 10.7 m reads 34.6° of view pitch and
13.5 m reads **36.1°, steeper**. What had always flattened the shot with speed was the
look-lead, which is horizontal. So `camDolly` became the 0..1 fraction it already was, and it
buys metres AND `sysCAM_DOLLY_P` = 18° of pitch. Run band 0 of 19 → 15 of 19.

**Two lens bugs found by the instrument, both older than this pass.**

- `sysInOpera`/`sysOperaClear` were gated on `!inPasto`, written when there were two chapters.
  `sysOPERA_VAULTS` is eleven ellipses around Bennelong Point and **Rio's spawn is the world
  origin**. Seventeen worlds had Sydney's Opera House pushing their camera about. Gate on
  `isActive('sydney')`. See [[capy3-shared-space-leaks]].
- `sysCAM_CLEAR_PAD` was **0.45** and `camera.near` is **0.5**, so every time the occlusion ray
  fired the near plane was left five centimetres INSIDE the wall it had just backed off from.
  The tell is a frame that is one flat colour. Pad 0.70.

**The climb: `capyClimbAt` gets a generic fallback, on a property MISS only.** Two horizontal
raycasts out of the chest along `capyYaw`; a near-vertical static face within 1.15 m is a hold
and the flattened surface normal is the hold's normal. **3 of 19 chapters → 19 of 19**, and the
authored three (Hong Kong 150 m², Cappadocia 528, Son Doong 1,157) unmoved to the square metre
because a biome that publishes `climbHold` and answers null has answered. `sysCLIMB_TAUGHT`
stays {11,13,16} — the find `brought-climb` was unreachable by construction until the other set
changed.

Four things the ray must refuse, each paid for: **mass > 0** (a bin you could pick up);
**anything not `CANNON.Body.STATIC`** (kinematic is a ferry hull, a tram, a floe, a gondola, a
basket — carriers, which have `carryFrame`); **`userData.npc` and `userData.local`**, both
mass-0 boxes that read as a fine half-metre wall; **heightfields and planes**. That is
`sysCamClear`'s ignore list. Two more found by measuring: a wall's `top` off an AABB is wrong
where a chapter merges a street into one body, so confirm it with a second ray a metre higher;
and a hold **below the terrain surface** holds the animal inside the hill for ever, because the
climb ASSIGNS `body.velocity.y` — Monte Carlo, collider at y 27, ground at y 28, frame entirely
brown. Related: [[capy3-external-forces-on-the-capybara]], [[capy3-solid-or-drawn]].

**Cost gate:** the fallback runs only while the grab key is down. It is two raycasts against
every static body; the authored hooks are arithmetic and cost nothing.

**Two QA-facing accessors were added to src and both were necessary**, not conveniences:
`game.camInfo` (reach, clear, pitch, sky, rig, shot, lift, lift2, floor — written once a frame,
read by nothing in src) because `camClearF` had never left its closure and boom-cut frequency
was uncountable; and `capy.climbAt(x, y, z, yaw)` because a biome's `climbHold` can be probed on
a grid and a ray cannot — it needs a facing.

Related: [[headless-qa-harness]], [[capy3-the-closeout]], [[capy3-render-pose-heuristics]].
