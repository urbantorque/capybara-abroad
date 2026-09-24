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

**T1f · cali.js · the chiva holds on.** With no move key held and the animal inside the roof box
plus 0.4 m, snap its horizontal velocity to the chiva's frame velocity each substep (2601, 2615).
The missed-her beat: "she does not stop for anybody. she goes round again." plus the next-in time on
the paper (4775, 4812). Flag `noChivaHold`. Proof: roofPlace(0), no input, still on the roof at
s=177, at rung 0 and at rung 3. Stretch (`noWireFade`): wires at half radius in dark metal, faded
within 5 m of the lens (2079).

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

**T2b · antarctic.js · the pod runs in open water.** Patrol `px = antLeadX(pz) + 10*sin(2a)`
(4379-4386). The run gate is `sp > 4.0*(1 − 0.6*antBoatIce)` (4518-4531). One-shot toast: "they want
open water. find the lead." Flag `noPodLead`. Proof: the closed-loop helm run
`qa/ten-review/b3m-antarctic.js` ticks orca-ride in 3 runs out of 3, under 150 s. Then the orcas
(`noOrcaRound`): three smooth sph lobes, a swept cone dorsal, the eye patch raised to +0.34s, a
belly crescent, and 6 blow sparks at each surfacing (2351-2440). Proof: a PNG from the chase lens
where the white patch reads. Stretch (`noKelvin`): a V wake replaces the ring stack (1464).

**T2c · iceland.js · the aurora is the sky.** The ramp (`noAuroraRamp`): PlaneGeometry(len,h,40,4)
with vertex colours from 1.0 at the hem down to 0 at the top, MeshBasicMaterial with additive
blending and no depth write, ends tapered, crown tinted iceAuroraMag, parked at 2 rows at rung 2 or
above (2835-3036). The frame (`noAuroraFrame`): the ticking call fires frameShot yaw toward the
nearest curtain, pitch −14°, dist 9, hold 5 (4545-4570). The steam (`noSteamSoft`): shrink over the
last 0.8 s, cull puffs within 4 m of the lens, burst ring at r 6-9 m on the far side,
SphereGeometry(0.5,7,5) (2670-2733, 4574). Proof: in a pinned-camera PNG the curtain's top edge has
no hard line (row luminance falls monotonically), and steam covers under 10% of the frame in the
tick frame. Stretch: the lantern trail up the gap in the rows (1378).

**T2d · rio.js · the rock is solid.** Seeded `rioRnd` boulders, and a rioStaticBox for every sphere
with s > 1.4, pooled into one body (1660-1680). Proof: `qa/audit-solid2.js` at each stone gives 0
walk-through. Add an `inZone('posto6')` box for A's T3 door guard. Bounce (`noRioBounce`):
sand-bounce vertex colour on seaward faces, weighted by normal and height, and 1 in 6 windows lit
(2320). Proof: hide-and-diff on the frontage band, mean luminance +15% or more.

**T2e · sahara.js · a place to aim at.** `game.sahara.wowTarget()` returns the next ring or the
minaret, for A's T3 paper. Ring beams (`noSahRingBeam`, rung 1 or above) visible from 150 m (5768,
169). Zenith band (`noSahZenith`): the top 35% of the dome lerps to `PALETTE.sahZenith` by elevation
and fades with the storm scalar (6260), with the grade left alone. Proof: the aaa-ab A/B on the sky
region, and a sky/sand luminance-contrast number before and after. Stretch (`noSahStallSmoke`):
square joints at −70% contrast, three worn paths, and stall smoke (1173, 1338).

T2 seed (A): `PALETTE.sahZenith`, `antOrcaBelly`, `iceAuroraHem`, `rioBounce`.

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

**T3b · rival.js · the ibis has an arc** (`noRivalArc`). Read `game.journeyAct()` and the
`'story:act'` bus. Act I: it watches from a high point near the arrival and leaves when the animal
comes within 10 m. Act II: steals, as now. Act III: once per chapter it snatches the fresh keepsake
through `dropSteal`; it never costs the memory, and the keepsake always falls back within 30 m. Act
IV (iceland, antarctic, cave): it stands hunched and does not steal, and a `dropGive` within 2 m
gets a line. Finale: on `'finale:staged'` it lands in the horseshoe mouth, facing the animal. Free:
Act II behaviour always. Next appearance within 60 s of an act turn (38, 141, 158). No save field.
Proof: `qa/aaa-rival.mjs` stays at 7/7, and a new `qa/ten-rival.mjs` forces each act and asserts the
behaviour state, with a PNG of the Act III chase.

**T3c · npc.js · crowds make room.** Bubble cap (`noBubbleCap`): 2 live, nearest and
addressed-to-the-animal first; 1 within 20 m of the marquee or while a subtitle is live; speakers
beyond 25 m go to the heard pill; drop anchors in the top 18% of the screen (2020, 3261). Photo
flash (`noFlashStar`): a 0.18 m star facing the camera, scaled by distance, PALETTE.foam, 90 ms
(9266-9292). Gate the "man overboard." toast on `started` (11380). The traveller's cameo: 20-30 m
away at each memory beat, turned to look (travWhere). The answer to `'finale:staged'` (5841):
gatherers stay outside r 5.5 and out of a 50-degree cone behind the lens yaw, and the traveller
walks to the horseshoe mouth to hand over the bag, which T4a places. Proof: the most bubbles on
screen in 60 s on the Sydney lawn, the Sahara crest and the Uji bridge is 2 or fewer; a flash PNG.

**T3d · kyoto.js · Kyoto sits in its hills.** `kyoBuildFar` modelled on palBuildFar
(palawan.js:996): 6-8 rounded ridges at 300-420 m, the Uji downstream end left open, and one pagoda
silhouette. Called from createKyoto (4781). Flag `noKyoFar`. Torii wood (`noToriiWood`): trunk
exclusion at CAM_R + 1.2 and a dark understory ring 3-6 m from the path (2490, 607). Gravel: ridges
a third as wide, in `kyoGravelShade`, with a highlight strip (747). Proof: pinned camera at gates 5,
20 and 35 gives a lawn-green share between the posts under 10%, and a PNG down the Gion lane shows
the ridge line.

**T3e · hanoi.js · the lake is a place to sit** (`noHanWillow`). 28-36 instanced willows round
hanLAKE, wind-sway hooked; 6-10 lotus clusters and one paddle boat on a mover loop. Hanoi's world
pass is already 13 ms, so the willows are instanced, with no grain() material. Spawn stays; the
arrival lens is yawed toward the Old Quarter corner by a frameShot (4639, 4798). Publish the next
drop lantern for `wowTarget`. Proof: aaa-ab cost 0.1 ms or less, and an arrival PNG.

**T3f · kowloon.js · the arcade lens.** When the animal is inside the scaffold footprint below 3 m,
publish a camera hint that pulls the lens +x over the carriageway and 1.5 m up (73, 859, 1535;
kyoto.js:4337 is the pattern). Flag `noHkArcadeCam`. The magenta panel gets glyph blocks (2172).
Publish the next heli ring for `wowTarget`. Proof: 20 s along the shopfront keeps the animal under
15% of the frame and there is no dither in the middle third.

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

**T4b · props.js · keepsakes you can see** (`noFinPlinth`). Staged keepsake mesh at 2.2x (the mesh
only, not the body), on one instanced PALETTE.stone plinth per keepsake (2694). Proof: the finale
PNG, and a draw-call count of +1.

**T4c · environment.js · the concert is a performance** (`noConcertBeat`). Reach scales with how
close each wheek lands to the score's beat: within ±120 ms gives full reach, otherwise 40%. A
pulsing ring decal on the carpet from stageGlow (4110, 4130). Three of the seven shells fire on the
tick; the full show stays for the encore. stageGlow is 1.0 per note with decay 0.6/s. The carpet
bins and cones scatter on the first note. envENCORE_WIN is 12 s (86-126, 3834-3890). The colonnade
awning and the north openings of the sails get camSolid colliders (1037-1060, 2930). Proof: on-beat
Q×3 gives a house of 10 or more and off-beat Q×3 gives 6 to 9 (the tick still fires). A pinned PNG
of sails before and after, luminance +10% or more. Lens walks under the colonnade with no dithered
frame over 40%.

**T4d · pantanal.js · the herd falls in behind.** The cascade (`noHerdCascade`): after the third
recruit, each wheek takes up to 3, including grazers within 5 m of a follower, with answers 0.12 s
apart; 5 or more followers make grazers within 16 m trail (4040-4061). The crossing opens in 4
wheeks or fewer. Warm (`noPanWarm`): renderer.compile under the white card with the dormant groups
visible (5921). Arrival p95 is under 1.5x steady. Sky Fresnel (`noPanSkyFresnel`, only while
perfRung ≥ 1): a sky-gradient mix plus a tree band as a function of view angle (602, 3584). Proof: a
hide-and-diff on the water at rung 1.

**T4e · palawan.js · clear water.** The underwater far distance x2, with a lighter cyan tint in
`palDeepClear` (`noPalClear`, 5290). Chroma above 20 at 10 m, and the manta readable from 15 m. The
karst hatching: A/B with AO, shadow-lerp and form-shade toggled, then fix only the term that draws
it (normalBias or excluding the fade) (688). Proof: a masked diff on the cliff. Publish "hold E to
go down" through the manta row's clue hook when dh < −3 (2359, 5279).

**T4f · drift.js · the cloud is soft** (`noCloudSoft`). Smooth normals on the lobe merger, 10x6
segments, lit tops at 0.12 driCloudLit, 12 low wisps; at rung 1 or above keep the normals and drop
the wisps (1154-1257). Proof: a landing PNG with no facet edges visible at 1280.

T4 seed (A): `PALETTE.palDeepClear`, `finPlinth` (if stone reads cold).

## T5 — home, the first frame, the far places (hours 8–10)

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

## T6 — play it as a stranger, then ship (hours 10–14)

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
