---
name: capy3-the-fun-review
description: "The 6 Sep 2026 design review — ROADMAP-FUN.md, its six casual-first opportunities (the road to the marquee, the first five minutes in every world, charm, toybox, jobs you can ruin, notoriety) and why the title picker changed the framing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 509fc7ba-5059-43ac-91b8-f7fa08374a02
  modified: 2026-09-06T13:39:11.548Z
---

6 Sep 2026, on the `character-pass` branch after the sound review. Three
read-only surveys (verbs/props, people, meta loop) → `ROADMAP-FUN.md`, 15
batches, not yet started. First draft committed as `6f04afd` (with the other
session's A1/A2 audio mover); revised twice the same day at the owner's
request. The cut end-game items (second lap, shareable postcard, companion pup)
survive in `git show 6f04afd:ROADMAP-FUN.md`.

**THE FRAMING FACT: the title picker is ungated.** `pickDefs` maps all of
`CHAPTERS`; only the in-game departures board reads `jrOpen` (which opens
Sydney, anything seen, and the lowest incomplete chapter). So any of the
nineteen places can be somebody's FIRST place, and every one must earn its
first five minutes alone. The second draft's "open the door early" was dropped
for this reason.

**THE DIAGNOSIS: a magnificent reactive diorama with a checklist in front of
it, and in most places the checklist hides the best thing in the room.**
- All 19 chapters carry `acts:`; the paper shows the lowest act with anything
  open; the `wow` row is act 2 or 3 in at least fifteen — so the marquee is
  NOT on the paper on arrival. The arrival card says where, not what for; the
  chart marks landmarks, not the marquee.
- Nine "be there when" marquees ride 54–205 s clocks and none is phased to
  arrival. No stuck timer exists. Nobody has timed the first five minutes.
- One economy, destructive; `fam` buys only lines; NO NPC ever gives anything.
- Fourteen verbs, four chosen; throw one fixed impulse; 1 fragile, 3 spill,
  nothing rideable. Locals' `beat` never fails; nobody blames anybody.

**THE SIX, casual-first:** 1 the road to the marquee (`marquee:` point +
arrival glimpse, a marquee line above act one, the nine clocks phased to
150–210 s after first entry, `lead:` for the arrow + stuck timer, mini marks
on the chart, `qa/first-five.js`); 2 the first five minutes in every world
(a `gag:` per spawn ring — the roadmap has a 19-row draft table — the arrival
tick earned, the incident chain as three pips, seeded people for the first
two rows); 3 charm (approach + photo, a tossed edible per chapter, the pat,
heat interlock, `pho`/`fed`); 4 the toybox; 5 jobs you can ruin; 6 notoriety.

**The bet, off `qa/first-five.js` after B6:** marquee in frame inside 60 s,
first tick inside 30 s, marquee window open or road begun inside 5 min, in
all nineteen from the picker.

**How to apply:** start at B0 (a stranger picks two places) then B1. Hop apex
untouchable (`capyHOP_VEL`). A marquee line must not count for `win`,
`chapComplete` or the act derivation. Phased clocks latch on `seen[]` so a
second entry does not re-phase. `toast()` is module-local — observe
`.capyui-toasts`.

Related: [[capy3-the-second-hour]], [[capy3-mischief-radii]],
[[capy3-the-place-remembers]], [[capy3-ghost-and-incident]],
[[capy3-the-lift]], [[capy3-the-paper]], [[capy3-the-chase]],
[[capy3-number-and-first-frame]]
