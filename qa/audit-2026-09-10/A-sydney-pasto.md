# Audit A — Chapter 1 Sydney and Chapter 2 Pasto (the baseline)

Read-only pass, 10 Sep 2026. Files: `src/environment.js` (Sydney world, 3724 lines), `src/npc.js`
(13113 lines; Sydney cast lines ~965-8888, Pasto cast ~8889-10777, shared machinery elsewhere),
`src/pasto.js` (3282), `src/condor.js` (2811), `src/props.js` (Sydney scatter + Pasto stalls),
`src/systems.js` (opera-stage, lift, chaos), `src/shared.js` (TASKS 2455-2512, CHAPTERS 3104-3139).
All line numbers are from the current tree. Screenshots looked at: `qa/B2-01-sydney.png`, `qa/B2-02-pasto.png`.

One structural fact first, because it shapes everything below: **neither chapter uses the shared
`locals` rig.** `grep addLocal( src/environment.js src/pasto.js` returns nothing; npc.js says so
itself (`npc.js:3343-3352`: "SYDNEY AND PASTO ARE NOT LOCALS CHAPTERS AT ALL... their casts are this
module's own `humans` and `paCast`"). Both casts come out of `buildHuman` (`npc.js:6270`) and share
the instanced rig, the face (`npcMoodOf` `npc.js:8648`), bubbles, `pickLine` (`npc.js:5940`) and the
witness/heat/chat layers. That is why they are deeper than the other seventeen: they have a
hand-written state machine per kind rather than a generic T2 rig.

---

## CHAPTER 1 — SYDNEY

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| tourist | 11 (1 in 7 is a child, `npc.js:6344-6350`) | T3 | idle/wander between POIs, pairs off with a mate (`6734-6746`), holds hat/camera/coffee/handbag (`6749-6771`), photo state, startle→laugh-or-flee, flee bends seaward, cornered on sea wall, 1-in-6 plunge+swim+climb, fluster with a cup, retrieve stolen prop, queue at the van, gather at the finale | yes: vision cone+LOS (`seesCapy` 7253), wariness, heat | `thinkHuman` 7293 / `stepHuman` 7962 |
| commuter | 4 | T3 | same rig on the quay POIs; joins the Whippy queue (`7439`) | yes | same |
| "queue" kind | 4 | T3 (vestigial) | quay POIs, generic tourist logic. NOTE: excluded from the van queue test (`7439` tests tourist‖commuter only), gets no prop and no camera (`6751`) — the four people named `queue` never queue | yes | same |
| gardener | 2 | T4 | work (crouched, replants dug roses `replantNear` 7935 — writes prop bodies back to STATIC), wander between beds, chase at 5.4→7.0 m/s, CARRIES the capybara to the gate and dumps it (`8049-8093`, sets `game.capy.carriedBy`), calm/breath | yes: vision-gated on flowerbed/gardens zone (`7368-7373`, `7879-7895`) | same |
| jogger | 3 | T2/T3 | fixed 4-node loop `npcJOG_LOOP`, comic swerve + line + gasp inside 3 m (`8590-8600`), flees at 4.0 | yes | same |
| busker | 1 | T3 | `busk` state, strum sfx every 3.4-6.2 s (`8514`), his hat is a real owned prop = takings (`6783-6795`); robbed → chase/retrieve, `buskSad` pool afterwards | yes | same |
| patron | 5 | T4 | seated in pairs across a table, `diner` chatter, `standUp` when capybara is on their table (`8309`, `7663`), shoo/resit; look up and raise a hand when the waiter serves (`8393-8398`) | yes | same |
| waiter | 1 | T4 | counter→table→counter circuit with a 9 s ceiling, tray dip on delivery, pop sfx, line; triggers patrons' thanks | indirectly (startle only) | same, case `serve` 8368 |
| dog owner | 1 | T3 | idle at the boardwalk; startled + `dogCall` pool when the lead is cut (`11056-11060`) | yes | same |
| Murray (dog) | 1 | T3 | `qdStep` 11071: heel on a hard-clamped 1.9 m lead, lead cut by an action press or a barge within 1.45 m (`11094-11100`), bolt 5.2 m/s then roam + bark, nav-rejected | yes | `qdStep` 11071 |
| ibis | 6 | T4 | `thinkIbis` 7466: wander/flee/work; flee radius collapses 4→1.55 m when a bin is tipped so the feast is watchable; flock to any bin whose up-vector < 0.6 (reads prop bodies); feast squabble sfx scaled by count + toast (`ibisFeastStep` 7542); herd-recruitable obey 1, perches on the capybara, can stow away to the next chapter (`11727-11778`) | yes | `stepIbis` 8833 |
| gull mob | 8 | T4 | `qgStep` 11185: perch/dive/mob on chips the capybara has `disturbed`; pecks the prop body on a timer (`11261-11268`); records "how many on the chips at once" live; mugs any human within 3.5 m (`11293-11303`); cooldown 22 s | yes (causation via `disturbed`) | `qgStep` 11185 |
| lorikeets | `envLORI_N` per fig | T2 | flush on the rising edge of entering a canopy, or any wheek at 2.6× radius (`envLoriStep` 1741) | yes | `environment.js:1741` |
| Mr Whippy van | 1 | T1 carrier (+T4 via queue) | kinematic, velocity-driven along a route, 11 s dwell each end, diesel mover + Doppler chime (`envVanStep` 1221), ride record in metres; NPCs form a 3-deep queue and get cones (`vanQueue*` 6883-6930, case `queue` 8536) | ride only | `environment.js:1221` |
| ferry | 1 | T1 carrier | 6-node circuit, kinematic by velocity, 20 s berth dwell, `ferry:departed` once per voyage (`envFerryStep` 2174) | ride only | `environment.js:2174` |
| seaplane | 1 | T1 | 94 s taxi/run/circuit/land cycle with damped attitude, engine mover (`envPlaneStep` 1444) | no | `environment.js:1444` |
| harbour traffic | 11 hulls | T1 | cosine there-and-back, each with a kinematic body so a swimmer meets a hull (`envTrafStep` 2019) | no | `environment.js:2019` |
| sprinklers | n rotors | T2 | valve plate turns a rotor on under the capybara; `qsStep` 11317 soaks + startles any human in the spray, `finish('sprinkler')` | yes | `npc.js:11317`, `environment.js:1022` |
| clouds / glitter / ripple | — | T1 | drift, sun path, 30 Hz ripple (`envUpdate` 3472-3538) | no | `environment.js:3472` |
| duck pond | 1 | T0 | built at `environment.js:2512` — **no ducks exist** (grep for duck/swan/pelican finds none) | — | none |

Counts: T0 1 (pond), T1 5 classes (van, ferry, plane, 11 hulls, weather), T2 3 (joggers, lorikeets,
sprinklers), T3 6 kinds (tourist, commuter, queue, busker, owner, dog), T4 5 (gardener, patron+waiter,
ibis, gulls). **Every one of the 32 humans, 6 ibis, 8 gulls, the dog and the lorikeets acknowledge the
capybara** — 48+ animate things; only the van/ferry/plane/traffic do not.

Cross-cutting machinery that makes the acknowledgement systemic (all per-frame unless noted):
- staggered brain: 3 NPCs think per frame, everyone steps (`npc.js:11784-11792`)
- vision cone + distance falloff + LOS occlusion (`visionOf` 7236, `losClear` 7222) — nobody spots you through the colonnade
- `capy:wheek` (`7742-7768`): everyone within 20 m startles, 45% flee / rest laugh+point, ibis within 26 m flee
- `capy:grab` (`7770-7792`): prop ownership → `startChase`, busker vs tourist hat routed to different tasks
- `capy:graze` (`7810-7833`): nearest person within 7 m startles + shoo line + witness chain
- `prop:impact` (`7835-7877`): spilled coffee/icecream → owner `calm`+`dejected` 2.6 s + `coffee` line; any hard landing within 2.6 m startles
- `capy:dig` (`7879-7895`): gardeners chase if they can SEE it or are within 6 m
- body-check (`8028-8043`): >3.2 m/s within 1.45 m → `npcFumble` drops the cup with the capybara's momentum and stamps causation (`7696-7726`), else startle+stumble
- barge sweep on proximity (`npcBargeSweep` 4233; the collider hold-off means physics barges never fire on this cast, 4205-4231) → `npc:barge` → alarm, look, gasp, witness chain (4316-4322)
- `castReact` on `prop:destroy` / spill (`4122-4152`) — Sydney only (gated `biomeLive()`)
- wariness derived from alarm, decays over 26 s (`7979-7992`, `npcWARY_T` 1984), changes notice range and register (`7397-7418`)
- heat field: 6 sites, 32 m radius, 90 s decay (`npcHEAT_*` 3020-3064, `npcHeatBump` 3095) — raised by witnessed events, stretches look range and shortens notice cooldowns
- witness chain (`npcWitnessChain` 3560): 20 m (heat-scaled), every head turns for 2.6 s via `witT` re-asserted after the state machine (`npcWitnessHold` 3407), exactly one speaks
- incidents: three witnessed things → a line (`npcOnIncident` 4653, `systems.js:32617`)
- two-people-talking (`chatStep` 11586): opener/reply pairs, never periodic, one exchange in the world at a time
- lines resolve on task state (`after`/`before` in pools, `localResolve` 2549) so the crowd talks about what you did
- face/mood from state + alarm + grudge/dejection (`npcMoodOf` 8648)
- personal-space separation (`npcSeparate` 7126), nav rejection, the player as a thing to walk round (`npcBlockedFor` 6254)
- the finale gathering: 5 nearest walk to the lawn with a 30 s ceiling (`npcGather` 3469)
- per-state ceilings everywhere (wander 15 s, flee 3.5, cornered 5, resit 9, retrieve 12, queue 26, serve 9, swim 12) — the "catch-all state" rule

Most complex behaviour: the tourist startle tree — startled → (holds drink? fluster : flee) → flee bent
seaward → cornered on the coping (edging sideways, shoved in at 2.24 m/s) → plunge under integrated
gravity with splash on the waterline → swim → diagonal climb-out → dejected calm (`8096-8289`).
Second: the gardener carry (a real carrier contract on the player).

### 2. Scene completeness

Screenshot (`qa/B2-01-sydney.png`): spawn lawn, five people in frame, the Opera House shells with a
red podium rectangle dressed with two cones, a bin and a white blob; a kiosk/table left, a fountain
right, a jacaranda, a bench. Reads as a park; the sails carry the whole shot.

Density is fine in the gardens (hedges, 13 figs, benches, sprinklers, blossom decals, tufts,
`environment.js:2819-3372`) and the quay precinct is complete for its size (boardwalk, steps, terrace,
colonnade, wharf, bollards, lamps `786-970`, `2558-2650`). Gaps a real version would have:
- **The podium is bare set-dressing**: the marquee point is a red rectangle with traffic cones and bins scattered on it (`physSCATTER` `props.js:2323`). A stage should have an audience, a busker, a rope line, anything.
- **The Harbour Bridge is distant decor** — 27 boxes at z=-62 with no walkway, no traffic (`environment.js:3374-3408`); the far shore is 14 random boxes (`3398-3403`). No CBD skyline, no MCA/Quay buildings behind the wharf.
- **The duck pond has no ducks** (`2512`).
- **32 people across a ~130 m park is sparse** at the forecourt: the chat scanner's own comment measures "eleven people over a hundred and thirty metres" (`npc.js:11611`).
- **Harbour traffic is hulls only** — no moored boats at the wharf beyond the one ferry; the 11 hulls are cosine sliders.
- No known-open items for this chapter in ROADMAP-FINISH's "STILL OPEN" shelf beyond "records on Sydney's rows" (`ROADMAP-FINISH.md:890`); `bounds()` (memory `first-three-chapters`) is now published (`environment.js:3627`). Verified.

### 3. Marquee / wow

- Marquee row: `opera-stage` "Take the stage at the Opera House", `wow: 'SYDNEY'` (`shared.js:2471`); CHAPTERS marquee point `{x:0, z:2.5, up:11, say:'the white sails...'}` (`shared.js:3108`).
- How it fires: stand inside `operaStage` zone with y>0.9 for 1.5 s (`systems.js:33728-33740`); `operaShot` frames the shells at 17 m (`environment.js:3705-3719`); `stageGlow` feeds the grade (`3683`); the lift plays the palette figure (`systems.js:4862`, `13522`).
- **It is a stationary trigger.** No new verb, no simulation, nothing controlled, payoff = 3 s camera hold + music lift. The user's own description ("a place, not a verb") is correct. Rating **2/5** against the ferry helm / condor / dive / bamboo climb / Hanoi traffic.
- Latent big moments already in code and stronger than the marquee:
  - the gardener carry (`8049-8093`): the player is picked up and thrown out of the gate — a real carrier contract, 2.2 s, toast, shake; only reachable by being caught at <1.8 m
  - the sea-wall plunge (`8171-8226`): a person goes into the harbour with splash, `Man overboard` toast, chaos, chase music — 1 in 6 of seaward flees, so most players never see it
  - the gull mob (`11185-11310`): 8 gulls diving on chips, pecking the prop around the pavement, mugging a tourist, a live record on the paper — but only if the player thinks to carry chips somewhere open
  - `whippy-run` mini: riding the roof with the queue forming below and the Doppler chime — the most "Sydney" verb in the chapter and it is filed as a mini
  - the ibis herd/perch/stowaway (`11727-11778`) — a following flock, discoverable only by accident

### 4. Recommendations

Sydney does not need NPC step-changes; it IS the reference. Two small things, then the marquee.

NPC (S/M):
1. **Give Pasto's `castReact` gap and Sydney's `queue`-kind bug a look** (S): the four `queue` people should be `commuter` (`npc.js:976` → they would then queue at the van and take props). Trivial.
2. **Ducks in the pond** (S): 4 records on the ibis rig (`buildIbis` 6797) with `flee`→ swim-on-pond variant; reuse `envPOND` (`environment.js:3638`). Impact: the pond stops being a decal.

Wow (the ONE change, target 4-5): **make the sails the destination of a flock you lead.** The chapter
already owns the two ingredients: the gull mob targets a prop the capybara has touched (`qgFindChips`
11158) and the ibis herd follows at obey 1 (`herdOffer` 11729). Build "BRING THE BIRDS TO THE OPERA
HOUSE": carry the chips (or a stolen sandwich) from the terrace to the podium; gulls trail the carried
prop in the air (extend `qgStep`'s target from a loose prop to the held prop), ibis follow on foot via
the herd, tourists on the steps startle/photograph (`castReact`, `photo`), the podium `stageGlow` and
`operaShot` fire when the flock arrives, and the record becomes "birds on the stage at once". New
verb for the player: **leading a flock** — a dynamic no other chapter opens with, and ch 15's herd
gets a chapter-1 rehearsal. Effort M (mostly retargeting `qgStep` + a count in the stage zone +
lines in `laugh`/`idle` `after: 'opera-stage'`). This keeps the sails as the picture and gives the
place a verb.

Scene (visual, 2-3):
- Dress the podium: a rope line, a second busker or a wedding party (4 `patron` records seated on the steps), the cones gone.
- A skyline behind the wharf: a merged strip of 20-30 tall boxes with lit windows at z≈-100..-130, replacing the 14 random blocks (`3398-3403`); the bridge gets a deck rail and 2-3 traffic boxes on a cosine like `envTrafStep`.
- Moored boats at the wharf: reuse the 11-hull instancer with 3-4 static instances alongside the ferry berth.

Bugs/regressions noticed (not fixed):
- `npc.js:976` + `7439`: kind `queue` never queues (see above).
- `npc.js:4124` `castReact` is gated on `biomeLive()` (Sydney): in Pasto a `prop:destroy` or spill startles nobody except through the vendor-only `prop:impact` handler at `10711` (needs speed>3 within 5 m of a vendor's home). A shatter in the churchyard is silent.
- `npc.js:11698` `npcBargeSweep(dt, paHumans)` — Pasto's beasts (`paBeasts`) are never swept, so barging a dog fires no `npc:barge` (the llama has its own spit test at `9964`).

---

## CHAPTER 2 — PASTO, NARIÑO

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| vendor | 4 | T4 | `stall` (watches you inside 14 m, notice line, periodic `restock` fidget 9595), chase when you are ON the stall (`9572`) or in the market inside `alertR` with vision > 0.2 (`9574`); theft → chase + `paTheft` + **everyone else in the market who can see joins** (`10673-10677`); `grudge` (max 4) buys stamina (+1.6 s per offence), leash (+4 m) and alertR (+3, cap 20), never top speed (`paGiveUp/paLeash/paChaseSpd` 9407-9433, chase capped below the 5.1 m/s sprint); wheeze, walk home with derived budget, restock line resolving on task state; gawp/point at the condor | yes | `paThink` 9504 / `paStepHuman` 9697 |
| abuela (broom) | 2 | T3 | patrol the plaza, chase at walking pace only (1.55 m/s `npcPA_ABUELA_SPD`), **swat**: `paShoveCapy(78,46)` impulse every 2.6 s inside 1.8 m (`9722-9728`), `scold` give-up beat, the only cast member with a philosophy pool | yes, 13 m alertR | same |
| farmer | 3 | T3 | work/walk between coffee bushes, chase when you are on the drying patio or in the coffee zone (`9623`), shove 64/40 (`9732-9736`), wheeze | yes | same |
| churchgoer | 4 | T2/T3 | drift/pray around the church door, notice line at 8 m, `scandal` (arms up, hop, line) when the bell rings (`paBellRung` 10722) | yes (look + line only) | same |
| llama | 3 | T3 | plod/stand; **spits** — barged at >3.2 m/s inside 1.8 m or wheeked inside 4 m → shove 52/26 + toast (`9964-9982`, `10645`) | yes | `paStepBeast` 9954 |
| street dog | 2 | T3 | plod; **follows** you (recruited inside 46 m or on a wheek), orbits a point just ahead of you at your speed+1.6, 20 s give-up / 35 m leash then `lost` pant beat (`10010-10037`); barks at a low condor | yes | same |
| condor | 1 | T4 | see §3 — gone/inbound/circling/leaving/carrying; the cast reads it (`paReadCondor` 9034): `gawp` freezes the town when a capybara is airborne within 52 m, `point`+scatter when it circles low within 42 m, dogs bark | yes (whistle, talons) | `condorUpdate` `condor.js:1366` |
| carroza (float) | 1 | T2 carrier + T4 crowd | kinematic lane x=10.5, 7.5 s dwell at each end, **waits if you stand in the lane** (`pastoCarBlocked` 2304), band sfx from the deck, cheer every 4.2 s while ridden, talc bursts from float and roadside while ridden (`pastoUpdateTalc` 2559), ride record in metres; every human turns to it and has a line, a bigger one if you are on it (`paThink` 9550-9566) | ride + lane block | `pastoUpdateCarroza` `pasto.js:2365` |
| swifts | 28 | T1 (+bell) | braided gyre round the tower, scatter + wingburst when the bell swings (`pastoUpdateSwifts` 1818), rationed scream by distance | no (bell only) | `pasto.js:1818` |
| bell | 1 | machine T4 | hinged rigid body; rings on angular velocity — capybara, thrown prop or condor all go through one law (`pastoUpdateBell` 1893); scandalises churchgoers, scatters swifts, swing record | via physics | `pasto.js:1893` |
| market stalls | 10 spec / 6 physics-bound | machine T2 | collapse on a barge ≥3.4 m/s (`physSTALL_BARGE` `props.js:213`, `4856-4896`) or a tug; awning goes dynamic, produce scatters, three-sound sequence (`pastoCollapseStall` 2098) | yes | `props.js:4686` |
| volcano plume, motes, talc | 26 / rings / 220 | T1 | ambient; vent rumble every 9-19 s (`pastoUpdateVoices` 2474) | no | `pasto.js:750, 852, 2559` |

Counts: T1 3 (swifts, plume/motes, talc), T2 3 (churchgoers, carroza, stalls), T3 4 (abuela, farmer,
llama, dog), T4 3 (vendor, condor, bell). **All 13 humans, 3 llamas, 2 dogs and the condor acknowledge
the capybara**; 19 animate things. No vehicles other than the float; no traffic.

Cross-cutting: Pasto's own event handlers — `capy:wheek` brings the market TOWARD you (`10618-10649`,
heard AND seen/close), `capy:grab` (`10652-10698`, nearest vendor/farmer by HOME, grudge, joiners,
empanada tick deferred until somebody SAW it — `paAnyoneSaw` 10701, `paEmpWanted` 10764), `prop:impact`
→ vendor chase (`10711`), `task:complete church-bell` → scandal. Shares with Sydney: witness chain
(`npcWIT_CHAIN_PA`), heat, barge sweep (humans only), chat (`paChatA/B`), face, bubbles, `capy:graze`
(`7810`, `paProduce` pool), the `npcWitnessHold`.

Most complex behaviour: the vendor — five-way escalation (grudge → alertR/stamina/leash), joiners,
condor interrupt that closes the `npc:chase`/`npc:calm` pair properly (`paInterrupt` 9496), a walk
home whose budget is derived from the leash and that settles the anchor when nav blocks the last
metres (`9764-9802`).

### 2. Scene completeness

Screenshot (`qa/B2-02-pasto.png`): plaza cobbles, two-tier fountain, six benches, six stalls with
produce, two llamas, two dogs, the abuela mid-chase with a bubble ("The broom is patient, mijo."),
bunting posts. Reads as a market square and the chase reads immediately.

Built: terrain mesh + far peaks, frailejones/shrubs/coffee rows, cobbles, plaza furniture, church +
bell tower, market, carroza, street of terraces (three runs, `pastoBuildStreet` 2708), coffee farm with
patio/finca/sacks (`2784`). Gaps:
- **The hills behind the plaza are flat green with stamped trees** (visible top of the screenshot) — the terrain colour law (`pastoTerrainColour` 259) is doing all the work; no fields, walls, paths or second village.
- **A market with no shoppers.** 4 vendors + 2 abuelas is everyone in the market; nobody buys anything; no queue, no pigeons, no children. The 4 churchgoers are at the church.
- **No traffic at all** — a Colombian town with a plaza has buses/chivas/motos. Cali has the chiva; Pasto has one parade float.
- **The church is a box with an organ sound from inside** (`pastoNaveAt` 2472); interior unverified — nothing in `pastoBuildChurch` (1533) suggests one (not read in full).
- Volcano: the plume is drawn and rumbles (`2484-2491`); the crater is the thermal-peak/crater-drop destination — fine.
- Known-open: none in ROADMAP-FINISH for Pasto; memory `first-three-chapters` items (float lane, bunting height, bounds) verified closed (`pastoCAR_X = 10.5` `pasto.js:2171`; `bounds()` `3161`).

### 3. Marquee / wow

- Marquee row: `condor-ride` "Grab its talons and hold on", `wow: 'GALERAS'` (`shared.js:2503`); the marquee point MOVES — `marqueeAt()` returns the live bird (`pasto.js:3048-3053`, the only moving marquee in the game).
- Reach: whistle anywhere in a chapter that publishes `thermals` (`condorHost` `condor.js:2543`); first time: inbound spiral 4 s → circles at 14 m → toast "whistle again" → drops to 6.6 m/2 m orbit → talons in reach at 6.6 m → grab (`condorSummon` 900, `condorTryMount` 2309). Once ridden anywhere the low orbit is armed from the start (`963-965`). Bored after 25 s (`condorBORED` 173).
- Real simulation: gravity in the world; lift/drag from CL/CD shapes vs angle of attack measured in the body frame against the RELATIVE wind (`1412-1451`); thermals are a moving airmass, strongest column wins (`condorThermalUpdraft` 2078, 7 authored columns `pasto.js:196-208`); PD attitude with authority from airflow (`condorAttitude` 2113); stick filtered as a wrist (`1558`); flap on Q (`2009`, auto below 0.6×stall); the passenger is a PointToPoint constraint softened to a tendon (`1107-1120`); the launch is a shared delta-v so the constraint never absorbs a step (`1135-1148`); release keeps the bird's full velocity ("the drop is the joke", `1216`).
- Camera/sound: `condorShot` at 30 m, low pitch, `over:true` on the FIRST ride in this chapter (`pasto.js:3136-3147`, `condor.js:1168-1178`); flight rig blend in systems.js; wind hiss scaled by airspeed, thud on hard landing, shake (`condorFlightFeedback` 2335); the town gawps and dogs bark (`paThink` 9512-9526).
- Fail/repeat: wedged (no motion in every axis + below stall for 1.1 s) → release; passenger scraping terrain → release; fence at `pasto.bounds()` (`condorFence` 2611); re-whistle any time; `thermal-peak` (rim + margin, latched `2439-2493`) and `crater-drop` are the act-3 payoff with a live AGL record.
- Rating **5/5**. It is the standard the rubric names. Verb: flying (bank, trim, flap, thermalling).
- Weak edges, honestly: the only teaching line is one `hud.say` at 2.4 s (`1208-1212`); a first-time player stands ~10 s watching the bird circle before the second whistle lands; the town's `gawp` (6 s ceiling) is the only ground reaction to a flight, and nothing on the ground changes after you land (no `after:'condor-ride'` state, only lines).

Latent/underexploited: the carroza mini is the second-best thing in the chapter (waits for you, band, talc, cheer, crowd lines) and is filed as a mini; the stall collapse (`market-chaos`) is a barge stat-check at 3.4 m/s; the bell is a genuine physics toy.

### 4. Recommendations

NPC (Pasto is already at the bar; two items):
1. **Shoppers** (M): 4-6 extra `paBuildLocal` records of a new kind `shopper` using `patrol` between stall posts with a 3 s `browse` dwell facing the counter (the vendor's `stall`/`restock` pair is the shape); on theft they join via the existing joiner loop (`10673`), and they are the bodies the talc lands on. Reuse `paPickPlaza`/`paSteer`. Impact: the market reads as a market.
2. **Sweep the beasts** (S): call `npcBargeSweep(dt, paBeasts)` too (`11698`) so barging a dog gets a yelp + witness; and route `castReact` (`4122`) to `paHumans` when `paLive()` so a shatter/spill in Pasto startles somebody.

Wow: rated 5; no change proposed. If anything, spend S on the **first-ride tutorial**: a second `hud.say`
("steer with the stick; find the rising air over the cone") at 8 s, and let the `thermal-peak` clue
pulse when inside a column (`thermalAt` lamp exists in systems.js per memory `pasto-by-name`).

Scene (2-3):
- Fields on the hills: a second instancer of low walls/hedgerows and 2-3 patches of `pastoCoffeeGeom` rows on the slopes behind the plaza so the green is not flat; a dirt road polyline up toward Galeras (the chapter's third act has no visible road to the mountain).
- A chiva or a moto on the street: one kinematic on a cosine along the terrace street (`pastoSTR_*`), same rule as `envTrafStep`; even a parked one with a driver record.
- Pigeons at the fountain: 6 on the ibis rig, flee on approach, land on the basin rim (ibis `perch` already exists).

Bugs noticed: listed under Sydney §4 (both are npc.js gating issues that hurt Pasto).

---

## THE SYDNEY-DEPTH CHECKLIST (what another chapter needs to match the baseline)

1. **A hand-written state machine per kind**, not the generic locals rig: ≥6 states with a ceiling on every steering state (`thinkHuman` 7293, `stepHuman` 7962; ceilings at 7356, 8165, 8191, 8260, 8365, 8571).
2. **Vision, not radius**: cone + distance falloff + LOS occlusion before anyone reacts (`visionOf` 7236, `seesCapy` 7253); a wheek is heard, a theft has to be seen (`paAnyoneSaw` 10701).
3. **Ownership**: props with `owner`, held in-hand each frame, taken by `capy:grab` → chase → `retrieve` → `reclaim` (7770, 7899-7932); the thing can be lost, found and put back.
4. **A chase that can be won by running and lost by standing still**: capped below sprint, give-up timer, leash to a home post, a VISIBLE give-up beat (`paChaseSpd` 9429, `paEndChase` 9476, Sydney 8431-8443).
5. **Escalation with memory**: per-person wariness (26 s), per-vendor grudge (stamina/range, never speed), a place-level heat field that changes look range and register (7979-7992, 9456, 3020-3170).
6. **The body-check and the barge**: speed-gated contact that drops what they hold with your momentum and stamps causation (8028-8043, `npcFumble` 7696), plus proximity barge → flinch/stagger/gasp (4233-4323).
7. **Crowd propagation**: a witness chain that turns every head within 20 m for 2.6 s and lets exactly one speak, heat-scaled, armed by every reaction (3560-3633; `npcWitnessHold` 3407 re-asserted after the state machine).
8. **NPC↔NPC**: at least one pair that reacts to each other, not only to you (waiter serves → patrons look up 8393; theft → market joins 10673; bell → churchgoers + swifts).
9. **NPC↔world systems**: reads prop BODIES (ibis flock to a tipped bin 7491-7509; gulls peck a prop 11261), affects tasks/records (`seagull-chips` record 11276), and world objects react back (replant to STATIC 7935).
10. **Animals with their own verbs**: a dog that can be freed and follows/barks; a llama that spits; a bird that mobs; a herd offer so a flock can be led (`herdOffer` 11729).
11. **A carrier contract in both directions**: a vehicle that carries you by velocity (van 1221, ferry 2174, float 2365) and one NPC that carries YOU (gardener 8049-8093, condor 1074).
12. **Lines that resolve on what you did** (`after`/`before` pools 220-474, `localResolve` 2549) and two-person exchanges (`chatStep` 11586), never periodic, never a chorus (`npcLastGlobal` 477).
13. **A face and a body that show state**: mood → brows/eyes (`npcMoodOf` 8648), hop/flail/stumble/lean/crouch targets per state, wet shading (`shadeHuman` 6448).
14. **Positioned sound from the person** (`sfx(name, rec)` 6208; feast squabble scaled by count 7555; Doppler mover on the van 1266).
15. **Slapstick with a physical consequence**: the harbour plunge integrated under gravity with a waterline splash (8197-8226); a stall that actually falls over (props.js 4686).

## WHAT IS WEAK IN THE BASELINE ITSELF

- **Sydney's marquee is a place** (`opera-stage`: stand still 1.5 s on a rectangle, `systems.js:33729`). Rated 2/5 above; the chapter's real high points (carry, plunge, gull mob, van roof) are all filed as ordinary rows or a mini. The fix proposed is to make the sails the DESTINATION of a led flock, not to move the marquee.
- **Sydney's reactive world is front-loaded on the tourist**: commuters/"queue" kind are tourists with fewer props; the busker, owner and waiter are one-state characters with a chase bolted on.
- **The podium set-dressing reads placeholder** (cones/bins on a red rect) at the one point every arrival shot frames.
- **Pasto has no non-vendor civilians and no traffic**, and the ground never changes after the flight — the town's reaction to the chapter's own wow is a 6 s stare.
- **Pasto misses two shared reaction hooks** because of Sydney-only gates (`castReact` 4124; barge sweep 11698) — the very "shared-module blindness" the memory notes warn about, still present for chapter 2.
