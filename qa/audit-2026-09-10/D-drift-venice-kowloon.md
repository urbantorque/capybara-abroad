# Audit D — chapters 9 The Drift, 10 Venice, 11 Hong Kong (Mong Kok)

Read-only. All line numbers are against the working tree at commit 1e207ac (10 Sep 2026).
Screenshots looked at: `qa/B2-09-drift.png`, `qa/B2-10-venice.png`, `qa/B2-11-kowloon.png`.
`game.sfx` places a sound only when `at:` is passed (`systems.js:17052-17053`); a call without it is
unplaced and plays at its stated volume from anywhere in the chapter — several flags below rest on that.

Common shape of all three marquees (worth saying once): every one is a **stationary trigger or a
stat-check whose payoff is a scripted spectacle**. The lantern is E + a count; San Marco is "be in
the zone inside an 18 s window"; the Symphony is "be above y 26 during a 39 s window". The chapter's
real verbs (puff/column/seed, passerelle/traghetto-lean, bamboo climb) all happen BEFORE the moment,
never in it. The lift/banner/confetti/slow-mo in `systems.js:25841-25866` then does the same thing in
all three. That is the single biggest lever this review found.

---

## Chapter 9 — The Drift (`src/drift.js`, 5,703 lines)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| lampflies | 46 (`driFLY_N` :100) | **T3** (3-state) | asleep / following / lit-in-place. Wheek within 9.5 m (`driWAKE_R` :97, grown by the calm registry `addCritter` :4697-4699) wakes ≤4 per shout :4713-4737; followers orbit the animal as a loose constellation :4747-4756; sleepers lift away from the animal inside 3.6 m :4784-4794; all light where they stand when the lantern takes :4894-4899 | yes — proximity, wheek, calm | `driUpdateLampflies` :4692-4839 |
| wandering islands | 3 (`driWANDER` :189, 3 entries) | T1 carrier | cosine path with derivative velocity so the deck is an honest frame :4612-4625; kinematic box :1096-1105; bell rings at each turn, volume by distance :4634-4647; 6 s aboard ticks `wander-isle` :4655-4664 | only as a platform + bell falloff | `driUpdateWanderers` :4608-4666 |
| skein of long birds | 17 (`driSKEIN_N` :3945) | T2 | crosses the sky every 96 s for 62 s, 620 m span, always out of reach :3946-3948; scatters and re-forms on a wheek within 150 m :3981-3993, :4034-4041; summoned by the lantern :4886-4892 | wheek only | `driUpdateSkein` :3973-4068 |
| roost birds at the Arch | 11 (`driROOST_N` :3607) | T2 | flush on a wheek within 22 m (`driROOST_HEAR` :3612) and trickle back over 6 s in index order :3653-3735 | wheek only | `driUpdateRoost` :3653-3735 |
| the two keepers (Orchard, Crown) | 2 | T2 (locals rig) | `game.addLocal` :5362-5399, :5401-5439; lines gated on `lampflies()`/`lit()` via `when:`; wheek lines; onTask lines | proximity, wheek, task | npc.js localsStep |
| the six travellers (jetty, survey, winch, sleeper, reader, crosser) | 6 (`driTRAVELLERS` :2565-2700ish) | T2 (locals rig) | registered :5445-5449; `beat` jobs (rock, work) :2572, :2626; the wind-reader's first four lines are rewritten every 1.4 s from the live wind :2847-2881; her vane node turns with inertia :2849-2856 | proximity, wheek, task | `driUpdateTravellers` :2847-2881 + npc.js |
| weathervane on the Shelf | 1 | T1 | `driVaneGroup.rotation.y = atan2(windX, windZ)` :5601; standing at it for a sign change ticks `weathervane` :3862-3913 | position (task) | `driCheckVane` :3862-3913 |
| seed-heads | 5 (`driSEED_N` :4218) | T1 + grabbable carrier | drift on the wind, sink 0.55 m/s :4298-4309; E within 3 m grabs, vertical velocity clamped to −0.55 while held :4353-4358; 50 m path length ticks `driftseed` (mini) :4371-4380 | grab | `driUpdateSeeds` :4282-4390 |
| updraft columns | 2 (`driCOLS` :203) | invisible physics | lift toward `driCOL_LIFT·s` :4448-4451; shelter from the wind ×0.2 inside :4427; stone ring glows and a hiss/chime on entry :4437-4446 | position | `driUpdateColumns` :4402-4488 |
| the cloud sea | 1 | T1 + reactive surface | ripples at 30 Hz :5518-5560; bloom (rescue column) gathers under the animal after `driBLOOM_WAIT` :4527-4533 and follows it :4415-4419; a wheek in the cloud sends a wave ring out :4507-4520 | wheek, being in it | `driUpdateCloud` :4489-4548, update body :5518-5560 |
| airfield rocks | 280 (`driAIR_N` :2221) | T1 | carried on the wind, wrap round the player on an 80 m box, refuse steps into islands :4989-5052 | none (wrap centre only) | `driUpdateAirfield` |
| motes 150 / wisps 48 / banks 46 / column motes / ribbons / pennants / stars 300 | :101, :104, :2145, :103 | T1 | ambient loops; ribbons' opacity rides `driGlow` :5269-5283; banks thin with the wind :5054 | none | `driUpdateMotes/Wisps/Banks/Ribbons/Pennants/ColumnMotes` |
| beacon marks | ~20 (`driBEACON` pushed per island) | T1 system | cold until a 55 m/s front from the lantern passes :3769-3792; Long Gap posts flare on a crossing :4576 | via tasks | `driUpdateBeacons` :3769-3792 |
| far horizon lamps | (`driFARLAMP`) | T1 | answer the lantern one at a time over 22 s :3042-3070 | no | `driAnswerTheLantern` |
| embers at the lantern | 40 (`driEMBER_N` :259) | T1 | lean downwind as they climb :4920-4938 | no | inside `driUpdateLantern` |
| flora, isles, roots, camps furniture, croft | — | T0 | merged meshes | no | none |

**Summary.** T0: islands, flora, furniture. T1: 13 classes (wanderers, seeds, airfield, motes, wisps, banks, ribbons, pennants, vane, embers, beacons, far lamps, cloud). T2: 8 locals, skein, roost = 10. T3: lampflies (one class). T4: none — the lampflies→lantern→beacons→skein→far-lamps chain is a scripted cascade, not NPC↔NPC. **Things that acknowledge the capybara: ~12** (8 locals, lampflies, skein, roost, cloud-whoop; the column ring and the wanderer bell are position/distance effects). Most complex behaviour: the lampflies (three states + calm-registry reach), then the seed-head as a grabbable wind-carrier.

### 2. Scene completeness

`B2-09-drift.png`: spawn island in dark green with tuft grass, the jetty, the croft, a purple crag, one bright lit stone; fog closes at ~40 m so the archipelago is not visible from the arrival frame — the chapter's premise (thirty islands, `driISLES` :112, 30 entries) is invisible at spawn. Density on the islands is fine; the sky is where the chapter is thin.

Missing / placeholder:
- **The wind is never drawn.** It is the whole mechanic and its only visible carriers are the motes, the embers (:4926) and two vanes. No streaks, no fluff rain at the turn, no cloth on the travellers' camps that moves (`driPENNANTS` :218 exist but are on poles).
- Nothing lives in the void except the skein (deliberately unreachable) and the 11 roost birds. The cloud sea has no life under it and nothing on it.
- The far ranks are decks-with-a-crag-and-trees (`driBuildFarDressing` :2918) — acceptable as silhouette, but the wandering islands are the only moving scenery in a 300 m world.
- Open in the roadmaps and still true: `ROADMAP-DELIGHT.md:237` "ambience rows for Drift" not done; `ROADMAP-FINISH.md:268` the Drift's ambience is thin — `driUpdateBreathSound/ColumnSound/CampSound` exist (:5089-5187) so "thin" not "absent"; `ROADMAP-FUN.md:805` first tick at 0.7 s but a 70.5 s longest quiet run. `ROADMAP-PHYSICS.md:665` (props fell too fast in the Drift) — unverified whether closed.

### 3. Marquee / wow

- **Task:** `lantern` (`shared.js:2722`, `wow: 'THE DRIFT'`); CHAPTERS marquee point `{36,-190,up 8}` "the plinth at the top of the world, and it is unlit" (`shared.js:3225`). Mini: `driftseed` (`shared.js:2724`).
- **Mechanic:** stand within 7.5 m of the plinth, press E, need 6 lampflies awake (`driFLIES_NEED` :96) — `driUpdateLantern` :4839-4903. On success: `frameShot` 16 m/10°, held 7 s (:4876-4879); the beacon front runs back down the route at 55 m/s (:3773, :4886); the skein is called (:4887-4892); every lampfly in the world lights (:4894-4899); ribbons come up on `driGlow` (:5269); the horizon lamps answer over 22 s (:3042); `skyward()` cranes the camera full for 12 s then 0.36 for ever (:5541-5544); the shared lift (`systems.js:25841-25866`) adds banner, swell, confetti, punch, slow-mo. `driLit` survives travel; re-entry snaps the ending to done (:5484-5493).
- **Verdict:** stationary trigger + stat-check (six flies) + a 7-second cutscene. No new verb IN the moment. The payoff is the best-designed of the three chapters' (the whole chapter lights up in the order you walked it), but the player's contribution at the moment is one key. Repeat path: none (once). Fail: none.
- **Rating: 3/5** as a wow moment (against the ferry helm/condor/dive). The chapter's *verb suite* — puff (:4148-4207), columns (:4402), the wind as a reference frame (`wind()` :5522-5526, airControl 0.64 :5531), the wait-for-the-turn Long Gap (:4550-4605) — is 4/5 as movement design, but none of it is the marquee.
- **Latent big moments, underexploited:** (a) **the seed-head ride** (mini) is the only genuinely new dynamic in the chapter — hanging off a wind-carried object at a fifth of a gravity — and it is five random seeds in a band y 16–46 (:4218-4223) with no authored route; most players will never find 50 m of it. (b) the 26 m column ride is felt only as a velocity; (c) `wander-isle` is 6 s of standing; (d) the cloud-whoop wave (:4507) is a lovely reaction with no task or use; (e) the skein scatter is the biggest thing in the sky the player can cause and nobody is told.

### 4. Recommendations

**NPC / behaviour**
1. **Put somebody ON a wandering island** (the surveyor's "which one?" joke already points at it, :2604-2607). Register a local whose `group` is parented under `driMovers[i].mesh` and update `rec.x/z` each frame from the mover (the rig copies x/z once at registration, `npc.js:2337-2339`, so a moving local needs the `trav` path or a per-frame write). The island arriving at the Long Gap then brings a person who talks. **S/M, high** — it is the one place in the chapter a person moves.
2. **Make the roost birds a flock** via `game.flockOffer` (`systems.js:30630`) with `scare = ` the existing flush; they then come to a dropped prop and can be run through, on the same three functions Venice's pigeons hand over (`venice.js:2800-2815`). **S, medium.**
3. **The lampflies as a herd** via `game.herdOffer` (`systems.js:30855`) with `obey: 1`, keeping the bespoke constellation as the `put` writer. Buys the perch (a lampfly on the head), the stowaway (a lampfly that leaves the chapter with you), the herd count instrument, and the hold-timer contract — for the price of three accessors. **M, high** (the herd is the game's best-tested follower system and this is the chapter with the most follow-able thing in it).
4. Give two travellers a two-point walk (the surveyor between two survey marks, the winch man to the hoist and back) using the locals' `trav`/beat machinery rather than a new state machine. **S, low-medium.**

**The wow — ONE change (M):** *the lamp-lit descent.* Lighting the lantern is the END of the climb; make it the START of the chapter's only ride. On `driLit`, (i) respawn one seed-head at the plinth (`driSeedRespawn` :4271 with a fixed position), (ii) lock `driWindAng` for 60 s to a bearing that runs from the Crown back down the arrival route at `driWIND_MAX` (the surveyor's dotted line, :2620), (iii) keep the beacon front and the lampflies lighting the islands under the player, (iv) file a `lamp-run` record on `driSeedRide`. The player grabs the seed and steers (airControl 0.64 + the puff as course correction, :4165-4190) a two-hundred-metre descent through their own lit archipelago and lands on the Shelf where they began. New verb: **steer a wind-carried fall**. Every piece exists (`driUpdateSeeds`, `driUpdateWind`, `driBeaconWave`, `skyward`); the work is the wind override and the guaranteed seed. Turns the mini into the marquee's second half and gives `driftseed` a route.

**Scene**
1. **Draw the wind**: one instanced ribbon/streak mesh oriented along `driWindX/Z`, opacity ∝ |wind|, wrapped on the mote box (`driUpdateMotes` :5188 pattern). **S.** (Memory: "the wind nobody draws".)
2. **Something under the cloud**: two or three large dark silhouettes moving slowly beneath the sheet (a shadow on the underside of the cloud, T1 orbit at y −6), visible from every island lip. Gives the void a floor with life on it. **S/M.**
3. Fluff falls at the turn: when `|swing| < 0.13` (the slack test :3895) release a burst of seed-fluff from the nearest isle's tufts — the same `driRingT` burst the vane already fires (:3897-3900), scaled up. **S.**

**Bugs / regressions noticed**
- `drift.js:3796` — `driSfx` has no try/catch, unlike `venSfx` (:4700) and `hkSfx` (:4352). A synth throw here lands in `systems.update` and drops the module (memory: module-drop failure).
- `drift.js:4713` — the wheek wakes lampflies only while `capy.grounded`; a mid-air wheek is consumed as a puff (:4159-4162) and wakes nothing even inside 9.5 m. Probably design, but the orchard is reached by hopping and the first wheek most players make there is airborne.
- `drift.js:5480, 5484` — `driWasGrounded = true` written twice in `onEnter`. Cosmetic.

---

## Chapter 10 — Venice (`src/venice.js`, 6,270 lines)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| pigeons | 180 (`venPIGEON_N` :181) | **T4** | flee at speed > 2.6 inside 5.2 m (:2820-2830, calm registry :2720); take off and WHEEL as one ring when the square is wet (:2861-2896); peck/step/turn clocks (:2902-2921); walk to the seed man's throw (:2926-2942); scared by the Orologio strike (:1905) and the Volo's 12 m bow-wave (:4436-4447); `herdOffer` obey 1 with perch + stowaway (:2737-2790); `flockOffer` for dropped food (:2800-2815); rungs at 18/45/90/140 up (:221, :3066); `pigeon-storm` ticks at ≥40 while dry (:3092-3095) | yes — speed, wheek (herd), dropped props, and three other actors | `venUpdatePigeons` :2715-3150 |
| crowd | 48 (`venCROWD_N` :5882) | **T4** | 4-state ladder WALK/TOBOARD/ONBOARD/WADE driven by the tide (:6062-6075); single file on the duckboard centreline in fixed slots (:6079-6089); wade for the arcade (:6108-6118); gawp at the campanile, or the Volo, or the capybara inside 12 m (:6154-6162, `venLOOK_R` :253); pushed out of the way inside 2 m (:6178-6185); one box each via `addCrowdBodies` (:5987) EXCEPT on the planks (:6001-6003); murmur level (:6231-6247); cheer the Volo once (:6262-6269) | yes — look + push | `venUpdateCrowd` :6039-6270 |
| locals: waiter, well man, gondolier, violinist, passerelle crew, seed man, mask-maker, greengrocer | 8 `addLocal` calls | T2 | :5617, :5648, :5669, :5700, :5724, :5749, :5767, :5790; every one has tide-gated lines (`venDry/venComing/venHigh/venGoneOut`), wheek lines, onTask lines; beats (rock :5672, reach :5727, work :5770); three exchanges (:5823-5843); the crew answers the siren (:4841-4849); the violinist's bow goes up on the downbeat (:4771) | proximity, wheek, task | npc.js localsStep |
| gondola (+ merged gondolier) | 1 | T1 carrier | kinematic along the canal, velocity from target (:3493-3527); oar stroke asymmetric (:3538-3546); 'Òoi' at the Rialto (:4789-4800); 4.5 s aboard ticks `gondola-ride` (:3558-3574) | platform only | `venUpdateGondola` |
| traghetto | 1 | T1 carrier | 9.5 s across, 7 s alongside (:3307-3308); roll SHOVES the passenger (:3466-3474) so standing is a skill; `traghetto` mini ticks on the far bank (:3480-3491) | platform + lean | `venUpdateTraghetto` :3432-3478 |
| Volo cradle | 1 | T1 carrier / on rails | 4 phases 15/12.5/3/10 s (:4247-4250, :4387-4425); E starts it early (:4390); no biome-side writes to the passenger (:4458-4479); coriandoli; `volo` mini | E to start; pigeons/crowd react to IT | `venUpdateVolo` :4379-4540 |
| seed man's throw | 30 grains (`venSEED_N` :3127) | T1 | every 10–17 s while dry (:3163-3175); pigeons walk to it | no | `venUpdateSeed` |
| Orologio clock, two Moors | 1 | T1 | hands ride the tide phase; strikes on the hour with a positioned-by-distance chime and a pigeon scare (:1875-1934) | no | `venUpdateOrologio` |
| flags + the campanile angel | n×6 seg + 1 | T1 | gust rises before the siren (:3855-3862); the angel is a lagging weathervane (:3892-3899) | no | `venUpdateFlags` |
| flotsam | 12 (:3940) | T1 | at high water only (:3967-3991) | no | `venUpdateFlotsam` |
| duckboards | 1 chain | T1 kinematic | rise/fall with the tide (:4857-4870) | run timed :5093-5140 | in `venUpdateTide` |
| fruit barge, two topi | 3 | T1 | ride the tide (comment :2389) — unverified update | no | — |
| water sheet, lagoon | 2 | T1 | colour and opacity from tide (:4894-4896), 30 Hz swell (:4915-4925) | swim | `venUpdateTide` |
| Florian orchestra (sound) | — | T1 | 4-note figure, slower and a tone flat when wet (:4755-4780) | distance only | `venUpdateVoices` |
| far city, buildings, arcades, briccole | — | T0 | | | |

**Summary.** T0: the city. T1: gondola, traghetto, Volo, seed throw, clock, flags/angel, flotsam, boards, barge, water. T2: 8 locals. T3: none per-person. T4: pigeons and crowd — both read the tide, the Volo, and each other's triggers. **Things that acknowledge the capybara: 11** (8 locals, pigeons, crowd, the well echo :4549-4580). Most complex: the pigeons — seven distinct stimuli and three offers to shared systems; the richest animate class in the three chapters.

### 2. Scene completeness

`B2-10-venice.png`: the two columns, the arcade, 48 people, the Basilica end; the frame is very washed (haze + near-pale on the trachyte). It reads as the place.

Missing / placeholder:
- **The Grand Canal and the Bacino have no traffic.** One gondola, one traghetto, one moored barge. `venice.js:1748` admits it: "vaporetto in the lagoon, and this square did not have one you could see." No water taxis, no vaporetto, no delivery boats, no gulls — Venice's gulls are as famous as its pigeons and would steal the spritz.
- Florian's is tables and a spritz; the waiter's line "the chairs go up at ten centimetres" (:5628) describes something the café never does.
- The calli maze has one mask-maker; shopfronts are unverified as boxes (`venBuildCalli` :2012, not read in full).
- Still open from the roadmaps, verified against code: `ROADMAP-FINISH.md:759` "Venice's duckboard queue made bargeable (the chapter's best domino is unreachable)" — still true: `venCrowdFoot` returns false for ONBOARD/TOBOARD (:6001-6003) and the only reaction to the animal is a 2 m position nudge (:6178-6185); nobody on a plank can be knocked in. `ROADMAP-BEAUTY.md:45` Piazzetta near stone — the beauty pass added `nearPale`; not re-measured here (unverified). `ROADMAP-FINISH.md:210` said `nextIn` returned −1 for `acqua-alta` — **fixed**, :5331-5344 walks the phase forward through `venTideY`.

### 3. Marquee / wow

- **Task:** `acqua-alta` (`shared.js:2752`, `wow: 'SAN MARCO'`); marquee point `{-4,-35,up 7}` "this square, and the sea is coming up through it" (`shared.js:3235`). Minis: `traghetto`, `volo` (:2756, :2761).
- **Mechanic:** a 205 s tide (`venTIDE_PERIOD` :145), siren at phase 0.30 (:4834-4841), levels square 0 / Molo 1.0 / calli 1.3 / fondamente 1.55 so the flood is a route change (memory). The front crossing `isOverWater(0,-34)` opens an 18 s window (`venFLOOD_GRACE` :254, :4949-4960); being in zone `square` inside it ticks (:4999-5027): positioned splash, `punch(0.16)`, `frameShot` 3.6 s looking north at the Basilica (:5019-5023). While it happens: the sheet goes pale (:4894), 180 birds wheel (:2880), 48 people file onto the boards (:6079), the orchestra plays on a tone flat (:4767-4771), lamps come on (:4939), the score swells to 0.72 in the square (:4926-4931), `nextIn` counts it down on the card.
- **Verdict:** a **be-there stat-check whose payoff is weather**. Nothing is done by the player; they stand in a square. But it is the most *systemic* of the three marquees — the crowd, the birds, the band, the boards and the routes all change state — and it recurs every 205 s, so the spectacle is re-watchable even though the tick is once.
- **Rating: 3/5** as a wow (no verb, no risk, a 3.6 s framed shot). 4/5 as spectacle. The chapter's actual skill inputs are the timed passerelle run (:5093-5140), the traghetto lean (:3466-3474 — the only physical balance input in the chapter), and the Rialto sprint record (:5154-5199).
- **Latent big moments:** (a) **the Volo** is the biggest physical thing here — a 32 m winch, a 40 m wire crossing the square at head height, the whole crowd turning to follow it (:6142-6145) and cheering (:6262), a pigeon bow-wave under it — and it is a mini. (b) the duckboard queue as a domino (blocked, above). (c) the well echo (:4549) — a lovely reaction nobody is sent to twice. (d) `mirror-swim` at the top of the tide is a swim across a colour, not a mirror (:4878-4897 explains why).

### 4. Recommendations

**NPC / behaviour**
1. **Unblock the domino.** Give ONBOARD crowd members bodies (drop the early-out at :6001-6003) but make them *yield*: a capybara at > 3 m/s inside 1 m tips the person into a new state SPLASH → WADE with a stagger (reuse the locals' `stum`/`sat` channels, `npc.js:2373-2382`, or the crowd's own WADE branch :6108), a placed `splash`, and a one-line shout from the crew local (`venCrewRec.anchor.speak`, the pattern at :4845-4847). The passerelle run then has people to barge and a cost for barging. **M, high** — `ROADMAP-FINISH` already calls it the chapter's best domino.
2. **Heads turn for the whole crowd**, not only gawpers: Kowloon's `look` (`kowloon.js:2634-2640`) in the WALK branch at :6154. **S, medium.** (`ROADMAP-FINISH.md:553` names Venice first for this.)
3. **Gulls** as a second flock over the Molo/Bacino via `game.flockOffer` (`systems.js:30630`) with the pigeon's three accessors as the template (:2800-2815); they come for a dropped spritz and can be put up off the columns. **M, high** for the Molo, which is the spawn and currently has only the crowd's edge.
4. **A vaporetto** on the Bacino as a carrier on the gondola/ferry pattern (velocity from previous target, :3505-3516) with a stop at the Molo, so the spawn frame has a large moving thing in it and the chapter gains a second ride. **M, high.**

**The wow — ONE change (M):** *the surge.* Make the water something that happens TO the animal physically. Publish a `flow()` on the Venice API for the ramp and the ebb — the reference-frame channel the Drift's `wind()` already uses (`drift.js:5522-5526`; capybara.js adds it to the platform velocity) and props.js's `physFlowAt` already uses for surf — 1.2–1.5 m/s down the square toward the Molo while `lvl` is 0.55–0.80, reversed on the ebb. `acqua-alta` becomes "be in San Marco when it goes under **and stay on your feet**": the front arrives, the paving becomes a river, the flotsam (:3967) and the pigeon ring drift with it, and the swim across the square (`mirror-swim`) becomes a swim against a current. New verb: **swim in moving water**. Everything downstream (crowd, birds, boards, band) already answers the same `lvl`. Effort is the frame publish + tuning the speed against the swim cap; the risk is the duckboard run, which must stay above the flow (it is, the planks clear `waterLevel + capySWIM_ENTER`).

**Scene**
1. Water traffic and gulls (above) — the Bacino is the biggest empty surface in the chapter.
2. **Florian's reacts to the tide**: raise the chairs/tables group by `venLampT` (:4933) as the waiter says they do; stack them under the arcade at high water. **S.**
3. **Lamp streaks on the flooded sheet** at high water: the wet-road anisotropic smear from Kowloon (`hkBuildWetRoad` :1731) applied to the square's sheet — `ROADMAP-DELIGHT.md:189` says it "comes free in Venice"; whether it was wired is unverified. **S** if the spill path exists.

**Bugs / regressions noticed**
- `venice.js:4414` — the Volo's `cheer` and `chime` at phase 3 are `force: true` and **unplaced**, fired on every 40.5 s cycle regardless of whether the animal is aboard or in the square; the crowd's own cheer (:6267) is placed and gated at 70 m, so near the square they double.
- `venice.js:3481` — `venTragArrive`'s `thud` is unplaced, every ~16.5 s, from anywhere in the chapter.
- `venice.js:6062-6075` — `coming` is true through the whole ebb (phase ≥ 0.30 and `lvl < 0.55` includes 0.78–1.0), so ONBOARD people cannot leave the planks until the phase wraps; between `venTIDE_FALL1 + 0.02` and the wrap (~4 s) the boards have dropped (:4859-4863) but ONBOARD figures are still drawn at plank height over dry paving (:6203). Cosmetic, brief.
- `venice.js:5894-5905` — crowd header says "no bodies (a crowd you can walk through is the right crowd)"; bodies exist (:5987). Stale comment only.

---

## Chapter 11 — Hong Kong / Mong Kok (`src/kowloon.js`, 5,292 lines)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| pavement crowd | 80 (`hkCROWD_N` :2512) | T2 (+T4-lite) | four lanes (:2571-2575); stop dead and turn inside 3.5 m of the animal (:2634-2640); wait at a red zebra (:2661-2668, clock :969); stop and face south with heads up during the show (:2660, :2686-2690); route round the dai pai dong (:2626-2629); one hand-moved STATIC box each (:2690-2701, :2695) | look + stop | `hkUpdateCrowd` :2615-2730 |
| locals: baker, fishmonger, pier man, rigger, scaffolder ON the deck, laundry, neon man, bus conductor, cook, seated diner | 10 `addLocal` calls | T2 | :4875, :4892, :4910, :4936, :4966 (y 11.66 on the second deck — the only local reached by climbing), :4992, :5012, :5029, :5048, :5076 (seated `group`); show-gated lines (`hkBefore/hkSoon/hkDuring/hkAfter/hkUpHigh`); beats (cleaver :4895, basket :4995, wok :5052); four exchanges (:5109-5138) | proximity, wheek, task | npc.js |
| bakery queue | 3 (`hkQ_N` :2126) | T1 | served every 12 s, front walks off and sinks out of frame, rejoins at the back (:2152-2198) | no | `hkUpdateQueue` |
| open-top bus | 1 | T1 carrier | 96 m run, 3 stops, dwell 5.5/7 s (:3778-3784); kinematic, velocity from target (:3906-3908); diesel `sfxMover` (:3915-3921); lurch when aboard (:3900); 14 s up top ticks `bus-top` mini (:3964-3969). No passengers (none in `hkBuildBus`, unverified beyond grep) | platform + lurch | `hkUpdateBus` :3879-3972 |
| southern lion | 1 | T1 carrier / on rails | 5-phase ~41 s cycle: rest 14 (head down = a ramp) → walk 3.5 → 8 leaps × 2 s → rear 4.5 → down 3.5 (:4146-4215); drum/cymbals/gong distance-gated (:4222-4232); firecrackers (:4241-4250); lettuce shreds; `choi-cheng` mini ticks if aboard any frame of the rear (:4207-4210) | platform; toast if not aboard (:4203) | `hkUpdateLion` :4146-4328 |
| Star Ferry | 1 | T1 carrier | 26 s each way, eased (:3320-3326); bell at berth (:4405-4416); wheek aboard under way = horn + `ferry-horn` (:3357-3366); crossing ticks `star-ferry` (:3368-3373) | wheek aboard | `hkUpdateFerry` :3318-3378 |
| junk | 1 | T1 | 132 s crossing, sails take the show's light (:3248-3276) | no | `hkUpdateJunk` |
| fish | 26 | T1 | flop on the floor for ever once released (:3711-3727; timer set to 999 :4470) | no | `hkUpdateFish` |
| zebra crossings | 2 (`hkCROSS_Z` :527) | T1 clock | red 21 s / green 6.5 s (:969); heads and ticks (:1018-1074) | no (crowd reacts to it) | `hkUpdateCrossing` |
| Symphony of Lights | 16 towers (`hkTOWER_N` :93) | world system | 152 s evening (:96); on 0.545–0.80 (:100-101); towers on the live audio beat with a stall fallback (:3496-3520); four movements (:152-154); reflections on the water (:3591-3607); lasers (:3609-3625); Kowloon-side sweeps (:3641-3653); crowd turns; neon breathes with it (:3637) | altitude gate for the tick | `hkUpdateShow` :3401-3708 |
| air-con drips | 32 (`hkDRIP_N` :5170) | T1 + one reaction | fall, ring, one placed voice; inside 0.9 m wets the coat (:5276-5284) | proximity (wet) | `hkUpdateDrip` :5211-5290 |
| dai pai dong flames/steam | 22 steam (:1808) | T1 | :2038-2070 | no | `hkUpdateDaiPaiDong` |
| neon signs (~90) + the big sign | — | T1 | breathe (:1687); the big sign swings when landed on, spring on its body (:4583-4605) | landing | in `hkUpdateTasks` |
| taxis | 3 parked (:857) | T0 | | | none |
| towers, tong lau, market goods, lit panes, clock tower | — | T0 | | | |

**Summary.** T0: buildings, taxis, goods. T1: queue, bus, lion, ferry, junk, fish, crossings, drips, steam, signs. T2: 10 locals + the crowd. T3: none. T4: none strictly; the crowd reads two world systems (crossing, show) and so is T4-lite. **Things that acknowledge the capybara: 13** (10 locals, crowd, the drip, the big sign). Most complex: the Symphony as a system (beat-locked to `game.music.beats()` with a wall-clock fallback, four movements, five light channels); among animate things, the lion (carrier + band + firecrackers).

### 2. Scene completeness

`B2-11-kowloon.png`: the best-dressed arrival of the three — neon, the bus, market goods, crowd, wet road, the hoardings. The street reads as Mong Kok.

Missing / placeholder:
- **No moving traffic on the road.** The densest street in the world has three parked taxis (`kowloon.js:763` "centre line, three parked taxis and nothing else at all") plus the bus and the lion. The empty lane at x −3.4 (:4074 comment) and the crossing clock are already there for it.
- **The harbour is one ferry and one junk.** No sampans, no container ship, no second ferry, no kites/birds over Victoria Harbour (grep: no bird/kite/gull in the file; the only "pigeon" is a loft on a roof :1338).
- The bus and the ferry carry nobody (no figures in `hkBuildBus`/`hkBuildFerry` by grep — unverified in full).
- Shops are lit panes (`hkBuildLitPanes` :1076); the bakery counter and the wet market are the only shopfronts with depth.
- Still open: `ROADMAP-BEAUTY.md:215` the reflection pucks under the signs are painted ellipses (open); `ROADMAP-PHYSICS.md:646` "Kowloon's stair walk plays inside a drawn-only awning" (on the shelf, unverified); `ROADMAP-PHYSICS.md:412` the invisible floor z 100–120 — **landed** (picture extended). `ROADMAP-FUN.md:807` first tick "never" in 90 s of wandering (needs E — a driver fact). `ROADMAP-FINISH.md:95-97` climb teaching via raw toast at `kowloon.js:4537` — **fixed**, now `hkSay` at :4520.

### 3. Marquee / wow

- **Task:** `symphony` (`shared.js:2783`, `wow: 'HONG KONG'`); marquee point `{-19.1,0,up 34}` "the roof at the top of the scaffold, and the towers from up there" (`shared.js:3249`). Minis: `bus-top`, `choi-cheng` (:2793, :2797). Find `missed-the-show` (`shared.js:3588`) pays the miss.
- **Mechanic:** reached by the **bamboo climb** — `hkClimbHold` :476-503 publishes a hold band through the wall to y 34.8; capybara.js solves stick-into-face = up, stamina, being blown takes the up and leaves the grip (memory). Two warnings, 36 s and 11 s out (:3411-3436). Ticks on ANY frame of the 39 s show with y > 26 (`hkSHOW_ROOF` :108, :3456-3462); `frameShot` 3.5 s yaw 0 at the skyline (:3473). The show itself is real-time-scored: one tower per beat of the live audio clock (:3496-3520), a wave, odds-against-evens, a finale with the only camera shake in the chapter (:3560-3567), positioned from the far shore (:3568-3570); `skyward` cranes (:3628-3634); the crowd below stops and faces the water (:2660).
- **Verdict:** the *climb* is a genuine new verb and real physics (4/5 on its own). The *show* is a watched spectacle — cutscene-grade, but honestly synchronised to the music rather than a timer, 39 s long, and recurring every 152 s. During it the player does nothing; the roof is a viewing platform.
- **Rating: 3/5** for the moment itself; **4/5** for climb + show taken as one arc, which is how the chapter is written (the show is the reason to climb, `shared.js:2772-2777`). It is the closest of the three to a real wow because the reward is EARNED by the new verb.
- **Latent big moments:** (a) the lion ride to 4 m and the choi cheng — a carrier that drops you if you don't hold on (:4207-4210 forgives a fall now); (b) the open top through the signs at head height (:3768-3774) — a ride with nothing to do; (c) the sign swing (:4583) is a lovely reaction; (d) the Kowloon-side searchlight sweeps (:3641-3653) are on their own clock and belong to nobody.

### 4. Recommendations

**NPC / behaviour**
1. **Traffic on Nathan Road** — port Hanoi's traffic medium (`hanoi.js`; memory "traffic as a medium") into the empty lane: red taxis and a green minibus, kinematic, stopping at `hkCrossGreen()` (:972) exactly as the crowd does (:2661-2668), horns replacing the off-map horn (:4384-4393). **L, highest impact in the chapter** — it is the one thing the arrival frame is missing.
2. **A reaction ladder for the crowd**: a barge at speed into a pedestrian does nothing but stop them (:2634). Promote the `look` into the locals' stagger/sit channels (`npc.js:2373-2382`, B11) for the six nearest, with a placed gasp; or register 6–8 of the 80 as `addLocal` with `group` so they get the whole vocabulary. **M, high.**
3. **Passengers**: 4 `hkSeatedFigure` (:2000) on the bus top and 6 on the ferry as `group` locals parented to `hkBusGroup`/`hkFerryGroup` so the rides have company and lines ("duck at the signs"). Caveat: the rig copies `rec.x/z` once (`npc.js:2337-2339`), so proximity would be tested at the spawn point unless the record is updated per frame — same fix as Drift rec. 1. **S/M, medium.**
4. **The lion's band as people**: the drummer, gong and cymbals at the foot of the poles are props; make them three locals with `beat` timed off `hkLionBeat` (:4226) so the drum you hear is a hand you see. **S, medium.**

**The wow — ONE change (S/M):** *conduct the harbour.* The show is already quantised to the beat (`step` :3496-3520) and split into movements; give the roof a voice in it. While `hkShowT ≥ 0` and the animal is above `hkSHOW_ROOF`, a wheek on the roof (a) in M1 lights the next tower NOW instead of on the next beat (snap `hkLitCount++` and re-zero `hkBeatAcc`), (b) in M2 sends the wave back from the player's end (`hkChase` reset to 0), (c) in M3 flips the odds/evens, and (d) the finale fires on the eighth wheek or on the clock, whichever first — with the Kowloon-side sweep (:3641) answering each wheek by pointing across the water. The far shore then answers the player, on the beat, from a roof they climbed to. New verb: **call-and-response on a live audio clock** — nothing else in the game does it, and it costs one input read inside a function that already owns all five light channels. (Alternative, M: a wire from the roof to the pier on the Volo rig pattern, `venice.js:4271-4426`, so the way DOWN is the payoff and you descend through the show.)

**Scene**
1. Moving traffic (above).
2. **Harbour life**: three or four black kites circling over the water on the Drift's skein loop (`drift.js:3973-4068` is portable), a second ferry on the far shore, one anchored ship with lights that join the show. **S/M.**
3. **Passengers and interiors**: bus/ferry passengers (above); two open shopfronts with depth and a mahjong-parlour window with silhouettes on the first floor — the tong lau are lit panes with nobody behind them. **S.**

**Bugs / regressions noticed**
- `kowloon.js:4199-4200` — the choi cheng's `chime` and `cheer` are `force: true` and **unplaced**, every ~41 s cycle from anywhere in the chapter (the ferry is 200 m away); the band (:4222-4232) and the firecrackers (:4241-4248) in the same sequence are distance-gated, so the loudest cue is the one that ignores distance.
- `kowloon.js:3885, 3899` — the bus door `pop`s are unplaced and ungated while the diesel mover (:3915-3921) is positioned; the doors are audible from the roof and the pier.
- `kowloon.js:2178` — the served customer exits by sinking through the pavement (`ty = -u*u*1.9`); fine from the street, visible from the scaffold decks and the bus top, which is where this chapter puts the player.

---

## Cross-chapter summary

| | Drift | Venice | Hong Kong |
|---|---|---|---|
| animate classes | 17 | 15 | 15 |
| T0 / T1 / T2 / T3 / T4 | many / 13 / 10 / 1 / 0 | city / 10 / 8 / 0 / 2 | many / 10 / 11 / 0 / 0 (+lite) |
| acknowledge the capybara | ~12 | 11 | 13 |
| deepest behaviour | lampflies (3-state) | pigeons (7 stimuli, herd+flock+perch) | crowd (look, crossing, show) |
| marquee type | trigger + stat-check + 7 s cutscene | be-there window + weather | altitude window + scored spectacle |
| verb IN the moment | none | none | none (the climb precedes it) |
| wow rating | 3 | 3 (spectacle 4) | 3 (arc 4) |
| ONE change | lamp-lit seed descent (M) | the surge — water as a frame (M) | conduct the harbour on the beat (S/M) |
| biggest scene gap | the wind is invisible | no boats, no gulls | no traffic, empty harbour |
| best reuse | herdOffer for lampflies | flockOffer for gulls; crowd stagger | Hanoi traffic; seated figures as locals |

Where the three are already strong and should not be padded: the Drift's movement suite and its lantern cascade; Venice's pigeons and tide-reading crowd; Hong Kong's climb, show synchronisation and its twelve-person street. None of the three needs more locals — each needs its marquee to ask for a verb, and two of them (Venice, Hong Kong) need their biggest empty surface (water, road) to move.
