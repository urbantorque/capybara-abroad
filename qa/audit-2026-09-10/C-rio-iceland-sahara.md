# Audit C — chapters 6 Rio, 7 Iceland, 8 Marrakech / the Erg

Read-only audit, 10 Sep 2026. Files: `src/rio.js` (4637 lines), `src/iceland.js` (5595), `src/sahara.js` (5390), `src/condor.js` (2811, shared flier). Screenshots: `qa/B2-06-rio.png`, `qa/B2-07-iceland.png`, `qa/B2-08-sahara.png`. All line numbers are from the current tree (commit 1e207ac). "Unverified" means I could not confirm it from code or the PNG.

Tier key: T0 static · T1 ambient loop · T2 reactive (reads the capybara) · T3 stateful actor · T4 systemic (talks to other NPCs / world systems).

---

## Chapter 8 — Marrakech and the Erg (`src/sahara.js`) — audited first, at the user's request

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Medina crowd (instanced djellabas; STAND/SIT/PLAY) | ~172 (cap `sahPPL_MAX` 250, sahara.js:1610). Placed by: souk fountain sitters :575-576, stall-fronts :645-649, 28 alley walkers :716, 14 stall vendors + 7 eaters :1054-1059, 3 storytellers + 39 ring sitters + 9 standing :1091-1114, 16 loose :1118-1123, 8 snake audience :1508, ksar :2369, 5 gnawa :3708, 7 camp sitters :3741, 2 tent watchers :3747, 3 cameleers :3887 | **T1** | Per-person "decision clock" fidget (:1786-1794), halqa rings lean/laugh on three clocks (:1766-1774), gnawa rock on the beat and stand up when the band is taken over (:1832-1838), everybody leans into the storm (:1762). **Never reads the capybara's position** — the only inputs are `sahStorm`, `sahFireTakeover`, `sahTime` | no | `sahUpdatePeople` :1759-1869 |
| Six traders (pursuers) | 6 (`sahPURSUER_N` :77) | **T3/T4** | Idle at home stalls; on the cart theft: 1.3 s "realising" beat facing you (:2019-2029), then chase the LAST-SEEN position with a 6-sample line-of-sight test against souk blocks only (:2043-2056, `sahLineOfSight` :535-543), cast about when they arrive at it (:2078-2082), axis-separated steering through `sahNavBlocked` (:2084-2088), near-miss latch + line (:2057-2077), catch after 0.45 s inside 1.5 m → `capy.launch` shove (:2094-2118), lose after 2 s unseen and >8 m (:2122-2136), 7 s re-arm, drift home at 3 m/s (:1994-2011). Dust off their feet (:1949-1953) | yes (sight + memory) | `sahUpdateChase` :1985-2136 |
| Acrobats of Amizmiz | 4 | **T2** (input-driven) | Bob on the spot; E on the 1.6 m mat → 1.25 s crouch → `capy.launch(3.2, 22, …)` ≈ 10 m apex, 22-puff dust ring, 0.45 s "extension" pose (:818-918). 3 s cooldown. Mini `acrobats` ticks at ≥7.5 m apex | yes (mat + E) | `sahUpdateAcrobats` :818-918 |
| Cobra | 1 | **T2** | Rises out of the basket whenever something is in it, looks at whatever is in it, sways (:4798-4820) | yes | inside `sahUpdateTasks` :4755 |
| Snake charmer (merged, static) | 1 | T0 | Cylinder + sphere + flute merged into the basket mesh (:1457-1460) — **see bug 1, it overlaps the addLocal charmer** | no | none |
| Caravan: 5 camels + 4 legs each | 5 | **T1 + carrier** | Fixed route gate→camp, `sahCaravanPoint` :3906-3911, pace gait/roll (:3927-3947), kinematic saddle on the lead camel with honest velocity + `carryFrame` (:3973-4000); task at t>0.72 while aboard (:4018-4025). **Wraps by teleport** at t>1.18 (:3915) with no hold for a passenger | rider only (aboard test :4017) | `sahUpdateCaravan` :3913-4037 |
| Cameleers | 3 (indices in `sahCarPeople`) | T1 | Same instanced crowd, moved every frame with a stride bob (:3958-3969, `sahMovePerson` :1693) | no | via caravan |
| Storks over the Koutoubia | 5 (`sahSTORK_N` :4309) | **T1** (+ distance-rationed sfx) | One on the parapet that throws its head back and clatters every 11 s (:4356-4361, sfx gated <70 m :4394-4409), four in a banked gyre with rare flaps (:4363-4379) | volume only | `sahUpdateStorks` :4349-4421 |
| Orange-juice cart | 1 | T0 prop + trigger | E within 3.2 m robs it, tips 0.24 rad, starts the chase; re-robbing re-arms the chase after 7 s (:4761-4775) | E only | `sahUpdateTasks` |
| Date palm bunches | 1 | T0 prop + trigger | E within 2.9 m → bunches fall with a bounce (:4471-4504). One-shot for the page (`sahDateDone`) | E only | `sahUpdateDates` :4471 |
| Haboob (storm wall + phase machine) | 1 | **T2 weather actor** | 4-phase machine gated on x > `sahERG_X` 165: 22 s warn → 7 s build → 20 s hold → 9 s fade; leans 6.2 m/s through `capy.shove` (:4617-4620); the wall tracks the capybara's x/z (:4239-4267); leaves the sun down (`sahDuskOn` :4577) | yes (position + shove) | `sahUpdateStorm` :4528-4622, `sahSyncStormWall` :4239 |
| Dust pool | 150 (`sahDUST_N` :129) | T1 | Spray on the dune, chase feet, throw ring, storm (:4039-4130) | indirect | `sahUpdateDust` :4075 |
| Brazier smoke | 14×5 puffs | T1 | Leans downwind, thickens at dusk/storm (:4149-4198) | no | `sahUpdateSmoke` :4149 |
| Fire + light pool | 1 | T2 (via E) | Grows ×1.9 and throws sparks during the 9 s takeover (:4823-4885) | E only | `sahUpdateTasks` |
| Stall lamps | 14 (one mesh) | T1 | Emissive tracks `sahDusk` (:4853-4857) | no | `sahUpdateTasks` |
| Souk roofs | 1 mesh | T1 | 5 cm sway (:5031) | no | api.update |
| Locals (addLocal rig) | 10 + 1 traveller: cart :5117, traveller :5146, snake :5154, acrobat :5176, halqa :5200, dyer :5222, water-seller :5240, maalem :5257, gate :5284, palm :5305, dune :5324 | **T2/T3** (shared rig: flinch, watch, before/after/when lines, onTask, praise, work beats, the mischief economy in npc.js) | Four `addExchange` pairs (:5352-5385) | yes | npc.js `localsStep` |

**Summary.** T0: 2 (static charmer figure, cart/palm props) · T1: ~200 instances in 8 classes (crowd, cameleers, camels, storks, dust, smoke, lamps, roofs) · T2: cobra, acrobats, fire, storm, 11 locals · T3/T4: **the six pursuers only**. Things that acknowledge the capybara at all: pursuers, acrobats (E), cobra, storm, 11 locals — **the ~172-person crowd, the entire souk population and the whole camp never do** (`sahUpdatePeople` has no capy read; the caravan's three cameleers don't either). The most complex behaviour is the chase: last-seen memory + LOS + near-miss + catch/lose is a real T4 system and the best thing in the chapter.

### 2. Scene completeness

From `qa/B2-08-sahara.png`: the square reads as a flat orange plane in heavy haze (`weather.js:257-266` "Kiln Noon") with 6–7 stall canopies, ~40 identical hooded cones, the acrobat mat and a scatter of `props.js` baskets/bowls/cones. The Koutoubia (x −52) is out of frame; the haze eats everything past ~60 m so the palmeraie and the gate are not visible from the spawn. The crowd is dense but reads as a production run because nothing in it turns, walks or parts.

What is there (dense for this project): 14 stalls with tagines/samovars/lamps/braziers (:1000-1060), three halqa rings, souk with 32 blocks, six trades on the stall fronts (`sahBuildTrades` :2434), roofscape with tanks/washing (:600-640), the wall with merlons and towers, Bab Agnaou (:1128-1240), the Koutoubia (:1245), 90-palm palmeraie with seguia and a ksar, khettara shafts, 4 towers, the camp with four khaimas, the great dune with a staked walk-up track (:2327), a muezzin ambience anchored on the minaret (`systems.js:1236`).

Obviously missing for a real Jemaa el-Fnaa / Erg:
- **Nothing on wheels or hooves in the medina.** No calèche (horse carriages ring the real square), no donkey with panniers in the souk, no mopeds, no handcarts. The only vehicle in the chapter is the caravan, 80 m east. The souk chase has zero moving obstacles.
- **No animals at all west of the gate.** Marrakech is famous for its cats; the palmeraie has goats/donkeys; none exist (`grep donkey|goat|cat` → only comments). The five storks are the only non-human life in 340 m of map.
- **One orange cart.** The real square has a row of ~40 numbered juice carts; here the trigger is a single cart (:1388-1418).
- **The crowd never moves.** Every one of ~172 stands where it was placed at build (`sahMovePerson` exists only for the three cameleers, :1693). Jemaa el-Fnaa's defining quality — people on their way somewhere — is absent; the note at :1119 ("people on their way somewhere else") describes a wish, not the code.
- Souk alleys: 28 walkers all static; the "crowd is cover" claim (:726-735) is visual only — `sahLineOfSight` :535 tests souk blocks only, people don't break LOS.
- Known-open from ROADMAP-BEAUTY.md:43 "a souk at noon with no shade under any stall" — awnings now exist and `castShadow=true` (:1000-1010, mesh :1236); whether shade actually lands under them at the 61° sun is **unverified**.
- ROADMAP-FUN.md:457 "put the orange cart 8 m from spawn" — cart is at (9,1), spawn (0,8): 11.4 m; ROADMAP-FUN.md:842 confirms 11.4 m. Open by 3 m.

### 3. Marquee / wow

- **Marquee:** `dune-surf` "Come down the great dune", `wow: 'THE ERG'` (shared.js:2688); CHAPTERS marquee at (276,10) (shared.js:3215). Mini: `acrobats` (shared.js:2693).
- **What it is:** 100 m of 23° sand with `groundSlip` 0.72 on the centre band (:460-473) — the **same verb as Iceland's glacier** (capybara.js reads `groundSlip`), on a straight face with **no obstacles, no line choice and no jump** (the glacier has 34 solid seracs, iceland.js:3355-3400, and a U-wall). Real simulation (it is the physics slip), player-controlled. Dressing: 22-puff drop-in (:4650-4660), a speed-driven boom drone (:4672-4682), spray rationed by speed (:4737-4752), a 3.5 s framed shot at the bottom (:4712-4715), bloom row (`systems.js:28932-28935`), record `dune-surf` top speed. Fail path: stall <3.2 m/s for 1.8 s → "bogged" (:4683-4690); repeatable, walk-up track on the shoulders.
- **How it is reached:** on foot, 276 m east of spawn through the gate, palmeraie and hamada; the caravan (the only carrier) ends at `sahCAMP.x - 8` = 174 (:3907), 100 m short of the crest, so every attempt is a ~110 m climb up the staked track.
- **Rating: 3/5.** It is a re-run of chapter 7's verb with better sound. Not on rails, not a stat-check — but the run is one long straight with nothing to steer round, and it lasts ~8 s. Against the ferry helm / condor / bamboo climb / Hanoi it introduces no new dynamic to the player.
- **Latent big moments, underexploited:**
  1. **The chase** (:1985-2136) is the chapter's real novelty — the first losable task, pursuers with memory — and it is act 1 filler with a `better:'lower'` record. It is fought in an arena where nothing else moves.
  2. **The storm** (:4528-4622) is the only weather that pushes the animal, and its task is "stand still for 11 s" (`sahSTORM_TASK` :103). A 6.2 m/s shove exists and nothing asks you to move through it.
  3. **The acrobats' launch** (10 m apex, :752) lands you back on the mat; there is nothing to land ON (an awning is 2.7 m, :868).

### 4. Recommendations

**NPC / behaviour (step changes):**

1. **Make the square notice you (M, high impact).** `sahUpdatePeople` :1759 already has per-person `fid` yaw and a damp; add one capy-distance term the way Rio's stand keys on the parade (rio.js:2569-2588 `near` → yaw toward, lean): inside 6 m people turn to face the animal and step back half a metre; on `task:complete` in the square the nearest ring turns (the halqa clock :1766 can pause for a beat). Reuse `localsReact`'s distance falloff shape (npc.js:2649). This alone converts ~172 T1 statues into T2 and is the single cheapest 30 % gain in the chapter.
2. **Give the chase a crowd (M, high).** (a) Pursuers propagate sightings: when trader *i* sees you, any trader within ~20 m adopts its `lastSeen` (write `sahPurData[o+6..7]` across the loop at :2050-2052) — T4 for six lines. (b) People in alleys break line of sight: add the 28 alley walkers' positions to `sahLineOfSight` :535 as 0.5 m discs, so "a crowd is cover" (:726) becomes true. (c) The crowd parts along a pursuer's path (a `fid` impulse when a trader passes within 1.5 m, :1786) so the player can *see* where the traders are under the souk roof — the same wave-down-the-avenue trick Rio uses for free.
3. **Animals west of the gate (S–M, high).** A goat/donkey flock in the palmeraie through `game.addCritter` + `game.herdOffer` exactly as iceland.js:3185-3225 (obey 1, wheek) — the herd rig already handles follow/approach; the camel geometry (:3826-3862) scaled 0.5 with the pace gait is a passable goat. Cats on the souk roofs as T1 movers under the "things that are simply there" rules (walk a parapet polyline :620-640, sit, flee inside 3 m).
4. **A donkey handcart on a souk lane (M).** One polyline mover (the caravan's `sahCaravanPoint` pattern :3906) running the centre alley at 1.2 m/s with a kinematic body: a moving obstacle for the chase and the first traffic in the medina.

**Wow (rating 3 → 4–5): give the dune a shape and let the caravan take you up it (M).**
- Add three secondary crest lips (barchan chains) across the slip face in `sahTerrain` :405 / `sahCrest` :401 so a 15 m/s run leaves the ground on the convexities — real physics, no scripted launch (the geyser channel is not needed; the terrain does it). The boom (:4672) pitches up while airborne; `dune-surf` gains a second record ("longest air"). The walk-up track (:2327) stays on the shoulders. New verb: **jumping sand lips at speed** — the Drift's air on the ground.
- Extend `sahCaravanPoint` :3906 so the string climbs the shoulder track to the crest (the real Erg Chebbi trek does), and hold at the top while somebody is aboard (copy Rio's parade hold, rio.js:3474-3496) instead of the teleport at :3915. The carrier then delivers you to the marquee every attempt — the same pacing fix the snowcat is for the glacier (iceland.js:5040-5060).
- Optional second beat: arm the storm's shove as a *tailwind* on the lee face (`capy.shove` :4619 already exists) so a run under the haboob is the fastest possible one — "come down the dune in the storm" as a record, not a new task.

**Scene (2–3 visual adds):**
1. A row of six juice carts (static copies of the cart merge :1391-1408) on the square's east edge, one of them the live one — the real square's most photographed line.
2. A calèche circuit on the square's southern edge (T1 mover: two horses + carriage, one polyline, 2 m/s, kinematic body) — motion in the widest empty area of the frame.
3. The Koutoubia at dusk: its minaret already anchors the muezzin (systems.js:1236); give it an emissive lantern band keyed to `sahDusk` (the stall-lamp material :4853 is the template) so the sunset after the storm has one vertical light in it.

**Bugs / regressions noticed (not fixed):**
1. **Two snake charmers in one spot.** The basket mesh merges a static charmer at basket-local (−1.9, 0.4) (:1457-1460) and `sahLocSnake` is registered with `figure:` at `sahSNAKE.x − 1.9, sahSNAKE.z + 0.4` (:5154) — the same point. The addLocal comment (:5150-5152) says the local now stands "where the drawn figure has always stood", i.e. the merged figure should have been removed and was not. Unverified in the PNG (the basket is off-frame).
2. **Caravan wrap has no passenger hold and an unclamped frame.** :3915 teleports the string 96 m back to the gate; on that frame `sahCarFrame.x = dx * inv` (:3999) is not clamped (body velocity is, :3996-3997). Harmless while `sahRiding` recomputes false at the new position, but a rider is dropped 2.9 m onto the sand at the camp with no toast.
3. **`sahErgT` never decays** (:4539-4545): 22 s of *cumulative* time east of x 165 across separate visits triggers the warning, so a player who steps out and back can get the storm on a 2 s second visit. Minor.

---

## Chapter 6 — Rio de Janeiro (`src/rio.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Bateria (16 drummers, one mesh, one kinematic body of 16 boxes) | 16 | **T1 → T2 during the salute** | Walks the avenue at 2.4 m/s (:3473), holds at the east end while you are in it (:3474-3496), pumps on the audio clock's TWO (:3498-3512), turns to face the capybara for 4.2 s on the wow (:3527-3538, `rioSalute` set :3756) | salute only | `rioUpdateParade` :3472-3615 |
| Float + destaque | 1 + 6 | T1/T2 | Follows 15 m behind; hull+tower solid (:2281-2299); confetti fountain 3 s after the wow (:3546-3560) | salute | `rioUpdateParade` |
| Ala dancers | 16 (`rioPPL_PARADE` :2307-2311) | T1/T2 | Offsets from the column x, samba dip, yaw toward you during the salute (:2500-2525) | salute | `rioUpdatePeople` :2488-2612 |
| Grandstand | 220 (`rioCROWD_N` :94, placed :2170-2180) | **T1** | Bounce/lean/turn keyed to `|x − rioBateriaX|` (:2569-2588) — a wave down the avenue with no second clock. **Never reads the capybara** | no | `rioUpdatePeople` |
| Bathers on towels | ~22 (34 towels × 0.66, :819-833) | T1 | Breathing only (:2556-2561) | no | `rioUpdatePeople` |
| People in the shallows | 16 (:844-848) | T1 | Stand-bounce keyed to the parade 100 m away (:2569) | no | `rioUpdatePeople` |
| Futevolei players | 4 (:858-864) | **T3** | Rally state machine: nearest player on the ball's side lofts it every ~1.5 s, never the same person twice, hands off while the capybara is within 2 m of the ball, stops when the ball leaves the court, celebrates on the task (:3408-3456); they track the ball, step, and leave the ground for it (:2526-2555) | yes (2 m hands-off) | `rioUpdateVolei` :3408 |
| Arpoador crowd | 22 (:1341-1349, `rioPPL_ROCK`) | **T2** | Sway; stand and clap for 6 s when you climb up (:3893-3922, `rioClap` :3908) and for 2.4 s while you ride a wave >12 m (:1301) | yes | `rioUpdatePeople` :2562-2568 |
| Biscoito Globo man | 1 | T2 | Merged figure handed to `addLocal` as a group (:4452) so he turns to watch; robbed via E → turns 0.9 rad (:3788-3799); put back on re-entry (:4106) | yes | npc.js rig + `rioUpdateTasks` |
| Frigatebirds (drawn flock) | 9 (`rioBIRD_N` :2627) | T1 | Three gyres over the point/break/far end, rare flap, distance-rationed gull call (:2668-2716); the flock breaks its circle when the calçadão is run (:3343) | no | `rioUpdateBirds` :2668 |
| The fragata (mount) | 1 | **T4** | condor.js real aerodynamics (lift ∝ v², induced drag, G-limited elevator, weathervane yaw, thermals as rising air, condor.js:52-300), summoned by whistle (condor.js:1391 → `condorSummon` :900-1006), mounts from a low orbit, host-plumed black with a scarlet pouch (rio.js:4247-4262), four thermal columns off the loaf/Urca/Corcovado/Lapa (:4218-4227), fenced by `bounds()` :4277, launch framed by `condorShot` :4288-4304 | yes (it carries you) | condor.js `condorUpdate` :1366 |
| Bondes (trams) | 2 | **T1 + carrier** | Polyline street→viaduct→hill (:2933-2947), 4.2 m/s, 7 s dwell, honest kinematic velocity, pitch on the mesh only (:3160-3175), rail mover sfx (:3184-3193), horn + shake when they pass on the arches (:3208-3224), `o-bonde` ticks on a pass or 11 s aloft | rider | `rioUpdateBonde` :3130-3273 |
| Sugarloaf cable car | 1 | **T1 + carrier** | Station→Urca→summit at 0.028/s (:3939, ~36 s one way), slab floor + four kerbs (:1470-1492), honest velocity + vertical assist (:3968-3996), score swells with height (:4006-4009); `bondinho` at t>0.86 | rider | `rioUpdateCabin` :3937-4017 |
| Sea + wave set | 3 waves | T1 (+ `flow()` channel) | Sets of three at `rioWAVE_SPD`, bowed crest, foam colour on the mesh (:1232-1275, :4322-4345); `flow()` :1204-1230 pushes a wet capybara; ride record + clap (:1276-1318) | via flow | `rioUpdateWaves` :1232 |
| Futevolei ball | 1 | dynamic prop | The one dynamic body in Rio (:916); task when it reaches the sea (:3801-3809); returned to the court on re-entry if it left (:4084-4103) | grab/head | api.update |
| Sparks / confetti | 34 (`rioSPARK_N` :121) | T1 | Tile chips, calçadão marks, samba steps, confetti (:2807-2900) | indirect | `rioUpdateSparks` :2845 |
| Locals | 9: Globo :4452, kiosk :4476, futevolei :4493, lifeguard :4510, Selarón :4525, station :4546, Arpoador :4559, bonde :4573, Selarón-2 :4594; two exchanges :4612-4630 | T2/T3 | Shared rig | yes | npc.js |

**Summary.** T0: 0 animate · T1: ~300 (grandstand 220, bathers, shallows, ala, birds, sea, sparks) · T2: Arpoador 22, Globo, bateria+float+ala during the salute · T3: futevolei 4 · T4: the fragata (condor.js) · carriers: 2 bondes, cable car. Acknowledge the capybara: Arpoador crowd, futevolei, Globo, 9 locals, the fragata, the bateria/ala **only** during the 4.2 s salute. The 220-person grandstand and the 38 beach people never do. Most complex: the fragata's flight law (condor.js), then the futevolei rally.

### 2. Scene completeness

From `qa/B2-06-rio.png`: the arrival frame is the Burle Marx wave, a kiosk, four umbrellas, the Globo man, one bather with a towel, an empty Atlantic with a hard horizon line (ROADMAP-BEAUTY.md:41 "flat blue with a hard line at the sky" — still what the PNG shows; the sea mesh is vertex-animated :4322 but there is no horizon treatment), and the wave paving staircasing at every stripe edge (ROADMAP-BEAUTY.md:207/342, **still open**, visible in the PNG). Density is good on the sand and the promenade; the city behind (frontage :1906, avenue :2067, Lapa :1716, Santa Teresa :1830) exists and is not in the arrival frame.

Missing for a real Copacabana/Lapa:
- **Nothing in the water.** No swimmers (the "empty third" of towels are "in the water" per :831 but nobody is drawn there), no boats in the bay under the cable car, no fishing boats at Urca, no ships on the horizon. `grep boat|barco` → none.
- **The avenue has no traffic** and Lapa has no cars/buses; the bondes are the only vehicles. The Avenida Atlântica frontage is a wall of hotels with a dead road in front of it.
- **The beach has no vendors walking it** beyond the single Globo man — mate/cangas/corn sellers are the beach's whole texture. Nobody on the sand moves.
- No dogs, no kites (Cali got kites; Rio's sky has the 9 frigatebirds only), no pigeons at Lapa.
- Known-open (ROADMAP-BEAUTY.md:266/342): stripe staircase (open), Atlantic horizon (open).

### 3. Marquee / wow

- **Marquee:** `samba-parade` "Samba down the avenue, on the two", `wow:'RIO'` (shared.js:2620); CHAPTERS marquee at (−47.8, 46) (shared.js:3192). Minis: `take-a-wave` (THE SET, shared.js:2625) and `o-bonde` (:2630). The fragata lines `fragata`/`fragata-ride` are deliberately plain (shared.js:2632-2644).
- **What it is:** stay inside a moving 22×13 m column (`rioInCol` :3467) and "act" (a heading change >1.1 rad/s, a hop, or a wheek, :3673-3677) within 0.24 beats of an odd beat of the live `game.music` clock (:3681-3697); six in a row ticks (:3737). Real audio clock, real kinematic column you can be shoved out of; the input is a rhythm stat-check, not a movement verb — it is Cali's floor with a moving zone and half the beats (the file says so itself, :6-24). Payoff: escalating pulse and positional cheers from combo 2 (:3722-3731), then the salute (bateria + ala turn to face you, float confetti, stand to its feet, `music.swell(0.85)`, framed shot, `punch`, bloom row systems.js:28873-28877). Lasts 4.2 s. Repeatable; record `samba-parade` (longest run on the two). Fail: hitting the one breaks the combo with a line (:3703-3712).
- **How it is reached:** 65 m north of spawn; the column is placed at `rioAVE_X0 + 20` on entry so you see it coming (:4073).
- **Rating: 3/5.** Well dressed, correctly clocked, but the dynamic is "press on the beat inside a box that moves" — the player learns nothing they did not learn in Cali, and the bateria's 16 solid bodies (:2195-2203, "it weaves") are the only physical thing about it and are not scored.
- **Latent big moments:** (1) **The fragata is a 5/5 dynamic hidden as two act-3 lines** — the full condor flight law, four thermals, a launch shot over the bay — with no `mini`/`wow`, no beacon language beyond "call down a fragata", and reached only by knowing the whistle summons a bird (condor.js:1391). (2) The cable car is 36 s of the biggest altitude change in the chapter with nothing to do aboard but stand. (3) The wave set: `flow()` is a genuine reference-frame ride and it is a mini.

### 4. Recommendations

**NPC / behaviour:**
1. **Score the samba on the bodies, not the heading (M, high).** The 16 drummers are already 16 separate boxes 1.4 m apart on one kinematic body (:2214-2223). Make a "step" = crossing a rank gap on the two (position differenced against the column, `rioInCol` :3467 already knows the column frame) so keeping station means *weaving through a moving crowd* — a new verb — and drop the yaw-rate test (:3673) which is the reason the samba ticks off a random walk in 0.6 s (ROADMAP-FUN.md:802).
2. **Let the grandstand see you (S, high).** `rioUpdatePeople` :2569-2588 keys 220 people to the parade's x; add the capybara's x as a second `near` source (the same three lines) so the stand ripples when you run along the barrier and does the wave on the combo — T2 for free, and the crowd propagation is already the mechanism.
3. **Beach vendors as T1 movers, one of them robbable (M).** Two walking sellers on the sand on a polyline (the bonde's `rioBondeAt` :2939 pattern), handed to `addLocal` with `group:` like the Globo man (:4452) so they get the rig's flinch/lines, and one carrying a `prop` so the mischief economy (npc.js `localOwnStep` :3833) makes them chase you for it — Sydney depth on Copacabana.
4. **Swimmers (S).** Six bobbing heads in the shallows through the `rioPPL_SIT` pose sunk to the waterline with the sea mesh's own height (`rioSurfaceY` :649) — the "empty third of towels" (:831) finally has people.

**Wow (3 → 4–5): one change — promote the fragata.** The chapter already owns the best dynamic in its files. Give `fragata-ride` the `wow` (or at least `mini`) so the lift, the banner and the marquee shot fire; put the summon in the act-3 kick line (shared.js:3197 "there is a much better way up" already hints it); site the marquee at Arpoador rock (where the thermals begin, :4218-4227) so the beacon leads there; and re-tier `samba-parade` as the second mini. The middle-rung rule (shared.js:2637-2641) forbids two of the same *kind* — the ride is a flight and the parade is a beat, so the chapter keeps one of each. Zero new simulation; it is a bookkeeping change to shared.js plus the systems.js marquee row, and it gives the player the verb Rio actually has: **soar**.

**Scene:**
1. Boats: three moored fishing boats at Urca and one ferry/tanker crossing the bay far out (T1 polyline) — the cable car ride looks down on empty water for 36 s.
2. Traffic on the avenue between parades (T1, hanoi.js pattern at 1/20 the density) and two buses in Lapa.
3. Fix the two open beauty items: an analytic stripe under the promenade (ROADMAP-BEAUTY.md:207) and a horizon haze band on the Atlantic (the `rioSeaColAttr` foam lerp :4330-4340 is the hook).

**Bugs / regressions noticed:**
1. **`rioBuildPeopleBodies(game)` is called from `onEnter` (:4074), not from `rioBuild`** (grep: only :2449 def and :4074). main.js runs `ensureBuilt()` then `onEnter()` (main.js:667, :718), so the first visit is right and **every re-entry to Rio adds another ~300-shape static body** to the world — a body leak and duplicated colliders. Stray indentation at :4074 suggests it was pasted into the wrong block.
2. `rioUpdateVolei` :3408 returns early on `rioVoleiDone` but `onEnter` :4101 clears the flag only when the ball has left the court — fine; noting the ball is the chapter's only dynamic body (:916), so the beach has no other props to kick (props.js:2537 adds 8 rigid props at spawn — those are props.js, not Rio's).

---

## Chapter 7 — Iceland (`src/iceland.js`)

### 1. Inventory

| name | count | tier | what it does | reacts to capy? | update fn |
|---|---|---|---|---|---|
| Sheep, three flocks | 37 (14+11+12, `iceFLOCKS` :3134-3138) | **T2 → T4** | Graze on a slow circle (:3241-3245); shuffle away inside `near` (calm-aware via `addCritter` :3185, `iceSHEEP_NEAR` 6.48); walk IN to 2.6 m when you sit (:3255-3264); **`herdOffer` obey 1** — wheek and they follow (:3206-3225, the shared herd in systems.js); head down when still (:3277-3286); bleat rationed by distance (:3702-3716) | yes (near, appr, herd) | `iceUpdateSheep` :3178-3290 |
| Puffins | 150 (`icePUFFIN_N` :128; 14 always flying, `icePUFF_FLY` :4156) | **T2** | Idle within 95 m: shuffle, head turn, preen every ~8 s, 14 on a tight circuit (:4171-4205); wheek within 9 m on the cap → all 150 flush seaward with a 26 s return (:4207-4280) | yes (wheek) | `iceUpdatePuffins` :4207 |
| Arctic fox | 1 | **T3** | Wander line across the moraine (:4900-4906), stops and stares inside 14 m (:4945-4948), hears a wheek at 40 m → yip + comes 62 % of the way, stops 4.5 m short, with a real position and speed cap (:4915-4980), sits and looks up for the aurora ignition (:5010-5020); tail states | yes | `iceUpdateFox` :4908-5033 |
| Humpback | 1 (+ fin/wake group) | **T3** | 54 s cycle, clock runs ×4 inside 42 m of the pier head (:4738-4747), 15 s fin run with two blows (:4751-4767), 4 s under with a held swell (:4769-4777), 3.4 s breach with splash/shake and a `capy.shove` inside 26 m (:4780-4807); `the-whale` ticks on the pier or inside 52 m (:4809-4818) | yes (clock, shove) | `iceUpdateWhale` :4731-4860 |
| Snowcat | 1 | **T1 + carrier, T2 hold** | Moraine shuttle 7 m/s, 3 s at top, holds up to 26 s at the bottom while you are within 58 m (:5163-5178), honest velocity + `carryFrame` (:5184-5195), beacon sweep + headlights; `snowcat` ticks after 8 s aboard (:5228-5233) | yes (hold) | `iceUpdateSnowcat` :5154-5240 |
| Strokkur | 1 | **T2** | 9 s quiet / 1.6 s blue dome / 2.4 s blow (:108-110); inside 3.4 m at the blow → `capy.launch(…, 27, …)` (:3776-3800), distance-faded shake/sfx (:3766-3773); record `geysir` thrown height | yes (launch) | `iceUpdateGeyser` :3744-3897 |
| Fumaroles / mud pots / hot pool steam | 26 vents + pool | T1 | Nearest-vent steam rationed to the camera (:3838-3855), pool wisps (:3862-3866), all 26 puff together on the soak tick (:3946-3952) | no | `iceUpdateGeyser` |
| Chimney smoke | n chimneys (`iceChimneys`) | T1 | :1394-1422 | no | `iceUpdateChimneys` |
| Steam pool | 54 | T1 | :2301-2370 | indirect | `iceUpdateSteam` |
| Bergs | 1 group + body | T1 | 1.4 m sine drift with a derived velocity (:4531-4543) | no | api.update |
| Aurora curtains | 6×2 bands | env / T2-ish | Ride with the animal in x/z (:4549-4552); ignite over ~9 s after the 7 s soak (:3993-4033), ripple + breathe (:2503-2530); tint every water body (:4562-4573); `skyward()` cranes the camera (:4471-4480) | soak trigger | `iceUpdateAurora` :2503 |
| Parked cars | 11 (:1309-1332) | **T0** | Merged, static | no | none |
| Bicycles / street furniture | 7 slots (:1334-) | T0 | static | no | none |
| Moored boats | 3 (:1684-1712) | T0 | static, solid | no | none |
| Locals | 8: pylsa :5363, pier :5390, street :5420, church :5439, spring :5460, snowcat driver :5479, shepherd :5506, rack :5522; three exchanges :5554-5590 | T2/T3 | shared rig | yes | npc.js |

**Summary.** T0: 21 (cars, boats, bikes) · T1: steam/smoke/bergs/snowcat loop · T2: puffins, geyser, snowcat hold, aurora · T3: fox, whale · T4: sheep (herd + calm registry) · 8 locals. Acknowledge the capybara: sheep, puffins, fox, whale, snowcat, geyser, 8 locals — **everything alive in Iceland reacts**, which is the opposite of Marrakech. Most complex: the fox (a genuine small state machine with a position and a speed cap) and the sheep (three shared registries at once). The only dead population is the eleven parked cars.

### 2. Scene completeness

From `qa/B2-07-iceland.png`: a lit Reykjavík street at night — 46 painted houses with emissive windows, 5 parked cars in frame, the pylsa van, sodium lamps, a local with a speech bubble. Density is right for a Nordic street at 23:30 and the emptiness is the design (:6-30). Known-open (ROADMAP-BEAUTY.md:200/340): **street lamps light nothing on the road** — still visible in the PNG (lamp heads glow, the tarmac under them is the same value as elsewhere; `iceLampPools` discs exist :1302-1305 but read faint). ROADMAP-BEAUTY.md:313 says the midnight sun was changed (61° → 16°) — the PNG is night-lit by windows; unverified whether the low sun reads anywhere.

Missing for a real version:
- **The harbour is static**: three moored boats (T0), no boat ever moves, no whale-watching RIB going out (the chapter's own mini is a whale), no gulls on the quay.
- **The town has no vehicle that moves** — 11 parked cars and nothing on the road at half past eleven (a taxi, a bus, one car with headlights would be the only moving light in the street).
- The church has no interior; the organ is a console at the door (:1550).
- The lagoon has bergs but no seals; the cliff has puffins but no gulls/skuas; the moraine has a fox and nothing else. Two hundred metres of lava field carry sheep only.
- Scatter density was measured lowest in the project and fixed (:2652-2690 comment); the PNG shows the town, not the field, so unverified now.

### 3. Marquee / wow

- **Marquee:** `aurora` "Bring the sky down", `wow:'ICELAND'` (shared.js:2670); CHAPTERS marquee at (−40,−10, up 60) = the hot spring (shared.js:3203). Mini: `the-whale` (shared.js:2668).
- **What it is:** sit still (velocity² < 1.6) inside 7 m of the spring for 7 s (:3905-3911); the pose is the loaf (:3933), steam thickens, then `iceAuroraArmed` and a 12 s `frameShot({yaw: π, hold: 12})` (:3998-4001) while the curtains rise at 0.115/s, score swells (:4013), `aurora` ticks at 0.9 (:4016-4021), the fox sits and looks up (:5010), the water goes green (:4562). After that `iceAurora` stays at 1 for the rest of the session. **It is a stationary trigger followed by a cutscene**; the "verb" is doing nothing, which the file argues for on purpose (:26-30). It is reached 110 m from spawn past the geyser field. Fail: walk off before 7 s and the clock damps back (:3977-3982). Overstay marks escalate downward (:3958-3975).
- **Rating: 3/5** as a wow (spectacle now in frame after the fourth pass fixed the azimuth, :2444-2460), **but the chapter's real new dynamic is the glacier** — `groundSlip` :606-614, 130 m of 20° ice with 34 solid seracs (:3355-3400), spray by speed (:4090-4098), a stall rule (:4099-4106), a record, and the snowcat to make it repeatable. That is a 4/5 verb filed as an act-2 line. The geyser launch (27 m/s, :112) is a second real one.
- **Latent:** (1) the glacier run is always done *before* the sky is lit (act 2 vs act 3), so nobody slides under the aurora; (2) the snout at z −78 meets the lagoon at −76 (:34-36, `iceLAG_Z0` :83) — whether a 15 m/s run flies off the snout into the lagoon is unverified; nothing scores or frames it; (3) the whale breach shoves a *swimming* capybara (:4800-4807) but nothing invites you into the harbour water.

### 4. Recommendations

Iceland is already the deepest of the three in behaviour; the recommendations are few.

**NPC / behaviour:**
1. **One moving vehicle in town (S).** A single car on `iceLANES[0]` on a polyline with headlights (the snowcat's emissive lamps :5119-5127 are the template) — it is the only moving light in a chapter lit by windows, and it fixes "nothing on the road" more honestly than the lamp pools.
2. **A gull flock on the quay that reads the capybara (S).** Reuse the puffin idle/flush machinery (:4171-4280) with 12 instances at the pier: they lift when you run at them (Quay pattern, ROADMAP-FUN.md:453) and settle on the boats.
3. **Seals on the bergs (S–M).** T2 like the fox's stare — heads up inside 14 m, slide off the berg into the lagoon on a wheek (the berg body already moves, :4531). Something alive in the middle 52 m of the map.

**Wow (3 → 4–5): one change — put the run under the lights.** Re-order so `glacier-run` (or a second line, "take the glacier down under the sky") is act 3 after `aurora`: the ice already carries the green tint (:4562-4573) and `skyward()` holds 0.55 (:4479) so the curtains are in the top of the frame on the descent; the snowcat makes the return trip 25 s. Add a launch lip at the snout so the run *ends in the lagoon* (`iceSLIDE_END_Z` −82 → finish on splash; `iceSlideFinish` :4121 gets a second toast/record for distance flown), which turns the best twenty seconds in the game into a jump the whole sky is watching. New verb: **carve on slip, then fly off the end of it**. Effort S–M; no new system.

**Scene:**
1. Lamp light on the road (open since ROADMAP-BEAUTY.md:200): the discs exist (:1302-1305); brighten or feed them to the spill pool.
2. A moving fishing boat leaving the harbour on the whale's cycle (T1 polyline, `iceWhaleRunAt` :4716 is a ready arc) — the mini gets a second thing in the water.
3. A church interior glimpse: the organ console at the door (:1550) with a lit nave behind an open door (emissive plane), so "lean on the organ" has a room.

**Bugs / regressions noticed:**
1. **`iceSheepSpook` is dead.** Declared :3168, decremented :3181, read in the speed term :3267 (`+ iceSheepSpook * 1.8`), **never set anywhere** (grep). The header comment :3132 "They scatter when wheeked at" is stale — the wheek now recruits them through `herdOffer` (:3206), which is better, but the variable and the comment should go.
2. `iceWhaleSeen` (:4632) is a module latch that survives travel — intended (task-once), but it also means the task cannot re-tick after a save reset without a reload. Minor.
3. The 11 parked cars are `SG.add` solids (:1331) with no `userData.noShadow` concerns — fine; noting REVIEW-2026-08-31.md:308's three flagged sites (iceland.js:1533, 3484, 3645) — line numbers have moved and I did not re-verify each.

---

## Cross-chapter notes

- **Where the three sit against the best in the game.** Iceland's fauna is Sydney/Pasto depth already (everything alive reacts; the sheep are on three registries). Rio's crowd is the best-*drawn* in the project and the least reactive (220 grandstand + 38 beach = T1). Marrakech has the densest crowd and the only T4 human system (the chase) and is otherwise the least alive place in the game: ~172 people, none of whom know you exist.
- **Two of the three marquees re-use another chapter's verb** (Rio = Cali's beat; the Erg = Iceland's slip), and in both the file's own comments say so. The genuinely new dynamics in these chapters — the fragata, the chase, the storm's shove, the glacier — are all filed one rung below the marquee.
- **The cheapest single lift across all three** is the same edit: give the instanced crowds one capybara-distance term in their update loops (sahara.js:1759, rio.js:2569). Both loops already have a per-person yaw/lean channel and a damp; each needs ~6 lines to move ~400 statues to T2.
