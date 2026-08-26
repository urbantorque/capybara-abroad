# BATCH 6 — the two shallow sweeps: what you are chasing, and what you arrived at

> **Prompt:** `run qa/BATCH6.md`

Brief: `qa/LIFT-PROMPTS.md`. Predecessor: `qa/BATCH5.md`.
Chapters: all nineteen. Files: `src/systems.js`, `src/shared.js`, `src/main.js`, and a shallow
edit in most biome files.

Read `headless-qa-harness` in project memory first.

Both jobs are broad and shallow — many small edits, low blast radius, verified by a table
rather than by judgement. They share a run because neither can break the other. Job 2 needs
batch 5's camera settled before nineteen arrival frames are worth auditing.

---

## Job 1 — P4, the record you cannot see while you are setting it

**The finding.** `RECORDS` in `shared.js:2414` carries **53 rows**, each with a `label`, a
`unit`, a `better` direction and a `dp`. `recordValue` (`systems.js:12684`) files a value,
and speaks **only after the run** and **only if it beat a previous one** — a first attempt
says nothing at all. During the attempt itself there is nothing on screen saying what to beat.

`recordValue`'s own comment is right that a record which *gated* anything would turn a game
about being a nuisance into an exam. But there is a wide gap between gating and hiding, and
the current design sits at the hiding end. A run against an invisible target is a switch you
flip once; the same run with `best 12.4 s` in the corner is a loop. Records are also the only
reason to re-enter a finished chapter, so this is the whole of the game's replay surface.

Roughly twenty of the fifty-three are a timed or measured run: `uji-run`, `glacier-run`,
`dune-surf`, `souk-escape`, `selaron-steps`, `samba-parade`, `salsa-dance`, `passerelle`,
`laundry-pole`, `manly-voyage`, `the-rip`, `all-the-way`, `take-off`, `the-crossing`,
`cart-run`, `take-a-wave`, `driftseed`, `cowbird`, `hot-spring`, `sea-turtle`, `cathedral`.

- [x] **1a** One channel, two verbs, on the pattern every other cross-module thing in this game
      uses: `game.recordLive(id)` when an attempt opens and `game.recordEnd()` when it closes
      or is abandoned. The biome already knows both moments — it is starting and stopping the
      timer it eventually hands to `game.record`.
- [x] **1b** A HUD line near the task card showing the standing best, formatted with
      `recText(id)`, which already exists (`systems.js:12701`) and already does the label, the
      value, the `dp` and the unit. **Nothing new to format.**
- [x] **1c** Thread it through every measured task. Start with the two dance floors: both
      already score off the AudioContext clock the notes are scheduled on, and *longest run on
      the beat* is precisely the number a player will chase once they can watch it move.
- [x] **1d** The live figure should show the **attempt so far against the best**, not the best
      alone — a clock counting up next to a target is the loop; a static number is a label.

### Three traps in this job

1. **It may not gate, deny or fail anything.** Keep `recordValue`'s contract exactly: file it,
   say so if it is a best, and nothing else.
2. **It must be absent when no attempt is open**, or nineteen chapters gain a permanent piece
   of HUD furniture that means nothing most of the time. Prove it: soak each chapter for
   sixty seconds of ordinary play and count frames where the line is up with no attempt live.
3. **A first attempt still says nothing at the end** — that is deliberate and should stay. The
   live readout is what a first attempt gets instead, and it is better.

---

## Job 2 — P5, the arrival is a shot and nobody framed it

**The finding.** `frameShot` (v26) was built so a chapter can compose its own marquee and it is
used well. But a marquee is a moment somewhere in the middle, and roughly no player will see
every one. **The arrival is the only shot that is guaranteed** — every player of a chapter sees
its first frame.

The intent for all nineteen is already written out in `main.js`, in prose, in detail: which way
you face, what should be in front of you, what is deliberately behind. Some of those paragraphs
describe a frame the game does not deliver. `yaw` was added for exactly this and is set on
**five of nineteen** (`kyoto`, `cali`, `rio`, `monaco`, `hanoi`).

Observed 26 Aug, entering through the game's own picker:

| | |
|---|---|
| **Hanoi** | the traffic river fills the frame, the first task is 5 m away, the chapter reads in one look. **This is the reference.** |
| **Monte Carlo** | a palm frond across the left half; neither the yacht nor the Casino legible — against a spawn comment that promises *"a hundred and thirty feet of somebody else's money, with the terrace and the Casino lit up above it"* |

- [x] **2a** Run `frameShot` on arrival, once, for the length of the arrival card that is
      already holding the screen. The card is up anyway; the shot underneath it is free.
- [x] **2b** Audit all nineteen against their own paragraph in `main.js`. That comparison *is*
      the audit and half of it is already written — the prose states what should be in frame.
- [x] **2c** Set `yaw` on the fourteen spawns that do not have one. Before `yaw` existed, the
      first frame of a chapter pointed wherever the player had been looking in the last one;
      arriving in Cali from Sydney put a rosa wall four metres in front of the lens.
- [x] **2d** Monte Carlo specifically: the yacht and the Casino legible, and no palm in the
      near field.

### Four traps in this job, all paid for already

1. **A projection test says the subject is present. It does not say the shot is good.** The
   closeout's first Opera attempt held all 714 shell vertices in frame at 21 m and left a
   third of the picture as empty sky. **Only the PNG separated those.**
2. **A shot that outlives its subject ends on nothing.** Monte Carlo's tunnel marquee was cut
   3.4 s → 1.9 s because past 1.5 s the car had outrun the frame. An arrival shot should be no
   longer than the card.
3. **Sometimes the request is a bearing alone.** Hanoi's train: *any* z term pointed the lens
   at a wall, and no distance or raise survived the alley — 11 m asked delivered 1.4, a 6.4 m
   raise delivered 2.7. That is the occlusion ray being right. Ask for a bearing and let the
   rig solve the rest.
4. **The shot must not fight `teleportCapy`'s settle.** The animal is being placed on the same
   frames the shot is easing in on; measure the first second, do not assume it.

---

## Done when

- [x] Live best visible for **at least 18 of the ~20** measured runs, verified on a save that
      already holds a record for each — not on a fresh one, where there is nothing to show
- [x] Zero frames of the live line with no attempt open, over a 60 s soak per chapter
- [x] `yaw` set on **19 of 19** spawns
- [x] Nineteen arrival PNGs, each compared against its own `main.js` paragraph, each either
      matching or fixed, and **the list of what changed recorded** — a chapter that passed
      without a change is a result, not a gap
- [~] Monte Carlo's arrival: yacht and Casino legible in the frame — **the yacht yes,
      the Casino only as a projection**. It is inside the frame at 238 m and reads as part of
      the lit town. See 2d in the log
- [x] `qa/pointers.js` still clean · `channels.mjs` 19/19 · `audit-tasks.mjs` 0 blockers
- [x] Log written below: found vs fixed, and what was declined
- [x] `CONTRACT.md` new version section · project memory · `playwright-cli close-all`

**Chain to `qa/BATCH7.md`.**

---

## Log

Run 27 Aug 2026 on `claude-opus-5`, unattended, under `playwright-cli` against
`node server.mjs` on 5188. Every number below is off the running game, real keys and a real
clock. Predecessor: `qa/BATCH5.md`. Successor: `qa/BATCH7.md`.

## Job 1 — the record you cannot see while you are setting it

### 1a · the channel

`game.recordLive(id, value)` and `game.recordEnd(id)` (`systems.js`). Two verbs, one channel,
and a third thing that is the reason it is safe: **it is meant to be called every frame the
attempt is open**, out of the same block that already increments the timer the biome hands to
`game.record`. That makes a watchdog possible, and the watchdog is what stops nineteen
chapters having to keep a promise — a chapter that forgets `recordEnd` drops the line
`sysREC_STALE` (1.6 s) later by itself. Crossing a border ends any open attempt outright, the
way shake, time and the framing envelope already do.

`recordValue`'s contract is untouched: it files, it says so if it beat something, and nothing
else. Nothing in the new path can gate, deny or fail anything — it writes two strings into a
div.

### 1b · the line

`.capyui-rec`, inside the to-do card under the tally, `display:none` and empty unless an
attempt is open. Inside the card rather than beside it so it inherits the card's fade, its
rotate and `#hud.bare`, and costs no new position to keep honest at any viewport.

Nothing new was formatted. With no figure yet the line **is** `recText(id)` — the standing
best, which is the target. With a figure it is `label value unit` over `best NN unit`.

### 1c/1d · threaded through every measured task

**31 ids, in 19 of 19 chapters.** The id list in the audit is derived from the call sites in
`src/` and never spelled, on the rule batch 5 set for `qa/route.js`.

| chapter | ids |
|---|---|
| Sydney | `whippy-run` |
| Pasto | `carroza` |
| Circular Quay | `manly-voyage` |
| Kyoto | `uji-run` |
| Cali | `salsa-dance` `cart-run` |
| Rio | `samba-parade` `selaron-steps` `take-a-wave` |
| Iceland | `hot-spring` `glacier-run` |
| Marrakech | `souk-escape` `dune-surf` |
| The Drift | `driftseed` |
| Venice | `passerelle` |
| Kowloon | `laundry-pole` |
| Palawan | `first-dive` `sea-turtle` `cathedral` |
| Cappadocia | `three-winds` |
| Manly | `take-off` `all-the-way` `the-rip` |
| The Pantanal | `the-crossing` |
| Son Doong | `great-wall` |
| Antarctica | `orca-ride` `penguin-highway` `blue-ice` |
| Monte Carlo | `the-floor` `the-hairpin` |
| Hanoi | `ride-the-flow` |

The brief named twenty-one. **Twenty of the twenty-one are wired**; the exception is
`cowbird` and it is in *Declined* below with the measurement that killed it. Eleven more were
found by reading the table rather than the list: three in Antarctica, two in Monte Carlo and
one each in Sydney, Pasto, Cappadocia, Son Doong and Hanoi — chapters 18 and 19 were not on
the brief's list at all and have four measured runs between them.

Both dance floors were done first, as asked, and both turned out to be broken in a way the
brief did not predict. See below.

### 2 · the done-flag that freezes a record — six of them, one shape

Threading the line meant reading every measured run, and six stopped counting the moment
their task was ticked:

| chapter | record | the gate | |
|---|---|---|---|
| Cali | `salsa-dance` | `if (!caliOnFloor || caliDanceDone) return` | fixed |
| Rio | `samba-parade` | `if (!rioInColumn || rioSambaDone) return` | fixed |
| Rio | `selaron-steps` | `if (!rioSelaronDone) { ...the whole flight... }` | fixed |
| Cali | `cart-run` | `if (!caliCartDone && aboard) game.record(...)` | fixed |
| Monte Carlo | `the-floor` | `if (!monFloorDone) { ...the whole crossing... }` | fixed |
| Circular Quay | `manly-voyage` | `if (quayRunT >= 0 && !quayVoyaged)` | left alone |

The rule is the same every time: **the task happens once; the counting does not stop.** A
record that cannot be beaten is not a record, and these are the only reason to re-enter a
finished chapter — so the defect is precisely the one P4 exists to fix, hiding one layer
down. `selaron-steps` and `the-floor` are the worst of them: both are `better: 'lower'`, and
both froze at whatever run first beat par.

The Quay is **not** a bug and was left exactly as it was: `onEnter` re-arms the whole voyage
on every entry to the chapter, so the passage is repeatable by leaving and coming back, which
is the replay loop the record is for.

Iceland's glacier and Venice's passerelle already had the right shape, and are what the five
were made to look like.

### verification

**The line, on a save that already holds a record for each** — `qa/b6-recs.js`. Seeded with a
best for all 31 ids, entered through **carry on** rather than a picker digit, because
`startGame`'s non-restore branch calls `saveClear()` and wipes the seed before the first
frame. (The first run of this script proved that by reporting 28 rows of "no best yet" on a
file that had a best for all 28: `jrFileCount` is `jrFile.tasks.length`, and an empty task
list makes the card offer *begin* rather than *carry on*.)

**31 of 31 rows pass**: the opening call shows the standing best alone, the figure call shows
the attempt over `best NN unit`, and `recordEnd` takes it off.

**And the biomes really call it** — `qa/b6-live.js`, no instrumentation, the animal put where
the attempt happens and then left alone:

| | |
|---|---|
| `hot-spring` | **80 of 80 samples up**, the clock climbing 1.0 to 4.9 s |
| `first-dive` | **96 of 100 up**, 0.8 to 8.9 m down — and the best line moves *during* the dive, `best 4.4 m down` to `best 8.9 m down`, which is `recordValue` filing mid-attempt and the paper reading it back |
| `cowbird` | 0, by design — see *Declined* |

That script's own first run is worth recording: it pressed `BracketLeft` for Palawan, which
is chapter 13 and is Cappadocia, and spent ten seconds holding the dive key on a Turkish
hillside before reporting a clean zero. The same slip put Cappadocia's numbers under
Palawan's name in one soak. **A picker key is an index into a list and the list is
one-based.**

### trap 2 — zero frames with no attempt open

Sixty seconds of ordinary play in each of the nineteen, sampled ten times a second, **605
samples per chapter**. Any sample with the line up is tagged with the id that was live, so a
hit is attributable and not merely a number.

**17 of 19 chapters: 0 of 605.** The two that are not are both beaches:

| | first run | after the fix | on the sand |
|---|---|---|---|
| Rio `take-a-wave` | 187 / 605 | **138 / 605** | **0 / 603**, wet for 145 of them |
| Manly `take-off` + `all-the-way` | 310 / 605 | **112 / 605** | **0 / 603** |

Both were `on` for any swim in the shore break. Both now carry a **two-metre floor**: being
carried two metres is the cheapest thing that is a ride, and bobbing about in the white water
is not. The third column is the proof that what is left is the attempt and not furniture —
the same sixty seconds spent out of the surf, on the same spawns, with the line up for none
of it, and in Rio's case with the animal wet for a quarter of it.

The soak is what found the Pantanal cowbird, and what found `placeCue`.

## Job 2 — the arrival is a shot and nobody framed it

### 2c · `yaw` on 19 of 19

Fourteen new. Every one is `atan2(-(tx - sx), -(tz - sz))` from the spawn to the thing that
chapter's own paragraph in `main.js` names, and every one is written next to the sentence it
came from.

### 2a · the shot

`teleportCapy(sp, arrive)` gained a second argument and composes the frame. `arrive` is what
separates walking into Venice from the stuck-rescue putting you back on the road four seconds
ago — a rescue that pinned the lens for two seconds would be taking the camera away from a
player who has just been stuck. Chapter 1 is the one chapter never travelled to and it is
handled at the other door, in `startGame`, and only on a fresh journey: a restored save in
Sydney must not be teleported to its spawn on load.

**0.55 in + 1.95 hold + 1.10 out = 3.60 s = `sysFADE_CARD` to the millisecond.** The card is
holding the screen for exactly that long anyway, so the shot underneath it is free and it is
over on the frame the card leaves. Trap 2 of this job, paid for by Monte Carlo's tunnel, is
satisfied by construction rather than by a guess.

### the finding the brief did not have: the arrival was using the walking-about lens

`yaw` alone fixed almost nothing. At `sysCAM_PITCH` — 41 degrees down — against a 24 degree
half-FOV the horizon sits **seventeen degrees above the top edge**, so the Opera House at
38 m, the Koutoubia at 52 m and Galeras at 104 m were all out of frame *even pointed straight
at them*. The first nineteen PNGs of this batch are exactly that: nineteen correct bearings
and nineteen pictures of the ground. Only the PNG separated those — trap 1, as written.

`sysARRIVE_PITCH` 0.28 rad (16 degrees) and `sysARRIVE_RAISE` 2.0 m. Sixteen degrees puts the
horizon eight degrees *inside* the top edge and the two-metre raise carries the middle of the
frame off the animal's back and onto whatever the spawn is pointed at. Neither touches
ordinary play: `qa/B6-NN-<chapter>-set-c.png` is the same rig, at rest, 6.5 s in, and it is
the pre-batch picture.

### 2b · nineteen arrivals, each against its own paragraph

`qa/B6-NN-<chapter>-arr-c.png` (the shot, at 2.0 s, card up) and `-set-c.png` (6.5 s, the shot
has handed the lens back). The pair is the regression.

| | verdict |
|---|---|
| **Sydney** | **changed.** Was a lawn with a jacaranda across the right third and no Opera House anywhere. Now the shells, the Bridge, the harbour, the crowd and the ice-cream van. `yaw: 0` |
| **Pasto** | **changed.** Galeras across the valley over the plaza, the fountain, the stalls, the bunting and a carnival float. `yaw: 0.3948` |
| **Circular Quay** | **changed.** Down the harbour under the colonnade: the ferry on her berth, the headlands, the apron. `yaw: -0.0950`. The Bridge is behind the timetable board — noted, not chased |
| **Kyoto** | **passed unchanged.** Down the Gion lane: machiya, noren, lanterns, a passer-by. The paragraph's torii hill is not in the frame and the lane is better than it would be |
| **Cali** | **passed unchanged**, and it was tested. The paragraph asks for the Rio Cali down its length and the Ermita; the Ermita bears 90 degrees off, and the channel — surface 1.5 m below grade, 19.5 m away — is invisible behind its own bank. The Ermita heading was photographed (`qa/B6-fix-cali-ermita.png`): poles and a palm in the near field and no church. The shipped heading gives the painted street, the cats and a juice stall, which is the other half of the same paragraph |
| **Rio** | **passed unchanged.** The wave paving out to both edges, the beach, the umbrellas, the Atlantic. Every word of the paragraph |
| **Iceland** | **changed.** East along Laugavegur with the stand 8 m up the street, the cars, the coloured houses, the church behind. `yaw: -1.5708` |
| **Marrakech** | **changed.** The square, the crowd, the stalls and the Koutoubia. `yaw: 1.4940, raise: 3.5`. The minaret is 38 m tall at 52 m; its crown is above the top edge and cannot be brought down without losing the animal off the bottom — `raise: 5.0` was photographed and does exactly that |
| **The Drift** | **changed.** The broken end of the jetty, the void past it, the floating islands, the stars. `yaw: -1.2723` |
| **Venice** | **changed.** Down the Piazzetta: the Basilica's domes closing the far end at 83 m, the columns, the arcades, the pigeons. `yaw: 0` |
| **Kowloon** | **changed.** Under the signs, down the block, the wet market, the bakery at 12 m. `yaw: -0.0876` |
| **Palawan** | **changed.** The dry sand, the whole bay, the jetty and the bangka, the karst on the horizon. `yaw: -0.1218` |
| **Cappadocia** | **changed.** The launch field with envelopes on their sides, two already up, the chimneys and the festoon lights at ten past five. `yaw: 0` |
| **Manly** | **changed.** The promenade, the pines, the surf club, the flags and the whole surf zone as a cross-section. `yaw: -0.1127` |
| **The Pantanal** | **changed.** The Transpantaneira to the horizon, the flood on both sides, four of your own kind in it and a jacare on the road. `yaw: 0` |
| **Son Doong** | **changed.** The mouth from outside it, in daylight, with the light shafts and the doline beyond. `yaw: 0` |
| **Antarctica** | **changed.** Down the hill: a red hut, the signpost, the jetty and the orange boat. `yaw: -0.1194`. The paragraph asks for three huts *and* the jetty; they are 100 degrees apart and the boat is the sentence the chapter is built on |
| **Monte Carlo** | **changed.** See 2d |
| **Hanoi** | **passed unchanged**, and it is better: the reference frame now has the Turtle Tower and the whole Old Quarter in it as well as the traffic river |

**Fifteen changed, four passed.** A chapter that passed without a change is a result.

### 2d · Monte Carlo

`MONACO_SPAWN` moved twenty metres west along the same quay, from `x: 30` to `x: 10`. The
**heading is unchanged** — pi, "facing ACROSS rather than up" — and the move is what makes
that heading point at the yacht instead of thirty metres to one side of her. The gangway task
went from 22 m to 9.

**The boom has to run down a gap in the palms, and that is what decided the spawn.**
`monBuildPalms` lays ten along `z = -84.5` from x -40 to x 42, so the gaps are at x = 10.15,
19.25 and 28.35 — and the camera swings *south* of the animal for any bearing that looks
north across the basin. Four poses were photographed at the old spawn and every one had the
lens inside the crown at x 32.9; one of them (`qa/B6-mc-B.png`) is a screenshot of the inside
of a palm tree. From x = 10 the boom runs down a gap and the nearest crowns are at the
frame's edges. `dist: 13, pitch: 0.34, raise: 4.4` stand the lens far enough back down that
gap for the whole of her to be in the shot.

**The yacht is legible and there is no palm in the near field.** The Casino is a partial pass
and the number is the honest part of it: projected through the live arrival camera it lands
at NDC (-0.68, +0.40) at **238 m**, and the terrace at (-0.76, +0.40) at 219 m — both inside
the frame, both about a hundred pixels tall, and neither distinguishable from the lit
apartment blocks around them. From the old spawn the yacht and the Casino bore **67.6 degrees
apart**; from this one it is 28.5, which is inside the horizontal half-angle of 38.4.
`camera.fov` is the *vertical* 48 degrees and the frame is 16:9 — a bearing sum measured
against 24 degrees is the wrong test, and it said "impossible" about a shot that is not.

## Found while doing this, and not on the brief

**`placeCue` is used by four modules and imported by none of them.** `manly.js` (3 call
sites), `antarctic.js` (6), `palawan.js` (1), `pantanal.js` (2). `build.mjs` concatenates
every module into one scope so the shipped `dist` resolves it and this has never been visible
there; the unbundled path `index.html` serves is a **ReferenceError inside a biome update**,
which is the failure mode `capy3-module-drop-failure` is about. Found by the soak, not by
reading: chapter 14's `take-off` mini threw on the frame it paid out. Fixed in all four.

**`qa/pointers.js` audits 17 of 19 chapters.** The same stale-list defect batch 5 fixed in
`qa/route.js`; Monte Carlo and Hanoi have never been in it. Recorded, not fixed — changing
the list changes what "still clean" means, and this batch needed the comparison.

## Regression

| suite | result |
|---|---|
| `fuzz.js` | **19 chapters, 0 errors**, 0 NaN frames, 0 camera NaN, 0 void falls, 0 solver saves |
| `channels.mjs` | **19/19**, 0 fail, 0 warn |
| `audit-tasks.mjs` | **0 blockers, 0 warnings**, 229 tasks, 19 chapters |
| `pointers.js` | 21 tasks with no pointer across its 17 chapters — every one an arrival row (`Turn up in ...`) or a verb (`wheek`, `hop and wheek`). This batch adds no task, moves no hint target and touches no `sysHINTS` row |
| the arrival pair | 19 `-arr-c` and 19 `-set-c`. The settled halves are the pre-batch pictures: the framing leaves |

## Found vs fixed

**Fixed (13).** The record invisible during the attempt, in 31 places across 19 chapters; the
five frozen records (`salsa-dance`, `samba-parade`, `selaron-steps`, `cart-run`, `the-floor`);
the arrival lens; `yaw` on fourteen spawns; Monte Carlo's arrival; the Rio and the Manly shore
break putting a counter up in ordinary play; the Pantanal cowbird doing the same; `placeCue`
unimported in four modules.

**Declined (2).**

1. **`cowbird` gets no live line**, and it is the one name on the brief's list that does not
   belong there. It is not an attempt a player opens: the bird lands on its own within a
   couple of seconds of the spawn and stays for up to seventy. Measured — a plain
   `recordLive` was up on **60 samples out of 60** standing still, and gating it on the animal
   moving (which "carried it for" does mean) only took it to **562 of 605** over sixty seconds
   of ordinary walking. Both are a permanent counter on the paper. The record still files at
   the end of the ride exactly as it did.
2. **Marrakech's minaret keeps its crown out of frame.** `raise: 5.0` brings the whole
   Koutoubia in and takes the capybara off the bottom edge; 3.5 keeps both the animal and the
   minaret's shaft. Both were photographed. The animal on the paper wins on the player's first
   frame of a chapter.

**Open, stated as open (3).**

1. **The Casino is inside Monte Carlo's arrival frame but is not legible as the Casino** —
   238 m, about a hundred pixels, indistinguishable from the town around it. Closing it means
   moving the chapter's opening off the quay, which is a chapter-content decision and not a
   framing one.
2. **`qa/pointers.js` carries a hard-coded list of seventeen.**
3. **`the-tunnel` and `cross-the-road` have no live line.** Both are instants rather than
   runs — a speed through a bore and a count of swerves — and the line shows one attempt at a
   time; in Monte Carlo the hairpin's metres are what is accumulating through the bore, and in
   Hanoi it is the ride's.

**Chain to `qa/BATCH7.md`.**
