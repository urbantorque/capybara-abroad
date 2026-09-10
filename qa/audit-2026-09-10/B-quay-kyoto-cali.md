# Audit B — chapters 3 (Circular Quay), 4 (Kyoto & Uji), 5 (Cali)

Read-only pass, 10 Sep 2026. All line numbers are from the working tree at commit 1e207ac. Screenshots looked at: `qa/B2-03-quay.png`, `qa/B2-04-kyoto.png`, `qa/B2-05-cali.png`.

How the marquee "lift" works for all three (so it is not repeated below): a task row with `wow:` gets the sparkle glyph on the paper (`src/systems.js:19071-19078`), and on completion systems.js runs the same channel for every chapter — `musSwell(1)`, a forced `cheer`, 24 confetti, the place-card banner with the `wow` caption, a `punch(0.14, sysFREEZE_WOW)` freeze and `slowmo` (`src/systems.js:25841-25866`). `mini` rows get half of that plus the 2.6 s moment card (`src/systems.js:3251`). So the lift is uniform; the quality of each chapter's wow is entirely what the chapter itself stages before and after that frame.

Locals rig (shared, `src/npc.js:2323` `addLocal`): a fixed figure that turns to watch inside `near` (widened by wariness, `npc.js:5121-5123`), speaks a bagged line on approach, a different one on wheek, `before:/after:/when:` conditional lines, `onTask` reactions, a `beat` (work/rock/reach with a tool), flinch spring on `prop:impact`, photographs a loafing capybara (`npc.js:5185-5210`), exchanges between two locals (`npc.js:4748`). That is T2 everywhere it is used; I mark a local T3 only where chapter code drives it as an actor.

---

## Chapter 3 — Circular Quay (`src/quay.js`)

Note: this biome is the ferry voyage Quay → Manly. The Circular Quay band in Sydney (chapter 1: dog, busker, `physQUAY` props) is a different world and is not in this inventory — see memory note capy3-quay-is-two-places. `createQuay` merges over npc.js's earlier `game.quay` record rather than replacing it (`quay.js:6129-6131`).

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| MV Wheek (player's ferry) | 1 | T3 | kinematic hull integrated from throttle/rudder; rudder authority bought with way (`4967-4970`); astern; analytic collision push-out that slides round headlands, fingers, Manly wharf, sand, the Freshwater (`5094-5213`); heel/trim/swell; wheel spins, ensign streams (`5020-5026`); engine beat follows throttle (`2117-2149`); bow spray + whistle steam (`2920-2970`); wake ring buffer | player drives it (E at wheel, `4894-4903`) | `quayStepBoat` `quay.js:4888` |
| The Freshwater (Manly ferry) | 1 | T4 | A↔B route with 11 s dwell (`3603-3610`), solid kinematic box, velocity differenced against target (`3625`), Doppler `sfxMover('diesel')` (`3640-3651`); answers your horn inside 82 m after 1.5 s (`3593-3598`, `3654-3683`), 14 pax wave, funnel puff, wash arrives 10.5 s later and ROLLS + SURGES the player's boat (`5005`, `4980-4993`); pays `ferry-salute` | horn only | `quayUpdateBigFerry` `3600` |
| Freshwater passengers | 14 | T2 | instanced on her promenade rail in her frame; lean; arms go up while `quayBigWave` > 0 | via her answer | `quayUpdatePax` `4692` |
| Regatta fleet | 6 | T1 | ping-pong along six legs, heel and bob; counted close-aboard (<19 m) for `yacht-race` (`5354-5391`) | no (the task counts them) | `quayUpdateFleet` `3749` |
| Moored yachts | 33 | T1 | sheer 3° about the mooring, ride the swell; each has a hull box and a hard circle | no | `quayUpdateMoorings` `2714` |
| Berthed ferries | 2 | T1 | bob at the outer fingers | no | `quayUpdateBerthed` `4404` |
| Fairway buoys | 11 | T1 (+strike) | ride and lean with the surface gradient; dunk-and-bounce when the hull hits one, clink/splash/spray/toast (`3834-3880`) | boat only | `quayUpdateBuoys` `3882` |
| Buoy gulls | 22 | T2 | perch 36 % / circle; leave a struck buoy; ALL relocate to the chip shop on `manly-pine` (`4788-4796`); never re-perch after the chips | via buoy strike, via chips | `quayUpdateGulls` `3947` |
| Wake gulls | 9 | T2 | station-keep in the boat's frame astern when under way, loiter when stopped, scatter on the horn (`4053`) | horn, speed | `quayUpdateWakeGulls` `4059` |
| Apron gulls | 11 | T2 | stand on bollards/bench backs; lift inside 3.5 m (registry-shrunk by the calm, `addCritter` bold 0.9 `4273`) or all at once on a wheek (`4941`); land on somebody else's bollard | yes | `quayUpdateApronGulls` `4261` |
| Bridge gulls | 26 | T2 | sit on the lower chord; flush + spiral for 7 s on the horn under the arch (`5282-5292`) | horn | `quayUpdateBridgeGulls` `5246` |
| Cockatoos | 18 | T2 | flock off a headland when the boat passes < 40 m at > 4 m/s or a wheek inside 60 m; fan, turn over the water, back into the wood; screech rationed (`1954-2066`) | boat, wheek | `quayUpdateCockatoos` `1986` |
| Dolphins | 5 | T2 | porpoise off the bow while at the helm > 6.5 m/s; splash on re-entry; escort timer/record (`5399-5417`) | speed | `quayUpdateDolphins` `4145` |
| Concourse crowd | 30 | T1/T2 | 12 routes, dwell 2-11 s at the ends; STOPPED ones turn to look inside 12 m (`4600-4608`); legs alternate; solid via `addCrowdBodies` (`4516-4518`) | stopped ones look | `quayUpdateCrowd` `4554` |
| Bridge cars | 38 | T1 | 4 lanes wrapping the deck | no | `quayUpdateTraffic` `3088` |
| Bridge train | 1 (3 cars) | T1 | runs the deck, waits 14-26 s offstage | no | `3117-3127` |
| Cat's-paws (wind on water) | 110 | T1 | drift downwind, gust envelope | no | `quayUpdateCats` `2853` |
| Heaving line | 1 | scripted | thrown to the Manly bollard on arrival (`5491`) | — | `quayUpdateLine` `2987` |
| Chip basket + 14 chips | 1 | T2 trigger | burst inside 2.1 m, gull flock arrives, `manly-pine` | yes | `quayUpdateChips` `4803` |
| Locals (addLocal) | 10 + 1 traveller | T2 (2 are T3-ish) | deckhand `quayHand` (`5579`) shouts "ASTERN!" when you drive at the wall (`5140-5146`) and after you cast off (`5314-5317`); Manly wharf hand `quayLand` (`5703`) talks you in by range with a whistle and catches the line (`5423-5442`, `5493-5496`); chip-shop keeper (`5612`), commuter on the finger (`5628`), gateman (`5638`), fisherman with a rod beat (`5647`), busker with a strum beat (`5666`), photographer (`5679`), man on the Opera podium (`5690`), lifeguard (`5715`); the recurring traveller P6 (`5601`) | yes (all) | `localsStep` `npc.js:4979` |

Counts: T0 animate-looking things: none (everything that looks alive moves). T1: 8 classes (fleet, moorings, berthed, buoys, cars, train, cat's-paws, line). T2: 10 classes (buoy gulls, wake gulls, apron gulls, bridge gulls, cockatoos, dolphins, pax, chips, crowd-when-stopped, 11 locals). T3: MV Wheek. T4: the Freshwater.
Things that acknowledge the capybara/its boat in some way: 11 locals + apron gulls + cockatoos + crowd + wake gulls + bridge gulls + dolphins + Freshwater/pax + buoy gulls (via strike/chips) = ~19 distinct things. The most complex behaviour is the Freshwater salute chain (hail → 1.5 s answer horn placed at her funnel → 14 arms up → funnel puff → 10.5 s later wash rolls and surges the player's hull → toast), followed by the hull's own collision/slide model.

### 2. Scene completeness

The arrival frame (B2-03) reads busy and right: 30 walkers, benches, cones, a fig, palms, the finger sheds, buoys, the Freshwater's cream hull and the CBD behind. Set dressing is the densest of the three (apron dress `2371-2478`: 13 palms, 9 benches, bins, timetable pylons, chain line, awnings; Opera House shells `981`; 26-tower CBD `1125`; bridge with traffic; 13 headlands with bush thinned by distance to the rhumb line `2257`; Manly wharf furniture, gabled shed with clock, 14 Corso shops with fronts AND backs, chip shop, lifeguard tower, flags, surf club, surfboat `1490-1687`; Norfolk pines `1772+`). Props: two spawn rings (`props.js:2513-2519`).

What a real version has that this does not:
- Nobody boards or leaves a boat. The 12 crowd routes (`4434-4447`) all end at z = 6, the finger bases; MV Wheek sails EMPTY and the berthed ferries have nobody on them. The chapter's deckhand says "all ashore" to a boat with no one aboard.
- Manly beach has no bathers, surfers or towels between the flags; the Corso has three fixed locals and nothing walking. The 90 s the voyage ends in are spent among 14 shopfronts with no people.
- Only one vessel is UNDER WAY apart from you (the Freshwater). No water taxi, RiverCat, kayak or tinny on 700 m of the busiest harbour in the country; the regatta is six boats on fixed legs.
- The Bridge has cars and a train but no walkers/climbers; fine at this distance.
- Sound: the terminal bed (`2161-2163`), cicadas (`2179`), wake-gull cries (`4115`) and cockatoo cries (`2062`) are volume-rationed but NOT positional (no `at:`), despite the module note claiming "positional, the sahara rule". Minor.

Weather: `quay` row is a midday lock, spray motes, no shower (`src/weather.js:196-204`). ROADMAP-BEAUTY notes the pale apron was 58 % one value → 53 % after the bays (`ROADMAP-BEAUTY.md:302,314`); the screenshot still shows a large flat pale-paving field.

Open items checked:
- ROADMAP-FUN B1 table (`ROADMAP-FUN.md:799`): "3 Quay — first tick: never (90 s random walk)". Still structurally true: `to-quay` only ticks in `quayCheckVoyage` with the helm held and 26 m off the apron (`5307-5325`), and `take-helm` needs E at the wheel (`4894-4903`). Both first rows hang on one verb a random walk cannot do; a player can, in ~20 s. Not a defect, but the chapter's first two rows are the same action twice.
- REVIEW-2026-08-31 `quayFerry`/`quayReadFerry` plumbing (`REVIEW-2026-08-31.md:550,583`) is Sydney/npc.js — not verified here.
- Memory note capy3-chapters-three-four-five's findings (hull collision, headland colliders, one-shot chips re-arm, ambience rung) all verified present: `5094-5213`, `1705-1761`, `5938-5951`, `systems.js:35912-35933`.

### 3. Marquee

`manly-voyage` — `wow: 'THE HARBOUR'` (`src/shared.js:2524`); CHAPTERS marquee point is the berth, "she is at the wharf, and Manly is an hour north" (`shared.js:3160`). Mini: `ferry-salute` (`shared.js:2528`).

- New verb: DRIVING. Throttle on the stick z, wheel on x, read raw not camera-relative (`4909-4912`); a real if simple boat model (speed chases a target with asymmetric accel `4955-4965`, rudder authority ∝ speed, astern with reversed rudder, drag coast-down). Real simulation, not rails: the player owns heading and speed for the whole 700 m; collisions are analytic and sliding (`5099-5115`). The animal is parked at the wheel (`5032-5047`) and capybara.js stops solving.
- Payoff length: a berth-to-Manly passage is ~64-71 s (`5470-5471`; record par 66 s `shared.js:3731`). Along it, five sub-events are staged on the same route: the Opera House line as you clear the berth (`5333-5340`), the arch echo + 26 gulls on the horn under the Bridge (`4928-4935`), threading the regatta with a running tally on the paper (`5354-5391`), the dolphin escort above 6.5 m/s with its own clock (`5399-5417`), and the Freshwater salute. Then the Manly approach: the wharf hand calls you in by range with a whistle (`5423-5442`), and arrival = `frameShot` astern and low up the boat's own line (`5465-5468`), horn + chime from the hull, heaving line, a person catching it.
- Camera/scale/sound: engine beat at the funnel (`2132-2148`), Doppler on the other ferry, bloom keyed to the wake (`systems.js:28898-28899`), music palette switches while sailing (`systems.js:35446`), the deck rig is treated as a floor (`4853-4860`).
- Reached: 19 m from spawn per the screenshot; find the wheel, press E. Fail path: aground/rock/wharf bumps with toasts and speed loss (`5080-5091`); nothing is failed, everything re-arms on re-entry (`5922-5971`).
- Rating: **5/5** — this is the reference the rubric names, and it earns it: a new verb, real physics, five staged beats on one line, a person at each end who knows what you did.
- Latent/underexploited: (a) the empty deck — you drive a ferry with no passengers; (b) the Freshwater's wash is a rolling swell for the player boat but nothing for a swimmer; (c) `let-her-sit` find (`shared.js:3542`) rewards stopping mid-harbour — good; (d) the concourse crowd never boards anything.

### 4. Recommendations

The chapter is already the strongest of the three; keep the list short.

NPC/behaviour:
1. **Passengers on MV Wheek** (S/M, high). Reuse `quayBuildPax`/`quayUpdatePax` (`4648-4723`: instanced body/head/arm drawn in a hull's frame) for 6 commuters who appear in the house when the helm is taken, lean with `heel` (`5005`), and walk off down the Manly finger on arrival using a crowd route (`quayCROWD_ROUTE` shape, `4434`). The wharf hand's "all ashore" then has a subject; the traveller (P6) is the obvious first passenger.
2. **Boarding flow on the concourse** (S). Add two routes down the middle finger to the berth and let the dwell at z = 6 be a queue at the gate; same walker system, no new draws.
3. **Manly life** (M). Six walkers on the Corso and sand (the same 4-draw walker rig), and a pair of bathers between the flags using the Kyoto cormorant dive shape (`kyoto.js:3191-3198`) so the flags mean something; give the lifeguard local a `beat: {kind:'rock'}` scan.

Wow: no change needed. If one thing: let a swimming capybara feel the Freshwater's wash (a `capy.launch` lift from `quayWashHeel`'s envelope when within ~12 m of her track) so the salute pays out in the water too.

Scene: (1) one more class under way on the fairway — a small water taxi on the Freshwater's A/B pattern (`3600-3633`) at 12 m/s with a 3-second horn exchange, no task; (2) towels/umbrellas/bathers at Manly; (3) a few boats alongside the berthed ferries' fingers loading (crates via the crowd `work` beat).

Bugs/regressions noticed: none blocking. `quay.js:2161-2163, 2179, 4115, 2062` non-positional sfx (see above).

---

## Chapter 4 — Kyoto & Uji (`src/kyoto.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Grey heron | 1 | T4 | 4-phase machine (stand / climb / 11 s arc / descend) between two shallows; flushes at 9 m (registry-shrunk by the calm `1351-1354`), on its own 26 s rest clock, or on the bell strike (`1609`); holds while a dry crossing is live and flushes on the splash (`1417-1424`); WADES TOWARD a loafing capybara and stops 3.2 m short (`1324-1345`); herd offer obey 3, span 2 seats, perches on the animal's back and can be stowed across a border (`1367-1412`); wingburst audio | yes, richly | `kyoUpdateHeron` `1285` |
| Cormorants | 6 | T2 | on the gunwales of 3 pairs of moored ukai boats; stand / dry wings 11 s in 34 / DIVE when the capybara is within 8 m in the river, surface 2.4 s later | yes (in-river) | `kyoUpdateBirds` `3184` |
| Koi | 7 | T1 (+bell) | orbit the pond; go deep and fast for ~16 s after the bell | no (world event) | `kyoUpdateKoi` `2649` |
| Tea pickers | 22 | T1 (+bell) | bent on nine terraces; straighten ~every 8 s; ALL stand and face the shoro after the bell (`2148-2156`) | no | `kyoUpdatePickers` `2131` |
| Gion paper lanterns | 40 | T1 (+bell) | swing out of phase; 5× and in phase for 2 s after the bell | no | `kyoUpdateLanternRow` `857` |
| Petals | 90 | T1 (+bell) | fall, recycled round the camera; gusted by the bell | no | `kyoUpdatePetals` `2593` |
| Bamboo grove | 260 culms | T1 (+bell) | sway at 20 Hz; shiver on the bell | no | `kyoUpdateBamboo` `2678` |
| Tea barrels | 14 | T1 | advected by the flow field, pushed off rocks, recycle at the mill | no | `kyoUpdateBarrels` `3262` |
| Foam streaks | 120 | T1 | advected by the flow field; length = speed | no | `kyoUpdateFoam` `3339` |
| Mill wheel | 1 | T1 | turns | no | `3619-3622` |
| The bonshō (bell + shumoku + rope) | 1 | T3 machine | E at the rope (2.6 m): 4.5 s wind with a rising knock per second, beam draws back and strikes, 9 s ring with the shell deforming; refuses with a spoken reason while busy; `the-bell` if you are under the rim; radiates `kyoBellWave` (16 s) and `kyoBellPulse` (2 s) to koi, lanterns, petals, bamboo, pickers, heron | yes | `kyoUpdateBell` `1522` |
| Stone lanterns | 9 | T2 | topple when barged > 3.4 m/s inside 1.55 m; fall away from you with overshoot; collider reshapes; emit `prop:impact` so locals flinch; 9 escalating lines (`923-933`) | yes | `kyoUpdateLanterns` `940` |
| Giant whisk | 1 | T2 | spun by the tangential component of your run round the bowl; froth grows; `whisk-spin` | yes | `kyoUpdateWhisk` `1926` |
| Matcha heap | 1 | T2 trigger | vanishes into a cloud on contact; `matcha-raid` | yes | `kyoCheckMatcha` `4070` |
| Paw prints (zen gravel) | 26 (ring) | T2 fx | one per 0.9 m of travel; `zen-ruin` at 12 | yes | `kyoCheckZen` `3841` |
| Pond mirror smears | 11 anchors | T1 | camera-facing reflections | no | `kyoUpdateMirror` `2408` |
| Locals (addLocal) | 13 | T2 | rake monk `kyoLocRake` (`4582`), tea master (`4609`, with a `when: wet` line), miller (`4626`, a `when: inRiver()` line), Gion late man (`4649`), sweeper with broom beat (`4662`), man on the bridge (`4683`), bamboo cutter (`4694`), summit shrine keeper (`4720`), bell keeper (`4734`, `when: bellRinging()`), tea seller (`4752`), rival across the street (`4770`), one picker with a reach beat (`4786`), ukai master on the bank (`4807`); two exchanges (`4829`, `4839`) | yes | `npc.js:4979` |

No vehicles of any kind. No walkers. The train the first row is named after ("Get off the train at Kyoto", `shared.js:2536`) does not exist — `to-kyoto` is an `arrive:` auto-tick (`shared.js:3168`).

Counts: T0 animate-looking: none. T1: 9 classes (koi, pickers, lantern row, petals, bamboo, barrels, foam, wheel, mirror). T2: cormorants, stone lanterns, whisk, heap, prints, 13 locals. T3: the bell. T4: the heron.
Things that acknowledge the capybara: heron, 6 cormorants, 9 lanterns, whisk, heap, 13 locals = ~17 distinct things, but only TWO animate bodies in the whole chapter ever react to the animal's position (the heron and the cormorants); everything else is a fixed person or a static prop. The most complex behaviour is the heron, and after it the bell's fan-out across five systems.

### 2. Scene completeness

Arrival frame (B2-04): the Gion lane, looking east — 18 pitched machiya, noren, two lantern strings, granite setts, gutters, overcast "Sakura Sunshower" (`weather.js:209-218`), two locals visible, petals. It is a good composition and an empty street: nothing on the lane moves, walks or rolls. This is the chapter's stated first view and it contains zero moving bodies apart from petals and a lantern swing.

Density elsewhere is high: 360 sugi on Inari-yama with the corridor cut out (`2195`), 42 maples, the sando between lane and pond (`2476`), pond edge, 6 stepping stones with a rising six-note scale (`4035-4046`), the pavilion + gold-baked reflection (`4474-4486`), 9 lanterns, 15-stone garden, the bell tower, the humped Uji bridge with ramps and a solid balustrade (`1646-1747`), 12 tea shops on paving with furniture (`1982`), 9 terraces with 22 pickers, mill, 3 boat pairs, foam/barrels. Props: two rings (`props.js:2521-2525`).

Missing for a real version:
- Any traffic in Gion: rickshaws, bicycles, tourists, a maiko pair. Hanamikoji at 4 pm is the most walked lane in Japan; here it is two fixed men.
- Nothing works the cormorant boats: the ukai master stands on the bank (`4807`) and the boats are static merged geometry with mooring poles (`3100-3142`); the birds are the only life on the river.
- The pond has a heron and seven koi — no ducks, no turtles on the stones, no second bird for a herd tutorial.
- Uji: 12 shops, two shopkeepers, 22 pickers — nobody buys tea, nobody crosses the bridge.
- The summit shrine: unverified whether fox statues / ema boards exist (`kyoBuildTorii` not read).
- The lanterns of Gion are not emissive (`kyoGionGlobes` is a plain instance, `846`) although the sweeper says "the lanterns go up at four" (`4668`) and the chapter is locked overcast.

Open items checked:
- ROADMAP-FUN B1 (`ROADMAP-FUN.md:800`): "4 Kyoto — first tick never, marquee never seen (0 %)". Verified: the CHAPTERS marquee is the river at (4,128) (`shared.js:3171`), spawn is (−16,52) looking east down the lane (`kyoto.js:53`), so the river is 76 m behind the camera. It is audible from there (`sfxMover('river')` far 120, `3491-3500`) and the arrow points along it (`aheadOnRiver` `4355`), but it is not in the arrival picture. B6's reorder put the 19 m lantern first (`shared.js:2539-2549`) — verified.
- REVIEW-2026-08-31 item 4 (`REVIEW-2026-08-31.md:303`, missing `userData.noShadow`): CLOSED — ground `378-384`, tracks `722-723`, picker heads `2086-2087`, wings `3164-3165`.
- Memory note capy3-third-pass-four-five: sugi, pickers, ukai master, bell fan-out, lantern/track re-arm on enter — all verified (`2195`, `2059`, `4807`, `1599-1609`, `4195-4215`).
- **Comment/behaviour mismatch**: `kyoto.js:1600-1607` says the bell pulse "puts the cormorants off their boats"; `kyoUpdateBirds` (`3184-3226`) never reads `kyoBellPulse`/`kyoBellWave`. Either the claim is stale or the reaction was never written.

### 3. Marquee

`uji-run` — `wow: 'THE UJI'` (`shared.js:2570`); marquee point (4,128) "an hour down the river, where the water runs fast". Minis: `torii-run` SENBON TORII (`2557`) and `the-bell` THE BONSHO (`2575`).

- New verb: being CARRIED. The river is a velocity field published as `flow(x,z)` (`4331`) which capybara.js folds into the same reference-frame channel as the ferry deck; the animal swims at its own 2.6 m/s inside water doing up to 6.2 (`2744`). The only control is lateral position; the field is derived from a centreline polyline with width-by-continuity, bank falloff and 5.5 m eddies behind boulders (`2719-2748`). Real simulation, not rails — but a simulation with no failure state: the worst outcome is being held in dead water.
- Payoff length: 215 m, ~40 s (the bridge man says so, `4688`); record par is the machine floor plus margin (`shared.js:3653`). Along it: three optional gates between cormorant boats with a chime (`3508-3521`), cormorants diving as you pass (`3200-3205`), foam and barrels drawing the fast line, the camera dropped low and back and blended in over 1.5 s (`rig()` `4372-4376`), bloom keyed to `runFlow()` (`systems.js:28867`), the miller shouting "Left! Go LEFT!" only while you are in the river (`4635-4636`). Finish at the mill pond: `frameShot` computed from the wheel back to the animal (`3608-3614`), chime at the mill, splash at you, record, toast; the latch `-2` stops the 67-chime bug (`3536-3538`).
- Reached: walk 80 m from spawn to the bridge, along the ramps, onto the shrine bay past the barrels (`1750-1762`) and step off the open east rail (`1678-1681`). Fail/repeat: leave the channel > 1.5 s and the run lapses (`3552`); runs under 5 s do nothing (`3580`); re-arms by leaving the pond.
- Rating: **4/5**. It is a genuinely different verb (steer without propelling), fully simulated, and sold well by the foam. It loses a point because nothing on the river can hurt, surprise or block you — boulders are shelters, the boats are moored, the gates are optional and silent if missed — so the 40 s has one shape from first run to tenth: get in, stay in the thread, arrive. The best moment in Kyoto is actually the bell (four-second countdown, a decision, and five systems answering the strike), which is filed as a mini.
- Latent: the heron perch (three wheeks from 12 m then loaf, `1296-1309`) is the best hidden thing in the chapter and is unreachable by accident; `torii-run` with its solved camera rail (`3654-3743`) and rising blocks is a strong second set piece; `dry-crossing` with the heron as its reader (`3964-3973`).

### 4. Recommendations

NPC/behaviour:
1. **Gion has traffic** (M, highest impact). Port `quayBuildCrowd`/`quayUpdateCrowd` (`quay.js:4464-4629`: instanced head/shirt/two legs, routes with dwell, stopped-ones-look, `addCrowdBodies`) onto the 108 m lane and the sando with 8-10 walkers, and ONE rickshaw: a T1 kinematic mover on the lane (the Freshwater's A/B loop shape, `quay.js:3600-3633`, at 2 m/s) whose runner stops and says a line when the capybara is inside 4 m (`game.sayNear`, `npc.js:12867`). The arrival frame gains motion and the "quiet chapter" gets somebody to be quiet around.
2. **The ukai boat works** (M). Make one boat a T3 mover between gates 1 and 2 on the river (kinematic, velocity differenced against its target exactly like `quayUpdateBigFerry` `3611-3630`), with the ukai master ABOARD (anchor his local on the boat's group — `addLocal` takes a `group` and follows its rotation, `npc.js:2289-2292`) and four leashed birds that dive on a timer. It crosses the thread once per ~40 s, so the run gains a moving obstacle with a face, and it makes the `1600-1607` claim true.
3. **A one-wheek animal in the pond** (S/M). Four mandarin ducks as a `herdOffer` at obey 1 (contract at `kyoto.js:1368-1412`) that flee inside 4 m: Kyoto's only recruitable animal is the hardest in the game (obey 3), so the herd verb the Pantanal teaches has no tutorial here.
4. **Pickers notice you** (S). They already blend their yaw toward the bell (`2153-2156`); add a second target — the capybara inside 10 m — using the stateless shortest-arc blend from `quay.js:4600-4607`. Twenty-two people straightening as you walk the terrace costs nothing.

Wow — the ONE change to get the Uji to 5: **a weir at the last narrow.** `kyoRIVER_W` pinches to 5.5 m at 0.93 (`2735`); make that a 1.5 m drop: a drawn lip, a `capy.launch` (the same call Cali's cable uses, `cali.js:1771`) with a splash burst and a `punch`, a clean-tongue bonus when lateral offset < 2 m (a chime and a line from the miller), and a spill when you hit the rock shoulder (a spin, no penalty). New verb: LINING UP — the run gets a climax and the thread stops being merely comfortable. Effort M.

Scene:
1. Emissive paper lanterns in Gion under the overcast lock (`846`; the Cali festoon shows the pattern at `cali.js:2430-2452`) — S, and it pays the sweeper's line.
2. A station edge: the first row says "get off the train" and there is no platform. A stub of platform and a stopped two-car train at the east end of the lane (reuse the merger recipe at `quay.js:3074-3085`) — S/M.
3. Foxes at the summit and ema boards (unverified absent) — S.

Bugs/regressions noticed:
- `kyoto.js:1600-1607` vs `3184-3226`: cormorants do not react to the bell (see above).
- `kyoto.js:4810` ukai master says "Twelve birds"; there are six (`3129`, 2 per gate × 3).
- `kyoto.js:3208-3209`: a bird that has just surfaced (`state` 0) can be flipped straight to `1` (wings out) by the 34 s cycle on the same frame — cosmetic pop.

---

## Chapter 5 — Cali (`src/cali.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| The chiva | 1 | T3 | states parked / rolling / stopped / arrived (`2059-2246`); pulls away 1.3 s after somebody is on the roof (`2066-2076`); speed from grade and curvature only, no throttle (`2096-2097`); two 5 s stops (`caliSTOPS` `1175`); night falls with progress and never goes back (`2195-2199`); kinematic body with honest velocity (`2159-2169`); music becomes a positional source on her roof (`musSource` `4115`); camera sits behind her (`rideYaw` `4075`); arrival at the mirador pays `chiva-mirador` if you are on the roof OR on the terrace (`2202-2243`) | waits for you on the roof | `caliStepChiva` `2059` |
| The band | 3 | T1 (+hazard) | seated on the rack facing aft; sway to `music.beats()` (`2172-2189`); DUCK 0.95 s before every cable as the tutorial (`1796-1802`) | no | `2172-2189` |
| Cables | 7 | T2 hazard | signed-plane sweep gated on arclength and lateral (`1803-1846`); a hit `capy.launch`es you backwards off the roof (`1747-1781`); a clean clear counts and whips overhead; tally spoken at the top (`2120-2132`) | yes | `caliCheckWires` `1787` |
| Fruit barrow | 1 | T3 | chocked at the lip; E kicks it; gravity ride with drag and rolling resistance (`1552-1614`); walks itself back up after 5 s unless somebody is in it (`1529-1539`); `cart-run` record | yes (aboard test `1508`) | `caliUpdateCart` `1518` |
| Dancers | 10 (5 couples) | T1 (+cheer) | step 1-2-3 hold 5-6-7 hold off the AudioContext clock, half-turns on alternate bars (`2566-2592`); bounce while `caliDanceCheer` > 0 | on your combo only | `caliUpdateDancers` `2551` |
| Ringside watchers | 18 | T1 (+cheer) | at the bar and round the ring; clap on 2 and 6; cheer on your combo; solid via `addCrowdBodies` (`3030-3037`) | on your combo only | `caliUpdateWatchers` `3043` |
| Loros (parakeets) | 38 | T1 (+night) | two circling flocks; the whole flock crosses the valley once on the rising edge of `night() > 0.30` (`3496-3508`); calls rationed by distance | no (world event) | `caliUpdateLoros` `3487` |
| Kites | 5 | T1 | pendulum-with-lift on drawn strings, dive every ~20 s | no | `caliUpdateKites` `3585` |
| River drift | 80 | T1 | streaks advected west→east, dark under the bridge | no | `caliUpdateDrift` `532` |
| Sugarcane | 620 | T1 | sway at 20 Hz | no | `caliUpdateCane` `3228` |
| City lights / brazier / bulbs | ~940 + 2 | T1 (+night) | come up with `caliNightT`; brazier breathes | no | `caliUpdateNight` `2274` |
| Festoon lamps | ~30 | T1 | chase round the string once a bar (`2457-2475`); opacity on the beat | no | `caliUpdateLamps` `2457` |
| Lulada jug | 1 | T2 trigger | taken inside 1.5 m; flies up and vanishes | yes | `3826-3842` |
| Gato de Tejada + 9 novias | 10 | T0 | static sculpture with colliders; `gato-sit` is a position test (`3791-3798`) | no | none |
| Locals (addLocal) | 10 | T2 | lulada seller (`4348`), bus conductor at the kerb (`4371`, `when: riding()` line), dance teacher `caliLocTeach` (`4387`, `when: onFloor()`), kite flyer (`4408`), embankment man (`4425`), doorway woman (`4441`), chontaduro vendor `caliLocCart` with a knife beat (`4460`), barman `caliLocBar` with a pour beat (`4483`), man at Cristo Rey (`4499`), the leaner on the parapet `caliLocLean` (`4521`); most carry `when: night()` lines; two exchanges (`4545`, `4554`) | yes | `npc.js:4979` |

No traffic of any kind on any street; no walkers; no dogs; no vendors that move. The chiva is the only vehicle and it has no passengers.

Counts: T0: the Gato and novias. T1: 9 classes (band, dancers, watchers, loros, kites, drift, cane, lights, lamps). T2: cables, jug, 10 locals. T3: chiva, barrow. T4: strictly none — but the chain chiva progress → `caliNightT` → loros crossing + 940 windows + lamps + every `when: night()` line in ten mouths is the chapter's one systemic effect and it is good.
Things that acknowledge the capybara: chiva, 7 cables, barrow, dancers + 18 watchers (via combo), jug, 10 locals ≈ 15 distinct things, of which ZERO animate bodies react to the animal's position — the crowd reacts to the score, the bus to a roof test, the people are fixed. Most complex: the chiva ride as a whole.

### 2. Scene completeness

Arrival frame (B2-05): the lulada stand from the south bank looking north — grey promenade, lawn, the painted novias (the one colour in the frame), a slab of river, the far terrace of painted houses, one local, the jug. The Gato is off-frame left and the Ermita spire off-frame right; the marquee (chiva at (30,40), `shared.js:3181`) is ~75 m away behind the north terrace. ROADMAP-BEAUTY: "the lawn is the Sydney lawn again" (`ROADMAP-BEAUTY.md:40`). ROADMAP-FUN B1 (`ROADMAP-FUN.md:801`): first tick 28.5 s, marquee never seen in 90 s — still true by geometry.

Dressing is good in the town half: 18 painted houses with pitched pantiles, grilles, open doors (`783-867`), back rows and a roof scatter (`2645`), bougainvillea, paint tins, stools, power poles with real slack that pre-teach the cable (`3094-3160`), plantain seam to the cane (`3168-3182`), the paseo with samán and lamp standards (`2731`), the Ermita (`648`), the Gato, the open-air salsoteca with a ring wall, festoon lighting, a bar with nine bottles (`2310-2453`), the mirador with cart, brazier, viewer, padlocks and a bulb string (`2817-2933`), Cristo Rey, 620 cane. Props: two rings (`props.js:2527-2530`).

Missing for a real version:
- A city of 2.5 million with no motos, taxis, buses or bicycles; the chiva drives 465 m of town street with nothing else on it, and the two stops (`1175`) have nobody waiting and nobody boards.
- No pedestrians anywhere — every person is either fixed (locals), dancing in place, or clapping at the ring. The paseo "where people sit" has one man.
- The party bus has a band and no party: no passengers on the benches or the roof.
- No dogs, no fruit vendor walking, nothing crosses the Ortiz.
- Weather: 'Valley Warm', golden lock (`weather.js:220-229`); night is only ever reached by the ride.

Open items checked:
- REVIEW-2026-08-31 item 5 (`REVIEW-2026-08-31.md:305`, cali.js noShadow): CLOSED — crosses `3283-3285`, loros `3469`, kites `3558`, lines `3569`.
- Memory notes (barrow walk-back, chiva parked at mirador on revisit, wire clears counting, loros dusk crossing, ringside): all verified at the lines cited above.
- `caliCHIVA = {x:30, z:40}` (`50`) is what the CHAPTERS marquee and the conductor's anchor (`4371-4373`) use, while the bus is parked at `caliRouteAt(0)` (`939-941`); whether those coincide is **unverified** here (`caliROUTE_TOWN` `1138` not read). If they do not, the marquee point and the conductor are next to a kerb the bus is not at.

### 3. Marquee

`chiva-mirador` — `wow: 'CALI'` (`shared.js:2594`), "the party bus. it goes up the hill and it does not wait". Mini: `cart-run` LA CARRETILLA (`2600`). The chapter's other headline is `salsa-dance`, a rhythm test against the real audio clock (`3720-3727`) with a hidden mercy widening (`3777`).

- New verb: RIDING A ROOF AND HOPPING. The climb onto a moving vehicle by its ladder (`920-929`, treads collided `977-982`), staying aboard through corners (rails collided `971-976`), and a timed hop under seven cables whose only tell is the band ducking a second early. Ride-on-rails: the route is a smoothed polyline (`1185`), the speed is grade and curvature (`2096-2097`), the player has no throttle, no wheel, no stop button — "she is a floor that is going somewhere" (`2092-2095`).
- Payoff length: 465 m at 4.4-7.2 m/s with two 5 s stops ≈ 90-120 s (`2217` says 121 s). Along it: the salsa stops being a score and becomes a band on a roof that you can be left behind by (`musSource`), night falls with progress, 38 loros cross the valley at `night > 0.30` with a toast, 940 windows come on, the camera holds behind the bus. Arrival: sparks, `punch(0.12)`, chime + strum at the terrace, `frameShot` to bearing 82° for 7 s so the city-light field is in the frame (`2235-2238`), `skyward()` lifts the lens (`4126-4129`), a vendor who is not impressed and a leaner who saw you on the roof.
- Reached: the chiva is ~75 m from spawn behind the north terrace; climb the ladder, stand still 1.3 s. Fail/repeat: a cable throws you off with a toast and a wheek; the bus does not wait but you can run the last stretch and arrival still pays if you reach the terrace (`2208-2210`). ONE-SHOT PER VISIT: once arrived she stays parked at the mirador for ever (`3977-3981`, `4011`); the only way down is the barrow.
- Rating: **3.5/5** (honestly a ride-on-rails). What carries it is not the ride but what the ride does to the world — the sun going down on progress and the music becoming a place are the best two ideas in the three chapters. It loses ground because the player's only verb is a hop with seven chances and a toast tally, the party bus has no passengers, and the moment cannot be repeated. `salsa-dance` is a stat-check with real skill in it, and is small on screen.
- Latent: the barrow is a proper gravity ride (`1552-1614`, top speed record) and is the better VERB of the two rides — it is a mini. The cable clears count but buy nothing (`2125-2131`).

### 4. Recommendations

NPC/behaviour:
1. **Passengers, and the cables take them** (M, highest impact). Eight instanced on-beat figures parented to the chiva group in chiva-local coordinates (the band's `holder` pattern, `1047-1052`; the dancer merger `2512-2526`), four boarding at each stop (they walk from a fixed kerb point to the ladder over the 5 s hold), dancing on the roof to the same `music.beats()`, ducking with `caliBandDuck`. Each cable knocks one off unless the player hopped it clean — "the ones who watched you" — so the existing hop gains stakes. The bus conductor's local moves ONTO the bus (`addLocal` with `group:` follows the group, `npc.js:2289-2292`) and shouts the stops.
2. **Street traffic** (M/L). Reuse the route table the chiva already drives (`caliRX/caliRZ`, `caliOffRoute` `2635`) for four motos/one taxi on the town half running the other way, kinematic like the bus, horn inside 8 m of the animal on the road; Hanoi's traffic system (`src/hanoi.js`, not read here) is the reference the rubric names and would be the fuller port. This is the single largest gap: a salsa city with no engine but one.
3. **Walkers on the paseo and San Antonio** (S/M). `quayBuildCrowd` (`quay.js:4464-4629`) with 5-6 routes along the riverside (`caliBuildPaseo` `2731`) and the painted street; `addCrowdBodies` for solidity; the stopped ones look inside 12 m.
4. **The floor looks at you** (S). The couples never read the capybara; at combo ≥ 4 the nearest couple faces the player and mirrors the step (turn = `face` in `2577`). The teacher's `when: onFloor()` line already exists; give him a `beat` that counts eight on his hand.
5. **Re-arm the ride** (S). After `caliVistaT > 40 s` with nobody on the roof, let `caliChivaS` decrease along the same route back to the kerb (the polyline is reversible; `caliChivaReset` `2257` already exists) so the set piece can be ridden twice in a visit; the night stays.

Wow — the ONE change: item 1 above (passengers who board and can be lost to the cables). It turns the hop from a hazard into a responsibility, puts the party on the party bus, and needs no new system.

Scene:
1. Traffic (above) — the visual half is the same work.
2. The arrival: shift the spawn or its yaw ~10 m so the Gato and the Ermita spire are both in the frame (the fourth pass chose (−16.5, −19.5) from a nav map; the picture is concrete and lawn). S.
3. The two chiva stops as places: a shelter, a sign, two people waiting (they become the passengers). S.

Bugs/regressions noticed:
- `cali.js:3508` `(1 - cross) * 0 + …` and `3515` `+ (cross > 0 ? 0 : 0)`: dead expressions in the loro flock.
- `cali.js:2908-2909`: `y0` computed and voided — dead.
- `cali.js:50`/`939`: `caliCHIVA` constant vs `caliRouteAt(0)` — verify they coincide (see above); the CHAPTERS marquee and the conductor both use the constant.

---

## Across the three

| | Quay | Kyoto | Cali |
|---|---|---|---|
| animate classes | 19 | 17 | 15 |
| bodies that read the capybara's POSITION (not the score/horn) | crowd (stopped), apron gulls, cockatoos, 11 locals | heron, cormorants, 13 locals | 10 locals |
| moving vehicles other than the player's | Freshwater, 2 berthed (bob), fleet, cars, train | none | chiva |
| walkers | 30 | 0 | 0 |
| wow rating | 5 | 4 | 3.5 |

The shared gap is the same one in all three: the locals rig has been used hard (11/13/10 people, conditional lines, beats, exchanges) and it produces fixed people; the only walking bodies in the three chapters are the 30 commuters at Circular Quay, and the only kinematic movers with a face are the Freshwater and the chiva. Kyoto and Cali each have zero bodies that walk and zero vehicles on their streets. The cheapest cross-chapter lift is one port: `quayBuildCrowd`/`quayUpdateCrowd` (four draws, routes, dwell, look-at, solid bodies — `quay.js:4464-4629`) into Gion/the sando and San Antonio/the paseo. The second is one kinematic mover per chapter built on the Freshwater's velocity-differenced pattern (`quay.js:3611-3630`): a rickshaw on the lane, a moto on the street, an ukai boat on the river.

For the wow moments: the ferry is the reference and needs nothing. The Uji needs a climax (the weir). The chiva needs stakes and a party (passengers the cables can take) and a way to run again.
