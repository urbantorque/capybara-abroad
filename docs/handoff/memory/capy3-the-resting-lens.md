---
name: capy3-the-resting-lens
description: "The visual pass of 29 Aug 2026 — the frame the game spends most of its time showing, and the three things that measured wrong"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6a6ac56e-b5b5-4fcb-a331-80bab515e65a
  modified: 2026-08-29T04:41:59.176Z
---

Run 29 Aug 2026. A visuals/navigation pass. The finding underneath all of it:

**THE GAME'S RESTING FRAME WAS A PHOTOGRAPH OF THE GROUND, IN ALL NINETEEN
CHAPTERS.** `sysCAM_PITCH` is 41 degrees and the vertical half-FOV is 24, so the
top edge points 17 degrees BELOW horizontal. The file already said so, and the
eye-raise (held **V**, [[capy3-lens-and-wall]]) was written to fix it — for a
player who knows about V. Nothing fixed the DEFAULT. Screenshot evidence: Venice
standing still is grey flagstones with no Basilica, no Campanile, no arcades;
run the same twenty metres and the whole Piazza is in frame, because the speed
dolly takes the view pitch to 23 degrees. **The best picture in the game was the
one nobody was standing still to look at, and the worst was the default.**

Fix: a **fourth voice on the skyward channel** (`sysREST_W` 0.55), asked for by
the stillness the rig already detects. Not a fifth rig — same argument the
eye-raise made, loudest voice wins. 41 -> 24.6 degrees, boom 9.5 -> 11.4 m, look
raise 1.59 m. Measured 19/19 at rest 0.55, `clear` 1 (no boom cut) and `lift2` 0
(no terrain clamp) in eighteen; Manly cuts to 0.80 against a dune, correctly.

**THREE THINGS THAT MEASURED WRONG FIRST:**

1. **`camIdleT` FORGETS, AND THAT MADE PASTO THE ONE CHAPTER IN NINETEEN THAT
   NEVER OPENED.** It resets to zero on any frame over `sysCAM_AUTO_V`, which is
   right for the yaw tidy-up and wrong for a shot you want to HOLD. On the flank
   of Galeras the animal creeps downhill and is caught, over and over — body
   speed peaks at **2.6 m/s about every 2.5 s** with the stick at rest and
   `grounded` true the whole time — so the timer never got past 2.5 and the rig
   was answering to the solver. Fix is a banked timer (`sysREST_FORGET` 3.0):
   **the STICK zeroes it outright, speed only DRAINS it.** 0.55 pinned, 19/19.
   The tell was `rest` oscillating 0.55 -> 0 -> 0.22 with `sp` reading 0 at every
   sample — a 60 ms sampler still missed the spike, so measure `body.velocity`
   max over a window, not at sample instants.
2. **`capy.velocity` AND `capy.body.velocity` ARE NOT THE SAME NUMBER.** The
   camera's idle test reads the former (peaked 1.67, under the 1.8 threshold);
   the latter peaked 2.6. A probe sampling the wrong one says the gate cannot
   possibly be firing, and it is.
3. **A prefers-reduced-motion gate was the wrong instinct.** The line this file
   already draws is that involuntary OSCILLATIONS are gated (shake, the FOV
   breathe, the minimap sweep, the sea glitter) and deliberate rig BLENDS are
   not — the crane, the dolly and the **yaw tidy-up, which fires off this very
   trigger and swings the boom ninety degrees**, are all un-gated. Gating 16
   degrees of pitch would have taken the composition away from exactly the
   readers it was built for. Only the breath is gated.

**WHAT IT BOUGHT, MEASURED, NOT ASSUMED:**

- **The objective beacon.** It is 3 m tall and only lit past 6 m, and at 41
  degrees its top left the frame about 9 m in front of the animal — so the thing
  that marks where you are going was out of frame exactly when it mattered.
  Differential over eight chapters: **0 of 8 in frame before** (Sydney y=1.36,
  Quay 1.41, Venice 1.55 all off the TOP; Rio −1.58 off the BOTTOM). After, every
  case inside the camera's forward arc is in frame — Quay at 18 m, Venice at
  29.6 m. The four remaining misses are LATERAL (the target is beside or behind),
  which is the card arrow's job, not the lens's.
- **The arrival hands off instead of dropping.** `sysARRIVE_HOLD` used to end by
  falling back to 41 degrees. Traced: the shot holds 16 degrees to t=2.2 s, eases
  out, and settles at 24.6 — because the rest voice banked during the hold. Max
  pitch step 2.8 deg/50 ms, and that is the shot easing IN.
- **V still composes.** 25.4 at rest -> 20.6 held -> 25.4 released. Releasing V
  returns to the rest pose, not to the ground.

**TWO OTHER THINGS IN THE SAME PASS:**

- **Speech bubbles knew about the capybara and the screen edges and nothing about
  the two opaque panels on the corners of the frame.** Measured in Mong Kok:
  **61 of 249 bubble-frames overlapped a HUD panel, worst 3 784 px²** — a local's
  line sitting on the to-do card, taking out two rows of it, in the one channel
  the game has for saying somebody noticed you. `game.hud.panels(out)` publishes
  the card and map as NDC boxes (systems owns the HUD and is the only thing that
  knows which are up — `bare` mode, the title card, the coarse-pointer corner);
  npc.js dodges them on the existing damped `ox`. **1 of 307 after, worst 258 px²**
  — the glide passing through, which is the point. Resolve the dodge AFTER the box
  size is known: whether a bubble is on the card is a question about the BOX, and
  the capybara dodge can be answered from a point.
- **The resting frame breathes.** Once the eye converges it is exactly still to
  the float, which is the one place this game looks like a screenshot. Three
  sines on the EYE ONLY (same slot and same rule as `shake()` — the look target
  never moves, so the animal cannot drift and the bearing cannot wander), 5.5 cm
  lateral at 11.4 m of boom ≈ 4.8 mrad ≈ five pixels of a 900-line frame, periods
  11.0 / 9.3 / 7.7 s so the sum never visibly repeats.

`camInfo` gained `rest`, `idle` and `hand` for the same reason it gained `clear`:
both drive the rig from inside that closure and neither had ever left it, so
"the camera will not settle in this chapter" was a question nothing could answer.

Costs: frame time 16.8 ms median / 18.5 p95 at 1600×900, still vsync-locked;
`qa/fuzz.js` 19/19 clean, console clean. Close 0.45 s from key-down.

Related: [[capy3-lens-and-wall]], [[capy3-number-and-first-frame]],
[[capy3-visibility-metrics]], [[capy3-the-picture]], [[headless-qa-harness]]
