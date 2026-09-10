# ROADMAP-DEPTH.md — the crowd, the marquee, and the thirty per cent

Written 10 Sep 2026, from a read-only audit of all nineteen chapters at commit
`1e207ac`: every biome file, `npc.js`, `systems.js`, `capybara.js`, `props.js`,
the nineteen arrival frames in `qa/B2-*.png`, and every prior roadmap. The brief
was the user's: *Sydney and Pasto feel developed; Marrakech and Cappadocia feel
like stationary objects. Lift the weak ones to at least Sydney's depth. Review
the marquee wow moment in every chapter. Produce a roadmap that makes the game
read 30–50 % more polished.*

Every file:line below was read. Nine defects are marked **verified** — I
reproduced each one myself after the audit reported it. Anything I could not
confirm is marked **unverified** and is never used to justify an item.

**One instrument in this review failed and is reported rather than buried.** I
measured per-chapter "how many scene nodes moved in three seconds" over all
nineteen chapters (`qa/behav.json.png`). It ranked Sydney 16 and Kyoto 220,
which is close to the inverse of the truth. The reason is in `npc.js:9`: Sydney
and Pasto's casts are *a shadow hierarchy of Object3Ds not in the scene* whose
matrices are copied into InstancedMeshes, so a `traverseVisible` walk cannot see
them move at all. The instrument measures how little a chapter instances its
crowd. It is not evidence and nothing below rests on it. **The numbers in this
document come from reading the update functions.**

---

## THE TWO HEADLINES

### 1. The game has a three-class crowd, and about seven hundred and sixty people are in the wrong class

Every human in the game is in exactly one of three populations:

| class | what it is | where | count | tier |
|---|---|---|---|---|
| the cast | hand-written state machine per kind, vision cones, ownership, chase, carry | `npc.js` `thinkHuman`/`stepHuman` :7293/:7962, `paThink`/`paStepHuman` :9504/:9697 | ~45, in **2** chapters | T3/T4 |
| the locals | fixed figure: turns to watch, speaks a bagged line, flinches, works a beat | `npc.js` `addLocal` :2323, `localsStep` :4979 | ~150, in **17** chapters | T2 |
| the crowd | instanced density: fidget, lean, walk a lane | each biome's own loop | **~760**, in 10 chapters | **T1/T0** |

The third row is the finding. Chapter by chapter:

| chapter | instanced crowd | does it read the capybara? | loop |
|---|---|---|---|
| Marrakech | ~172 | **no** | `sahUpdatePeople` sahara.js:1759 |
| Rio | 220 grandstand + 38 beach | **no** (the ala turn only during the 4.2 s salute) | `rioUpdatePeople` rio.js:2488 |
| Hanoi | 70 pavement folk | **no** | `hanUpdateFolk` hanoi.js:2964 |
| Monte Carlo | 46 watchers | only while you are *on a car* | `monUpdateWatchers` monaco.js:3201 |
| Manly | ~29 merged figures | **no** (the 22 *bathers* are separate and are T4) | none — static |
| Cappadocia | 25 merged crew + villagers | **no** | none — static |
| Cali | 10 dancers + 18 ringside | only via your dance combo | `caliUpdateDancers` :2551, `caliUpdateWatchers` :3043 |
| Venice | 48 | **yes** — look inside 12 m, pushed inside 2 m | `venUpdateCrowd` venice.js:6039 |
| Hong Kong | 80 | **yes** — stop dead and turn inside 3.5 m | `hkUpdateCrowd` kowloon.js:2615 |
| Circular Quay | 30 | **partly** — stopped ones look inside 12 m | `quayUpdateCrowd` quay.js:4554 |

**Marrakech is not under-populated. It has the most people in the game and not
one of them knows the capybara exists.** That is precisely the feeling the brief
describes, and it is six lines of code per chapter to fix, because five of those
seven loops already carry a per-person yaw target and a damp — they simply have
only one thing to point at (the storm, the parade, the nearest car).

Cappadocia is the other failure mode: **twenty-five people with one pose each**
(`goreme.js:3268-3299`), merged into the scene at build, on a launch field at
five in the morning, in a chapter whose whole subject is a launch. Crew 2 is
"five minutes from going" (`goreme.js:3362`) for the entire chapter and never
goes.

And a structural fact that governs the whole rig: **no local in the game walks.**
`addLocal` copies `rec.x/z` once at registration (`npc.js:2337-2339`) and there
is no walk state. `ROADMAP-FUN` B7 refused the approach for a stated reason —
"walking a hundred and fifty hand-placed people is not a three-hour batch". That
refusal was correct for a hundred and fifty. It is wrong for two per chapter,
and there are chapters where a person's *own dialogue* says they go somewhere.

### 2. Nine of nineteen marquees ask the player for nothing at the moment they fire

Taxonomy of all nineteen, from the trigger code:

| # | chapter | marquee | what the player does AT the moment | rating |
|---|---|---|---|---|
| 2 | Pasto | `condor-ride` | flies — lift ∝ v², thermals, bank, flap | **5** |
| 3 | Circular Quay | `manly-voyage` | drives — throttle, rudder authority bought with way | **5** |
| 4 | Kyoto | `uji-run` | steers laterally in a current that carries them | 4 |
| 14 | Manly | `all-the-way` | trims on a real wave field | 4 |
| 17 | Antarctica | `orca-ride` | drives, holds >5.5 m/s to keep the wake | 4 |
| 5 | Cali | `chiva-mirador` | rides — hops seven cables, no throttle, no wheel | 3.5 |
| 6 | Rio | `samba-parade` | presses on the two inside a moving box | 3 |
| 8 | Marrakech | `dune-surf` | slides — **Iceland's verb** on a straight face, ~8 s | 3 |
| 15 | Pantanal | `the-crossing` | swims, with ≥4 followers | 3 |
| 18 | Monte Carlo | `the-tunnel` | **nothing** — a passenger for 4.5 s | 3 |
| 1 | Sydney | `opera-stage` | **nothing** — stands on a rectangle 1.5 s | 2 |
| 7 | Iceland | `aurora` | **nothing** — sits still 7 s | 3 |
| 9 | The Drift | `lantern` | **nothing** — presses E holding six flies | 3 |
| 10 | Venice | `acqua-alta` | **nothing** — is in the square in an 18 s window | 3 |
| 11 | Hong Kong | `symphony` | **nothing** — is above y 26 in a 39 s window | 3 |
| 12 | Palawan | `the-bloom` | **nothing** — is under water on a 36 s clock | 3 |
| 13 | Cappadocia | `sunrise` | **nothing** — is above 55 m on an 11 s clock | 3 |
| 16 | Sơn Đoòng | `the-doline` | **nothing** — walks into a zone | 2 |
| 19 | Hanoi | `the-train` | **nothing** — stands still on a 96 s clock | 3 |

Verified triggers for the two 2/5s: `systems.js:33729` (Sydney: `inZone` +
`p.y > 0.9` for 1.5 s) and `cave.js:4294-4306` (a zone test, a `frameShot` and a
`music.swell`).

**And the cruellest pattern in the tree: in ten chapters the best dynamic in the
file is filed one rung below the marquee.**

| chapter | the marquee | the better thing, and where it is filed |
|---|---|---|
| Rio | a beat test | **the fragata** — the full `condor.js` flight law, four thermals, a launch shot over the bay. A plain act-3 row. |
| Iceland | sitting still | **the glacier** — `groundSlip`, 130 m, 34 solid seracs, a record. Act 2. |
| Palawan | a clock | **the manta** — the only thing in the game that takes you somewhere by deciding to. A mini. |
| Venice | weather | **the Volo** — a 40 m wire across the square, the whole crowd turning, a pigeon bow-wave. A mini. |
| Kyoto | a comfortable float | **the bell** — a 4.5 s wind, a decision, five systems answering the strike. A mini. |
| Cali | a bus you do not drive | **the barrow** — a real gravity ride with drag and rolling resistance. A mini. |
| Marrakech | a slide | **the souk chase** — the only losable task in the game, six pursuers with last-seen memory. Act 1. |
| Sydney | a rectangle | the gardener **carrying you out of the gate**, the sea-wall plunge, the gull mob, the van roof. All ordinary rows. |
| Sơn Đoòng | standing in a light | **the echo** — the wheek as a torch, three returns whose delays are the room's own dimensions. Taught 100 m earlier. |
| Hanoi | standing still | **the flow** — 240 bikes that see you, swerve, jam and undercut you in the air. `cross-the-road` and `ride-the-flow` carry no `wow`. |

Three of those are fixed by editing `shared.js` and nothing else.

---

## THE THIRD THING, WHICH NOBODY ASKED ABOUT

**Hanoi is the only chapter in the game with traffic on a road.** Counted from
the update functions, chapter by chapter, the moving vehicles are:

Kyoto **none** · Manly **none** · Pantanal **none** (three lines of dialogue name
a truck that does not exist — `pantanal.js:751, 852, 860`) · Iceland eleven
*parked* cars and one snowcat out of town · Marrakech one caravan, 80 m east of
the medina · Cappadocia one chase truck · Cali one chiva · Hong Kong one bus and
three parked taxis on "the densest street in the world" (`kowloon.js:763`) ·
Monte Carlo three racing cars and four cars nobody is ever going to move
(`monaco.js:1617`) · Rio two bondes and a dead Avenida Atlântica.

That is the most consistent "this is a diorama" signal in the game, and the
machinery to fix it exists twice over: `hanLaneAt`/`hanLaneAtS`
(`hanoi.js:456`/:426) and the velocity-differenced kinematic mover
(`quay.js:3611-3630`).

**And nobody boards anything.** You drive a ferry with no passengers, ride a
party bus with no party, take a Star Ferry and an open-top bus with nobody on
them, and ride a cable car alone for 36 s. `quayBuildPax`/`quayUpdatePax`
(`quay.js:4648-4723`) already draws instanced figures inside a hull's frame.

---

## THE CONSTRAINT THAT GOVERNS EVERY ITEM BELOW

From the second beauty pass's own 117-ray measurement (`qa/nx-frame.json.png`):
**the sky is 0 % of the frame in eighteen of nineteen chapters, and 49–97 % of
every frame is within 20 m of the lens.** Nothing in this roadmap spends an hour
on a distant backdrop, a skyline or a horizon. Every item is inside twenty
metres of the animal or is a thing that comes to it.

Frame budget: the 31 Aug review measured 60 fps in all nineteen (16.5–17.0 ms
median, vsync-locked, Intel Arc 130V). **D1 adds no draw calls at all** — it
edits loops that already run. Every later batch that adds geometry states its
draw cost and must be measured before it lands.

---

# THE ROADMAP

Five batches. D1 and D5 are the ones to do first and together: the largest
perceived gain per line in the document, and the credibility items.

---

## D1 — THE CROWD WAKES UP

**~500 figures, seven files, no new draw calls, no new systems.** This is the
single biggest perceived-richness change available and it is one edit repeated.

Five of the seven loops already compute a per-person yaw target and damp it.
They have exactly one thing to point at. Give them a second.

Per crowd loop, three terms:

1. **Look.** Inside `R_look` (8–12 m, widened ×1.6 by the calm registry) blend
   the person's yaw toward the animal with the existing damp. `rio.js:2569-2588`
   is the proven shape in this tree — 220 people keyed to `|x − rioBateriaX|`
   with a lean and a bob. It needs the capybara's position as a second source.
2. **Give way.** Inside `R_step` (~2.5 m) step back 0.4 m along the away vector,
   clamped to the home point so nobody drifts. Venice already does this
   (`venice.js:6178-6185`).
3. **The wave.** On `capy:wheek`, a distance-rationed head-turn front — Rio's
   grandstand already propagates a wave down the avenue keyed to the parade's x;
   the same front from the animal's position costs nothing new.

| file | loop | figures | notes |
|---|---|---|---|
| `sahara.js:1759` | `sahUpdatePeople` | ~172 | has `fid` yaw + damp already. **Do this one first.** |
| `rio.js:2488` | `rioUpdatePeople` | 258 | the `near` term at :2569 is the template; add a second source |
| `hanoi.js:2964` | `hanUpdateFolk` | 70 | bodies already `step()` at :2996 |
| `monaco.js:3201` | `monUpdateWatchers` | 46 | yaw code at :3241 is the template |
| `cali.js:2551`/`:3043` | dancers, ringside | 28 | at combo ≥4 the nearest couple faces the player and mirrors the step |
| `goreme.js:3268` | (static) | 25 | needs D3 — these are merged, not looped |
| `manly.js:1611-1658` | (static) | ~29 | merged; lower priority, the bathers already carry the chapter |

**Measure before and after:** per chapter, the count of crowd figures whose yaw
changed by >0.05 rad while the animal was within 12 m, over a 10 s scripted
walk. Target: 0 → 6–15 in Marrakech, Rio, Hanoi and Monte Carlo.

**Effort S–M per file. Impact: the highest in the document.**

---

## D2 — TWO PEOPLE PER CHAPTER LEARN TO WALK

The locals rig produces a fixed person. That is right for a shopkeeper and wrong
for the eight people in the game whose own lines say they are going somewhere.

**One field, opt-in:** `route: [[x,z],[x,z]], dwell: n` on `addLocal`, lerping
`rec.x/z` *and* `rec.group.position` with a dwell at each end.

Two traps, both already paid for in the tree:

- `addLocal` copies `rec.x/z` once (`npc.js:2337-2339`), so the proximity, bubble
  and witness tests read the registration point. The record must be written every
  frame or every reaction happens where the person used to stand. This is the
  same bug class as `gorCall` (see D5.6).
- A figure registered outside a biome's own build follows the player between
  chapters for ever (memory: `capy3-the-locals`, trap 2).

Who gets one, and why they specifically:

| chapter | who | their own line |
|---|---|---|
| Pantanal | the cattleman and the guide walk to the bank on `panDuskGo` | their bags are rewritten for the crossing (`pantanal.js:4665-4685`) and land 70 m from the water |
| Antarctica | the penguin counter walks his transect | the colony's look code already keys on a point (`antarctic.js:4590-4596`) |
| Sơn Đoòng | two porters between camp and the Great Wall, lamps on | "carried forty kilos over that, twice, today" (`cave.js:3192`); two moving lights 200 m apart in the dark is a signpost |
| Monte Carlo | a pit boss patrols the salon | see D4.10 — this one is also the wow fix |
| Kyoto | a rickshaw runner on Hanamikoji | the lane is the most-walked in Japan and holds two fixed men |
| Cappadocia | a crew chief between two baskets | see D3 |

**Effort M for the rig change, S per person. Impact: high — it is the difference
between a place with people in it and a place with statues in it.**

---

## D3 — THE TWO CHAPTERS THE BRIEF NAMED

### Marrakech — 172 people, one T4 system, and a fiction that is not true

The chapter has the game's only losable task and its only crowd-as-cover idea.
`sahLineOfSight` (`sahara.js:535-543`) tests **souk blocks only** — the comment
at :726-735 says a crowd is cover, and it is visual only.

| # | item | reuse | effort |
|---|---|---|---|
| M1 | **The square notices you** — D1 applied to `sahUpdatePeople` | existing `fid` + damp | S |
| M2 | **Traders tell each other.** When trader *i* sees you, any trader within ~20 m adopts its `lastSeen` (write across `sahPurData[o+6..7]`, :2050-2052). Six lines, and the chase becomes T4. | `sahUpdateChase` :1985 | S |
| M3 | **A crowd is cover, for real.** Add the 28 alley walkers as 0.5 m discs to `sahLineOfSight` :535. | — | S |
| M4 | **The crowd parts along a pursuer's path** — a `fid` impulse when a trader passes within 1.5 m, so you can *see* where they are under the souk roof. | :1786 | S |
| M5 | **Animals west of the gate.** Goats in the palmeraie through `game.herdOffer` (obey 1, wheek) exactly as `iceland.js:3185-3225`; cats on the souk roofs walking a parapet polyline and fleeing inside 3 m. Marrakech is famous for its cats and has none — `grep` finds only comments. | `herdOffer`, `sahMovePerson` :1693 | S–M |
| M6 | **A donkey handcart on a souk lane** — one polyline mover at 1.2 m/s with a kinematic body. The first traffic in the medina and a moving obstacle for the chase. | `sahCaravanPoint` :3906 | M |

M1–M4 together are the step change: they turn the chapter's one great system into
one the player can read, in an arena that is finally awake.

### Cappadocia — a launch field where nothing launches

| # | item | reuse | effort |
|---|---|---|---|
| C1 | **The field launches.** Crew 2's upright balloon (`goreme.js:3362-3389`) leaves the ground on the decor ascent curve (:2584-2587); its two crown-line figures let go; a second crew's fan-fill stands up over the next 60 s (swap the merged ellipsoid at :3341-3350 for a scaled `gorEnvelopeGeo`). | `gorUpdateDecor` | M |
| C2 | **The crew become people.** The 20 merged figures (:3268-3299) get `beat: {kind:'work'/'reach'}` through the locals rig, or an instanced two-pose toggle. | `addLocal` `beat` :2354-2359 | M |
| C3 | **Put the driver in the truck** and speak from it — see D5.6, which is a verified bug. Add an amber beacon so the truck reads from 150 m; the best system in the chapter is a khaki box in a khaki valley. | `gorGlowMat` :326 | S |
| C4 | **Call the mare.** A wheek within 45 m while `gorHerdWait > 0` ends the wait, so the best kinetic thing in the chapter stops being a 23 s intercept. The herd already spooks on that exact test (:4806). | `gorUpdateWheek` | S |
| C5 | **Doves that come down.** The flock offer is scatter-only (:2136-2139); give it `at`/`put` so a dropped chip or a sat-down capybara brings a dozen onto the paving. | `flockOffer`, Manly's gulls `manly.js:2703-2757` | S/M |
| C6 | **Lit windows** before dawn — the `gorWindow` boxes (:1492, :1509, :1682, :1920) are painted, in a cave town at five in the morning. Drive an emissive instance off `gorSun` as the bulbs already are (:4064-4073). | | S |

**C1 is the chapter.** The arrival frame becomes an event you watch from the
plaza, and the promise the chapter makes out loud — "eighty of them go up at
first light" — is kept within twenty metres of the lens for the first time.

---

## D4 — THE MARQUEE PASS

### D4.0 — Three re-tierings, which cost only `shared.js`

Do these first. They are the cheapest quality in the whole document and they add
no simulation whatsoever.

1. **Rio: `fragata-ride` becomes the `wow`, `samba-parade` becomes the second
   mini** (`shared.js:2620`, :2632-2644). The chapter already contains the full
   `condor.js` flight law with four authored thermals (`rio.js:4218-4227`). Move
   the marquee pin to Arpoador where the thermals begin. Act 3's kick line
   already hints it: "there is a cable car, and there is a much better way up"
   (`shared.js:3197`). The middle-rung rule forbids two of a kind — a flight and
   a beat are not the same kind, so the chapter keeps one of each.
2. **Palawan: `the-manta` becomes the `wow`, `the-bloom` the act-3 mini**
   (`shared.js:2814`, :2820).
3. ~~**Iceland: `glacier-run` moves to act 3, after `aurora`.**~~ **REFUSED on
   contact with the chapter, 10 Sep 2026.** Iceland's act 2 kick line is
   *"the ground stops holding you somewhere past here"* — it **is** the glacier,
   and moving the row out of that act orphans the line that announces it. Act 3
   is *"there is nothing left to knock over. good."*, which a twenty-metre-a-
   second toboggan run is the opposite of. The observation underneath the item
   still stands — nobody ever slides under a lit sky, and `glacier-run` is a
   RECORD so it is repeatable at will — but the fix is a line inviting the
   player back up after the aurora fires, with the snowcat waiting, and that is
   content, not bookkeeping. It moves to Tier 3.

   *Two re-tierings shipped, not three. Recorded here because this document's
   own preamble promised the first two would cost only `shared.js`, and the
   third would have cost the chapter something.*

### D4.1–D4.13 — One verb per chapter, ordered by impact over effort

| # | chapter | the one change | the new verb | effort |
|---|---|---|---|---|
| 1 | **Hong Kong** | **Conduct the harbour.** Above `hkSHOW_ROOF`, a wheek advances the next tower *now* (snap `hkLitCount++`, re-zero `hkBeatAcc`), sends M2's wave back from your end, flips M3's odds/evens, and fires the finale on the eighth wheek or the clock. The Kowloon-side sweep (`kowloon.js:3641`) points across the water at each one. | **call-and-response on a live audio clock** — nothing else in the game does it, and it costs one input read inside the function that already owns all five light channels | S/M |
| 2 | **Palawan** | **Light the lagoon.** The bloom task becomes: be under in `palLAG` — where the marquee pin already points — and wheek while `palBloom > 0.55`. The shell exists (`palawan.js:4875-4924`) and reaches 34 m; in a 22 m bowl with 42 m walls it fills the room. | **the voice as a light** | S/M |
| 3 | **Cappadocia** | **Join the burn.** `sunrise` ticks only if `gorBalBurn > 0.5` at the frame `gorSun` crosses 0.465, with the chief calling it on the radio and the dove flock's loop centre (`goreme.js:2201`) moved to your basket so 260 birds wheel round you as the light hits them — which the dovecote local already promises out loud (:5674). | **timing your burner with the valley** | S/M |
| 4 | **Sydney** | **Lead the birds to the sails.** Carry the chips or the stolen sandwich to the podium: the gull mob trails the *held* prop (extend `qgStep`'s target from a loose prop, `npc.js:11158`), the ibis follow on the herd at obey 1 (:11729), the tourists on the steps startle and photograph, `stageGlow` and `operaShot` fire when the flock arrives. Record: birds on the stage at once. | **leading a flock** — and chapter 15's herd finally gets a chapter-1 rehearsal | M |
| 5 | **Venice** | **The surge.** Publish `flow()` for the ramp and the ebb — the same reference-frame channel the Drift's `wind()` uses (`drift.js:5522-5526`) — 1.2–1.5 m/s down the square toward the Molo while `lvl` is 0.55–0.80, reversed on the ebb. `acqua-alta` becomes *be in San Marco when it goes under and stay on your feet*. Everything downstream already answers the same `lvl`. | **swimming in moving water** | M |
| 6 | **Marrakech** | **Give the dune a shape, and let the caravan take you up it.** Three secondary crest lips across the slip face in `sahTerrain` :405 so a 15 m/s run leaves the ground on the convexities — real physics, no scripted launch. Extend `sahCaravanPoint` :3906 up the shoulder track and hold at the top for a passenger, so the carrier delivers you to the marquee instead of charging a 110 m climb per attempt. | **jumping sand lips at speed** — and it stops being Iceland's verb | M |
| 7 | **The Drift** | **The lamp-lit descent.** On `driLit`: respawn a seed-head at the plinth, lock the wind for 60 s to a bearing running back down the arrival route at `driWIND_MAX`, keep the beacon front and the lampflies lighting the islands under you. Two hundred metres home through your own lit archipelago. | **steering a wind-carried fall** — and `driftseed` gains a route instead of five random seeds | M |
| 8 | **Monte Carlo** | **The tow.** Give `monCarTarget` :2584 a following term (cap to the car ahead inside 18 m, +8 % slipstream inside 8 m — Hanoi's brake law :1643 is the shape) so the three cars bunch; then hop roof-to-roof in the bore at 26 m/s. `capyPLAT_AIR` (`capybara.js:382`) already latches the deck frame through a jump — it is what the chiva's cable hop rests on. Also fixes the record, which is currently a deterministic function of arclength (see D5.9). | **a frame-relative hop between two moving carriers** | M |
| 9 | **Hanoi** | **Out on the roof.** Horn → the street folds → climb a wall onto a folded awning (3.5 m, `hanoi.js:2040-2041` — they need a pooled box each) → the train comes through at 11 m/s → drop onto the 3.4 m roof → carried out over the crossing, with `frameShot` finally free to pull back once you clear the alley. The train is already a velocity-differenced kinematic body (:2160-2168); the carrier contract is already published for the tray (:3603). | **a timed drop onto a moving carrier** | M/L |
| 10 | **Sơn Đoòng** | **Come down the column.** Publish `climbHold` on the doline breakdown (`cavClimbAt` :542 exists), climb 25–30 m, step off: the 16 doline swifts form on the falling animal exactly as the gentoos form on the bow (`antarctic.js:4728-4760`), the crane rides at full, the motes stir, the pool under the fall is the tick. Keep standing in the light as the act-2 entry. | **a drop through light, with company** — the chapter's one vertical | M/L |
| 11 | **Manly** | **Carve.** While `riding` (`manly.js:4053`) let the stick add a lateral component along the crest and a small speed bonus for angling, and measure `all-the-way` along the wave's path rather than shoreward `velocity.z` — so the 34 m is earned by holding the face diagonally instead of sitting in the white water. Lives in `manFlowAt` :811 as a rider-input term gated on `manRideDist > 3`, so nothing else that reads the field changes. | **steering on a wave** | M |
| 12 | **Antarctica** | **The pod leads.** Add a `run` state after `escort`: the pod centre follows the lead polyline (`antLeadX` :626) north at ~11 m/s instead of damping onto the boat (:4181-4182); the wake gain and the ride clock accrue only inside `antPOD_HOLD`. Falling out for >6 s drops them back to `patrol`. Today the escort is glued to you and cannot be lost except by slowing. | **a chase through moving ice** | M |
| 13 | **Pantanal** | **The river contests the line.** Apply `panFlowAt` to swimming followers in `panUpdateHerd` :3138-3160 so the line bows downstream; a follower more than ~2× the gap off its trail point drops to `graze`; a mid-river wheek re-recruits at a wider radius. The pups should be the ones that lose the line first. Today the followers ignore the current the rafts ride. | **leading a line through moving water and re-gathering it when it breaks** | M |
| 14 | **Kyoto** | **A weir at the last narrow.** `kyoRIVER_W` already pinches to 5.5 m at t = 0.93 (:2735); make it a 1.5 m drop with a drawn lip, a `capy.launch`, a clean-tongue bonus under 2 m of lateral offset and a spill on the rock shoulder. The run gains a climax and stops having one shape from the first attempt to the tenth. | **lining up** | M |
| 15 | **Cali** | **Passengers the cables take.** Eight instanced figures parented to the chiva in bus-local coordinates, four boarding at each 5 s stop, dancing on the roof to `music.beats()`, ducking with `caliBandDuck`. Each cable knocks one off unless you hopped it clean. The hop becomes a responsibility and the party bus gets a party. Also: let `caliChivaS` run back down the route after 40 s empty so the set piece can be ridden twice. | stakes on an existing verb | M |

---

## D5 — WHAT IS ACTUALLY BROKEN

Nine defects. Numbers 1–6 I reproduced myself; 7–9 are from the audit and are
marked with what was and was not confirmed.

1. **Rio leaks a three-hundred-shape body on every entry. VERIFIED.**
   `rioBuildPeopleBodies(game)` is called at `rio.js:4074`, which is inside
   `onEnter()` (:4058) and not inside `ensureBuilt()` (:4057) — the stray
   indentation says it was pasted into the wrong block. It builds a static
   compound of ~300 boxes and calls `game.world.addBody` (:2462). `captureTag`
   is set to the destination *before* `onEnter` runs (`main.js`), so every copy
   is captured under the `rio` tag and every copy is re-added on the next
   entry. Visit Rio five times and the broadphase carries five of them.

2. **Antarctica's control line has never been shown to anybody. VERIFIED.**
   `antSay(s)` (`antarctic.js:463-467`) calls `g.say(s)`. `game.say` is
   `npcs.say = sayAt(x, y, z, text)` (`main.js:1889`, `npc.js:2508`). The string
   lands in `x`, `text` is `undefined`, and `sayAt` returns at its own
   `if (!text)` guard — while the `antToast` fallback is skipped, because
   `typeof g.say === 'function'` is true. The lost string is
   `'W/S throttle · A/D tiller · Q to call · E to step off'` (:3663), in the one
   chapter subtitled *and you are not walking anywhere*. Two call sites.
   `quay.js:4869` has the same call shape and should be checked with it.

3. **The on-car test in Monte Carlo rotates the wrong way. VERIFIED
   numerically.** `monaco.js:2687-2688` sets `c = cos(-yaw), s = sin(-yaw)` and
   then applies `lx = dx*c - dz*s`, which is R(+yaw) on a world delta where
   R(−yaw) is wanted. At yaw 45°, a point 2 m behind the car on its own axis
   comes back as `lx = −2, lz = 0` — the box is turned 90°. The roof box is
   0.94 × 2.10 (:252), a 2.2 : 1 rectangle, so this is not cosmetic; the
   0.3 s grace latch at :2693-2705 exists to hide a symptom this partly causes.
   Correct form: `lx = dx*cos(yaw) − dz*sin(yaw); lz = dx*sin(yaw) + dz*cos(yaw)`.
   Same class as `capy3-reference-frames` #4.

4. **Cappadocia's whole valley snaps dark on the exact frame of its own
   marquee. VERIFIED.** `goreme.js:2717-2718`: the else branch of `gorSyncBurn`
   is `(1 - gorSmooth(...)) * 0`. The comment above it promises the term "dies
   over the sunrise itself"; multiplied by zero, it drops from ~1 to 0 in one
   frame at the instant `toSun` crosses 0 — which is the frame `sunrise` fires.

5. **Iceland's sheep carry a dead term. VERIFIED.** `iceSheepSpook` is declared
   (`iceland.js:3168`), decremented (:3181) and read in the speed term (:3267)
   and is **never assigned** anywhere in the tree. The header comment at :3132
   ("They scatter when wheeked at") is stale — the wheek now recruits them
   through `herdOffer` (:3206), which is better. Remove both.

6. **Cappadocia's chase driver speaks from the wrong end of the valley.
   VERIFIED by reading.** `gorCall` (`goreme.js:4651-4661`) always speaks from
   the local's registration point, so "I am right underneath you" (:4691) and
   "You are a speck" (:4684) are drawn at the landing plain (:5693-5694)
   regardless of where the truck is. This is the same class as the D2 trap.

7. **Four people in Sydney are called `queue` and can never queue. VERIFIED.**
   `npc.js:976` pushes four roster entries of kind `'queue'`; the van-queue join
   test at :7439 admits `tourist` and `commuter` only, and :6751 gives them no
   prop and no camera. They are tourists with less to do, in the chapter that is
   the reference for everything else.

8. **Two shared reaction hooks are still gated on Sydney, and chapter 2 pays.**
   `castReact` (`npc.js:4124`) is behind `biomeLive()`, so a shatter or a spill
   in Pasto startles nobody except through the vendor-only `prop:impact` handler
   at :10711. And `npcBargeSweep(dt, paHumans)` (:11698) never sweeps
   `paBeasts`, so barging a dog fires no `npc:barge`. Exactly the
   shared-module blindness the memory notes warn about, still open for the
   game's second chapter.

9. **Hanoi's jam is forty independent brakes.** `hanUpdateBikes`
   (`hanoi.js:1527-1668`) is a single flat loop with the capybara as the only
   other party — verified, no inner loop over bikes. One lookahead term (a rider
   inside 6 m behind a slower rider in the same lane with |Δoff| < 1.2 m brakes
   toward it, reusing the brake law at :1643) makes the game's best system
   propagate, and gives the horn a reason. Lane-bucket by `s` to keep it O(n).

Also recorded, lower priority and each cited in the audit files: `sahErgT` never
decays so a second visit east can trigger the storm in 2 s (`sahara.js:4539`);
Kyoto's comment at :1600-1607 says the bell puts the cormorants off their boats
and `kyoUpdateBirds` (:3184-3226) never reads the bell pulse; the ukai master
says "twelve birds" and there are six (:4810 vs :3129); `cavSeenLight` is not
reset in `onEnter` so the doline's shot is once per *session* while Antarctica
and the Pantanal reset theirs; four `force: true` unplaced sounds that ignore
distance while their neighbours in the same sequence are gated
(`venice.js:4414`, :3481, `kowloon.js:4199-4200`, :3885).

---

## ORDER, AND WHAT EACH TIER BUYS

**Tier 1 — do first. No new systems, no new draws.**
D5.1–D5.6 (the six verified defects) · D4.0 (the re-tierings — **two of the
three; the Iceland one is refused above and moves to Tier 3**) · D1 for
Marrakech, Rio, Hanoi and Monte Carlo.
*What it buys:* about five hundred people start reacting, Rio and Palawan gain a
flight and a creature as their headline moment at the cost of two `shared.js`
edits, a compounding physics leak stops, and the one chapter with a vehicle you
must be taught to drive starts teaching it.

**Tier 2 — one small system, applied everywhere.**
One ambient mover per chapter on the `hanLaneAt` / velocity-differenced patterns
· passengers on the four empty vehicles via `quayBuildPax` · D2 (two people per
chapter walk).
*What it buys:* the diorama signal goes away. This is the tier that most
directly answers "make each biome look richer and more complete".

**Tier 3 — the marquee verbs.** D4.1–D4.9, in the order given: Hong Kong,
Palawan, Cappadocia, Sydney, Venice, Marrakech, the Drift, Monte Carlo, Hanoi.
*What it buys:* nine chapters stop asking the player for nothing at the moment
the banner drops.

**Tier 4 — the named chapters, finished.** D3 in full (M1–M6, C1–C6) ·
D4.10–D4.15.

**Tier 5 — the layer nobody has built yet: something eats something.**
Verified: nothing in the game hunts. Palawan's terns "work" the bait ball by
placement, not behaviour (`palawan.js:3337-3367`); Antarctica's skua stoops and
the colony's reaction exists only in a comment (:4848-4852); the Pantanal's
otters shout about a jaguar the chapter never shows (:836); fourteen caimans
slide *away* from a herd and that is the whole interaction. One predator event
per wildlife chapter — a tern strike that scatters the ball, a skua dive that
starts a display wave from the point it lands, one jacaré that surfaces
downstream of the crossing line — is the cheapest ecosystem in the world and it
is the difference between a set and a place.

---

## WHAT THIS DOCUMENT DELIBERATELY DOES NOT TOUCH

- **The incident chain and the marquee law** — inherited refusals from
  `ROADMAP-FUN`, and both still hold. One `wow` per chapter; a second would
  halve the first.
- **The fixed hour.** `weather.js` says there is no clock in it and never will
  be. C6's lit windows are keyed to `gorSun`, which is the chapter's own
  existing dawn ramp, not a day.
- **Sky, skyline, horizon and distant backdrop of any kind.** Measured at 0 % of
  the frame in eighteen of nineteen chapters. Sydney's missing CBD and Rio's
  hard Atlantic horizon are real, and they are not worth an hour against
  anything above.
- **Sydney's and Pasto's casts.** They are the reference. The only Sydney items
  here are a marquee that is a rectangle (D4.4) and two gating bugs that hurt
  chapter 2 (D5.7, D5.8).

## PREMISES TO MEASURE BEFORE BUILDING

In this repository's tradition, and because `ROADMAP-FUN`'s standing note
records eighteen of its own claims failing on measurement:

1. **D1's frame cost is claimed to be zero.** Verify: these are existing loops,
   but `sahUpdatePeople` runs over ~172 people and a distance test per person per
   frame is new work. Measure the median frame time in Marrakech before and after.
2. **D4.2 assumes the wheek shell reaches the lagoon walls.** The shell is
   stated at 34 m and the bowl at 22 m radius with 42 m walls — read from
   comments, not measured. Sweep it.
3. **D4.5's surge must not break the duckboard run.** The planks clear
   `waterLevel + capySWIM_ENTER`, so by construction the flow is under them —
   confirm with the timed run before and after.
4. **D4.9 assumes the generic wall climb reaches a Hanoi awning.** The fallback
   at `capybara.js:2153-2165` applies to any chapter that publishes no
   `climbHold`, and Hanoi publishes none — but the awnings are draw-only
   (`hanoi.js:2040-2041`) and need a pooled box each first. **Unverified in play.**
5. **D4.8's slipstream changes a shipped record.** `the-tunnel`'s par is
   calibrated against a speed law that has no car-car term; adding one moves it.
6. **The Cappadocia tether already permits a passenger on a collider that is
   removed at 104 m** (`goreme.js:4921-4936`). Either a hidden gag or a fall from
   a hundred metres. **Unverified in play** — check it before C1 goes near it.
