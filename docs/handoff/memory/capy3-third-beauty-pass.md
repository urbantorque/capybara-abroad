---
name: capy3-third-beauty-pass
description: ROADMAP-WOW (L11, 19-20 Sep 2026) — the third beauty pass; what shipped, what was found stale, how eight parallel agents were run and what stalled them
metadata:
  type: project
---

ROADMAP-WOW.md closed 20 Sep 2026 on branch lift-pass, 97 commits, CONTRACT.md "THE ELEVENTH LIFT". Planar reflections in twelve chapters, grass as a volume (src/grass.js), ground mist (weather.js wxMIST), dapple, rays, a cloud band + sun disc, foreground objects in four chapters, the living made round (capybara + npc animals; the law amended in one line), ONE PERSON (npcPERSON; Marrakech/Rio crowds rebuilt), ten movers given a moving part, heroes given secondary forms, Part D detail pass on the six weakest.

**Why:** the player asked for "40 % better, smoother, more wow" after LIFT10's audit said every dial was already turned — so this pass added capability instead of moving rows, and made "40 %" five measurable numbers (the Closed section lists each with its honest misses: still-pixel −40 % not met, cave/Iceland mirrors under 12 levels, Sahara sun unframeable).

**How to apply:** roadmap items here routinely turned out stale against the code (daisy fade already shipped; mote quads have no alpha; the mast is merged; the animal's belly band existed) — audit the code before building, and write the finding into the roadmap in the "reality check" voice. Parallel agents: disjoint file sets, one chapter per playwright run (<4 min), commit per increment, never close-all, stage right before commit (shared index). See [[headless-qa-harness]] traps 52-55. Left open by name in the Closed section: Kyoto lantern pools (spill-reach row), the Drift's sky, A3's cylinder widen, the still instrument's traffic mask, rv-geom re-baseline.
