---
name: capy3-slip-and-sky
description: "Two capy3 mechanics whose obvious implementation is wrong: sliding terrain, and anything the player has to look UP at"
metadata:
  type: project
---

Both of these were built the obvious way first, both measured wrong, and both fixes are
counter-intuitive enough to be worth writing down.

**1. SLIP IS LINEAR IN TERMINAL VELOCITY, NOT IN THE DAMPER.** `capyGRIP_LAMBDA` (60) is not
"friction", it is the thing that SETS the speed a slide settles at: gravity gives a constant
downhill `a`, the damper removes `L·v`, and they balance at `v = a/L`. So the player-facing
quantity is `1/L` and scaling `L` scales the wrong end of a reciprocal:

    grip * (1 - slip), slip 0.50 -> L 30  -> 0.3 m/s     ("the mechanic does nothing")
    grip * (1 - slip), slip 0.97 -> L 1.8 -> 4.8 m/s     (measured; a downhill WALK)
    1 / lerp(1/60, 1/0.42, slip)                          (right: 0.72 -> 13, 1.0 -> 19 m/s)

Everything below slip ~0.95 was indistinguishable from full grip under the first form, so a
half-slippery surface could not be expressed at all. Also: the steering target speed must rise
with the cap (`topSpeed * (1 + slip*CAP)`), or pressing forward down a glacier is a hard brake —
the movement block steers by pulling velocity toward the target, and at walking pace that target
is a brake at 18 m/s.

And **every slide needs a grippy way back to the top** — Iceland's moraine shelf, the dune's
firm shoulders. A slope you cannot climb is a wall, not a run.

**2. THE SKY IS NEVER IN THE PICTURE.** The rig sits 9.5 m behind at pitch 41 deg with a 48 deg
vertical FOV, so the top edge of the frame points **17 degrees BELOW horizontal** and meets flat
ground 24 m out. Anything above the horizon is off screen at all times. The first aurora was
correct, expensive and invisible; the shot of the ignition is a photograph of some grass.

Two things fix it and you need both: a biome may publish `skyward() -> 0..1` and systems.js
cranes the rig to `sysSKY_PITCH` (11 deg), AND the sky object must be parented to a rig that
tracks the capybara in x/z — a fixed curtain has to be ~400 m out to sit low enough in frame,
and the playable world is only 300 m across, so any fixed position is overhead at one end and
under the horizon at the other.

Corollary from the same screenshots: **near the player, go flat or go tall.** Anything knee-high
and horizontal within ~15 m of the animal (a boardwalk plank, a rim, a low wall) becomes the
entire picture and hides the capybara behind it.

Related: [[capy3-visibility-metrics]], [[capy3-biome-build-gotchas]], [[capy3-progression-chain]]
