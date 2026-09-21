---
name: capy3-fifth-pass-ten-eleven-twelve
description: "Deep pass of Venice, Hong Kong and Palawan: three marquee moments gated on a single frame, a task that was impossible from the wrong door, and the three chapters that used none of npc.js's conditional dialogue"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e1396a5-df3c-44cd-853d-f13949598a8b
  modified: 2026-08-23T23:44:06.885Z
---

Done 24 Aug 2026, on a scheduled deep pass of biomes 10, 11 and 12. Unlike the earlier passes,
where the faults were things drawn and not implemented, **almost everything wrong here was a
GATE — a correct system asked the wrong question about WHEN.**

## THE SINGLE-FRAME MARQUEE. Found three times in two chapters.

A set piece runs for tens of seconds; the task that scores it was tested on the rising edge and
nowhere else.

- **`symphony` (ch 11) was the worst.** `if (onNow && hkShowT < 0)` — the task ticked only if
  the capybara was already above 26 m on the exact frame the phase crossed `hkSHOW_ON`. The show
  runs **38.8 s of a 152 s cycle**. Hear the chime, climb, arrive four seconds in, watch the
  whole thing from the right roof: nothing, no explanation, and 113 s of standing about before
  the next go. Measured: arriving 7 s late scored `false` before, `true` after.
- **`acqua-alta` (ch 10)** — same shape, on the `wow` row, with a 205 s cycle.
- **`choi-cheng` (ch 11)** — tested `aboard` inside the `u > 0.48` edge of a 4.5 s rear. Being
  thrown off by the eighth leap and scrambling back on at the top — the most likely way anybody
  rides it — scored nothing.

The fix in all three is the same and is worth stating as a rule: **"be there WHEN X" is
satisfied by being there WHILE X**. Check every frame the thing is running.

### ...and my first fix for the Venice one was itself wrong, for a measurable reason

I gated the grace window on `tide < 0.72` as well ("arriving at the top of the flood is not
arriving during it"). It was nearly a no-op: `venTerrain` over the middle of the piazza is 0,
`venIsOverWater` wants 0.22 m of clearance, and **0.22 on a −1.30…0.95 range is tide 0.676** —
so the front crosses at 0.676 and the second gate shut about two seconds later. Caught by the
test still returning `false`. Two gates for one idea; the window alone already prevents banking
it at high water twenty minutes on. **Always derive the level a threshold actually corresponds
to before gating on it.**

## THE EXTENT BUG, LEFT STANDING TEN LINES FROM ITS OWN FIX

`the-calli` measured `Math.abs(p.x - entryX)` — distance from whichever door you came in by.
The maze is **48 m wide against a required 36**, so entering anywhere but within 12 m of an edge
made the task **impossible, silently**. `mirror-swim`, in the same file, had had exactly this
bug found and fixed with a comment headed THE EXTENT, NOT THE DISPLACEMENT. Track min/max and
score the span. Measured `false` → `true` from a mid-maze entry.

**When a bug class is found and documented, grep the file for the other instances of it.**

## A DESIGNED BEAT THAT BROKE THE TASK ATTACHED TO IT

The Palawan turtle surfaces 6 s every 92, and the code that does it carries a lovely comment
about how "you are out of air at exactly the moment she is". `sea-turtle` required **6 seconds
continuous with `depth > 0.65`** — so following her up, which is the thing the chapter is
proudest of, threw the timer away. The two numbers are six and six.

Honest measurement: it is **not** a blocker — following her costs 24.1 s instead of 18.9 s,
because you rebuild the hold on the next dive. Worth fixing, not worth overstating.

## CHAPTERS 10, 11 AND 12 USED NONE OF npc.js's v20 DIALOGUE MACHINERY

25 locals between them and **zero** `when:` / `after:` / `before:` / `onTask` / `addExchange`,
while Cali, Iceland, Kyoto, Rio and Sahara all use them. So: the Venice waiter said "the water
comes at four, everybody says nothing will happen" **while standing in it**; the Kowloon pier
man said "lights start at eight" at eight exactly; the Palawan fire-keeper said "wait for the
water to light up" while the whole bay was lit.

All three now carry 4–5 world states as predicates plus task gating. **The rule that makes it
safe: every pool keeps at least one unconditional line**, or there is a state in which somebody
has nothing to say and stands there. Audited: 25 locals × 10 samples across a full world cycle,
zero empty pools, zero throwing predicates (npc.js swallows a throwing `when`, so a broken
predicate is invisible — audit it, don't reason about it).

Palawan also had a SECOND, older mechanism: `palSaysNow` assigned `rec.lines = lines`, which
forgets everything else the person knew. Refactored to `after:` entries; `palSaysNow` now only
speaks a line on the spot, which is the half `after:` cannot do.

**`addExchange` pairs must be chosen by measured distance.** `npcEX_MIN/MAX` bound the
**player's** distance to the nearer speaker and say nothing about how far apart the two of them
are — so nothing stops pairing two people 60 m apart, and the result is two bubbles that can
never both be on screen. I nearly shipped a Kowloon pier↔scaffold pair at 63 m.

## HARNESS TRAP 8, AND IT INVALIDATED FOUR RUNS

**The game saves to `localStorage['capy3.journey.v1']`, so completed tasks survive `reload()`.**
Four of my "the fix works" results were the save reading back. The tell was a task reporting
done on tick 0 with the animal 56 m from the thing. Every task assertion needs
`page.addInitScript(() => localStorage.clear())` before `reload()`. Adds to the seven traps in
[[headless-qa-harness]].

And: **prove the fix by running the same clean test against the stashed source.** `git stash
push -- src/x.js`, build, run, `stash pop`. It is what showed the turtle fix was smaller than I
had assumed and the other three were exactly as large.

## What was added, and the one dead constant

- **Venice had no crowd** — nine locals and 180 pigeons in the most walked-on square in Europe.
  48 instanced people who READ THE TIDE: stroll and gawp at the campanile, make for the boards
  on the siren, **queue single file on the passerelle at high water** (that is the photograph),
  wade for the arcade if they cannot reach a plank. They also turn to watch the Volo.
  The rig heights are not free parameters: hip 0.82, body 1.14, head 1.62 over the feet, same as
  Mong Kok's eighty. Authoring one origin at 0.86 and hanging everything off it gave 48
  **floating heads**, and it is the first thing in the frame.
- **`hkAC_N = 90` was dead** — the constant existed, the units are built from a different array.
  The units were bone dry. 32 of them now drip: streak, ring on the wet road, one throttled
  voice, and within 90 cm it wets the coat.
- **The wheek did nothing underwater** in the chapter about being underwater. Now a shell of
  light leaves the animal at 8.2 m/s through the plankton field — one term in the loop that was
  already writing all 240 motes. 3.2×, not 4.2×: at 4.2 in bloom the nearest motes resolve to
  half-metre **hexagons**, which is the one thing a glow may not become.
- **`const BAG` in kowloon.js was an unprefixed top-level name** — a straight CONTRACT violation
  and a latent collision in the concatenated bundle. Now `hkBAG`.

## Two smaller rules this pass kept re-deriving

1. **No invisible state.** The passerelle run and the laundry-pole crossing both ended in
   silence — the player carried on carefully doing a task that had stopped counting. Say so.
2. **Everything with a grace period should have the same grace period.** The bangka's deck had
   0.5 s and a good comment about why; the turtle, the bait ball and the boards had none.

Related: [[capy3-fourth-pass-ten-eleven]], [[capy3-third-pass-twelve-thirteen]],
[[capy3-the-locals]], [[capy3-catch-all-state]], [[headless-qa-harness]]
