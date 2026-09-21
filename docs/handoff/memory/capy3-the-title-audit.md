---
name: capy3-the-title-audit
description: "The 5 Sep 2026 title-screen audit: the card is finished and the screen around it is not; ROADMAP-TITLE.md's six opportunities and three batches (T1-T3), written for Opus 5"
metadata: 
  node_type: memory
  type: project
  originSessionId: baff573d-bbf0-4095-850d-69d7b12bdd6f
  modified: 2026-09-05T09:07:59.084Z
---

Audited 5 Sep 2026, read-only, on `master` (uncommitted: `ROADMAP-TITLE.md`,
`qa/title-audit.js`, `qa/title-measure.js`, `qa/AUD-*.png`). The hand-off is
**`ROADMAP-TITLE.md`** in the repo root; batches T1 (the world behind the card),
T2 (scale/offset, Begin above the legend, copy), T3 (hero proportions, arrival
and page-turn choreography). Not yet executed as of writing.

**The finding that set the shape: the card is done, the screen around it is not.**
Before `started` the camera is the ordinary play rig (`sysCAM_DEF` 9.5, ~35 deg,
yaw 0) looking at the lawn, with the capybara at `[0,0.3,22]` directly under the
card; `.capyui-title` then fogs it to 0.84 at the foot and blurs 5 px. NPC speech
bubbles (`npc.js` `sayBubble` pool, inline-styled divs under z 60) show through
the wash because the ice-cream van's lines fire before any key is pressed.

**Numbers worth keeping:** card 647x486 at 1920x1080 (34 % x 45 %); wordmark
414 px; `max-width:640px` fixed on page one; hero picture 40 % / word panel
617 px; "19 places, any order" said three times; four small-caps labels on
page two. `qa/title-measure.js` reproduces all of them.

**Why:** a future pass on the front of the game should start from the roadmap
and these numbers, not re-audit. The design-taste skill's "anti-centre" and
"decision above reference" rules are the two that actually bit here; the rest
of the card already passed.

**How to apply:** run `qa/title-audit.js` before touching anything and diff
the PNGs; `qa/uiwide.js` is a phone-overflow probe despite its name. The
typeface (Trebuchet fallback drift) was deliberately left as the author's call
because a woff2 would be the project's first asset file.

Related: [[capy3-the-front-of-the-game]], [[capy3-light-on-the-shelf]],
[[capy3-the-front-door]], [[capy3-two-pages-and-a-chart]], [[headless-qa-harness]]
