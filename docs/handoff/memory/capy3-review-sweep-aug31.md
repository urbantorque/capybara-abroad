---
name: capy3-review-sweep-aug31
description: "The 31 Aug 2026 six-agent code sweep — where the findings file is, its headline bugs, and what was verified clean"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40361f66-1627-4059-b6a6-6c749b3dd1b8
  modified: 2026-08-31T12:27:30.042Z
---

A scheduled six-agent static review of the whole capy3 tree (31 Aug 2026)
produced `REVIEW-2026-08-31.md` in the repo root. **ALL SIX BATCHES ARE NOW DONE
AND COMMITTED** (a835164, 414c139, 77492d9, ee8d59b, 63898c3, 79dce97), each
verified by stash-and-re-run measurement rather than a single green run. The
file's header carries the live status and the Batch 7 list.

**Batch 7 (the art pass) is DONE too — 5de36d4 — and its lesson is that looking
beats reasoning.** Nine chapters inspected as rendered frames; **one changed**.

- **The sun's colour and intensity are already authored per chapter** — that is
  the evidence for what elevation it should be at. Cappadocia `#f5b98a`/1.43 is
  dawn, Hong Kong `#ffc94d`/0.97 is dusk, Marrakech and Palawan are near-white
  at 2.8, i.e. genuinely noon and right at 61°.
- Only **Cappadocia** had a pointable defect: a dawn frame with a balloon
  dropping a round shadow directly beneath itself. Set to 40°. **A true 12°
  dawn is impossible without shadow work** — `sysSHADOW_HALF` is 22, so the box
  is 44 units and follows the animal; a 15 m caster at 12° throws 70 m and is
  simply not drawn. 40° is the lowest that keeps tall casters inside the box.
- **Four chapters cannot show a sun direction at all**: Antarctica (heaviest
  hemi light in the game, thick haze, not one cast shadow in frame), Hong Kong
  and Iceland (night, artificial light carrying it), Monte Carlo (already
  evening). Changing them would have been change for nothing.
- **Sky domes can never take the rim**: `_RIM_FS_OUT` multiplies by
  `clamp(1 - dist/42)`, so it is zero past 42 m and the domes are ~300 m.
  Answered from the shader, no screenshot needed.
- **`weather.js` must not get the rim back** (a correction to the review): its
  material is mutated after construction — `m.emissive` when `glow` — so
  `_rimWants` judges the wrong thing and would rim glowing snow.
- Three real rim fixes shipped on `matOwn`: sail, harbour foam, dust pool.

Two repo decisions remain the owner's: untracking the 29 MB of curated hero
shots in `qa/pass/`, and whether `agent/skills/` stays.

**Batch 1 (the ten player-facing bugs) is DONE and verified, 31 Aug 2026.**
Four proved by stash-and-re-run differential: `dropOwned()` on a capy-held prop
is a measured no-op and `release(null)` is the only verb that empties the mouth;
Hanoi had 57 meshes sitting folded at rest, now 7; the shuttlecock's per-tick
step went 3.481 m → 0.07 m; the ferry rested 0.283 m off her berth node, now
exactly on it. Two harness facts worth keeping: the chapter picker keys work
ONLY on the title card (reload and press the key — pressing Enter first starts
Sydney and the keys then do nothing), while `game.biome.switchTo(name)` works
in-game; and `envFerry.gangwayX/gangwayZ` are rewritten every frame from the
ferry's live transform (environment.js:2074), so they look like constants,
follow her wherever she drifts, and hid the berth error.

**Batch 2 is DONE and verified too.** Three missing biome gates (hanWheek,
monWheek, and chatStep's owed reply — which needed a new `chatReplyBiome`,
because Sydney's and Pasto's rosters share one reply slot and carry no `.biome`
of their own the way a local does); 14 meshes across kyoto/cali/sahara/iceland/
rio given `userData.noShadow`; the missing flag branch added to
`rioNoShadowOnGhosts`; and `matOwn()` added to shared.js — the rim-layer twin of
`grainOwn` — to fix the palawan fish. Measured: casters 46→42 kyoto, 42→38 cali,
25→24 rio, 57→54 iceland; the fish material's `onBeforeCompile` own-property
false→true. Gates verified not to be mute buttons (`isActive(self)` true,
`isActive(other)` false, wheeks fire clean).

TWO THINGS WORTH KEEPING. **Sahara is another instrument that cannot hold a
line** ([[capy3-instruments-that-cannot-hold-a-line]]): two runs of identical
code gave 173 vs 171 meshes and 56 vs 54 casters, so only its named-mesh checks
are trustworthy. And **`mat(...).clone()` is at 18 sites, ~7 of which really do
lose the rim** — not the one the review found; three are BackSide sky domes
where a rim may be deliberately unwanted, so they were left alone pending a look
at the rendered frame. That is the top Batch 7 candidate.

**Batch 3 is DONE too.** The seaplane jumped 44.962 m twice per 94 s cycle (the
circuit's start angle was RUN1's *bearing*, not RUN1 being on the circle) — now
0.281 m, and its attitude is damped because the same seam hid a 113 deg yaw
snap. `sysSpillScan` walked the whole scene: `Object3D.traverse` recurses
unconditionally and detach only hides ROOTS, so standing in Sydney after a
Kowloon visit, 107 of Kowloon's 110 meshes still read `visible:true` and the
scan saw 20 candidates where the live chapter has 1. `switchTo`'s rollback left
its partial build in the world and a retry made TWO copies (measured with a
throwing ensureBuilt).

**The sun finding was real and I deliberately did not "fix" it.** All nine
`tall` chapters run Pasto's 61.1 deg near-noon star because `shadowFitBiome`
swapped the sun as a side effect of the frustum depth; Sydney is 41.4. Iceland's
subtitle is "half past eleven, and the sun is not the plan". Choosing a star for
eight *graded* chapters blind would regress many passes of art, so the coupling
is now explicit and one line wide (`sysSUN_BY_BIOME`), seeded to reproduce
today's picture exactly — re-measured identical to the decimal. Alongside the
rim clones, this is a Batch 7 art task, not a code fix.

**A third lying instrument:** measuring a moving object across `page.evaluate`
boundaries reports the real time that passes between calls as a one-tick jump —
it invented a 1.011 m "jump" in the already-fixed seaplane. Start each chunk
from the object's current position, never from the previous chunk's last sample.

**Batch 4 (efficiency) is DONE.** The journal card was the headline: jrRefresh
ran every frame while open, measuring **27,840 DOM mutations in four seconds**
(≈6,960/s) on a *paused, motionless* screen — now **4**, because the game is
paused behind that card and jrTravel closes it before moving anybody, so only
the clock can change. Rebuild on open, one change-guarded string per frame.
Venice's swell (2,555 verts × 3 sines + a full attribute re-upload) went 60 Hz →
30 Hz, matching the Drift's driRipT; nothing reads that attribute back.
**The spill fade was a correctness bug in disguise** — damped twice in one frame
when a chapter emptied, so a light went out in half its tuned time.

Two judgement calls worth keeping: I *skipped* the event-rate sfx option
literals, because routing more call sites through shared mutable scratch objects
is exactly how the wall-bonk bug happened, for an unmeasurable gain. And a
**fourth lying instrument**: a MutationObserver over the whole HUD subtree reads
873 vs 982 before/after a change that only *adds* write guards — crowd and
ambience churn swamp it. It cannot see the stamina/arrow guards; don't quote it.

**Batch 5 (dead code) is DONE, and it corrected the review.** The "zero callers"
list only grepped `src/`: `game.physics.keepOut` is called by SIX qa harness
scripts, `pasto.collapseStall` by `qa/ch3.js`, and `condorSummonedOnce` carries a
comment saying it is kept on purpose. **The rule this settled: delete internal
write-only state, keep published API** — a published verb with no caller today is
a contract the harness may already depend on. Authored NPC dialogue was left
alone too (content decision, not a code one). Net −35 lines. Watch for
co-declared live variables: `jumpPend`/`actionPend` and
`condorSpeedSm`/`condorAoASm` each share a line with a dead one. Verified by
RUNNING all 19 chapters — removing `sysBufVoice`'s definition left three live
callers, a ReferenceError no parser sees.

**A FIFTH LYING INSTRUMENT, and this one is about the repo itself.**
`core.autocrlf=true` with no `.gitattributes`, so every `git stash`/`pop` rewrites
touched files to CRLF. Same source built to 8980.4 KB twice, then **9018.0 KB**
after one stash round-trip (44,236 lines × 1 byte). Committed content is fine and
`git diff` stays honest, but `build.mjs` reads the working tree — **`dist/` size
is not reproducible on this machine**, and ROADMAP §1's "9.0 MB raw" needs
re-measuring from a clean checkout before anyone optimises against it.

**Batch 6 (tooling/docs) is DONE.** `build.mjs`'s three splices into index.html
were unverified exact-string anchors, and `String.replace` with no match is a
silent no-op — a reformat of index.html would have shipped a right-sized dist
file missing the whole game, or the MIT notice, and printed OK. All three go
through `replaceOnce()` now, and I proved it fires by breaking an anchor.
`server.mjs`: `GET /%zz` used to kill the process (URIError → unhandled
rejection); PNGs served as octet-stream; containment by accident; and an
unhandled `EADDRINUSE` — which had already killed this repo's QA server twice in
one session. All fixed and verified live. Added `.gitattributes`. README's
counts corrected against what the game reports (231 tasks / 19 chapters), and a
duplicated corrupted "salsa engine" section deleted.

**Do not quote `renderer.info.render.triangles` after a headless
`tick(dt, false)` — it reads 1**, the composite quad. CONTRACT.md's own budget
section ends by warning about exactly that, and `qa/budget.js` (which does walk
the scene) is one of the suites that cannot hold a line.

Headline bugs found: the confiscation beat dead in all 17 locals chapters
(npc.js:2531 calls `dropOwned()` with no args; fix is `release(null)`); the
visibilitychange handler unpausing behind the ledger/album (systems.js:19725);
gamepad LT mapped to both slide and grab (systems.js:18505); Hanoi's Train
Street furniture folding and never unfolding (hanoi.js:2203); Venice's
traghetto pontoons static at build-time low tide (venice.js:3320); the Sydney
ferry permanently off its berth from unseeded envFerryPX/PZ; one wall bonk
permanently de-positioning five capybara sfx (capybara.js:2273).

Recurring-class stragglers: three missing live-biome gates ([[capy3-shared-space-leaks]]
class — hanWheek, monWheek's guard branch, chatStep's owed reply), ~14 meshes
across kyoto/cali/sahara/iceland/rio needing `userData.noShadow` before
`registerShadowTarget` flips them back on ([[capy3-third-pass-six-seven]]
class), and one live clone-eats-shader on the palawan fish
([[capy3-clone-eats-the-shader]] class).

Verified clean (don't re-litigate): record() edge-triggering everywhere,
mesh.scale single writers, carriers, api-key matches, condor.js as a whole,
watchdog/fail-card wiring, importmap↔vendor pairing.
