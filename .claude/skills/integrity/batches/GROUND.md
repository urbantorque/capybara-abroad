# GROUND — what each chapter says about itself

**Est. 6–9 h. Blocks 1, 2, 3. A commit at each boundary.**

Every chapter publishes an API object that describes its own world: where the
ground is (`terrainHeight`), how steep it is (`slopeAt`), where the water is,
and — in four of nineteen — where it stops (`bounds`). This group makes those
descriptions true.

**It runs first because everything else measures against it.** Until block 1
lands, every probe run in this pass includes animals standing in voids outside
the built world, and those samples contaminate the baseline that blocks 4–10
grade themselves against.

Read the shared preamble in `../SKILL.md` first — the aesthetic law, the ten
harness traps, the baseline table, and the five conditions that make a block
done.

---

# BLOCK 1 — EDGES

**Est. 2–3 h.** Possibly much less; see the shortcut below.

## The finding

The only thing in the game that can notice you have left the world is
`backVoid()` (`systems.js:17131`), and it checks two things: an absolute floor
at y = −90, and the chapter's own `bounds()` rectangle. **Only Sydney, Pasto,
Rio and Quay publish `bounds()`.**

The other fifteen are unbounded, and because every chapter's `terrainHeight` is
an analytic law that answers for the whole infinite plane, you never fall
either — the soft floor in `capybara.js` catches you on the second frame and you
stand on invisible ground indefinitely.

Measured, teleporting out one bearing at a time with 2.5 s at each step:

```
chapter      world drawn to   bearings rescued   metres of nothing walkable
sydney            136 m            8 / 8         0
pasto             184 m            8 / 8        24
rio               208 m            8 / 8         0
quay              224 m            4 / 8        bounds are 880 m wide
cave               72 m            0 / 8        never
kowloon            96 m            0 / 8        never
venice, palawan   120 m            0 / 8        never
pantanal          136 m            0 / 8        never
...and ten more                    0 / 8        never
```

## The shortcut — try this first, it is worth 30 minutes

**Do not hand-derive fifteen rectangles.** `main.js:256` already keeps

```js
const sets = new Map();   // name -> { objects:[], bodies:[], api, built }
```

so every biome's colliders are tracked by chapter. A default `bounds()` can be
computed **once, generically**, from the union of that biome's static body
AABBs, and handed to all nineteen.

Bodies rather than objects, deliberately: a collider is what "the world exists
here" actually means, and an objects-based box would be blown out to the radius
of the sky dome and the haze shell.

Spend 30 minutes computing those boxes and printing them next to the measured
"drawn to" column above. If they come out sane, this block is mostly done and
only the two special cases below need hand work. If a chapter comes out wrong —
a seabed plate that runs to the horizon, the Drift, which has no floor at all —
that chapter falls back to a hand-written rectangle, and the generic default
still saves the other twelve.

## The work

1. **`sysBiomeBounds(name)`** or equivalent in `main.js`: union of the AABBs of
   that chapter's static bodies, cached on first call, invalidated when the
   chapter rebuilds. Padding: enough that a legitimate edge of the world is not
   a rescue. `sysVOID_PAD` already adds 4 m on top.
2. **A chapter's own `bounds()` wins.** Sydney, Pasto, Rio and Quay have
   hand-written rectangles that were reasoned about; the computed default is a
   fallback for a property miss, exactly the way `climbHold` and `localWater`
   already work. Do not overwrite them.
3. **Sydney is a real fix, not a default.** `environment.js:483`:

   ```js
   const envBOUNDS = { x0: -142, x1: 142, z0: -152, z1: 96 };
   ```

   The comment above it is honest — it is the **union** of the land box
   (x ±70, z −10…70) and the harbour (x ±140, z −150…−10). But the union of two
   rectangles that meet at a corner is a much bigger rectangle, and the two
   off-diagonal quadrants are inside it with nothing in them. Measured walking
   out of the gardens: last collider 52–72 m, rescue not until another 40–80 m.

   Replace with a two-rectangle test — inside the land box **or** inside the
   harbour box. `backVoid` reads `bounds()` once per frame and compares four
   numbers; returning a small array of rectangles instead needs a two-line
   change there and nothing else.

4. **Decide Quay deliberately.** Its bounds are 880 m wide because the ferry
   route is 700 m long, so on foot the chapter is effectively unbounded (4/8
   rescued only because two bearings ran off the far end). Either a tighter
   rectangle that applies while not at the helm, or accept it and write down
   why. Do not leave it undecided.

5. **The Drift has no floor.** Chapter 9 is an air biome; `rev-edge2` finds
   nothing drawn beneath any bearing, which is correct. Its bounds must come
   from the isles and the far dressing, not from a body union that is mostly
   empty. Hand-write this one.

## Acceptance

Re-run `qa/rev-edge2.js`.

- **8/8 rescued in all nineteen chapters** (the Drift may legitimately be
  measured differently — say so if it is).
- **Sydney's grey-walk drops from a median 60 m and a worst 80 m to under 10 m.**
- No chapter rescues the player somewhere they can still see the world from:
  spot-check three by walking to the edge and screenshotting the frame before
  the rescue fires.

---

# BLOCK 2 — MANLY & SON DOONG

**Est. 2–3 h.** This is diagnosis. See the timebox.

## The finding

Comparing each chapter's terrain law against the ground actually drawn beneath
it, **Manly is an outlier by a factor of ten**: mean signed error **+1.29 m**,
and 37.8% of samples out by more than 15 cm.

Standing the animal at **(−70, 110)** — inside the chapter, 99 m from the
nearest task — `terrainHeight` returns 2.60, the animal settles on the analytic
soft floor at y 2.78, and a downward ray finds **no drawn geometry at all within
80 m**. It floats in an empty beige void with no shadow, and because Manly
publishes no bounds, nothing puts it back. The screenshot is
`qa/rev-manly-float.png`; look at it before starting.

The worst cluster is a run of +2.6 m at x = −75, z = 101…141, with a peak of
+5.54 at (−55, 131) — the North Head end.

Son Doong is the same shape one tier down: mean float +0.35 m, worst +2.24 m,
and **4 of 16 settle points within 62 m of spawn with nothing drawn beneath
them**. Its world stops being drawn at 72 m, the shortest in the game.

## The work

Manly first. The likely causes, in the order worth testing:

1. A headland or hill term in `terrainHeight` with no matching mesh — the law
   describes a landform that was never built, or was built and then moved.
2. A mesh that was moved and the law was not. `manly.js` draws North Head and
   the west headland; the solidity audit gave them colliders in an earlier pass,
   so the collider and the mesh agree and the *law* is the odd one out.
3. The law answering over water. If `terrainHeight` is not meant to describe the
   sea floor, it should return `NaN`, not a number — `capyAskNum` already drops
   a non-finite answer and falls back, and that is the designed escape.

Then Son Doong. A cave is an interior; the law describing floor where the
cavern has ended is the same bug in a different shape.

**Both chapters get block 1's `bounds()` verified as part of this block** — a
void the player cannot reach is a much smaller problem than one they can, and
these two are the chapters where that difference is largest.

## The timebox

If Manly is not diagnosed in **90 minutes**, stop and do the honest smaller
thing: make `terrainHeight` return `NaN` outside the region it can actually
describe, so the soft floor stops holding the animal up over nothing and
`backVoid` catches it. That is a correct fix, it is twenty minutes, and it
converts a silent float into a rescue. Then move Son Doong to block 3 and say so.

## Acceptance

- `qa/rev-terr.js`: **both chapters under 8%** over 15 cm (from 37.8 and 10.4).
- `qa/rev-foot.js`: **zero void settle points** in both (from 0 and 4 — note
  Manly's void does not show in the 16-point sample, it shows at 110 m; test the
  measured point explicitly).
- (−70, 110) in Manly either has ground drawn under it or is outside bounds and
  rescued. State which.
- **`qa/props.js`, `qa/pointers.js` and `qa/audit-locals.js` no worse.** A
  terrain change moves everything that reads it.

---

# BLOCK 3 — THE LAW TIER

**Est. 2–3 h.** Front-loaded with a hypothesis test that may finish it early.

## The finding

The next tier of `terrainHeight`-vs-mesh disagreement:

```
chapter      % of samples out by >15 cm    worst float
monaco                37.0                   +0.69 m
pasto                 21.3                   −0.26 m
antarctic             16.4                   +0.83 m
rio                   15.8                     —
drift                 15.4                   +0.01 m
cali                  13.2                   +0.15 m
```

Monte Carlo also showed a **14.9 m disagreement** measured at (10, −80):
`terrainHeight` returned −12.34 where the drawn ground is at +2.60. That is
almost certainly the law answering over the harbour when it should not.

## The 45-minute hypothesis test — do this first

**The hypothesis: the analytic law is smooth and the drawn mesh is faceted, so
the law sits above the triangle plane in the middle of every facet.** Pasto's
screenshot (`qa/rev-slope-pasto.png`) shows exactly this — very large flat
triangles, and the animal riding ~32 cm high in the middle of one.

If that is the cause, the error should correlate with **distance from the
nearest heightfield vertex**, and the fix is one shared helper — sample the law
at the facet corners and interpolate the way the mesh does — not six chapter
edits.

Spend 45 minutes testing it: for each sample point, record the error and the
distance to the nearest grid vertex, and look for the correlation.

- **If it holds:** write the shared helper, apply to all six, and this block
  finishes in well under three hours.
- **If it does not:** the block's scope drops to **Monte Carlo and Pasto only**
  — the two worst — and Antarctica, Rio, the Drift and Cali become block 3b.
  Say so in the report. Do not silently run long.

## The work

1. Monte Carlo first regardless of the hypothesis: establish where the law is
   *meant* to answer, and return `NaN` everywhere else.
2. Pasto: 21.3%, and it is chapter 2, which every player reaches.
3. The rest as the hypothesis allows.

## Acceptance

- `qa/rev-terr.js`: **no chapter above 10%** over 15 cm — or, if the hypothesis
  failed, Monte Carlo and Pasto under 10% and a written 3b for the rest.
- Monte Carlo's (10, −80) reads a sane number or `NaN`.
- **`qa/props.js`, `qa/pointers.js`, `qa/audit-locals.js` no worse.**
- `qa/rev-foot.js` mean gap unchanged or better in all six. A law fix that
  makes the animal float *more* has moved the law the wrong way.
