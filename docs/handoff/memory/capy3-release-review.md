---
name: capy3-release-review
description: "31 Aug 2026 four-way release review — the seven gap areas, the three ship-blockers, and ROADMAP-RELEASE.md's ten batches R1–R10"
metadata: 
  node_type: memory
  type: project
  originSessionId: ea9668e7-a612-4a46-bff0-403769d72f6c
  modified: 2026-08-31T13:16:07.195Z
---

Ran 31 Aug 2026: four parallel audits (save/persistence, settings+audio surface,
onboarding/difficulty, chapter parity) on top of `ROADMAP.md` (delivery) and the
finished `REVIEW-2026-08-31.md`. Output: **`ROADMAP-RELEASE.md`** in the repo
root — seven areas, ten 2–3 h batches (R1–R10), one commit each.

**The three ship-blockers (R1–R3):**

1. **Sydney has no exit zone** — `homeOk` (systems.js:~22752) ORs eighteen
   `at*` predicates, none Sydney's; the only way out of ch1 is the ferry, task
   18 of 19, invisible in the 4-row paper. Also: journal travel rows are
   enabled-looking but dead when opened read-only (`jrTravel` gates on
   `jrDepart`, `jrRefresh` doesn't).
2. **The ending is skipped by default** — the "MISCHIEF COMPLETE" receipt fires
   wherever tick 231 lands; the lawn finale only checks on Sydney arrival, and
   a tap on the receipt reloads. `qa/pf2-finale.js` still seeds 17 chapters —
   the finale has never run at 19.
3. **The save is never flushed on tab-hide/close** (no
   beforeunload/pagehide; visibilitychange doesn't `saveWrite()`) — latest tick
   lost; a corrupted save presents as first-run and the first tile press
   `saveClear()`s it; `saveClear` leaves album+ghosts despite its confirm copy.

**The frame (R4–R5):** no pause menu, no settings surface at all (audio = four
unlabelled keys, nothing persisted, master hard-coded 0.85, no sfx level);
touch cannot pause, travel, mute, or open the journal. Reduced-motion and
photosensitivity are genuinely good; colorblind/remap/text-size absent.

**Polish (R6–R9):** salsa floor is the one true wall (114 ms window, 8
consecutive, no mercy — blocks 100% not progression). **Pasto (ch2) is the
weakest chapter on every axis at once** (1 ambience sound, 7 sfx calls, no
acts, 2 records) — the retention cliff. Latch stragglers the v53 idiom missed:
**rio.js calçadão** (whole 132 m escalation ladder dead after one tick, no
RECORDS row — strongest find), Arpoador clap, drift vane watch; Venice measures
Rialto + calli spans and discards both (two unclaimed records in a 2-record
chapter). Deliberate one-shots to leave: antarctic breach, venice flood / HK
show frameShot gates.

**R10 = ship:** LICENSE (owner decision), host+deploy, CONTRACT budget
reconciliation, stale count comments (systems.js "199 tasks/seventeen places",
"Sydney is eighteen tasks").

v53 (cane/dry-crossing re-arm + aria-live board) was uncommitted in the tree at
review time; R7 lands it with the rio/drift/venice stragglers.

Related: [[capy3-the-second-hour]], [[capy3-the-mix]], [[capy3-review-sweep-aug31]],
[[headless-qa-harness]]
