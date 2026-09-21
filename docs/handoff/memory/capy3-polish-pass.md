---
name: capy3-polish-pass
description: "The visual/audio audit of 27 Aug 2026 — the ground-flatness measurement, the four things it found, and the /polish batch that ships it"
metadata: 
  node_type: memory
  type: project
  originSessionId: bb3b1b5d-89b5-4db0-81fb-067b0c01bc57
  modified: 2026-08-27T13:52:31.163Z
---

The audit is `qa/POLISH-PASS.md`; the work ships as `/polish`
(`.claude/skills/polish/`). Committed 27 Aug 2026 as `efc5892` on `audit-fixes`.
**RUN on 28 Aug 2026** — all four phases landed; see [[capy3-the-polish-batch]]
for what the numbers actually came out at and which two targets could not be met.

**The instrument that made the case.** `qa/vis-flat2.js`: `gl.readPixels` on the
bottom third / centre 60% of the frame, luminance SD plus a count of distinct
5-bit colour buckets, eight chapters. That framing is the ground the player is
looking at, clear of the to-do card and the minimap. It is the probe to re-run
to prove the batch worked.

| | SD | colours |
|---|---|---|
| Palawan | 2.05 | 5 |
| Sydney | 3.98 | 27 |
| Rio | 51.06 | 122 |

**Rio is the proof of concept and it is already in the codebase.** It measures
25x Palawan purely because it has a *graphic on the floor* — the Copacabana
wave. Nothing else about its renderer differs. When arguing for surface detail
in this game, that comparison is the whole argument.

Four findings, all measured:

1. **The ground is 40-55% of every frame and it is one colour.** `grain()` is
   not wrong, it is tuned an octave and a half too low to see: a 1.4-2 m period
   at ±6%. It also has **no distance fade on the grain term** (only on
   `sparkle`, via `fwidth`) — which is *why* it cannot simply be turned up, and
   why the fade is the enabling change rather than a nicety.
2. **Hong Kong, Iceland and Monte Carlo have zero `PointLight`s between them.**
   Every neon sign in Mong Kok is `emissive` only: it clears the bloom threshold
   and glows, and lights nothing. Ground reads 34/255 beside a blazing sign. The
   composite pass fixed the lens; the lights still do not spill onto the floor.
3. **No AO, no contact shadow, no rim term in any of the 28 modules.** The only
   grazing-angle term is `grain()`'s wet sheen, gated off unless it is raining.
4. **The score is researched per place; the ambience is not.** Thirteen generic
   tokens (`bark cheer chime gull hiss horn pop rustle splash strum thud tick
   whistle`) shared across nineteen places, separated only by a pitch — Kyoto is
   `chime`. This is the answer whenever the soundtrack is said to lack cultural
   identity: the *score* already has it (son clave in absolute eighths, a 12/8
   gnawa cell, baroque descending fifths, seven bespoke ethnic voices), and
   ambience is heard far more because it is positional and constant.

Also: Cappadocia plays Turkish hijaz on an Andean `quena`, Palawan on Sydney's
felt `mallet`, the Pantanal's viola caipira on Venice's baroque `violin`. Two
are conceded in the source comments already.

**Deliberate, do not "fix":** Sydney/Quay/Manly share mallets because it is one
city; the Drift, Sơn Đoòng and Antarctica are placeless by design (quartal
stacks, open fifths, no thirds).

**Ranked below the rest on purpose:** the composite has `NoToneMapping` and a
hard `clamp`, but clipping measured **0% in the ground band in all eight
chapters** — it is roll-off quality in skies and emissives, not visible damage.
Resist promoting it.

Two harness notes this audit paid for: `drawImage`/`toDataURL` on a later turn
returns **black** (buffer not preserved) — render and read in one turn with
`gl.readPixels`; and a doc served by `server.mjs` renders as mojibake because
`TYPES['.html']` declares no charset, so an HTML deliverable is worth writing as
pure-ASCII entities.

Related: [[headless-qa-harness]], [[capy3-the-picture]], [[capy3-lens-and-wall]],
[[capy3-solid-or-drawn]]
