# ROADMAP-TEN — from an 8 to a 10

25 September 2026, branch `ten-pass`. The author's brief, again: cosy, fun, rewarding, very
beautiful, a progression loop worth coming back to, and a story at the middle of it. It should
delight someone who has never held a controller and someone who has finished everything. One request
is new and explicit. Story Mode and Free Roam should be two games that share a world. Free Roam is
cosy trouble: exploring, making mischief, fewer tasks, less story. Its picker is the flat grid of
nineteen tiles from the old versions (qa/F1-title-p2.png), not the act folds the story uses.

Eight reviewers played it with real keys on fresh profiles. They scored it as follows:

| area | now |
|---|---|
| the first fifteen minutes | 7 |
| progression and narrative | 5.5 |
| Story vs Free Roam | 4 |
| Sydney, the Quay, Manly | 6.5 |
| South America (Pasto, Cali, Rio, Pantanal) | 6.5 |
| Kyoto, Kowloon, Hanoi, Palawan | 7 |
| Iceland, Antarctic, cave, Drift | 6.8 |
| Marrakech, Venice, Göreme, Monte Carlo | 6.8 |

These five things do the most to keep it from a 10:

1. **The story happens off the screen.** Earning a memory prints three words on the paper, a new act
   opens with no signal at all, the ibis does the same thing in Sydney as in Hanoi, and the
   traveller lives in a journal fold. Five acts are written and none of them is shown.
2. **The two modes are one game.** Free Roam carries the memory counter, the guided walk's exit, the
   act lines and the story's ending. Its picker shows 3 of 19 places. A digit on page one starts
   Free Roam by accident, and there is no way back to the story.
3. **Six headline moments break.** The Monte Carlo car drives off without its driver. The Göreme
   truck parks on the basket. The Quay ferry pins itself on Fort Denison. The Pasto condor lands on
   the paving and cannot be grabbed. The Antarctic pod waits in ice the boat cannot cross, and the
   Cali chiva leaves its passenger in the road.
4. **The payoff frame is cheap or hidden.** The aurora is green panes, the orcas are crates, the
   steam is octagons, and the cloud sea is paving. On top of those moments sit four bubbles, a stale
   toast and the expanded paper. Moment cards have no priority.
5. **Minute one is noise, not cosy.** A heat ladder, an ibis theft, an 18-word rule and 70 yuzu
   arrive before the player has done anything worth a memory.

Every law in AGENTS.md stands. A new visual or audio term is a `game.state.noX` flag, costs 0.1 ms
or less when cut, and parks at rung 1 or above. No spawn, grade, sun, fog, mote or instrument row is
re-based. Every line goes through the pools, `qa/lines.mjs` and `qa/l6-tics.mjs`. Only one save
field is added in this pass (`garden`, T5a).

## Decisions

**Story Mode is "the bag goes home".** The capybara wakes by a stranger's bag in Sydney and follows
it round the world in five folds of a map. Each fold holds two memories, then home. **Ten is the
story's number.** The paper counts per act ("Act II · 1 of 2 memories"). The nineteen count moves to
the journal shelf as the collector's number, and after the ending it becomes the epilogue's. Each
beat of the story gets its own moment:

- *A memory* is a held card, a chime, the score lifting, and the keepsake landing at the animal's
  feet.
- *An act turn* is a card with the act's title, a page from the traveller's notebook, a key change
  in the score, and the traveller seen leaving.
- *The ibis* has an arc. In Act I it watches. In Act II it steals. In Act III it takes the keepsake
  and has to be run down. In Act IV it is cold and hungry, and yuzu given to it is remembered. At
  the ending it sits in the horseshoe.
- *The ending* frames the ten keepsakes on plinths. The traveller sets the bag down beside the
  animal.

The opening image, the animal asleep by the bag, is also the closing one. The story never says why.

**Free Roam is "the sketchbook".** Every place is open, there is no task list, no acts, no ending,
and no premise card. The paper becomes the place's reputation ("Sydney · they call it a nuisance
here"), three unfound mischief silhouettes from the existing 45-name repertoire, and the place's
secrets. Tasks still tick silently, so nothing is lost. The picker is a wall of reputations:
nineteen tiles, flat, in chapter order, each showing what the place thinks of the animal. Tab is a
departures board to anywhere. Places remember you on every return. The ibis is a fellow nuisance: it
steals, as in Act II, and never gets an arc. The garden (T5a) is Free Roam's home.

**The mode is a toggle, not a door.** `journeyMode` already exists on the save. Pause and the title
both offer the other mode, and the first switch from story to free asks once. No new field.

**Cosy first, then trouble.** A fresh file has a grace period, computed as no memory yet (story) or
no mischief name yet (free). During it, the ibis does not steal and the heat ladder stops at AN
INCIDENT. The first reward answers the first wheek, not the arrival.

**Yuzu buys a home, not a percentage.** Income stays as it is. The sink becomes the garden on the
homecoming lawn, in both modes. The six stat rows move below the costumes. This is the one new save
field: `garden`, an array of ids. It is needed because a bought hammock must still be hanging after
a reload, and no existing field can project it.

**A frame belongs to its moment.** One rule, carried by several items: while a marquee is live, only
its own words may be on screen. That means one bubble at most, no held toasts, no tutorial pills,
the paper tucked to the live target, and cards in priority order.

**Guards, not moves.** Spawns are law. Where a door, a bin or a fort sits on a moment, the fix is a
guard or a prop move, never a respawn.

## Working rules for this pass

- `src/systems.js` has one owner per wave, agent **A**. `src/shared.js` (CHAPTERS, PALETTE,
  HOMECOMING_*, record rows) is owned by A as well. A's first commit in each wave, the **seed**,
  adds every PALETTE entry and CHAPTERS/record-table edit the chapter agents in that wave need. The
  names are fixed below. Chapter agents only reference them.
- One chapter file per agent. `src/npc.js`, `src/rival.js`, `src/environment.js`, `src/weather.js`,
  `src/main.js`, `src/props.js` and `src/condor.js` each have at most one owner per wave.
- **The proof slot.** Beauty numbers are taken at rung 0, headful, on the reference GPU, one browser
  at a time, in the last 20 minutes of each wave (ROADMAP-WOW3 Part H, `qa/aaa-ab.mjs`). Findings
  from reviewers who were at rung 3 are re-measured there before anyone spends on them. Behaviour
  proofs can run in parallel.
- UI items (picker, departures, bag/garden sheet, pause) follow the design-taste-frontend skill
  under the house DESIGN rules. Before an item closes: `web-design-guidelines` on the changed files,
  a playwright-cli screenshot read by eye, and the console read.
- Gates for every commit are the AGENTS.md five. Commit messages take the form `ROADMAP-TEN <id>:
  <what, the measured number>`. Push `ten-pass` at the end of every wave, write a CONTRACT entry per
  wave, and merge to `master` in T6.

---

## T1 — the split, and the broken marquees (hours 0–2)

**T1a · A · systems.js, shared.js · the two modes.** Owner request; highest priority in the pass.
- The flat picker. Build the shelf twice. `.capyui-picks.flat` holds all 19 tiles in CHAPTERS order,
  using the loop restored from `git show 4cc6e5e^:src/systems.js`, and `--cols` from
  `sysPickCols(18)`. The act atlas is built only when `jrHasFile && journeyMode==='story'`. The Free
  roam door (25217) and ArrowRight on page one show `.flat`. Pause "choose a place" on a story file
  shows the atlas. pickList, pickMove and picksFade get a live-shelf switch: the flat shelf uses
  4cc6e5e^'s `pickCols()` grid navigation, and the atlas keeps the rect walk (25611-25785). In free
  mode: no "after Sydney" eyebrow (25467), the hero eyebrow reads "free roam" (25459), the pickfirst
  line reads "nobody watching" (25474), and the hero is compact so that all 19 fit at 1280x720 with
  no "more below" pill. The heading reads "Where to?" in free and "Where next?" on the atlas
  (25332).
- Digits on the title act only on page two. With no file, Digit1 on page one does what Begin does.
  The mode comes from the live shelf, not a hard-coded 'free' (39686, 39226-39233). Fix
  `qa/wow-still.js:15` so it measures the story.
- Each door gets an italic subline, taken from sysHOME_UI (6564). Begin: "the bag, the shelf at
  home, and an ibis". Free roam: "every place open. no list. only trouble." Carry on adds the act
  name. Remove the `title=` tooltip (25196-25257).
- The mode toggle. A free arcV1 file gets "back to the story" on pause and "Carry on the story" on
  the title. A story restore whose saved biome is outside `homecomingProgress().open` restores into
  the frontier's first open place instead of returning silently (39228). The first story-to-free
  switch asks once: "every place opens. the story waits." (the pauseAsk pattern, 26160).
- Free gates. Story surfaces gate on `journeyMode==='story'`, not `homecomingArc`: the paper count
  line (34514), the journal head (31877), and tutorial beat 8 (in free, `tutEnd('walked')` at beat
  8, 39432). `sysFinaleAll` (38177) is story only.
- Free departures. In free, `jrToggle` calls `jrShow(true)` (32062), and pause "choose a place"
  opens the same board with no reload (26144). The head line reads "anywhere. it is not in a hurry."
  Flag `noFreeDepart`.
- Story atlas: use firstGate before the Sydney memory and actGate after (25553). p2stat reads "n of
  19 memories · <act>" (25340). The "more below" pill counts places (25723).
- Proof: a new `qa/ten-modes.mjs` checks that a fresh profile shows 19 tiles in view at 1280x720,
  that Digit1 on page one gives journeyMode==='story', that free→story→free round-trips, that a free
  Sydney paper has no "memories" string, and that Tab in free lists 19 departures.
  `qa/aaa-freeroam.mjs` stays at 9/9. Screenshots `ten-t1a-p2-free.png` and `ten-t1a-p2-atlas.png`.
- Payoff: the owner's picker, and two doors that say what they are.

### T1a — shipped

- **The flat wall.** `.capyui-picks.flat` holds the 18 after the hero in CHAPTERS order, using
  4cc6e5e^'s loop and its `pickCols()` grid walk. On a desktop window (≥640 wide, ≥600 tall)
  the shelf drops its scroll budget and the hero's picture becomes a strip sized
  `clamp(84px, 100vh − 588px, 210px)`. Measured by `qa/ten-t1a-shots.mjs`: **19 of 19 tiles in
  view, no pill, one tile height, three rows of 6, at both 1280x720 and 1440x900**. A phone
  (390x844) keeps the scrolling shelf in two columns. The atlas is built only for a story file
  (`jrHasFile && journeyMode==='story'`) and is reached from pause's "choose a place".
  `shelfUse()` swaps the two shelves, the heading ("Where to?" / "Where next?"), the stat and
  `titleFree`. It also gets its own compact hero, four columns in every fold, the
  firstGate/actGate split, and a pill that counts places. The atlas at 1280x720 now ends
  inside the window: before, it ran 64 px past it with the footer under it.
- **Digits** act on page two only, where each press is a click on the live shelf's tile.
  Digit1 on page one with no file is Begin.
- **Doors.** Begin and Free roam carry italic sublines from sysHOME_UI, and the `title=`
  tooltip is gone. Carry on names the act (story) or says "free roam". A free arcV1 file gets
  "Carry on the story". A story restore outside `open` lands in the frontier's first open
  place.
- **The toggle.** Pause has "back to the story" for a free arcV1 file (it crosses to the
  frontier if the current place is shut). The story-to-free switch asks once per session:
  "every place opens. the story waits.".
- **Free gates.** The paper's memory count and the journal head are gated on journeyMode.
  `sysFinaleAll` is false for a free arcV1 file, and legacy files keep the JOURNEY ending.
  The free guided walk ends at beat 7 (`tutBeats()`).
- **Free departures** (`noFreeDepart`, not a GPU term). Tab and J in free open `jrShow(true)`
  with the head line "anywhere. it is not in a hurry." and the title "Where to?". Pause
  "choose a place" opens the same board with no reload.
- **Proof.** `qa/ten-modes.mjs` gives 23/23 (live, fresh profile, real keys). `qa/aaa-freeroam.mjs` gives 9/9, and npm test gives 78 checks with 0 failed.
  `qa/ten-t1a-modes-static.mjs` gives 21 checks and is registered in `qa/run.mjs`.
  `qa/wow-still.js` begins the story by its button. `qa/aaa-freeroam.mjs` counts the live
  shelf and reads a door's `<b>`, which are the two deliberate changes.
  `qa/homecoming-atlas-live.mjs` reaches the atlas from a story file. Screenshots:
  `qa/ten-t1a-p2-free.png` and `qa/ten-t1a-p2-atlas.png`.
- **Misses.** The in-play story-to-free question is per session and not per file, because no
  new save field was allowed. The atlas at 1280x720 still leaves a 1-2 px title scroll.
  The free paper still says "a memory kept" on a chapter row, and T3a owns the free paper.

**T1b · monaco.js · the car keeps its driver.** In `monMePlace(dt>0)`, set
`b.position.set(tx,ty,tz)` (keep the velocity for contacts). Draw monMeG from monMeTX/TY/TZ and
monMeYaw, not from interpolatedPosition (3050, 3493, 3507). Treat the pack cars the same way. Proof:
|capy − car| < 1 m over a full lap at rung 0 and at rung 3 (`qa/ten-monaco-seat.js`), and a PNG of
the animal in the seat. Then the race frame: while `monRaceOn`, the eye is 1.5 m higher, the boom
shorter, the aim point 12 m ahead from `monTrackAt(monMeS+12)`, and a `camFloor` sits 2.5 m above
the road through the rig hook (753, systems.js:30139 reads it). Proof: over a lap, the terrain share
of the frame is under 25% and the car is in the middle third. Stretch: every third moored boat is a
three-tier motor yacht in the existing instanced batch (1303), and the promenade is pale limestone
(`PALETTE.monStone`, seeded).

### T1b — shipped

- **The seat (no flag, a bug).** The cause is not interpolation but the shed: from rung 2,
  world.step takes two 1/60 substeps under a 1/20 s clock, so a velocity-driven kinematic body
  covers two thirds of each frame's travel and never gets the rest back. The car drove a
  two-thirds copy of the lap about the grid. `monMePlace(dt>0)` now puts the body at the target
  after setting the contact velocity, and `monMeDraw()` draws the car from monMeTX/TY/TZ/Yaw. The
  pack gets the same treatment, and a roof rider is carried by the correction the solver did not
  integrate (`monSEAT_CARRY2`, 3 m cap). RULE 5 is amended in the carrier's header comment.
  Proof `qa/ten-t1b-seat.js` / `-r0.js`, W held, one full lap: at rung 3, capy−car was 33.9 m
  mean and 59 m max before, 0.55 m after (the seat's own offset). At rung 0 it is 0.55 m. PNG
  `ten-t1b-seat-r3-2.png` shows the animal in the red car. `qa/ten-t1b-roof.js`, fastest pack car,
  no keys, about 11 s: the ride held 4.5/0.5/3.9/0.1 s before and 12.0/10.0/11.6/8.0 s after.
- **The race lens (`noMonRaceLens`, a camera term, no GPU, not parked).** rig() is 9.5 m, 0.50
  rad and a 2.0 m raise (it was 13/0.30/1.2). rideYaw aims 12 m down the lap at the car's own
  lateral. A `camFloor` getter, published only while racing, sets the floor at road +2.5 and
  ground +1.2, so the dive floor elsewhere is untouched. `api.roadD` is a harness helper. Proof
  `qa/ten-t1b-lens-ab.js`, 13 stations, the same road cut vs live, rung 3: the car took ray hits
  at 4/13 stations before and 12/13 after, and it sat in the middle third at 13/13 both times.
  Mean eye height went from 4.8 m to 5.5 m. **Miss:** off-tarmac ground share was 0.33 before
  and 0.36 after, and 7/13 stations are over 25% either way. The cut banks at s≈20-70, 170-270,
  520 and 620 fill the frame from any eye behind the car, so reaching the target would take the
  bank geometry, not the lens. The proof slot should re-measure at rung 0 headful.
- **Stretch not done:** the three-tier motor yachts in the moored batch and the limestone
  promenade (`monYachtNavy`, `monStone` stay unused). They are open for T6a.

**T1c · goreme.js · the truck leaves the pad.** `gorUpdateTruck` holds at (20,10, yaw 0) until the
balloon is more than 2 m airborne, and aims at least 7 m off the basket when chasing a landing
(4603, 4415, 4742). Proof: from a fresh save, walk to `hintTarget('aboard')`, hop, and `gorAboard`
becomes true within 10 s, 5 runs out of 5. Stretch, both flagged `noGorDawn`: the poplars warm from
olive with the dawn line (3097, 1215), and the dovecote treads use the tuff ramp (1995-2026).

### T1c — shipped

- **The pad (bc68e99).** On the ground `fall` is 0, so the chase aim was the basket and the bed
  parked on it: baseline on dd25434, truck 3.0 m from the basket, the animal wedged 2.2 m out, 0 of
  1 boarded. Now, before the first flight, the truck holds (20, 10) until the balloon is 2 m up.
  After a flight it aims `gorCHASE_OFF` = 7 m off a grounded basket. `qa/ten-t1c-board.js` (fresh
  save, real keys from the spawn to `hintTarget('aboard')`, hop) boarded in 0.7-1.4 s in 6 of 6
  runs that reached the hint, with the truck 23.3 m off. One more run never reached the hint: the
  field's cold envelope lies across the straight line from the plaza, and the instrument now
  sidesteps it.
- **The landing (6bd188f).** The in-air chase is unchanged, so `on-the-trailer` still ticks on a
  landing ON the bed (bed 1.14 m off). A bed left over an empty basket pulls out to 6.4 m or more,
  and with the animal still in the basket the truck holds. `gorTrailerRide` no longer counts the
  basket as the bed. It used to fire the ride home on the touch and drive off without the animal.
  `qa/ten-t1c-land.js` measured: bed pulled to 6.43 m; the truck came back from the square to a
  grounded basket and stopped with the bed 7.59 m off. New harness-only api: `trailer()`,
  `riding()`.
- **The poplars (`noGorDawn`).** The 16 scatter poplar meshes share one cloned material (the rim
  hook is carried over). Its colour is olive `gorPoplarOlive` until the horizon (gorSun 0.354),
  then `gorPoplar` by 0.60. `qa/ten-t1c-poplar.js` read 8a8a5c pre-dawn, beb75a at sun 0.53 and
  c8c05a from 0.78 on, and c8c05a with the flag set. It is a colour uniform written on change, so
  it has no GPU term and is not parked by rung.
- **Misses.** The 34 valley poplars merged in `gorBuildValley` (1092) and the town plane tree keep
  their colours, because a merged vertex-colour mesh needs an attribute rewrite. The dovecote
  treads were not reached: the reviewer's white zig-zag is at (-46, -36.7), 32 m off the cliff
  face, and gorBuildCliff at 1995 is not it. A ride left inside 1.5 s stays live, so the truck
  waits at the square (pre-existing).

**T1d · quay.js · the passage steers itself clear.** Move `quayFORT` to x −20 (z and r unchanged)
and check that the buoy pairs still bracket the channel (108). Add a head-on slide: when more than
0.85 of the speed is going into the fort, apply a 0.25 rad/s yaw away and toast "S to go astern"
once (5395-5420). The hero can be seen: move `quayHELM` and the binnacle to x +0.9, a wing wheel
(85, 3251). Proof: W held from the berth finishes the passage in 5 runs out of 5, and a
hide-and-diff on the capy group shows it solid, not dithered, in over 80% of helm frames. The
dolphins surface only past Bradleys Head and within 20 m of the rhumb line (5829). Spray
(`noQuaySpray`): sheets at 0.35x, 44 instances, tumbling, 0.6 s life, PALETTE.foam (2964).

### T1d — shipped

`3172815`, src/quay.js only. No new flag (geometry, collision, a gate), no draw call, no save field.

- **The fort.** `quayFORT` x 6 → −20. The straight run from the berth (x 6.6) clears its hard ring by
  12.5 m. The red buoys at z −40 (x 2) and z −150 (x 16) are still inboard of it.
- **Head on.** In `quayShore`, past 0.85 of her way into a hard disc she yaws away at 0.25 rad/s. The
  side is latched for the contact and released the frame she is clear. "S to go astern" shows once a
  visit (a stick sentence on pad or touch, because sysSay never rewrites a lone S). While the marquee
  is live, systems.js routes it to the paper's live line, not a pill. qa/ten-t1d-rock.js: square on,
  W held, she turned 1.51 rad and was clear in 8.4 s. Before, she was pinned for good.
- **The hero.** The roadmap's wing wheel (x +0.9 on the deck) was measured first. Visibility was
  0.69, the same as the centreline, 0/10 frames solid. The 3.7 m house is under the lens ray whatever
  side the wheel is on. So the wheel is on the roof's fore edge at x +0.9 (`quayHELM.up` 2.21), with
  a teak grating. E from the foredeck takes it (the gate's floor drops by `up`). E again puts the
  animal back on the foredeck. The house collider now tops out at the drawn roof (2.30 → 2.56).
  qa/ten-t1d-helm.js hide-and-diff on the capy group, boat hidden for the mask: 10/10 helm frames
  above 0.85, mean 0.912.
- **The passage.** qa/ten-t1d-pass.js uses real keys: E from the foredeck, W held, an A/D loop on
  the buoy-pair midpoints, and S for the last 50 m. It arrived 5/5 in 56.1–58.8 s, with 0 head-on
  contacts and the fort never closer than 52 m. `node qa/ten-t1d-sum.mjs` prints the table.
- **Dolphins.** They surface only past Bradleys Head and within 20 m (`quayDOLPHIN_LANE`) of the
  berth→Manly rhumb line. The escort first formed at z −213 to −222 in all five runs. Before, it
  ticked 11 s after taking the wheel.
- **Miss: spray (`noQuaySpray`) not built.** The spray pool (`quaySPRAY_N`, 2982) is foam spheres,
  already PALETTE.foam. Those are the "ice boulders". The cream "paper sheets" in the review shots are
  not this pool, and their source was not found in the time. Left for T6a.
- The harness hook `game.quay.passageAudit()` is new. The helm's world point (`game.quay.boat.helm`)
  is now 2.2 m higher, so anything aiming at it (the hint arrow) follows it up onto the roof.

**T1e · condor.js · the bird can be caught.** Clamp the low orbit to 3.5 m or more above
`condorGroundTop + condorHANG`. Add a watchdog: after 3 s lowered but not ready, re-centre on the
nearest open point (8 bearings x 8/14/20 m) and toast "it will not come down under the flags.
somewhere with more sky." (192, 2423, 2461). Add `condorAudit().stuckT` for the soak. `condorSummon`
sets `game.state.flierWhistleT = 6` (976). The summon shot (`noSummonShot`): the first inbound
crossing of 30 m frames the bird above the animal (hold 2.6 s), with an echo wheek at pitch 0.8
(965-1063). This covers Pasto and Rio. Proof: `qa/ten-condor.js` with Q, Q, E at the Pasto plaza
spawn mounts in 5 runs out of 5, and talonInReach is above 0 in the samples. A PNG shows the bird in
shot.

### T1e — shipped

The cause was not the orbit height. It was the clock. main.js runs update() after world.step, and
cannon-es clears body.force after every internal step. From rung 2 a frame has two 1/60 substeps, or
one when a substep runs long and cannon bails. So the bird's lift, seek and wingbeat covered one
substep and plain gravity covered the rest. On top of that, the inbound and orbit script ran on game
time while the body ran on solver time, which is 0.33 to 0.67 of it at rung 3. Measured at rung 3,
the four-second descent became a 20 m/s dive that ran through the 14 m orbit onto the plaza. There
it sat at 0.7 m (ten-t1e-condor, first run) or hovered at 3.8 m, just under condorPickupReady's 4 m.

- `noCondorSubstep`: the frame's force and torque are kept on the first substep and put back on
  every later one, with gravity taken out, because cannon adds m*g before preStep. The AI states
  (inbound k, orbit angle, height easing, leaving) advance by the substeps the solver actually took
  (`condorCountStep`). After the fix, rung 3 inbound ends at 13.9-17 m and the low orbit holds 6.4-7.2 m.
- `noCondorOpen`: the seek target is never lower than groundTop + HANG + 3.5. The watchdog runs when
  the bird is lowered and settled but not ready, or jammed (under 3.95 m AGL and slower than
  1.5 m/s), for 3 s straight. It then circles the nearest open point: 8 bearings × 8/14/20 m, a ray
  down finds no static body, and 6 of 8 launch headings are clear for 18 m. It says "it will not come
  down under the flags. somewhere with more sky." once per summon (in Rio, "…here…" unless
  `host.flier.openLine` is set). A jammed bird has its contacts off, over a terrain floor, until it
  is 4.5 m clear. `game.condor.openSpot()` and `game.condor.condorAudit()` (`stuckT`, opens, pins,
  ghost, ready, talon, shots, holds, aiT) are published for the soak.
- A whistle during the inbound spiral now lowers the bird. At rung 3 the reviewer's second Q landed
  there and did nothing.
- `game.state.flierWhistleT = 6` is set on every Q the bird spends (spawn, inbound, circling,
  leaving). condor.js is its one writer, decays it, and zeroes it on biome:enter. **The homeOk guard
  in systems.js is still A's to add**: `&& !(game.state.flierWhistleT > 0)`.
- `noSummonShot`: once per chapter visit, the first time the inbound bird is inside 30 m, frameShot
  runs with {dist 15, pitch 0.08, raise 5, hold 2.6}. The yaw leads round the orbit, scaled to solver
  time. The review's {11, −22°, 1.5} framing sank to the camera floor with the bird in 0 of 7 frames.
  An answering wheek plays at pitch 0.8 and volume 0.5, 0.6 s after the call.

Proof, rung 3 headless, with five other agents on the CPU: qa/ten-t1e-condor.js (Q, Q, E at the
plaza spawn) mounted in 5 of 5 runs on the final code, every time on E, with talonInReach true in 2 to
4 samples before the grab. The intermediate builds (no force hold, or a hold that kept gravity) managed
1 of 3. Over the five runs the bird was inside the frustum in 21 of 44 sampled
frames of the shot, and qa/ten-t1e-shot-run3.png shows it above the animal. qa/ten-t1e-stuck.js
could not reproduce the stall jam by teleport once the force fix was in. Before the fix, the
watchdog fired 1-3 times a run and moved the orbit to (−5.7, 20.3). Not done: the paper's where()
already follows the bird (systems.js:32408), so it needed nothing. The rung-0 headful look at the
shot is left to the proof slot.

**T1f · cali.js · the chiva holds on.** With no move key held and the animal inside the roof box
plus 0.4 m, snap its horizontal velocity to the chiva's frame velocity each substep (2601, 2615).
The missed-her beat: "she does not stop for anybody. she goes round again." plus the next-in time on
the paper (4775, 4812). Flag `noChivaHold`. Proof: roofPlace(0), no input, still on the roof at
s=177, at rung 0 and at rung 3. Stretch (`noWireFade`): wires at half radius in dark metal, faded
within 5 m of the lens (2079).

### T1f — shipped

- **The cause was the clock, not friction.** From rung 2, main.js clamps the frame at 1/20 s and
  runs two 1/60 substeps of it. The world moved the passenger for 1/30 s while cali.js drove the bus
  for 1/20. The drift was linear in s: lz −5.1 m at s 28, off the tail at s 49, on the paving at
  s 177 (`qa/ten-t1f-hold-r3.js` on the old code, and again with the flag set).
- **`noChivaHold`** (`caliHoldRoof`). No move key held, the roof test true within 0.3 s, inside the
  roof plus 0.4 m, and no cable latch: each frame the animal is put back at its roof-local point,
  with its history shifted, and its horizontal velocity set to v + ω × r. y stays with the solver,
  so a hop without a direction goes straight up and lands on the same spot. This is behaviour, not
  a picture, so it has no GPU term and does not park. With roofPlace(0) and no input: at **rung 3**
  it was on the roof at s 178.0, with max |lx|,|lz| 0.06 m through four cable hits. At **rung 0** it
  was on the roof at s 178.8, max 0.06 m. The flag set restores the old fall (off at s 50.7).
- **The missed-her beat.** One second off the roof while she is on the road, no cable in the last
  2.5 s, said once per ride: "she does not stop for anybody. she goes round again." A new
  `nextIn('chiva-mirador')` gives the seconds until she is parked at the kerb again. It is an
  estimate built from the drive's own speed law, plus the stops, the turn and the deadhead. It
  returns −1 while she is parked, so the wheek's ladder line is unchanged, and −1 while the animal
  is on her. `qa/ten-t1f-missed.js` walked off with a real S key at s 21. The line came once, the
  paper read "next in 165 s", and t + nextIn drifted 2.4 s over 113 s of climb.
- **Stretch, `noWireFade`.** The catenaries are now one InstancedMesh with 126 segments, at half
  section (0.0375 m) in `PALETTE.caliWire`. Each segment takes the crowd's dither through
  `aLensFade`, from 5 m of the lens down to fully gone at 3.5 m. The pennants and washing stay put.
  The fade parks at rung 1 and above, and the thin line stays. The flag brings back the old merged
  cables. On the frozen-camera spawn frame (`qa/ten-t1f-wires-ab.js`, rung 0), 7 segments faded and
  the top-left bars were gone. On the ride under the first cable, up to 14 faded as the lens passed.
  Rung-0 GPU cost is owed to the proof slot.

T1 seed (A): `PALETTE.monStone`, `monYachtNavy`, `gorTuffLo/Hi`, `gorPoplarOlive`, `caliWire`.

## T2 — the story shows itself (hours 2–4)

**T2a · A · systems.js, shared.js · the story's beats.**
- Moment priority (`noMomentPriority`). `showMoment(…, pri)` takes a priority: 0 incidental, 1
  system, 2 story, 3 memory. A lower card never replaces a higher one still on screen; incidental
  cards are dropped and others queued. Hold = max(2600, 900 + 45 ms per note character), capped at 6
  s. The premise is priority 2, held 5 s, and any key dismisses it after 1.5 s. Heat-ladder cards
  (49386) are priority 0, and a repeat within 10 s goes into the pips label (30292, 4677).
- The memory beat (`noMemBeat`). The memory edge in completeTask (37084) schedules
  `memoryCeremony(cn)` 1.1 s later. It plays a held card (kicker "A MEMORY", the marquee's name,
  "for the shelf: " + keep), musSwell, `musStatement('full','done',2.4)`, the sysDONE pull-back
  frameShot, then showKeep and sysDropKeep after sysKEEP_WAIT, and a two-note chime. chapterCeremony
  skips keep/drop if the beat already played this session (38599). `sysKeepsRestore` loops over
  `keepHeld(k)` (37953). Folds in the eveTick edge (27714).
- The act turn (`noActTurn`). Seed `lastAct` on start, as notoSeenTier is. When actIndex rises,
  queue the turn 6 s after the memory beat: "ACT II" / the act title / a line from a new
  sysACT_LINES pool, a key change via musStatement, and the traveller's nb page for the chapter just
  remembered as the note. Export `game.journeyAct()`, emit bus `'story:act'`. When `p.ready` flips:
  "THE WAY HOME" / "the shelf has room for all of it." The paper kicker becomes "ACT II · IN GOOD
  COMPANY" (31796, 31885, 30288).
- One number. The premise (39019) reads "FIVE FOLDS OF A MAP / two memories from each, then home. an
  ibis is coming too." The paper footer (34514) reads "Act II · a memory here: the opera house
  concert, and one more thing off this list", naming the marquee, not the rule. The last act reads
  "one more, then home". The journal drops the clock and "NOTICED" in chapter one.
- First grace (`noFirstGrace`). `game.rivalOK()` (47943) is false while `keepCount()===0`, or, in
  free, while no repertoire name is found. The heat ladder caps at 3 during the grace, and the rule
  toast (48737) becomes "somebody saw that."; the rule text moves to Learn to Play §2. THE FIRST
  LOOK pays on the chapter's first wheek (47271).
- The held-toast guard (`noHeldWow`). The sysToastHeld drain keeps holding while wowLiveOn or a
  frameShot hold is live, and drops entries from another biome or older than 12 s (30573-30592).
- Proof: `qa/ten-story.mjs` on a fresh profile with real keys in Sydney. The premise is visible at 5
  s or more. Exactly one "A MEMORY" card appears on the concert, and no priority-0 card replaces it.
  A keepsake drop exists within 3 m of the animal. The act-II card fires after the Quay memory, and
  not again on reload. No ibis theft before the first memory. Screenshots `ten-t2a-memory.png` and
  `ten-t2a-act2.png`.
- Payoff: the player can say what just happened, and why it mattered.

### T2a — shipped

- **Card ranks** (`noMomentPriority`). `showMoment(k, t, note, incidental, pri, hold)`; an
  omitted rank is 0 for an incidental card and 1 otherwise. `sysCardClaim` lets the done card's
  story beats hold a rank too. A rank-0 card under a higher one is dropped; others wait in the one
  deferred slot. Hold = clamp(0.9 + 0.045 s per character, 2.6, 6). Heat-ladder cards are rank 0
  (1 with a repertoire name), and a repeat inside 10 s is left to the pips' label.
- **The memory beat** (`noMemBeat`). The edge is read across the tick's `r.done` (held before,
  held after), so a restore never plays it. 1.1 s later: the done card with a gilt edge, kicker
  A MEMORY, the marquee's name, "for the shelf: <keep>", and "ACT I · ●○ · 1 OF 2 MEMORIES".
  It is rank 3 for 5.6 s, and toasts and bubbles step out under it. Two chimes rising, musSwell,
  `musStatement('full','done',2.4)`, a full confetti ring and the sysDONE pull-back. The keepsake
  lands 1.5 s in, while the lens is out, and the keep card follows as the memory card goes.
  chapterCeremony does not drop it again, and a same-tick 100% waits for the memory card.
  `sysKeepsRestore` restores `keepHeld` keepsakes on a story file. The eveTick pill is folded.
- **The act turn** (`noActTurn`). The act index is read before the tick and the memory beat
  compares it after, which is the seed. 6 s after the memory: ACT II / the act title /
  a `sysACT_LINES` line / the traveller's page for the place (two sentences, via `nbWrite` then
  `nbText`) / the act's places, on the first new place's postcard. The page rustles and the
  tune plays in another mode (`musStatement('full','act',0.5,'pent'|'major')`).
  `game.journeyAct()` returns 1..5 on a story file and 0 otherwise. The bus gets `'story:act'`
  `{act, title, ready, chapter}` and `'story:memory'` `{chapter, act, got}`. When `p.ready`
  flips: ALL FIVE FOLDS / THE WAY HOME / "the shelf has room for all of it.", as act 5 with
  ready true.
- **One number.** The premise reads FIVE FOLDS OF A MAP / "two memories from each, then home.
  an ibis is coming too." It is rank 2, held 5 s, and any key ends it after 1.5 s. The story
  paper's footer reads "Act I · a memory here: the opera house concert, and one more thing off
  this list". It reads "one more, then home" in the last fold and "Act I · 1 of 2 memories ·
  Sydney remembered" once kept.
- **First grace** (`noFirstGrace`). `sysGraceOn()` is true with no memory (story) or no
  repertoire name (free). While it holds, `rivalOK()` is false and the chain caps at 3. The rule
  toast is "somebody saw that.", and the rule is in Learn to Play §2. THE FIRST LOOK's 8 yuzu pay
  on the chapter's first wheek. `game.graceOn()` is exported.
- **Held-toast guard** (`noHeldWow`). Held lines carry `at`. The drain lets go unsaid any line
  over 12 s old or from another place, and holds while `wowLiveOn` or a frameShot is live.
  While a marquee or a ride is live (`sysFrameOwned()`), the paper does not tuck to a stale row
  (it takes `.marq`), and the paper tip and the slide lesson wait.
- **The atlas in the story's terms.** On the atlas a tile reads "remembered" or "n of 2 to a
  memory", the rail fills by memory, and the Sydney hero says "a memory here opens the coast".
  p2stat reads "0 of 10 memories · act I · A little further". On a fresh story file the title
  was 731 px tall in a 720 window, which gave the page its own scrollbar. At 640 px wide or more
  and 760 px tall or less, the atlas title padding goes from 18 to 12 px, and the page no longer
  scrolls (`qa/ten-t2a-atlas.mjs`: nothing wider than half the window scrolls except the shelf).
- **Proof.** `qa/ten-t2a-story.mjs` passes 22/22 (fresh profile, 1280x720, headful). The
  premise is up 4.9 s at rank 2. The grace holds, with `rivalOK()` false. There is exactly one
  A MEMORY card. A rank-0 card raised under it is dropped. The keepsake is 0.9 m from the animal.
  ACT II fires after the Quay memory and emits `'story:act'` once with act 2. A reload plays no
  act card. The atlas hero reads "remembered", and the page is 720/720 with no scroll. There are
  0 runtime errors. `qa/ten-t2a-static.mjs` gives 26 checks and is registered in `qa/run.mjs`.
  Screenshots: `qa/ten-t2a-memory.png`, `qa/ten-t2a-act2.png` and `qa/ten-t2a-atlas.png`.
- **Misses.** The instrument fires the ticks through `game.completeTask`, the door a real tick
  uses, and not by playing the concert with keys. The paper's own kicker (the act-part eyebrow)
  still reads the chapter's movement, and the act rides the footer. The journal still shows the
  clock and "NOTICED" in chapter one. A reload before the first wheek forfeits THE FIRST LOOK
  (no save field). In the Sydney shot the pull-back framed a jacaranda between the lens and the
  animal: the rig, not the beat. `web-design-guidelines` was not run on the change.

**T2b · antarctic.js · the pod runs in open water.** Patrol `px = antLeadX(pz) + 10*sin(2a)`
(4379-4386). The run gate is `sp > 4.0*(1 − 0.6*antBoatIce)` (4518-4531). One-shot toast: "they want
open water. find the lead." Flag `noPodLead`. Proof: the closed-loop helm run
`qa/ten-review/b3m-antarctic.js` ticks orca-ride in 3 runs out of 3, under 150 s. Then the orcas
(`noOrcaRound`): three smooth sph lobes, a swept cone dorsal, the eye patch raised to +0.34s, a
belly crescent, and 6 blow sparks at each surfacing (2351-2440). Proof: a PNG from the chase lens
where the white patch reads. Stretch (`noKelvin`): a V wake replaces the ring stack (1464).

### T2b — shipped

Commit 1f7df07 on the T2b worktree branch. One file, src/antarctic.js, plus `qa/ten-t2b-*`.

- **`noPodLead`.** The patrol is `antLeadX(pz) + 10 sin 2a`. `packAt` round the loop peaks at 0.086
  (mean 0.058), where the old ellipse peaked at 0.72 (mean 0.27), sampled at 360 points. The run gate
  is `sp > 4.0 (1 − 0.6 antBoatIce)`. "they want open water. find the lead." plays once per visit, at
  `RUN_AT + 4` s of escort while the gate is still shut. **One addition the roadmap did not name:** a
  run that breaks while the hull is still in pack (ice > 0.12, where the tender's top speed falls
  below the pod's 11 m/s) now *waits*. The pod holds in the lead 8 m north of the boat and never
  swims back south. The lose and ride clocks both stop until the boat is within 13 m. Helm run 2 had
  no wait: the pod broke in 0.72 pack and was lost within 8 s. Run 3 released the wait on the ice
  reading alone: the pod left 22 m off the boat and was lost again, which is why the wait now holds
  to 13 m. A pod that stops
  moving keeps its last heading; before, `atan2(0,0)` turned it to face south.
- **Proof, `qa/ten-t2b-helm.js`.** Fresh profile, real keys, headless at rung 3. orca-ride ticked in
  3 of 3 runs, at 52, 43 and 49 s wall (38.7, 41.1 and 41.7 game s). The pod waited 9.4, 14.4 and
  9.1 s. The same harness with `noPodLead` (`qa/ten-t2b-helm-off.js`) got no tick in 150 s. The
  harness has one change from b3m: during `escort` it steers 40 m up the lead instead of at the pod.
  Steering at a pod that sits on the boat saturates the rudder, and the boat circles at 1 m/s in
  open water. That happened in the one run without the change, which failed.
- **`noOrcaRound`.** Each orca is built from three sph12 lobes under `matRound`. The eye patch sits
  at +0.34 s, is 0.34 tall and leans up toward the lens. The belly crescent (`antOrcaBelly`) is wider
  than the torso at the waterline. The dorsal is a 3-sided cone, 0.18 wide and swept back 0.35 rad
  (the bull's is straight). The flukes are two swept lobes, and the saddle is narrowed to 0.84 m. Each
  animal still has the same three meshes, in the same child order (qa/wow-movers.js). One writer,
  `antOrcaRoundTick`, swaps geometry and material and parks at rung 2 (the `noPersonRound`
  precedent: triangles only). The body is 2016 triangles, against 248 for the crate. Six white
  sparks at each blow, parked at rung 1.
- **Proof, `qa/ten-t2b-orca.js`.** The swap reads back through every state: round, crate, round
  again and rung 2. `qa/ten-t2b-orca-round.png` against `-crate.png`, both from the chase lens:
  eye patches, saddles and belly flash read, and the bull's fin stands. No console errors and no
  lastError.
- **Missed:** `noKelvin` (the V wake). Out of budget, and the ring stack is unchanged. **For the
  proof slot:** the rung-0 A/B for `noOrcaRound` (triangles plus the blow sparks) and `noPodLead`
  (behaviour only, no GPU term). `podDebug()` now also returns `round`, `blows`, `toldLead`, `waitT`
  and `pack`.

**T2c · iceland.js · the aurora is the sky.** The ramp (`noAuroraRamp`): PlaneGeometry(len,h,40,4)
with vertex colours from 1.0 at the hem down to 0 at the top, MeshBasicMaterial with additive
blending and no depth write, ends tapered, crown tinted iceAuroraMag, parked at 2 rows at rung 2 or
above (2835-3036). The frame (`noAuroraFrame`): the ticking call fires frameShot yaw toward the
nearest curtain, pitch −14°, dist 9, hold 5 (4545-4570). The steam (`noSteamSoft`): shrink over the
last 0.8 s, cull puffs within 4 m of the lens, burst ring at r 6-9 m on the far side,
SphereGeometry(0.5,7,5) (2670-2733, 4574). Proof: in a pinned-camera PNG the curtain's top edge has
no hard line (row luminance falls monotonically), and steam covers under 10% of the frame in the
tick frame. Stretch: the lantern trail up the gap in the rows (1378).

### T2c — shipped

- **`noAuroraRamp`.** Each curtain is now one ribbon, `PlaneGeometry(330, 100, 40, 4)` from 46 m to
  146 m, in place of the two flat bands. The vertex colours fall from the hem to the top: 1.0 at the
  hem in `PALETTE.iceAuroraHem`, then 0.7, 0.4 and 0.16 in the curtain's own colour, then 0. The top
  half leans toward `iceAuroraMag`. The last 18 % at each end tapers along x. The folds are two
  sines along the length, one pair per curtain, and they scale whole columns, so every column still
  falls. The material is `MeshBasicMaterial`: additive, vertex colours, no depth write, no fog. A
  Lambert emissive ignores vertex colour. Peak opacity is 0.56, which is the lower band's 0.46
  raised to cover the light the folds remove. It draws 6 times where the bands drew 12. At rung 2
  and above it swaps to a pre-built 2-row copy (123 vertices a ribbon, not 205). The flag hides the
  ribbons and draws the old bands untouched. The ripple is shared: a band's `ampUp` is 0, so it is
  the old formula.
- **`noAuroraFrame`.** The call that ticks `aurora` now fires `frameShot`, where before only every
  fourth call in time did. The yaw is the bearing of the curtain nearest the lens plus PI,
  clamped to the inner four curtains, because at an end curtain the frame held only two. It holds
  for 5 s. **The review's pitch −14° and raise 0.8 could not be used.** The lens floor is 1.7 m and
  the soaking animal is at −0.35 m, so the eye was clamped up and the lens looked *down* 10.3°
  (first run). The shipped numbers are pitch −3°, dist 9, raise 2.5. Measured at the tick: eye
  2.09 m, the lens looking up 0.8°, the animal at NDC y −0.48 (bottom third), the framed curtain's
  hem at +0.18 and its top at +0.63. Before the call the lens was looking down 12°, and no curtain
  vertex was in front of it.
- **`noSteamSoft`.** Each puff shrinks by smoothstep over its last 0.8 s. Any puff within 4 m of the
  eye is scaled to 0, at a cost of 54 distance checks. The geometry is `SphereGeometry(0.5,7,5)`
  scaled 0.93, which gives the old pentagon's area. It parks back to the 5×4 geometry at rung 1.
  The burst's 14 puffs go to a 6-9 m ring on the far side of the spring from the burst shot's eye.
  **The pool was always full:** 54 of 54 live at every sample, so the old burst ring mostly never
  spawned. The ring now takes the slot nearest its end, which the shrink has already made small.
- **Proof** (`qa/ten-t2c-aurora.js`, rung pinned 0, fresh profile). Hide-and-diff uses one frozen
  camera clone and raw renders in one task. The live run is compared with `noAuroraRamp` +
  `noSteamSoft` set, with the frame live in both, so the tick frames share a view.
  - The curtain's centre column, from the hem up to 20 % past the top: ribbon 0 rises, largest
    single fall 6.2 levels. Bands: plateaus of 72.5 and 32.1, largest single fall 46.4.
  - Steam's share of the tick frame: 9.86 % live against 10.3 %. Across three runs the live
    figure was 8.6-10.4 %, so the "under 10 %" target is only just met.
  - Steam at the resting lens in the pool, same pose: 6.2 % against 24.4 %.
  - Burst frame: 4.4 % against 1.4 %. That is more steam, because the ring now rises on the far
    rim and frames the animal.
  - `aurora` ticked in both runs, no errors. PNGs: `qa/ten-t2c-aurora-{live,off}-{before,tick,burst}.png`.
- **Second increment: the light back.** On the steeper ramp at 0.56, the ribbon carried less than
  half the bands' light, and the tick frame read as an empty sky at the low point of a breath. The
  ramp is now 1.0, 0.85, 0.6, 0.3, 0. The folds use 0.6 + 0.4 across and 0.8 + 0.2 along, and the
  peak is 0.66. Re-measured in the same run as the flag:
  - Ribbon column: hem at 134 levels, falling to 44 levels at 20 % past the top, where the
    column reaches the next curtain. There is one 23-level dip where it crosses that curtain.
  - Bands: a 100-level plateau, then a single 66.7-level fall, then a 59-level plateau.
  - Steam in the tick frame: 10.0 % against 15.7 %. At the resting lens: 5.7 % against 11.9 %.
- **Missed:** the stretch, the lantern trail up the gap in the rows. The review's other ask, keeping
  bubbles and the paper off the frame, belongs to A (`noHeldWow` / T2a). Rung-0 GPU cost is owed to
  the proof slot.

**T2d · rio.js · the rock is solid.** Seeded `rioRnd` boulders, and a rioStaticBox for every sphere
with s > 1.4, pooled into one body (1660-1680). Proof: `qa/audit-solid2.js` at each stone gives 0
walk-through. Add an `inZone('posto6')` box for A's T3 door guard. Bounce (`noRioBounce`):
sand-bounce vertex colour on seaward faces, weighted by normal and height, and 1 in 6 windows lit
(2320). Proof: hide-and-diff on the frontage band, mean luminance +15% or more.

### T2d — shipped

- **The rock is solid.** Arpoador's 22 stones are drawn from a seeded `rioRnd` (LCG), so the rock is
  the same on every visit. Every stone gets a collider, all 22 on ONE static body: a ConvexPolyhedron
  that is the drawn `sph6`'s own hexagonal waist and cap on a prism down to the lowest ground under
  it. It has no invisible corner, and the animal's nose never ends up inside the stone. A stone of
  s > 1.4 (11 of 22) keeps off the summit (r < 5) and off the wedge facing the calçadão (bearing
  0.96 ± 0.5 rad), so the way up stays open. A smaller one is sunk until its crown is 0.56 m, a step
  and not a wall. The 22 clappers no longer stand inside a stone (`rioRockIn`). Nav boxes go into
  `rioSolids`.
- **Proof** (`qa/ten-t2d-rock.js`, rung 1-3 headless): audit-solid2's horizontal ray at ground +
  0.5 m, 8 bearings × 22 stones. With the body there are **0 walk-throughs in 176 drawn hits**. With
  it lifted out (the chapter as it shipped) there are **176 in 176**. Shove test: the animal pushed
  at each big stone at 3 m/s for 1.5 s is inside a waist below the cap for 0 ticks in 11 stones (it
  climbs onto the cap or is stopped). The wedge's navBlocked: 3 of 87 samples, all at r 4-4.5 on a
  sunk small stone's nav box on the slope. Physics lets the animal step it. A ray laid exactly along
  a polyhedron edge misses in cannon (`qa/ten-t2d-rayprobe.js`), so the audit casts ±5 cm either side.
- **`inZone('posto6')`** is the box x −50…−38, z −12…2: the sand and the calçadão east of the rock,
  5.4 m clear of its 13 m. `game.rio.posto6` = {x −44, z −5} is its middle, for an arrow or a board.
  Nothing reads it yet. T3a's door guard (or CHAPTERS `way`) chooses whether to move the door.
- **Bounce (`noRioBounce`)**, baked. Seaward (−z) faces of the frontage have their colour × (1 + 1.3 ·
  facing · height · rioBounce), fading to 45% at 34 m. One window in six is lit (`rioSequin` × 1.6,
  keyed on block/floor, not rand). Two colour arrays are swapped on the flag's edge, so it costs no
  draw, no uniform and nothing per frame beyond one compare. It does not park, because it costs no
  GPU.
- **Proof** (`qa/ten-t2d-bounce.js`, hide-and-diff mask on the frontage mesh, pinned lens, scene to
  an RT before the composite): mean luminance live vs cut at three lenses on the sand is **+18.3 /
  +16.7 / +16.3 % sRGB-encoded** (+30.2 / +31.6 / +21.5 % linear). Read by eye as
  ten-t2d-bounce-on/off.png: warmer, lifted walls and lamp windows. **Owed:** the headful composite
  number from the proof slot. The live-camera frame was not taken (camYaw does not hold inland at
  arrival).

**T2e · sahara.js · a place to aim at.** `game.sahara.wowTarget()` returns the next ring or the
minaret, for A's T3 paper. Ring beams (`noSahRingBeam`, rung 1 or above) visible from 150 m (5768,
169). Zenith band (`noSahZenith`): the top 35% of the dome lerps to `PALETTE.sahZenith` by elevation
and fades with the storm scalar (6260), with the grade left alone. Proof: the aaa-ab A/B on the sky
region, and a sky/sand luminance-contrast number before and after. Stretch (`noSahStallSmoke`):
square joints at −70% contrast, three worn paths, and stall smoke (1173, 1338).

### T2e — shipped

Everything is in `src/sahara.js`. The proofs ran headless at rung 0, pinned by the prefs file
(`pf: 1`). They measure behaviour and hide-and-diff numbers. GPU cost is left for the proof slot.

- **Audit.** `jetTarget()` was already there, and the jetpack row's hint arrow already follows it
  (systems.js 32879). The reviewer's arrow pointed at the cart because the paper's head row was the
  cart, which T3 fixes. Two of the three stretch terms had already shipped: the worn paths (the two
  wear bands in `sahBuildGround`, plus the L6 wear path) and the stall smoke (`sahBuildSmoke`).
- **`game.sahara.wowTarget()`** returns `{x, y, z, kind: 'ring'|'minaret', i, of}` while a run is on
  the animal's back, and `null` otherwise. In a `jetDebug` run it returned null before the take, then
  rings 0 to 3 in order, then `minaret`.
- **`noSahRingBeam`** (parks at rung 1 or above) puts a 36 m column of `sahFire` over each hoop,
  fading to nothing at the top, and a sheath on the pole beneath. The hoop itself is left clear. It is
  one merged mesh and one draw call, with alpha per vertex: 0.78 pulsing on the next ring, 0.26 idle
  and 0.08 once flown. From a lens pinned 150 m from ring 2, 263 px change in the ring's 25 px column.
- **`noSahZenith`** (parks at rung 1 or above) is a cap over the shared dome, at render order −19.5
  (after the dome, before the clouds). It ramps from sin 0.03 to 0.85 × `sahZenith` at sin 0.35.
  There is a hole from 7° to 24° round the sun, so the dome's disc stays clear. It fades by
  (1 − storm)(1 − dusk). The grade and `sysSKY_TOP` are untouched. **This departs from the spec:**
  the band is full from sin 0.35, not over the top 35%. The resting lens only reaches sin 0.28, and
  the first cut at 0.65 moved sky luminance only from 0.553 to 0.546. Measured on the resting lens,
  live against cut in one task:

  | measure | cut | live |
  |---|---|---|
  | sky mean RGB | 155,141,108 | 130,138,143 |
  | sky/sand luminance (Michelson) | 0.036 | 0.054 |
  | sky-to-sand RGB distance | 51 | 90 |

- **`noSahStallSmoke`** (the roadmap's name for the stretch) now softens the square's joints. They
  are their own mesh, taken 70% of the way to the worn ground, and the colours are swapped only on
  the frame the flag changes. That is one extra draw call, and the term does not park. Rendered joint
  contrast went from 0.426 to 0.194, **−55%, short of −70%**. The 5 cm sides of the strips still
  shade dark.
- **Instruments:** `qa/ten-t2e-sky.js` and `qa/ten-t2e-joints.js`.
- **Still owed:** the aaa-ab A/B on the sky region, in the proof slot.

T2 seed (A): `PALETTE.sahZenith`, `antOrcaBelly`, `iceAuroraHem`, `rioBounce`.

### T2f — shipped

Pulled forward from T6a into T2, owner cave.js only.

- **The ping (`noEchoPing`, parked at rung 1 and up).** At the wheek, a fan of 24 rays is marched
  against the floor law, the drawn side-wall face (cavBuildWalls' own wobble, now `cavWallFace`),
  the Great Wall and the far end. Each ray leaves 3 marks on the floor and 3 up the face it meets,
  and up to 12 go on the roof where it is in reach. One instanced draw of 156 octahedra in
  `PALETTE.caveGlint`, fog off. Each mark lights on the frame the ring reaches it (the ring's
  smoothstep, inverted), so the reveal travels out with the ring. It pops, then falls away over
  0.62 s. Rock with daylight over 0.45 is skipped. Proof `qa/ten-t2f-ping-clock.js`, clock driven by
  hand (dt 1/60) at (32, −14), daylight 0: 73 marks cast, 20 on a face, first lit at 0.5 s, 48 lit
  at the peak (1.0 s), last lit at 2.2 s, nothing lit after 2.3 s. With the flag or at rung 1, 0 are
  cast and the mesh is hidden. `qa/ten-t2f-ping-shot.js` has pinned-lens PNGs, live against flagged
  at the same tick (`-rig-live-09` / `-rig-off-09`, `-wall-*`). `game.cave.ping()` is the harness
  read.
- **The first-echo lesson (no flag, a line and a landmark).** `game.cave.mouth` has one reader, the
  'first-echo' hint arrow (systems.js). It moves from z 46, where daylight is 0.9 and the tick
  (under 0.25) can never fire, to (2, 28), where daylight is 0. A wheek in daylight before the tick
  now says, once, "too much daylight here for it to come back. further in." Proof
  `qa/ten-t2f-ping.js`, fresh profile, real Q keys: two presses at the spawn gave no tick and the
  line once. One press on the arrow's spot ticked first-echo.
- **The ferns (`noFern`, parked at rung 1 and up).** The 130 lime cones on the doline floor move
  to their own merged mesh, which is the flag's picture and the rung-1 fallback. In their place, on
  the same spots and at the same lean, is one instanced fern: nine fronds (six spreading, three
  standing), `cavJungleDk` at the heart and `PALETTE.caveFern` at the tips. Instance colour is
  0.5 to 1.0 by `cavDaylightAt`, so the green is brightest under the hole. There is no shadow and
  one draw. Proof `qa/ten-t2f-fern.js`, pinned lens from the rim and the glade: 130 ferns drawn and
  the cones hidden when live, and the reverse flagged and at rung 1. PNGs `-glade-live` /
  `-glade-off`.
- **The crescent (`noSwiftShape`, parked at rung 1 and up).** This is the highest-impact cave
  finding left in cave.js. The swifts that form on the animal in the drop read as black bars.
  A swift is now drawn as a scimitar in `cavSwiftlet`: a short arm, a hand raked 0.95 rad back,
  and a forked tail. It is drawn twice, level and wings-up, and each bird goes into one or the
  other on its own clock, a flicker at about 4 beats a second (a matrix, not a bone). The column's
  16 flicker in bursts between glides, and all the time on a falling capybara. The roost's 90 are
  the same bird at 0.55, level on the wall and flickering only when off it. There are four
  instanced draws and the old two are hidden. Proof `qa/ten-t2f-swift.js`, hand clock, pinned
  lens: live, the new meshes draw and the old are hidden. A mean of 3.8 of the 16 were mid-flick
  per frame in the column, and 4.5 with the roost up. Flagged and at rung 1 it is the reverse,
  with 0 flicking. The swiftlets task still ticks off the wheek (true live and flagged). PNGs
  `-col-live`, `-roost-live` / `-roost-off`.
- **Misses.** The lime cones outside the mouth (cave.js ~1210, 1544, 1554) are still cones, because
  the brief named the doline floor. The finding's "thicker ring" and "cap the lamp glow near the
  lens" were not done. The hint arrow's paper line ('Q. in the dark. that is it.') is systems.js
  and unchanged.
- Rung-0 GPU cost for all three flags is owed to the proof slot.

## T3 — Free Roam gets its own game; the ibis gets an arc (hours 4–6)

**T3a · A · systems.js, shared.js · the sketchbook and the paper.**
- The free paper (`noFreePaper`). todoRefresh (34266) branches to `freePaperRefresh(n)`. It shows
  three blocks. First, a place line: the name plus that chapter's notoriety word from
  jrChapInc/Scene/Pho/Fed and notoWarm (37597). Second, three unfound repertoire silhouettes: rows
  locked to this biome first, then generic rows whose prop exists here, drawn with repPage's bars
  (49347), each with a one-word want. Third, "n of m noticed" (33995). The marquee shows as a single
  soft line, "if it wants: the opera house concert". At 15, 30 and 45 names, a priority-2 card from
  the notoriety tiers (37562).
- The free tiles. buildPick's free branch replaces the tally with the place's reputation word and "2
  secrets · 1 noticed". p2stat reads "<tier> · n of 45 names" (25478-25500, 25340).
- The place remembers, in free (`noFreeRemember`). On biome:enter, if jrChapInc[n] ≥ 5, a pooled
  arrival line; if notoWarm(n), a local gives a gift on sight. Uses the sysWorldAwayCheck hook
  (37353).
- Paper clarity, all modes. Sort supportOpen by live distance before the slice (34326); reorder
  HOMECOMING_EXPERIENCES[4] to open on an act-1 Kyoto row and add `torii-run` (shared.js:4346).
  While a wow is live, the tab keeps the marquee and aims at `game.wowTarget()` (sahara, hanoi
  lanterns, kowloon rings, monaco lap; 26786, 26962). The hint says "↓ 6 m", not "here", when |dh|
  exceeds sysHINT_RISE (51649). The tab subline comes from the same task id (fixes the orca/calving
  mix, 33187). Skill cards and tips are queued while climbing, riding or flying (35766). Alt-fired
  skills get an `altLine` (35773).
- Door guard. The travel whistle does not count within 15 m of an armed wow, or while `flierWhistleT
  > 0` or a condor is active (52799, 52943). This fixes Rio, Pasto and Kyoto without moving a door.
- Clues. Manly's duck-dive branch: "HOLD E as each white one reaches you — under, not over" (32998).
  The cave's first-echo `where()` is at z 28 (33104). Record rows get `liveLabel` (drift lantern:
  "carrying").
- Bubbles on screen. Clamp bubble x out of the paper's and the yuzu pill's rects, or drop the bubble
  (30772-30794).
- Proof: `qa/ten-free.mjs` on a fresh free file in Sydney: the paper has no checkboxes and shows 3
  silhouettes, a found name updates the tile's p2stat, and a return with inc ≥ 5 gives the arrival
  line. `qa/ten-paper.js` at arrival in Kyoto, Hanoi, Kowloon and Palawan: the top row is under 60 m
  away. During the Hanoi pho run the tab reads the delivery for the whole ride. Rio Q×3 at Arpoador
  does not open the board.
- Payoff: Free Roam has a reason to go back to every place, and the paper stops pointing across a
  lake.

### T3a — shipped

- **The sketchbook** (`noFreePaper`). On a free file todoRefresh empties the window (tasks
  still tick, silently) and hands the card to `freePaperRefresh(n)`. The kicker reads "the
  sketchbook". Under it sit the place's name and what it calls the animal, from
  `sysPlaceWord`. That is the place's own ladder (1/3/6/10/16 on incidents plus scenes, less
  half the charm), or "they are fond of it here" when notoWarm. Next come three unearned
  names as repPage's bars, each with a one-word want (`sysREP_WANT`, all 50 ids). The order
  is the place's own names first, then a named prop that is lying about here (walked off
  `game.props`), then verbs, then moves and breadth, with a per-place hash for order within
  each class. The foot reads "n of 50 names · n of m noticed", and the marquee is one soft
  line, "if it wants: the opera house concert". The story's "a memory kept" tally is
  overwritten on a free file. The tucked tab reads the place and its word, with the first
  want under it. The CSS sits in the marked block `TEN T3a sketchbook`, which
  `qa/reimagine-earned-card.mjs` strips.
- **A name is stamped.** The first time a name is earned on a free file, the moment card
  gets `.stamp`: it lands a size too big and a few degrees off, with a double rule in the
  accent ink. The card is rank 2 and reads INTO THE SKETCHBOOK / the name / "<sentence> ·
  n of 50". Two chimes rise a fourth, the paper takes the stamp and redraws. At 15, 30
  and 45 names a rank-2 card follows it, with the notoriety name and a `sysFREE_MILE`
  line. A restored count is seeded and is not news. `showMoment` takes a 7th argument,
  `cls`.
- **The free wall.** A visited tile carries the place's word and "n/m noticed" as one chip
  on its picture. The hero also gets a "2 secrets · 0 noticed" line. A body line would have
  grown the rows: the first cut measured 92/94/107 px, so it moved to the chip. p2stat
  reads "A RUMOUR / 1 OF 50 NAMES", from `notoScore(jrFile)`, which is now one formula for
  the live journey and the file.
- **The place remembers** (`noFreeRemember`). A free arrival with 5+ incidents here says a
  pooled line 4.6 s in. A notoWarm place has the nearest person within 26 m toss a snack.
- **Door guard.** The three-wheek count ignores a wheek while `flierWhistleT > 0`, while
  `game.condor.active`, or within 15 m of the place's unfinished marquee mark. It is a guard,
  not a move.
- **Paper clarity.** The small moment offered is the nearest open one. It is sorted when the
  open set changes and held, so the arrow does not flip. HOMECOMING_EXPERIENCES[4] opens
  on torii-run, then zen-ruin, bamboo-dash, matcha-raid and the-bell. "here" becomes
  "↓ 6 m" when the target is more than sysHINT_RISE below or above. While a marquee is
  live, the tucked tab carries its name and live line, where the orca ride's tab had read
  the calving clock. Skill cards wait while climbing, riding, at a helm or on a condor.
  THE HERD taught by the ibis has its own `altLine`. The Manly duck-dive clue reads
  "under, not over".
- **Proof.** `qa/ten-t3a-free.mjs` passes 18/18 on a fresh free file (headful, 1280x720).
  The Sydney, Kyoto and Hanoi pages each show three silhouettes with wants and 0 tick boxes.
  A name earned through three real spills in front of a person is stamped at rank 2. After
  a reload the wall shows 19 tiles, one row set, no pill, "A RUMOUR / 1 OF 50 NAMES", and
  0 runtime errors. `qa/ten-t3a-paper.mjs` reads the aimed row at arrival on the list paper:
  Kyoto 18 m, Hanoi 7 m, Palawan 32 m. `qa/ten-t3a-static.mjs` gives 86 checks and is
  registered. Screenshots: `qa/ten-t3a-{sydney,kyoto,hanoi,stamp,wall}-b.png`.
- **Misses.** Hong Kong's nearest open small moment is still 99+ m from the arrival, which a
  sort cannot fix. The cave's first-echo `where()` was already at z 28 (cave.js
  `mouth: { x: 2, z: cavMOUTH_Z - 22 }`), so it was stale. Not done: the Hanoi pho-run
  tab over the whole ride and Rio Q×3 at Arpoador live (the guard is static-checked only),
  the RECORDS `liveLabel`, tips queued under a climb, and the bubble clamp off the paper and
  the wallet. `web-design-guidelines` was run on the block, and only tabular numerals were
  added.

**T3b · rival.js · the ibis has an arc** (`noRivalArc`). Read `game.journeyAct()` and the
`'story:act'` bus. Act I: it watches from a high point near the arrival and leaves when the animal
comes within 10 m. Act II: steals, as now. Act III: once per chapter it snatches the fresh keepsake
through `dropSteal`; it never costs the memory, and the keepsake always falls back within 30 m. Act
IV (iceland, antarctic, cave): it stands hunched and does not steal, and a `dropGive` within 2 m
gets a line. Finale: on `'finale:staged'` it lands in the horseshoe mouth, facing the animal. Free:
Act II behaviour always. Next appearance within 60 s of an act turn (38, 141, 158). No save field.
Proof: `qa/aaa-rival.mjs` stays at 7/7, and a new `qa/ten-rival.mjs` forces each act and asserts the
behaviour state, with a PNG of the Act III chase.

### T3b — shipped

Commit 574dd79 on the T3b worktree branch. One file, src/rival.js, plus `qa/ten-t3b-*`. The item was
not stale: rival.js read no act, no keepsake and no finale before this.

- **`noRivalArc`.** The act is read per visit (`game.journeyAct()`; `game.state.qaRivalAct` forces it
  for a probe). 0 (Free Roam, legacy) and 2 are A4's thief, unchanged. No save field, no new mesh:
  the same eight meshes on two new pivots (`upper`, `neckG`) so it can hunch, sit and peck, and the
  wings fold along the body whenever it stands still. CPU only; nothing to park.
- **Act I, the watcher.** A scored ring 12-28 m from the animal: terrain, plus the lids of heavy
  props by name (bin, esky, crate...; a sign's box stood the bird 0.2 m over its board, and a
  deckchair was moved under it in two seconds). The middle of the lens scores highest. It ignores
  the grace, because watching is not stealing, and it leaves at 10 m. Sydney, fresh story file: act
  1, first visit at 22.5 s (not A4's 75-110), on a bin lid 20 m off and 2.4 m up, on screen at
  (889, 151). It left 'near' when the animal was set down 8 m off. `qa/ten-t3b-watch.js`,
  `-close.png`.
- **Act III, the chase.** On `'story:memory'` (act 3, or the story in act 3), once per chapter, it
  waits 7.5 s, or 7.5 s after an act card. It takes the keepsake from `physics.keepOut(place)` on
  npc.js's errand pin (frozen, KINEMATIC, no collision response, not grabbable), and hands it back
  through `physics.dropOwned` with the type restored on every path out. The run: a 1.4 s getaway at
  7.0 with no catch, then 2.2 / 3.6 / 5.2 m/s by distance, a 6.9 burst inside 3 m, a look back every
  2.4 s, a bend round the snatch point past 13 m, and one knee-height ray that rounds walls. At first
  the bird went over the Gion fence and the animal stood at it for 26 s. Kyoto, a scripted sprint
  after a 0.6 s reaction: caught at 4.4 s with 2 looks. Standing still, it tired at 28 s, 16.5 m from
  the snatch point (the cap is 30). The keepsake was dynamic, unfrozen and grabbable both times. A
  second memory in chapter 4 does not bring it back. `qa/ten-t3b-chase.js`, `-run/-look/-fall.png`.
- **Act IV+, cold.** Iceland, the antarctic and the cave: it stands hunched 8 m off and steals
  nothing (a fruit 12 m ahead stayed put). A yuzu 1.5 m from it (`dropGive`, the ask's door), or a
  carried edible set down within 2.2 m (`capy:drop`), is walked to, pecked, eaten, and gets the line
  (`'rival:fed'`). `qa/ten-t3b-cold.js`, `-hunch/-close.png`.
- **The end.** On `'finale:staged'` it lands 0.45 rad off the mouth's centre line at 1.05 r, facing
  the animal (error 0.00 rad), sits, and carries a yuzu if it was fed that session. It goes when
  `finaleOn` drops. `qa/ten-t3b-finale.js`, `-sit.png`.
- **Act turn.** `'story:act'` pulls the next visit to 20-50 s (measured 120 → 32.5 s). With no fruit
  about, that visit is a watch.
- **For the merger.** `qa/aaa-rival.mjs` fails "A states off" on ten-pass without this change: a
  fresh Free Roam file is in the T2a grace (`graceOn` true), so `rivalOK` is false. The same seven
  checks pass 7/7 with the grace cut after arrival (`qa/ten-t3b-aaa-rival.mjs`). The fix belongs in
  aaa-rival.mjs or in T2a's grace, not in rival.js. New bus events: `rival:left {how}`,
  `rival:fed {fed}`, `rival:seated {x,z,fed}`; `rival:stole`/`rival:dropped` carry `keep: true` for
  the keepsake. `rivalAudit()` adds mode, act, keep, look, hunch, sit, fed, perch and seat.
- **Missed.** The "yuzu given is remembered" is the session's (no save field was named). The chase
  was proved by a scripted sprint on a hand clock, not by a human under real keys. The watcher can
  still land behind a HUD card: the premise card covered it in one run.

**T3c · npc.js · crowds make room.** Bubble cap (`noBubbleCap`): 2 live, nearest and
addressed-to-the-animal first; 1 within 20 m of the marquee or while a subtitle is live; speakers
beyond 25 m go to the heard pill; drop anchors in the top 18% of the screen (2020, 3261). Photo
flash (`noFlashStar`): a 0.18 m star facing the camera, scaled by distance, PALETTE.foam, 90 ms
(9266-9292). Gate the "man overboard." toast on `started` (11380). The traveller's cameo: 20-30 m
away at each memory beat, turned to look (travWhere). The answer to `'finale:staged'` (5841):
gatherers stay outside r 5.5 and out of a 50-degree cone behind the lens yaw, and the traveller
walks to the horseshoe mouth to hand over the bag, which T4a places. Proof: the most bubbles on
screen in 60 s on the Sydney lawn, the Sahara crest and the Uji bridge is 2 or fewer; a flash PNG.

### T3c — shipped

- **The cap** (`noBubbleCap`, every rung: it takes DOM away and costs no GPU). `npcBubCap`
  decides what is drawn once a frame, before the draw loop. Two up; one within 20 m of
  `CHAPTERS[].marquee`, while `wowLiveAt()` is live, or while a say/why toast is `.in` (read on
  the panel tick). Rank: the traveller, then a line to the animal (speech null), then idle
  talk, nearest first, and a line already up keeps its place against one 8 m nearer. Past 25 m
  a line to the animal goes to `hud.heard` on the off-frame fence; idle talk goes. Idle anchors
  in the top 18% go. A line over the cap waits hidden on its own clock. One that loses its place
  fades on the 0.35 s tail and holds the place while it fades.
  `game.bubbleCapAudit()` / `bubbleCapReset()`.
- **The flash** (`noFlashStar`). The same two flash meshes are re-shaped into a four-point foam
  star with emissive 1.6. It is 0.18 m across at 6 m (0.12-0.35 m), faces the lens, and lasts
  90 ms. Its clock runs in every chapter; the card's clock ran only in Sydney. At rung 1 and up
  it is parked and nothing is drawn. No new mesh or material (`qa/reimagine-person-contour.mjs`
  locks that).
- **'man overboard.'** is gated on `state.started`.
- **The cameo** (`noTravArc`, parks at rung 1). On `'story:memory'`, one silent figure built
  through `addLocal` (`near` 0, `cd` 1e9) stands 20-30 m off. Its bearing from the lens is
  20-37 degrees, which keeps it out from under the memory card. It stands on a static floor
  within 3 m of the animal's, is not in water, and nothing solid is between it and the lens. It
  faces the animal for 10 s, then walks off for 3.5 s. It also leaves on `'story:act'`, when
  the animal comes within 6 m, and on a crossing. If the chapter's own traveller is within 35 m,
  that traveller turns instead (`chatYaw`), and the glimpse's stand turns too.
- **The walk-in** (`noTravArc`, every rung: the figure is already drawn). On `'finale:staged'`
  the lawn traveller's stall is re-parented to the scene where it stands. With the animal within
  9 m of the ring, the traveller walks the arc outside the ring (their own 7.7 m) to the mouth
  and in to r + 0.9. They bend for 2.6 s and emit `'npc:travBag'` (wrapped `{npc: {x, y, z, yaw,
  bx, bz, biome}}`, with `bx/bz` a suggested bag spot beside the middle). Then they walk out and
  round to home, at least 35 degrees off the mouth. This happens once a session.
  `game.travFinAt()` → `{st, x, z, yaw, bag, mouth, cx, cz, visible}`, for T4a's `sysBagGroup`.
  Gatherer slots are at 6.0 m or more (the arrival tolerance is 0.45) and outside the 50-degree
  cone. `game.gatherAudit()`.
- **Proof** (`qa/ten-t3c-*.js`, headful at rung 3 with the machine shared; the arc tests pin rung
  0). Peak bubbles drawn over 60 s, counted from the DOM, with the cut figure in brackets:
  Sydney spawn 1 (4), gardens lawn 1 (0), Sahara crest 0 (2), Uji bridge 1 (3). The Sydney spawn
  is 19.5 m from the steps, so its cap is 1. The flash is 0.179 m at 6 m, gone by 100 ms, with
  nothing fired at rung 1 (`ten-t3c-finale-flash.png`). The cameo on the Sydney memory was placed
  22 m off, faceErr 0, and gone after its hold. At the Quay the chapter's traveller turned
  (10 m). One act turn. The walk-in went round → in → hand → out → home → done, set down at 3.5
  m in the mouth with one `npc:travBag`, and ended 97 degrees off the mouth. Gatherers were at
  6.0-6.25 m (`ten-t3c-finale-hand.png`). npm test 79/0.
- **Misses.** The cameo's line-of-sight test sees colliders only, so canopies still hide it.
  Both Sydney runs stood the traveller behind a tree crown (a jacaranda, then a fig). The memory
  is fired through `completeTask`, not played. The finale event is emitted by the instrument
  (the real staging needs all ten keepsakes). T4a still has to place the bag. Rung-0 GPU numbers
  for the two drawn flags are left to the proof slot.

**T3d · kyoto.js · Kyoto sits in its hills.** `kyoBuildFar` modelled on palBuildFar
(palawan.js:996): 6-8 rounded ridges at 300-420 m, the Uji downstream end left open, and one pagoda
silhouette. Called from createKyoto (4781). Flag `noKyoFar`. Torii wood (`noToriiWood`): trunk
exclusion at CAM_R + 1.2 and a dark understory ring 3-6 m from the path (2490, 607). Gravel: ridges
a third as wide, in `kyoGravelShade`, with a highlight strip (747). Proof: pinned camera at gates 5,
20 and 35 gives a lawn-green share between the posts under 10%, and a PNG down the Gion lane shows
the ridge line.

### T3d — shipped

Owner kyoto.js only. Audit first: kyoto.js never imported far.js, the sugi placer still cut its
corridor at `kyoTORII_CAM_R + 2.4` (7.0 m, not the finding's 8.6), and the rake lines were 0.30 m of
`granite` every 0.9 m. None of it had shipped.

- **The bowl (`noKyoFar`; `noFar` still cuts it too).** `kyoBuildFar`, called from `kyoBuild` (the
  builder createKyoto registers): seven rounded ridges, 24-40 m high with a nine-point cosine
  crest and no peaks. Arashiyama is west, Kitayama north, Higashiyama east, and the Uji hills south.
  The south-east (x > 60, z > 115) is left open where the river leaves. There is also one Yasaka
  pagoda, 38.5 m, on the Gion lane's axis at (194, 52), in front of the east ridge. **Not at
  300-420 m.** Kyoto's fog is 46-330 (`sysKYO_FOG`, never re-based), so a wedge at 300 m from the lane
  is 90% fog. The ridges stand 200-260 m from play instead. **Fog off:** the fog colour
  (kyotoHaze) is lighter than the composited dome. Measured through `game.post` on the west lens
  (`qa/ten-t3d-far-tone.js`), a fogged ridge read luminance 0.60 under a 0.54 sky, which looks like
  snow. Unfogged it read 0.45 under 0.52, a hill in haze, and the composite's air still applies.
  The pagoda is merged into the ridge mesh by vertex colour, so it is **one draw**, 440 triangles
  (216 of them the pagoda). The static silhouette stays at every rung, as far.js keeps every
  chapter's. Proof `qa/ten-t3d-far.js`, rung 0, pinned lenses through the composite, live against
  cut. The layer changes 3.2% of the frame down the Gion lane, 15.9% west, 7.1% north-east and 2.1%
  south. From the Uji bridge looking downstream, the changed pixels (2.4%) are all the south ridge
  at frame-left, and the river's way out is open. The arrival resting lens now ends the lane on the
  pagoda and a ridge line (PNGs `-gion-live` / `-cut`, `-rest-live`).
- **The torii wood (`noToriiWood`; the rows and understory park at rung 1 and up).**
  `kyoBuildToriiWood` works from gate 0. It plants a first row of cedars at CAM_R + 1.2 (5.8 m,
  about one between every pair of posts), a second row at 8.5-11 m, and 190-205 low dark mounds
  in `kyoUnder` at 3-6 m from the centreline (height 0.55 m by the legs up to 1.25 m). Three
  instanced cedar draws and one mound draw, no shadow. Across loads that is 50-54 trees, because
  `rand` is unseeded here like the rest of the chapter. The ground inside 13 m of the path takes a
  second colour buffer toward sugiFloor, then kyoUnder, swapped the machiya way. That swap follows
  the flag only, at zero cost. The rows' trunks are solid (kyoTrunkSolid's box). They leave the
  world when the rows hide, and `onEnter` re-settles them because `biome.attach` re-adds every body
  filed under Kyoto. The main sugi placer is untouched. Proof `qa/ten-t3d-torii.js`, lens 6 m back
  and 2.6 m up the path, rung 0. Lawn share between gate k+2's posts at gate 5: 13.7% cut, 0.0%
  live; whole frame 9.7% to 0.3%. Gates 20 and 35 were already under 0.5% cut (the flank's litter
  tint) and stay there. `qa/ten-t3d-return.js`: 54 of 54 trunks in the world live, 0 away, 54 after
  a return, 0 and hidden when flagged across a return, 54 when unflagged.
- **The gravel (no flag; a width and a seeded shade).** The rake lines are 0.10 m in
  `kyoGravelShade`. The paw prints stay granite, so the mischief now reads harder than the bed.
  `qa/ten-t3d-zen.js` reads a bare strip seen through the gap: the stripe share (under 92% of the
  median) went from 47.2% to 27.5%, and the bed's median luminance from 0.594 to 0.785. By eye it
  is furrows, not a zebra crossing (`ten-t3d-zen-before.png` / `ten-t3d-zen.png`). The highlight
  strip was not built (Not doing).
- **Exports for other waves.** `game.kyoto.toriiPath()`, `toriiWood()` and `farAudit()` are
  harness reads. No bus events. No save field.
- **Misses.** There is no far mover (the brief did not ask for one). Rung-0 GPU cost for
  `noKyoFar` and `noToriiWood` is owed to the proof slot. The tunnel lawn number is taken on a plain
  pinned lens, not the live run rig. `qa/reimagine-chute-contour.mjs` counts `new THREE.Mesh(` across
  the whole of kyoto.js against f3252dd, and that is why the pagoda went into the ridge draw: a
  second mesh failed it.

**T3e · hanoi.js · the lake is a place to sit** (`noHanWillow`). 28-36 instanced willows round
hanLAKE, wind-sway hooked; 6-10 lotus clusters and one paddle boat on a mover loop. Hanoi's world
pass is already 13 ms, so the willows are instanced, with no grain() material. Spawn stays; the
arrival lens is yawed toward the Old Quarter corner by a frameShot (4639, 4798). Publish the next
drop lantern for `wowTarget`. Proof: aaa-ab cost 0.1 ms or less, and an arrival PNG.

### T3e — shipped

Everything is in `src/hanoi.js` (`hanBuildWillows`, `hanWillowTick`, `hanUpdateBoat`). The proofs ran
headless at rung 0, pinned by the prefs file (`pf: 1`). They measure behaviour and hide-and-diff
numbers. GPU cost is left for the proof slot.

- **Audit.** The arrival yaw had already shipped. The B2 glimpse (`sysGlimpseShot`, systems.js
  ~43592) turns the Hanoi arrival onto the chapter's marquee, the pho stall on Hang Ngang. Measured
  on a fresh free file with the real clock (`qa/ten-t3e-arrive.js`), the shot's yaw is 3.756 and
  the lens settles at camYaw −2.526, looking NNE over the lake's north-west corner into the Old
  Quarter. No second frameShot was added, because two writers on one arrival would fight. The
  willow ring keeps a clear cone of ±0.30 rad about that view out to 35 m, so no trunk stands in
  the shot. Arrival PNG: `qa/ten-t3e-arrive-b.png`.
- **`noHanWillow`.** There are 34 willows. Each of 40 bearings round `hanLAKE` walks inward from
  1.02 to 0.92 of the ellipse and takes the first spot 1.0 m clear of the ring road's kerb. The ring
  road runs over the shore on the east and west, so some trunks stand in the shallows. Every tree
  leans 0.14–0.30 rad toward the lake, so its crown hangs over the water and not over the scooters.
  The spawn, the Huc gate, the shuttlecock ring, the puppet pool and every `hanBlock` are kept
  clear. The crown is a small round head with 22 + 12 fronds, in `hanLeaf`/`hanLeafDk` at the top
  and `PALETTE.hanWillow` at the tips. It is built upside down, so the sway ramp (`swayMesh`,
  0.42 m at the tip, 0.6 hz) moves the frond ends and not the head. Each instance stands it upright
  with a half-turn about x. That is a rotation, so the winding is kept. The trunks are one static
  body of 34 boxes. There are **8 lotus clumps**: one merged shape of 9 pads, 3 open `petalPink`
  flowers and 2 buds, drawn larger than life so they read at 30–60 m. There is one **swan
  pedalo** with two riders on a 15 × 9 m loop in the west basin. It moves at 0.85 m/s and stops
  when the animal is within 6 m. That is four draws, all flat Lambert with vertex colour and no
  grain(). **At rung 1 and up** the crowns swap back to the plain material, so there is no sway,
  and nothing here casts a shadow. The trees stay, because they are the lake edge. With the flag
  set, the group is hidden and the trunk body leaves the world.
- **Proof, `qa/ten-t3e-willow.js`** (hand clock, pinned lenses):

  | measure | result |
  |---|---|
  | trees / lotus clumps | 34 / 8 |
  | bodies, live → flagged → cleared | 154 → 153 → 154 |
  | rung 1 | sway off, shadow off, still drawn |
  | hide-and-diff, live against flagged | 17.2 % (SW corner), 15.6 % (NE), 66.7 % (one tree at 10 m) |
  | boat, free | 7.8 m in 10 s |
  | boat, animal 3 m away | v 0, 0 m in 2 s, stops counted 1 |

  PNGs: `-sw-live` / `-sw-off` / `-sw-rung1`, `-near-live` / `-near-off`.
- **`game.hanoi.wowTarget()`** returns `{x, y, z, kind: 'lantern'|'stall', i, of, name}` while the
  animal is on the Cub with a run on. `kind` is 'stall' when the rack is empty and only a refill can
  finish the run. With nobody on the Cub, or no run, it returns `null`. Measured: null idle, then
  the bia hoi corner (i 0), then the market (i 1, which matches `dropAt(1)`), then null once the run
  was cleared. It has the same shape as `game.sahara.wowTarget`, ready for A's paper.
- **Misses.** The boat has no collider, so the animal can swim through it. The pedalo stopping for
  the animal stands in for one. The sway is proved by material state only (swapped in at rung 0,
  out at rung 1). No moving-frond pixel diff was taken, because the scooters move in the same
  frames. Rung-0 GPU cost for `noHanWillow` is owed to the proof slot. Test hook:
  `game.hanoi.willow()`.

**T3f · kowloon.js · the arcade lens.** When the animal is inside the scaffold footprint below 3 m,
publish a camera hint that pulls the lens +x over the carriageway and 1.5 m up (73, 859, 1535;
kyoto.js:4337 is the pattern). Flag `noHkArcadeCam`. The magenta panel gets glyph blocks (2172).
Publish the next heli ring for `wowTarget`. Proof: 20 s along the shopfront keeps the animal under
15% of the frame and there is no dither in the middle third.

### T3f — shipped

Everything is in `src/kowloon.js`. The proofs ran headless, mostly at rung 3 with five other agents
on the machine. They measure behaviour, and the sign was also measured at rung 0 (`pf: 1`). GPU cost
is left for the proof slot.

- **Audit.** None of the three had shipped. systems.js has no generic lens-position hook (the torii
  rail is gated `inKyoto`), so the lens is carried by the two hooks it already asks the live biome
  for, `rideYaw()` and `rig()`, plus kowloon's own `camCeil`. No other file changes.
- **The arcade lens (`noHkArcadeCam`, not parked: a few multiplies a frame and no draw).** Inside
  the scaffold footprint (x −11.5 to −7.6, z −9 to 9, 0.6 m hysteresis) and below 3 m, the bearing
  is kept in the band that puts the eye east of x −4.5, 1.5 m past the awning's edge. Which bearing
  depends on the stick. Held straight: dead astern, clamped into the band. At rest for 1.2 s: square
  on to the face (+x). Anything else: the bearing it has, clamped. `rig()` asks for 9 m at 23°.
  `hkCamCeil` stops holding the eye at 3.15 once it is out over the road and instead solves the
  sight line under the awning's edge. The helicopter keeps both hooks whenever it flies.
  `game.kowloon.arcade()` is the harness read. `qa/ten-t3f-arcade.js`: 20 s with real keys up and
  down the shopfront, cut against live, 13 samples each.

  | measure | cut | live |
  |---|---|---|
  | middle-third cells dithered (of 64), mean / max | 20 / 34 | 1.15 / 4 |
  | samples with any dither | 13 / 13 | 6 / 13 |
  | animal's box share of frame, max | 0.124 | 0.055 |
  | eye, mean x / y | −9.4 / 3.06 | −4.7 / 4.09 |

  The residue is the bamboo pole directly in front of the animal. **The spec's "no dither in the
  middle third" is not met**, but it went from a screen door to one pole (PNGs `-cut-0` / `-live-0`).
  Square-up (`qa/ten-t3f-bits.js`): 4.5 s with no key gives a bearing of 1.571 and the eye at
  (−1.2, 4.84), 1.7 m over the old ceiling. Set down on the carriageway, the hint is NaN on the next
  read. With the helicopter taken, `rideYaw` is the heli's and the arcade is off.
- **The bakery's lightbox (`noHkBakeGlyph`, not parked: one merged draw).** This is the reviewer's
  "magenta panel". It is the bakery sign (2.4 × 4.6 m, `hkNeonPink`), not a neon row: the only
  lightbox with no writing, and at the full EMIT_OVER where the street breathes at about 0.73. It
  now has four stroke-built characters and a BAKERY block line in `hkGrille` on both faces, and it
  sits at 0.78. The flag hides the glyphs and puts back 1.0. `qa/ten-t3f-sign.js`, rung 0, arrival
  eye, the game's own post.render: in the sign's box the mean luminance goes from 180 to 159 and p95
  from 191 to 176. The peak is 236 against 255 elsewhere in the frame (PNGs `ten-t3f-sign-live` /
  `-flagged`, `ten-t3f-arrival-a`).
- **`game.kowloon.wowTarget()`** returns `{x, y, z, kind: 'ring', i, of: 8}` for the next ring of a
  lap in progress, and `null` otherwise, the same shape as `game.sahara.wowTarget`. In a heliDebug
  lap it was null on the ground, then rings 0 to 7 in order, then null after the eighth.
- **For A (T3a):** wowTarget is ready to read. The arcade lens makes `rideYaw` non-NaN under the
  scaffold, so a generic frameShot's yaw there needs `over`, as it does under any ride.
- Rung-0 GPU cost for both flags is owed to the proof slot.

T3 seed (A): `PALETTE.kyoRidge`, `kyoGravelShade`, `kyoUnder`, `hanWillow`.

## T4 — the ending, the traveller, the marquee that needs a hand (hours 6–8)

**T4a · A · systems.js, shared.js · the end and the way there.**
- The finale (`noFinPolish`). The coda caption moves to bottom 18%, in the toast pill style, with
  the `<i>` line at tLg+2 (9939). Flash each keepsake's column at 24 while it plays. Hold the lens
  sysFIN_HUSH + 3 s before ledShow (38300). Keepsakes scale 2.2x while staged (`physStageKeep` asks
  props.js, see T4b).
- The traveller walks into the horseshoe mouth and sets the bag (sysBagGroup) beside the animal
  before the coda (`noTravArc`; 38911). npc.js built the walk-in in T3c.
- The epilogue. The ledger lists unvisited places as grey postcards, "still out there". On the next
  Sydney entry after `fin`, a parcel drop on the shelf names a random unvisited place and pins it on
  the board as "a postcard came from here". The title steps up at 13 ("FURTHER THAN IT MEANT") and
  at 19 ("MISCHIEF COMPLETE") (31047, 31099). No save field: `fin` and keepHeld project it.
- Departures (`noDepartures`). In board mode (31997): "FROM " + way, open places first as flip-rows,
  the rest as one line, "and fifteen more, further along", and a frameShot on the in-world board.
- Journal. Story rows are grouped by act with a header. The next act shows dimmed and the others
  fold into "two more folds of the map". Locked rows read "after <act>" (31940-31961). Free keeps
  the flat 19. Tab closes when focus is not in a control (39817, 39833).
- The expanded paper folds to its tab while `.capyui-place` shows (11053). The pause menu shows
  Resume, The journey so far, Settings and Quit, with the rest under "more" (26130).
- Concert par: raise to 10 in the record row (shared.js:4928). The tick stays at 6.
- Proof: `qa/ten-finale.mjs` fast-forwards to ready, sits, and captures the coda. Checks: 10
  plinths, keepsake screen height 18 px or more at 1280, caption contrast 4.5:1 or more, the
  traveller within 2 m of the bag, and the ledger no sooner than 16 s after the sit. The board PNG
  lists open places first. The Tab close is a key test.

### T4a — shipped

Watched end to end on a story file fast-forwarded to ready (every task but four places' written
into the save, not played), Sydney, the animal walked in with real keys and left to sit.
`qa/ten-t4a-finale.mjs` passes 14/14; `qa/ten-t4a-static.mjs` (27 checks) is registered; npm
test 81/0. Screenshots: `qa/ten-t4a-{bag,coda-0,coda-1,last,ledger,ledger-foot}.png`.

- **The finale** (`noFinPolish`, DOM and timers only). The coda caption is the toast's paper pill
  at bottom 18% (measured 17.3-18%), the keepsake line at clamp(15px,2.8vw,17px), full ink on
  both (11.5:1), fading in again on each note (`.beat`). The keepsake's flash is `flash(p, 24)`
  re-armed every 45 ms for its note (up to 0.5 s), except inside 5.5 m of the lens: the balloon
  scrap by the mouth, held white 3 m from the glass, bloomed over a third of the frame. The
  closing "and that is the lot." no longer toasts over the first captions (two pills at 18%); it
  is the last frame's only words. **The last frame**: at the hush the animal naps (the opening's
  `capyForceNap`), and the lens comes in to 4.2 m in front of its face, three-quarters, snapped
  to the middle of a gap between two keepsakes (the first cut had an esky filling the bottom
  third) and scored for clearance from the seated ibis and the traveller home from the
  set-down (cuts two and three had the wing, then the traveller's hat, on the glass); side-on is
  allowed when the face looks at the mouth, where both of them stand.
  The ledger waits `sysFIN_LINGER` 3 s past the hush and never sooner than 16 s after the
  closing beat: measured 16.04-16.26 s close to ledger, 32-33 s from releasing the keys. The
  crowd's bubbles and pills step out for all of it (`storyBeatQuiet`: "That one is not from
  here." stood over the last frame). Staging passes `{ finale: true, scale: 2.2 }` as a fifth
  argument to `physics.stageKeep`, and `finaleOn` is set before the loop, for T4b.
- **The bag** (`noTravArc`). On npc.js's `'npc:travBag'` the opening's `sysBagGroup` lands 1.3 s
  into the bend with a 0.25 s settle and one soft thud. npc.js's spot put it 2.99 m from the
  bent figure; it is now aimed at the animal, 1.9 m from the traveller's feet at most:
  measured 1.78-1.92 m from the traveller and 1.95 m from the animal. The close WAITS for the
  traveller to walk back out of the line ('home'), capped at 30 s sat. `game.finAudit()`,
  `game.finBag()`, `game.finKeepPx()` for the harness.
- **The epilogue** (`noFinPolish`). The final ledger lists the places never stood in under the
  remembered ones as grey postcards, "still out there" (the mark greyscale, the name in ink).
  The title steps up: 13 kept is FURTHER THAN IT MEANT, 19 is MISCHIEF COMPLETE (measured on
  15: FURTHER THAN IT MEANT). No save field.
- **The journal.** In chapter one (standing in Sydney, nowhere else seen) the head drops the
  clock and 'noticed'. Tab closes it when focus is on the card and not a control; Shift+Tab
  walks in (`qa/ten-t4a-journal.mjs`).
- **The paper** folds to its tab while the arrival's place name is up (`noPlaceFold`; not while
  the slot carries a marquee line).
- **Carry-ins.** `qa/aaa-rival.mjs` cuts the T2a grace after arrival and passes 7/7 (Kyoto).
  `RECORDS[].liveLabel` is read by the live record line: lantern 'carrying', orca-ride 'holding
  station for', the-column 'dropping'. Bubbles dodge the yuzu pill (`hud.panels` adds
  `walletEl`; the paper was already in it). Concert par 10 in the record row; the tick stays.
- **For the merger.** T4b: the plinth/2.2x can key on the fifth `stageKeep` argument or on
  `game.state.finaleOn`. `qa/reimagine-earned-card.mjs` strips `/* TEN T4a finale: */` blocks
  (g flag). `qa/ten-t4a-open.mjs` is the harness with a 150 s load: with six agents on the
  machine the page's load event measured 48.8 s and openHarness's 20 s timed out three times.
- **Misses.** Keepsakes at the coda lens measured median 17-20 px, min 7-9 px at 1280 before
  T4b's 2.2x: the 18 px floor is T4b's to meet. Not done: the Sydney parcel after `fin`, the
  departures board (`noDepartures`), the journal grouped by act, the pause menu's "more", the
  Hanoi pho run's tab over the whole ride. The bag sits 1.95 m from the animal because npc.js
  stops the traveller 0.9 m outside the ring; nearer needs npc.js's `npcTRAVWALK_IN`. In the
  fourth cut of the last frame the ibis's head and wing still stood in the lower right corner
  over the bag (it sits 1.05 r in the mouth; the lens cannot always clear it). The
  finale was proved at rung 1 on a shared machine; rung-0 cost of the held flash is the proof
  slot's.

**T4b · props.js · keepsakes you can see** (`noFinPlinth`). Staged keepsake mesh at 2.2x (the mesh
only, not the body), on one instanced PALETTE.stone plinth per keepsake (2694). Proof: the finale
PNG, and a draw-call count of +1.

### T4b — shipped

- **The hook.** `game.physics.stageKeep(place, x, z, restY, show)` (props.js `physStageKeep`),
  the same export name as before with one new trailing argument. `show` true forces a plinth,
  false refuses one, and when it is left out the finale decides: `game.state.finaleOn` is up and
  no `restY` was given. That is exactly `sysFinaleStage`'s call and never `sysShelfStage`'s 0.84,
  so systems.js needs no change for this item to work. `game.physics.plinthAudit()` is there for
  the harness.
- **The keepsake.** The mesh is drawn at 2.2x and the body stays at 1x. `prop.show` is a factor on
  the one scale writer (physSquashStep and physSquashClear), and `prop.showDy` (1.2 x originY) is an
  offset on the one position writer (physSyncMesh), so the drawn base sits on the stone. On a plinth
  it is stood upright on its own heading.
- **The plinth.** It is an octagonal sandstone pedestal in `PALETTE.finPlinth` (the seed), 16 cm
  tall and 58 cm across the flats. It narrows to 0.8 of the nearest-neighbour gap, so nineteen do
  not become a wall. It faces the arrangement's centroid. All the plinths are one InstancedMesh with
  castShadow off, plus one static body with a box per plinth. The keepsake body rests on that
  collider, so a nudge leaves it on the stone and a shove knocks it off. The plinth belongs to the
  slot: when the keepsake leaves it, the plinth stays empty until the lawn is laid again.
- **Coming off.** It is held, it is `frozen` (rival.js's KINEMATIC pin), it has an owner, it is in
  a vessel, it is hidden or spilled, or it is more than half a plinth off centre or below the top.
  Each of these returns it to 1.0 on the same frame. A held one is left to physUpdateHeld's scale,
  so the grab-pop survives. When the biome is left or the flag is cut, everything is cleared, and
  the bodies are woken so nothing sleeps on a collider that has gone.
- **Flag** `noFinPlinth`: no plinth, no scale, and the lawn as it was. **Rung**: the choice is
  made when the first slot goes down, so a flapping governor cannot pop the stone in and out under
  the coda. At rung 1 or above the stone is not drawn. The keepsake is still at 2.2x, but it is
  drawn standing on the grass, and the collider under it lies within its own footprint.
- **Proof** (`qa/ten-t4b-plinth.js`, hand clock, rung pinned, laid the same way as
  sysFinaleStage). For ten keepsakes: 10 slots, 10 on, 10 drawn and 10 collider boxes. Every
  keepsake is at 2.2 and its drawn base is at top + 0.015 m. The worst body up-axis is 1.000. The
  render from the coda lens is **+1 draw call** (185 against 184) and +320 triangles. World bodies
  go up by exactly 1 (the other +10 were the ten keepsakes spawned on a fresh file). The rival path
  (keepOut, then frozen and KINEMATIC for 20 frames, then dropOwned) was checked: keepOut finds it,
  the scale is 1.0 in the beak, the slot is empty, dropOwned returns it DYNAMIC and it falls 1.36 m
  at 1.0, and it is grabbable again. The grab takes it to 1.0 and empties the slot. A 3 m/s shove
  sends it off at 1.0. A 0.36 m/s nudge leaves it on the stone at 2.2. Shelf staging (restY 0.84)
  gives 1.0 and no slot. The cut clears to 0 slots, bodies go down by 1, and all at 1.0. At rung 1
  there are 10 slots and 0 drawn, with the drawn base at +0.015 on the grass. lastError is null.
  PNGs: `qa/ten-t4b-plinth-{live,close,after,cut,rung1}.png`. In the live and close shots the ten
  read as objects, and in the cut shot they are specks.
- **Not measured here:** GPU cost. That waits for the rung-0 headful A/B in the proof slot (one
  instanced draw, 320 triangles, no shadow caster). Nothing was changed in systems.js. The T4a
  checks for keepsake screen height and "10 plinths" should read `plinthAudit()`.

**T4c · environment.js · the concert is a performance** (`noConcertBeat`). Reach scales with how
close each wheek lands to the score's beat: within ±120 ms gives full reach, otherwise 40%. A
pulsing ring decal on the carpet from stageGlow (4110, 4130). Three of the seven shells fire on the
tick; the full show stays for the encore. stageGlow is 1.0 per note with decay 0.6/s. The carpet
bins and cones scatter on the first note. envENCORE_WIN is 12 s (86-126, 3834-3890). The colonnade
awning and the north openings of the sails get camSolid colliders (1037-1060, 2930). Proof: on-beat
Q×3 gives a house of 10 or more and off-beat Q×3 gives 6 to 9 (the tick still fires). A pinned PNG
of sails before and after, luminance +10% or more. Lens walks under the colonnade with no dithered
frame over 40%.

### T4c — shipped

One flag, `noConcertBeat` (falsy = live), environment.js only. Instruments: `qa/ten-t4c-concert.js`
(and `-off.js`), `qa/ten-t4c-shellbox.js`, `qa/ten-t4c-colonnade.js`. All at rung 0 (prefs `pf 1`).

- **Audit first: the score has no beat in Sydney.** The gardens' palette is `rhythm: null`, so
  `musBeatLen` stays 0 and `game.music.off()` answers 1 (every note off) for the whole chapter. The
  sidechain is the world's envelope, not a clock. The podium keeps its own pulse instead
  (`envBEAT` 0.9 s), judged on the frame clock the ring is drawn from.
- **The ring.** Two gold rings (`PALETTE.gold`) lie on the carpet. A wide one closes on a fixed one
  round the animal's feet, and the beat is when they meet. They show within 16 m of the stage
  *before* the first wheek, a soft `tick` sounds on the beat while the animal is on the red, and the
  marquee line reads "on stage · wheek as the gold rings meet". The fixed ring flashes on an
  on-beat note. Off-beat notes say "a touch early/late … wheek as the rings meet". The judge looks
  back `envBEAT_LAG` 0.15 s from the call to the press (the 0.12 s inhale plus a frame), ±0.12 s.
  At rung ≥ 1 the ring parks and every note counts as on the beat.
- **Reach.** Each note adds 1 (on the beat) or 0.4 (off) to a carry, and the carry is what goes to
  `game.concert.call` as the note number. Measured through the real Q path: on the beat, judged
  offsets +0.06..+0.11 s, 3/3 hits, carry 3. Off the beat, offsets −0.37..−0.44, 0/3, carry 1.2.
  The tick still fires off the beat (house 8, done).
- **Stretch.** Stage glow is 1.0 per note (was 0.7), with pulse decay 0.6/s (was 1.6). The sails
  get their own additive glow (the shell geometry drawn twice, one draw call only while a concert
  is on, hidden at rung ≥ 1). It builds note by note, holds at 0.75 after the tick, and is full for
  the encore. Opera-shot PNG, masked to the sails by hide-and-diff: luminance 160.6 → 181.8,
  **+13.2 %**. The grade could never show this, because stageGlow is already 1 while the animal
  stands on the red. The first note kicks the carpet's 2 bins, 2 cones and sign off the red (5 of
  5, up to 3.7 m). Three of the seven shells fire on the tick (sparks 120 on the next sample), and
  the encore window is 12 s (was 8).
- **Colliders.** The colonnade's entablature and awning, all 11 bays, are one camSolid compound
  body over 3.5 m. Probe: 16 poses at four arcade spots and four yaws, and the band lies between the
  eye and the animal in 0 of them. The sails: measured, no opening at the deck is missed, but the
  three boxes stop at 8.0/6.4/3.2 m while the sails run on to 11.63/8.94/4.20 m (686/556/144
  vertices above). An eye up there is inside the vault, so three camSolid crown boxes now cover the
  measured overhang.
- **Missed, honestly: the house number.** On the beat the peak house was 8 (a first run gave 7), and
  off the beat it was 8. The forecourt already holds eight people inside npc.js's 26 m floor on the
  first note, and `npcCONCERT_N = 8` caps the house. So "on-beat ≥ 10, off-beat 6–9" cannot be
  reached from environment.js, and T4a's par of 10 is unreachable too. Two changes in npc.js
  (`npcConcert`, ~5732) make the carry bite as built. `reach = MAX_D * (note < 1 ? note : 1 +
  0.5 * (note − 1))` (an off-beat first note then calls 10.5 m, not 26). `npcCONCERT_N` 8 → 12,
  with a third row of seats (`row = i < 5 ? 0 : i < 8 ? 1 : 2`). Also left: under the arcade at
  (−45.2, 10.9) the lens is still cramped against the terminal façade's pier (2.3 m, no camSolid
  on `bTerr`), which is a different occluder from the awning this item fixed.

**T4d · pantanal.js · the herd falls in behind.** The cascade (`noHerdCascade`): after the third
recruit, each wheek takes up to 3, including grazers within 5 m of a follower, with answers 0.12 s
apart; 5 or more followers make grazers within 16 m trail (4040-4061). The crossing opens in 4
wheeks or fewer. Warm (`noPanWarm`): renderer.compile under the white card with the dormant groups
visible (5921). Arrival p95 is under 1.5x steady. Sky Fresnel (`noPanSkyFresnel`, only while
perfRung ≥ 1): a sky-gradient mix plus a tree band as a function of view angle (602, 3584). Proof: a
hide-and-diff on the water at rung 1.

### T4d — shipped

Two of the three terms are built. The warm was already there. Owner file: `src/pantanal.js`. No
save field, no PALETTE entry, no new line in any pool.

- **The cascade (`noHerdCascade`, no GPU term).** `panWheek` hands the call to `panCascade` once 3
  or more follow. One call takes up to 3: the grazer nearest the animal among those inside the
  reach (16 m, or 26 over water) or within 5 m of any follower, including one that joined on the
  same call. Each answer lands 0.12 s after the last, on the rising pitch. Once 5 or more follow,
  every grazer within 16 m gets `look = 1` and `trailT = 6`. For 6 s it walks at graze speed toward
  a point one gap short of the last follower, keeping the grazer's water rule, and then stops where
  it is. It is never made a follower. `qa/ten-t4d-herd.js` runs on the hand clock with the herd
  beside the animal. Live: 4 wheeks to reach 4 followers and 5 to reach 9, over two runs. Flagged:
  4 and 9. One real Q on the real clock with 3 following took the count to 6. Look-up test: 5
  following and 4 grazers at 11–14 m. One wheek took 3, and the fourth trailed from 14.08 m to
  9.59 m from the animal over 7 s, still a grazer. On the hand clock the answers came at 0.40 s,
  0.55 s and 0.72 s. The code spaces them 0.12 s apart, and the extra gap on the hand clock was not
  chased. The crossing still asks for 4 followers, so it opens on the 4th wheek either way when the
  herd is in reach. The cascade matters for the other five.
- **The sky in the flood (`noPanSkyFresnel`, live only while `perfRung >= 1`).** This is a chained
  `onBeforeCompile` on the grainOwn sheet, with its own program key (`|panSF`). It runs after
  grain's mirror, on `outgoingLight`. Weight: `(1 − V.y) × 0.78 × (1 − uReflK·uReflOn)`, and 0 from
  under the sheet. At rung 0 it is therefore zero, and while k damps the switch is a cross-fade.
  The sky has two stops from grain's `uGrSkyC`: 30% toward panHaze lightened with panSkyLow at
  grazing, and ×0.55 of a 35% step toward panSkyTop looking down. A reflected tree band covers
  about 6–20° of view elevation. Its top is three sines of bearing, and its colour is panForest
  toward panHaze. Sundown tints all three from panSkyDusk. `qa/ten-t4d-sky.js` took three pinned
  lenses and compared rung 1 live against flagged, masking with the sheet hidden. Water covered 32%,
  48% and 66% of the frame. Inside the mask 96.7%, 98.0% and 97.7% of pixels changed, and outside
  it 0.17%, 0.26% and 1.79% (herons and lilies between ticks). Mean water colour (river lens):
  (109,114,90) for the rung-0 mirror, (133,133,113) for the rung-1 fallback, and (111,106,72)
  flagged. The fallback reads lighter than the mirror, because it draws no dark tree doubles near
  the eye. Pinned PNGs are `ten-t4d-sky-*`. On the real loop, `ten-t4d-look-r1` shows pale sky
  water and `-r1cut` the khaki the reviewer saw. Console: 0 errors.
- **The warm (`noPanWarm`): stale, not built.** `biomeWarm` (src/systems.js:43385) already compiles
  every root of the chapter behind the white, hidden ones included (`biomeWarmShim.traverse`, 43359,
  `scene.traverse`). `qa/ten-t4d-warm.js` ran on a fresh profile, crossing from Sydney. warmN was
  131 and warmMs 7728. `renderer.info.programs` read 99 when the hold released, 99 at 3 s and 10 s,
  and 99 after `forceJaguar()` (the onça stalking, dusk 0.56). Nothing links after the card. On
  the contended laptop, frame p95 was 184 ms for the first 3 s and 282 ms steady (p50 94 and 51).
  The reviewer's 900 ms sample was taken at t = 14.8 s, still under the white. The proof slot
  should re-read it at rung 0.
- **For the proof slot:** `noPanSkyFresnel` should be A/B'd at rung 1 (it is zero at rung 0).
  `noHerdCascade` draws nothing.
- **Hooks (test only):** `game.pantanal.cascade()`, `herdAt(i, x, z)`, `herdOne(i)`, `skyFresnel()`.

**T4e · palawan.js · clear water.** The underwater far distance x2, with a lighter cyan tint in
`palDeepClear` (`noPalClear`, 5290). Chroma above 20 at 10 m, and the manta readable from 15 m. The
karst hatching: A/B with AO, shadow-lerp and form-shade toggled, then fix only the term that draws
it (normalBias or excluding the fade) (688). Proof: a masked diff on the cliff. Publish "hold E to
go down" through the manta row's clue hook when dh < −3 (2359, 5279).

### T4e — shipped

- **Clear water (`noPalClear`).** The look under Palawan is systems.js's sysSUB row, and
  palawan.js runs before systems.js, so the override is laid over the row at the draw
  (`palClearDraw`, chained on `scene.onBeforeRender`, Palawan only, the row never re-based): fog
  far 62 → 124 at full lens depth; the row's palFogUnder share of the fog, the clear colour and
  the composite tint (`uSub`) swapped for `palDeepClear`; the tint laid at 0.60 of the lens depth
  (it also scales the ceiling veil). A second draw in one frame finds its own far and leaves it.
  No draw call or program, so nothing parks at a rung. Audit: `game.palawan.clearAudit()`.
- **Proof** (`qa/ten-t4e-clear.js`: one pinned lens, world clock frozen, row and clear back to
  back, mask by hide-and-diff). Reef at 10 m: a\*b\* distance from the water behind 11.9 → 16.0,
  dE 12.5 → 16.7. Manta at 15 m: dE 4.6 → 6.2, and the frame is 6 L lighter.
  `qa/ten-t4e-terms.js` knocks terms out one at a time: pushing the fog to 2 km moves the far
  band by 2 L, and turning the tint off moves frame chroma by 5. The murk is the tint, not the far.
- **Miss:** median coral chroma at 10 m is 15.4 (p75 21.7), not above 20. Under a cyan multiply,
  chroma counts the water's own cyan, so taking tint away lowers it on teal coral as it raises it
  on pink. a\*b\* distance from the water is the number that moved. Getting past 20 needs the sub
  hemi colour (systems.js, A's).
- **Karst stipple (`noPalKarstSolid`).** Each term was knocked out through a frozen lens at the
  reviewer's two spots (`qa/ten-t4e-karst.js`, cliff mask by hide-and-diff). The lens capsule
  (`_lensCapA`) draws it: ordered-dither holes 1.08 → 0 and 0.58 → 0.01 per thousand cliff
  pixels, and edge energy 4.80 → 3.23 and 3.48 → 2.61. AO, the smooth shadow filter and form shade
  do not move it, and normalBias is not the term. The island now has its own material (grainOwn,
  same program), and its `uLensCapOn` is bound to a Palawan uniform that stays 0 unless the flag
  is set. The camera collision already stops in front of the boxes. After the fix the same spots
  read 0 / 0.01 holes. **Caveat:** in the after-run the lens settled differently, and the flag's
  own ON arm did not reproduce the holes either, so the proof slot should A/B `noPalKarstSolid`
  headful at the lagoon wall.
- **The manta clue was already shipped.** At the surface the manta row's clue reads "over the
  lagoon, hold E to dive. at its front edge, press E" (systems.js ~33520). Since T3a the arrow
  prints "↓ 6 m" and not "here" when |dh| > 6 (systems.js ~52875). No palawan.js hook feeds
  either one. The dh < −3 band (the manta cruises at −6.0, so about −6.2 from the surface) would
  need sysHINT_RISE, which is A's. Not live-verified in this wave.

**T4f · drift.js · the cloud is soft** (`noCloudSoft`). Smooth normals on the lobe merger, 10x6
segments, lit tops at 0.12 driCloudLit, 12 low wisps; at rung 1 or above keep the normals and drop
the wisps (1154-1257). Proof: a landing PNG with no facet edges visible at 1280.

### T4f — shipped

One flag, `noCloudSoft` (falsy = live), all in `src/drift.js`. The audit found the finding current:
the lobes were `driG.sph6` (6x4) through `driMerger`/`driVC()`, flat Lambert.

- **Lobes.** The same 228 lobes in the same places are now built twice in one loop, so the second
  build draws no extra `rand()`. The second copy is `driG.sph10` (10x6) through `driSoftMerger()`
  (`normals: 'keep'`, so the ellipsoid normal goes through the normal matrix and there is no seam),
  on `driSoftVC()`, which is driVC's grain on `flatShading: false`. The top lobe of each mass is its
  own mesh with `driCloudLit` emissive at 0.12. The flat mesh is kept for the flag's other arm, and
  one of the two is drawn. Cost: +1 draw call, and 22.8k triangles where the flat lobes had 8.2k.
- **12 low wisps** (`driLOW_N`) sit at y 2–6, held within 40 m of the animal. They ride the wind at
  0.5–0.9 of its speed, with a 0.35 m/s floor, and respawn upwind at the rim, growing in and
  shrinking out over the last 8 m. They draw BackSide through `driVapour()`: alpha is multiplied
  by the facing term squared, so they have no rim and the lens can pass through one. +1 draw call,
  and they are parked at rung ≥ 1. The lobes stay soft at every rung.
- **Beyond the item, found in the landing PNG.** Two more things drew the paving. The 46 cumulus
  banks (`driBuildBanks`, sph6, flat) fill the landing lens. They get the same twin built at 10x6,
  and `driSyncSoft` swaps the one mesh's geometry and material, so no draw call is added (29.7k
  triangles where the flat banks had 10.7k). The bloom (26 `sph6` puffs at 0.7 opacity) was the
  row of hexagons around the animal after every fall. It now swaps to sph10 on a driVapour
  material at 0.85.
- `driSyncSoft(game)` makes the visibility and swap writes only on the frame the answer changes.
  `game.drift.cloudSoft()` reports the state for instruments.

Proof. `qa/ten-t4f-cloud.js` covers a fresh free file, pf 'pretty' (rung 0), and a real clock,
drops the animal into open cloud from 14 m, and then pins the body and yaw for an A/B on the same
frame. With the flag live, the soft lobes and banks are drawn and the low wisps are on. With it
set, the flat meshes are back and the wisps are gone (live toggle both ways). At rung 1 the
wisps are off and the lobes and banks stay soft. The edge energy over the lower 45% of the pinned
frame, outside the animal, is mean |dL| 1.02 live against 1.20 flagged, and pixels with
|dL| > 8 are 1.08% against 1.67%. That is a 35% cut in hard edges on a frame that is mostly
grain. In a second run the body was pinned in the cloud at y −0.56, with the bloom up and the
lens at y 2.7. There, hard pixels were 0.06% live against 0.14% flagged. The flagged PNG is the
hexagon-plate bloom and the live one is a soft column. The metric is noisy, because the arrival
card was still up in that run under heavy load, so the PNGs read by eye are the proof. `qa/ten-t4f-landdiag.js` shoots the landing at +0.45 s and +1.9 s in both arms. Read by
eye: flagged, the landing shows hexagon plates (the bloom) and ridged banks. Live, it shows
rounded masses and a soft puff column, with no facet edges on the cloud. lastError was null in
every run. The GPU cost is left to the proof slot's rung-0 A/B.

Misses and notes. The silhouette of a 54 m lobe is still a ten-sided outline at grazing angles,
which is what the spec asks for. The concentric hexagonal ripple rings round the swimming
animal are the shared swim ring, not drift.js, and are out of this item's files. Six glowing rings
sat at the same screen places in two landings on the first task tick. A scene projection found
no mesh behind them, only the `.capyui-moment*` overlay, so they are HUD and not the cloud.

T4 seed (A): `PALETTE.palDeepClear`, `finPlinth` (if stone reads cold).

## THE PIVOT: U1–U3 replace T5 and T6 (26 Sep, one 4–5 hour run)

The author played the T4 build and redirected the last two waves. T5 and
T6 below stay as the record and are **superseded**. Most of their items
were small increments. What survives from T5 is Manly, Pasto, the dry
first frame and Venice's arcades. From T6 the stranger's hour and the
release survive. The garden (the `garden` save field) moves to the next
pass, and for now yuzu is Free Roam's score.

What the author asked for, and what the code says:

- **Water reflections and big background dynamics.** reflectRender
  (shared.js) parks at the governor's first rung, and a busy laptop sits at
  rung 1 or higher, so most players have never seen a reflection. Sydney
  Harbour and Manly have no mirror row at all. The far planes (far.js,
  438 lines) are flat silhouettes, and nothing big in any sky moves.
- **People that look less blocky.** The rounded twins (npc.js ~1546) park
  at rung 2, and the Rio and Marrakech crowds were always boxes. On the
  author's machine the title screen's people are boxes.
- **Free Roam is boring.** The sketchbook is a list for completionists.
  Free Roam needs chaos, a short attention span, a clock and streaks: the
  goose game played as an arcade.
- **Monte Carlo is not driving.** The car is a point on a track
  (`monMeS += monMeV * dt`, monaco.js ~3532) with a lateral offset. The
  player never steers a car. The boats (quay.js helm, antarctic.js) are
  the model: throttle, rudder, momentum, a hull that answers.
- **The arrival subline.** `.capyui-placesub` and `.capyui-placenews`
  (systems.js ~11292) are 10–14 px bold uppercase at 0.2–0.34 em tracking
  in `accentInk` (the maroon), over a cream wash that fades to nothing.
  Over a bright frame it cannot be read.

### Decisions

**Free Roam is HAVOC.** Every place is a playground with a clock in it.
- **The streak.** Every piece of mischief (a knock-over, a spill, a hat
  taken, a chase begun, a yuzu grabbed) chains within 4 s of the last:
  x2, x3, up to x8. It has a meter and a soft tick per link, with no rising pitch (the author found it too sharp). When the
  chain breaks it cashes in as yuzu. The streak is always on in Free Roam
  and never on in Story.
- **Havoc runs.** A glowing marker in every place starts a 60 s run.
  There are six kinds: *knock 8 things over*, *grab 10 yuzu before they
  fade* (a yuzu rain), *steal 3 hats*, *stay chased for 20 s*, *spill 4
  stalls*, and *ride the marquee*. Each has bronze, silver and gold, a
  countdown with music under it, and a results card (score, streak,
  medal). Enter (or the card's button) runs it again, because R is the stuck rescue: "one more go" is the loop.
- **Pests and three hearts** (author's request, 26 Sep). Free Roam has enemies: two or three aggressive pests per place, drawn from three kinds. The *gull* dives, the *warden* charges with a net, and the *dog* is fast and gives up sooner. A hit costs a heart. With three hearts gone the animal is caught: the streak is lost, 5 yuzu are dropped, a short "caught" card plays, and it goes back to the place's spawn with 2 s of grace. A caught animal during a run ends the run as a loss. The animal answers with V, which flicks a yuzu pip: a 0.35 s cooldown, an aim-assist cone of 25 degrees toward the nearest pest, and a hit knocks the pest out in a tumble and a puff and drops a yuzu. Pests respawn after 20 s. Story has no pests and no hearts.
- **The best score per place** shows on the free picker's tile as a medal
  and a number. It is the pass's one save field, `havoc` (an object keyed
  by chapter number, holding `{best, medal}`), named here as AGENTS.md
  requires.
- The sketchbook stays on the tab, off the screen.

**Story stays calm.** It has no streak meter, no runs and no clock. The
two modes now differ in tempo, not only in what is gated.

**The car is a car.** Monte Carlo gets a car you drive freely: throttle,
brake and reverse, steering that depends on speed, grip that breaks into
a slide on the kerbs, and grass that slows it. It can leave the road; the
track does not hold it. The race still counts progress by projecting the
car onto the track polyline, and the pack still races. The lens is the
boat helm's chase lens. `noFreeDrive` gives back the rails.

**Light and scale over incidentals.** Reflections survive rung 1 at half
resolution. The Harbour, Manly and Venice get the full mirror. Far planes
become layered skylines with depth, lit windows where the chapter is
dusk, and movement: cloud shadows sweeping the land.

## U1 — Havoc, the car, the people (hours 0–2)

Seed (first, on ten-pass): PALETTE `havocGold`, `havocSilver`,
`havocBronze`, `havocMeter`, and a `skin1`–`skin6` ramp if npc.js lacks one.

**U1a · A · systems.js · HAVOC and the arrival card.**
- The streak meter (`noStreak`, Free only). It hooks the existing mischief
  sources (the mischief beat, the reaction layer's record events, yuzu
  pickups, and a knocked-out pest). It sits in the HUD bottom-centre with
  the multiplier and a cash-in card. Each link is a soft tick at a constant
  pitch; there is NO rising pitch.
- Havoc runs (`noHavoc`, Free only). Six run kinds built from existing
  counters: knock-overs, yuzu spawns through the existing spawner, hats,
  chase state, stall spills and the marquee record. There is a start
  marker near each chapter's spawn, then 3-2-1, a 60 s clock, a results
  card with the medal, and Enter for another go. A seventh run kind, *clear the pests*, knocks out 6 in 60 s. The yuzu rain drops 14
  short-lived fruit in a 25 m ring.
- The `havoc` save field goes in sysSAVE_SHAPE (default {}). The free
  tile shows the medal and the best score. The Story picker is unchanged.
- The hearts HUD (three hearts, top-left under the yuzu pill) and the caught card, answering U1g's bus events: `havoc:hit {hearts}`, `havoc:caught`, `havoc:ko {kind}`. On caught, systems.js does the respawn, the yuzu drop and the run loss.
- The arrival card, in every mode. The sub and news lines move to `ink`
  on a solid rounded pill (PALETTE.sail at 0.92), at 15–17 px with
  0.08 em tracking, and the news line in sentence case. Contrast against
  the pill must be 4.5:1 or better. The maroon stays only as a 2 px rule.
- Proof: `qa/ten-u1a-havoc.mjs`. On a free file, start a run and knock 8
  things over with real keys in Sydney; the medal is saved, and after a
  reload the tile shows it. Also arrival PNGs over three bright chapters,
  the contrast number, and a PNG of a live 60 s run.

**U1g · src/havoc.js (new module 30) + build.mjs + one import line in main.js · the pests** (`noPests`, Free only). The new module `createHavoc(game)` talks to systems.js only through bus events and `game` hooks, as rival.js does (read src/rival.js for the pattern; register the module the way rival is registered in main.js ~2573/2710 and build.mjs). Three pest kinds, rounded low-poly in PALETTE (smooth normals, since they breathe): the gull (a diving arc, a warning shadow on the ground 0.8 s before the dive), the warden (a hat, a net, a 1 s wind-up telegraph, then a charge), the dog (short fast bursts). They spawn 25-40 m from the animal on walkable ground (game.groundY), 2-3 alive at once, and never inside the first 20 s of an arrival. The V fling: an instanced pip pool, gravity, a hit radius of 0.6 m, and the KO tumble plus a puff through game.sparks. Hearts live here: `game.havoc.hearts()`, a hit with a 1.2 s invulnerability window, and the bus events above. Bumping a pest does not launch the animal (the monPACK_SHOVE_MAX lesson): the knockback is capped at 6 m/s. Proof: `qa/ten-u1g-pests.mjs` with real keys (V knocks out a gull and a warden; three hits give caught), a PNG of each pest, and the cost at rung 0 (all three under 0.3 ms together).

**U1b · monaco.js · the car is a car** (`noFreeDrive`). A rigid-body car
on the road surface, steered on a bicycle model. It reaches 32 m/s, grips
at 0.9 on tarmac and 0.4 on grass, and coasts when you let go. The race
counts laps and positions by projecting the car onto the track polyline;
the pack is unchanged. A barrier hit bounces the car and scrubs speed,
and never launches it (keep the monPACK_SHOVE_MAX cap). Proof: a lap
with real keys in under 3 minutes, an off-road excursion and a return,
the car never leaves the world, and a chase-lens PNG.

**U1c · npc.js · people, not blocks** (`noPersonRound` extended,
`noPersonFine`). The rounded twin at every rung: it is triangles only,
and it measured as noise at rung 0. The Rio and Marrakech crowds get
the rounded twin through their instancing. Figures within 25 m get
finer detail:
- a head with a jaw and a nose bump
- hair shapes: short, bun, long or cap
- hands and shoes
- shirts and skirts as tapered forms
- smooth normals (the living breathe)
- a six-tone skin ramp, and clothes from the chapter palette

Also lift npcCONCERT_N from 8 to 12. Proof: before and after PNGs in
Sydney, Rio and Hanoi at 5 m and 20 m, triangles per figure, and the
aaa-ab cost at rung 0.

**U1d · shared.js + main.js · reflections that survive** (`noReflectHalf`).
At rung 1 the reflection renders at half resolution, with only far planes
and water, instead of parking. At rung 2 and above it parks as before.
Proof: the rung-1 A/B cost is under 1.0 ms, plus PNGs of Kyoto's pond
and Venice at rung 1.

**U1e · manly.js + environment.js · the Pacific and the Harbour.** In
Manly: the bins off the spawn path, the noticeboard turned to the
promenade, and the glass faces (`noManlyGlass`). Mirror rows for Manly's
break and for Sydney Harbour, so the Opera House and the Bridge show in
the water. Proof: mirror PNGs of both, and W from the Manly spawn moves
8 m or more.

**U1f · pasto.js + weather.js · the colcha and a dry arrival.** The T5d
colcha ring and the T5e `noRainPitch`. Proof: PNGs from the plaza and from
condor height, and a Pasto arrival PNG with streak coverage under 5%.

## U2 — skylines, scale, and the stranger (hours 2–4)

U2 opens with the stranger's hour: two blind 35-minute playtests on the
U1 build, one per mode, logging every card, bubble and pill. U2a starts
from their findings.

**U2a · A · systems.js · the stranger's fixes.** The ten findings that
matter most, bugs first. Then the Havoc tuning they call for: medal
thresholds, run length, marker visibility.

**U2b · far.js · layered skylines** (`noFarLayers`). Each chapter's far
set gets three depth layers with the airlight falloff, lit windows on
dusk and night chapters (Kowloon, Monaco, Hanoi, Venice), and drifting
far clouds. Proof: before and after arrival PNGs for six chapters, and a
rung-0 cost under 0.3 ms.

**U2c · shared.js · cloud shadows** (`noCloudShadow`). A slow, large-scale
noise that darkens received light only, projected down the sun direction
in the grain()/shade path. It sweeps the terrain and the big structures
at the chapter's wind speed. The grade and the sun are untouched, and
the term parks at rung 1. Proof: hide-and-diff sequence PNGs in Sydney,
Göreme and Pasto, and the cost.

**U2d · venice.js · the arcades and the mirror.** The T5f camCeil under
the Procuratie, and the full mirror on the Grand Canal and the lagoon.
Proof: the soffit test and a canal reflection PNG.

**U2e · antarctic.js + pantanal.js · the stalls.** The soak's longest
frames, 517 ms and 1017 ms. Attribute each (a first-use program, or a
spike at build time), then warm it or spread it. Proof: the soak's
longest frame under 150 ms in both.

**U2g · props.js · more havoc** (`noHavocProps`, Free only). In each place, 8-12 havoc props from existing prop kinds plus four new ones: a yuzu crate that bursts into 6 fruit when knocked, a barrel that rolls downhill and bowls people over, a stack of chairs that dominoes, and a water balloon that splashes and makes people flinch. Each feeds the streak through the existing record events. Proof: a knock-over chain in Sydney and Marrakech PNGs, the prop count, and the cost.

**U2f · kowloon.js + hanoi.js · the neon city.** Detail on the skyline
towers: lit window grids, rooftop signs, and one animated sign per
street. It stays inside Hanoi's grain() budget: no new grain materials.
Proof: arrival PNGs and the cost.

## U3 — ship (hours 4–4.75)

Merge. Then the proof slot (the rung-0 and rung-1 A/B for every new
flag), `npm test`, and one soak run alone. Then `master`, a check of the
Pages hash, and the link to the author.

**U3b · the GitHub page** (author's request). The repository's README
gets a small gallery at the top: six to eight of the most beautiful
frames. Candidates are the Kyoto torii in their wood, the Iceland aurora
over the hot pool, Venice's canal mirror, the Sydney concert with the
sails lit, a Hanoi or Kowloon night skyline, a Free Roam HAVOC run with
pests mid-air, and the finale's plinths. They are captured headful on
the real GPU at rung 0 and 1600x900, with the HUD hidden and the camera
composed by hand, then read by eye and kept only if genuinely beautiful.
Saved as optimised JPG (quality 82, under 300 KB each) in docs/images/,
which is tracked because `qa/**/*.png` is ignored. Also a one-line pitch,
a "Play in your browser" link to the Pages URL, and the controls, all in
the README's existing voice. The Pages site itself stays the game.

| wave | A (systems.js) | B | C | D | E | F |
|---|---|---|---|---|---|---|
| U1 | Havoc, hearts HUD, arrival card | monaco.js | npc.js | shared.js + main.js | manly.js + environment.js | pasto.js + weather.js | G: havoc.js + build.mjs (+1 import line in main.js) |
| U2 | stranger's fixes | far.js | shared.js | venice.js | antarctic.js + pantanal.js | kowloon.js + hanoi.js |

Timing: builders are boxed at 75 minutes per wave, the merge at 15 and
the proof at 20. U2a starts when the strangers report, about 40 minutes
in. If a wave runs long, U2f is cut first, then U2b's lit windows. U2 has seven
items against six concurrent agents, so U2f starts last.

## V — THE SOFT MATTE PASS: people, objects, buildings (proposed 26 Sep, NOT scheduled)

The author supplied four reference frames: a dusk town seen from above,
a closer view of the same town at golden hour, a cook at a stove, and two
people in a doorway. The author asked for this as another visual
overhaul, mainly of the NPCs, characters and objects, and said it must
not run until the author says so. It is not started and has no owner.

### What the references show

- **Bevelled, soft forms rather than hard boxes.** Every building is still
  a simple block, but its edges are rounded or chamfered. Roofs have a
  lip. Domes, pods and capsules sit among the blocks. Props (the blue
  cylinder pack, the pot, the benches) are chunky and rounded, with
  straps and rims. The silhouette stays low-poly; the edges catch light.
- **Matte, smooth shading with a soft light.** The faces are not
  faceted: gradients run across a surface, the light wraps gently
  round a form, and the ambient occlusion is soft where forms meet.
  There are no outlines and no textures. Colour comes from a muted
  pastel palette: slate blue-greys, warm cream, sage, and teal accents.
- **Light as the jewellery.** Windows at dusk are warm yellow emissive
  panes with a soft bloom. Small cool accent lights (a cyan ring, a sign)
  appear sparingly, and roof gardens give green tops to grey blocks.
  The frame at golden hour is hazy and warm, with depth carried by
  atmosphere.
- **People as stylised adults, not toys.** The proportions are near
  realistic, about seven heads tall, with long limbs and real shoulders
  and hips. Faces are a few large planes (brow, nose, cheek, jaw) with no
  drawn features beyond that. Hair is one sculpted solid mass with a
  parting and a fringe. Clothes read as garments: a fitted top, loose
  trousers, a long skirt, and the fold of a sleeve. Hands have a thumb
  and a mitten of fingers. The poses are specific and full of weight:
  stirring, leaning back under a load, eating with the elbow out.
  Skin tones vary, flat and warm.

### How it sits against the laws

This pass would **change one law on purpose**: "low-poly flat Lambert for
the built world (`flatShading: true`)". The references are low-poly but
*smooth-shaded with bevels*. The proposal keeps low polygon counts and
PALETTE-only colour, and changes the shading model for people, animals
and props (full soft matte) and for buildings (bevelled edges, flat faces
kept). That is the author's call to make, and this section asks for it
explicitly. Everything else stands: no textures, synthesised audio, every
term is a `noX` flag that parks at the governor's rungs, and there is no
save field.

### The items (sized for one 4–5 hour run of six agents, when approved)

**V1 · shared.js · the soft matte material and the bevel helper.**
- `matSoft(color, opts)`: smooth normals, a wrap diffuse (light
  continues about 0.3 past the terminator), a gentle hemisphere ground
  bounce from the chapter's grass/stone colour, and a faint cool rim.
  It is built as an onBeforeCompile patch on the existing Lambert
  program so that grain(), fog, shade, AO and shadows all still apply.
  Flag `noSoftMatte` falls back to `mat()`.
- `bevelBox(w, h, d, r, seg)` and `capsule` and `roundedCyl` geometry
  helpers, with normals averaged across the bevel and kept flat on the
  faces. That gives the reference's lit edges without faceting.
  Triangle budget: a bevelled box is 44–92 triangles against a box's 12.
  Buildings use the 1-segment chamfer, and props use 2 segments.
- Proof: an A/B at rungs 0 and 1 on six chapters, and a close PNG of a
  bevelled block beside a hard one.

**V2 · npc.js · people (supersedes U1c).** A new figure, `npcFigure2`,
written as new functions, since buildHuman, buildLocalFigure,
npcMakeGeo, npcPERSON and npcPersonRegister/Tick are pinned byte-exact by
tests:
- Proportions about seven heads tall, with a separate pelvis, chest,
  neck and shoulder mass.
- The head: a skull, a brow plane, a wedge nose, a cheek plane and a
  jaw, about 120 triangles. Six hair masses (bob, crop, bun, long,
  cap, curls) as sculpted merged shapes.
- Garments: a fitted top, a jacket, loose trousers, shorts, a long skirt
  and an apron. Each is a tapered, flared form with one fold plane at
  the knee or elbow.
- Mitten hands with a thumb. Shoes with a sole.
- `matSoft` throughout, a six-tone skin ramp, and hair and clothing
  colours from the chapter palette.
- Level of detail: the full figure within 25 m, the current rounded twin
  from 25 to 60 m, and the boxed crowd beyond. The budget is about
  1.4k triangles close up, with instanced crowds unchanged in draws.
- Poses with weight: six "doing" loops (stir, carry-lean, eat, sweep,
  phone, sit-lean) added to the existing loops. Idle breathing and a
  weight shift for every figure.
- Proof: close PNGs at 3 m, 8 m and 20 m in Sydney, Kyoto, Rio,
  Marrakech and Hanoi, read against the author's references. The
  triangle and draw counts per chapter, and the A/B cost at rungs 0 and
  1. Flag `noFigure2`.

**V3 · props.js (+ capybara.js for the hero only) · objects.** The
common props rebuilt on `bevelBox` and `roundedCyl` with `matSoft`:
bins, benches, crates, pots, barrels, cones, bags, stalls, bottles,
umbrellas and lamps. They gain chunky rims, straps and lids where the
reference has them. The capybara gets `matSoft` on its body (its rig
already breathes) and keeps its silhouette. Flag `noPropSoft`. Proof: a
prop sheet PNG (all kinds in one lit row) before and after, and the
triangle delta.

**V4 · chapter files, split across agents · buildings.** Town blocks
move to `bevelBox` (chamfered edges, a roof lip), with occasional pods
and domes where the place allows it: Kowloon, Hanoi, Monaco, Sydney's
edges and Venice's roofs. Roof gardens go on flat roofs in green
chapters. There are four agents, each owning four or five chapter
files. Flag `noBevelWorld`. Proof: arrival PNGs from above for every
chapter touched, and the A/B cost.

**V5 · the evening light.** Emissive warm window panes (PALETTE `winWarm`,
`winCool`) on every chapter that has a dusk or night grade. The bloom
threshold is lowered only for those emissives, through the existing
composite pass, and the grade itself is not re-based. One cool accent
light per district. Flag `noWinGlow`. Proof: dusk PNGs of Kowloon,
Hanoi, Monaco and Venice.

**V6 · the proof slot and the gallery.** A headful rung-0 A/B for every V
flag. Then the reference comparison: for each of the author's four
frames, a matching composition from the game, side by side in
`qa/ten-v-compare.png`, read by eye and scored honestly. Then refresh
the README gallery (U3b) with the new look.

**Order and ownership (when run):** V1 lands first, since everything else
calls it: a 45-minute solo seed. Then V2 (npc.js), V3 (props.js and
capybara.js) and V4 as three agents over chapter files, with V5 in
systems.js/main.js, all in parallel for about 2.5 hours. Then merge, V6
and the soak, about 1 hour.

**Risks, said plainly:**
- The whole look changes. The fallback is the flags: every V term can
  be cut at once, and a rung-2 laptop falls back to today's look.
- Triangles go up about 2–3x on people and props. The governor parks the
  near LOD at rung 2.
- Pinned byte-exact tests on npc.js mean V2 is new code beside the old,
  not an edit of it.
- The U1–U3 pivot (HAVOC and the rest) is still unrun and independent.
  If both are approved, run V after U1, because U1c would otherwise be
  thrown away.

## T5 — home, the first frame, the far places (SUPERSEDED by the pivot)

**T5a · A · systems.js, shared.js · the garden and the first minute.**
- The garden (`noGarden`). This is the one save field of the pass: `garden`, an array of ids added
  to sysSAVE_SHAPE (4363). It is needed because a purchase must survive a reload and nothing
  existing projects it. A GARDEN tab in the bag offers seven items, priced 40-150: hammock,
  lanterns, stepping stones, birdbath, the traveller's bench, pond, and a shelf lamp. Build calls go
  to `game.env.garden(ids)` (T5b). Costumes come first in the bag, each with a preview; stat rows
  sit on a second line in inkSoft (29713, 35806-35889).
- The bag reads as luggage (`noBagProp`): a duffel made from an 8-segment cylinder, two torus
  handles, a khaki strap and a cream tag, under 200 triangles, cloned at each chapter's traveller
  stall (38911).
- Tutorial. Session counters close beats 2 and 3 on entry if already done. Beat 3 aims the arrow at
  the bench. No pill shows while `wowLive()` (52680-52714).
- The first-ever Sydney arrival releases into yaw 0.35 with the sails in frame, held 6 s (38971).
- Begin stall: warm the bag and card composite with renderer.compile during the title idle (38964).
  The governor badge text becomes a glyph (54495).
- Proof: `qa/ten-garden.mjs` buys two items, reloads, and checks both are present on the lawn in
  free and story. A save-shape check proves `garden` defaults to []. The longest frame after the
  Begin click is under half of today's. A PNG of the first frame shows the sails.

**T5b · environment.js · the lawn becomes home.** `game.env.garden(ids)` builds the seven items from
box, cone and PALETTE parts beside sysFIN_X/Z, statically, shadow-registered, and kept clear of the
horseshoe's r 5.5. Reduce the jacaranda canopy at the [6, 22.5] spot to 0.8 (3611-3616). Trim
Sydney's near-DOF ramp to start under 2.5 m (298), once T1's proof slot confirms the smear at rung
0. Proof: a lawn PNG with all seven items, and a bottom-third masked diff.

**T5c · manly.js · the Pacific is glass.** Bins at x = −37.5 + 25i (1609-1614). Turn the
noticeboard's face to the promenade. Glass (`noManlyGlass`, rung 1 or above): faces with slope > 0.2
facing the lens lerp 35% toward manLipC in the bank zone (3566-3580). Only if saturation is under
0.3 at rung 0. Proof: 5 s of W from the spawn moves 8 m or more; water saturation 0.3 or more in the
break box.

**T5d · pasto.js · the colcha.** The near ring becomes one ridge annulus from r 140 to 175, 96x6
quads, with field-patch vertex colours and hedgerow edges; the far volcano ring stays (552-568). One
draw call, about 1.2k triangles. Proof: PNGs from the plaza and from condor height.

**T5e · weather.js · a dry first frame** (`noRainPitch`). rainWant is held at 0 for the arrival lens
and the first 20 s. Streaks shorten and pale as the camera pitches up (282, 588, 936, 1176). Proof:
the Pasto arrival PNG shows the cone, and streak coverage is under 5%.

**T5f · venice.js · the arcades have a roof.** `venCamCeil(x,z)` returns 4.2 m inside the Procuratie
and portico rectangles, passed as camCeil (1056; sahara.js:694 is the pattern). Proof: at
(−17.4,0.9,−18.4) and (−17.9,1.3,−35.2) the lens stays under the soffit and the animal is not
dithered. Move the arrival cone to the passerelle stack (4023).

T5 seed (A): `PALETTE.bagKhaki`, `gardenWood`, `lanternWarm`, `pastoField1-3`.

## T6 — play it as a stranger, then ship (SUPERSEDED by the pivot)

**T6a · A · spill.** Whatever T1-T5 left open, in pass order, bugs first. The cave items, if they
have not started: `noEchoPing` wall glints and the first-echo toast (cave.js:4100-4137), `noFern`.

**T6b · the stranger's hour.** Two fresh profiles with real keys, one per mode, for 30 minutes each:
premise to the first act turn (story), and the picker to three places (free). Every card, bubble and
pill is logged through the /shot sink. Check the numbers: first earned reward after the first input;
no card overwritten above its priority; bubbles 2 or fewer; first memory with a card; the ibis's
first theft after the first memory. Fix what it finds. That is the reason the wave is this long.

**T6c · release.** npm test 77/0 (plus the new static checks for ten-modes and save shape). A clean
`npm run soak`, run alone, including `condorAudit().stuckT` and the Monaco seat distance. All
`qa/ten-*.mjs` pass and the aaa suite does not regress. aaa-ab costs for every new flag go in the
CONTRACT entry. Merge `ten-pass` to `master`, push, confirm the Pages hosted HTML is byte-identical
to the build, then run `playwright-cli close-all`.

---

## Order and ownership

| wave | A (systems.js + shared.js) | B | C | D | E | F |
|---|---|---|---|---|---|---|
| T1 | T1a modes, picker | monaco.js | goreme.js | quay.js | condor.js | cali.js |
| T2 | T2a story beats | antarctic.js | iceland.js | rio.js | sahara.js | — |
| T3 | T3a sketchbook, paper | rival.js | npc.js | kyoto.js | hanoi.js | kowloon.js |
| T4 | T4a finale, board | props.js | environment.js | pantanal.js | palawan.js | drift.js |
| T5 | T5a garden, first minute | environment.js | manly.js | pasto.js | weather.js | venice.js |
| T6 | spill, stranger, release | cave.js (if spill) | — | — | — | — |

Dependencies run in one direction only. T2a exports `game.journeyAct` and `'story:act'` before T3b
reads them. T2e, T3e and T3f publish `wowTarget` hooks that T3a reads, falling back to marqueeAt.
T5a calls `game.env.garden`, which T5b builds, against a stub until T5b lands. Every chapter agent
starts after A's seed commit. `qa/` instruments are named per item so that no two agents write the
same file.

Checkpoints for the owner: a summary and a push to `ten-pass` at the end of T1, T2, T4 and T6. The
CONTRACT gets an entry per wave, newest first.

## Not doing

- **Moving spawns** (the Hanoi spawn, the Manly steps, the Venice nudge). Spawns are law. Lenses and
  props do the work instead.
- **Moving Rio's and Kyoto's doors.** The T3a whistle guard fixes all three places without changing
  CHAPTERS `way`.
- **Cutting yuzu income** (sysYUZU_TIER.wow 20→12). A cosy game should not get poorer. The garden is
  the sink.
- **The quay starboard-quarter lens** (systems.js:50309). The wing wheel in quay.js does the same
  job without touching the contended file.
- **The Sydney sky re-grade.** It was measured at rung 3. It is re-measured in T1's proof slot, and
  only an exemption for the dome is considered, never a skyTop change.
- **The Iceland lantern trail, the Sahara walk dressing, the Göreme dovecote bands, the Monaco
  promenade, the Kelvin wake, Cali's wires.** These are stretch only. Each is a 2-3 impact change to
  a frame the player passes through, not the one the chapter is remembered by.
- **Cave ferns and swiftlet shapes.** A palette note, not a 10-blocker. Spill only.
- **The Kyoto gravel highlight strip.** Only the width and the shade change, which is enough.
- **An herd lesson that waits for a small animal to come near.** The `altLine` bridge sentence is
  cheaper and clearer.
- **"Main-thread stall 10 s".** That number came from a machine loaded by eight reviewers. Only the
  compile warm is kept, and it is measured.
- **A save field for the ibis's takings (`rivalN`).** Nothing reads it yet.
