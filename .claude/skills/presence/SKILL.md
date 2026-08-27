---
name: presence
description: Run the presence pass on capy3 — the picture work that comes after /polish. Bare `/presence` runs BOTH batches in order. `/presence 1` is the safe one (contact shadows, wind sway; no new draw calls, no re-grading). `/presence 2` is the gated one (point lights, floor graphics, the sun). Use when the user types /presence, or asks to run the presence pass, the contact work, the sway work, the light work, the floor graphics, or the sun. `/presence list` prints the plan without running anything.
---

# THE PRESENCE PASS

The audit behind this is `qa/PRESENCE-PASS.md`. Every figure in it was measured
off the shipped `audit-fixes` build on 28 Aug 2026, not estimated. Read it if a
phase's reasoning is unclear.

The one-line version: **the polish pass gave the floor a texture and gave every
silhouette a rim. Nothing sits on the floor, nothing moves, and in the three
chapters that are about light, nothing is lit.**

## Dispatch

**No argument — the default.** Run batch ONE and then batch TWO, in that order,
reading `batches/ONE.md` and `batches/TWO.md` and following each exactly. Five
phases, ~9–13 h, **a commit at every phase boundary**.

| arg | what | est. |
|-----|------|------|
| *(none)* | both batches, in order | 9–13 h |
| `1` | `batches/ONE.md` — the world sits in itself, and it moves | 4–5 h |
| `2` | `batches/TWO.md` — the light, the floor and the sun | 5–7 h |
| `list` | print the tables below and stop | — |

### Batch ONE — the safe one

| phase | what | est. |
|---|---|---|
| 1 | **Contact** — a nearest-N darkening term in the ground materials, wired to props, NPCs and the capybara across all 19 chapters | ~2.5 h |
| 2 | **Sway** — a vertex term in `shared.js` reading the live gust, opted into the foliage and cloth of all 19 | ~2 h |

Zero new draw calls, zero new lights, zero re-grading. Nothing in it can move a
bloom threshold. It also builds the nearest-N ranking helper that batch TWO's
light pool reuses.

### Batch TWO — the gated one

| phase | what | est. |
|---|---|---|
| 3 | **Light** — a budgeted point-light pool, then Hong Kong, Monte Carlo and Iceland | ~2.5 h |
| 4 | **The floor** — a graphic on it in Cali, Palawan, Venice and Sydney | ~2 h |
| 5 | **The sun** — disc, glow, moon; then the filmic roll-off and the re-validation of all twenty grade rows | ~2 h |

Phase 3 is the only change in the pass that can plausibly cost frame time.
Phase 5 re-grades every chapter and **must run last**. Both want batch ONE
settled underneath them: a floor with contact darkening on it is a different
floor to light and to grade.

**Order is not negotiable.** If only one batch is run, it is ONE.

An unrecognised argument: print the tables and ask.

---

## Rules that apply to every phase

### The aesthetic law is not negotiable

From `CONTRACT.md`. A phase that breaks one of these is a failed phase:

- **No textures. No image files.** Procedural shader work and geometry only.
- `MeshLambertMaterial` with `flatShading: true`, via `mat()` in `shared.js`.
  No PBR, no `MeshStandardMaterial`, no metalness/roughness, no env maps.
- Colours come from `PALETTE` in `shared.js`. Never a hex outside that file.
- Every top-level name carries its module tag (`sys`, `env`, `capy`, `phys`,
  `npc`, `wx`, and the chapter tags). The bundler concatenates into one scope.
- `export function` only. No default exports, no `export const`, no classes.
- Imports only at the top, only in the three permitted forms.
- Silhouette-first: it must read from the fixed ~35° overhead-behind camera.

Two additions specific to this pass:

- **Do not touch `grain()`'s near octave or `mat()`'s rim.** Both were measured
  working in `qa/PRESENCE-PASS.md`. Add terms beside them, never in place of
  them.
- **Do not touch the score, the ambience or the instruments.** The polish pass
  just rebuilt them.

### Additive, not replacing

Every change adds a term to something that already works. New behaviour goes
behind an **option that defaults to the current behaviour**, so no existing call
site changes until it opts in. That is what makes this revertible one call site
at a time instead of all at once. It is the rule that made the polish pass's
phase 1 survivable and it is the rule here.

### Commit at every phase boundary

Not optional. It is what makes a nine-hour pass one command instead of five, and
it is the only thing that makes an interrupted run survivable. Stop cleanly at a
boundary and what has landed is coherent.

### Measure before, measure after

Never report a phase done on a single green run. Record the before numbers
**first, in the same session**, then the after.

The instruments, all in `qa/`:

| probe | what it gives |
|---|---|
| `na-scan.js` | ground band + sky band (mean L, SD, 5-bit colours, clip%), live point/spot light census, mesh and triangle counts, ms/tick — eight chapters |
| `na-rio.js` | the same ground band for Rio (the benchmark), Cali and one more |
| `na-shots.js` | canvas capture per chapter to `qa/na-<biome>.png` |
| `vis-flat2.js` | the polish pass's ground table, kept for continuity |

**Do not invent a pixel-diff "aliveness" metric for phase 2.** It was tried in
this analysis and it measured camera settle, not world motion: it returned
53–76% of pixels moved in a world with no vertex animation at all. Judge sway
from a screenshot and from the source, not from a framebuffer delta.

If a change looks like it did nothing, suspect the harness before the code.

### The verification loop

```bash
node build.mjs
```

Server: `node server.mjs` with `PORT=5188` (5173 is often taken; 5188 may
already be up from an earlier session, which is fine — check with curl before
starting another). Then

```bash
playwright-cli -s=presence open http://localhost:5188/
```

and `playwright-cli -s=presence run-code --filename=qa/<probe>.js`.

**Harness traps that have each cost an hour in this repo:**

1. `playwright-cli navigate` to the URL already loaded **does not reload** and
   the ES modules stay cached, so a source edit looks like it had no effect.
   `close-all` then `open` is the only reliable reload.
2. `run-code` operates on whatever the page currently is. Start every script
   with `await page.reload()` and a 4.5 s wait.
3. `run-code` needs `--filename=`; a bare path argument is a `ReferenceError`.
   It prints neither `console.log` nor the return value. Get data out by POSTing
   base64 to `/shot?name=X` and reading `qa/X.png` — the sink writes whatever it
   is given under that name, so JSON comes back as `qa/X.json.png`. `btoa`
   exists only **inside** `page.evaluate`, not at the script's top level.
4. `canvas.toDataURL()` / `drawImage` on a later turn returns **black** — the
   drawing buffer is not preserved. Render and read in one JS turn, or use
   `gl.readPixels` immediately after `game.tick(dt, true)`.
5. A script file must be a bare `async page => { ... }`. A leading comment or a
   trailing semicolon is a SyntaxError.
6. A single `page.evaluate` longer than ~20–30 s dies. Split per chapter.
7. Chapter keys are 1-based: `Digit1..Digit9`, `Digit0`, then `Minus` `Equal`
   `BracketLeft` `BracketRight` `Semicolon` `Quote` `Comma` `Period` `Slash`.
   So Palawan is `Equal`, Cappadocia is `BracketLeft`, **Pantanal is
   `Semicolon` and `Comma` is Antarctica** — that one was mis-guessed during
   this analysis and only the assertion caught it. **Assert
   `g.biome.current` in every row of every result.**
8. Audio work needs `playwright-cli` with **real key events and a real clock**.
   The hand-driven `game.tick()` loop never unlocks the `AudioContext`. (No
   phase in this pass is audio work — this is here so nobody re-derives it.)

`playwright-cli close-all` at the end.

### What "done" looks like

1. Each phase's acceptance test passes, **with the number shown**.
2. `node build.mjs` succeeds and the game boots with `game.state.lastError`
   still null after a 60 s soak in at least two affected chapters.
3. Before/after screenshots exist in `qa/` and have been **looked at**. Not
   "captured" — looked at.
4. Frame time stated as a number, before and after, for phase 3. Any phase that
   costs more than 0.3 ms/tick says so.
5. The aesthetic law still holds — say so explicitly.

Report honestly. If you stopped early, say at which phase boundary and why;
scaling this down is the user's call, not yours.
