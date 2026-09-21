---
name: capy3-exposure
description: "v47 — the albedo ceiling was one chapter not three, nothing clips, and the lever the arithmetic recommended did nothing"
metadata:
  type: project
---

Ran 30 Aug 2026 after [[capy3-the-leaf]], on "do the albedo ceiling next".
Commit `547809d`. Architecture is in **CONTRACT.md ➜ "EXPOSURE (v47)"**.

**THE SCOPE WAS THREE CHAPTERS AND IT WAS ONE.** I had named Palawan's sand,
Antarctica's snow and Venice's stone from looking at frames, and warned it would
need a global re-grade. Measured (`qa/tone-hist.js`, all nineteen): **Venice is
0.00% over 235** and **Antarctica's top decile is already 74 levels**. Only
Palawan is a case. Two frames that *look* bright are not two frames with the
same fault, and the difference is not visible by eye.

**AND NOTHING IN THE GAME CLIPS.** `>253` is 0.00% in all nineteen — the v40
shoulder works. "The albedo ceiling" was naming a symptom as if it were the
mechanism; the real quantity is highlight COMPRESSION.

**THE METRIC IS THE NUMBER OF DISTINCT LEVELS IN THE TOP DECILE**, not the
percentage of the frame that is bright. Palawan: 26.96% over 235 spread across
**nine levels**. Sydney 41, Iceland 112, Drift 124. The percentage alone would
have put Pasto (6.81%) second and it is fine — 17 levels, and exposure only takes
it to 19, so there is nothing there to recover. Percentage says how much is
bright; levels say whether any of it has shape.

**THE LEVER THE ARITHMETIC RECOMMENDED DID NOTHING.** A lower per-chapter
shoulder is identity below its knee, so on paper it was the surgical fix — touch
the highlights, leave the midtones. I worked out that k=0.62 should roughly
double the output width of a fixed input range, and it was **wrong about the real
frame**: swept, shoulder 0.70 gave 10 levels and shoulder 0.58 gave **9**, i.e.
no better than shipping. It moves the top of the picture DOWN without spreading
it — the curve's slope rises and sRGB's slope at the lower output it now lands on
falls by about as much, and they cancel. Exposure works because it moves content
**below** the knee, where the roll-off is identity and sRGB is steep.
**Sweep both levers rather than reasoning about one.**

**WHERE EXPOSURE GOES.** After the bloom (it is the last thing before a sensor
and must scale the glow with the thing glowing), before the shoulder (the point
is to give the roll-off something to roll off), and **NOT before the bright
pass** — `threshold` is a per-chapter number in nineteen hand-tuned grade rows
expressed in the scene target's units, and scaling before the bright pass reads
it re-bases all nineteen at once.

0.86 is the knee: 27.19% → 0.95%, nine levels → eighteen, for 6% of mean
brightness. 0.80 and 0.74 buy one and two more levels for another 3% and 6%.

**THE topLevels INSTRUMENT HAS REAL RUN-TO-RUN VARIANCE.** Between two runs with
`exposure` an exact no-op for that chapter, the Pantanal read 45 then 64 and
Sydney 41 then 45 — the frame differs (NPCs, wind, camera settle). Only believe a
change of that size in the chapter you actually touched. Same family as
[[capy3-instruments-that-cannot-hold-a-line]].

Verified: 16.3–17.0 ms median in all nineteen, 0 errors, `qa/fuzz.js` 19/19
clean. Switch is `game.state.noExposure` and it cuts.

**Still open from the same review:** light in the air near the spill emitters,
and shadow penumbra that does not vary with caster distance (`sysBIO_SH_RAD` is
one number, 1.0 for seventeen chapters). And Son Doong still has no leaf term
because its vegetation is merged into one mesh with the rock.

Related: [[capy3-the-leaf]], [[capy3-the-depth-pass]], [[capy3-the-lens]],
[[capy3-instruments-that-cannot-hold-a-line]]
