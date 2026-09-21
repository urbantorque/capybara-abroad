---
name: capy3-payoff-batch-three
description: "Payoff Pass batch 3 — framed became a channel, and seven of eight marquee moments were broken in ways no audit could raise"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0cdec4df-28aa-48ee-a0fa-8182f9e29ba8
  modified: 2026-08-25T17:04:26.266Z
---

26 Aug 2026, CONTRACT §v26. The five pillars on chapters 4-11 (Kyoto, Cali, Rio,
Iceland, Marrakech, the Drift, Venice, Hong Kong). Eight measurement subagents, fixes
on the main thread, one commit per chapter. `qa/BATCH3.md` is the handover.

**`game.frameShot({yaw, dist, pitch, raise, hold, w})` — batch 2's open finding B,
closed.** `rig()` could always ask for a distance, a pitch and a raise; there was NO WAY
to ask for a BEARING, so *framed* — the first of the four channels — was not something a
biome could opt into. A request with an envelope, not a cutscene: any camera input kills
it in a third of a second, it is weighted to nothing under the helm and the condor, it is
cleared on `biome:enter`, and **it is aged on `rawDt`** because a marquee is the moment
most likely to be under slow motion (`completeTask` pays `slowmo` on exactly the `wow`
rows a shot belongs to). Third timer in this codebase found on the wrong clock.

`yaw` IS THE BEARING FROM THE ANIMAL TO THE CAMERA, not the direction the camera looks.
Writing 0 where PI belonged reintroduced the exact bug it was fixing (0 of 336 curtain
vertices in frame). Get the sign wrong and it looks like the feature does not work.

**THE SHAPE: seven of eight marquees were broken, and not one in a way an audit could
raise.** A wrong bearing is not an error; a mono cue is not an error; a missing grade row
is not an error. Fourth pass in a row where the marquee is the richest seam.

**THE FOUR WORST**
- **Iceland's aurora was behind the camera, all twelve seconds.** Fan across −Z; the town,
  the pier, the sea and the rig's rest yaw are all +Z. 0 of 984 vertices in front, best
  dot −0.078; force-painting magenta at opacity 1 with depthTest off still rendered
  nothing. **Two comments directly above the line fix that aurora's ELEVATION, twice, and
  neither pass checked its azimuth.** Mirror in z AND flip the yaw sign, or every ribbon
  goes edge-on and vanishes again.
- **Kyoto's marquee fired 67 times and recorded 0.00 s.** The finish set `kyoRunT = -1` —
  the value the clock IDLES at — so the next frame re-armed it. **A one-shot payout needs
  a state meaning ALREADY PAID, not the value it starts life in.**
- **Rio's capybara was 1.56 m under the wave it was riding.** `localWater` unset, so
  `capyWaterY` never called the `waterHeightAt` Rio publishes. Same bug, same field, as
  Iceland's hot spring in batch 1 — see [[capy3-payoff-batch-one]]. **Any chapter
  publishing `waterHeightAt` without `localWater: true` is broken.**
- **Venice slid 2.76 m into the lagoon while standing still**, `velocity.z` exactly 0.000
  and `loaf` at 1.0. Heightfield sampled every 4 m over a THREE metre quay edge, so the
  contact triangle was a 6.6° ramp four metres back from the real edge while `slopeAt`
  said 0.003. **A sample spacing has to resolve the sharpest feature it carries.** The
  other chapters get away with 5 m because their features are hills.

**THE REPEATERS.** *A surface ladder must ask the chapter where things are* (v25, the
Quay) is in four more chapters — Kyoto's axis band put the whole of Uji on the SAND
default; the Drift had one rectangle for thirty islands; Venice's `venSurfacePitch`
declared `y` and never read it, so the Rialto sounded like the canal. *The loudest cue is
the most likely to be mono* (v25) was true in all eight: Kyoto's toy was better mixed than
its wow, and Venice's marquee made no sound at all.

**NEW RULE: a `wow` row is praised from 40 m, not `npcLOC_PRAISE_R`'s 15.** Only 41% of
San Marco is inside 15 m of anybody, so three locals held `acqua-alta` lines they could
never say.

**TWO GAPS NOT FIXABLE FROM A BIOME FILE.** Only 5 of 17 chapters register a critter, so
batch 1's calm inversion has nothing to invert in twelve — and Cali, Rio, Venice, Kowloon
and Marrakech have no ground animal DRAWN to register. Room tone is keyed per biome, not
per space, which costs most in Venice.

**LEFT OPEN, MEASURED.** Kowloon's roof: the deck's east lip overhung the climb column by
about a centimetre and stopped it at 33.36 m for forty seconds. Pulled to −9.70 the climb
reaches 34.36, but the animal tops out in open air 0.65 m east of the deck and cannot move
west — the scaffold colliders fill the bay to full height and you cannot step off a
lattice sideways. `symphony` is NOT blocked (it tests height and ticks from the cling).
Lowering `hkSCAF.top` to start the shove earlier is worse: peak drops to 34.09.

**HARNESS.** `qa/channels.mjs` audits three of the four channels with no browser.
`qa/stillness.js` judges stillness by DISPLACEMENT across 17 chapters, gated on the
chapter's own `slopeAt` and on swimming — without that filter it cries wolf on every hill.
**The mischief adoption counts are NOT stable between runs**: the scatter is randomised at
build, and Cali measured 3, then 0, then 2 owned across three runs of the same build. A
single run cannot certify adoption.

**AND I REPRODUCED v24'S OWN TRAP WHILE WRITING THE AUDIT** — a heredoc ate one backslash
of each pair, `\b` became a literal backspace, and the regex passed clean. `channels.mjs`
tokenises instead. See [[headless-qa-harness]]. Writing patch scripts through Bash
heredocs cost real time here; the Edit tool or a Write-then-run script is the reliable
route on Windows, and note `src/systems.js` is CRLF while most biome files are LF.

Related: [[capy3-payoff-batch-two]], [[capy3-payoff-batch-one]], [[headless-qa-harness]],
[[capy3-slip-and-sky]], [[capy3-render-pose-heuristics]], [[capy3-mischief-radii]]
