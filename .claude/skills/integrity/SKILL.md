---
name: integrity
description: Run the integrity pass on capy3 — the ground work that comes after /polish and /presence. Ten numbered blocks of 2–3 h, each one commit. `/integrity 1` runs one block. `/integrity ground|contact|content` runs a group. Bare `/integrity` runs all ten in order. Use when the user types /integrity, or asks to run the integrity pass, the edges work, the bounds work, the terrain law, the slope pose, the cliff colliders, the crowd colliders, or the empty rings. `/integrity list` prints the plan without running anything.
---

# THE INTEGRITY PASS

The audit behind this is the artifact published 28 Aug 2026 and the raw probe
output in `qa/rev-*.json.png`. Every figure below was measured off `master` at
a3a5633 under `playwright-cli`, not estimated or read off the source.

The one-line version: **/polish gave the floor a texture, /presence gave it
light. Neither of them asked whether the floor is where the game says it is,
whether it stops anywhere, or whether the animal is standing on it.** It is
not, it does not, and in six chapters it is not.

Three findings are global and single-cause. They are not nineteen bugs:

1. **Fifteen of nineteen chapters have no `bounds()`**, so `backVoid()` can
   never fire and you walk on invisible ground for ever.
2. **The capybara model is never pitched to the ground.** `rotation.x` is a
   speed lean, `rotation.z` is a turn roll, the legs are sine waves. Seventeen
   chapters publish `slopeAt()` and it is read for walking speed only.
3. **`terrainHeight` disagrees with the drawn mesh** — by a mean +1.29 m in
   Manly, where the animal stands in an empty void with nothing under it.

Task wiring is clean: all 231 have a completion path. A task that will not
complete in play is a reachability problem, which is why this pass fixes the
ground and nothing else.

## Dispatch

**No argument — the default.** Run all ten blocks in order, reading the batch
file for each group and following it exactly. ~22–28 h, **a commit at every
block boundary.**

| arg | what | est. |
|-----|------|------|
| *(none)* | all ten blocks, in order | 22–28 h |
| `1`–`10` | one block | 2–3 h |
| `ground` | `batches/GROUND.md` — blocks 1–3 | 6–9 h |
| `contact` | `batches/CONTACT.md` — blocks 4–6 | 6–9 h |
| `content` | `batches/CONTENT.md` — blocks 7–10 | 8–12 h |
| `list` | print the tables below and stop | — |

| # | block | group | est. |
|---|---|---|---|
| 1 | **Edges** — a generic `bounds()` for all 19, then Sydney and Quay | ground | 2–3 h |
| 2 | **Manly & Son Doong** — the two worst terrain laws, and the voids | ground | 2–3 h |
| 3 | **The law tier** — Monte Carlo, Pasto, Antarctica, Rio, Cali, the Drift | ground | 2–3 h |
| 4 | **The animal on the hill** — slope pose in `capybara.js` | contact | 2–3 h |
| 5 | **Cliffs I** — Göreme, Monte Carlo, Sahara | contact | 2–3 h |
| 6 | **Cliffs II and the crowds** — Cali, Rio, Kyoto; then every instanced crowd | contact | 2–3 h |
| 7 | **Sydney's gardens** — the 45–95 m ring | content | 2–3 h |
| 8 | **Pasto past the plaza** | content | 2–3 h |
| 9 | **Pantanal & Hanoi** — the empty spawn rings | content | 2–3 h |
| 10 | **Son Doong, the Drift, Monte Carlo** | content | 2–3 h |

### Order, and the two dependencies that are not negotiable

**Block 1 runs first, always.** Until every chapter has bounds, every later
probe run includes animals standing in voids, and that contaminates the
baselines every other block grades itself against.

**Block 4 runs after blocks 2 and 3.** The slope-pose fix reads `terrainHeight`
to get its gradient. Tuning it in Manly against a law that is out by +1.29 m and
sometimes describes ground that is not drawn means tuning it against a fiction.
This one is easy to miss and it is the reason CONTACT is not first.

**Blocks 7–10 run after GROUND.** New scenery placed against a wrong terrain law
lands at the wrong height.

Blocks 5 and 6 depend on nothing. They are the right filler if a GROUND block
finishes early, and the right work for a second session running in parallel.

An unrecognised argument: print the tables and ask.

---

## Rules that apply to every block

### The aesthetic law is not negotiable

From `CONTRACT.md`. A block that breaks one of these is a failed block:

- **No textures. No image files.** Procedural shader work and geometry only.
- `MeshLambertMaterial` with `flatShading: true`, via `mat()` in `shared.js`.
  No PBR, no `MeshStandardMaterial`, no metalness/roughness, no env maps.
- Colours come from `PALETTE` in `shared.js`. Never a hex outside that file.
- Every top-level name carries its module tag (`sys`, `env`, `capy`, `phys`,
  `npc`, `wx`, and the chapter tags). The bundler concatenates into one scope.
- `export function` only. No default exports, no `export const`, no classes.
- Imports only at the top, only in the three permitted forms.
- Silhouette-first: it must read from the fixed ~35° overhead-behind camera.

### This pass is CORRECTIVE, not additive — and that changes the safety rule

`/presence` put every change behind an option defaulting to today's behaviour,
so it was revertible one call site at a time. **That rule does not apply here.**
A wrong number is being replaced by a right one; there is no "current behaviour"
worth defaulting to.

So the revert unit is **the commit**, not the call site, and commit discipline
carries more weight in this pass than it did in the last two. One block, one
commit, and the commit message names the before and after number.

The one exception is block 4, which changes how the animal is DRAWN in all
nineteen chapters at once. That one gets a module-scope constant that can be set
to zero to disable it, because it is the only change in the pass that could be
disliked rather than merely wrong.

### Commit at every block boundary

Not optional. It is what makes a twenty-eight-hour pass ten commands instead of
one, and it is the only thing that makes an interrupted run survivable. Stop
cleanly at a boundary and what has landed is coherent.

### Measure before, measure after — the numbers already exist

Never report a block done on a single green run. This pass is better placed than
the last two: there is a **measured baseline for all 19 chapters on six
instruments**, so every block states a before and an after from the same probe,
in the same session, as a number.

| probe | what it gives | run as |
|---|---|---|
| `qa/rev-edge2.js` | per bearing: where the world stops being drawn, and whether you are rescued. **It starts its rescue scan AT the drawn edge, so it cannot detect a rescue that fires too EARLY** — use `rev-walk.js` for that | `run-code` |
| `qa/rev-walk.js` | 25 s of real sprinting per bearing, real key events. The only instrument here that can catch an early rescue | `run-code` |
| `qa/rev-terr.js` | `terrainHeight` vs the drawn mesh, % of samples over 15 / 30 cm | `run-code` |
| `qa/rev-foot.js` | model feet vs drawn ground after settling; float, sink, void points | `run-code` |
| `qa/rev-world.js` | the hook matrix, slope-burial %, collider coverage, dead area | `run-code` |
| `qa/rev-people.js` | local bodies, instanced-crowd solidity, scenery density rings | `run-code` |
| `qa/audit-solid.js` | walk-through structures ≥1.6 m — **drifts between runs, judge by object identity not by the total** | `run-code` |
| `qa/rev-tasks.mjs` | task completion wiring | `node`, no browser |
| `qa/rev-summary.mjs` | prints the whole 19-chapter table from the JSON | `node`, no browser |

### THE BASELINE, 28 Aug 2026

Blocks compare against this. `rev-summary.mjs` reprints it from the raw JSON.

```
  #  chapter    | bnd | drawn resc | pose>10 >20 | law15 | float void | solid | scenery 20/45/70/95
  1  sydney     |  Y  |  136  8/8  |   —     —   |   —   | 1.21   0  |    0  |  29/  7/  0/  3
  2  pasto      |  Y  |  184  8/8  | 57.1  49.3  | 21.3  | 0.05   0  |   58  | 100/  0/  0/  0
  3  quay       |  Y  |  224  4/8  |  2.3   2.3  |  2.8  | 0.25   0  |    3  |  57/ 40/  5/  0
  4  kyoto      |  .  |  224  0/8  | 10.1   1.8  |  5.0  | 0.02   0  |   31  | 100/ 80/ 36/ 17
  5  cali       |  .  |  240  0/8  | 31.8  23.3  | 13.2  | 0.15   0  |   42  |  86/ 47/ 23/  0
  6  rio        |  Y  |  208  8/8  | 53.8  30.4  | 15.8  | 0.03   4  |   21  |  43/ 27/ 18/ 13
  7  iceland    |  .  |  328  0/8  |  5.8   1.8  |  7.6  | 0.58   3  |    1  | 100/100/ 36/ 27
  8  sahara     |  .  |  176  1/8  |   —     —   |  0.5  | 0.00   0  |   32  | 100/ 53/ 50/ 33
  9  drift      |  .  |  air  0/8  |   —     —   | 15.4  | 0.01   0  |   27  |  29/  7/  0/  3
 10  venice     |  .  |  120  0/8  |  9.3   9.0  |  3.2  | 0.00   2  |    2  |  71/ 47/ 41/ 17
 11  kowloon    |  .  |   96  0/8  |   —     —   |  6.2  | 0.00   5  |    2  | 100/ 60/ 27/  7
 12  palawan    |  .  |  120  0/8  |  0.2    —   |  1.0  | 0.05   0  |    4  |  57/ 27/ 32/ 17
 13  goreme     |  .  |  200  0/8  |  8.5   1.7  |  7.0  | 0.08   3  |   47  |  43/ 27/  0/ 13
 14  manly      |  .  |  160  0/8  | 36.2  20.5  | 37.8  | 4.00   0  |    1  | 100/100/ 32/  3
 15  pantanal   |  .  |  136  0/8  |  1.3   1.2  |  5.0  | 0.14   2  |    6  |   0/ 27/ 18/  3
 16  cave       |  .  |   72  0/8  |  5.3   3.7  | 10.4  | 2.24   4  |    3  |  14/  7/  9/ 13
 17  antarctic  |  .  |  216  0/8  | 74.5  16.2  | 16.4  | 0.83   0  |    1  | 100/ 60/ 14/  0
 18  monaco     |  .  |  368  0/8  | 44.1  36.5  | 37.0  | 0.69   0  |   13  |  29/ 20/ 18/  3
 19  hanoi      |  .  |  176  0/8  |  1.1   1.0  |  4.3  | 0.05   1  |    0  |   0/ 27/ 18/ 23
```

### THE `law15` COLUMN ABOVE IS WRONG. CORRECTED 28 Aug, block 2.

`rev-terr.js` took "the highest visible hit at or **below** `h + 1.0`" as the
drawn ground. Wherever the mesh sat above the law the mesh was rejected and the
ray fell through to whatever was underneath — a seabed, a lower terrace, the
ground under a building — and the error read as a large POSITIVE. That is most
of what made **Manly look like a mean +1.29 m outlier: corrected, its mean
signed error is +0.016 m.** The probe is fixed; it now takes the highest
visible surface, skips water (seabed vs sea surface is not an error) and skips
samples outside the chapter's own bounds.

**Block 3 must use these numbers, not the ones in the table above:**

```
monaco 40.9   quay 24.7   rio 23.5   cali 19.6   antarctic 19.3   pasto 19.2
manly 25.5*   cave 14.3*  iceland 13.4   venice 11.5   pantanal 11.0
goreme 11.3   drift 9.5   kowloon 8.0   kyoto 5.1   hanoi 4.6   sahara 2.2
                                                     palawan 1.6
* after block 2
```

Quay and Rio are new entrants that the old instrument was hiding; Manly does
NOT drop out, but for a different reason than the one on the card (see block 2).
Monte Carlo is still the worst and by a wide margin.

### AND `law15` IS STILL NOT A TERRAIN METRIC. BLOCK 3, 28 Aug.

Corrected, it compares the law against **the highest drawn surface**, which over
a town is a roof. Quay went 2.8 → 24.7 not because its terrain is wrong but
because it has an arcade, a terminal and a CBD. `law15` measures *buildings*.

**The honest terrain metric is `qa/b3-ground.js`: the heightfield collider
against the nearest drawn surface to it.** If the drawn ground and the collider
are the same surface it reads ~0 whatever is built on top, and it is
DETERMINISTIC — two consecutive runs gave identical figures to three decimals.
Use this one for terrain work, not `law15`.

```
collider vs drawn ground, mean|e| m / % >15 cm / % >50 cm
pasto    0.202  30.7  13.9   <- worst, and it is by construction; see block 3
monaco   0.110  17.2   5.4   <- after block 3 (was 18.6 / 6.1)
rio      0.100  11.4   4.1
iceland  0.106   9.6   3.1
manly    0.034   6.8   0.2      cave 0.032 5.4 1.0      antarctic 0.031 4.5 0.0
venice   0.021   3.2   0.3      kyoto 0.013 1.8 0.2     sahara 0.014 0.7 0.0
goreme   0.088   1.2   0.7      pantanal 0.011 0.8      palawan 0.010 0.0
hanoi    0.001   0.4   0.0
cali    -3.112 signed, kowloon -8.703 signed: MEDIAN is fine, a small minority
        of points sit a very long way off. Not diagnosed. Worth a look.
```

**And `props.js` is contaminated by a long session.** Run late in a page that
has switched through all nineteen chapters it reported 260 props in Sydney and
twelve bad ones, the same prop appearing in two chapters at identical
coordinates. On a fresh page: 49, none bad. Open a new browser before it.

**`b3-perf.js` does not hold a line either.** Sydney's median went 0.8 → 1.7
ms/tick between two runs with nothing touching Sydney. Do not compare frame time
across browser sessions.

**And `rev-foot.js` does not hold a line in Son Doong.** Four runs of identical
code: mean gap 0.021 / 0.025 / 0.068 / 0.321, worst float 0.14 / 0.19 / 0.67 /
2.24, on n = 15. Manly over the same four runs is 0.237–0.249 and stable. Treat
any single cave foot number as indicative only; the chapter's settle points land
on boulders and the doline lip and it matters where. Same family as
`audit-solid.js`.

`bnd` publishes `bounds()` · `resc` bearings rescued of 8 · `pose>10/>20` % of
walkable ground where the flat-drawn nose or tail is that far off · `law15` % of
samples where `terrainHeight` is out by >15 cm · `float` worst float in m ·
`void` settle points of 16 with nothing drawn beneath · `solid` walk-through
hits, foliage included · `scenery` % of 20 m cells with 2+ props, indicative
only.

### The regression risk that is specific to this pass

**`terrainHeight` is read by five other systems**: the soft floor in
`capybara.js`, the hint arrow, the local anchors, prop placement, and the
stuck-rescue. Changing it can break all five silently.

So blocks 2 and 3 do **not** finish by re-running `rev-terr.js` alone. They must
also re-run `qa/props.js` (props under the terrain or asleep in mid-air),
`qa/pointers.js` (tasks the card cannot point at) and `qa/audit-locals.js`
(people standing in the ground). A terrain fix that moves a chapter's props
underground is a failed block.

### The verification loop

```bash
node build.mjs
```

Server: `node server.mjs` with `PORT=5188` (5173 is often taken; 5188 may
already be up from an earlier session, which is fine — check with curl before
starting another). Then

```bash
playwright-cli -s=integrity open http://localhost:5188/
```

and `playwright-cli -s=integrity run-code --filename=qa/<probe>.js`.
`playwright-cli close-all` at the end.

**Harness traps. The first two are new to this pass and each produced a
confident, completely wrong result before it was caught:**

1. **A probe that never presses a key on the title card measures a game that has
   not started.** `backVoid()` sits behind `if (started)` in `systems.js:18005`,
   so a rescue probe that skips the title reports "never rescued" for all 19 and
   it means nothing. Press a chapter digit, then assert `state.started` before
   measuring anything.
2. **A downward ray cast from well above the animal hits the roof of whatever it
   is standing under.** The first foot-gap run reported 5–7 m of "sinking" that
   was a rooftop over its head. Cast from just above the feet — 0.30 m is the
   whole sink range worth reporting anyway.
3. **Chapter keys are 1-based**: `Digit1..Digit9`, `Digit0`, then `Minus`
   `Equal` `BracketLeft` `BracketRight` `Semicolon` `Quote` `Comma` `Period`
   `Slash`. So **Manly is `BracketRight` and `Period` is Monte Carlo** — that
   was mis-guessed during this audit and only the assertion caught it. **Assert
   `g.biome.current` in every row of every result.**
4. `playwright-cli navigate` to the URL already loaded **does not reload** and
   the ES modules stay cached, so a source edit looks like it had no effect.
   `close-all` then `open` is the only reliable reload.
5. `run-code` operates on whatever the page currently is. Start every script
   with `await page.reload()` and a 4.5 s wait.
6. `run-code` needs `--filename=`. It prints neither `console.log` nor the
   return value. Get data out by POSTing base64 to `/shot?name=X` and reading
   `qa/X.png` — JSON comes back as `qa/X.json.png`. **`btoa` exists only inside
   `page.evaluate`**, not at the script's top level.
7. A single `page.evaluate` longer than ~20–30 s dies. Split per chapter.
8. A script file must be a bare `async page => { ... }`. A leading comment or a
   trailing semicolon is a SyntaxError.
9. **The game saves to `localStorage["capy3.journey.v1"]`**, so completed tasks
   survive a reload. Any run that asserts on task state opens with
   `page.addInitScript(() => localStorage.clear())` — but never install that for
   a test that must WRITE a save and reload to check it survived.
10. **A heredoc in the Bash tool eats one backslash of each pair, even quoted.**
    Write any script containing a regex escape with the Write or Edit tool.

### The extents convention is per-helper and it is checkable

Every chapter has a `<tag>StaticBox` helper and **they do not agree**. Read the
signature before every call:

- `(game, x, y, z, hx, hy, hz, ry)` — **half** extents, passed straight to
  `CANNON.Box`. Cali, Kyoto, Quay.
- `(game, x, y, z, sx, sy, sz, ry)` — **full** extents, halved internally.
  Monaco, Rio, Cave, Iceland.
- Göreme, Manly and Kowloon carry an explicit `CONTRACT:` comment above the
  helper. Read it.

When the drawn box uses `rand()` for its size, hoist the size into a local and
pass the same numbers to both calls, or the solid thing is a different shape
from the seen one.

### What "done" looks like

1. The block's acceptance test passes, **with the number shown**, against the
   baseline above.
2. `node build.mjs` succeeds and the game boots with `game.state.lastError`
   still null after a 60 s soak in at least two affected chapters.
3. For blocks 2, 3 and 7–10: `qa/props.js`, `qa/pointers.js` and
   `qa/audit-locals.js` are no worse than they were.
4. Before/after screenshots exist in `qa/` and have been **looked at**. Not
   "captured" — looked at.
5. One commit, whose message names the before and after number.
6. The aesthetic law still holds — say so explicitly.

Report honestly. If you stopped early, say at which block boundary and why;
scaling this down is the user's call, not yours.

### AND THE `pose>10 / >20` COLUMN IS NOT A MODEL METRIC EITHER. BLOCK 4, 28 Aug.

It is `bur10pct` / `bur20pct` in `qa/rev-world.js`, and it is computed entirely
from `terrainHeight`: the largest height difference between a sample and its
neighbours at ±0.45 m in x and z. **It never touches the capybara.** It is a
measure of how rough the ground is, and nothing in `capybara.js` can move it —
block 4's stated acceptance of "under 10% in all nineteen" was unachievable by
construction. That is a third instrument in this pass that measured something
other than the thing named on the card.

**The honest pose metric is `qa/b4-pose.js`: the four DRAWN feet against the
DRAWN ground, after settling on real walkable slope.** It reports the spread
between the highest and lowest foot, which is zero on any pose that fits the
hill and is the slope's own rise across the animal on one that does not.

It also splits its sites by whether the terrain LAW and the drawn ground agree
within 15 cm at that point (`sprAgree` vs `sprMean`). They must be split: where
they disagree the animal is posed against one surface and photographed against
another, and no pose can be right there. That residue is block 3's and block 8's
business, not block 4's.

```
four-foot spread on agreeing sites, m — capyPOSE_TERRAIN 0 -> 1
antarctic 0.443 -> 0.020    cali    0.402 -> 0.024    rio    0.421 -> 0.045
monaco    0.411 -> 0.087    pasto   0.402 -> 0.035    manly  0.246 -> 0.013
hanoi     0.396 -> 0.105    goreme  0.221 -> 0.046    venice 0.053 -> 0.065
iceland   0.390 -> n/a (7 of 10 sites slide away on the ice; unmeasurable here)
kowloon, quay: no walkable slope at all, so the pose never fires
```

**THE DIRECTION ON THE CARD IS BACKWARDS.** The collider is a chain of three
spheres and on a slope it rests on the UPHILL one, so the animal FLOATS: mean
gap +0.28 m in Monte Carlo, +0.27 in Rio, +0.21 in Antarctica. It reads as
sinking because the downhill feet hang in the air while the uphill end is buried.
The only chapter that genuinely sinks is Pasto, and that is block 3's unfixed
drawn-above-collider finding, not the pose.

**A CENTRAL DIFFERENCE IS THE WRONG ESTIMATOR FOR A POSE.** At a break of slope
it averages the two sides. Monte Carlo at (−11.8, −105.6): the law is dead flat
for 1.2 m one way and falls 1.38 m in 1.2 m the other, and a central difference
called that 33° and tipped the animal backwards off a terrace it was standing on
top of — 32° of pitch AND 32° of roll on level ground. `capyPoseFit` replaces it
with the supporting line of the three samples, which is what a rigid body
actually rests on. Any future code that reads a gradient to pose or place
something wants the same treatment.

**And two more harness traps, both of which produced confident wrong numbers:**

11. **A downward ray from 0.6 m above the animal's foot starts INSIDE its
    barrel.** Every chapter read a flat −0.51 m of "sink" — the capybara's own
    back. Set `capy.group.visible = false` around the ray. This is trap 2's
    twin and it is not the same fix.
12. **Choosing slope sites by steepness alone puts every sample on a cliff.**
    The first run measured nine chapters at 55–58°, which is ground the animal
    cannot stand on and is block 5's subject, not block 4's. Band the gradient
    to walkable — 0.20 to 0.75, i.e. 11° to 37° — and reject any site the animal
    slides more than 6 m from.

### BLOCK 5, 28 Aug. THE COLLIDERS ALL EXISTED. THEY WERE THE WRONG SIZE.

Not one of the three chapters was missing a landform body. Göreme's ridge is
eighty pooled boxes, its cliff is six, its chimneys have had four bodies since
the solidity pass; Monte Carlo's Rock has five; Marrakech's food stalls have one
each. Every walk-through hit in all three was a collider that stopped short of
the mesh it belonged to:

```
goreme  gorRidge   drawn as cones of base radius 20-31, made solid as boxes
                   26 and 34 wide - 18 to 23 m of skirt with nothing behind it
        gorCliff   ribs drawn to faceX, batter tapers proud to faceX + 2.6,
                   cornice overhanging to faceX + 1.2, box east face at -0.2
        chimneys   cones of radius rb, boxes 1.55 rb across = 0.775 rb at the
                   cardinals, so a fifth of every waist
monaco  the Rock   nine arcade columns, sixteen 11 m cypresses and the whole
                   seaward parapet of the ramp, none of them bodied at all
sahara  stalls     box at y 1.1 +- 0.5, so it began 60 cm off the ground
```

```
audit-solid hits          before -> after      target
goreme                       41 -> 17          under 12: NOT MET
monaco                       14 ->  0          under  3: met
sahara                       30 -> 27          under  6: NOT MET
```

**gorRidge and gorCliff are absent from the hit list**, which is the identity
test the card asks for. **gorValley is not** — 3 hits remain. Göreme's residue is
the TOWN mesh (5) and the balloon FIELD mesh (6), neither of which is a landform.
Sahara's residue is 11 hits on its own dune sheet and erg mesh, which is the
terrain law disagreeing with the drawn sand and NOT a missing collider — that is
block 3's and block 8's business, and it is why "under 6" was never reachable
here.

**THE ACCEPTANCE TEST THE CARD ASKS FOR IS A NUMBER, NOT A SCREENSHOT.**
"Nothing new blocks a path that used to be walkable" is measurable and
`qa/b5-rock.js` measures it: sample the walkable ground, ask whether the
capybara's own collider (three spheres of r 0.34 at ground + 0.34) overlaps a
static box, and for every point that does, raycast down and ask whether anything
is DRAWN above it. Ground blocked under drawn rock was always rock; ground
blocked under nothing is what this block cost.

```
blocked sample points of 2116     before -> after     of which under NOTHING
goreme                             298 -> 405              6 -> 27
monaco                             102 -> 104              2 ->  4
sahara                             102 ->  97             14 -> 14
```

So Göreme gained 107 points of honest rock and 21 points of over-block — one per
cent of the chapter, on the diagonals of the ridge skirt.

**Two more traps, and the second one wasted half an hour:**

13. **`audit-solid.js` cannot see a collider whose bottom is above
    `terrain + 0.55`.** It casts one horizontal ray at that height. Marrakech's
    food stalls read as six walk-through hits with a perfectly good box on
    them, because the box spanned y 0.6 to 1.6 and the ray went underneath it.
    The capybara's collider tops out at 0.68 so it *did* catch the counter —
    the audit is stricter than the game here, and a hit at exactly chest height
    is worth checking against the body list before writing any code.
14. **A union of two boxes at 45° is NOT an inscribed octagon.** cannon unions
    the shapes on a body, so two rotated squares of half-width 0.93 r reach
    exactly as far as one — 1.31 r on the diagonal — and only fill in more of
    the annulus between. Tried on the chimneys and the ridge skirt; it moved no
    hit and took Göreme from 19.75% to 20.72% occupied, so it was removed again.
    An inscribed octagon needs an INTERSECTION, which a rigid body cannot
    express. The honest shape for a cone is `CANNON.Cylinder`, and nothing in
    this repo uses one yet.

### BLOCK 6, 28 Aug. PART TWO ONLY. THE ENUMERATION IS IN `qa/CROWDS.md`.

**Part one — Cali, Rio and Kyoto's landforms — was NOT done.** The block ran
over on part two and stopped at the boundary rather than half-doing both. Those
18 hits are still there and block 5's finding almost certainly applies to them:
the colliders exist and are too small.

**The trap the card warns about is real and it is worse than stated.**
`qa/rev-people.js` finds crowds with a regex over the mesh NAME, and **exactly
one crowd in the game matches it.** Every other chapter builds its crowd from a
merged geometry and never names the mesh, so "Sahara's crowd is 16% solid" was
not a Sahara finding — it was the only crowd the instrument could see.

`qa/b6-crowds.js` classifies by INSTANCE DIMENSION instead and finds **3761
person-shaped instances across nineteen chapters**. `qa/CROWDS.md` is the
enumeration, with the false positives (Pantanal's 2627 marsh tussocks, Sahara's
88 wool bales, Iceland's snow drifts) listed so nobody spends an hour on them.

```
crowd solidity, chest ray      before -> after
sahara  sahPeople  x170          21% -> 100%
rio     rioPeople  x306           3% ->  94%
kowloon walkers    x80            3% -> 100%
six chapters, 244 people                 not done, listed in qa/CROWDS.md
```

**Pooled or one-each is a real choice and it has a rule.** One pooled body with
a shape per person is right when nothing moves after placement — Rio, three
hundred and six shapes on one broadphase entry. One body each is REQUIRED the
moment anybody moves, because a compound body cannot move one of its shapes:
Marrakech has three cameleers who travel and Kowloon's eighty all walk.

**The body budget is not the constraint.** A distance gate was written for
Kowloon first, assuming eighty moving static bodies would cost broadphase time.
Measured, it costs nothing — 0.6 ms/tick median either way — so the gate was
removed. Sydney, untouched, held at 0.7/1.1 in the same run, which is the only
thing that makes a frame-time before/after readable at all (see `b3-perf.js`).

15. **A distance-gated collider cannot pass a solidity audit.** The gated
    Kowloon read 13% and was working exactly as written — the probe samples all
    eighty wherever they are, and only the near ones were solid. If a gate is
    genuinely needed, the audit has to gate with it or the number is a lie.

### BLOCK 7, 28 Aug. THE RING METRIC IS THE FOURTH INSTRUMENT THAT LIED.

`qa/rev-people.js`'s scenery rings open with `if (!o.isMesh) return`, so they
**never see a single `InstancedMesh`** — and Sydney's hedges, flower petals,
stems, lily pads, palings and half its dressing are instanced. They also drop
any mesh with a bounding radius over 60 m, which is every merged garden mesh in
the chapter. That is how a chapter whose western beds are full read 29/0/0/3.

But the OTHER direction is just as wrong: counting every instance reads the east
garden at 93% full against a screenshot of bare lawn, because one flower bed is
four hundred petal spheres. **`qa/b7-ring.js` counts positions from meshes AND
instances, drops anything whose instance-scaled radius is under 0.40 m or whose
centre is under 0.30 m above the ground, and calls a cell dressed only when it
holds two of them at least 3 m apart.**

```
Sydney scenery rings, qa/b7-ring.js      before -> after      card's target
ring 20                                    86% ->  86%
ring 45                                    55% ->  82%        over 40%: met
ring 70                                    14% ->  71%        over 40%: met
ring 95                                     0% ->   0%        see below
east garden, x 40..66 z 24..66              78% -> 100%
triangles                                74 960 -> 89 264
bodies                                      139 -> 148
```

**Ring 95 cannot move and it is not a failure.** Twelve of its eighteen cells are
open harbour and the rest are past x = +/-70 or z = 70 — outside the land
rectangle block 1 fixed. Anything placed there is decoration in a place the
player is now rescued from.

**A boundary is content, not a fence.** Block 1 put Sydney's edge at z = 70
because the ground body stops there; the lawn mesh runs to z = 150 so the
horizon has no hard edge, so the toast fired while the player stood on visible
grass. The fix is a sandstone plinth with an iron palisade along z = 68.6 and
down both flanks to z = 8 — and **it is solid**, so the north bearings now meet
a railing at z = 67.9 instead of a sentence at 70. Measured by sprinting: north
and north-west stop at 67.9 and 67.8 and are never rescued; bearings that reach
open water still are. `qa/b7-northlawn-before.png` against `-after.png`.

The lawn still runs past it to the skyline, which is the point — a boundary you
can see over reads as "the garden ends here", where a wall reads as a box.

**And the white plane at (48, 46) is the path network**, a 286-triangle merged
ribbon at y 0.07 in `PALETTE.path`. Not a placeholder — `envPATHS` simply stopped
at (56, 52) with nothing beyond it, which is most of why the north-east quarter
read as a field: no route through it, so nothing to walk along.

16. **A content block needs its own ring metric before it starts.** Three
    different ring definitions gave 29%, 93% and 78% for the same corner of the
    same chapter on the same build. Whichever one a block picks, it must state
    the rule and re-measure with it, and the screenshot is still the arbiter.

### BLOCK 8, 28 Aug. THE COLLIDER NOW SAMPLES THE PICTURE. THE RING WAS NEVER EMPTY.

**The half that mattered.** Block 3 measured Pasto as the worst chapter in the
game — collider against drawn ground 0.202 m mean, 30.7% over 15 cm, 13.9% over
50 — tried a finer lattice, got a WORSE number, and logged the real fix here.

The real fix turned out to be arithmetic. `pastoWarpRaw` is applied **separately
to each axis and is monotone**, so although the mesh's 45 x 45 vertices are
unevenly spaced they still lie on a RECTILINEAR grid in world space. The drawn
height at any point is therefore the flat triangle spanning the four grid lines
around it, and finding it is two binary searches over forty-five numbers.
`pastoMeshY` does that; the heightfield samples it, and `terrainHeight` publishes
it.

```
pasto, collider vs drawn ground          mean|e|   >15cm   >50cm   signed
before (law, 4 m lattice)                 0.202    30.7%   13.9%   +0.079
after  (mesh, 4 m lattice)                0.086    15.6%    2.7%   +0.024
after  (mesh, 2 m lattice)                0.025     3.1%    0.6%   -0.001
```

**AND FINER IS NOW BETTER, WHICH IS THE EXACT INVERSE OF BLOCK 3.** Halving the
lattice against the smooth LAW made things worse, because it tracked a surface
nobody can see. Halving it against the MESH cuts the error by another factor of
three, because the target is piecewise linear and a finer grid follows its
creases. Cost: 4 351 heightfield nodes to 16 870, and ms/tick unchanged inside
session drift. Pasto goes from the worst chapter on this metric to the best.

It also fixed the pose for free. `qa/b4-pose.js` for Pasto: four-foot spread
0.150 -> 0.024, mean absolute foot gap 0.253 -> 0.067, and **the number of sites
where the law and the drawn ground disagree went 3 of 10 to 0 of 10** — the
`split` column exists precisely for chapters like this one and Pasto no longer
needs it.

**The half that did not matter, and the fifth lying instrument — this one mine.**
`qa/b8-ring.js` (and `qa/b7-ring.js`, which shipped in block 7) filtered
instances by the height of their ORIGIN, `y0 + 0.30`. A field wall, a shrub and
a coffee bush are all PLACED at ground level and grow upward from it, so their
origins sit at `y0 - 0.06` and every one of them was dropped. Corrected — the
0.40 m radius test is what excludes crumbs, and the height test is gone —

```
Pasto scenery rings              card says      broken metric      corrected
ring 20                            100%             100%             100%
ring 45                              0%               0%              80%
ring 70                              0%              32%              95%
ring 95                              0%              23%              73%
```

**So "everything in chapter 2 is within 20 m of the spawn and there is nothing
beyond it" is false.** Field walls WERE built, measured (80 -> 87 and 95 -> 100),
looked at, and then **taken out again**: they cost +38% triangles on a chapter
the card itself notes was already at 98 k, they read as a grid of turf slabs
rather than as the chapter's own work, and they were bought against a number
that was wrong. The card's rule decided it — "an hour spent filling a field that
was never empty is the worst outcome available here."

What IS true is thinner than the card claims and worth writing down: on eight of
twelve bearings the 45 m ring holds two to five shrubs and nothing else, and at
60 degrees it holds nothing. The chapter's dressing is in three places — the
plaza, the coffee rect, and a frailejone annulus centred on Galeras a hundred
metres from the spawn. A future pass that wants to dress the walk out of town
should start from `qa/b8-diag.js`, which prints exactly that.

17. **A metric that filters by an object's ORIGIN height measures where things
    are anchored, not where they are.** Half the vegetation in this game is
    placed at ground level and drawn upward. Filter by size, never by height.
18. **Block 8 ran to roughly four hours, not two to three.** The heightfield
    work was about ninety minutes; the rest went on a content half whose premise
    was false and on the three measurements it took to establish that.

### BLOCK 9, 28 Aug. NEITHER SPAWN RING WAS EMPTY. HANOI'S FRONTAGE WAS IN THE LAKE.

The card's finding — pantanal and hanoi both 0% at 20 m — is false in both, and
it is `rev-people.js`'s ring metric again (see block 7). `qa/b9-ring.js` is
block 8's corrected counter generalised over two chapters; both spawn rings read
**100%**, and the frames corroborate it: `qa/b9-pantanal-spawn-before.png` is a
road, cattle, capybaras and termite mounds, `qa/b9-hanoi-spawn-before.png` is the
lake, Thap Rua, the red bridge and the scooter ring.

**PANTANAL WAS NOT TOUCHED.** 100/100/67/70, and **0% dead area over the whole
of its bounds rectangle** — the only chapter measured this pass with none. Its
70 and 95 residue is open water and the far side of the fazenda.

**HANOI HAD A DIFFERENT BUG IN THE SAME PLACE, AND IT WAS ONE CHARACTER.**
`hanTerrace`'s normal is `(cos yaw, -sin yaw)` with `yaw = atan2(dx, dz)`, which
is `(dz, -dx)` — and the lake ring's polyline is wound so that points INTO the
water at all eleven of its segments. So "the one continuous frontage in the
chapter and the reason the lake feels enclosed" was laid in Hoan Kiem, where
hanTerrace's own `hanTerrain < hanWATER + 0.3` test threw it away in silence.
Twenty-four stations round the ring at 10/16/24 m outside it: **21 read bare
ground**. `off = -1`, and 17 of 24 now have a building on them.

```
hanoi, qa/b9-ring.js         before -> after
ring 20                        100%  ->  100%
ring 45                         36%  ->  100%
ring 70                         22%  ->   83%
ring 95                         32%  ->   54%
triangles                   253 974  -> 298 710  (+17.6%)
bodies                           41  ->      41  (pooled)
blocked ground of 839           213  ->     287  (+74, the new city)
 ...under nothing drawn          18  ->      24  (+6, 0.7%)
ms/tick median                          0.5, Sydney 0.6 in the same run
```

Four more in the same file: no `bounds()` at all (so `boundsOf()` handed
backVoid the ground heightfield, and the edge of the world was x = ±230 — now
two rects, city and bridge, verified rescued at three points outside and not at
three inside); `hanBuildBackdrop` covered the Old Quarter rectangle only, which
is everything north of z = −24; a second terrace row on the ring's outer side at
34 m, which is the far side of the boulevard the player lands on; and
`hanBuildScatter`'s litter rectangle was the Old Quarter's too, so the pavement
the player is put down on had not one leaf on it.

**A RESTORED FRONTAGE IS A THING THE ARRIVAL LENS CAN BE INSIDE.** The camera
sits 12 m out on `SPAWN.yaw`, which in Hanoi is the ring's outer side, so the
chapter opened looking at the lake through the gap between two shophouses. The
rig's occlusion ray would have hauled the boom in to a metre and a half, which
is a bug being masked rather than a shot. A sixth keep-out at the spawn.

**NOT DONE, AND IT IS VISIBLE.** At 55 m west of the spawn the animal is among
the backdrop blocks, which are blank instanced boxes with no windows or signs,
and it reads as a yard rather than as Hanoi (`qa/b9-hanoi-w55-after.png`). Real
streets out there mean new entries in `hanLANES`, which is also the scooter
distribution and the marquee, so it is not a block 9 change.

19. **`g.biome.switchTo(tag)` BUILDS THE CHAPTER AND DOES NOT MOVE THE ANIMAL.**
    The first spawn frames of this block were taken from wherever Sydney had
    left the capybara — (0, 22) in the Pantanal, which is the first bridge, so
    the "spawn shot" was a close-up of its planks. Place the body at
    `spawnOf()` and settle it, as `b8-shot.js` does.
20. **THE ARRIVAL YAW IS THE CAMERA'S BEARING, NOT THE VIEW'S.** `teleportCapy`
    puts the lens at `anchor + (sin camYaw, cos camYaw) * dist` and looks BACK
    at the animal. A shot helper that copies `b8-shot.js`'s `camera at
    -sin(yaw)` renders every documented arrival backwards — it is how Hanoi's
    composed opening first read as an empty plain, and it nearly cost an hour
    of work on a chapter whose spawn was already right.
