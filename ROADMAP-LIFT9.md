# ROADMAP-LIFT9 — seen, not just built (18 Sep 2026)

LIFT8 shipped a whole loop — collect, spend, wear, get chased — and closed
clean: twenty checks, zero failed, the numbers written down. This roadmap is
what a five-agent review sweep found once that loop was actually *played*:
the fruit is there but nobody can see it, the paper it's tracked on crowds
the screen, there is nowhere to spend it that feels like a place, and one
chapter's traffic moves in a way that reads as broken even though nothing
is. Six items, none of them new mechanics — every one is a lift of
something already in the tree, aimed at what the sweep actually measured
rather than what looked wrong from memory.

The brief came with the player's own words, quoted where they anchor an
item.

## What the sweep found, said once

- **The fruit is round, not bright.** Measured against Sydney's sunlit
  grass, a plain yuzu is **1.17:1** luminance contrast — visible because of
  its silhouette, not its colour. At 40 m ahead (52 m from the resting
  camera) it paints **7–9 px, 0.005 % of the frame**, already 51 % into the
  far depth-of-field blur, and its one "look at me" channel — the
  proximity sparkle — only switches on inside 8 m (`systems.js:44003`),
  which is exactly the range the player isn't complaining about.
- **The HUD's "busy" feeling is one element, not ten.** Nine other pieces
  are small, edge-pinned, and event-gated — the corners are already
  honest. The to-do paper alone runs 44–54 % of the screen height at rest
  and carries up to twelve text blocks (marquee, three tasks, way-on line,
  traveller line, tally, two record lines) whether or not any of them are
  live.
- **The minimap resolves everything and shows almost nothing clearly.**
  Nineteen worlds, zero missing marks — but the door's own label eats
  47–75 % of the chart's width, all five landmark glyphs share one grey
  ink, and the chart takes no input at all: no hover, no hold, no zoom.
- **The traveller already *is* the shop and nobody can find them.** The
  bag opens from anywhere (the wallet pill, no proximity gate) and buys
  upgrades, consumables and wardrobe rows today — but the figure who
  triggers the in-person gift has no mesh, no stall, no minimap mark, and
  sits at the chapter's *exit* in fifteen of nineteen worlds.
- **Hanoi's bikes snap, not stutter.** The lane's heading comes from the
  current polyline segment's raw endpoints (`hanoi.js:521`), so crossing a
  vertex rotates a bike instantly. The lake ring alone throws 4.6
  headings-snaps over 20° per second where the camera usually is; the
  straight streets measure zero. A second, unlisted bug rides along: open
  lanes teleport a bike 144–202 m when they recycle, sometimes ~30 m in
  front of the player.
- **One leak, real and unbounded.** `chaosFireRunaway` (`systems.js:44340`)
  spawns a physics prop with no despawn and no list — every "runaway"
  incident, in all nineteen chapters, leaves one solid body behind forever.
  A long session accumulates bodies until reload. This is the exact class
  of bug the F4 drops fixup already solved once.

## The six features

### V — THE YUZU, SEEN
*Player: "they need to be even larger, visible from further away (eg.
levitating or slightly elevated from the ground or have some sprite/aura
that is a bit more visible and visually pleasant from further away)."*

1. **Scale.** `props.js:1042` `physSphG(0.19)` → **0.30**; `:1046` `0.23` →
   **0.34**; move the leaf nubs (`:1043`, `:1047`) to match. `physFitDef`
   (`props.js:2029`) re-derives the collider from the mesh, so
   `physTYPES`'s `hy`/shape rows follow with no second edit. Buys ×1.6
   diameter on its own — necessary, not sufficient; it does nothing for
   contrast.
2. **Lift.** `sysDROP_LIFT` (`systems.js:43693`) `0.45` → **0.85–1.0**. The
   measured mesh height above ground is 0.28–0.44 m today (the body settles
   under the lift, the bob sometimes subtracts) — below bench seats, table
   tops and crowd props. `sysDROP_TOUCH_R`'s pickup gate reads the *body*,
   not the mesh (`:43694`), so this is free of the pickup rule. Target: the
   mesh centre never drops below **0.8 m**, measured the way the review's
   probe did.
3. **An additive billboard aura — the contrast fix, not just the size
   fix.** One pooled `InstancedMesh` of camera-facing discs, one instance
   per live drop (cap 4–10 via `dropCapFor`), built the way `sparkMesh`
   already is (`systems.js:12537`: `MeshBasicMaterial`,
   `toneMapped:false, fog:false, depthWrite:false, AdditiveBlending`,
   billboarded off `camera.quaternion`). **0.9 m** across for a plain
   yuzu, **1.3 m** for golden; colour over 1.0 (`[1.5,1.25,0.45]` /
   `[1.9,1.6,0.5]`) so it clears every biome's bloom threshold, including
   the two night chapters where it will read strongest; opacity pulsing
   0.35→0.55 at ~1.1 Hz, matching the beacon's own pulse rate
   (`systems.js:47344`). Target: **≥ 25 px** projected at 52 m — the
   review's clean-sightline instrument (`qa/rv9-yuzu-clear.js`) is the
   check.
4. **A vertical shaft for the blocked-sightline biomes (Monaco, Kowloon,
   Hanoi).** Reuse `beaconShaft` verbatim (`systems.js:12369`): a 3 m open
   cylinder, additive, over-1.0 colour, spun at 0.6 rad/s. Survives partial
   occlusion the disc alone cannot — Monaco's terraces hid every ground-level
   marker in the review's nine-bearing sweep.
5. **Widen the sparkle radius.** `dist2 < 64` (`systems.js:44003`) →
   large enough that the one juice channel the drop already has fires at
   the distances the player is actually looking from, not just the last
   8 m.
6. **The minimap dot is already there and undersized.** `systems.js:26938`
   draws a live drop at `1.7 * u` in flat `PALETTE.yuzu` — bump to **2.4 u**
   and give golden its own `PALETTE.yuzuGold` fill so the chart
   distinguishes the five-point prize from the one-pointer. One line.

Order: 1 and 2 first (numbers only, no new geometry), then 3 (the real
fix), 4 only in the three named biomes, 5–6 free-standing. Instrument:
extend `qa/rv9-yuzu-clear.js` into `qa/l9-yuzu-visible.js` — same
projected-diameter measurement, asserted against the 25 px target at 40 m
ahead in Sydney and Hanoi.

### H — THE PAPER, TUCKED
*Player: "the current UI / HUD looks a bit too condensed and busy."*

1. **Invert the tuck rule.** `todoTuckTick` (`systems.js:24778`,
   `sysTUCK_AFTER` `:24775`) currently tucks the paper while the animal is
   moving and reverts the instant it stops — reverting exactly when the
   player can read. Flip it: tuck **6 s after arrival regardless of
   speed**, unless a task just ticked or a marquee just opened; bring the
   full sheet back on a tap of the paper itself (or the existing journal
   key). Tucked frame measured at 231×46 px — the Goose-Game restraint the
   title pass already established.
2. **Move what's never urgent off the sheet.** `.capyui-rec`
   (`systems.js:25143`) and the way-on/traveller remark rows
   (`:9489–9497`) are 4 of the paper's 12 blocks and none of them changes
   moment to moment. The way-on line already has a `.capyui-tabsub` fold —
   give `.capyui-rec` the same, or move both onto the journal card
   (`.capyui-jr`, `:8235`), the pause-side surface built for exactly this.
3. **Hide the item pill instead of dimming it.** `.capyui-item`
   (`systems.js:9425`) sits at opacity 0.42 reading "the pocketed kind"
   whenever nothing is pocketed — which is the normal state, 127 px of
   furniture saying nothing. Hide it entirely until something is pocketed
   (`:9439` + the writer at `:48198`); shrink the wallet pill to match at
   the same 10.5 px. Also fixes a real touch-target miss: the merged pill
   should be ≥ 44 px tall (currently 57×25).
4. **Two small collisions at narrow width, not urgent but free to fix
   alongside the above:** `.capyui-home` × `.capyui-map` (44×25 overlap)
   and `.capyui-pips` × `.capyui-home` (23×7) at 390 px wide — give
   `.capyui-home` a `max-width` and bump its bottom offset under the
   existing `@media (max-width:560px)` block (`:10753`).

Everything else — map, stamina, pips, home prompt, toasts — is already
correctly corner-pinned and event-gated per the sweep; leave it alone.

### M — THE CHART, READ AT A GLANCE
*Player: "enhance the look and feel of the minimap further."*

Nine changes, cheapest first, all in `mapDraw` (`systems.js:26768`) unless
noted:

1. Size up: `clamp(118px,18vw,164px)` → `clamp(132px,20vw,190px)`
   (`:10455`); phone `clamp(92,24vw,124)` → `clamp(110,30vw,148)`
   (`:10484`).
2. The door's text label becomes hover/hold-only, drawn at rest only when
   the door is the pinned goal — it currently runs 47–75 % of the chart's
   width (`:26975–27050`).
3. A rounded, vignetted frame: deepen `.capyui-mapv`'s inset, raise the
   corner radius, add a warm 1 px rim (`:10468`) — reads as folded paper
   rather than a HUD rectangle, matching the title pass's direction.
4. Replace the wash-like heading cone with a narrower wedge: `half`
   0.42→0.26, `reach` 26u→18u, alpha 0.34→0.22 (`:26834–26846`).
5. Distinct glyph per landmark kind, not one grey ink for all five:
   keep triangle for peak/star, give `boat` a hull outline, `water` a
   ring, `leaf` a leaf tick, `faint` a hollow dot (`:26847–26889`).
6. A hover/hold legend: `pointer-events:auto` on the map, a small DOM
   panel that fades in on hover or hold (no key collision — checked
   against every bound key).
7. Hold-to-zoom: halve the fit span around the player while held
   (`mapFit`, `:26540`), matching the door for M6.
8. Fade the whole overlay to 0.72 opacity when nothing is live (no goal,
   no drop, no marquee ring), back to 0.95 within 200 ms of anything
   returning (`:10459` + the writer at `:48195`).
9. The breadcrumb trail's three alpha bands (0.05–0.27) are invisible
   over sand and cost more than they say — drop to one band at 0.22 or cut
   it (`:26797–26833`, net **−20 lines**).

### S — A SHOP, EVERY BIOME, ON THE MAP
*Player: "Make every biome have a 'Shop' that allows the upgrade/purchase
of items using Yuzu (make this obvious in terms of navigation in the
minimap)."*

The review's finding governs the design: **the bag already buys from
anywhere, and the roadmap holds "a shop with stock or timers" on purpose**
(`ROADMAP-LIFT8.md`, Held). So this feature is a landmark and an in-person
perk, not a gate — buying stays reachable from anywhere; the stall is
*where you go*, not the only place you're allowed to buy.

1. **One shared stall, attached to the traveller everywhere.** Copy
   `npcMakeUmbrella` (`npc.js:2953`) as the build pattern — lazily built
   shared geometry, attached to the traveller's own `rec.group` inside
   `addTraveller`, so it inherits the capture tag, shadow registration and
   `gateChap` visibility for free. Base the geometry on the existing pasto
   stall (`pasto.js:2016–2085`: posts, table, striped awning), one awning
   colour per biome. A static `CANNON.Box` under the table, the same idiom
   as the traveller's own body (`npc.js:3306`) — **not** a `physTYPES`
   entry, which are all grabbable/throwable furniture.
2. **Two placement traps to check per biome, not assume clear:** the
   stall must sit ~1.6 m *behind* the traveller along `o.face`, or its
   collider blocks the 3.2 m interact radius and the E-door stops working
   (raise the reach to ~4.5 m and re-measure `minD`, the way
   `qa/l8-trav.js` already does); Kyoto's bridge deck and Pantanal's flood
   margins need a footprint check at 3.5 m before anything is placed
   there.
3. **Minimap mark — a sibling of `way`, not a `marks` row.** A
   `{get:'shop'}` row would silently draw nothing in Sydney, which
   publishes no biome api at all (every Sydney mark today is a literal
   coordinate) — exactly the staleness class `mapMarkAudit` exists to
   catch. Instead: one new top-level field per world, `shop: {live:
   'shopWhere', t: 'the bag'}`, and one resolver branch in `mapMarkPos`
   (`:26695`) — `if (m.live) { const f = game[m.live]; … }` — reading the
   traveller's existing global `game.travWhere()` (`npc.js:15692`, wired
   at `main.js:2123`). Draw it after the door as a sixth glyph (an
   awning/coin shape); pulse it via the existing `mapPulse` only when
   `jrYuzu >= cheapest unowned row`, steady otherwise; reuse the door's
   off-map rim-arrow branch verbatim (`:27120–27140`) for when it's out of
   view. ~4 lines in `mapMarkPos`, ~25 in `mapDraw`.
4. **Discoverability off the map too:** the awning is the 40 m read on its
   own; a hung sign or lantern reuses Kowloon's neon build
   (`hkBuildNeon`, `:2147`) in the two night chapters. On the paper: a
   `sysSHOP_ID = '__shop'` pseudo-row, built exactly like the traveller's
   (`:25096`), shown **only when the wallet can afford something
   unowned** and gated on the same `chapDoneHere` the figure uses — so it
   never points at an invisible stall, and the arrow stays guidance, not
   urgency, matching the way-on's own rule.
5. **Say the actual unlock out loud.** The in-person gift (hold E, 5 to
   `jrGifted`, the peel-pouch at 100 lifetime) is the one real reason to
   visit in person and it's invisible today — a small authored line on the
   stall itself ("leave something") is the whole fix.
6. **No new save key.** Everything derives from `travWhere()` plus the
   existing `owned`/`inv`/`yuzu`/`gifted` rows.
7. **Instrument:** `qa/l9-shop.js`, per biome (19) — teleport to 2.2 m in
   front of the resolved spot, assert the stall renders, its body blocks
   from behind, `minD` to the figure stays inside the interact reach, a
   paper row appears when affordable, a real E-tap opens the bag with no
   away-line, and `qaBuyUpgrade` succeeds. One static row in
   `qa/l8-catalogue.mjs`: every biome in `sysTRAV_PLACE` has a stall.

### T — HANOI, SMOOTHED
*Player: "the Hanoi motorbike animations are a bit choppy and dont look
smooth, that needs to be fixed."*

Confirmed cause, measured, not guessed: `hanLaneAtS`'s yaw comes from the
current segment's raw endpoints (`hanoi.js:521`,
`Math.atan2(b[0]-a[0], b[1]-a[1])`), so crossing a lane vertex snaps
heading instantly. The lake ring's vertices run up to 42.4° and throw 4.6
snaps over 20°/s where the camera is; straight streets measure zero as the
clean control. Sub-rate matrix updates, the fixed-step/render mismatch,
braking steps and quantised lean were all measured and ruled out.

1. **One smoothed-heading function, five call sites, the source geometry
   untouched.** Add `hanLaneYawAt(L, s)` — a central-difference tangent
   over a **3 m baseline**, the pattern already proven in `cali.js:1476`
   (`caliRouteAt`), clamped at the ends of open lanes. Do *not* edit
   `hanLaneAtS` itself — pavements, terraces and shopfronts are all laid
   out from its yaw (five other call sites) and moving it re-lays the
   district. Wire the new function into exactly: `hanSyncBikes`
   (`:1647–1656`, the drawn matrix and lateral normal), `hanBikeAt`
   (`:1689–1692`), `hanUpdateTraffic` (`:1787–1788`, the mover sfx's
   Doppler direction), `hanUpdateRide` (`:2702–2706`, `:2725–2728`), and
   `hanUpdateFolk` (`:3845`, `:3879` — pedestrians snap identically).
   **Target: max heading step < 3°/frame at 9 m/s, 60 Hz** — the review's
   math gives B=1.06 m as the exact threshold at the worst vertex, so 3 m
   has margin.
2. **Stop recycling bikes in view.** Open lanes currently teleport a bike
   end-to-end (`:2141–2145`, and the airborne branch at `:2049–2053`) —
   measured 144–202 m in one frame, ~45/minute map-wide, sometimes ~30 m
   in front of the player. Hold the recycle until the bike is off-screen
   or do a kerbside U-turn instead. **Target: zero displacement events
   > 20 m within 70 m of the camera per minute.**
3. **The fix is worth more than Hanoi.** The ride is the strongest
   argument for doing this at all — `hanPlaceRideBody` (`:2748–2752`) sets
   `angularVelocity = dy/dt`, which spikes to ~44 rad/s for one frame at a
   sharp vertex today. Monaco's pack cars have the identical step-function
   yaw in `monTrackAt` (`monaco.js:763`, turns up to 86° at the Fairmont
   hairpin) — milder only because the kinematic bodies spread the snap
   over an interpolated frame. Same fix, same file pattern, cheap
   follow-on once T1 exists.
4. Instrument: extend the review's own probe into
   `qa/l9-hanoi-smooth.js` — real rAF, sample heading step and
   displacement for a fixed set of bikes over 10 s at the lake-ring
   vantage, assert the two targets above; a Monaco variant if T3 is taken.

### C — LIFT8 CLOSED PROPERLY
The general sweep found one real blocker in code the roadmap already
called done, and three smaller leaks worth closing in the same pass since
they're all in `systems.js` near the other five features anyway.

1. **BLOCKER — the runaway leak.** `chaosFireRunaway` (`systems.js:44340`)
   spawns a `ball`/`cone` prop through `spawnProp` with no record and no
   despawn; `runaway: true` in all 19 `sysCHAOS_BY` rows and the only live
   kind in the cave, so a long session accumulates one solid body per
   incident forever. Fix by copying the pattern the F4 drops fixup already
   used for exactly this leak class — a `chaosLoose[]` list with a 60–90 s
   despawn.
2. **`chaosReset` doesn't clear its own timers.** `chaosStampedeT` and
   `chaosSquallReleaseT` (`systems.js:44248–44249`) survive a chapter
   switch — leave mid-squall and the new chapter gets a front release it
   never earned (`:44381`); leave mid-stampede and the calm-inversion
   bypass keeps running abroad. Two lines.
3. **Two motion effects skip the game's own calm toggle.** `yuzuFly`
   appends outside `#hud`'s `.capyui` tree (`systems.js:43333`), so
   neither the OS `prefers-reduced-motion` rule nor the in-game
   `.capy-calm` rule reaches its 440 ms transition; `.capyui-yzflash` has
   the OS media query (`:9462`) but no `.capy-calm` counterpart, unlike
   its sibling flash which does (`:10112`). Two small CSS additions.
4. **No stale-save fixture covers any LIFT8 key.** All seven new rows are
   correctly clamped on restore, but `qa/l6r-qa-save.js`'s three fixture
   cases predate LIFT8 and exercise none of them — add a fourth case.

## Order and ownership

Six workstreams, mostly independent files:

- **V** (yuzu visibility) and **T** (Hanoi) touch disjoint regions of
  `systems.js`/`hanoi.js`/`props.js` from everything else — run first,
  in parallel, alongside **C** (the cleanup, same file but different
  functions).
- **H** (HUD) and **M** (minimap) both touch `systems.js`'s CSS strings
  and `mapDraw` — sequence these two, or have one agent take both since
  they overlap in the same ~600-line region.
- **S** (the shop) depends on nothing above but touches `npc.js`,
  `pasto.js` (read-only, for the stall geometry to copy) and
  `sysMAP_WORLDS` in `systems.js` — the same table M touches for the
  shop glyph, so land M's `mapMarkPos`/`mapDraw` changes before S adds
  the `live` branch, not after.
- Every agent: stage by name, never `git add -A`; do not push; do not
  run `playwright-cli close-all` while others may hold a session.

## Rules for every agent
- A visibility fix earns its keep only if it clears **1.0** in whatever
  channel reads it (bloom threshold, additive blend) — a change measured
  only in isolated renders and not against a biome's real grade doesn't
  count as done.
- The paper's tuck is a *timer*, never a second toggle the player has to
  learn — one press (tap the paper / the existing journal key) always
  works both directions.
- A minimap mark that needs a per-biome table row for something already
  published globally (the traveller, the shop) is the wrong shape — resolve
  it through the biome-api pattern (`get`/`live`), not by writing nineteen
  rows.
- `hanLaneAtS` (and its siblings `monTrackAt` etc.) are geometry sources
  for pavements, terraces and props, not just movers — a smoothed
  *heading* function is additive; the position function is not touched.
- Every new physics-spawned entity gets a bound, an owner list, and a
  despawn — no exceptions, that is what this whole item C exists to
  restate.
- Each instrument writes its JSON through `POST /shot?name=` and the
  probe opens with `qa/_boot.js`. `PORT=5188`.

## Held (named, not built)
A thief that actually runs at you (still `false` in every chaos row —
6–10 h, no NPC state exists for it yet); the real-time drops soak and the
`SPEED=0` balance cross-check (both pure wall-clock waiting, no code
change, ~2 h combined); Quay's crowd tangent (`quay.js:4639`) was flagged
as worth the same heading-smoothing check as Hanoi but not measured this
pass; a legend/zoom affordance beyond hover-hold (M6/M7 are the minimum,
not the ceiling) if the shop makes the chart feel crowded once it's
built.

## Closed (19 Sep 2026)
All six items built and measured, three waves, five agents plus one
direct follow-up, `npm test` 22→24, green at every commit. **V** shipped
in two passes — the first pass's aura (0.9/1.3 m) measured 13–22 px
against its own 25 px-at-52 m target under the live camera's actual fov
(not the review's rest-lens estimate); resized to 1.6/2 m and reconfirmed
24–31 px, then eyeballed at 8 m and 25 m in Sydney — a clear, obvious
glowing orb, the Mario-Kart-box read the brief asked for. **T** measured
clean: raw heading still snaps 42.4°/frame at the lake ring's sharpest
vertex (the untouched control, proving the diagnosis), the smoothed path
holds to 1.32°/frame max over a 700-frame run, and the wrap-teleport
dropped from ~45/min to 0/min within 70 m of the camera. **C**'s leak
fix was proven, not asserted — thirteen forced incidents in the cave (the
runaway's only live chapter) took the physics world's body count from
231 to a peak of 249 and back to 235, every watched prop confirmed
`.removed === true`. **H+M** landed together since they share one region
of `systems.js`; verified live across three chapters at both 1280×760
and 390 px wide — the paper visibly shrinks from a 44–54%-height card to
a two-line tab, and the minimap's new frame, glyphs and hold-to-zoom all
render correctly; one real bug (`mapC` read before initialization in the
legend code) was caught in the same pass and fixed before commit. **S**
placed a shared stall in all nineteen chapters via the traveller's own
group, found and fixed one real placement bug (Kyoto's default offset
put the stall over the water — moved along the bridge deck's long axis
instead) and confirmed Pantanal's flood-margin placement clean by
measurement, not assumption; used the roadmap's own "single shared
default" option for the minimap glyph rather than nineteen per-world
rows. Buying was never gated — confirmed still reachable from anywhere
after the stall landed. Nothing here touched Monaco's identical
step-function yaw bug (a named follow-on, not required) or Quay's crowd
tangent.
