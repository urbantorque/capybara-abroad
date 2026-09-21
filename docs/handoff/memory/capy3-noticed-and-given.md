---
name: capy3-noticed-and-given
description: "B7-B8 of ROADMAP-FUN: the photo, the snack and the pat, and the four ways a measurement of them lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T06:54:55.423Z
---

Item 3 of ROADMAP-FUN, built 7 Sep 2026 as `40db53c` (B7) and `fe953b3` (B8).
Being noticed became a thing that happens to you in all nineteen chapters
instead of to three Sydney tourists.

**What is there.** `npcPHOTO_*` / `npcGIFT_*` / `npcPAT_*` on the local record
in `src/npc.js`, and the three gestures **tile the distance and never overlap**:
pat under 1.9 m, gift 2.2–9 m, photo 3–11 m. Standing right beside somebody is
the one place the other two cannot fire, which is what makes the pat the
close-range answer rather than a fourth thing competing for the same moment.
The arm terms are written as opposite signs — `snap`/`snapR` subtract (a raise),
`pat` adds (a reach) — so a rig change cannot silently turn one into the other.
`jrChapPho`/`jrChapFed` ride the save as `pho`/`fed`; `game.hud.charmAudit()`
is the only way to see either from outside, because both are things that HAPPEN
TO YOU and a player who never saw one looks identical to a build where neither
fires. See [[capy3-nothing-was-dead]].

**Four things that measured wrong, and they are all reusable:**

1. **A TDZ `ReferenceError` HIDDEN BY `&&`.** B7's gate read `f < 0.02` where
   `const f = -r.fl` is declared a hundred lines below it; short-circuiting on
   an earlier `r.cd <= 0` meant the throw almost never happened, so the feature
   was silently dead rather than loudly broken. **The tell was a count of
   EXACTLY zero rather than nearly zero** — the same tell as trap 35 in
   [[headless-qa-harness]]. A dead wire and a rare event both look like
   nothing; only one of them is ever exactly nothing.
2. **A THRESHOLD MEASURED AGAINST A VALUE THAT NEVER GOES BELOW IT.** `r.hud <
   0.05` where Venice sits at 0.051 permanently. Gates on a continuous field
   need the field's actual range in all nineteen chapters, not a plausible
   number.
3. **AN ORDER EFFECT IS NOT AN A/B.** B8's heat-interlock probe ran its cold
   stretch straight after the crossing and got cold 0.493 against hot 0.575 —
   backwards, which reads exactly like a multiplier that is not wired. It was
   the probe: `game.calm()` is still climbing out of the arrival for the first
   half-minute and the `fam` rise is MULTIPLIED by it, so one stretch began in
   a world that had just been built. Thirty seconds of settling and **both
   orders run** resolved it to the closed form exactly (40/34 × 1.0 × 0.5 =
   0.588, twice). **An A/B where A runs first in a world that is still starting
   up is not an A/B.**
4. **A GIFT MUST FLOAT AND MUST NOT BE OWNED.** `physRHO.snack` is 420 because
   eight of the ten chapters the snack exists for have water in them, and
   `owner` is cleared on release because `owner` is what makes somebody walk
   over and take a thing back.

Two genuine pre-existing bugs fell out of the batches: `pan is not defined` in
the second-voice path (A6 had never played a note in thirteen chapters), and
`findPeople` walking `game.npcs` unfiltered — see [[capy3-ghosts-and-noise]].

Related: [[capy3-measure-the-premise]], [[capy3-the-place-remembers]],
[[capy3-the-locals]], [[capy3-a-thing-inside-a-thing]]
