# G — Chapters 18 (Monte Carlo) and 19 (Hanoi), plus the reusable-machinery catalogue

Read-only audit, 10 Sep 2026. Files: `src/monaco.js` (4,697 lines), `src/hanoi.js` (3,788 lines). Screenshots looked at: `qa/B2-18-monaco.png`, `qa/B2-19-hanoi.png`. All line numbers are current HEAD (`1e207ac`).

A note on the brief: "each file has only ONE game.addLocal call" is true as a call SITE — `monBuildLocals` (monaco.js:3937-4056) and `hanBuildLocals` (hanoi.js:3052-3216) each wrap `game.addLocal(o)` in a local `put()` helper — but that helper is called **7 times in Monaco** and **10 times in Hanoi** (9 locals + the four-chapter traveller via `addTraveller`, hanoi.js:3064-3066). So both chapters DO have a locals cast; what they lack is anything above T2.

---

## CHAPTER 18 — MONTE CARLO

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Croupiers / "the eye" | 5 | **T2** (figure) / room state is T3-ish | Merged tux figure + a wedge mesh on the marble. Yaw sweeps on a sine (`monEyeYaw` :3264). Fill/drain `monSeen` with LOS test against a cover list (`monBlockedSight` :1692), range scaled by loaf ×0.5 / run ×1.55 / held +12% (:3313-3316). At 1.0: `monEject` (:3361) — releases the held prop, zeroes `monStack`, 2.4 s "carried out", teleports to steps (`monPutOnSteps` :3401), 4.5 s cooldown. Figures themselves never walk, gesture or speak. | yes — position, loaf, isRunning, heldProp | `monUpdateEye` monaco.js:3268 |
| Grand Prix cars | 3 | **T1 carrier** | Lap a 20-node polyline (`monTRACK` :176) on a curvature speed law (`monCarTarget` :2584, v = 2.8/√k, 5.4-26.5 m/s). Kinematic body: deck + four rails (:2555-2559), velocity differenced against previous target (:2618), mesh lean/pitch (:2631-2634), headlamp beam brightens in the bore (:2636-2640), one `sfxMover('v8')` on the silver car (:2653-2666). Cars never see the capybara or each other. | no (movement); the ride test reads capy (`monUpdateRide` :2679) | `monUpdateCars` monaco.js:2601 |
| Grandstand + barrier watchers | 46 | **T2** | One InstancedMesh, 28 in the stand + 18 along the harbour armco (:3155-3176). Each turns to the nearest car; if `monRider >= 0` and the ridden car is within 90 m they turn to THAT car (:3228-3233). Bob only. Solid via `game.addCrowdBodies` (:3191-3197). One `cheer` cue on ride start (:2724). | indirectly (via the ridden car) | `monUpdateWatchers` monaco.js:3201 |
| Palace carabinier | 1 | **T2** | Merged figure, never turns. `monGuardBreak` accumulates at 0.30/s inside 1.4 m, decays 0.055/s (:3687-3688); a wheek inside 9 m adds 0.36·(1-d/9)+0.10 (`monWheek` :4078-4086). At 1.0: shakes for ever (:3698-3701), ticks `palace-guard`. **No collider** — `monBuildGuard` (:1503-1526) adds no `monPoolBox`; the sentry boxes at :1417-1421 are draw-only too, so "climb on the sentry box" (:1500) is not possible. | yes — distance + wheek | `monUpdateGuard` monaco.js:3679 |
| Locals (doorman, square regular, quay fisherman, yacht deckhand, hairpin marshal, barman, wheel croupier) | 7 | **T2** (shared rig) | `addLocal` with `before:/after:` conditional lines, `onTask`, `wheek` replies, `beat` work loops (fisherman `rock`, barman `clink`, croupier `roulette`), one `addExchange` pair croupier↔barman (:4047-4055). | yes (rig: look, speak, flinch, barge) | npc.js rig; built at monaco.js:3937 |
| Roulette wheel + ball | 1 | **T1 carrier** | Kinematic disc turned by `angularVelocity` 1.05 rad/s (:3453); ball counter-rotates (:3461-3465); 6 s standing on it = mini `the-wheel` (:3474-3481); a settled plaque inside r pays by pocket (`monSettle` :3509). | ride timer only | `monUpdateWheel` monaco.js:3446 |
| Plaques | ≤6 props | prop | `spawnProp('plaque')` on the tables (:3554-3562); respawn 2.2 s after a payout (:3500). | carried | via props.js |
| Champagne tower | 55 glasses | **T2** | Instanced; capy inside 2 m at >2.2 m/s scatters all 55 ballistically with floor bounce (:3626-3663); parked after 18 s; restacked on `onEnter` (:4462-4480). | yes — speed + distance | `monUpdateTower` monaco.js:3618 |
| Piano keys | 52 | **T2** | Keys under the animal spring down, chime pitched by key index (:3580-3594); 8 distinct keys in 4 s = `piano-solo`. | yes | `monUpdatePiano` monaco.js:3572 |
| Small craft | 41 | T1 | Instanced hulls on pontoons/east quay; roll/pitch/bob on phase (:2973-2977). Nobody aboard. | no | `monUpdateBoats` monaco.js:2968 |
| Superyacht | 1 | T1 (roll) + task logic | Three decks (3.4/6.2/9.0 m); rolls 0.008 rad (:3760-3763); aboard test → `superyacht`; leave-height → `high-dive` (:3735-3757). Dinner-jacket prop on the sun deck (:4670-4672) → `capy.dress(true)` (:4325). | aboard/dive tests | `monUpdateYacht` monaco.js:3715 |
| Chicane cones | 5 props | prop | Spawned on the pool straight (:3878-3894); `monChicaneMine` flags the ones the animal touched (:3909-3922); `prop:water` ticks `chicane` only if mine (:4414-4425). | touched | `monUpdateChicane` monaco.js:3909 |
| Palms | 54 | T1 | `swayMesh` (:3125). | no | shared sway |
| Sea | 1 | T1 | vertex ripple (:1066). | no | `monUpdateSea` |
| Café de Paris terrace | 22 tables, 44 chairs | **T0** | Drawn (:1627-1638), nobody at them. | no | none |
| Hôtel de Paris forecourt cars | 4 | **T0** | "the four cars nobody is ever going to move" (:1617). | no | none |
| Casino tables/chairs | 4 tables, 16 chairs | T0 | Cover circles + nav blocks (:1813-1825); no players. | no | none |
| Lamps 153, lit windows ~1,600, bollards 34, pontoons, moles | — | T0 | static merges / instanced | no | none |
| Gulls | 0 meshes | sound only | `monCue('gull', …)` from the ambience (:4393). | no | `monUpdateAmbience` :4349 |

**Tally:** T0 — tables, chairs, hotel cars, lamps, windows, bollards. T1 — 3 cars, wheel+ball, 41 boats, yacht, 54 palms, sea. T2 — 5 croupiers, 46 watchers, guard, 7 locals, champagne tower, piano. **T3 — none as an individual actor** (the closest is the *room* as an actor: idle/warn/eject/cooldown, and it takes your prop and your stack). **T4 — none**: no NPC ever interacts with another NPC or with the traffic; the croupier↔barman "exchange" is a text pair on a timer (:4048).

**Things that acknowledge the capybara:** 5 croupiers (as a cone test), the guard, 7 locals, the tower, the piano, and the 46 watchers only while you are on a car — six *classes*. Nobody walks toward, away from, or after the animal anywhere in the chapter.

**Most complex behaviour:** the eye — five sweeping cones with occlusion against a cover list, fill/drain asymmetry, loaf/run/held modifiers, a warning threshold with a toast, ejection that drops the held prop and zeroes the stack, and a cooldown (monaco.js:3268-3393). It is a good stealth *field*; it is not an NPC.

### 2. Scene completeness

The arrival PNG (`qa/B2-18-monaco.png`) is the SE quay looking at the yacht: gangway, deckhand on the companionway, cone, bollards, palms, one lamp, pontoon rows of boats, and the lit town behind. Density on the quay is fine (scatter pass at :4121 fixed the "nothing on the floor"). What a real Port Hercule at 20:20 has and this does not:

- **Nobody on the Café de Paris terrace** — 22 tables and 44 chairs drawn at :1627-1638 and not one figure; it is "where everybody on this square actually is" by the code's own comment. Same for the casino: four tables with chairs (:1817-1826) and no gamblers; a salon with five croupiers, a barman and a wheel croupier and zero customers.
- **No traffic on the streets except three F1 cars.** The whole town has white lines and armco and the only vehicles are the racers; the hotel forecourt cars are static boxes (:1617). No cyclists, no taxis, no scooters, no tender moving in the basin (41 boats, all moored, all crewless :2921-2966).
- **No tourists on the Rock** — one guard, no visitors, no photographers (:1382-1500).
- **No gulls as meshes** (sound only :4393), no helicopter over the heliport (the locals joke about one :3929).
- The grandstand crowd exists only on the harbour front; the hairpin — the corner the marshal talks about — has no spectators.

Known-open items checked against code: ROADMAP-FINISH's three Monaco items are **done** — chicane ownership (:3909-3922, :4420), crowd watches the rider (:3228-3233), stack can fall (:3387-3389). REVIEW-2026-08-31's wheek gate is **done** (:4065). ROADMAP-BEAUTY's "harbour does not reflect a single window" — unverified here (rendering, not this file).

### 3. Marquee / wow

- **Marquee:** `the-tunnel` carries `wow: 'MONTE CARLO'` (shared.js:2996-2997); CHAPTERS marquee pin at the tunnel mouth (shared.js:3330). Two minis: `the-wheel` and `the-hairpin` (shared.js:2988-2995).
- **How it is reached:** hop onto a car's open cockpit (deck 0.95 m, four 16 cm rails :2547-2559) — practically only at the Fairmont hairpin where the speed law bottoms at 5.4 m/s (:236, :2598) — then ride ~half a lap; `monTunnelIn` marks bore entry (:3792), exit before `b-2` with entry inside the first 14 m ticks the task (:3812-3821), record = car speed at exit (:3817).
- **What it is:** a **ride-on-rails**. The player has no verb inside the bore; the skill is the boarding hop and staying inside the well through 0.8 g corners. Presentation is strong: declared carry frame (:4535), 0.3 s ride-grace latch (:2702-2705), camera enclosure `tunnel()` (:3785-3786, read by systems.js to shut the sky), `frameShot` behind the car with `over:true` (:3841-3842), `music.swell(1.0)` (:3844), the v8 sfx mover heard through the hillside (:2665), grandstand cheer on boarding (:2724), the `heat()` feed into the Bond arrangement (:4565-4580, systems.js:36772). Payoff length: 111 m at ≤26.5 m/s ≈ **4.5 s**.
- **Fail/repeat:** fall off → the lap loops, get back on at the hairpin. Fully repeatable.
- **A design hole in the record:** the comment at :3777-3778 says the tunnel speed "is a number a player can go back and beat by picking a better car and a better corner to get on at", but all three cars run the identical speed law with no car-car term (`monUpdateCars` :2604-2609 has no lookahead to another car), so speed at the bore exit is a deterministic function of arclength. Unverified numerically, but by construction the-tunnel record has **no player-controlled variable** beyond the first-lap transient after `onEnter` (:4446-4458).
- **Rating: 3/5.** Unique image (a capybara on a Formula car at 95 km/h into a dark bore, then the whole port), best-in-class camera/sound dressing, but passive for its 4.5 s and mechanically the same event every time. Against the ferry helm / condor / dive / climb it is the only one of the five where the player's hands are off.
- **Latent big moments:** (a) THE EYE is the most original system in the chapter and it is spent on a stat-check crossing (`the-floor` :4266-4293). (b) The high-dive from 9 m is real physics and the harbour has a modelled bed (`canDive: true` :4525) but nothing lives under the water except scatter. (c) The Rock is 58 m of climb with one guard and no reward beyond a tick (:4301-4309).

### 4. Recommendations

**NPC / behaviour**

1. **A pit boss who walks (M, high).** Promote one of the five to a T3 patroller using the Marrakech pursuer layout — `sahPurData` (x, z, home, yaw, state, lastSeenX/Z; sahara.js:153) and `sahUpdateChase` (sahara.js:1985, 5.9 m/s, catch radius 1.5 m :82-83). Patrol the salon on the existing cover/nav circles (`monBLOCK`/`monCOVER` :884, :1689); at `monSeen > monEYE_WARN` walk to the last-seen position; at 1.0 the ejection becomes *him reaching you* rather than a meter filling. The other four keep sweeping. This turns the floor crossing into a chase and makes `the-floor` a real record.
2. **Seat the salon (S-M, high visual + a T2 layer for free).** The four tables have 16 empty chairs (:1817-1826) and the terrace has 44 (:1627-1638). Use `addCrowdBodies` static shapes (props.js:1801) for the bodies and Hanoi's sitter trick — instanced figures scaled 0.66 at seat height (hanoi.js:2987-2989) — for the draw. Give the four *table* groups a head-turn to the capybara inside 6 m (the watchers' yaw code :3241 is the template) and a `castReact('mess')`-style gasp when a plaque is lifted off their table. Gamblers who *look up* are also the eye's fiction made visible.
3. **Cars that see each other (M, medium; also fixes the record).** Add a following term to `monCarTarget` (:2584): if another car is within 18 m ahead, cap `want` to its speed (Hanoi's `brake` law :1643-1648 is the shape) and add a slipstream bonus (+8%) inside 8 m. The three cars then bunch and spread across laps, the tunnel record becomes a function of *which car and when*, and a second car passing your car in the bore at 0.4 m is the F1 image the chapter is missing.
4. **Guard gets a collider and the sentry box gets a top (S).** `monBuildGuard` :1503 has no `monStaticBox`; :1417-1421 draw sentry boxes with no pooled box. "Sit on his foot / climb on the sentry box" (:1500) is currently walking through him.

**Wow moment (rating 3 → 4-5): "THE TOW" — car-to-car hop in the bore.** Built on (3) above plus machinery that already exists: `capyPLAT_AIR` latches the deck frame for 1.2 s through a jump (capybara.js:382, :4827), which is exactly what the chiva's cable hop relies on. With cars bunched nose-to-tail through the tunnel, the new verb is *hop from the roof of one car to the next at 26 m/s in the dark* — the frame-relative hop the game already solves, in the one place it would be spectacular. Record: cars ridden in one lap; `monRider` already tracks which car you are on (:2706-2734), so the counter is a few lines. Effort M. Keep `wow` on the-tunnel; the tow is the tunnel done properly.

**Scene (2-3 high-impact adds)**

- People on the Café de Paris terrace and at the casino tables (above).
- Street traffic on the circuit when the race is not passing: a handful of scooters/taxis on the same `monTrackAt` polyline at 8-12 m/s, drawn instanced like Hanoi's bikes — the town currently reads as a closed circuit with nobody living in it.
- Gull meshes over the basin (the Manly gull is already an instanced flier with an offer contract) and one tender moving between the pontoons and the yacht.

**Bugs / regressions noticed while reading**

- **monaco.js:2687-2688 — the ride test rotates by the wrong sign.** `c = cos(-yaw), s = sin(-yaw); lx = dx*c - dz*s; lz = dx*s + dz*c` applies R(+yaw) to the world delta, not R(-yaw). Checked numerically: at yaw 45°, a point 2 m behind the car on its axis comes back as `lx = -2, lz = 0`, i.e. the on-roof box is turned 90° at diagonal headings (1.49 m along the car instead of 2.65). It passes today only because the cockpit well is near the origin and the tolerances are +0.55 m; the "corner puts the animal outside it for a frame or two" the grace latch (:2693-2705) exists to hide is at least partly this. Same class as memory note `capy3-reference-frames` #4. Correct form: `lx = dx*cos(yaw) - dz*sin(yaw); lz = dx*sin(yaw) + dz*cos(yaw)`.
- monaco.js:4047 — the exchange is guarded on `monLocDoor && monLocBar` but pairs `monLocCroup` with `monLocBar` (:4048); if the croupier's `put` returns null (water probe), `addExchange` receives a null `a`.
- monaco.js:3698 — `const sh = …` is computed and never read.
- monaco.js:3777-3778 — comment promises a beatable record that the speed law makes constant (see §3).

---

## CHAPTER 19 — HANOI

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Scooters ("the flow") | 240 | **T2, emergent crowd** | Ten floats each (`hanBIKE_STRIDE` :194), a parameter along one of four lane polylines (`hanLANES` :131-142, `hanLaneAtS` :426). Per rider inside 15 m (`hanSEE`): swerve 3.4 m to the roomier side (:1612-1615), count one swerve on the rising edge (:1617-1619), **brake to a jam** if it cannot clear (:1643-1648), clip + shove only when the animal dithers (`hanDither > hanTURN_MAX`, :1652, :1673-1687), and **line up under an airborne capybara** inside 7 m (:1599-1611). Six body-colour meshes (:1335-1348), lean on offset delta (:1364). Three `sfxMover('twostroke')` on the nearest three + one `traffic` bed (:1446-1525). Horns as punctuation (:1691-1705). **No rider sees another rider** — the jam is 40 independent brakes, not propagation. | yes — position, speed, heading history, airborne | `hanUpdateBikes` hanoi.js:1527 |
| The ride tray | 1 kinematic body | **T1 carrier** | One five-shape footwell (:1803-1807) parked under whichever bike the animal is *above* (:1878-1892), driven by velocity vs previous target (`hanPlaceRideBody` :1924-1940); 6 s aboard = mini `ride-the-flow` (:1917-1921); declared `carryFrame` (:3603). | seat test | `hanUpdateRide` hanoi.js:1816 |
| The train | 1 | **T1 on a clock** | Every 96 s (`hanTRAIN_GAP2` :153; first at 0.30× on enter :3752): whistle at 11 s (:2135-2144), spawn at x1+60 and run west at 11 m/s (:2154-2158), kinematic body loco + 4 carriages (:2111-2122) that *shoves* anyone on the rails. Never reads the capybara for movement. | only for scoring / shake / cue | `hanUpdateTrain` hanoi.js:2127 |
| Train Street folders (stools, tables, racks, parked bikes, awnings) | ~2 per house × ~26 houses/side (≈100 meshes) | **T1** | Registered with OPEN and FOLDED transforms (`hanFolder` :1960, :2030-2041); `hanFoldK` damped on the *clock*, explicitly not the player (:2303-2309, :2329-2338). | no, by design | `hanUpdateTrain` |
| Pavement folk | 70 | **T1** | Ten instanced variants; half sit on stools facing the wall (scaled 0.66, :2987-2989), half walk their lane (:2973-2978). One box each via `addCrowdBodies({moving:true})` (:2926-2928) stepped after the draw (:2996). Never read the capybara. | no | `hanUpdateFolk` hanoi.js:2964 |
| Water puppets | 6 | T1 | Bob/turn on phase in the pool (:2500-2507); task trigger reads capy in the pool rect (:2509-2517). | trigger only | `hanUpdatePuppets` :2499 |
| Đá cầu players + shuttlecock | 5 + 1 | T1 | Rally passed round/across the ring on a 1.35 s leg (:2822-2851), kicker dips (:2852-2857); they "play through you" — standing in the middle for 4.5 s is the task (:2863-2874). | trigger only | `hanUpdateCau` :2819 |
| Plastic stools | 96 | **T2** | Knocked by the capybara at >1.4 m/s inside 0.9 m (:2629-2641), slide/tip, stand back up after 8 s; record = most down at once; 14 = mini `the-stools` (:2653-2662). | yes | `hanUpdateStools` hanoi.js:2608 |
| Locals (traveller, phở seller, bia hơi tap, rail-side woman, flower seller, barber, puppet usher, market butcher, two on the lake wall) | 10 | **T2** (shared rig) | `before:/after:` lines, `onTask`, `wheek`, work `beat`s with tools (`phobowl`, `coffee`, `flowers`) and sfx (`bowls`, `cleaver`, `tick`); exchange phở↔bia (:3207-3215). All sitting. | yes (rig) | npc.js rig; built at hanoi.js:3052 |
| Props: phở bowl, egg coffee (balcony at +5.2 m), 3 flower bunches | 5 | prop | staged on first live frame (:3701-3717). | carried | props.js |
| Lake surface | 1 | T1 | vertex ripple (:751-758). | no | `hanUpdateLake` |
| Kerb weeds | many | T1 | `swayMesh` (:3513). | no | shared |
| Market stalls (40, with goods) / backdrop blocks (460) / tube houses / cables / 60 lanterns / signs / Long Biên lattice / Huc bridge / Ngọc Sơn | — | **T0** | static merges (:2672-2699, :1062-1064, :1194, :3000). | no | none |
| Dogs / birds / boats | 0 meshes | sound only | `bark` is the horn; `gull` on the lake (:3368); "there is no boat" (:3156). | — | ambience :3340 |

**Tally:** T0 — market goods, backdrop, cables, lanterns, bridges. T1 — train, ~100 folders, 70 folk, 6 puppets, 5 cầu players, lake, weeds, the ride tray. T2 — 240 scooters, 96 stools, 10 locals. **T3 — none. T4 — none** strictly: the scooters are the one thing in either chapter that *looks* systemic (a jam of forty around one animal), but there is no rider→rider term (`hanUpdateBikes` :1567-1668 loops each bike against the capybara only) and the train and the traffic never meet.

**Acknowledge the capybara:** the 240 scooters, the 96 stools, the 10 locals — three classes, but the first is the densest reactive layer in the game. The 70 folk, the puppets and the cầu ring do not.

**Most complex behaviour:** the flow — commitment/dither model (:1538-1549), see/swerve/count/brake/jam/clip/airborne-undercut (:1567-1668), and the crossing scored by *how many went round you* (:1718-1777). Rubric-level "traffic medium"; the best thing in either chapter.

### 2. Scene completeness

`qa/B2-19-hanoi.png` (spawn on the lake wall, ring road behind): riders with baked-on loads (boxes, flowers, a bowl), sitting folk, conical hats, a lantern seller figure, cables, signs, the lake, and a passer-by. It reads as a street — the densest arrival in the pair. Missing for a Hanoi at ten in the morning:

- **One vehicle kind.** 240 of the same scooter in six colours (:1271-1274) and nothing else: no cyclos, no cars, no buses, no trucks, no bicycles moving (the flower bicycle is parked :2767-2773). A Hanoi crossing is scary because of the *mixture*.
- **The pavement never crosses the road.** The 70 folk walk their own lane's pavement (:2982) — nobody ever demonstrates the chapter's one instruction.
- **Market with 40 stalls and one vendor** (the butcher local :3161); goods are colour spheres (:2685-2688). No shoulder-pole hawkers walking, which is the other famous Hanoi image.
- **Train Street with no tourists** — in life the alley is lined with people holding phones when the train comes; here the folders fold and nobody is on the doorsteps (:1993-2043 place furniture, no figures).
- Nothing on the lake (no boats, no turtle, no birds as meshes); the puppet pool has puppets but no audience; the 460 backdrop blocks are plain boxes (:1062).

Known-open items checked: REVIEW-2026-08-31's three Hanoi bugs are **done** — wheek gate (:3227), fold rotation on `hanFoldK` (:2337), cầu leg walk (:2829-2843). ROADMAP-FUN "nobody within 26 m of the spawn" is **done** (two lake-wall locals :3187-3205). ROADMAP-AUDIO "no engines" is **done** (movers :1476, :1506).

### 3. Marquee / wow

- **Marquee:** `the-train` carries `wow: 'TRAIN STREET'` (shared.js:3025-3026); pin at (-82, 46) (shared.js:3342). Minis: `ride-the-flow`, `the-stools` (shared.js:3010-3014).
- **How it is reached:** be inside `hanZ.alley` when the train passes with < 2.6 m clearance (`hanTRAIN_WOW` :157, test :2203). The paper counts down via `nextIn()` (:3574-3578); the horn at 11 s and the fold are the tell. The train is on a 96 s clock, so the moment cannot be *caused*, only attended.
- **What it is:** a **clocked, stationary trigger** — by design ("a thing you do by NOT MOVING", :38-39). The fold (~100 meshes retreating over ~4 s) is a genuine set piece and the shove-if-on-the-rails is real physics (:2111-2122). Payout in-pass (:2203-2272): `frameShot` **bearing only** — dist/pitch/raise are refused by the alley's own occlusion (:2228-2269), `swell(1.0)`, `shake` (:2343), thuds (:2345), `trainGlow()` for the grade (:3623-3640). Payoff ≈ 6 s of train past you (66 m at 11 m/s).
- **Fail/repeat:** none to fail; repeats every 96 s.
- **Rating: 3/5.** The fold is the best T1 moment in the pair and the inversion (the chapter's third act is stillness) is smart, but the player is a witness, the camera cannot move, and the wow flag sits on the *less* interesting of the chapter's two big systems. Against the rubric's best five, "Hanoi traffic" is one of them — and that is `cross-the-road`/`ride-the-flow`, which carry no `wow`.
- **Latent big moments:** (a) The generic wall-climb fallback (capybara.js:2153-2165, `capyClimbProbe`) applies to any chapter that does not publish `climbHold` — Hanoi does not — so the alley's pooled house walls (:1992) are already climbable in principle (unverified in play). (b) The train is a kinematic carrier "nobody is ever going to ride" (:2065-2066) with a flat 3.4 m roof; the awnings fold UP to 3.5 m (:2040-2041), i.e. to roof height, and are draw-only. (c) `ride-the-flow` is a 6 s mini on a medium that could carry a whole lap of the quarter.

### 4. Recommendations

**NPC / behaviour**

1. **Riders that see riders (M, high).** Add one lookahead term in `hanUpdateBikes` (:1567): a rider inside 6 m behind a slower rider in the same lane with |Δoff| < 1.2 m brakes toward it (`brake` law :1643 reused). The jam then *propagates* — forty stop because the first three stopped — and the traffic becomes T4 at almost no cost (it is one extra neighbour query; a lane-bucketed sort by `s` keeps it O(n)). Also gives the horn a reason: a rider braking for a rider barks.
2. **Second and third vehicle kinds (M, high visual).** Same lane records, two more geometry variants (a cyclo at 2.5 m/s that never swerves and a delivery truck at 6 m/s with a 6 m envelope that *cannot* swerve). The crossing gets texture: you cross behind the truck, not in front of it.
3. **Folk that cross (S-M, medium).** Give ~8 of the 70 a `cross` state: pick a lane point, walk straight across at 1.2 m/s, resume on the far pavement. They use the same swerve field the capybara does — `hanUpdateBikes` just needs a second "thing to avoid" — and they demonstrate the chapter's instruction without a toast. Effort is bounded because their bodies already `step()` (:2996).
4. **Shoulder-pole hawkers as walking locals (S).** Two `addLocal` records with a `walk` route are not in the rig; but the Sydney cast's `stepHuman` (npc.js:7962) has `wander`/`plod`/`serve`. Cheaper: two more instanced folk with a baked pole and baskets on lane 3 past the market.

**Wow moment (3 → 4-5): "OUT ON THE ROOF" — ride the train out of Train Street.** Everything needed exists: the train is already a velocity-driven kinematic body differenced against its previous target (:2160-2168) with a flat top at 3.4 m; the carrier contract (`carryFrame`, capybara.js:2378-2386) is already published for the tray (:3603) and needs a second branch for "on the train roof" (a roof test like `monUpdateRide` monaco.js:2679, in the train's frame); the awnings at fold height 3.5 m (:2040-2041) need a pooled box each and the house fronts need either `climbHold` or a stair — or simply rely on the generic wall climb (capybara.js:2153) to get onto an awning, which is the verb the chapter teaches nobody. Then the moment is: horn → street folds → climb a wall to a folded awning → the train comes through under you at 11 m/s → drop onto the roof → carried 100 m out over the level crossing and into the quarter, with `frameShot` finally free to pull back once you clear the alley. New verb: a **timed drop onto a moving carrier** (the Volo/manta lesson in reverse), and the marquee becomes something you *do*. Effort M-L; keep `wow` on the-train.

**Scene**

- A vehicle mixture (above) — the single biggest visual lift for the crossing.
- Doorstep watchers in Train Street: 20 figures flat against their doors that appear as `hanFoldK` rises (the fold already lerps meshes; add them as folders whose OPEN transform is inside the house).
- Boats on Hoàn Kiếm and a shoulder-pole seller or two on the lake walk; the lake is the quiet half and it is empty.

**Bugs / regressions noticed while reading**

- hanoi.js:2244-2268 — the same "A raise was tried too…" paragraph is pasted three times in the marquee comment (cosmetic).
- hanoi.js:1826 — `hanUpdateRide` early-returns when off the lanes, so `hanRideGrace` and a stale `hanRider` are not advanced if the animal is carried off-lane on a bike; the tray parks on the closed ring so it may never happen, but the guard is `hanRider < 0 &&` so it is fine — noted, not a bug.
- hanoi.js:2859 — the cầu `tick` cue fires when `k < dt*2`, which at a backgrounded-tab dt can be most of a leg; harmless.

---

## REUSABLE MACHINERY CATALOGUE

What any chapter can tap for a new wow moment. "Where" is the contract point a chapter must satisfy; "users" are verified by grep unless marked.

| name | what it gives | where it lives | which chapters use it today |
|---|---|---|---|
| **Carrier / passenger contract** | Stand on a moving thing and be carried exactly, hop off it and keep its velocity for 1.2 s. Rules: kinematic body, `velocity = (target − prevTarget)/dt`, never assign position; publish `carryFrame()` → `{x,z}` (horizontal only); a deck needs rails; endpoints checked against statics. | capybara.js `capyCarryAt` :2378-2386 (reads `api.carryFrame()`); frame solve :4779-4846; `capyPLAT_COYOTE`/`capyPLAT_AIR` :381-382; `capy.rideBody` :3990-3996; CONTRACT.md "A KINEMATIC CARRIER". Exemplars: monaco.js:2613-2623, hanoi.js:1924-1940 | quay ferry, venice gondola, kowloon star ferry + neon sign, goreme basket, palawan bangka + manta, cali chiva, rio bonde + cable car, iceland snowcat, sahara caravan, drift islands, antarctic (helm), hong kong lion, venice volo, monaco cars + wheel, hanoi scooter tray |
| **Reference frames (wind / current)** | A frame the animal is *in* — added after the movement solve, survives the speed cap, never deletes steering. `api.wind()` → `{x,z}` (clamped ±12); `api.flow(x,z,depth)` for water. | capybara.js `capyWindAt` :2307-2317, `capyFlowAt` :2336, summed at :5078-5096; memory `capy3-reference-frames` | drift wind, goreme wind, kyoto Uji current, manly bore (flow); neither Monaco nor Hanoi publishes either |
| **External forces** | `capy.launch(vx,vy,vz)` = thrown (clears frame, lifts 0.30 m, refuses ground for 0.2 s). `capy.shove(dvx,dvz)` = leaned on (survives the λ-60 grip damper; a velocity *increment*, never a one-shot in the air). A bare `body.velocity` write from a biome is deleted. | capybara.js `launch` :4191-4212, `shove` :4232-4236, applied :5115; memory `capy3-external-forces-on-the-capybara` | launch: iceland geyser, cali cable, manly wave; shove: sahara sandstorm, hanoi clip (hanoi.js:1678), props barge (props.js:5549, :5979) |
| **Herd / followers** | Wheek to recruit a chapter's animals into a trail-following line: `game.herdOffer({biome, kind, obey 1-3, voice, count(), at(i,out), put(i,x,z,yaw), lift?, span?, stow?})`. 21 s hold per wheek, 7.5 s tier decay, cap 14, perch on the back (`lift`), stowaway across a border (`stow`). Register from an *update*, not a build. | systems.js `game.herdOffer` :30878-30905, `herdHOLD/herdHEARD_T` :30540-30541, `herdUpdate` :31022, `herdCount/herdDebug` :30915/:30936; native trail exemplar pantanal.js `panUpdateHerd` :3122, `panTrailPush` :3089 | sydney ibis, iceland sheep, venice pigeon, pantanal cow, antarctic gentoo, goreme cat, manly gull, kyoto heron. **Monaco and Hanoi offer nothing** (no `herdOffer` in either file) — Hanoi's lake gulls/dogs do not exist as meshes; Monaco has no animal at all |
| **Climb hook** | `api.climbHold(x,y,z)` → `{nx,nz,top}` = an authored lattice; on a property miss the generic ray-against-statics climb applies (v31), so every chapter's near-vertical static face is a hold. Climb rate 3.05 m/s (`capyCLIMB_UP` :184); refuses anything with mass and anything that is a carrier. | capybara.js `capyClimbAt` :2138-2166, `capyClimbProbe`/generic cast :2167-2275 | published: kowloon.js:4703, cave.js:4448, goreme.js:610; generic: everyone else, including both of these chapters |
| **groundSlip / surfacePitch** | `api.groundSlip(x,z)` → 0..1 (0.3+ turns the idle grip off; a slide state); `surfacePitch` for the render pose. | capybara.js :89, `capyAskNum('groundSlip')` :2110, :2577 | iceland, antarctic (0.66 ice, systems.js:25544), monaco marble 0.30 (monaco.js:771), hanoi lake steps 0.22 (hanoi.js:543), others |
| **Thermals / flier** | A chapter becomes a condor host by publishing `thermals` (array or getter of columns) and optionally `flier: {plume, tasks: {summon, ride, peak}}` + `bounds()`; the bird, the talon grab, the flight rig, the altimeter all follow the host. Hold style `hold: 'talons'`. | condor.js `condorHost` :2543-2553, `condorHostThermals` :2578, `condorTaskId` :2560-2576, api `game.condor` :507-559 | pasto (pasto.js:3166), rio fragata (second flier) |
| **Dive / water as a property** | `api.canDive` true/false wins; otherwise measured: water − `terrainHeight` ≥ 1.75 m (`capyDIVE_MIN_D` :283) and the dive levels 0.55 m off the bed. Hold to stay down, tap to take things. | capybara.js `capyCanDive` :2421-2426, `capyWaterY` :250-283, dive state :5009-5028 | explicit true: palawan, monaco (monaco.js:4525), hanoi (hanoi.js:3596); measured: any chapter with a modelled bed |
| **Beat-judged floor** | A move (direction change, hop, wheek) inside `caliBEAT_WINDOW` (0.19 beat) of the live score's beat, with a mercy widening; reads `game.music.beats()` (float, fractional part = phase), `beatLen`, `beatInBar()`. | cali.js `caliUpdateDance` :3649, window :68, mercy :98-99, :3644-3646; music surface cali.js:2174-2179; systems.js `game.music` :31816 | cali only (verified); rio's samba column uses the same `beats()` for the drums, dance-judging unverified |
| **Chase by last-seen** | Pursuers with home/state/lastSeen records: see → run at 5.9 m/s to the animal, lose sight → run to last-seen at 0.72×, catch radius 1.5 m, near-miss latch at 4.2 m, drift home after; rearm timer. Sydney's articulated cast has the richer version (`chase`/`flee`/`retrieve`/`carry` in `stepHuman`). | sahara.js `sahUpdateChase` :1985, record layout :153, `sahPUR_SPEED/CATCH` :82-83, `sahPUR_MISS_R` :159; npc.js `stepHuman` :7962, `setState(rec,'chase')` :7731 | sahara traders, sydney gardener + cast; Pasto cast shares `stepHuman` |
| **Traffic medium (centreline worlds)** | A polyline is the road, the kerbs, the setback, the crossing test and the vehicles' rail. `laneAt(x,z)` distance field + `laneAtS(L,s)` sampling; per-vehicle float records, instanced draw, per-vehicle see/swerve/brake; a curvature speed law for fast movers. | hanoi.js `hanLaneAt` :456, `hanLaneAtS` :426, `hanUpdateBikes` :1527, record :194; monaco.js `monTrackAt` :617, `monCarTarget` :2584; memory `capy3-centreline-worlds` | hanoi (240 scooters), monaco (3 cars), cali chiva road, kyoto Uji run (same pattern, different movers) |
| **Frame shot** | A chapter frames its own marquee: `game.frameShot({yaw, dist, pitch, raise, hold, w, near, over})`; eases in/out, any player camera input kills it, weighted to nothing under helm/flight/ride unless `over:true`. | systems.js `game.frameShot` :30343-30389 | monaco tunnel (monaco.js:3841), hanoi train (hanoi.js:2269), antarctic orca, pasto condor, sydney podium (systems.js:21388), arrival shot :572 |
| **The lift / the middle rung** | `wow:` on exactly one task per chapter → banner + three sustained voices + palette-shaped arpeggio; `mini:` (≤2/chapter) → moment card + half swell + 18 scraps. `game.music.swell(k)` holds a build when called every frame. | systems.js `completeTask` :25803, `showMoment` :21197, `musSwell` :13738 via `game.music.swell` :31854; TASKS flags shared.js:2988-3026 | every chapter; monaco: wow the-tunnel, minis the-wheel/the-hairpin; hanoi: wow the-train, minis ride-the-flow/the-stools |
| **Locals rig** | `game.addLocal({biome,x,z,y,figure,face,near,cool,lines[{t,before,after}],wheek,onTask,praise,beat{kind,every,dur,sfx,tool}})`; `addTraveller` (the recurring one); `addExchange({a,b,gap,lines})`; barge flinch + line; witness look. | npc.js `addLocal` :2323-2365, `addTraveller` :2312, `addExchange` :4748, barge :4155-4175; wired in main.js:1885-1888 | 19 chapters; monaco ×7 (monaco.js:3950-4044), hanoi ×10 (hanoi.js:3075-3205) |
| **Crowd bodies** | `game.addCrowdBodies({n, at(i,out), moving, y})` → static compound (one broadphase entry) or one box per walker with `handle.step()`. npc-sized box on `game.mats.npc`. | props.js :1801-1830 (`physAddCrowdBodies` :1718); main.js:1842 | rio, kowloon, sahara, monaco watchers (monaco.js:3191), hanoi folk (hanoi.js:2926) |
| **Positioned continuous voice** | `game.sfxMover(name, {key, near, far})` → handle with `.at()`, `.vel()` (Doppler), `.set()`, `.amp()`. | systems.js `game.sfxMover` :30443; memory `capy3-the-mover` | monaco v8 (monaco.js:2655), hanoi three two-strokes + traffic bed (hanoi.js:1476, :1506), manly flock |
| **Music heat** | A chapter publishes `heat()` 0..1 and the band arrangement follows it. | systems.js :36765-36773 reads `game.monaco.heat`; monaco.js:4565-4580 | monaco only (the Bond palette); hanoi publishes `inTraffic()` :3650 (read by the score per its comment — unverified) |

**The cross-chapter point for these two chapters:** neither Monaco nor Hanoi publishes `herdOffer`, `climbHold`, `wind`, `flow` or `thermals`, and neither has a single T3 actor. Both sit on the *carrier* rung (cars, wheel, tray) and the *field* rung (the eye, the flow). The cheapest lifts are the ones the catalogue already pays for: a pit boss on the sahara chase records, riders that see riders, and a train roof that uses the carrier contract the tray already honours.
