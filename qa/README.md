# qa/

There are about 4,300 files in this directory and roughly thirty of them are
live. The rest are the sediment of forty-odd batches: one-shot probes written
to answer one question, and the PNGs and JSON they wrote back. This file exists
because that ratio is unreadable without it, and because a stale probe that
still runs is worse than one that has been deleted — it produces a number, and
the number is about a version of the game that no longer exists.

## What runs

```bash
npm test
```

Everything that can answer without a browser. It is `qa/run.mjs`, and it
distinguishes two things that look identical from the outside:

- **Asserting** checks exit non-zero when they find something. These are tests.
- **Reports** print their findings and exit 0 whatever they find. These are
  worth reading and cannot fail a build. Four of the seven static audits that
  predate the runner are in this category; that is not a criticism of them, it
  is a fact about them that has to be written down somewhere.

```bash
npm start                 # or: PORT=5188 node server.mjs
npm run soak              # nineteen chapters, ~4 minutes
```

The soak needs a server and a real frame clock, so it cannot live in
`npm test`. It drives whatever URL the browser session is already open at,
which is the one thing worth knowing about it: point the session at
`/dist/untitled-capybara-game.html` and it soaks the **built artefact** rather
than the dev server's unbundled source. Those are different programs and until
September 2026 only one of them had ever been soaked.

## The live files

| file | what it answers |
|---|---|
| `run.mjs` | the `npm test` runner |
| `strip-test.mjs` | the comment stripper: 16 tokeniser cases, then every source file re-parsed after stripping |
| `p6-static.cjs` | CHAPTERS and TASKS invariants — acts with no tasks, tasks past the declared act count, an act of one row, an arrival behind a movement, `open` duplicating act one |
| `p7-tokens.cjs` | how many distinct radii, type sizes and shadows the HUD gives |
| `xmodule.mjs` | the cross-module contract: import forms, export forms, top-level name collisions |
| `channels.mjs` | the four channels of "that landed" |
| `lines.mjs` | dialogue pool shape and duplication |
| `verbs.mjs` | the verb table against what the chapters use |
| `audit-tasks.mjs` | task coverage per chapter |
| `p2-clues.mjs` | every task has a clue and a place |
| `p3-glyph.mjs` | the measured-task glyph and the records table |
| `r10-soak.js` | **the** soak: nineteen chapters, NaN, errors, record orphans |
| `audio2.js` | the score runs in thirteen chapters with no errors |

Recent per-batch probes worth keeping, because the thing they measure is now a
permanent feature rather than a one-off change:

| file | what it answers |
|---|---|
| `p5-mood.js` | faces: mood, blink and brow angle read off the nodes in three casts |
| `p5-cost.js` | draw calls and triangles from a fixed camera, for A/B |
| `p6-words.js` | act headings, the chapter note, and which dialogue LAYER resolves |
| `p6-trav.js` | the traveller is one person in four chapters, on the ground and reachable |
| `p7-impact.js` | the landing ring, the dust pool, and the hit flash's two edges |
| `p7-css.js` | computed radius and shadow on eight surfaces; zero empty declarations |
| `p7-cross.js` | the crossing, which the chapter picker skips |

## The rest

Everything else is a one-shot. They are kept rather than deleted because the
comments in them record what was measured and why, and because several of them
were the only evidence for a decision — but **none of them is maintained**, and
several will now fail for reasons that have nothing to do with a defect. Treat
an old probe as a document.

The `.png` files are the QA sink's output: `server.mjs` writes anything POSTed
to `/shot?name=X` into `qa/X.png`, base64-decoded. That is how a probe returns
data — `run-code` prints neither `console.log` nor the function's return value
— so most of the `.json.png` files here are JSON with a misleading extension.

## Writing a new one

The harness traps are recorded in the memory file `headless-qa-harness` and
worth re-reading; the four that have cost the most time in this repo:

1. **A picker key is a one-based index.** `Digit1` is Sydney, `Digit2` is
   Pasto, `Semicolon` is chapter 15. Getting one wrong measures a different
   chapter and reports it under the right heading. Always return the biome in
   every row so a wrong key cannot be mistaken for a bug.
2. **`page.addInitScript(localStorage.clear)` fires on every navigation** and
   will wipe the save the probe is checking.
3. **`toDataURL` must be in the same `page.evaluate` as the render.** A
   `page.evaluate` boundary loses the drawing buffer and you get a sheet of
   white.
4. **The mean of a crowd is not in the crowd.** Nor, usually, is the densest
   neighbourhood outside a wall. Render several bearings and post all of them.
