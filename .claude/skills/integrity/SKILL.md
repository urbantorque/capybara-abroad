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
