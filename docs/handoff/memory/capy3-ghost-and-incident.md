---
name: capy3-ghost-and-incident
description: "v37 — the two loops that were ADDED rather than finished, and the four instruments that measured them wrong first"
metadata: 
  node_type: memory
  type: project
  originSessionId: 072293f3-10b3-4b06-a30b-86fe546e62dc
  modified: 2026-08-29T10:16:56.744Z
---

29 Aug 2026, straight after [[capy3-five-things-already-built]]. The two bigger swings from
the same review: the first things in a long while that add a loop rather than finishing one.
Both are built out of machinery that was already running.

## THE GHOST — `capy.ghost`

Your own best run at a record, played back beside you while you attempt it again. Translucent,
silent, no readout of the gap.

- **Ownership split:** systems.js owns the TRACE (it knows when an attempt opens/closes,
  whether a figure improved, and owns localStorage). capybara.js owns the ANIMAL. Two
  functions: `show(x,y,z,yaw,a)` and `hide()`.
- **One mesh, not eighteen.** `capyModel`'s parts are baked once at CONSTRUCTION into a single
  geometry — which is also the only moment the model is in a rest pose, before the gait, the
  loaf and the idle beats have run.
- **Not a clone of the fur.** `mat()` caches by colour, so a cloned fur is either shared with
  the real animal (a wetness write dyes the ghost) or misses the cache. One own material.
  See [[capy3-clone-eats-the-shader]] for the family this belongs to.
- **The rule that sorts the fifty-three out by itself:** a trace is kept only if the animal
  covered ≥ 8 m. The glacier and the Uji qualify; a four-minute sit in a hot spring, roulette
  and putting pigeons up do not — and none of them had to be listed.
- No ghost on a first attempt, because a trace is kept only when a figure IMPROVES. Property
  of the mechanism, not a rule.

## THE INCIDENT — `capy:incident`

Three things you did that somebody saw, in one place, inside 12 s → `AN INCIDENT`; five →
`A SCENE`. Half a lift, a chime, a moment card, and a crowd line said at no other time.

- Obeys the finds' three laws (unlisted, ungated, unmissable) and breaks the fourth on
  purpose: **repeatable**, because it is a moment and not a collectible.
- npc.js answers in three casts, as everything in that file has since v30: `incident` in
  `npcLOC_SAY` plus `npcINC_SYD` / `npcINC_PA` for the two chapters with no locals.
- Pool rule one step beyond chapter-neutral: **no line may name what was done**, because the
  same sentence is spoken over a crate, a hat and a bicycle in a canal.

## The four things that measured wrong first

1. **`npcHeat` is not "who can see you".** It counts only people whose `wary`/`alarm` is
   ALREADY over `npcWARY_HEAT` — people you have had a go at. As a gate on the FIRST event of
   a chain it is a chicken and an egg: measured, six hard impacts two metres from the animal
   in a Venetian square, heat zero for all six, nothing ever fired. `findPeople(x,z,r)` in
   systems.js is the honest question, and it sweeps both casts.
2. **A cooldown checked at the top of a counter silently deletes the second tier.** The chain
   stopped being counted after it carded, so `incN` could never reach five and `A SCENE` was
   unreachable code. Gate the CARD; start the cooldown when the chain ENDS.
3. **"The id changed" cannot see a second go at the same record.** Two nine-second runs at
   `uji-run` produced one 181-sample trace and a ghost already past its own finish on frame
   one. A `wasOpen` latch is what detects a new attempt. And the id must NOT be cleared when
   the line closes — a chapter may file its record after `recordEnd` or after the watchdog.
4. **`page.addInitScript` persists for the whole browser CONTEXT, not the run-code
   invocation.** An init script installed by an earlier probe in the same `-s=` session goes
   on firing on every navigation, so a later probe that never installs one still had its
   localStorage wiped on reload and reported a store that "does not survive". `close-all` then
   `open` for a fresh context. This is trap 10 in [[headless-qa-harness]] with a longer reach
   than that note describes.

...and a fifth, in the probe: **a backtick inside a comment inside a template literal ends the
template.** `// reads \`on: false\`` inside a `const RUN = \`...\`` is a SyntaxError in the
evaluated string, the run dies before the /shot post, and the OLD result file is still on disk
and reads as a fresh failure. Check the output file's mtime before believing a bad result.

Related: [[capy3-number-and-first-frame]], [[capy3-the-place-remembers]],
[[capy3-mischief-radii]], [[capy3-the-locals]]
