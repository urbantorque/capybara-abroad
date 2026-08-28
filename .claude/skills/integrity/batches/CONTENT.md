# CONTENT — the empty rings

**Est. 8–12 h. Blocks 7, 8, 9, 10. A commit at each boundary.**

Seven chapters thin out to nothing a short walk from where the player is put
down. This group fills them.

**All four blocks run after GROUND.** New scenery placed against a wrong terrain
law lands at the wrong height, and scenery placed outside a chapter's new
`bounds()` is decoration in a place the player is now rescued from.

Read the shared preamble in `../SKILL.md` first — the aesthetic law, the ten
harness traps, the baseline table, and the five conditions that make a block
done.

---

## The instrument, and its honest limits

`qa/rev-people.js` counts 20 m cells containing two or more props, on rings at
20 / 45 / 70 / 95 m from each spawn.

```
chapter      20 m   45 m   70 m   95 m
pantanal        0%    27%    18%     3%     spawn ring itself is empty
hanoi           0%    27%    18%    23%     spawn ring itself is empty
cave           14%     7%     9%    13%     sparse throughout
sydney         29%     7%     0%     3%
drift          29%     7%     0%     3%
monaco         29%    20%    18%     3%
pasto         100%     0%     0%     0%     everything is on the plaza
                     ---- for contrast ----
iceland       100%   100%    36%    27%
kyoto         100%    80%    36%    17%
manly         100%   100%    32%     3%
```

**This metric is indicative, not decisive.** A chapter that merges its scenery
into a few large meshes scores low even when it looks full — the counter skips
any mesh with a bounding radius over 60 m, because otherwise the terrain sheet
and the sky fill every cell.

**So every block in this group opens by looking at the chapter, not by trusting
the row.** Screenshot the ring in question first. If it is already full, say so,
fix the metric, and move on — an hour spent filling a field that was never empty
is the worst outcome available here. Sydney and Pasto are already corroborated
by screenshots (`qa/rev-syd-gardens.png`, `qa/rev-slope-pasto.png`) and by the
player's own report; the other five are not.

## What "filling" means here

Not props for the sake of density. Each of these chapters has a real place it is
modelling and the gap is that the modelling stops. The rule that keeps this from
becoming clutter: **anything added has to be a thing that would be there**, and
it has to be reachable, or it is a backdrop and belongs to a different budget.

Reuse the chapter's own builders and `PALETTE`. No new material families, no
textures, no hex outside `shared.js`.

---

# BLOCK 7 — SYDNEY'S GARDENS

**Est. 2–3 h.** The named complaint, and the first world every player walks in.

## The finding

`29% / 7% / 0% / 3%`. **At 70 m from the Sydney spawn, zero per cent of cells
have anything in them.**

A screenshot at **(58, 50)** — inside the named `gardens` zone, which
`envZONES.gardens` puts at x 14…62, z 4…58, so this is not past the edge — is
mown stripes, one hedge line, and a single white plane with a hard untextured
edge, and nothing else. `qa/rev-syd-gardens.png`. Look at it first.

## The work

1. **Find out what the white plane at roughly (48, 46) is meant to be.** It has
   a hard, flat, untextured edge lying on the grass and it reads as a
   placeholder. It may be a path that was never finished. Identify it before
   deciding whether to dress it or delete it.
2. **Dress the eastern gardens** on the patterns that already exist. `envBEDS`
   (`environment.js:497`) is a table of flower beds with a centre, half-extents
   and two palette colours — four of the six are already west of x = 55. The
   fig avenue, the benches, the hedges and the sandstone kerb all have builders.
   This is extending a system, not inventing one.
3. **Keep it inside the land box** (x ±70, z −10…70). Block 1 will have made
   walking past that a rescue rather than a stroll, so there is no value in
   decorating outside it.
4. **Sydney has no `terrainHeight`** — it is flat at y = 0 and the soft floor
   answers for the whole plane. That makes this the easiest chapter in the group
   to place things in, and it is why it goes first.

## Acceptance

- The **45 m and 70 m rings both over 40%**, from 7% and 0%.
- A screenshot from (58, 50) that reads as a garden. Looked at, not captured.
- `qa/rev-edge2.js` for Sydney unchanged — new scenery must not have been placed
  outside the fixed bounds.
- Triangle count and ms/tick stated before and after.

---

# BLOCK 8 — PASTO PAST THE PLAZA

**Est. 2–3 h.**

## The finding

`100% / 0% / 0% / 0%` — the sharpest shape in the game. **Everything in chapter
2 is within 20 m of the spawn and there is nothing beyond it.**

The screenshot at 25 m from the nearest task (`qa/rev-slope-pasto.png`) is a
vast empty green field of large flat triangles with a single shrub in it. The
chapter is 2 527 m up on the flank of a volcano and the four opening tasks —
the empanada, the market stall, the condor, the talons — are all on the plaza.

## The work

The walk to the crater is the chapter's spine and it is currently a bare
hillside. What belongs on it: the páramo the frailejones already model (they
exist as instanced vegetation, 420 of them — the density beyond 20 m is the
question, not the asset), field walls, a track, fence lines, the odd building,
the coffee terraces that `pastoCoffee` already builds 260 of.

Most of this is **redistributing what exists** rather than authoring new
geometry, which is what makes it a 2–3 h block rather than a day.

**Pasto's `terrainHeight` is 21.3% out** against the drawn mesh. GROUND block 3
should have fixed it; verify that first, because everything placed here is
placed by that law.

## Acceptance

- The **45 m and 70 m rings both over 35%**, from 0% and 0%.
- Screenshots on the walk from the plaza to the crater at 30, 60 and 90 m.
- `qa/rev-terr.js` for Pasto still under 10% — new geometry has not
  reintroduced a law/mesh disagreement.
- Triangle count and ms/tick before and after. Pasto was already 98 k.

---

# BLOCK 9 — PANTANAL & HANOI

**Est. 2–3 h.** The worst kind of empty: the spawn ring.

## The finding

Both read **0% at 20 m**. The first thing the player sees when the chapter
opens is nothing, which is a worse failure than a thin edge — a spawn is a
composed shot and both of these have had the composition drained out of them.

```
pantanal     0%   27%   18%    3%
hanoi        0%   27%   18%   23%
```

**Check the metric here before anything else.** Hanoi is a city and Pantanal is
a wetland with a channel; both are plausible candidates for the merged-mesh
under-count described at the top of this file. Screenshot both spawns first. If
the frames are full, the finding is that the metric is wrong, and that is a
legitimate outcome of this block — write it down and fix the counter.

If the frames are genuinely thin, both chapters have a documented spawn
intention worth honouring: `main.js` carries a paragraph for each explaining
what the opening shot is meant to say. Read it before adding anything, and add
what that paragraph is asking for.

## Acceptance

- Either the **20 m ring is over 50% in both**, or the metric is corrected and
  the corrected number is reported with a screenshot that justifies it.
- Both spawn frames screenshotted and looked at.
- `qa/rev-terr.js` and `qa/props.js` no worse for either.

---

# BLOCK 10 — SON DOONG, THE DRIFT, MONTE CARLO

**Est. 2–3 h.** Three chapters, and the first two need a judgement before work.

## The finding

```
cave      14%    7%    9%   13%    sparse throughout, drawn to only 72 m
drift     29%    7%    0%    3%
monaco    29%   20%   18%    3%
```

## The judgement each needs first

**Son Doong is a cave and sparse may be correct.** The largest cave passage on
earth is mostly empty air and the chapter is about scale and dark. Its 14% at
20 m may be the chapter working. But it is also **drawn to only 72 m, the
shortest in the game, with 4 of 16 settle points over nothing** — so the
question is not "is it too empty" but "does it end too soon". Treat it as a
reach problem, not a density one.

**The Drift is an air biome** and the ring metric measures a ground plane it
does not have. Its 0% at 70 m is close to meaningless. What it does have is 27
walk-through hits, mostly `dri:fardress` — far scenery, almost certainly
unreachable. Verify the player cannot reach it and then leave the Drift alone;
"this chapter is fine and here is why" is a good result.

**Monte Carlo is the real one of the three.** 29/20/18/3, and it is a dense
place in life — a harbour packed with boats, a terrace, a town stacked up a
rock. It also had the worst law/mesh disagreement after Manly (37%) and a 14.9 m
error at (10, −80), so GROUND block 3 must be verified before placing anything.

## The work

Monte Carlo gets most of the block. Son Doong gets its reach extended if block 2
did not already do it. The Drift gets a written verdict and probably no code.

## Acceptance

- Monte Carlo's **45 m and 70 m rings both over 35%**.
- Son Doong drawn to **at least 110 m** on every bearing, or a written note that
  the cave legitimately ends and is bounded there — block 1's `bounds()` makes
  that a defensible answer rather than a hole.
- The Drift: a written verdict, with the reachability test that supports it.
- `qa/rev-terr.js` for all three still under 10%.
- Frame time before and after for Monte Carlo.

---

## Closing the pass

When block 10 is done, re-run the whole instrument set and reprint the table:

```bash
node qa/rev-summary.mjs
```

Then write the result up beside the baseline in `../SKILL.md` so the next pass
starts from measured numbers rather than from this one's intentions — and say
plainly which rows did not move and why.
