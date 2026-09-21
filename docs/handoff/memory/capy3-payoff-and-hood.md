---
name: capy3-payoff-and-hood
description: "P7 and P8 — the impact cluster, the UI token count, the comment stripper, and the four things nothing had ever tested"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T14:54:59.469Z
---

Batches P7 (`80b7895`) and P8 (`5dfca4c`) of `ROADMAP-POLISH.md`, 3 Sep 2026.
Contract sections **THE DRAWN PAYOFF — P7** and **UNDER THE HOOD — P8**.

## P7: AN IMPACT IS A VALUE CHANGE, NOT A SCALE CHANGE

A squash is 8% of a scale on a box six metres away. **The hit flash has to be a
material SWAP**: `mat()` caches one material per colour, so every crate shares
one and an emissive write flashes all of them. One shared flash material,
swapped in and back.

- 60 ms = three frames at 60 Hz, two at 30. One frame reads as a dropped frame.
- On a WALL clock, so it is the same length at 30 fps and 144.
- Restore `prop.flashWas`, not the type colour — the prop may have been wetted.
- Its own list stepped from `physUpdate`, because a settled prop is `continue`d
  past the per-prop loop and would keep the flash material for ever.

The landing ring rides the wheek's instanced mesh (+2 matrix writes) and scales
with the fall: 5.30 for 11 m, 3.55 for a 1.4 m step. `fall` goes on the payload
— and a SKID borrows the same event, so it must pass a small value or it throws
a forty-metre cloud.

## P7: A DESIGN SYSTEM IS HOW MANY ANSWERS THE CSS GIVES

`qa/p7-tokens.cjs` counts them. Before: **13 radii, 26 shadows, 72 type sizes**
in one HUD. After: 4 radii, 3 shadow scales, 59 type sizes.

- **A clamp whose floor and ceiling are the same number is a constant wearing a
  clamp.** Eight spellings of 11px. Merging them changed no rendered pixel.
- **The 59 remaining sizes were left on purpose.** Each was measured against a
  specific element at a specific viewport ([[capy3-pad-and-card]] was a whole
  batch about the card on a phone). Rounding them to six steps would undo
  measured work to make a number smaller.
- **Verify by COMPUTED style.** A malformed token does not throw — the browser
  drops the declaration and the element silently loses its corner.

## FOUR THINGS NOTHING HAD EVER TESTED

1. **The crossing.** The chapter picker's digit keys call `biomeGo` directly and
   skip the 1.28 s of white entirely. Every probe in this repo jumps that way.
   `hud.cross(biome)` is the in-game route.
2. **The digit keys only work from the TITLE CARD.** In-game they do nothing —
   the first memory walk pressed nineteen and got nineteen readings of Sydney.
3. **The built artefact.** The soak always ran against the dev server's
   unbundled source, which is a different program from `dist/`. It runs against
   `dist/` now.
4. **A transition needs a start state that was laid out.** Adding the gate class
   and the target class in one frame means the transition never runs and the
   element appears at its destination. Two nested `requestAnimationFrame`s.

## P8: THE COMMENT STRIP

46% of this source is whole-line comment. **A slash is two things in
JavaScript** — `/re\/gex/`, `a / b`, `'not // a comment'` — so it is a
four-state scanner, not a regex, and the regex-vs-division call is made on the
last significant token with a keyword list (`return /re/` is a regex).

Two deliberate conservatisms: a template literal is copied VERBATIM (getting
brace depth wrong inside `${}` ends it early and eats the file), and every
newline inside a comment is re-emitted before runs of 3+ collapse to 2 (ASI).

**Guarded**: `build.mjs` parses each stripped body with `vm.Script` and falls
back to the file's own text. A stripper bug must cost bytes, never correctness.

9245.9 KB → 5528.8 KB; with gzip in `server.mjs`, 9.2 MB → **1.27 MB** over the
wire. `Vary: Accept-Encoding` is not optional even on a dev server.

**The `$'` bug bit again while writing the comment about it.** `String.replace`
reads dollar-apostrophe in a replacement STRING as "everything after the match",
so build.mjs was spliced into itself and came out 526 lines. Pass a replacer
FUNCTION. This is the third time this family has cost time here.

## P8: TWO ENGINE BUGS

1. **fps was accumulated from the SCALED clock.** Under slow motion it read
   high; under a hitstop, `dt` is 0 and the next reading is a divide by nearly
   nothing. **It drives adaptive resolution** — so a marquee, the one moment the
   game most wants to shed pixels, is when it decided it had headroom. Use
   `game.state.rawDt`. Measured 55 at `timeScale` 0.25 where it would have said
   ~212. And `< 50` / `> 58` were 60 Hz as constants: fractions of the observed
   ceiling instead (50.4 / 58.2 on 60 Hz, so the common case is unchanged).
2. **`mainSaneWorld` skipped `mass <= 0`** — every kinematic body, **90 in
   Sydney alone**: the ferry, lifts, floes, chiva, basket, raft. Those are what
   the animal stands ON, so a NaN goes into the platform frame and out as the
   animal's position. Different treatment from a dynamic body: repair a NaN,
   clamp a runaway, **never touch a finite position** — a kinematic position is
   authored every frame by its owner and a second writer is the bug this
   function exists to prevent. See [[capy3-carriers-that-drop-you]].

## MEASURED, NOT BUILT: CHAPTER EVICTION

A full nineteen-chapter journey: geometries 99 → 2013, scene objects 429 →
5776, meshes 345 → 4509, heap 96 → 216 MB, and coming back releases none of it.
**Not a leak** — `main.js` states the trade ("geometry stays resident so
re-entry is instant"). Nobody had taken the number.

Not built because `mat()` caches materials by colour ACROSS chapters: a dispose
pass must tell shared from owned, and getting it wrong takes out chapters still
in use.

## npm test

`qa/run.mjs`. **A test that cannot fail is a report** — four of the seven static
audits that predate it exit 0 whatever they find. Both kinds run; only the
asserting ones turn the exit code red. `qa/README.md` says which thirty of the
four thousand files in `qa/` are live and that the rest are documents.

Related: [[capy3-the-through-line]], [[capy3-faces-and-bodies]],
[[capy3-the-front-of-the-game]], [[capy3-record-spam]], [[headless-qa-harness]]
