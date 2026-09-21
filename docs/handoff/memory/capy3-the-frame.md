---
name: capy3-the-frame
description: "R4 — the pause card, the third audio bus, and the once-only sentence that was said before it knew anything"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1945dbd8-cc52-47cc-a02f-21d96d647160
  modified: 2026-09-01T11:45:41.676Z
---

Batch R4 of `ROADMAP-RELEASE.md`, committed 1 Sep 2026 (`d00c9a5`). Escape now
opens a real pause card (resume / settings / the journey so far / quit to the
title behind a confirm); master, music and effects faders with per-bus mutes; a
less-motion switch that works at runtime; all of it in a fourth storage key,
`capy3.prefs.v1`, which "start over" cannot reach. Gamepad Start opens it — it
used to open the departures board, which is nineteen destinations and no resume.

**THE MOST OF R4 WAS BUILT BY A CONCURRENT SESSION.** It was sitting
uncommitted in the tree when I went to start the batch. See
[[capy3-two-runs-one-tree]]: `git status` before starting a batch is not
optional, and `git add -A` would have swept 800 lines of somebody else's
in-flight work into an unrelated commit. **Never `git stash` to take a
differential when another writer may be live** — it yanks their work out of the
tree. Use `git show HEAD:path` into a temp file instead.

Three decisions in the audio work worth not re-litigating:
- `sysVOL_CEIL` stays **0.85** and the master fader is a SCALE on it, never a
  replacement, so at the default the graph is bit-for-bit the one the ~110
  hand-set sfx volumes and ten music palettes were balanced against. Raising the
  ceiling for "headroom above default" silently re-mixes the whole game.
- A third bus, `acSfxBus`, carries everything that is not the score. It works
  because of the pre-existing **acMaster swap**: `sfx()` points `acMaster` at a
  per-call panner / `acSfxIn` for the duration of the synth call and restores it
  in a `finally`. Sixty-four `g.connect(acMaster)` calls in the synth table
  therefore all route through the bus. *I initially read those as a bypass and
  was wrong — read the dispatcher before believing the connect sites.*
- Calm-motion became ONE channel (`calmOn`/`calmSet` at the foot of
  `shared.js`), replacing three independent module consts. The third copy was in
  `weather.js`, so without it the switch would have moved everything in the game
  except two hundred tumbling petals.

**THE BUG WORTH REMEMBERING — A ONCE-ONLY SENTENCE SAID BEFORE IT KNEW
ANYTHING.** R3's `saveSayDegraded()` had a single latch on the whole function
and is called from `startGame` at +700 ms, long before anything has tried to
write. Every later caller — `saveWrite`'s catch, R4's prefs writer — was a
no-op. And storage quota is **size-dependent**: a nearly-full store accepts the
two-byte `capy3.probe` write and rejects a ninety-byte settings blob, so on the
commonest storage failure that is not a private window the game said nothing,
for ever. The fix is the shape: **one latch per sentence, function idempotent,
every discoverer calls back in.** A global "said it once" latch on a function
that reports facts discovered at different times is always this bug.

**A NEW HARNESS TRAP, CREATED BY R3.** `localStorage.clear(); await
page.reload()` is **no longer a clean start** once a game has been started:
R3 put `saveFlush()` on `pagehide`, which fires DURING the reload, so the
journey still in memory is written straight back over the cleared key and the
new page restores it. It surfaced as a pause card reading "SYDNEY · 1:01:27" on
what was supposed to be a fresh run — the hour came from the previous probe's
fixture. Fix: **reload FIRST** so the flush spends itself, then clear from the
title, where `saveFlush`'s `started` gate makes the second navigation write
nothing. (`qa/r3-save.js` was accidentally immune: its `fresh()` always ran from
the title.)

Two more probe facts from the same session:
- `qa/r1-door.js` installs `page.addInitScript(localStorage.clear)`, which per
  harness trap 19 keeps firing for the **whole browser context** — running
  `qa/r3-save.js` after it in the same `-s=` session produced two confident
  false failures. `close` + `open` between probes that write-then-reload.
- A `document.body.textContent` search is now unreliable for title-card state:
  the pause card is in the DOM from boot and its quit copy contains the words
  "carry on". Scope such assertions to `.capyui-title`.

Roadmap review at this point (recorded in `ROADMAP-RELEASE.md`): every line
number in areas 1–4 has drifted and is archaeology; area 6's "in-flight v53
work" premise is stale (`cane-run` landed); areas 5, 6's other finds, and 7 are
all confirmed still live. **Counts: 231 tasks, 19 chapters, 56 records.** The
open owner decisions are LICENSE and whether key remapping / text-size /
colourblind are in scope at all — R4 shipped the card they would live on and
none of the three.

Related: [[capy3-last-door-and-save]], [[capy3-two-runs-one-tree]],
[[capy3-the-mix]], [[headless-qa-harness]]
