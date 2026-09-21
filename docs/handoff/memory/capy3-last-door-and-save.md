---
name: capy3-last-door-and-save
description: "R2+R3 — the receipt that covered the ending, and the four ways the save layer lost or destroyed a journey"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1945dbd8-cc52-47cc-a02f-21d96d647160
  modified: 2026-08-31T23:44:26.149Z
---

Batches R2 and R3 of `ROADMAP-RELEASE.md`, committed 1 Sep 2026 (`45f06b9`).
Both were ship-blockers and both were single-digit-line defects hiding behind a
lot of correct code.

**R2 — two endings, and the wrong one won.** `showEnd` (the MISCHIEF COMPLETE
ledger) was wired to the 231st tick; the authored ending (`sysFinaleCheck` /
`sysFinaleClose`, "THE LAWN") only ran on arrival in Sydney. A completionist
finishes in Antarctica, so on the default path the receipt drew over the ice at
+8 s, paused the game, and armed a tap-anywhere `location.reload()`. The lawn
had shipped in v24 and almost nobody had ever seen it. Fix: `showEnd` returns
early unless `sysFinDone`; the tick abroad raises a place card pointing home;
the tick in Sydney calls `sysFinaleCheck` (which could not have staged on
arrival, because nothing was finished then).

Three things the fix had to know:
- `ended` was set only by `showEnd`, and the keydown handler tests `ended` — not
  `ledFinal` — for "press Enter to cause it all again". Suppressing `showEnd`
  silently broke that promise until `ended` moved into `sysFinaleClose`.
- `completeTask`'s `silent` early return sits ABOVE the `doneCount` branch, so a
  restored complete file triggers nothing anywhere. That is why a finished
  player who closes the tab needs `sysEndSayHome`, hung off `biome:enter` and
  `startGame`, and not a second trigger inside `completeTask`.
- `sysFinDone` is declared thousands of lines below `showEnd` in the same
  closure. Fine at call time; see the TDZ trap in R3 below for when it is not.

**R3 — four separate silences in the save layer.**
1. `sysSAVE_DEBOUNCE` (700 ms) drained only inside the rAF loop, and a hidden
   tab has no rAF. Measured: tick → hide → reload found *no file at all*.
   `saveFlush()` now runs on `pagehide` and first thing in the
   `visibilitychange`-hidden branch. Unconditional, not `if (savePending)` —
   `ms` is the journey clock and is always stale — but gated on `started`, or
   the title card manufactures a file for a journey nobody began.
   NOT `beforeunload`: unreliable on mobile, ignored in bfcache, and listening
   for it disqualifies the page from bfcache on some engines.
2. A save that would not parse presented as a **first run**, and the first tile
   press then took `startGame`'s non-restore branch and `saveClear()`d it.
   `saveRead` now quarantines non-empty unparseable bytes to
   `capy3.journey.broken.v1`, once, never overwriting an existing quarantine.
3. `saveClear()` removed the journey key only; the album and ghost stores
   survived a "start over" whose confirm copy promises "every record and every
   souvenir". It now clears all three and drops `albShots`/`ghStore`, or the
   next write puts the same contents straight back.
4. Storage failure and `__capySoftGL` were both read by nothing.
   `saveSayDegraded()` says at most three lines, once, after the game starts.
   It **probes** setItem rather than trusting a flag: reading works in a Safari
   private window and writing is what throws, and the first real write may be a
   whole chapter away because Sydney emits no `biome:enter`.

**THE TDZ TRAP THAT ALMOST SHIPPED.** `saveRead()` is called by the title card,
which is built ~3 700 lines ABOVE the save block. Flags declared as `let` down
there are still in their temporal dead zone at the one moment `saveRead` has to
write them — a ReferenceError inside the function whose whole job is not to lose
anything. `sysSaveOff/Hurt/Said` live at module scope beside `sysSAVE_KEY`, for
exactly the reason `sysALB_KEY` does (see the comment there).

**HOW TO TEST A DEBOUNCED WRITE HONESTLY.** Do the tick, the read, the
lifecycle dispatch and the second read inside ONE `page.evaluate` — synchronous,
so no rAF frame can land in the middle and write it for you. A probe that waits
between the steps passes against a game with no flush at all.
`dispatchEvent(new Event('pagehide'))` drives the handler directly; for the
hidden branch, `Object.defineProperty(document,'hidden',{get:()=>true})` then
dispatch `visibilitychange`, and put the descriptor back afterwards.

**FRAMING THE LAWN FOR A SCREENSHOT.** `camYaw` is closure-local in systems.js
and Z/X only nudge `camYawTarget`, which the idle tidy-up drags straight back
behind the animal's heading — a press-and-release loop measured *zero* movement
over 60 iterations. Aim the animal (closed-loop walk), then press **C**, which
snaps the rig behind it. The lawn is (30, 26), r = 2.6, mouth facing the spawn;
the readable shot is from the north-east looking south-west
(`qa/r2-horseshoe.js`, FROM [36.5, 19.5] STAND [32.9, 23.1]) — from due west the
boom sits inside a jacaranda, and from due south the arc reads as scatter.

Counts as of this commit: **231 tasks, 19 chapters, 56 records**, Sydney 19.
Much of the "seventeen"/"hundred and ninety-nine" prose elsewhere in `src/` is
still stale and was deliberately left; only the ledger header, `jrOpen` and the
lawn block were corrected.

Related: [[capy3-the-first-door]], [[capy3-release-review]], [[headless-qa-harness]]
