# ROADMAP-WOW3 — the debts paid, the world remembered, the still frame closed (21 Sep 2026)

L12 closed with a Closed section that named its own limits plainly rather
than rounding them off: twelve items left open by name, one number (motion
at rest) that stayed at the coverage its own predecessor measured, a far
plane that reads from twelve arrival frames and not two, a companion whose
per-kind landing spot is still a generic walk-off six biome files away from
whoever owns them. This pass is not a seventh notch on the same six terms —
it is paying down exactly what L12 wrote down as owed, plus one new
measure the project has never taken (the world changing while the player is
elsewhere) and one it has taken once and never closed (the still-pixel
target).

**Read before proposing anything to this codebase:** ROADMAP-WOW2.md's own
"Closed" and "Left open, named" sections are the map for this file — every
item in Part D below is copied from that paragraph, not invented, and gives
its own line number in ROADMAP-WOW2.md. CONTRACT.md's "THE TWELFTH LIFT"
entry is the short version; `git log 00f3b72..dfde990` is the twenty-six
commits behind it. Before building anything, grep for the identifier named
(`far.js`, `wxDIVE_RATE`, `reflectTex`, `compLeave`, `sysShelfStage`,
`npcPalAwayBiome`/`palAwayArm`) — several of these are one function away
from what the item asks for, the way L12's own N3.3 turned out to be.

The laws stand: low-poly flat Lambert for the built world, smooth for what
breathes (L11), `PALETTE` only, no textures, every new term a
`game.state.noX` parked at rung 1, no grade/sun/fog/mote/spawn row re-based.
The three-file discipline L12 ran on (one agent per file set, never two
live edits to the same file at once, stage by name, `git status` before
every commit) is kept — it went twenty-six commits without a single lost
edit or an index collision, which none of the eleven passes before it can
claim outright. Every visual item is proved by a per-pixel diff inside a
mask and a screenshot read by eye; every story item by a count the save
already keeps or one line added to it (no new save field beyond the two
named in Part X); the still-pixel item by W0's own extended mask
(`qa/wow2-still-mask.js`), not by wow-still.js's original one.

## What this pass measures

1. **The twelve debts paid or explicitly re-declined.** Each item in Part D
   either ships with its own before/after number, or is re-examined and
   written up as correctly not worth doing (the way V3 wrote up seven
   chapters as correctly skipped) — never silently dropped.
2. **Motion at rest, to full coverage.** L12's own number: animal
   chapter-independent, crowd 4/19. This pass runs `qa/wow2-alive.js` and
   `qa/wow2-people.js` (or their W6-confirmed successors) across all
   nineteen and reports every one, not a repeat of the same four.
3. **The still-pixel floor, re-closed.** L11's A3 target (−40%, met in
   10/19, never explained for the other 9) re-run against W0's extended
   mask (`qa/wow2-still-mask.js`, which already dropped Hanoi's floor from
   10.26% to 0.85% of frame by hiding traffic properly) — a number that has
   been sitting mismeasured for two passes closes or is named precisely why
   not.
4. **The place remembers you were gone.** Beyond N3's line (a regular
   notices; nothing moves): at least one thing in the WORLD itself is
   different on a long-absence return, per chapter that gets it, proved by
   a screenshot pair (short-absence vs long-absence arrival) and never by
   a toast alone.
5. **A voice for what became visible.** Every V1/V5/V6 term that makes a
   sound in reality (a footfall's puff, a drip, a keepsake set down, the
   traveller's walk-off) gets one, proved by `qa/audio2.js`'s own pattern
   (real keys, real clock, a channel that can be named and counted) rather
   than a silent visual credited as "done."
6. **16.7 held, the same discipline.** Every new term a `noX`, the combined
   A/B (`qa/wow3-frametime-final.js`, the L12 pattern copied forward) run
   once at the close, live-minus-cut ≤ 0.6 ms total, rung 0 pinned.

## Part D — the debts (cheap, named, mostly one function away)

Twelve items, each copied from ROADMAP-WOW2.md's "Left open, named"
paragraph (line ~1687 onward) with its own owner file. Build order is
cheapest-and-most-certain first; each is its own commit.

1. **`reflectTex()`** (src/shared.js) — a read-only getter for A1's private
   reflection render target, so V4's underwater ceiling
   (`game.state.noSub2`'s composite term in main.js) can sample the REAL
   scene reflection instead of the procedural rippled-brightening stand-in
   it shipped with. One export, one call-site change in main.js. Proved by
   the same per-pixel ceiling diff V4's own instrument used
   (`qa/wow2-sub.js`), now against a texture that actually holds the
   reflected scene rather than a formula.
2. **`wxDIVE_RATE` raised** (src/weather.js) — V4's bubble stream measured
   19–30 alive against a 40 target; the ring almost certainly laps before a
   bubble's own life ends. Raise the rate (or extend bubble life, whichever
   the numbers say — measure both), re-run `game.weather.diveAudit()` at
   steady state in the same four chapters V4 dove in.
3. **Mud and wet prints, put in front of a lens** (src/shared.js's tracks
   pool + the calling chapters) — V6 wired and wrote these; nobody ever
   read a screenshot of one. The Pantanal's bank (mud) and Venice's paving
   at low tide (wet-on-stone) are the roadmap's own named cases. Prove by
   the same masked-band diff V6's own `qa/wow2-tracks.js` used for sand and
   snow, extended to these two.
4. **A truss for Hanoi, a decision for Kowloon** (src/far.js +
   src/hanoi.js, src/kowloon.js) — V3's own honest miss: "a wedge cannot
   make a truss," eight end-on wedges merged into one pyramid instead of
   the Long Biên's trusswork. Build a small bay-loop primitive in far.js
   (a repeated N-triangle truss unit, instanced or merged, ≤ 200
   triangles total) and re-test from Hanoi's own arrival lens. Kowloon's
   far layer is invisible from arrival because the street has zero sky in
   frame — this is a camera/geometry fact, not a bug; the "decision" is
   either relocate the layer to where the helicopter ring or a rooftop
   task sees it (V3's own workaround, already measured at 14.7%) and say
   plainly the arrival lens will never carry it, or leave it as built and
   write down why. Do not force a wedge into a street that has no sky.
5. **Manly's ferry, lowered** (src/manly.js or src/far.js) — clips the top
   edge of the frame for 6 s of its 120 s loop instead of crossing through
   it. One position/path adjustment, re-measured on the same 120 s watch
   V3's own instrument used.
6. **Sydney's jacaranda gust** (src/weather.js + src/environment.js) — V5
   folded the purple gust into the existing ground-petal skitter rather
   than building a second mechanic, because the dapple canopy list only
   ever covered figs. Extend the dapple canopy registration to include the
   jacarandas (or build a minimal parallel list just for this one
   chapter's one tree species) and let V5's existing gust-strip code (built
   generically, reused already for four other chapters) fire on it in its
   own PALETTE purple, distinct from the ground-petal skitter it currently
   borrows.
7. **The companion's per-kind landing spot** (six chapter files: cave or
   wherever the pigeon's Campanile-equivalent sits, goreme, manly, quay,
   kyoto, sydney/environment — check each kind's actual `from` chapter
   against `compTRAITS`, not the roadmap's illustrative examples, which
   named real-world places this game does not all have) — the generic
   walk-off (`compLeave(..., 'home')`) already fires correctly (W6 proved
   it live for all six kinds); what is missing is a NAMED spot per kind (a
   ledge, a colony, a doorstep — whatever each chapter's own geometry
   offers) rather than wherever the animal happened to be standing. One
   `homeSpot` constant per kind, a short walk-to-it on arrival, proved by a
   screenshot of each of the six landings.
8. **N4's real opening** (src/capybara.js's nap pose + src/systems.js) —
   the shipped opening is a held establishing shot; the roadmap's original
   ask was the animal visibly asleep, the traveller's bag beside it, a
   walk-off while the animal wakes through its own existing nap pose. This
   needs a capybara.js hook no L12 wave owned (a pre-`started` render of
   the nap pose is the open question — confirm it is even renderable
   before Begin, the way the W6/Part N agents left it; if it genuinely is
   not, the fallback the roadmap allows is to delay the true opening until
   the FIRST frame after Begin, still before "be a menace." fires, and say
   so).
9. **The gardener's sit-down at the finale** (src/npc.js) — N4 shipped the
   stand-down; the roadmap's own ask was a sit-down beside the traveller
   once `fin` is true. One more state on the gardener's existing behaviour
   tree (chase → carry → stand-down → sit, gated on `game.state.finaleOn`
   AND `sysFinDone`), a pose the rig likely already has for the loaf/nap
   (reuse, don't invent a ninth pose).
10. **V0's carry-over** (src/shared.js, src/weather.js) — the thin-cylinder
    un-merge (Quay's mast and rigging, Pasto's cord) and the mote-quad
    minimum screen footprint through their spin, both named "half a day
    each" three passes ago and never started. Build both or write down,
    with the actual triangle/draw-call cost measured, why a fourth pass
    still didn't get to them — do not carry them to a WOW4 without a
    reason attached.
11. **The far plane's numeric sweep, re-run fresh** (qa/ only) — W6
    confirmed V3's far layers by file-touch history and by eye, not by a
    fresh `qa/wow2-far-depth.js` run across all nineteen. Run it now,
    fresh boot per chapter, and put a real number beside the eye-read.
12. **`qa/rv-geom.js` re-baselined** — named as an open item since L11's own
    closeout and repeated in L12's; if nothing has touched the geometry
    this instrument audits since, this is a ten-minute item; if something
    has, say what moved.

- **Instrument:** each item proves itself with the instrument named in its
  own line above; no new shared instrument needed for Part D.
- **Cost:** items 1–3, 5–6, 9–12 are single-function or single-constant
  changes. Items 4 and 7 are the only ones with new geometry (a truss
  primitive, six landing spots) and both are named as such.

### W1 — shipped (21 Sep 2026)

Items 1, 2, 3, 5, 9, 10, 11, 12 — shared.js's `reflectTex()` and the
tracks read-proof, weather.js's dive-rate investigation and mote
footprint, manly.js's ferry, npc.js's gardener sit-down, qa/ for the
far-plane and geometry re-baselines. Commits `c688914` `10f8ad9`
`19402a9` `c1b5c60` `8a11938` `71c492e`.

- **1, `reflectTex()` — built.** shared.js exports the reflection
  target's own `{ value }` object (the same one every water's `uReflT`
  already points at); main.js's V4 ceiling term samples it
  (`tReflC`/`uReflCeilOn`) when it holds a picture and falls back to the
  original rippled formula when it does not (no water in the chapter, or
  the target has never rendered). Caught one shader bug of its own along
  the way: this composite pass is GLSL 300 (WebGL2) and wants `texture()`,
  not `texture2D()` — the first version threw a compile error on every
  frame with `uSubCeilK > 0`. Verified in Kyoto (a `sysREFLECT` chapter):
  `reflectInfo().on` true, the new branch renders with zero console
  errors. Palawan (no water in `sysREFLECT`) exercises the null-fallback
  path. `reflectRender` itself refuses to draw while the eye is under the
  water plane — exactly what a dive does — so what the ceiling samples
  during a real dive is the LAST picture from just before the eye went
  under, not a live one; still the real scene, not a formula.
- **2, `wxDIVE_RATE` — found already correct, not raised.** Simulated the
  exact recurrence outside the game: at rate 48/s and life ~0.81 s mean
  the design target is ~38-39 alive with no early kills from the ring
  buffer, and a bubble only travels ~0.3 m in its own natural life so the
  surface top-cut only bites below ~0.2-0.3 m of clearance — the V4/W6
  chapters were all measured 1.6-8 m deep. Pool contention from npc.js
  ruled out by grep: its only other `burst('bubble', …)` call is gated
  `npcGEST_COLD = { iceland, antarctic }` and never fires in Palawan,
  Rio, Kyoto or Venice. Live proof: `qa/wow3-d2-dive-math.js` (fixed deep
  spot, deterministic dt) settles at 38-40 within a second; a REAL dive
  in all four chapters (`qa/wow3-d2-dive-profile.js`) reads 36-44 alive
  at genuine peak depth in every one. Kyoto and Venice's ponds are
  shallow and the animal swims back toward the surface within a couple of
  seconds of diving — the original low readings were very likely taken
  off-peak in that trajectory, not a flaw in the tuning. No code change.
- **3, mud and wet-on-stone — both real.** Wet-on-stone (Venice) proved
  cleanly: swim, walk onto paving inside the 12 s window, 4/4 prints,
  `qa/wow3-d3-wet-eye.png` shows four dark paw marks on pale stone and the
  `noTracks` diff shows the same cluster. Mud (the Pantanal's bank) fires
  — the pool reached its own ceiling, 32/32 live, 105 born, at a point
  whose `surfacePitch()` matches `capyFootfallFx`'s own gate exactly (0.6
  and 0.68, both ≤ 0.70) — but every eye-read attempt at that spot landed
  either on the animal's own body or too close/dark to read the decal
  clearly against grass's grain, unlike stone's flat pale surface. Proved
  by the per-pixel diff and the code path, not by a clean screenshot —
  named honestly rather than rounded up. No src/ change; no bug found in
  the pool.
- **5, Manly's ferry — built.** Brought the path in from z -500/-530 to
  -290/-300 (manly.js, the `farMover` spec only — far.js untouched). A
  grid sweep against the arrival lens (`qa/w1-ferry-sweep`, not kept —
  see the two committed instruments below) found the z window (-340 to
  -260) that clears the top edge on the North Head side without dipping
  behind either Head's own far-layer geometry. Measured before: NDC y
  0.86-0.88 at the worst point. After: 0.50-0.55 on the same pin, 0.37 on
  an independent second session's pin, zero occlusion at either path end.
  `qa/wow3-d5-ferry-shot2.png` shows it mid-frame under the tree line.
- **9, the gardener's sit-down — built.** `sysFinDone` is unreachable from
  npc.js without a systems.js edit (out of this wave's file list), so
  this gates on `finaleOn` alone — already the flag that means the shelf
  is laid out and the traveller figure is standing on the ring, the
  simplification the roadmap names as acceptable. New state
  `'gardenerSit'`, `npcGardenerSitSpot()` reading the traveller's own
  position, `npcSEAT_CROUCH` reused rather than a new pose. Found and
  fixed one collision along the way: `npcGather` (the five-person crowd
  recruiter, also on `finale:staged`) didn't exclude gardeners, and
  `'gather'` is a state `thinkHuman` never re-tasks anyone out of — a
  gardener recruited there would never reach the sit-down code. Added to
  the same exclusion as patron/waiter. Verified live: both roster
  gardeners reach `'gardenerSit'`, settle 1+ m apart beside the
  traveller, keep speaking.
- **10, V0's carry-over — one built, one still blocked.** The mote-quad
  minimum footprint is built: every mote tumbles on three axes with a
  uniform scale and goes edge-on to a hairline once a cycle regardless of
  size; `wxFootK()` inflates the scale (capped 2.4x) inside ~13° of
  edge-on, wired into both the main field and the bursts. Verified live:
  sampled the instanced mesh's real matrix scale across 5.5 s in Sydney —
  boosted values (0.11-0.26) sit well above the unboosted ceiling
  (~0.07), confirming it engages continuously, no visible regression at
  normal distance. The thin-cylinder un-merge (Quay's mast, Pasto's cord)
  is still blocked — ROADMAP-WOW.md's own 19 Sep reality check already
  found the actual blocker (the mast is baked into the ferry hull's
  merged mesh; the fix needs an un-merged `Mesh` or new per-vertex-
  attribute plumbing, either way a `quay.js`/`pasto.js` edit), and both
  files are this wave's explicit Do-Not-Touch list. A fourth pass in a
  row this has been named and not attempted; still one function away,
  just not this agent's function to write.
- **11, the far plane's numeric sweep — re-run, clean.** All nineteen
  chapters, fresh boot each (`qa/wow2-far-depth.js`, unmodified — the
  file itself is the instrument, per-chapter copies were not kept), zero
  console errors across the board. Manly's own reading now shows the
  ferry mover at z -295.5 (confirming item 5 landed) with NDC y 0.23.
- **12, `qa/rv-geom.js` — re-baselined, and it was very stale.** The
  committed baseline (`qa/RV-GEOM.png`) predated the whole of ROADMAP-
  WOW2 apparently — a fresh run found 58 changed / 95 added / 69 removed
  geometry rows across every one of the nineteen chapters plus the root
  scene, batch count 1992→2029, total vertices 2 665 393→2 721 606. None
  of that is this wave's own doing (my edits touch a mover's runtime
  *position*, an instance matrix *scale*, and NPC state — none of which
  write to a mesh's local vertex buffer, which is all this hash reads);
  it is the accumulated drift of every WOW2 pass since whenever this was
  last captured. Re-baselined now (`qa/RV-GEOM.png` overwritten with the
  fresh run) — it will go stale again the moment W2's far.js truss/
  Kowloon work lands, which is expected and for W2 or W5 to re-run, not a
  fault of this baseline.

**Miss, named plainly:** item 10's un-merge is the one item of the eight
not built, for a file-ownership reason stated above, not a difficulty
one. Item 3's mud is real but not eye-provable at the render angles this
agent found; a different chapter or a taller/less-oblique camera might
read it more clearly for whoever revisits it.

### W2 — shipped (21 Sep 2026)

Items 4, 6, 7, 8 — far.js's truss primitive and hanoi.js/kowloon.js's
call sites, weather.js's jacaranda gust and environment.js's parallel
canopy list, systems.js's compHOME table, and capybara.js's minimal
nap-forcing hook. Four commits, `81ef293` (D6), `77f0b5b` (D4), `7b0ad9e`
(D7), `03892d3` (D8).

- **4, a truss for Hanoi, a decision for Kowloon — built and
  re-confirmed.** `farTruss()` (far.js): a bay-loop primitive, thin
  quads not boxes, ~12 triangles a bay — a truss reads end-on (the one
  place the deck's own lens ever stands) BECAUSE it is mostly the air
  between its members, which a wedge's solid silhouette profile has no
  way to be. `farBundle()` gained a fourth optional slot, `truss`, static
  like `layer` and counted the same way in the tris/calls audit — no new
  cut flag, the existing `noFar`/rung-park convention already covers it.
  hanoi.js's far bundle now runs 14 bays (168 triangles, under the
  200-tri cap) from the deck's own end (z 250) to z 460. Verified: the
  chapter ARRIVAL lens still sees 0% of it (expected — the lens is 53°
  off the bridge axis, ROADMAP-WOW2's own prior finding, not a
  regression, re-confirmed fresh via `qa/wow3-d4-hanoi-far.js`); from the
  deck camera V3's own instrument used (`qa/wow3-d4-hanoi-bridge.js`),
  pct 6.0% -> 6.23%, tris 92 -> 260 (56 wedge + 168 truss + 36 train,
  exact). `qa/wow3-d4-hanoi-crop.js`'s crop of the raw deck render shows a
  receding row of small Xs converging toward the vanishing point, gaps
  visible between members — read by eye as a truss, not the abandoned
  build's solid grey pyramid. Kowloon: left as built, not relocated — the
  street frontage has zero sky in frame and no geometry fix changes that;
  Lion Rock is not orphaned regardless, the helicopter's own furthest
  ring already sees it (`qa/wow3-d4-kowloon-air.js` re-measured 14.68%,
  V3's own 14.7%, tris still 88, nothing drifted).
- **6, Sydney's jacaranda gust — built.** `envDAPPLE_JAC`
  (environment.js): a second, PARALLEL canopy list (all fifteen
  `envJAC_SPOTS`, r 4.4), not folded into `envDAPPLE_FIGS` (already at
  grain()'s own eight-circle shading cap) and not baked through grain()
  at all — registration only, exported since this wave owns weather.js
  too. `wxStepJacStrip(dt)` (weather.js): Sydney-only, the same
  nearest-canopy/0.84-peak-gate shape as the existing gust-strip half of
  `wxStepStrip`, its own cooldown (`wxJacCd`) so it fires independently
  of the figs' green gust, in `PALETTE.petalPurple`, into the shared
  `moteQuad` pool — never the separate `skitMesh` the ground-petal
  skitter already owns, so the two are categorically distinct regardless
  of shared hue. Verified live (`qa/wow3-d6-jacaranda.js`): gust forced
  constant past the gate, 31 purple instances landed 4.07-4.69 m from the
  jacaranda centre (matches the crown radius exactly) at y 2.47-3.55 m
  airborne, while 19 green (fig) instances landed near a different fig
  spot in the same window — two independently-sourced, differently-
  located bursts from one forced gust. `qa/wow3-d6-jacaranda-shot.js`
  caught a frame with 14 live slots: small coloured motes visible
  scattered in the air above the crown, a higher, separate cluster from
  the ground-level petal/decal scatter beside the neighbouring tree in
  the same shot.
- **7, the companion's per-kind landing spot — built.** `compHOME`
  (systems.js, beside `compTRAITS`): six coordinates, x/z only, copied
  (read, not imported) from each kind's own `from` chapter's already-
  built landmark — `venCAMPANILE` (venice), `gorPLAZA` (goreme, the cats'
  own wander bounds), `manGULL_HOME` (manly, already named for this),
  `antCOLONY` (antarctic), `kyoHERON_A` (kyoto, "the near shallows"), and
  Sydney's rubbish-bin stand (environment.js's own `binX`/`binZ`, copied
  not exported). `compLeave(capy, 'home')` now snaps the drop point to
  the named spot instead of wherever the animal was standing, then walks
  the same short distance further IN — deeper toward its own place —
  rather than back out toward the player; every other reason (`told`,
  `far`) is untouched. Verified live (`qa/wow3-d7-homecoming.js`, W6's
  own save-forced-stow pattern, one reload per kind): 6/6 kinds caught
  mid walk-off, `stowDebug()`'s x/z within 0.3 m of `compHOME` every
  time. `qa/wow3-d7-eye.js` then screenshot each spot through the game's
  own settled camera: heron's shot is the strongest — pond shallows,
  reeds, and a "got close enough to make the heron leave" toast, proving
  the wild heron critter genuinely lives at that exact coordinate; cat's
  shot is the honest miss — numerically correct (gorPLAZA is real and
  cats do wander its bounds) but this vantage showed Goreme's balloon
  field instead of anything recognisable as a plaza; the other three
  (pigeon, gull, gentoo, ibis) read as fitting general areas without the
  single specific landmark object square in frame.
- **8, N4's real opening — the nap and the bag built, the walk-off
  still not.** `capybara.js:capyForceNap(v)` overrides ONLY the
  per-frame OUTPUT of `capyNap`/`capyLoaf`, never `capyRestT`/`capyBusy`
  underneath, so releasing it hands the pose back to the ordinary damp —
  the nap's own wake-up beat, reused rather than re-animated. First
  confirmed the pre-start rendering question was moot: `game.tick` runs
  every module regardless of `started`, and `startGame` itself sets
  `game.state.started = true` well before the opening fires, so the
  roadmap's own fallback ("first frame after Begin") was already true by
  construction. `sysOpeningPlay` (systems.js) now calls
  `capyForceNap(1)` and shows a two-box rucksack
  (`sysBagBuild`, PALETTE.capyPouch/khaki) beside the animal the moment
  the beat starts, and releases/hides both in `finish()` (skip or
  timeout, same path). No new cut flag — the whole sequence is already
  behind the pre-existing `noOpen`. STILL NOT BUILT: the traveller's own
  visible walk-off — genuinely blocked the same way N4.1 found it, the
  figure is npc.js's (`addTraveller`, the N2 glimpse pattern) and npc.js
  is this wave's explicit do-not-touch. The bag disappearing at the same
  moment stands in for the carry-off without showing it. Verified live
  (`qa/wow3-d8-opening.js`, a genuinely fresh file): by 2.34 s
  `capy.nap`/`capy.loaf` both 1, the bag visible beside the animal, the
  model visibly lower than its pre-nap Y; a key press mid-beat drops nap
  to 0 within 400 ms and both fields settle to 0 with the bag gone 1.5 s
  later, "the lawn is yours" toast up as normal.

**Budget, all four items:** none needed a new `game.state.noX` flag —
each reuses an existing one (`noFar`, `noStrip`) or sits entirely behind
one that already gates it (`noOpen`); `compHOME` adds no per-frame term
at all. New static geometry: 168 triangles (Hanoi's truss, one-time
build, no per-frame cost) + 24 (the opening's bag, shown at most once a
session). No new mote-pool contention (the jacaranda gust shares
`moteQuad`/`wxMOTE_MAX` on the same terms the fig gust always has). A
combined frame-time A/B across every WOW3 flag together is W5's own
closeout item, not repeated per-wave here.

**Miss, named plainly:** item 8's traveller walk-off and item 7's cat
landing (numerically correct, not eye-confirmed as "a plaza" from the
camera angle tried) are the two honest misses this wave found; both are
named above with the reason, not rounded up.

## Part H — needs a human, not an agent (not built by this pass's agents)

Two numbers from ROADMAP-WOW2's own Closed section that no bot can supply.
**Left for the player, named here so they are not silently dropped:**

- **A real-GPU frame budget.** Every 16.7 ms figure in twelve lifts so far
  is headless vsync, not the reference machine's own GPU. One session with
  the in-game perf overlay (`game.perfAudit()`), all `noX` flags from L11
  and L12 toggled by hand, on the actual hardware.
- **The stranger.** T's own playtester was a script, twice now (L12's
  closeout said so plainly). One person who has never seen the game, three
  minutes, asked the six verbs afterward.

Nothing in Part D or Part X substitutes for either. An autonomous pass
cannot build them; it can only keep naming them, which this section does.

## Part X — the fourth notch (new measures)

### X1 — THE PLACE REMEMBERS (the world changes while you are gone)

N3 gave a REGULAR a line on a long absence; nothing in the world itself
moved. This is the smallest honest version of "the place remembers,"
picked for being provably different in a screenshot rather than a toast:

- **One visible difference per chapter that has an easy one**, gated on
  the same ≥20-minute-away test N3's `palAwayArm`/`npcPalAwayBiome`
  pattern already uses (read it, reuse the exact arm/check shape rather
  than inventing a second timer): a stall's stock visibly different
  (the traveller's shop — a few items swapped, PALETTE-only, ≤ 3
  variants), a seasonal/weather-independent prop moved (a boat retied at a
  different post, a market stall's awning a different colour from a small
  fixed set), the animal's OWN prior tracks (V6's pool) long faded and a
  fresh set from a regular or local walking a path that was empty before.
  Pick the cheapest one per chapter and do not force a fourth if a chapter
  has none that reads honestly — name the chapters skipped, the way V3
  named seven chapters correctly left out of the far plane.
- **The shelf in earn-order** (src/systems.js, src/shared.js's
  `sysSAVE_SHAPE`) — N1 shipped one fixed slot per chapter because no save
  field recorded when a keepsake was taken. Add exactly one field,
  `keptAt` (an object keyed by chapter, the tick or wall-ms it was
  collected — additive, like `chapms`, never re-based), and lay the shelf
  in that order instead. This is the one new save field this pass allows
  beyond N3.3's still-open item below.
- **The companion that comes over** (src/npc.js) — N3's own roadmap text
  said "the next time you stand there, it is there, and it comes over";
  N3 shipped the homecoming but not this last clause. Once a companion has
  gone home (`compLeave(..., 'home')` fired), the next time the animal
  stands within its own `near` radius of the home spot (Part D item 7), it
  approaches — the SAME approach beat a regular or a companion-on-offer
  already uses, not a new one.

- **Instrument:** `qa/wow3-remembers.js` — a short-absence (5 min) and
  long-absence (20 min) arrival pair per chapter that got a visible
  difference, screenshot both, per-pixel diff, read by eye; the shelf's
  `keptAt` order checked against three saves collected in different
  orders; the companion's "comes over" beat proved live for at least two
  kinds (the pattern W6 used for the homecoming — a forced save, a real
  reload, a real walk-up).
- **Cost:** no new geometry beyond what a chapter already owns (a stall's
  stock swap is a texture-free colour/shape swap on existing merged
  meshes); one save field. **`game.state.noRemember`.**

### X2 — A VOICE FOR WHAT BECAME VISIBLE

L11 and L12 made things visible that have never made a sound: a footfall's
puff, an eave's drip, a keepsake set down on the shelf, the traveller's
walk-off, a companion's homecoming approach.

- **Footfalls** (src/capybara.js's footfall hook, already publishing a
  ground-kind + position every step for V1.3's mote burst) — a soft
  contact sound keyed to the SAME ground kind the puff already reads
  (sand/snow/water/stone), reusing whatever contact-sound machinery the
  game already has for landings (grep `sfxLand`/a landing sound's own
  ground-kind switch before building a second one).
- **The eaves' drip** (src/weather.js) — one `sfx('drip', ...)` per mote
  spawned, quiet, position-attached if the audio layer supports panned
  one-shots (check the existing pattern used for the shower's own
  onset/offset sound before assuming a new channel is needed).
- **The shelf** (src/systems.js) — one sound the moment a keepsake is laid
  (`sysShelfStage`'s own per-keepsake placement, N1), reusing whatever
  sound a prop pickup/set-down already makes elsewhere rather than
  authoring a new one.
- **The traveller's walk-off** (src/npc.js) — N2's fifteen glimpse figures
  already have a footstep gait; if the gait doesn't already drive a
  footstep sound (check first — the roster likely already has one for
  ordinary walking locals), wire it for this figure specifically since it
  is the one the player is now looking directly at.
- **The companion's approach** (X1's "comes over" beat) — the SAME
  once-per-kind sound `compTake` already plays on being picked up, reused
  on arrival rather than a new line.

- **Instrument:** `qa/wow3-heard.js` — real keys, real clock (per the
  harness note: hand-driven ticks never unlock the AudioContext), one
  chapter with a footfall on sand, one shower's drip cycle, one shelf
  placement, one glimpse walk-off, one companion approach — each a named,
  counted channel (the `qa/audio2.js` pattern: hook the channel, tag the
  sample with what fired it), not a "did anything play" boolean.
- **Cost:** reused sample triggers on existing channels wherever possible;
  no new synthesis unless grep confirms nothing suitable exists.
  **`game.state.noVoice2`** (a single cut for all five, since each is a
  one-line trigger and none costs anything to leave live).

### X3 — THE LENS LEARNS TO LOOK

A2 named Sydney's Opera House as "still behind the fig crowns... left as a
camera item, not a geometry one" across THREE passes now (L11's own
closeout, repeated unchanged in L12's). This is the one item in this
roadmap that is a genuine camera-behaviour addition, not a debt:

- **Sydney's arrival**, specifically: on the FIRST arrival in Sydney on a
  fresh file only (never on every return — the roadmap's own "not a
  one-shot except where named" rule), a slow ease of the resting lens's
  own yaw/pitch by a small fixed amount (measured against the actual fig
  crown's screen-space extent, not guessed) so the shells clear the
  crowns for the two or three seconds the place card is up, then release
  to the normal resting pose. This is a camera nudge, not a tree edit —
  it must not fight the player's own look input (C/drag) if they touch it
  before the ease finishes; abort cleanly on input, the way T's tutorial
  beats already abort cleanly on the player's own action.
- **A glance at what moved.** When V3's far mover (a ferry, a plane, a
  train) crosses the frustum while the animal is idle and the camera is at
  rest (not mid-task, not mid-hop — gate hard on `capy.grounded &&
  !input active for 2s`), ease the lens toward it by a few degrees for
  its crossing and release after — the smallest version of "the camera
  noticed," built once and shared by every chapter with a far mover
  rather than per-chapter.
- Do NOT build a general cinematic-camera system. Two named cases only,
  both released cleanly on player input, both provably reversible.

- **Instrument:** `qa/wow3-lens.js` — Sydney's first-arrival ease measured
  (fig-crown occlusion of the shells, before/after, the same
  masked-object-visibility pattern used to prove the Opera House problem
  in the first place); the far-mover glance proved to trigger on a mover
  crossing and to abort within one frame of a keypress.
- **Cost:** a camera-position lerp, no new draw calls. **`game.state.noLens2`.**

### X4 — THE STILL FRAME, CLOSED

L11's A3 set −40% as the still-pixel target and met it in 10 of 19
chapters, with the other 9 traced to the OLD instrument's mask missing
traffic and herds — which is exactly what W0 built `qa/wow2-still-mask.js`
to fix, and which has sat unused against the original target ever since.

- No new visual term. Re-run L11's original nineteen-chapter before/after
  comparison (`qa/wow-still.js`'s floors, already recorded) against the
  EXTENDED mask, and report, per chapter, whether the −40% target is now
  met, and for the ones still not met, whether the cause is real shimmer
  (worth a future fix) or still an instrument artefact (name which).
- If a chapter's still-pixel floor is genuinely high under the honest
  mask, this pass does not chase it with a new suppression term (that is
  exactly the kind of new-term sprawl the roadmap's laws exist to
  prevent) — it is named for a future pass, with the number attached.

- **Instrument:** the extended mask against L11's original 19-chapter
  before/after set, one table, no new flag (measurement only).

### W3 — shipped (21 Sep 2026)

X1a/X1b/X1c and X4. Two commits, `c2ba220` (X1) and `a9240c4` (X4).

- **X1a, the shelf in earn order — built.** One new save field, `keptAt`
  (`sysSAVE_SHAPE`, systems.js), additive like `chapms` beside it. The
  single real choke point turned out to be `completeTask`, not
  `sysShelfStage`: `keepHeld(cn)` can go true two ways (`chapComplete` at
  100%, or `chapEnough` at 70% plus the chapter's own `to-` task
  specifically), and both changes only ever happen by a task finishing
  there — one line, `if (cn && jrKeptAt[cn] === undefined && keepHeld(cn))
  jrKeptAt[cn] = jrTotalMs();`, right after the ceremony's own gate, catches
  both paths with nothing scattered. `sysShelfStage` now sorts the held
  chapters by `keptAt` ascending (a chapter held before this field existed
  falls back to its own chapter number, which sorts ahead of every real
  timestamp) and hands `sysShelfSlot` the sorted RANK rather than the raw
  chapter index — the nineteen physical slot positions are unchanged, only
  which chapter lands in which one moves. The journal's own flat grid
  (`game.shelfAudit`) stays in chapter order on purpose; it shows all
  nineteen, earned or not, and a reshuffling index would be unreadable.
  Cuts cleanly to chapter order under `game.state.noRemember`. Verified
  live (`qa/wow3-x1a-shelf-order.js`): three saves over the same three
  chapters (quay/venice/cave) with `keptAt` scrambled a different way each
  time — the shelf's physical left-to-right order, read off each held
  chapter's own keepsake prop (`physics.keepOut(biome).body.position.z`),
  matched the earn order every time, and reverted to chapter order the
  moment `noRemember` was set and the shelf re-staged.
- **X1b, the world remembers — built, three chapters.** `sysWorldAwayCheck`
  (systems.js), a genuine sibling to `sysPalAwayCheck` just above it: same
  `sysChapLeftAt` table (already written for every chapter, not only ones
  with a regular) and the same `sysPAL_AWAY_MS` threshold, no `jrChapPal`
  gate at all. Arms exactly three chapters — quay, kyoto, venice — via a new
  `game.worldAwayArm(biome)` hook into npc.js. The other sixteen are
  correctly left out, not forgotten: every chapter's own local grows a
  stall through npc.js's shared `addTraveller`/`npcMakeStall`, so the
  mechanism itself works anywhere; three is what got checked live against
  the actual resting arrival lens in the time this wave had, and a fourth
  was not forced. **A real bug found and fixed along the way:** the first
  build read the armed flag at `npcMakeStall`'s own build time, on the
  doc-comment assumption that "a chapter's locals are rebuilt fresh on
  every arrival" — measured false. `main.js`'s `toSet.built` gate means a
  chapter is `ensureBuilt()` exactly ONCE per session; every return after
  the first reattaches the same standing objects. Since arming structurally
  cannot happen before a chapter has been left once — which means the
  stall already exists — the build-time read was dead code that would
  never see the flag in time. Fixed: `worldAwayArm` now finds the
  already-built stall directly and repaints its roof and two stripes in
  place (`npcSwapStall`, a material swap via `npcLocMat`'s own cache, no
  new draw calls) the moment the door opens; the build-time branch stays as
  a harmless fallback for the one path that would see it fresh (a failed
  build's retry). The alternate pair is `PALETTE.cloth2`/`cloth1`, two
  colours, both already textile tints, neither the default. Verified live
  end to end (`qa/wow3-x1b-remembers.js`): the gate itself does not arm at
  5 minutes and does at ~25 for all three chapters, and never arms the
  control (pasto, at 999 minutes); quay's stall is unswapped on first
  arrival, unswapped after a real 5-minute absence, and swapped after a
  real ~25-minute one — read by eye too
  (`qa/wow3-x1b-quay-short.png`/`-long.png`): the long-absence shot shows
  the roof/stripe assembly in blue and coral where the short one does not.
- **X1c, the companion that comes over — built.** Lives in **systems.js**,
  not npc.js as the roadmap's own file list guessed — checked by grep
  before writing anything: npc.js has no companion code at all, every
  `compHOME`/`compLeave`/`compTake` reference is in systems.js. `compLeave`'s
  own `'home'` branch now also records `compWentHome[kind] = compFrom`
  (session-only, like `sysChapLeftAt`) at the one moment a kind is
  genuinely sent home. `stowUpdate` gained one new idle-only check: nothing
  currently held, standing in a biome some kind was sent home to, within
  `compHOME_NEAR` (8 m — the same order as a local's own default `near`) of
  `compHOME[kind]` — and it reuses the EXACT beat the save-restore branch
  a few lines above it already uses (`compTake`, then `compState =
  'follow'`), not a new one; the ordinary follow logic already in this
  function closes the rest of the distance on its own. Cuts under
  `noRemember`. Verified live for two kinds
  (`qa/wow3-x1c-comes-over.js`, W6's own save-forced-stow pattern): pigeon
  (venice) and heron (kyoto) both sent home and confirmed cleared
  (`kind: null`), teleported to within 3 m of their own `compHOME`, and
  both picked themselves back up as a follower unprompted — held stable a
  second read 1.5 s later, not a one-frame flicker.
- **X4, the still frame, closed — measured, not chased.** No src/ edits.
  The 9 chapters L11's Closed section traced to the old mask were derived
  exactly rather than hand-copied: every chapter whose `movedPct` ROSE
  between `qa/wow-still.json` (the pre-A3 "before" floor, still on file)
  and `qa/wow-still-after.json` (A3's own after-sweep, old mask) — sydney,
  pasto, cali, kowloon, goreme, manly, cave, antarctic, hanoi, exactly nine,
  and the three largest increases (hanoi +185%, cave +176%, manly +57%) are
  exactly the three ROADMAP-WOW.md names "the worst". Re-measured each
  live against W0's extended mask (`qa/wow3-x4-still-remeasure.js` — the
  algorithm in `qa/wow2-still-mask.js`, adapted to loop chapters directly
  against this wave's dev server rather than that script's own
  port-5189/`chapter.txt` driver, which this wave's port-5188 setup cannot
  reach) and compared fresh against the SAME original "before" floor.
  **6 of 9 now meet −40 %:** sydney −73 %, pasto −65 %, cali −41 %,
  kowloon −100 %, goreme −92 %, cave −75 %. **3 do not:** manly +208 %,
  antarctic +295 %, hanoi +36 % (down sharply from +165 % under the old
  mask — the extended mask genuinely helps here, it is just not enough).
  Hanoi's remaining gap reads as real: traffic the extended mask does not
  fully catch (a moving train/lane recycled rather than newly spawned, so
  it never trips the "moved > 1 cm" instance test the mask uses). Manly and
  antarctic are the honest miss of this item: under the SAME live session,
  the extended mask (hiding a strict superset of what the old one hides)
  produced a LARGER diff than the old mask did, which should not happen if
  the excess were purely masked motion — measured, not explained, and
  named here rather than guessed at or chased with a new suppression term.
- **Budget.** No new `game.state.noX` flag beyond `noRemember` (X1's own,
  covering the shelf sort, the world-difference arm and the companion
  approach in one). No new per-frame term and no new draw calls: the shelf
  sort is a comparator over ≤19 items run at Sydney arrival, the stall
  repaint is a one-time material reassignment reusing an existing cache,
  and the companion's approach reuses the existing follow-movement code
  path entirely. X4 added no runtime cost at all (measurement only).

**Miss, named plainly:** X1b shipped three chapters, not "every chapter
that has one" — a deliberate scope cut for what could be checked live in
the time this wave had, not a technical limit (see X1b's own note on why
the mechanism generalises). X4's manly/antarctic misses are measured and
unexplained, not root-caused; hanoi's is explained (real remaining
traffic) but not closed. **For W4:** `game.worldAwayArm(biome)` (npc.js) is
the exact hook name if X3's Sydney-arrival-ease or far-mover-glance work
needs to coexist with a stall repaint on the same arrival — they should
not collide (the ease/glance are camera-only, this is geometry-only), but
both now fire off the same `biome:enter` payload. This wave's systems.js
edits (`sysWorldAwayCheck` beside `sysPalAwayCheck`, ~line 35660;
`jrKeptAt`/the completeTask hook, ~line 35410-35470; `sysShelfStage`'s sort,
~line 36350; `compWentHome`/the stowUpdate check, ~line 43160-43600) sit in
a different region from W2's opening/finale code (`sysOpeningPlay`,
`compHOME`/`compLeave`'s own D7 edit) and from W1's own touches — confirmed
by reading the diff, not assumed.

## Order and ownership

Four waves, matching the file-exclusivity discipline that held clean for
twenty-six commits in L12: one agent per disjoint file set, one chapter
per playwright run, commit per verified increment, `git status` right
before every commit, stage by name.

- **W1 — Part D, items 1–3, 5, 9–12** (shared.js's reflectTex + tracks
  read-proof, weather.js's dive rate, manly.js, npc.js's gardener
  sit-down, qa/ only for 11–12). The cheapest, most certain items first.
- **W2 — Part D, items 4, 6, 7, 8** (far.js + hanoi.js + kowloon.js's
  truss/decision; weather.js + environment.js's jacaranda; the six
  companion-kind chapter files' landing spots; capybara.js + systems.js's
  real opening). The items needing new geometry or a capybara.js hook.
- **W3 — X1 + X4** (systems.js's shelf earn-order + `keptAt` save field,
  npc.js's world-changes-per-chapter + the companion's "comes over," the
  still-mask re-measurement — no new src/ edits for X4, report only).
- **W4 — X2 + X3** (capybara.js's footfall sound hook (read-only claim
  on a hook, coordinate with W1/W2 if still live), weather.js's drip
  sound, systems.js's shelf sound + Sydney's arrival ease + the far-mover
  glance, npc.js's glimpse footstep + companion approach sound).
- **W5 — the closeout.** The six numbers, the combined frame-time A/B
  across every WOW2 AND WOW3 flag together, CONTRACT.md's thirteenth
  lift, this file's Closed section.

W2 and W4 both touch npc.js and systems.js — sequence W4 after W2 lands,
the same way L12 sequenced V5 after Part N to avoid a live double-edit.

## Rules for every agent

- Check CONTRACT.md's section list AND ROADMAP-WOW2.md's Closed section
  before building anything — most of this file's items are one function
  away from existing code, not new systems.
- Never re-base a grade, sun, fog, mote or spawn row; never add a save
  field beyond `keptAt` (X1); never say the why.
- Every term cuts, parks at rung 1, and is proved inside a mask by a
  per-pixel diff and a screenshot read by eye.
- One chapter per playwright run, under four minutes; own session only,
  never `close-all`; `git status` right before every commit; stage by
  name; never edit a file another live agent owns.
- The lens is not deterministic between arrivals — pinned poses for any
  before/after.
- Part H is not for an agent. Name it in the closeout; do not attempt it.

## Held (named, not built)

Lightning; motion blur; TAA; textures of any kind; a named protagonist or
a voice for the animal; cutscenes that take the controls for more than ten
seconds; a new-game-plus that resets anything; a why said out loud; a
general cinematic-camera system (X3 is two named cases only); a fourth
save field beyond `keptAt`.
