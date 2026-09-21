---
name: capy3-the-charged-throw
description: "B10: there is no camera pitch, gravity is -24, and a dynamic prop cannot be ridden because the controller brakes it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T07:51:52.930Z
---

Item 4b of ROADMAP-FUN, built 7 Sep 2026 as `ecb6937`. Item 4c was built twice
and refused twice. **Four facts about this game that a roadmap keeps assuming
wrong:**

1. **THERE IS NO CAMERA PITCH.** `game.input` is `x, z, run, action,
   actionPressed, honk, honkPressed, whistle, whistlePressed, jump, jumpPressed,
   slide, camYaw` plus four buffers. The player orbits the boom in yaw and can
   never raise or lower it; the resting elevation is **29.3–29.8°** over eight
   seconds. Anything that proposes to read an angle off the camera is reading a
   constant. `frameShot`'s `pitch` is a scripted move, not an input.
2. **GRAVITY IS −24**, three times earth, and every ballistic number has to be
   computed against it. The tap-throw leaves at **7.091 m/s** (5.12 across, 4.90
   up, a 43.7° launch) and lands a sun hat at 1.65 m. "Throw it five metres" was
   generous.
3. **AIR DRAG TAKES TWO THIRDS OF A HARD THROW.** Vacuum range for a fully
   charged hat: 9.30 m. Actual: 3.05. Any prediction of where a thrown prop
   lands must integrate `prop.aeroK` — `game.physics.predictLanding` does, in
   the file that owns the drag law. Drag is also why a beach ball cannot roll:
   its drag-to-mass ratio stops it in a fifth of a second.
4. **A DYNAMIC PROP CANNOT BE RIDDEN.** A 6 kg trolley over `capyPLAT_MIN_MASS`
   works as a floor — the animal stands on it, is carried exactly when it moves,
   and is never dropped — and **the trolley given 5 m/s with the animal on it
   travels four centimetres**. capybara.js owns horizontal motion and damps to a
   stop every frame; a contact under it is a second controller and it wins from
   ABOVE as well as from below, which is the same argument
   `physPair(ground, capy, 0.00, 0.00)` already makes. Zeroing the capy↔prop
   friction does not help. Every working carrier in this game is KINEMATIC for
   that reason. **A rideable thing is a chapter set piece, not a prop.**
   See [[capy3-carriers-that-drop-you]].

**The hold rule now:** a tap throws, a hold does the considered version —
putting it in a vessel if you are standing still beside one
([[capy3-a-thing-inside-a-thing]]), a charged throw everywhere else. The tap's
impulse is unchanged to three decimals; what moved is that it leaves on the
key-up.

**A steady push is a state, not an event.** `physOnCollide` reads
`c.getImpactVelocityAlongNormal()`, which for two bodies in resting contact is
near zero, and it carries a 0.12 s per-prop cooldown. Anything continuous
belongs in `physUpdate`'s loop.

**And the trap that cost the most: an instrument that cannot reproduce itself
will agree with whatever you built.** `qa/nudge-coast.js` gave a beach ball
0.34 m of coast and then 3.9 m on the same unmodified build, and the 0.34
motivated hours of work. The tell was there and was not read: **a beach ball, a
sun hat and a picnic basket all moved 1.62, 1.63 and 1.57 m** — agreement to six
centimetres between three shapes and three masses is not physics, it is one
number (how far the animal walked) wearing three hats. **A quantity that does
not vary with the thing it is supposed to be about is not measuring that
thing.** Fourth entry for [[capy3-instruments-that-cannot-hold-a-line]].

Instruments: `qa/nudge-throw.js`, `qa/nudge-coast.js`, `qa/charge-throw.js`,
`qa/the-trolley.js`, `qa/b10-shot.js`. `game.capy.charge` and `game.capy.aim`
are the way in from outside.

Related: [[capy3-a-thing-inside-a-thing]], [[capy3-external-forces-on-the-capybara]],
[[capy3-measure-the-premise]]
