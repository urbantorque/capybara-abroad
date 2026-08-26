# The performance budget, measured three ways

> **Updated 26 Aug 2026 by the closeout run.** Chapters 18 and 19 are in the
> tables now — they shipped after the Payoff Pass closed and `budget.js` was
> hard-coded to seventeen, so neither had a ratchet ceiling and both passed it
> SILENTLY: `if (c && r.tris > c)` reads "no ceiling recorded" as "within its
> ceiling". **Hanoi is the largest chapter in the game at ~245,000 triangles**,
> half again over the Pantanal, which batch 4 called the worst offender.
>
> Two things about the instrument changed as well, and both matter more than the
> numbers:
>
> - **The cost gate can be contaminated, and now says so.** Single-mean readings
>   swung 1.68 to 5.31 ms for the same chapter minutes apart on a loaded
>   machine, and iceland measured SLOWER with the shadow pass off — which is
>   impossible. It is the minimum of five repeats now (noise only ever adds
>   time), with that impossibility as an explicit self-check; a contaminated run
>   reports `COST GATE UNUSABLE` and is forbidden from failing anything.
> - **The ratchet's slack must be measured by the script that enforces it.** The
>   ±1,500 the table was first sized against came from re-entering chapters
>   inside one session, which is the same build; the scatter randomises at page
>   LOAD. Göreme spreads 12,652 across loads and tripped its old line by 630. A
>   side probe with a shorter settle then under-read Hanoi by nine thousand, and
>   the ceiling set from it tripped by 546 on the next run with nothing added.
>   Sized from four runs of `budget.js` itself now.

    node server.mjs                        # PORT=5188
    playwright-cli -s=X open http://localhost:5188/
    playwright-cli -s=X run-code --filename=qa/budget.js
    cat qa/budget.json.png                 # the sink writes JSON, .png is cosmetic

`out.pass` is the audit's verdict. It is green when nothing is over the COST
gate and nothing is over its RATCHET ceiling. The 130,000-triangle line from the
Payoff Pass brief is reported separately, with the cost beside every chapter
that misses it, because ten of seventeen do and the reason is not waste.

---

## 1. The triangle gate — 130,000, ten of seventeen over it

This is what the brief asked for, and it is reported first because it is what
was asked for. As of 26 Aug 2026, after the reallocation pass:

    pantanal 208,834 · iceland 200,088 · sahara 197,426 · goreme 200,474
    drift 185,062 · antarctic 182,042 · venice 181,814 · cave 158,440
    quay 157,539 · kowloon 154,058

The brief was written on 24 Aug against five chapters at 130-207k. The gap is
not measurement drift — it is the content batches 1 to 3 added (props in every
world, the delight pass, the locals, the mischief economy). Quay went
132,423 → 202,391 in two days and nobody saw it happen.

## 2. The cost gate — 5.5 ms, nothing within a factor of three

rAF is pinned to the display, so EVERY chapter measures 16.67 ms and a
frame-time reading says nothing at all — measured, mean 16.67 and p95 16.8 in
all seventeen, with the 99.9th percentile inside a single frame everywhere. The
only way to see a chapter's real cost is to render it N times back to back with
a `gl.finish()` at the end, and when you do:

**the worst chapter in the game costs about 1.8 ms of a 16.67 ms frame — 11%
— and the triangle count does not predict it:**

    manly     85,650 tris -> 1.67 ms   (1.95 ms per 100k)
    quay     202,339 tris -> 0.95 ms   (0.47 ms per 100k)
    iceland  199,674 tris -> 0.71 ms   (0.36 ms per 100k)

A four-to-one spread in cost per triangle, and the two cheapest chapters per
triangle are two of the three largest. What DOES predict it is the shadow pass
and the draw-call/material count.

So a budget that two thirds of the game misses, on a game that renders its worst
chapter in 11% of a frame, is measuring something it no longer predicts.

## 3. The ratchet — the gate that will actually catch something

Every chapter has a recorded ceiling in `qa/budget.js`, set at its 26 Aug figure
plus 6,000. Nothing may grow past it. **The slack is not generosity:** the
scatter helpers call unseeded `rand()`, so a chapter re-measures within about
±1,500 run to run and a gate inside that noise cries wolf. Raise a line only
with a measurement and a reason, in the same commit as whatever needed it.

---

## What the reallocation pass moved, and what it deliberately did not

Landed (see `qa/BATCH4.md` § Job 2): quay −43,876, drift −21,308,
pantanal −13,712, all of it far-field detail nobody can resolve, none of it
content, all three verified against a stashed differential.

**NOT landed, and the reason:** closing the remaining 25-79k per chapter means
cutting density where the player is standing. The brief that set the 130k line
also says "no visual regressions" and "this is headroom and not a crisis", and
the measurement says the worst chapter is at 11% of a frame. Those two
instructions point opposite ways at this point and the picture wins.

### The candidates, ranked, if a real budget ever arrives

1. **Every chapter's ground sheet casts a shadow.** Measured 26 Aug
   (`qa/b4-cast.js`): the single biggest shadow caster in venice, cave, kowloon,
   kyoto, cali, manly, rio, sahara, iceland, goreme and palawan is that
   chapter's own terrain plane, receiving and casting. Antarctica and the
   Pantanal already exclude theirs. Worth 0.2-0.9 ms — kyoto's shadow pass alone
   is 0.88 ms, the largest in the game — and it is the ONLY remaining lever with
   a real millisecond behind it. Not taken here because a terrain with genuine
   relief (Iceland 91 m, Cali 49 m, Kyoto 39 m) casts shadows a player can see,
   so it is eleven separate picture decisions and not one rule.
2. **goreme** — `gorScat:vine:*` + `vineStem` is 62,140 triangles, larger than
   `gorValley`, and it is a walkable vineyard, so the count has to stay. `sph6`
   (6x4, 36 tris) → (6,3) would halve the leaf head with the plan silhouette
   unchanged: −14,000.
3. **iceland** — 150 puffins at 184 triangles each. Three `sph6` bodies on a
   bird 0.3 m tall.
4. **sahara** — 173 people at 180 triangles each between `sahPeople` and
   `sahPeopleHeads`. The souk crowd, and near-field.
5. **antarctic** — a 33,072-triangle ground plane at 4 m sampling over
   424 x 624 m. The 4 m is load-bearing: half that terrain is a 23-degree ramp
   and a coarse grid turns a ramp into a staircase. A monotone Z warp
   (Pasto's `s = ±1` maps to itself) is the only safe cut.
6. **venice** — 38,716 + 30,260 + 27,136 in three meshes, at both waterlines.
