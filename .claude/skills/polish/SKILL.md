---
name: polish
description: Run the visual/audio polish pass on capy3. Bare `/polish` runs THE CORE BATCH — the four phases that lift every chapter's picture and sound. Use when the user types /polish, or asks to run the polish pass, the core batch, the ground work, the ambience work, or similar. Optional slices: V2 V4. `/polish list` prints the plan without running anything.
---

# THE POLISH PASS

The audit behind this is `qa/POLISH-PASS.md` — every figure in it was measured,
not estimated. Read it if a phase's reasoning is unclear.

## Dispatch

**No argument — the default and the intended path.** Read `batches/CORE.md` from
this skill's directory and follow it exactly. Four phases, ~5–7 h, a commit at
every phase boundary.

| phase | what | est. |
|-------|------|------|
| 1 | **The floor** — a near-field octave in `grain()`, opted in across all 19 grounds, plus scatter in the three chapters with none | ~2 h |
| 2 | **The rim** — a sky-tinted fresnel on the Lambert material, the strongest polished-low-poly cue there is | ~1 h |
| 3 | **The sound of the place** — new ambience for Kyoto, Marrakech, Hong Kong, Venice, Hanoi and Sydney | ~2 h |
| 4 | **The three wrong instruments** — a ney, a viola caipira and a kulintang | ~1 h |

**Optional slices**, deliberately left out of the core — read
`batches/<ID>.md` only if the user names one:

| id | batch | why it is not in the core | est. |
|----|-------|---------------------------|------|
| `V2` | Point lights | Needs a pooled subsystem with a frame-time budget; the one change that can cost performance. **Highest-value thing left.** | 1.5–2.5 h |
| `V4` | The lens | Must run **after** the core — it re-grades every chapter | 1–2 h |

`/polish list` — print the tables above and stop.

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
  `npc`, and the chapter tags). The bundler concatenates into one scope.
- `export function` only. No default exports, no `export const`, no classes.
- Imports only at the top, only in the three permitted forms.
- Silhouette-first: it must read from the fixed ~35° overhead-behind camera.

### Additive, not replacing

Every change adds a term to something that already works. New behaviour goes
behind an **option that defaults to the current behaviour**, so no existing call
site changes until it opts in. That is what makes this revertible one call site
at a time instead of all at once.

### Commit at every phase boundary

Not optional. It is what makes a five-hour batch one command instead of four,
and it is the only thing that makes an interrupted run survivable. Stop cleanly
at a boundary and what has landed is coherent.

### Measure before, measure after

Never report a phase done on a single green run. The instrument for the picture
is `qa/vis-flat2.js`; for a screenshot it is `qa/vis-shot.js`. Record the before
numbers **first**, in the same session, then the after.

If a change looks like it did nothing, suspect the harness before the code.

### The verification loop

```bash
node build.mjs
```

Server: `node server.mjs` with `PORT=5188` (5173 is often taken). Then

```bash
playwright-cli -s=polish open http://localhost:5188/
```

**Harness traps that have each cost an hour in this repo:**

1. `playwright-cli navigate` to the URL already loaded **does not reload** and
   the ES modules stay cached, so a source edit looks like it had no effect.
   `close-all` then `open` is the only reliable reload.
2. `run-code` operates on whatever the page currently is. Start every script
   with `await page.reload()` and a 4.5 s wait.
3. `run-code` prints neither `console.log` nor the return value. Get data out by
   POSTing base64 to `/shot?name=X` and reading `qa/X.png`. `btoa` exists only
   **inside** `page.evaluate`, not at the script's top level.
4. `canvas.toDataURL()` / `drawImage` on a later turn returns **black** — the
   drawing buffer is not preserved. Render and read in one JS turn, or use
   `gl.readPixels` immediately after `game.tick(dt, true)`.
5. A script file must be a bare `async page => { ... }`. A leading comment or a
   trailing semicolon is a SyntaxError.
6. A single `page.evaluate` longer than ~20–30 s dies. Split per chapter.
7. Chapter keys are 1-based: `Digit1..Digit9`, `Digit0`, then `Minus` `Equal`
   `BracketLeft` `BracketRight` `Semicolon` `Quote` `Comma` `Period` `Slash`.
   So Palawan is `Equal` and Cappadocia is `BracketLeft`. **Assert
   `g.biome.current` in every row of every result** — this has misfiled a whole
   soak under the wrong chapter's name before.
8. Audio work needs `playwright-cli` with **real key events and a real clock**.
   The hand-driven `game.tick()` loop never unlocks the `AudioContext`, so an
   entire class of audio bug is invisible to it.

`playwright-cli close-all` at the end.

### What "done" looks like

1. Each phase's acceptance test passes, with the number shown.
2. `node build.mjs` succeeds and the game boots with `game.state.lastError`
   still null after a 60 s soak in at least two affected chapters.
3. Before/after screenshots exist in `qa/` and have been **looked at**.
4. The aesthetic law still holds — say so explicitly.

Report honestly. If you stopped early, say at which phase boundary and why;
scaling this down is the user's call.
