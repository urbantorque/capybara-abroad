# The one decision left

Written 2 Sep 2026, closing batch R10 of `ROADMAP-RELEASE.md`.

**Everything else about shipping this is done. This is not a technical problem
and it is not one anybody but the author can settle**, because a licence is a
grant of permission over their own work and it is, in practice, irreversible:
once a version has gone out under a permissive licence, that version stays out
under it.

So this file does the part that *is* mechanical — it lays out what the choice
actually costs here, and the three edits that follow from it — and stops.

---

## What is true right now

- There is **no `LICENSE` file**. Under copyright law that is not "free to
  use": it is all rights reserved, and nobody handed this repository has
  permission to run, fork, modify or redistribute it.
- `package.json` is marked `"private": true` with **no `license` field**, on
  purpose, so npm cannot imply a grant that has not been made.
- `dist/untitled-capybara-game.html` now **says so in the artefact itself**:
  the MIT notice at the top of `<body>` covers three.js and cannon-es, and
  immediately above it is a notice saying that it covers those two and nothing
  else. Before R10 the file carried an MIT notice and silence about the ninety
  thousand lines it is mostly made of, which reads as though MIT covered the
  lot. That was the honest gap, and it is closed whichever way the decision
  goes.
- The two bundled libraries are **both MIT**, which imposes nothing on the
  choice below: MIT is compatible with everything, and its only requirement —
  that the notice travels with the code — is already met by `build.mjs`.

## What the choice changes

The realistic options, and what each one means *for this project specifically*.

| | what it lets a stranger do | what it costs you |
|---|---|---|
| **MIT** (or BSD/Apache-2.0) | run, fork, modify, sell, ship a re-skin | nothing enforceable; someone may publish a paid version of this |
| **CC BY-NC-SA 4.0** | play, fork, modify, share non-commercially, with credit | commercial use needs to come to you; **not** a software licence and awkward for the code half |
| **Source-available** (e.g. PolyForm Noncommercial) | read, fork, modify, share non-commercially | drafted for code, but not an OSI "open source" licence, so some people will not touch it |
| **All rights reserved** — the status quo | play a copy you were handed | you can still publish the game; you simply grant nothing, and nobody may fork it |

Two things worth weighing that are particular to this repository rather than
general licence advice:

1. **This is not only code.** The nineteen chapters are authored content —
   place, writing, palettes, a score — and a code licence like MIT grants that
   away as freely as it grants the physics. If the code and the content should
   be treated differently, that is a dual arrangement (e.g. MIT for `src/`,
   CC BY-NC for the writing and art), and it needs saying explicitly in the
   file or it does not exist.
2. **Publishing does not require a licence.** "Deploy it so people can play it"
   and "let people fork it" are separate decisions. The status-quo row is a
   real option: the game can go on the web and be played by anybody with no
   licence at all. What has no licence cannot be *contributed to*, which may or
   may not matter to you.

## The three edits, once it is chosen

1. **`LICENSE`** in the repository root, containing the full text.
   `build.mjs` already looks for `LICENSE`, `LICENSE.md` and `LICENSE.txt` and
   needs no change: its first paragraph is lifted into the distributable
   automatically, replacing the all-rights-reserved notice (see `gameNotice()`).
2. **`package.json`** — add `"license": "<SPDX id>"`, and drop
   `"private": true` if it should be publishable to npm (it need not be; the
   game is not a package). Delete the paragraph of the `"//"` note that says
   why there is no licence field.
3. **`README.md`** — one line under the Play section saying what it is under,
   and `ROADMAP.md` §1's "Still to do" bullet struck through.

Then `node build.mjs` and check the top of `<body>` in the output says what you
expect. That check is the whole point of the wiring: the notice is generated,
so it cannot drift from the file.
