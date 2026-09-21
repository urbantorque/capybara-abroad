---
name: capy3-the-place-remembers
description: "Batch 7 of the Lift Pass — the heat field above per-person wariness, and the six ways an accumulator reads zero"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3e121112-90c6-420d-b0e5-de919ea20903
  modified: 2026-08-26T20:39:38.509Z
---

The escalation half of the mischief loop, 27 Aug 2026. `CONTRACT.md` §v33, `qa/BATCH7.md`.
`wary` and `fam` are memories held by ONE PERSON; above them there was nothing, so a square
you had tormented for four minutes was as easy to walk into as one you had never visited.

## THE DESIGN DECISION WAS MEASURED BEFORE IT WAS MADE

A field, not one number per chapter, because the people-span of all nineteen was measured
first (`qa/b7-diam.js`): median **169 m**, Palawan 90 to the Quay 638, only two under a
hundred. One number is a lie in seventeen of the nineteen.

**And the radius is derived from the range**: `npcHEAT_R = npcCHAIN_R × npcHEAT_LOOK`
(20 × 1.6 = 32 m). Floor = the chain radius times the biggest range multiplier heat can buy,
so a witness can never be recruited from outside the heat its own witnessing creates. Ceiling
= half the smallest chapter's span. That is the finale-gather trap obeyed by construction.
Decay 90 s linear — 3.5× the 26 s personal clock, which is the whole point.

## SIX WAYS AN ACCUMULATOR READS ZERO, ALL MEASURED

1. **`wary` IS ONE FRAME BEHIND ITSELF IN SYDNEY AND PASTO.** A local's is written inline by
   `localsReact`. Those two derive it from `alarm` inside `stepHuman` on the NEXT tick — so a
   witness count taken at the instant of an event reads a crowd that has not felt it yet. Two
   people at wary 0.64 three metres from the stall, `npcHeat` answering **0**, three times
   running. Read `max(wary, alarm)`.
2. **`npcHeat` HAD NO LIVE-BIOME GATE and never swept `paHumans`.** `stepHuman` runs only while
   Sydney is attached, so a Sydneysider you startled leaving chapter 1 is frozen wary for the
   session at a coordinate every chapter shares. The finds `most-wanted` and `not-a-soul` were
   asking about a Sydney park in seventeen chapters, and Pasto could not raise heat at all.
3. **AN INCIDENT IS NOT A FRAME.** The witness chain arms on every startle; a wheek in a
   38-person park startles most of it. Four seconds of real play took the field 0 → 1 with 26
   bumps. A site may be bumped once every 4 s. Ten heads turning is ONE thing that happened.
4. **ONE WITNESS IS AN INCIDENT, SEEN.** A step proportional to the witness count made one
   witness worth 0.116 — gone in ten seconds against a 90 s decay — in exactly the chapters
   with 6–10 people over 150 m where one witness is the normal case. Mostly-flat step, count
   as its top four tenths.
5. **A REACTION CAN BE TOO SOFT TO BE WITNESSED BY THE THING THAT COUNTS WITNESSES.** `kick` is
   strength × (0.35…1.0 by nearness) and the bar is 0.35, so `capy:grab` at strength 0.5 left a
   victim four metres away at **0.26**: flinching, speaking, and counted by nothing. 0.8.
6. **AN EVENT THAT CARRIES A PLACE HAS NO WAY INTO A CHAIN THAT TAKES A PERSON.** `capy:grab`
   never reached the two old casts — their chain is armed by `startle`/`plunge`/`standUp` and
   the graze handler, which needs a BITE. The theft itself was witnessed by nobody.

## SPEND IT ONLY ON ATTENTION, AND PROVE IT

Eight readers, all radii/cooldowns/lines/pose/music. The only one that can obstruct is the
guard shuffle, and the proof is that heat POINTS the shuffle rather than lengthening it: max
drift **0.54 hot and 0.54 cold**, both at `npcLOC_STEP_R`, in all 19 chapters. The skirt must
be round EVERY prop home and not round the guard's own stock — the centroid-only version
closed on props in eleven chapters of nineteen (Antarctica 0.50 → 0.33).

`game.forceHeat(1)/(0)/(-1)` is the differential lever and is a test hook, not a verb. It is
cleaner than a git stash: nothing else can have moved between the halves.

Result: watch range **14.64 → 23.88 m, ratio 1.631** over 68 people in 17 chapters against a
derived 1.6.

## AND THE PROBES LIED FIRST, EVERY ONE OF THEM

- `watching` inferred from a drawn yaw = 75.2 m of "attention" in Sydney. It is coincidence.
  Publish the flag the head-turn actually uses.
- A peak in a wandering crowd is noise: 19 / 28 / 24 for three identical robberies.
- A profile that teleports between stations startles the crowd it is measuring.
- **A profile that takes 40 s per approach cools the square it is testing** — heat pinned at
  0.24 for all three approaches in four chapters. The probe was destroying the accumulation.
- Ranking a "stall" by people-within-20 m, or by third-nearest, picks things nobody stands at.
  Every path in is a RADIUS; rank on the nearest person.
- `witLast` is written by two chapters only, so elsewhere it reports Sydney's last number.
- `qa/npchealth.js` had defect 2 itself: **38 "stuck" NPCs in the Quay, a chapter with no
  npc.js cast at all.** Now gated.

Related: [[capy3-the-closeout]], [[capy3-catch-all-state]], [[capy3-shared-space-leaks]],
[[headless-qa-harness]], [[capy3-instruments-that-cannot-hold-a-line]]
