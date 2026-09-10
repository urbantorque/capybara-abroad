# Audit F — chapters 15 (Pantanal), 16 (Sơn Đoòng), 17 (Antarctica)

Read-only audit against RUBRIC.md. Every claim cites `file:line`; "unverified" where I could not confirm from code.

**On the "only ONE game.addLocal call" premise:** it is an artefact of style, not a gap. All three files wrap `game.addLocal` in a local `put()` helper and call *that* 6-7 times: pantanal.js:715-727 (7 people), cave.js:2943-2951 (7 people), antarctic.js:3226-3235 (6 people). All three casts use the v20 line apparatus (`before`/`after`/`onTask`/`praise`), two of the three have an `addExchange` pair (cave.js:3313, antarctic.js:3563; none in pantanal.js), and the Pantanal alone rewrites a local's line bag live from chapter state (`panSaysNow`, pantanal.js:3070) and calls the otherwise-dead `game.say` point-bubble (`panCall`, pantanal.js:3078). So the humans in all three are the shared locals rig — T2 — with kit meshes and idle beats, and none of them walks, drives, or touches a world system. ROADMAP-NEXT.md:85/182 and ROADMAP-FUN.md:323/401 still say the Pantanal and Sơn Đoòng "have nobody in them"; that is stale.

---

## Chapter 15 — The Pantanal (`src/pantanal.js`, 4971 lines)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| the capybara herd | 9 (2 pups, `sc` 0.72) | **T4** | graze inside 14 m of a home; wheek recruits nearest → `follow`, walks the player's own 420-sample trail at `2.6·(order+1)` m back, runs to 8.5 m/s to close a gap; looks up, wheeks back rising in pitch per recruit; stride-driven leg pairs; splash/ripple on entering deep water; shake on the far bank; contact-call chatter while following | yes (trail, wheek, look) | 3122-3350; recruit 3351-3420 |
| nelore cattle | 24 (11 penned, 13 loose) | **T4** | step every 6-17 s toward a home; penned ones clamped to `panPEN`; turn to look on a wheek (4.5 s); loose ones turn to watch the herd leader pass; 13 loose are offered to systems.js's herd (`game.herdOffer`, obey 1) so they can be led | yes (wheek, herdOffer) | 4023-4141 |
| jacarés | 14 | **T3** | thermoregulating gape on an 11-26 s clock; slide into the water nose-first when the capy is inside a body length (calm-registry `k:0.3, bold:0`), on a wheek within 26 m (55 %), or when a *following* herd animal comes within 2.7 m; come back up; 8 on the sandbar have colliders and `caiman-nap` opens an eye + hiss | yes | 4142-4221; sit test 4523-4570 |
| giant otters | 5 | T2 | circle on a sine; heads up + telling-off volley (4 calls, then a 6.5-11 s reminder) while the capy is in the zone; re-arm at 26 m | yes (zone) | 3781-3857 |
| jabiru | 1 | **T3** | `nest` (stalking lunge-steps inside 14 m of the tree, bill stab, ripples) / `up` (8.5 s circuit back to its own feet); flushes at `panJabCrit.near` (9 m shrunk by calm, `bold 0.6`) or every 24 s; bill-clatter rationed by distance | yes | 3630-3740 |
| hyacinth macaws | 3 | T2 | sit in the acuri; wheek within 30 m or taking the nut puts them on a 15-20 m banked circuit for 5-7.5 s with rationed shouting | yes | 3741-3780, 4481-4492 |
| cowbird | 1 | **T3** | `ground` (perched on nearest nelore or a dry spot) → `fly` (when capy still within 13 m) → `ride` (patrols the back, pecks with a tick sfx, leaves at 70 s or on swimming); re-perches within 45 m of a cow | yes | 3858-3973, perch 3974-4000 |
| giant anteater | 1 | **T3 carrier** | parametric lap (260 s of walking) that *stops* at the nearest termite mound for 5.5-9 s (nose down, rocking); kinematic body; `carryFrame()` published; ride distance scored | yes (carry) | 3514-3629 |
| egrets | 13 (standing model + flight model) | T2 one-shot | stand on the snags; when the crossing starts they flush one per 0.62 s ahead of the swimmer and leave the map; never come back this visit | yes (crossing) | 4385-4480 |
| floating meadow mats | 11 | T3 (mechanic) | sink 0.16 m/s under load, rise 0.055 m/s; tip toward the capy; creak; six distinct mats in a row = `camalote` | yes | 3421-3512 |
| camalote rafts | 150 (44 aground) | T1 | drift on `panFlowAt`, deflect round the sandbar | no | 4260-4289 |
| dragonflies / fireflies | 90 | T1 | orbit + dart; population swaps with `panDusk` | no | 4333-4383 |
| Victoria flowers | 9 | T1 | open/warm with `panDusk` | no | 4222-4258 |
| ripples | 34 pool | T1 | rings from the capy, the herd, jabiru, caimans, egrets | (caused by) | 4291-4331 |
| locals (boss, cattleman, peão, guide, boatman, road crew, hammock) | 7 | T2 | shared rig; peão and crew have `beat`s (rock / hammer + thud); line bags rewritten on `gather`, `the-otters`, `the-crossing`; 8 caused `game.say` point-lines (crossing, count, plank, ant, mat, macaw, frogs, bird) | yes | placed 727-878; live lines 3070-3088, 4688-4735 |
| fazenda windows + lamp | 1 set | T1 | opacity/intensity follow dusk | no | 4736-4741 |
| ox cart, woodpile, truck tracks | — | T0 | static merged | no | 1328-1338 |

**Summary.** T0: cart/scenery. T1: rafts, bugs, flowers, ripples, windows (5 classes). T2: otters, macaws, egrets, 7 locals (4 classes). T3: caimans, jabiru, cowbird, anteater, mats (5). T4: herd, cattle (2). **Thirteen distinct classes acknowledge the capybara** — the densest reactive chapter I have seen in this game short of Sydney. Most complex behaviour: the herd (trail-follow + answer + gait + wet/dry edges + far-bank shake), and its cross-talk into caimans and cattle (4106, 4172-4180). Note the dusk is *not* reset on re-entry by design (4797-4799) — a second visit is already evening.

### 2. Scene completeness

Arrival screenshot (`qa/B2-15-pantanal.png`): the causeway with tyre strips, grass tufts, three white nelore, the ox cart, fazenda roofs, the bay and lilies top-left, a local's "Look at that." bubble at the road end. Density is fair; the frame is dominated by flat green and the road. It reads as *a* wetland, not yet as the Pantanal (the bird capital of South America has, in this build, one jabiru, three macaws, one cowbird and thirteen egrets that appear once).

Missing things a real Transpantaneira has:
- **A vehicle.** Three separate lines talk about "the truck" that cannot cross the plank (751, 852, 860) and the road has worn tyre bands (1049-1058, 1092) — but no truck, pickup or boat mesh exists (grep for wheel/jeep/pickup/vehicle/boat finds only the cart at 1328 and comments). The boatman at -46,-40 (831) has no boat.
- **Birds in numbers.** No vultures wheeling, no kingfishers, no herons/ibis wading beyond the jabiru; nothing ambient in the air over 200 m of flooded campo.
- **The river bank** has snags, hyacinth and two posts (2754-2818) but no fish rise, no turtles on the snags, no jaguar — the otters' own line ("They will shout at a jaguar", 836) plants an animal the chapter never shows.
- The palette's "an hour before sundown" light is still a 41° afternoon per ROADMAP-BEAUTY.md:50/85; the doc says it was moved to ~30° in "1 the star" (:239) — unverified against `sysSunAt`.

Known-open items: ROADMAP-NEXT.md:339 asks whether the native family should be the one passenger-book exception — still open (herd is deliberately *not* offered, 4036-4038). ROADMAP-CHARACTER.md:978-986 records that "the herd's horns" was misfiled (the herd is capybaras) — closed.

### 3. Marquee / wow

- **Marquee:** `the-crossing` (`wow: 'O PANTANAL'`, shared.js:2898; CHAPTERS marquee at -34,-53, shared.js:3293). Minis: `gather` (THE HERD) and `tamandua` (O TAMANDUÁ).
- **New dynamic:** recruiting your own species with the wheek and having them walk your trail. That part is real simulation (trail ring buffer, gap-closing speed, per-animal wet/dry edges). The crossing *itself* is a state test: in the crossing zone + ≥4 followers → dusk starts, egrets flush, music swells for the width of the water (4600-4616); reaching z < -81 with ≥4 → tick, shake, `frameShot` broadside at 16 m (4661-4662), two locals' bags rewritten, a placed wheek (4620-4690). The only fail path is turning back past z1+4 (4691-4693). The player's own verb during the crossing is swimming, which is chapter 3's verb.
- **What it looks like:** the light turning orange over ~5 s (damp 0.22, 4736), thirteen egrets going up one by one dead-centre ahead of the swimmer, a ragged run of splashes and a broadside hold on the far bank. Camalote rafts give the river motion (rafts 2356/4260). It is a *picture*, and a good one.
- **Rating: 3/5.** Against the ferry helm/condor/dive/bamboo/Hanoi it lacks a verb of its own in the payoff; nothing in the river can go wrong; the followers ignore the flow field entirely (3138-3160: they move straight at the trail point at up to 8.5 m/s in water) so the current the rafts ride has no effect on the one thing the moment is about. The real thrill is the *gather*, and the gather is a mini.
- **Latent big moments:** (a) the herd × jacaré interaction exists (4172-4180) but only as caimans sliding *away*; (b) the loose cattle can be led by the same wheek (4039-4055) — you can bring thirteen nelore *and* nine capybaras to the river and nothing anywhere notices the combination; (c) `panCall` 'count' (4700-4702) coaches the player but the peão and cattleman never *walk to the bank* to watch.

### 4. Recommendations

**NPC / behaviour**
1. **Make the river contest the line (M, high).** In `panUpdateHerd` (3138-3160) apply `panFlowAt` to followers whose `swim` is true, so the line bows downstream; a follower more than ~2× `panFOLLOW_GAP` off its trail point drops to `graze` with a placed wheek, and a wheek from mid-river re-recruits (reuse `panWheek` 3395-3420 with a wider radius while `panCrossT > 0`). The pups (i = 6, 8) should be the ones that lose the line first. This gives the crossing a fail state and a mid-water verb (turn, shout, lead upstream) built entirely from the existing trail + flow + wheek machinery.
2. **One jacaré in the water on the crossing line (M, high).** When `panDuskGo` fires, pick one caiman whose `slide` is up and steer it — same kinematic pattern as the anteater (3540-3552) — to surface 6-8 m downstream of the line with the gape open; the herd's existing "near miss → slide" test (4172-4180) inverts into the herd bunching (drop `panFOLLOW_GAP` to 1.6 for followers within 10 m). The cattleman's "Jacaré in the water and nobody minds. They eat fish. Mostly." (778) then means something.
3. **The truck (S-M, medium).** A single kinematic pickup on the causeway polyline (`panRoadX`, 52) at ~5 m/s that stops at the bad bridge (`panBRIDGES[1]`, 58) and idles — reuse the anteater's route/velocity pattern (3540-3552) and the carrier contract so it is *also* a ride. It is the only machine the chapter's dialogue promises, it is a T1 ambient mover, and stopping it at the gap turns 'missing-plank' into a scene.
4. **Two people walk to the crossing at dusk (S, medium).** On `panDuskGo`, retarget the cattleman and the guide toward `panCROSS` — the locals rig has no walk state, so this needs the smallest possible addition (a target and a lerp on `rec.group.position`, which the Antarctic penguins already do for a pebble raid, antarctic.js:4551-4580). Their rewritten bags (4665-4685) then land at the water instead of 70 m away.

**Wow → 4-5:** recommendation 1 above. New verb: leading a line through moving water and re-gathering it when it breaks.

**Scene**
- A vulture kettle (8-12 instances on a slow rising spiral over the sandbar; cape-petrel code at antarctic.js:4810-4835 is the template) and 4-6 wading herons on the campo edge using the jabiru's step machine.
- A boat pulled up under the boatman (831) and a second, moored, at the last bridge — static merged, ~40 lines.
- A jaguar silhouette that appears once on the far bank at `panDusk > 0.8` for ~12 s and walks off (the egrets' one-shot pattern, 4385): the cheapest possible payoff for the otters' line.

**Bugs / regressions noticed**
- pantanal.js:4106-4109 — the cattle look at `panHerd[0]` as "the leader", but the leader is whichever grazer was nearest at the first wheek (3395-3405); `panHerd[0]` is the leader only by chance, so the "wave of heads" usually never fires.
- pantanal.js:225 `panSeenHerd` is never reset in `onEnter` (4750-4800): the 'the-locals' toast and tick are once per session, unlike the dusk/egret ceremony which replays. Cosmetic.
- pantanal.js:715-720 `standH` is declared and never used (the `put` below it calls `panStandH`). Dead code.

---

## Chapter 16 — Sơn Đoòng (`src/cave.js`, 4574 lines)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| the echo (the wheek as torch) | 1 light + 1 ring | mechanic | PointLight, hard attack, 46 m reach, 2.3 s life, 1.05 s cooldown; three positional returns whose delays are the room's width/height/length, silenced under the hole or at the slot | (is the capy) | 3625-3721, 3723-3752, 3797-3826 |
| swiftlets (roost) | 90 | **T3** | settled on their own cups on the wall; lift on their own 38-66 s clock (partial) or fully on a wheek in the roost zone; echolocation clicks rationed by distance; count scored, tick only if the lift was yours | yes (wheek zone) | 4057-4171 |
| blind fish | 1 | T2 | sine path under the river; a wheek within 40 m bolts it (speed ×8, dives); proximity 4.5 m ticks | yes | 3894-3924 |
| the log | 1 | T1 carrier | 46 s lap down the river; kinematic; grounds at the sump while somebody is on it; `carryFrame()` | yes (holds) | 3828-3892 |
| glow-worms | colony (1 material) | T2 | dim to nothing on a wheek, recover over ~22 s | yes (wheek) | 3926-3937 |
| drips + rings | 26 + 12 | T1 | ballistic streaks, floor rings, ticks rationed by distance; `soaking()` accumulator if you stand under one | yes (soak) | 3939-4014 |
| cave crickets | 40 | T2 | hop-teleport, homed to a crack; scatter (bigger, faster hops) on a wheek | yes | 4016-4055 |
| doline swifts | 16 | T1 | 3.4-turn spiral down the 200 m column to head height | no | 2465-2505 |
| falling leaves | 34 | T1 | tumble down the column | no | 2506-2530 |
| shaft motes / slot motes | 260 / 130 | T1 | drift; motes stirred by a wheek in the doline | yes (stir) | 2807-2851, 1531-1557 |
| phytokarst + spores | 104 blades / 54 | T2 | blades shake and a spore cloud puffs on a wheek in the zone (ticks `phytokarst`) | yes | 2320-2395 |
| head torches | 2 (on locals) | T1 | real PointLight + additive cone that sweeps on its own clock | no | 4340-4355 |
| stove, wall lamp, mist, breath, exit beam | 1 each | T1 | flicker / pulse / breathe | no | 4356-4381 |
| locals (surveyor + cook at camp, rope man, porter, far surveyor, photographer, slot man) | 7 | T2 | shared rig; 3 `beat`s (pot clink, rope coil); kit meshes; one `addExchange` pair; two carry head torches | yes | 3083-3305; exchange 3313 |

**Summary.** T0: formations, camp, tents. T1: log, drips, doline swifts, leaves, motes, lamps (6 classes). T2: fish, worms, crickets, phytokarst, locals (5). T3: swiftlets (1). T4: none. **Nine classes acknowledge the capybara**, but eight of them acknowledge only the *wheek* — the chapter's design, and also its ceiling: nothing here reads position except the fish (4.5 m tick), the drips (soak) and the locals. Most complex: the swiftlet roost (own-clock lift vs. player lift, per-bird home cups, rationed clicks, scored peak).

### 2. Scene completeness

Arrival screenshot (`qa/B2-16-cave.png`): the mouth from above — river with the log on it, breakdown, green bushes, the fixed line, tents' red just visible. Reads as a jungle cave mouth; heavy fog. The interior (not in the arrival frame) has the doline forest, the camp with a stove and washing line (2853-2925), the fixed rope (2926-2939), the Great Wall lamp, and the slot beam.

Missing for a real Sơn Đoòng:
- **Nothing is alive in the Great Passage between the mouth (z 52) and the doline (z -30) except the log and the fish.** Sixty vertical metres of the largest passage on earth with no bats (the chapter's own ROADMAP-FUN.md:465 "first-thing" list names "a bat" and none exists — grep finds no bat), no cave spiders/millipedes on the walls the echo would light, no second party of porters moving.
- **The camp has nobody cooking at the stove, nobody in a tent**; the cook stands 5.4 m from her pot (3119, stove at 2886-2912).
- The doline forest's only movers are the 16 swifts and the leaves; the "weather" the surveyor promises ("There is a cloud in there", 3092) is one rotating mist disc (4358-4362).
- ROADMAP-BEAUTY.md:347 still calls the cave "the flattest frame in the game (spread 63)". Open; the arrival frame agrees (one green and one grey).

### 3. Marquee / wow

- **Marquee:** `the-doline` (`wow: 'SƠN ĐOÒNG'`, shared.js:2930; marquee point 4,-48 up 40, shared.js:3308). Minis: `great-wall` (climbHold, third chapter to publish it), `the-log` (carrier).
- **What it is:** a **stationary trigger**. Walk into `cavInZone('doline')` below terrain+8 → toast, one `frameShot` (yaw 0, 16 m, 3.2 s hold, once per session), task tick, and `music.swell(0.9)` held while you stand there (4296-4320). The camera crane (`skyward`, 4181-4225) and `daylight()` do the ceremony. Nothing is done *by* the player; the room is the payoff. There is no fail/repeat path; the frame shot does not replay (see bugs).
- **What it introduces:** nothing new — the chapter's new verb is the echo (3625), which is taught 100 m earlier and is not the marquee. The wall is a climb (repeat of ch 11), the log a ride (repeat of the anteater/gondola carrier contract).
- **Rating: 2/5** as a wow moment. It is a beautiful room and a stat-check to stand in it. The best *moment* in the chapter is actually `first-echo` in the dark, and second the roost going up.
- **Latent:** (a) the echo returns are a real instrument (delays = room size, 3675-3717) and only dialogue uses it; (b) the 16 doline swifts spiral down to head height (2483-2489) and are pure scenery; (c) `canDive: true` (4468) puts the capy under the river where the fish is, and nothing is down there but the fish; (d) the log grounds at the sump (3843-3846) and the sump is a wall.

### 4. Recommendations

**NPC / behaviour**
1. **Bats — the thing the echo should light (M, high).** A colony of ~120 instanced bats hanging in the roof of the Great Passage (reuse the swiftlet build/settle-on-a-wall code, 3493-3541 and 4100-4128) that *only exist when lit*: they drop and stream past the echo light for its 2.3 s life, in a direction away from the pulse, and re-hang. The one chapter about seeing gets the one animal that is invisible until you shout. T2 → the roost pattern makes it T3 for free.
2. **Position-reactive locals under torches (S, medium).** The two head torches (cavLampCone, 4340-4355) sweep on their own clock; make them *track the capybara* inside `near` (yaw toward `game.capy.position`, same math as the seal's `faceYaw`, antarctic.js:5068). Then walking up to the camp is two beams swinging onto you, which is what a caver does and is the chapter's cheapest reactive light.
3. **The porters move (M, medium).** The porter at the boulder choke (3192) "carried forty kilos over that, twice, today": make him and a second figure walk a fixed line between the camp and the wall on a slow loop (kinematic like the log, 3843-3866), lamps on. Two moving lights 200 m apart in the dark is a signpost and an ambient mover in one.

**Wow → 4-5 (one change, M-L): "come down the column."** Publish a `climbHold` band on the doline's breakdown/rim wood (cavClimbAt already exists, 542) so the player can climb to a ledge 25-30 m up inside the shaft, then step off: the 16 doline swifts form on the falling animal exactly as the Antarctic gentoos form on the bow (antarctic.js:4728-4760 — a station offset lerped by an `esc` factor), the crane (`skyward`) rides at full, the motes stir (`cavMoteStir`), and the landing in the pool under the fall (`cavFallMesh`, 2720) is the tick. New verb: a *drop through light* with company — the chapter's one vertical, using the climb the mini already teaches and the air control it already publishes (`airControl: 0.46`, 4466). Retain the current stand-in-the-light tick as the act-2 entry; make the drop the wow.

**Scene**
- 8-10 bats/rock-swallows dropping through the doline column on the swift spiral (2465) at random phases, so the shaft has scale at every moment.
- A person *at* the stove (move the cook to 2886-2912's `sx, sz` + 0.9) and a sleeping-bag figure inside one tent (a box in cavTent, seen through the flap) — the camp reads as slept-in.
- Rimstone pools that reflect the echo (the `cavRing` material at an emissive tied to `echo()`) along the Great Passage floor — one shader term, and the light has something to land on.

**Bugs / regressions noticed**
- cave.js:227 `cavSeenLight` is not reset in `onEnter` (4390-4413), so the doline's `frameShot`, toast and the `seenLight()` API are once per *session*; Antarctica deliberately resets its show per visit (antarctic.js:5665-5668) and the Pantanal resets its egrets. Inconsistent.
- cave.js:4297 the doline test `p.y < cavTerrain + 8` excludes a player on the breakdown blocks; fine today, but it will fight recommendation "come down the column" if kept.

---

## Chapter 17 — Antarctica (`src/antarctic.js`, 5789 lines)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| the tender (orange boat) | 1 | **T3 vehicle (player-driven)** | displacement hull: throttle → target speed, rudder authority bought with way, neutral detent, top speed `12.6·(1-0.70·ice)` from the pack density field, +3.1 m/s in the pod's wake; analytic collision vs shore/bergs/floes; horn with two gate echoes; bow spray; wake; crunch sfx and shake in brash; passenger parked at the helm | (is driven) | 3685-3893; helm 3644-3683 |
| orca pod | 6 | **T4** | `patrol` (172 s loop of the deep channel, blows) → `coming` (wheek from the helm within 185 m, 15.5 m/s) → `escort` (form on the quarters, spread 1.0, porpoise at 2.2 s, spray) / spy-hop when you stop <2 m/s for 1.6 s / breach once at 62 % of the ride; leave after 64 s or north of z -40; every animal steered to deep water round floes (`antToDeep`) | yes (helm wheek, speed) | 4140-4406; summon 4118-4138 |
| sea-ice floes | 15 | T3 carrier | kinematic pans on the drift (`antDriftAt`), eddy behind the berg, recycle to the top of the bay when empty and clear of the jetty; ground for the capy; block the boat | yes (carry) | 3933-4081 |
| gentoo colony | 174 (132 on nests, 42 highway) | **T4** | nest birds turn to look inside 20 m (×1.6 when calm); ecstatic display on a baseline rate and as a *travelling wave* from a wheek (13.5 m/s front, 17 m tail, 78 m reach); one in eight walks a pebble raid to a neighbour's nest; highway birds walk/toboggan the polyline; 42 offered to the herd (obey 1, `span 2`, perch on the back, stowaway); wing burst + a continuous colony sound bed | yes | 4408-4710; offer 4452-4497 |
| swimming gentoos | 18 | T2 | porpoise a line out of the bay; form on the bow quarters for 11-18 s when the tender passes >4.5 m/s within 110 m | yes (boat) | 4712-4772 |
| leopard seal | 1 | **T3** | `hauled` (rides her floe) → `watching` (notice 24 m, ×1.5 when calm) → `in` (station abeam of boat or swimmer, min standoff 5.6 m, trapezoid surfacing, breath each cycle; tick on first surfacing) → `leaving` (nearest pan becomes hers); gape/head follow the look | yes | 4895-5100; wheek look 5577-5580 |
| Weddell seal | 1 | T1 | breathes, rolls, lifts head every 23 s | no | 5105-5118 |
| skua | 1 | T2 | 26 s figure over the colony, one stoop, one cry per dive; breaks off on a wheek within 40 m | yes (wheek) | 4838-4868 |
| snow petrels | 26 | T2 | ring over the calving face; scatter on calving and on a wheek | yes (wheek) | 4780-4805 |
| cape petrels | 54 | T2 | two flocks on the bastions; flick-beat; scatter on the horn in the gate | yes (horn) | 4810-4835 |
| calving | 24 blocks | T1 | every 38-62 s: crack, delayed rumble, ice cloud, a wave that lifts the boat | (wave reaches boat) | 5122-5215, wave 5303-5320 |
| spindrift / spray / wake | 120 / 56 / 30 | T1 | ambient | no | 5217-5249, 5251-5300, 3895-3931 |
| katabatic wind | — | T1 audio | positional bed by exposure; floe grind when standing on one | (by position) | 5331-5358 |
| the mug | 1 prop | T3 (physics prop) | spawned on the counter; a grab ticks `station-mug` | yes | 5492-5496, 5596-5604 |
| locals (base commander, boatman, penguin counter, archaeologist, glaciologist, barman) | 6 | T2 | shared rig with kits; 2 `beat`s (stake rock, bar clink); one `addExchange` pair (bar ↔ boss); chapter-specific startled/splash/thief/rush pools; no `game.say` point lines, no live rewriting | yes | 3323-3576 |
| lit windows | 6 lights | T0 | built once; `antWinLight` is pushed (1419) and never read in any update | no | none |
| flag line, windsock, Zodiac, drums, bones | — | T0 | static merged | no | none |

**Summary.** T0: windows, station, whalers, bones (4). T1: Weddell, calving, drift, spray, wake, wind (6). T2: swimming gentoos, skua, petrels ×2, locals (5). T3: tender, floes, seal, mug (4). T4: pod, colony (2). **Twelve classes acknowledge the capybara** (six of them via the wheek/horn). Most complex: the pod (five states, formation, speed coupling, once-only breach) with the colony wave a close second. This is the richest of the three, and the humans are the weakest part of it: six people on a base and none of them boards the tender, walks to the colony, or reacts to the boat leaving beyond a line bag.

### 2. Scene completeness

Arrival (`qa/B2-17-antarctic.png`): jetty, orange tender, red-roofed huts, drums, signpost, a person on the jetty, floes and brash, the bastions in the haze. `qa/B2-ant-colony.png.png`: dense nests with pebble rings, chicks, guano stain — good. `qa/B2-ant-pack.png.png`: dark lead between white pack, floes, the berg and the shelf — the navigation-by-picture works. The chapter is scene-complete for a *base*; what is thin is that nothing man-made moves: no generator hum, no resupply ship offshore, the Zodiac is upside down (1580), the windsock (1729) and flag line (1672) are static in a chapter whose subtitle is the wind.

Known-open: ROADMAP-BEAUTY.md:52/83 (sun at 61° "lit like the equator") — the same doc's :239 says it was moved to 28°; unverified against `sysSunAt`. ROADMAP-NEXT.md:217 (42 gentoos at the origin) — closed at 4430-4451.

### 3. Marquee / wow

- **Marquee:** `orca-ride` (`wow: 'THE PENINSULA'`, shared.js:2966; marquee 14.3,-169.5, shared.js:3318). Minis: `penguin-highway`, `floe-drift`.
- **New dynamic:** a top speed that is a function of *where you are* (pack density, 3773-3776), a pod you summon by voice from the helm (5549), and a formation you must hold at speed (>5.5 m/s at the helm for 9 s, 4185-4190) for a wake bonus (`antWAKE_GAIN`, 3776). Real simulation for the boat and the density field; the pod's escort is a damp onto the boat (4181-4182) so the formation cannot be *lost* except by slowing, and it cannot fail except on the 64 s clock or north of z -40 (4265-4269). Payoff: ~9 s hold → breach at 62 % (once per visit, 4230-4245, splash + spray + shake + `music.swell(1.0)`), `frameShot` astern with a 6.5 m raise (4223-4225), toast, record. Stop the boat and the bull spy-hops beside you (4252-4262, 4326-4345). Reached by: take the tiller (E at the transom, 3708-3718), drive ~200 m north into the pod's patrol range (loop centred z -300, 4151-4153), wheek. Sound: placed splashes, hiss blows, crunch, horn echoes in the gate.
- **Rating: 4/5.** It is the ferry helm with a reason to go fast and a thing that answers you; the pack density and lead make the drive a navigation problem; the breach is a real one-shot picture. It loses a point because the escort is glued to the boat (you hold a speed, not a line) and because a wheek out of range fails silently (`antPodSummon` returns false with no feedback, 4118-4124) — from the berth the first Q does nothing and the player is not told the pod is 350 m away.
- **Latent:** the gate (5410-5417) is a one-toast moment with the game's best echo instrument and no task; the arch (5432-5443) is a threading test the boat is 3.8 m wide against 14 m; the calving wave lifts the boat (5303-5320) and nothing scores riding it; the gentoos ride the bow (4712) and the pod never meets them.

### 4. Recommendations

**NPC / behaviour**
1. **The boatman comes with you (M, high).** The jetty local (3363) has ten lines about the tender and never boards it. Attach him to the boat when the helm is taken (`rec.group` parented to `antBoatGroup` at the bow, same as the kit meshes are parented at 3243-3283) and give him the `game.say`-at-a-point channel the Pantanal already uses (pantanal.js:3078) for *live* calls: "dark water — left", "that is the lead", "hold your speed" when `withPod() > 0.5`, "stop her" when the pod is abeam and `sp > 2`. It converts the silent summon failure into a person saying "they are past the gate, you will have to go to them." T2 → T3 with no new rig.
2. **The pod leads (M, high; this is also the wow fix).** Add a `run` state after `escort` forms: the pod centre follows the lead polyline (`antLeadX`, 626) north at ~11 m/s instead of damping onto the boat (4181-4182); `antWAKE_GAIN` and the ride clock only accrue inside `antPOD_HOLD` (4112-4116 already computes it). The player now has to *steer the lead and keep up in the pack* to stay in the wake; falling out of the hold for >6 s drops them back to `patrol` with the existing "they have gone on" toast. New verb: a chase through moving ice.
3. **Colony ↔ skua ↔ capybara (S, medium).** The skua's stoop (4848-4852) lands on a nest and "gets shouted at" only in the comment. Trigger a local display wave from the stoop point (reuse `antCallX/Z/R`, 5558-5563) each dive, so the colony reacts to something other than you — the first T4 interaction here that is not player-caused, which is what the ambient-mover rules ask for.
4. **The penguin counter walks his transect (S, low-medium).** Same walk primitive as the Pantanal recommendation 4; he crosses the colony edge on a 40 s loop and the birds nearest him do the look (the code at 4590-4596 already keys on a point; make that point his position when nearer than the capy).

**Wow → 5:** recommendation 2.

**Scene**
- Make the flag line, windsock and boat flag *move* with the katabatic (`antUpdateWind` already computes exposure `k`, 5343-5347): the windsock as a cone whose pitch follows `k`, the flag scraps as `antFlagMesh` at 3852-3856 do. Static flags in the wind chapter are the one thing the eye catches.
- A ship on the horizon north of the gate (one merged hull at z ≈ -480, T1 drifting 0.3 m/s) — scale for the shelf and a reason the station exists.
- The lit windows (1405-1420) flicker/dim on a person's beat and go warm at the exchange (3563): tie `antWinLight[i].intensity` to the barman's `beat` so the one warm building breathes.

**Bugs / regressions noticed**
- **antarctic.js:463-467 `antSay(s)` calls `g.say(s)` with a single string, but `game.say` is `npcs.say = sayAt(x, y, z, text)` (main.js:1889, npc.js:2508). The string lands in `x`, `text` is `undefined`, `sayAt` returns at its `if (!text)` guard, and the `antToast` fallback is skipped because `typeof g.say === 'function'` is true. Net effect: the tiller control line 'W/S throttle · A/D tiller · Q to call · E to step off' (3663) is never shown to the player in the one chapter whose subtitle is "you are not walking anywhere".** The same call shape exists at quay.js:4869 (out of my scope, flagged for whoever has chapter 3). (The "See palSay" comment at 457 refers to a function that does not exist in src; grep finds only the comment.)
- antarctic.js:4118-4124 `antPodSummon` fails silently when the pod is >185 m away; no toast, no line. Design gap, not a crash.
- antarctic.js:1419-1420 `antWinLight`/`antWinPane` are collected and never read. Dead state (harmless).
- antarctic.js:4265 the escort ends when `antBoatZ > -40`; the marquee point in CHAPTERS is z -169.5 (shared.js:3318), fine, but the hint arrow `pod()` (5740) points at the patrol centre which is inside `antToDeep` — verified consistent.

---

## Cross-chapter notes for the roadmap

- All three chapters are **wheek-reactive first, position-reactive second**. That is right for the cave and wrong for a Pantanal whose thesis is "nothing here is startled by you" — which the code then contradicts with 14 sliding caimans, 3 flying macaws and a flushing jabiru. Worth a design decision: either the campo genuinely ignores you (and the *herd* is the only thing that answers), or the opening comment (pantanal.js:14-17) is rewritten.
- The Antarctic locals' `startled/splash/thief/rush` pools (3300-3320) and the cave's (3055-3078) are the best-written in the three; the Pantanal has none of the four (its people use the chapter-neutral defaults for every barge and splash). S effort to add.
- Two of the three marquees are already framed (`frameShot` at pantanal.js:4661, antarctic.js:4223, cave.js:4313); the cave's does not replay and the Pantanal's is the only one that is also a *mechanic*. Ranking by wow as built: Antarctica 4, Pantanal 3, Sơn Đoòng 2.
