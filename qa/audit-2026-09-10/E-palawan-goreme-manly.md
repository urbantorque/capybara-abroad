# Audit E — chapters 12 Palawan, 13 Cappadocia (Göreme), 14 Manly

Read-only pass over `src/palawan.js` (4924 lines), `src/goreme.js` (5751), `src/manly.js` (4613), the
CHAPTERS/TASKS rows in `src/shared.js`, the locals rig in `src/npc.js`, the offer registries in
`src/systems.js`, and the qa/ frames named below. Every claim cites file:line; anything I could not
verify by reading is marked **unverified**.

Tier key (from the rubric): T0 static merged mesh · T1 ambient loop, never reads the capybara ·
T2 reacts to the capybara (the `game.addLocal` rig is T2) · T3 stateful actor · T4 systemic
(reacts to other NPCs / world systems).

The user singled out Cappadocia, so it comes first and is the most detailed.

---

## CHAPTER 13 — CAPPADOCIA / GÖREME (`src/goreme.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Player balloon (basket, envelope, flame) | 1 | T3 (carrier) | kinematic basket; burner with 4 s lag (`gorBURN_LAG` 108, 4154-4156); horizontal = wind layer at height above ground (4159-4161); rim curl brings it back (577-599); ceiling at 205 m (4138-4147); envelope glows as a lantern on burn (4238-4250); vertical velocity written into the animal (4275-4278); declared `carryFrame` (5124-5133); "crew walk it back" after 30 s empty (4185-4192) | yes: aboard test 4111-4114, `input.action` is the burner 4130 | `gorUpdateBalloon` 4102 |
| Other balloons ("decor") | 26 | T1 | launch on the clock from `gorLAUNCH_P` (2584-2587), drift on the real wind field (2603-2605), wrap at the edges (2606-2609), burn on a per-index clock (2734-2735), all burn together in the last 12 s before the sun (2716-2743), lit top-down by the dawn line (2695, 2727, 2775-2777); one nearest-burner sound per 3-6 s (2791-2797) | no — the 30 m keep-out (2616-2624) reads the player's BALLOON, not the animal | `gorUpdateDecor` 2580, `gorUpdateDawnLine` 2689 |
| Painted balloon shadows | 27 | T1 | discs on the ground under each envelope, offset by sun angle | no | `gorUpdateShadows` 2538 |
| Launch-field envelopes (2 flat, 2 filling, 1 up) | 5 | T0 / T1 | the "up" one's burner flashes on its own clock with a placed sound (2504-2536); the two filling ones are static ellipsoids (3341-3350); the fan in the mouth roars louder the longer you stand in it (4585-4590) | the fan ramp yes (4562-4573); the envelopes no | `gorUpdateFieldBurners` 2504, `gorCheckField` 4515 |
| Launch-field crew figures | 20 (4 per crew × 5: 3268-3299) | T0 | merged boxes, one pose each; solid via `gorBuildFigureBodies` 3214 | no | none |
| Square: 3 tea drinkers, woman on the roof, sleeping dog | 5 | T0 | merged (1729-1731, 1750, 1766-1768) | no | none |
| Chase truck + trailer + dust | 1 | **T4** | drives to a PREDICTED landing point = balloon + wind × time-to-sink, damped 4 s (4031-4035); slope costs speed (4045-4046); headlights until sunrise (4067-4073); dust plume (3951-3990); trailer is a kinematic carrier (3838-3859, 3871-3880); if you are on the bed after a landing it drives you back to the square (3893-3917, 4036-4039) | indirectly through the balloon; directly through the trailer aboard test 3888 | `gorUpdateTruck` 4027, `gorTrailerRide` 3871 |
| Bell mare | 1 | T3 (carrier) | canters z −74→12 and back at 6.2 m/s with 9 s waits (3480-3484, 3624-3630); kinematic deck with pommel/cantle kerbs (3572-3595); bell sound on a jittered stride clock (3696-3717); declared frame (3731-3736); 11 s aboard = `the-herd` (3738-3749) | yes: `gorOnMare` 3611; wheek within 45 m changes her gait for 4 s (4806, 3652) | `gorUpdateHerd` 3619 |
| The other ten horses | 10 | T2 | instanced formation either side of the lane; they BUNCH on the mare when somebody is riding (3681-3692) | yes (via `up`) | `gorUpdateHerd` 3619 |
| Cats | 9 | **T3** | sit/flop/walk machine (1416-1434); flee inside 2.5 m (1394-1401); once the calm registry inverts they walk up to a sat-down capybara and flop next to it (1408-1414); every cat in 26 m turns its head at a wheek (4811-4822); herd-follow at obey 2 (1329-1370); may ride on the capybara (span 2, `lift` 1350-1356) and stow away (1362-1369) | yes | `gorUpdateCats` 1308 |
| Rock doves | 260 (`gorPIGEON_N` 136) | T2 | perched on the dovecote with a head bob (2225-2232); put up by a wheek < 100 m (4773-4782), a run < 50 m via `flockOffer.scare` (2141-2154), or E in the cliff zone (4881-4894); one loop and home over ~22 s with two landing sounds (2165-2191) | yes | `gorUpdatePigeons` 2156 |
| Wisps | 120 | T1 | drift at their layer's wind, tinted per layer (2984-2991, 3018-3054) | no | `gorUpdateWisps` 3018 |
| Tethered envelope | 1 | T2 (scripted) | solid box (3079); E in the crown-line zone cuts it (4896-4907); it lifts, tilts and is removed past 104 m (4921-4946) | yes (E in zone 4896) | `gorUpdateTasks` 4833 |
| Locals (chief, town, tea, potter, dove, crew, horse, dovecote, vine, chase) | 10 | T2 (rig) | `addLocal` with `before:/after:` conditional lines, `onTask`, `praise`, `wheek`; tea/potter/dovecote carry `beat` gestures (5577, 5594, 5662) | yes | npc.js `addLocal` 2323; registrations 5513-5708 |
| Traveller | 1 | T2 | `addTraveller` 5564 | yes | npc.js |
| Pair-chat | 3 pairs | T4-lite (NPC↔NPC) | tea↔town, potter↔town, crew↔chief (5719-5746) | no | npc.js `addExchange` |
| Placed voices (`gorCall`) | 9 causes | T2 | launch / high / vines / under / birds / spook / hurry / nudge / fan (4679-4711) | yes | `gorUpdateVoices` 4672 |
| Valley echo | — | T2 | two returns 1.15 s / 2.35 s after a wheek (4829-4830) | yes | `gorUpdateWheek` 4764 |
| Ground ambience (dove rustle, poplar hiss) | — | T1 | 2104-2130 | no | `gorUpdateGroundSound` |

**Counts.** T0: 25 merged people + 1 dog, 4 static envelopes. T1: 26 decor balloons, 27 shadows,
120 wisps, 1 field burner, dust, ambience. T2: 260 doves, 10 horses, tether, 11 locals, voices,
echo. T3: player balloon, bell mare, 9 cats. T4: the chase truck; 3 pair-chats.

**Things that acknowledge the capybara at all:** cats, doves, mare (+10 followers by bunching),
truck/trailer, tether, fan roar, 11 locals, the echo — 8 classes. The 25 merged figures do not.

**Most complex behaviour:** the truck's predictive chase (4027-4075) coupled to the balloon's
lagged wind model; among animals, the cats' state machine + calm-approach + perch + stow (1308-1454).

### 2. Scene completeness

*Arrival frame* (`qa/B2-13-goreme.png`): the launch field under floodlights and a string of bulbs,
two half-inflated gored envelopes, an upright balloon behind, crews in hi-vis, the chase truck,
the plaza's red carpets, cliffs and poplars — dense and legible; the best arrival of the three.
*Marquee frame* (`qa/FINAL-goreme-sunrise.png`): the basket and envelope over a featureless ochre
blur — no chimney, no other balloon, no valley shape in frame. The ground shader (5245-5276) is
low-contrast noise designed for ground level; from 55+ m it is one colour, and the decor
keep-out (2616-2624, 30 m) pushes every other balloon out of the exact shot the chapter is for.

What a real dawn launch field has that this one lacks:
- **Nobody moves.** 20 crew figures in one pose each (3268-3299). The comment at 3116-3126 calls
  a crew "a crowd" and a crowd "geometry" — but the plaza's locals rig proves people with a `beat`
  are cheap (5577, 5594, 5662). Crew 2 is "five minutes from going" (3362) for the whole chapter;
  it never launches. Only the 26 decor balloons ever leave the ground, and they start 60-70 m away
  (2562-2563), so the launch you are told about ("the balonlar are inflating", 4457) is never
  witnessed up close.
- **No traffic.** A road runs z 60 → −104 (1781-1785) and only the chase truck uses it; on a real
  morning it is a convoy of trucks and minibuses with headlights.
- **The town's windows are painted, not lit.** Every window is a `PALETTE.gorWindow` box in the
  merged Lambert mesh (1492, 1509, 1682, 1920); only the bulb string (1666) and floodlights
  (3427) glow. A cave town at five in the morning has lit windows that go out with the bulbs.
- **The tether envelope's fate is off-screen**: cut it and it lifts, tilts and vanishes at 104 m
  (4921-4931) — nobody in the valley reacts except two lines of `gorSaysNow`.

Open items from the roadmaps, verified against code:
- ROADMAP-FINISH.md:57 "tasks within 20 m of spawn: Cappadocia **0**" — still true. Spawn is the
  plaza (0, 34) (50); the nearest task objects are the tether peg (−17, −10.4) (5163) ≈ 48 m and
  the field basket (0, 4) ≈ 30 m; the arrival frame's own beacon reads "96 m".
- ROADMAP-FUN.md:462 lists the intended first-20 m gag "a crew's basket you can climb into on the
  launch field": the basket is solid and hop-able (3381-3383) but is 30 m from spawn, so it is
  not in the ring.
- REVIEW/BEAUTY: ROADMAP-BEAUTY.md:48 calls this chapter "the standard for the whole game" for its
  lighting; agreed for the ground-level frames.

### 3. Marquee / wow

- **Marquee task:** `sunrise` — `wow: 'CAPPADOCIA'` (shared.js:2839); CHAPTERS beacon at
  (0, −40, up 12) "the launch field" (shared.js:3271). Minis: `the-herd` (2843).
- **New verb:** altitude-only steering. Hold E = burner (4130); there is no other input
  ("the stick does nothing", 4119). Five wind layers (74-80) blended over 9 m (585-588), rim curl
  past 52 m from the valley middle (589-598). Vertical: 1-D kinematics with two lags (4131, 4156)
  — honest but tiny. Horizontal: a table lookup, not aerodynamics. The player commits to a layer
  ~4 s before seeing whether it was right (the design, 4150-4153).
- **Who controls what:** the player controls climb/sink; the wind controls everything else; the
  clock (156 s, 121) controls the moment.
- **How the moment is reached:** be aboard and >55 m above ground when `gorSun` is in
  0.465..0.96 (4360) — an ~11 s window (4356-4358). The tea man warns 37 s out (4696-4706); the
  whole valley burns together in the last 12 s as a countdown (2716-2723); `nextIn('sunrise')`
  puts the seconds on the paper (5054-5060). Full-burn climb to 55 m measures 32 s (4359).
- **What it looks like:** rim glow, sun disc, light line descending through 26 envelopes
  (2695-2777), `frameShot` yaw −1.10 held 5 s (4380), chief on the radio (4389), chime + shake
  (4390-4392), music swell held across the sun (4465-4467). Then the light is over and the
  chapter continues with the landing.
- **Payoff duration:** ~18 s of light change; 5 s of framed shot. Repeats every cycle; the task
  ticks once. Fail path: on the ground → wait 156 s.
- **Honest rating: 3 / 5.** The *flight* is a genuine new dynamic and the *picture* (lanterns,
  light line) is the best-built dawn in the game. But the marquee itself is a **stat-check on a
  clock**: nothing the player does during the 11 s window matters, the lever is one slow key, and
  the actual frame (`FINAL-goreme-sunrise.png`) contains the basket and an ochre blur. Against the
  ferry helm / condor / Hanoi traffic it is a ride with one lever and a scheduled cutscene.
- **Latent big moments, under-sold:**
  1. **The chase truck is the best system in the chapter and the least visible.** It predicts,
     it lags like a man, it loses grip on slopes (4004-4023) — and it is a khaki box in a khaki
     valley with a 2.4×4.2 m trailer (3768) that only gets a live distance readout under 30 m on
     the way down (4340-4344). The decision the design describes ("sink early where he is, or
     commit to a layer and trust him", 4021-4023) is invisible from altitude.
  2. **The herd ride** (`the-herd`): 11 s on a mare at 6.2 m/s with ten horses closing round the
     lens (3681-3692) — the best kinetic thing in the chapter, but the run is z −74..12, with a
     9 s stand at each end, and nothing calls her: you intercept her or you wait.
  3. **The tether**: the code explicitly permits riding the cut envelope up (4933-4936) — a free
     104 m ascent with no burner — and then removes the collider under you (4923-4931).
     Unverified in play; by reading, a rider is dropped from ~104 m. Either a hidden gag or a fall.
  4. **The doves at sunrise**: the dovecote local already says "They come off the rock when the
     light hits it. Same as you did." (5674) — but the flock only ever goes up for the capybara.

### 4. Recommendations

**NPC / behaviour**

| # | proposal | reuse | effort | impact |
|---|---|---|---|---|
| G1 | **The field launches.** Crew 2's "up" balloon (3362-3389) leaves the ground at `gorLAUNCH_P` on the same ascent curve the decor uses (2584-2587), its two crown-line figures let go, and a second crew's fan-fill stands up over the next 60 s (swap the merged ellipsoid for a scaled `gorEnvelopeGeo`). The 15 crew figures become locals-rig figures with `beat: {kind:'work'/'reach'}` (npc.js 2354-2359) — or, cheaper, an instanced 2-pose crowd toggled on a timer. | `gorUpdateDecor` ascent, `addLocal` `beat`, `gorFigure` poses | M | high — the arrival frame becomes an event you can watch from the plaza; the chapter's promise ("eighty of them go up") is finally seen at close range |
| G2 | **Put the chase driver in the truck.** Merge a driver into `gorBuildTruck` (the bangka does this at palawan.js:2444-2453) and make `gorCall('chase', …)` speak from `gorTruck.position` instead of the static local at the landing plain (see bug B4). Add a rooftop beacon/flashing amber light (emissive box, `gorGlowMat`) so the truck reads from 150 m. | `gorCall` 4651, `gorGlowMat` 326 | S | high for the landing task; makes the T4 chase legible |
| G3 | **Call the mare.** A wheek within 45 m while `gorHerdWait > 0` ends the wait (set `gorHerdWait = 0`) so the ride is summonable; the herd already spooks on the same test (4806). Optionally register the mare through `herdOffer` at obey 3 so a led herd can be walked onto the launch field. | `gorUpdateWheek` 4806, `game.herdOffer` systems.js:30878 | S | medium — turns a 23 s intercept into a moment you cause |
| G4 | **Doves that come down.** The flock offer is scatter-only (2136-2139). Give it `at/put` with a ground-state per bird (the Manly gull pattern, manly.js:2703-2708, 2752-2757) so a dropped chip or a sat-down capybara in the plaza brings a dozen doves down onto the paving; and put the flock up at `gorSun > 0.35` on its own (see W1). | `flockOffer`, `game.calm` | S/M | medium |
| G5 | **Two ambient vehicles on the road** (1781-1785): a minibus and a tractor on a T1 loop with headlights until sunrise (the truck's beam material, 3803-3812), yielding to nothing. "Things that are simply there" rule: long clock, no announcement. | `gorBuildTruck` beams, the Sydney single-mover pattern | S | medium — the valley stops being empty between the town and the plain |

**The wow (3 → 4-5): one change — "the dawn is something you join, not something that happens
to you."** Three linked pieces, all on existing systems:
1. At `gorSun > 0.35` fire `gorPigeonScare` with the loop centre (2201, currently fixed at the
   cliff) moved to the player's balloon when aboard: 260 doves wheel round the basket at the
   moment the light hits them, which is what the dovecote local already promises (5674).
2. During the 12 s sync-burn countdown (2716-2743) the chief radios "Top up! Everybody up!"
   (`gorCall('chief', …)`), and `sunrise` ticks only if `gorBalBurn > 0.5` at the moment
   `gorSun` crosses 0.465 — the player's own lantern joins the wave of 26. That is a timing
   press, a verb at the moment instead of a height gate.
3. Relax the decor keep-out (2619) from 30 m to ~14 m for the sunrise window and bias two decor
   balloons toward the player's altitude, so the framed shot (4380) has neighbours in it.
Effort S-M total. New verb: **timing the burn with the valley** (and being inside a flock).
This gets to 4. The honest route to 5 is the deleted **vent** (memory note
`capy3-dive-and-balloon`: it was removed because Space is the hop that leaves the basket) — a
fast-descent key makes layer changes a two-way decision and the trailer landing a real skill;
it needs a key that is not Space and I have not verified one is free.

**Scene (visual)**
1. **The valley from above.** Add a second, high-contrast ground term for altitude: painted road
   and vineyard-row stripes (the wash-channel trick at 5268-5276 but with the vineyard rows as
   dark lines), and long painted shadow ellipses off the 74 chimneys at sunrise (the balloon
   shadow discs, 2447, already do this for balloons). The marquee frame is currently a blur.
2. **Lit windows in the cave town** before dawn — swap the `gorWindow` boxes (1492, 1509, 1682,
   1920) for a `gorGlowMat` instanced mesh driven off `gorSun` the way the bulbs are (4064-4073).
3. **The field launches** (G1) is also the biggest scene fix.

**Bugs / regressions noticed (not fixed)**
- **B1 goreme.js:2717-2718** — the sync-burn envelope is `(toSun > 0 && toSun < 12) ? smooth(…) :
  (…) * 0`. The else branch is multiplied by zero, so the "dies over the sunrise itself" the
  comment promises never happens: at the frame `toSun` crosses 0 the whole valley's lantern term
  drops from ~1 to 0 in one frame, on the exact frame of the marquee.
- **B2 goreme.js:5054-5060** — `nextIn('sunrise')` returns 0 only once `gorSun > 0.465`, but
  computes `d = gorSUN_P - gorPhase`; between `gorPhase` passing `gorSUN_P` and `gorSun` reaching
  0.465 (≈ 8.6 s: smoothstep⁻¹(0.465)·0.115·156) `d` is negative, `+1` is applied, and the paper
  reads ~155 s "next time round" in the seconds *before* the window opens.
- **B3 goreme.js:4881-4894** — the E-press path for `dovecote` does not call `gorSaysNow('dove'…)`
  / `gorSaysNow('dovecote'…)`; only the wheek path (4783-4800) does. Same task, two doors,
  different NPC memory.
- **B4 goreme.js:4651-4661** — `gorCall` always speaks from the local's registration point, so the
  chase driver's "I am right underneath you" (4691) and "You are a speck" (4684) are drawn at the
  landing plain (5693-5694) wherever the truck actually is.
- **B5 goreme.js:4921-4931** — tether removal at 104 m with a passenger permitted on it
  (4933-4936). Unverified in play.

---

## CHAPTER 12 — PALAWAN (`src/palawan.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Bangka + merged boatman | 1 | T3 (carrier) | jetty ↔ island foot at 2.4 m/s, 11 s at each end (2484-2501); kinematic hull with gunwales (2461-2475); declared frame (2552-2556); ride = `outrigger` (2557-2571); boatman merged into the hull (2444-2453) | yes (aboard 2550) | `palUpdateBangka` 2488 |
| Jetty diver (child) | 1 | T1 | 26 s cycle stand/jump/dive/tread with distance-scaled sounds (3204-3265) | no | `palUpdateDiver` 3204 |
| Schools | 150 in 5 schools | T2 | circle their centres (1807-1815); bolt from an underwater wheek and re-form (1801-1832); lit by the bloom, flare when they bolt (1844-1851) | yes (wheek) | `palUpdateFish` 1798 |
| Anemones + clownfish | 34 | T2 | surge as a travelling wave (1713-1717); fish drop into the anemone within 3.2 m of the animal or on a wheek (1701-1727) | yes | `palUpdateSmallLife` 1694 |
| Bait ball | 118 four-fish clumps | T2 | rotating torus (1955-1964); opens around the animal (1965-1973); 4 s inside = `bait-ball` with a rising sound (1981-2007) | yes | `palUpdateBaitBall` 1950 |
| Turtle | 1 | T1 | figure-8 lap at 1.55 m/s (2038-2049); surfaces 6 s of every 92 with a gasp (2062-2067, 2092-2106) | no (the *task* reads her; she never reads you) | `palUpdateTurtle` 2079 |
| Manta | 1 | **T3 (carrier)** | lap of the drop-off at ~1.1 m/s (2275-2298); E within 3.6 m while under grabs the leading edge (2309-2317); 22 s authored flight with a barrel roll and a breach (2352-2360); the animal is parked on it, breath free (2330-2349); `launch` off the back (2374-2376); music swell held (2325-2327) | yes | `palUpdateManta` 2265 |
| Blue-spotted ray | 1 | T2 | buried on the sand; bolts in a sand cloud when the animal is under within 4.2 m (3436-3452); settles again elsewhere (3485-3490) | yes | `palUpdateRay` 3424 |
| Terns | 22 | T2 | gyre at 13 m over the bait ball, two always diving with a rationed splash (3337-3367); scatter for a surface wheek within 60 m (3330-3335) | yes | `palUpdateTerns` 3322 |
| Swiftlets | 36 | T2 | gyre round the cathedral's light shaft, only drawn while you are in the room (3546-3552); a wheek sends the colony up the hole with clicks (3554-3570) | yes | `palUpdateSwiftlets` 3542 |
| Motes / plankton | 240 | T2 | marine snow that recentres on the animal (2986-2996), stirred by its wake (2997-3001), lit and swollen by the bloom (2978, 3030-3034), crossed by the wheek shell (3024-3025) | yes | `palUpdateBloom` 2951 |
| Bubbles | 60 | T2 | breath bubbles, faster as the bar empties, carry the bloom (3039-3060) | yes | `palUpdateBubbles` 3077 |
| Giant clam + pearl | 1 | T2 | opens when the animal is under and in the zone (4124-4130); E takes the pearl (4131-4138) | yes | `palUpdateTasks` 3999 |
| Beach fire | 1 | T2 | flickers; goes out under a wet capybara within 2 m (3857-3881) | yes | `palUpdateFire` 3812 |
| Locals (boatman, fire, netman, drying, painter, boy, lagoon) | 7 | T2 (rig) | `before:/after:` and `when:` (palDark/palLit/palWet/palDown) conditional lines; netman and painter have `beat`s (4683, 4723) | yes | 4625-4790 |
| Pair-chat | 3 pairs | T4-lite | boy↔boatman, netman↔fire, drying↔painter (4799-4831) | no | npc.js |
| Caustics, light shafts, palms (sway), water sheet | — | T1 | 2768, 2855, "AND THEY MOVE" in `palBuildBeach` | no | — |

**Counts.** T0: none animate (three beached bangkas, the wreck, huts). T1: diver, turtle, caustics,
palms. T2: schools, clownfish, bait ball, ray, terns, swiftlets, motes, bubbles, clam, fire,
7 locals. T3: bangka, manta. T4: 3 pair-chats only — **no creature ever interacts with another
creature** (the terns "work" the ball by placement, not behaviour; nothing hunts).

**Acknowledge the capybara:** 10 animate classes + 7 locals — the richest reactive reef in the game.
**Most complex:** the manta ride (keyframed flight + parked passenger + breach + launch-off).

### 2. Scene completeness

*Arrival* (`qa/B2-12-palawan.png`): sand, jetty with the boy on it, four stilt huts with washing,
driftwood and props, teal shallows — but the karst island behind is a **grey fog band across the
top of the frame** (ROADMAP-POLISH.md:53 noted the same; still true in B2-12). *Reef*
(`qa/FINAL-palawan-reef.png`): table corals, fans, staghorn, seagrass, yellow fish, the turtle
passing — dense, the best underwater frame in the game.

Missing for a real Palawan beach at dusk:
- **One person in the water.** A bay with a boat service, a reef and a bloom has one child diving
  off the jetty and nobody else swimming or snorkelling; no bathers on the sand (the file has no
  merged crowd builder at all — grep for a figure helper finds none; the people are the 7 locals,
  the boatman on the hull, and the diver).
- **No dogs**, though a local says "Half the dogs on this beach just stood up" (4716).
- **No crab** on the sand — ROADMAP-FUN.md:461 lists "a crab that scuttles" as the intended
  first-20 m gag; `grep -ci crab palawan.js` = 0.
- Two of the three beached bangkas never move; the village has no lit doorways at dusk
  (**unverified** whether hut lamps are emissive — the section "AND SOMEBODY LIVES IN IT" builds
  washing at ~992, not people).
- The hidden lagoon (`palLAG`) has one school and nothing else alive; the cathedral has one
  school and the swiftlets.

### 3. Marquee / wow

- **Marquee task:** `the-bloom` — `wow: 'PALAWAN'` (shared.js:2814). Minis: `bait-ball` (2816),
  `the-manta` (2820). CHAPTERS beacon at (0, −70, up 1): "out past the reef, and then straight
  down" (shared.js:3260) — that point is the **lagoon** behind the submerged crack (`palLAG` 80).
- **New verb:** the dive — hold E, breath = stamina bar, buoyancy, camera goes under (4342-4360,
  `camFloor` 4366), muffle via `submerged()` 4370. Real simulation, and the chapter's true wow
  (rating 5 as a verb).
- **The moment:** a 124 s clock (93-96); the bloom is on for phase 0.47..0.76 = **36 s**; task =
  `palBloom > 0.55 && under` (4166-4173). Visual: motes ×2.1 emissive and ×8 size (2978, 3030),
  surface emissive (4454-4458), fish lit (1844-1851), bubbles carry it, wheek shell through the
  motes (4882-4924), side-on `frameShot` 3.2 s (4202), placed chime, shake 0.14, locals switch to
  `when: palLit` lines. `nextIn('the-bloom')` puts the countdown on the paper (4299-4305).
- **Who controls what:** the clock. The player only has to be under water somewhere. Repeats
  every cycle; ticks once; no fail beyond waiting.
- **Honest rating: 3 / 5 for the marquee as filed; the chapter's real wow is the manta at 4.**
  The bloom is a beautiful **stat-check on a clock** — being under is the only requirement and it
  is the thing the chapter has taught you to do for the previous ten minutes, so the moment asks
  nothing new. The manta (22 s authored flight, roll, breach, shake 0.34, swell) is the only thing
  in the game that "takes you somewhere by deciding to" (2112-2128) and is filed as a mini. The
  bait ball is the best reactive picture.
- **Latent, under-exploited:** (a) the wheek-under shell (4875-4924) lights 34 m of bloom and is
  never asked for; (b) the manta ride during a bloom — the motes are only stirred by the
  capybara's own velocity (2976-3001), so a manta tearing through lit water leaves no wake;
  (c) the ray's bolt is a one-line surprise that resettles (3485-3490) and could be a chase.

### 4. Recommendations

**NPC / behaviour**

| # | proposal | reuse | effort | impact |
|---|---|---|---|---|
| P1 | **Something hunts.** When a tern hits the water (t≈0.62 at 3354) throw the nearest 3-4 bait-ball clumps outward for a second using the same push the capybara gets (1969-1972); add one trevally/reef shark on a slow loop round the ball whose distance modulates `palBALL_R` (contract when close) — the first T4 creature interaction in the chapter. | `palUpdateBaitBall`, `palTurtlePos`-style lap | S (terns) / M (predator) | high — the reef starts being an ecosystem rather than a set |
| P2 | **People in the water and on the sand.** Two snorkellers on the reef on phase-offset copies of the diver's cycle (3204) handed to `addLocal` as `group` so they turn to watch (npc.js 2325-2331); 8 instanced bathers by the fire on the Manly crowd pattern (manly.js:2463-2528, avoid-the-capybara 3406-3413). | Manly bathers, the diver, locals rig | M | high — fixes "second-emptiest cast" (4678) |
| P3 | **The turtle notices you.** Damp her yaw toward the animal and drop her to 1.1 m/s while `withHer` (4089) — T1 → T2 in ~10 lines; the follow task stops being a chase of an object. | `palUpdateTurtle` 2079 | S | medium |
| P4 | **A beach dog** (the locals mention them) — a T3 follower; if Pasto's street dog is a shared module it is a registration, otherwise a copy (**unverified** which). | Pasto dog / `herdOffer` | S/M | medium |

**The wow (3 → 4-5): one change — swap the marquee and make the bloom something you DO.**
Promote `the-manta` to `wow` (shared.js:2820) and file `the-bloom` as the act-3 mini; then make
the bloom active: the task becomes "**light the lagoon**" — be under in the lagoon (`palLAG`,
where the beacon already points) and wheek while `palBloom > 0.55`. The shell (4875-4924) already
exists and reaches 34 m; in a 22 m-radius bowl with 42 m walls it fills the whole room. Add the
manta's position as a second stirrer in `palUpdateBloom` (2976-3001) so a ride taken during the
bloom drags a column of light and the breach throws a lit sheet. New verb for the moment: **the
voice as a light** (wheek-under is built and nothing asks for it). Effort S-M. That is a 4;
the manta with a lit wake and a breach into a lit bay is the 5.

**Scene (visual)**
1. **The karst wall at the top of the arrival frame** needs aerial perspective — two ranges at two
   values, the way Göreme's far range is tinted (goreme.js:5348-5369). (**Unverified** whether
   palawan already tints the island; the frame says not enough.)
2. **Village at dusk:** lit doorways/lamps under the four huts, a second bangka that moves (one of
   the three on the sand, 'three bangkas up on the sand') — the ghost-ship note at 2439-2443
   applied to the rest of the fleet.
3. **The lagoon** gets its own small life: an anemone bed and the ray's second resting place
   inside it (reuse `palBuildSmallLife` per room, 1541).

**Bugs / notes**
- **shared.js:3260 vs palawan.js:4166-4173** — the marquee beacon and its line ("straight down")
  point at the lagoon, a room only reachable under a 1.55 m-deep lintel (79), while the task
  ticks anywhere under water. Not a defect, but the first-time player who follows the beacon
  is sent through the hardest door for a moment that fires on the reef.
- palawan.js:2490 — a stray un-indented `const total` inside `palUpdateBangka` (cosmetic).
- The chapter is in good order otherwise; the previous passes' fixes (turtle-breath vs task
  4070-4089, per-dive banking 4021-4034) all read correct.

---

## CHAPTER 14 — MANLY (`src/manly.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| The sea (swell, shoaling, break, rip, push) | field | T1 (simulation) | phase table so the wavelength shortens as it shoals (587-624); nine-wave set with crest 4 = 1.0 (121, 553); break at amp/depth 0.78 (122); rip channel (104-111); broken-water push as a fixed point (memory note; `manFlowAt` 811); `waterHeightAt` per point (`localWater` 4516-4519) | it pushes the animal through `flow()`/`waterHeightAt` (4522, 4519) | `manUpdateSurface` 3166, `manWaveAt` 643 |
| Bathers | 22 | **T4** | walk to targets the FLAGS set (2510-2528, 3384-3393); avoid the capybara at 3.2 m except while relocating (3406-3413); stand/float/duck under a breaking wave (3418-3451); turn to the set or to a RIDER (3459-3472, 3495-3509); cheer when the flags land or a ride finishes (3478-3482) | yes | `manUpdateBathers` 3380 |
| Surfboat (4 rowers + sweep, merged; oars animate) | 1 | T3 (carrier) | 55 s clock beached/out/turn/in (3667-3712); crew call 3 s before leaving (3681-3687); kinematic hull, rides its own sea (3714-3729); stroke with a placed catch sound (3737-3768); aboard test in hull frame (3774-3783); `the-surfboat` on the way out (3787-3788) | yes (aboard) | `manUpdateBoat` 3657 |
| Dolphins | 4 | T2 | wait 22-40 s then 70-120 s (2486, 3541); pick a set crest ≥0.78 and porpoise in its face (3526-3573); **slide along the crest toward a rider** (3552-3559); rationed note (3585-3592) | yes (rider) | `manUpdateDolphins` 3518 |
| Silver gulls | 30 | **T3** | perch on 21 recorded ledges (2598-2606); come down on a 26-48 s clock (2650-2654); go up at 7 m (calm-shrunk), a wheek < 34 m, a run through them (`flockOffer.scare` 2758-2762), or a falling pine cone (3981-3985); herd-follow obey 2 (2673-2731); perch on the capybara (2713-2718) and stow (2724-2729); land on a dropped chip (2764) | yes | `manUpdateGulls` 2646 |
| Pelican | 1 | T2 | stands on the pool wall; flies to the other end every 30 s or when the animal is within 6 m (3600-3625) | yes | `manUpdatePelican` 3595 |
| Blue groper | 1 | T2 | loops off Shelly; comes to the capybara inside the zone (3634-3638) | yes | `manUpdateGroper` 3628 |
| Flags | 2 | T2 (prop) | either pole picked up with E (3937-3948), carried in front (3861-3876), replanted (3877-3893); the bathers relocate and the task ticks when they arrive (3896-3931) | yes | `manUpdateFlags` 3854 |
| Sandcastle | 1 | T2 | flattened at speed > 1.6 within ~4.5 m; ruin mesh, spray, the builder's voice line (4262-4295) | yes | `manUpdateSurfTasks` |
| Pine cone | 1 | T2 | E under a pine drops it 13 m; lands with a thud and scatters the gulls (3952-4025) | yes | `manUpdateCone` 3952 |
| Foam ×150, spray ×96, haze ×32, buoys ×11, lip | — | T1 | advected by the real flow field (2924-2932) | no | 3268, 3356, 3010, 2874, 3319 |
| Merged crowd figures (promenade, shops, volleyball, tower, bench) | ~29 (comment 4290; 14 `manPutFigure` call sites 1611-1658, some in loops — count unverified) | T0 | one pose each | no | none |
| Locals (guard, club, chips, pool, fish, shelly, volley, partner, ferry) | 9 | T2 (rig) | conditional lines, `onTask`, `praise`; chips and fish have `beat`s (1001, 1035) | yes | 952-1122 |
| Pair-chat | 1 pair | T4-lite | volley↔partner (1126-1133); the file notes no other pair is within 13 m (1080-1086) | no | npc.js |
| Placed voices (`manCall`) | 7 causes | T2 | rip / ride / set / boat / gulls / flag (4426-4448), boat launch (3685), castle builder (4292) | yes | `manUpdateSurfTasks` 4037 |
| Surf bed (sound mover) | 1 | T1 | a positioned break at the bank (4381-4391) | no | — |

**Counts.** T0: ~29 merged figures. T1: the sea, foam, spray, haze, buoys, surf bed. T2: dolphins,
pelican, groper, flags, castle, cone, 9 locals, voices. T3: gulls, surfboat. T4: the bathers.
**Acknowledge the capybara:** bathers, gulls, dolphins, pelican, groper + 9 locals + 3 props.
**Most complex:** the bathers — a crowd driven by two world systems (the flags and the wave field)
and by the rider; then the gulls (five states, herd, perch, stow, chip).

### 2. Scene completeness

*Arrival:* `qa/B2-14-manly.png` is the defective frame ROADMAP-FINISH.md:54/123-126 describes
(a bin and a gull in the foreground, sea filling the lower half). The later
`qa/F1B-manly-from-sydney.png` shows the corrected composition: promenade, crossing, bin,
bubbler, pines, surf club, umbrellas, tents, the flags, bathers, a sandcastle cluster, a bench
with someone on it. Dense and correct for a promenade. *Sea* (`qa/hero-manly2.png`): a flat teal
band with white flecks, the buoy line, the headland — the set is not readable from a standing
frame (ROADMAP-BEAUTY.md:49 "the sea is a band"; the face/foam antiphase in memory note
`capy3-the-sea-has-a-shape` item 4).

Missing for a real surf beach at four o'clock:
- **No surfers.** Twenty-two bathers, a board stuck in the sand ("AND SOMEBODY'S BOARD" in
  `manBuildBeachThings`), a chapter whose whole subject is riding waves — and nobody on a board.
  `grep -ci surfer manly.js` = 3, all in comments. ROADMAP-FUN.md:463 lists "a surfer wipes out"
  as the second-best first-3-min sight; not built.
- **No nippers / children** — the club local talks about them (981); ROADMAP-POLISH.md:690 records
  "children in Rio and Manly — not landed".
- **No traffic** behind the Corso: a road, a bus shelter and bollards exist (1582-1604) but no
  vehicle (`grep` for bus/car/vehicle finds only the shelter and a car park comment).
- **The set is invisible from the beach** (hero-manly2): the marquee's wave is a number
  (`manBigNear`) and a sound (4409-4415), not a shape on the horizon.

### 3. Marquee / wow

- **Marquee task:** `all-the-way` — `wow: 'MANLY'` (shared.js:2866); minis `take-off` (2864)
  and `the-surfboat` (2872). Beacon at (0, −23.8) "out the back, where the sets come from"
  (shared.js:3282) = the bank.
- **New dynamic:** the sea has a shape and it pushes. No new input — the ride is trim: an animal
  in the broken-water band is carried until its speed matches the bore (memory note item 5;
  `riding` at 4053 = swimming ∧ push > 2.2 ∧ foam > 0.12). Getting out to it is the skill:
  duck-dive under white water (`canDive` 4529, task 4200-4203), let the rip take you (4176-4193),
  or the surfboat.
- **Real simulation:** yes — phase table, shoaling, breaking, refraction as a by-product
  (587-643); the bathers, boat, dolphins, foam and player all read the same field.
- **Who controls what:** the player chooses where and when to be; the wave does the ride; the
  ride rig takes the lens (4543-4550). `take-off` fires at speed > 4 m/s (4076-4092) with spray,
  shake and a placed splash; `all-the-way` needs ≥ 34 m ending on sand (4107) and pays with spray,
  shake 0.30, two locals' `saysNow`, a placed cheer with the whole beach off the ground
  (4146-4148, 3478-3482), a 4 s music swell (4324-4329), and an astern `frameShot` (4166).
- **Duration:** a 44-46 m ride on the wave of the set (memory) ≈ 10-12 s; the set returns every
  9 × 8.4 s ≈ 76 s; a record every ride (4108, 4169); ceremony once (4109-4167).
- **Honest rating: 4 / 5.** The best of the three: real physics the player has to read, a crowd
  that turns and cheers, dolphins that come to a rider, a repeatable record, three routes out.
  Not 5 because (a) the player has **no verb during the ride** — no trim/carve along the face, no
  way to extend or angle it; (b) the wave of the set is not a visible object from the sand; (c) the
  ride camera releases 0.9 s before the ceremony (measured in the code's own note 4153-4160,
  patched with a frameShot).
- **Latent:** the surfboat comes back in "surfing it, not rowing it" (3737-3742) and a passenger
  on the return leg gets no ride credit because `riding` requires `swimming` (4042, 4053); the
  bommie detonation (4213-4228) is the chapter's best physical event and is a T2 zone test.

### 4. Recommendations

**NPC / behaviour**

| # | proposal | reuse | effort | impact |
|---|---|---|---|---|
| M1 | **Surfers.** 4-6 instanced figures on boards out the back (the bathers' mesh 2463 plus a board), T3: sit; pick a set crest ≥ 0.78 the way the dolphins do (3526-3528); paddle; ride it in on the same push fixed-point the player uses (`manWaveAt` push); wipe out at foam > 0.7 (a tumble + spray); paddle back out through the rip (`manRipK` 107). They demonstrate the whole chapter before the player tries it — the Göreme decor-balloon argument (goreme.js:2589-2591) — and one wipes out in the first minute, which is the FUN gag ROADMAP-FUN.md:463 asked for. | bathers mesh, dolphins' crest pick, wave field | M | high — the biggest single lift available in this chapter |
| M2 | **Nippers.** Six small instanced figures in a line behind the lifeguard local, tower → water → tower on a 60 s loop, using the flag position the bathers use (2518) so moving the flags moves them too. | bathers pattern, `manFlagX` | S/M | medium — the club's own line becomes true |
| M3 | **Gulls take the castle.** When `manCastleGone` set three gulls' `manGullHeld` targets to the ruin for ~20 s (the chip landing 2764 already does this for a chip; the chips local promises it at 1006). | `flockOffer.land`, `manGullHeld` | S | small but exact |
| M4 | **Bluey follows you into the pool.** `manUpdateGroper` clamps him to Shelly (3639-3640); let him track the animal into the pool zone (the pool local's line 1023 says he does). **Unverified** that the pool and Shelly water are contiguous. | `manUpdateGroper` | S | small |

**The wow (4 → 5): one change — a verb on the wave.** While `riding` (4053), let the stick add a
lateral component along the crest (the crest is a contour of `manBankZ(x)`, 95-102) and a small
speed bonus for angling — trim becomes **carve** — and measure `all-the-way` along the wave's
path rather than pure shoreward `velocity.z` (4056), so the 34 m is earned by holding the face
diagonally rather than by sitting in the white water. Implementation lives in `manFlowAt`
(811) as a rider-input term gated on `manRideDist > 3`, so nothing else that reads the field
changes. Pair it with a visible face: a taller, darker, steeper face and a lip streak for crest 4
(`manUpdateLip` 3319 exists; how visible it is from the sand is **unverified**). Effort M. New
verb: **steering on a wave**.

**Scene (visual)**
1. Surfers (M1) — also the scene fix.
2. **The set as a shape:** hero-manly2 is a band. Give crest 4 a distinct silhouette on the horizon
   (face height ×1.4, a dark face colour ungated from foam for that crest only) so "that one is
   bigger than the others" (4316) is seen before it is toasted.
3. **One vehicle on the Corso road** on a long loop (a bus at the shelter, 1582) and **kids and a
   dog on the sand** (ROADMAP-POLISH.md:690 open item).

**Bugs / notes**
- manly.js:3636-3637 — `damp(tx, capy.position.x, 1, 1)` passes `dt = 1`: a constant 63 % lerp per
  frame regardless of frame time. Harmless (the position is damped again at 3644-3646) but not
  what `damp` is for.
- manly.js:4245-4259 — `manSaysNow('fish'…)`/`('shelly'…)` and `manTask('blue-groper')` run every
  frame the animal is within 3.2 m of the groper until `taskDone` is true; `manTask` at 4216 is
  likewise per-frame during a bommie hit. Both idempotent; noted only.
- `qa/B2-14-manly.png` is the stale defective arrival; `F1B-manly-from-sydney.png` shows it
  fixed. Not a live bug.
- manly.js:4053 — a passenger in the surfboat on its return wave earns no ride (needs `swimming`).
  Reads as deliberate; flagging because the boat's own comment says it surfs in.

---

## Cross-chapter summary

| | Palawan 12 | Cappadocia 13 | Manly 14 |
|---|---|---|---|
| animate classes that read the capybara | 10 + 7 locals | 8 + 11 locals | 5 + 9 locals + 3 props |
| T3/T4 things | bangka, manta / none | balloon, mare, cats / truck | gulls, surfboat / bathers |
| creature↔creature behaviour | none | herd bunching; pair-chat | bathers↔flags↔wave; dolphins↔rider |
| merged static people | 0 (+ boatman, diver) | 25 | ~29 |
| marquee type | clock stat-check (be under) | clock + height stat-check | physics ride, trim only |
| wow rating | 3 (manta 4) | 3 | 4 |
| one change to lift it | swap manta ↔ bloom; "light the lagoon" with the wheek | join the burn + doves round the basket | carve along the face |
| biggest NPC gap | nobody else in the water | the field is a diorama; the truck is invisible | no surfers |

The pattern across all three: the **verbs are strong** (dive, altitude-only flight, a sea with a
shape) and the **crowds are frozen** — 54 merged figures across two chapters with one pose each,
and the busiest real-world scenes (a launch field at 5 a.m., a surf beach at 4 p.m.) are the
ones drawn as geometry. Two of the three marquees are clocks that ask nothing at the moment;
the machinery to make them active (the wheek shell, the sync burn, the flock scare, the ride
rig) already exists in each file.
