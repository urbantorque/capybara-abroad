---
name: capy3-the-mover
description: "S1a — the first continuously positioned sound in capy3, the one-term Doppler, and why a mover that does not move is a bed"
metadata: 
  node_type: memory
  type: project
  originSessionId: f24204dd-387e-401f-8434-cfc9585dc5c6
  modified: 2026-09-06T13:31:15.284Z
---

6 Sep 2026, commit `5c010c5` (and see [[capy3-two-runs-one-tree]] — a peer session
committed the same work as `6f04afd` eleven minutes earlier). First half of
`ROADMAP-AUDIO.md` batch S1. Contract section **THE SOUND PASS, BATCH ONE — THE MOVER
(S1a)**.

**What was actually wrong.** v41 produced the score; the WORLD still stood still. Every
sfx was a one-shot whose `StereoPannerNode` value was written once at birth — no handle,
no `stop()` — and `playbackRate` appeared exactly once in the whole audio tree, as
`noiseMake`'s window randomiser. **No Doppler anywhere.** The only continuously
positioned sound was the Cali band's private placer `musPlaceTick`, which had the right
model and one customer. `game.sfxMover` is that placer generalised.

**THE DISCOVERY WORTH KEEPING: A MOVER THAT DOES NOT MOVE IS A BED.** A shoreline, a
river and a colony are a van with the velocity left at zero. That was not the plan and it
is what makes S1b cheap.

**`set` IS NOT `amp`, and the van is why.** The throttle moves frequencies and filters and
deliberately does NOT gate level — a diesel at a bus stop is the most diesel thing there
is. But an engine can be switched OFF (a floatplane at its mooring), and that is a
separate number. At `amp(0)` the mover falls under the cull, gives its slot back and frees
its nodes 30 s later.

**THE DOPPLER IS ONE TERM, NOT TWO.** `vr = dot(srcVel − earVel, unit(ear − src))`,
`rate = c/(c − vr)`, clamped ±12 %. Writing it as one dot product of the RELATIVE
velocity is what makes the sign impossible to get backwards — the handoff's own
pseudocode had it as a source term minus a scalar `sysEarVr` and that shape is where the
error lives. `sysEarVel` is discarded above 45 m/s: a border crossing is not a movement.

**`back` IS TAKEN ON THE HORIZONTAL BEARING ALONE.** The first instinct is the 3-D dot
with camera forward, and it is wrong here — the rig looks down 41°, so anything overhead
reads as *behind you*. Measured on an 8-point ring: 1.000 astern, 0.712/0.702 at 45° off
astern, 0.007/0.000 abeam, 0 across the whole front half; directly overhead `up` 1.000 and
`back` 0.

**Four rules that are load-bearing:** four live at a time by DELIVERED gain (not distance,
not who asked first); a discrete mover goes through `acSfxIn` and gets the room, a bed
goes to `sysSfxOut()` and does not (sustained input into Son Doong's 5.5 s tail is a wall
— the v41 lesson); an oscillator's `frequency` is the throttle's and its `detune` is the
Doppler's, one writer each; a mover is silent outside the biome it was created in without
being told.

**The slot swap is the only real difficulty**, and it is Hanoi's: three movers follow the
three nearest of 240 scooters. A candidate must be a clear 6 m nearer than the bike being
held, the question is asked twice a second, and the handover fades over 150 ms through
`amp`. Re-pointing mid-pass is a click and a chirp.

**Measured** (`qa/mover-pass.js`, `qa/mover-chapters.js`, both new): the van's pan sweeps
−0.391 → 0 → +0.820 monotonically and the rate crosses **1.0000 at the closest approach to
the sample** (1.0007 at 9.03 m, 0.9999 at 9.01 m); ±0.93 % at 3.15 m/s against a predicted
0.918 %; Monaco's car 0.9299–1.0668 at 26.5 m/s; Hanoi 4 live of 4 and never more; **9
graph builds** across Sydney → Hanoi → Monaco → Sydney (every mover once, plus Sydney's two
rebuilt after the 30 s park lapsed) so there is no churn; Sydney's movers 0 of 71 samples
live while in Hanoi.

**Probe note:** use `g.biome.switchTo(name)`, never a picker digit — a picker key is a
one-based index and has produced two confident false failures here already
([[headless-qa-harness]] trap 15).

Wired so far: Sydney's van (her chime takes `rate()` so it shifts with her) and floatplane
(its four rationed notes DELETED — a one-shot on a timer is a pulse whatever you do to the
gap), Hanoi's three scooters + a `traffic` bed, Monaco's silver car muffled by the
chapter's own `monTunnelK2`. **S1b is the ferry, the bonde, the bus and the four beds
(surf, river, colony, parade).**

Related: [[capy3-the-sound-review]], [[capy3-the-mix]], [[capy3-sounds-people-make]],
[[capy3-two-runs-one-tree]], [[headless-qa-harness]]
