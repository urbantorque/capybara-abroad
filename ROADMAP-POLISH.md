# The polish pass — what is left once the release roadmap is closed

Written 2 Sep 2026, after R1–R10 (`ROADMAP-RELEASE.md`) closed every item on
the release list except the two owner decisions (LICENSE, host). This review
was seven independent read-only passes over the tree — first hour, gameplay
depth, feel and latent bugs, picture, audio, the frame, and the writing — plus
three live measurements in Sydney and Antarctica. Everything below cites a
symbol or a file; line numbers in `systems.js` move by the thousand between
batches, so grep for the name, not the number.

The headline: **the game is sound. What is left is legibility** — of the
animal in the frame, of the game to a gamepad, of the meta-loop the player is
meant to chase, of the score's punctuation, and of the journey as a story.
Nothing here is a crash or a wall. Everything here is the difference between
"finished" and "somebody would recommend it".

Seven areas, ordered by what a player feels first. Four batches take the top
slice of each; the shelf is what is left, already sized. Every batch is 2–3 h,
one commit, verified with the headless harness (`headless-qa-harness` in
memory) and judged from rendered PNGs, never frame-mean metrics.

---

## The seven areas

### 1. The subject — the capybara is the least legible thing in its own frame

- **A canopy between the lens and the animal is not faded, not cut, and the
  rig cannot see it.** Measured live in Sydney at rest, (0, 51.5): two fig
  canopies (`environment` `SphereGeometry`, no collider) sat at 7.7 m and
  11.4 m on the camera→capybara ray, `camInfo.clear` read 0.80, and the animal
  was not in the frame for twenty seconds. The occlusion ray is physics-only
  (`sysCamRayHit`), so drawn-not-solid foliage is invisible to it — the same
  split `solid-or-drawn` catalogued for walls. `first-three-chapters` in memory
  already records "the camera inside every fig".
- **The occlusion ray hits people and passing vehicles.** `sysCamRayHit` skips
  only `mass > 0`, triggers, heightfields and planes; walkers are mass-0
  kinematic (`npc.js` `buildHuman`), standing locals are static mass-0 boxes,
  and every kinematic vehicle you are not riding (Hanoi train, Monaco cars, Rio
  trams, Venice boats) is a wall. The cut is immediate and releases at
  `sysCAM_CLEAR_OUT` 3.2/s, so a queue crossing the boom pumps it. Verified in
  code; the live crowd measurement is P1's first job.
- **At the resting boom (`sysREST_W`, 11.4 m) the animal is ~60 px tall and the
  same hue family as four grounds** — Sahara ochre, Göreme stone, Monaco quay,
  Cali's lawn edge (`qa/D45-08`, `B7-goreme-40deg`, `D45-18`, `D45-05`). The rim
  (`_rimInject`, shared.js) is same-hue and cannot separate it.
- **The resting frame carries a milky veil** in Venice, Marrakech and Kyoto
  (`D45-10`, `D45-08`, `v51-board`): airlight plus exposure compress the
  mid-tones at rest distance. Not measured yet; P1 measures it and trims only
  if the number says so — the `exposure` memory records the arithmetic picking
  the wrong lever last time.
- **Arrival and rest yaw miss the landmark** in Monaco (cliff and deck plate),
  Kyoto (machiya corridor, torii off-frame), Palawan (karsts a grey band at the
  top edge), Manly (subject is a bin). The rest voice fixed pitch, not yaw.
- `camClearF` survives travel: leave a chapter from inside the souk at 0.2 and
  the next opens with the eye against the animal. One line in `teleportCapy`.

**AAA principle:** the player character is always readable; foliage and crowds
yield to the subject; the camera is a cinematographer, not a collider.

### 2. The pad and the card — a gamepad can open every card and operate none

- **A pad-only player is hard-stuck on the departures board.** `padPoll` reads
  face buttons, triggers, shoulders, sticks, Start (→ `pauseToggle`) and Back;
  it never reads `jrShown`. Three wheeks at the wharf opens the board, pauses
  the world, and no button does anything except stack a pause card on top —
  and `pauseHide` leaves `state.paused` true because `jrShown`. R5 fixed the
  touch version of exactly this; the pad version remains.
- **The pause card, settings, journal, ledger and album cannot be driven by a
  pad.** Real buttons, `pauseGo.focus()`, browser focus navigation — and no
  pad code moves focus or activates anything. Faders, calm, quit-to-title are
  mouse-only for a couch player.
- **Prompts name keyboard keys to a pad player.** `sysSay`/`sysScheme` have two
  vocabularies (keyboard, touch); with `padOn` the first four Sydney clues read
  `press Q`, `with E`, `hold Shift`, `hold E`. The connect toast lists three of
  nine bindings; LT slide, Y, Start, Back, LB/RB, R3 are unnamed; R (stuck), F,
  V, K have no pad binding at all.
- **Slide is Ctrl, and Ctrl+W closes the tab.** `input.slide` reads
  `ControlLeft/Right`; the keydown handler `preventDefault`s Space and arrows
  only, and Chrome will not let Ctrl+W be cancelled at all. First glacier,
  hold Ctrl, push W. Ctrl+S and Ctrl+D pop dialogs. The legend lists WASD
  first and Ctrl fourth.
- **Focus leaks out of the modals.** Tab is `preventDefault`ed outright while
  the ledger/album are up, so a keyboard user reaches nothing on them; in the
  pause card Tab is native with no wrap, and the HUD's own buttons stay
  focusable behind it — `aria-modal` is declared and the DOM does not honour it.
- **The in-card calm switch does not reach the hitstop or slow-motion.**
  `main.js` reads `prefers-reduced-motion` once at boot into a private `calm`;
  `hitstop()` gates on that, not on `calmOn()`. Rumble (`padRumble`) ignores
  calm and mute. No `matchMedia('change')` listener anywhere.
- The chapter-done ceremony tells phones and pads `K, then Enter`
  (unconditional toast); the touch fan has no camera.
- Minimum HUD text is **8.5 px** (`.capyui-clue` clamp floor); tasks bottom at
  9.5; the phone block hard-codes 8–10 px labels. ~40 separate `clamp()` rules,
  no root token.

**AAA principle:** every input surface reaches every control, and prompts
follow the device in the hand. A binding that can close the browser is not a
binding.

### 3. Faces and bodies — the comedy has nowhere to land

- **NPCs have no faces.** `buildHuman` is instanced boxes — bob, head, hat,
  arms, legs; locals get a hair slab and a 5 cm nose. Every reaction is a
  body-lean, a hop or a bubble. In Venice and the souk sixty identical pawns
  (`D45-10`, `D45-08`). Goose Game's whole joke is in the face. `headYaw` /
  `headPitch` fields already exist per person.
- **One body build for everyone.** `npcLEG_L`, `npcHIP_Y` are constants;
  variance is palette only. No children anywhere, including Sydney and Rio.
- **The capybara's secondary motion is good bones with gaps.** Present: blink,
  ear flick, squash node, gaze at grabbables, five idle beats, loaf, shake-dry,
  footstep dust. Missing: whiskers (none in the file), gaze at *people* (gaze
  targets `nearestGrabbable` only), ear-turn toward sound, sniff pulse.
- Speech bubbles are a third UI dialect (pure white pill, hard shadow) in a
  paper-and-ink game.

**AAA principle:** reaction is read at a glance from a face, before the bubble
arrives; a crowd has three silhouettes, not one.

### 4. The punctuation — one bell carries seven meanings

- **`chime` is the payoff for a mini task, the incident, a record, an act
  break, chapter done, the finale — and an ambient bell in five ladders.** A
  personal best is audibly indistinguishable from a plaza bell. No stinger
  exists anywhere; the lift (`musSwell`, `musLiftNote`) is the only in-key
  gesture and it fires once per chapter by construction.
- **Four payoffs are silent:** the souvenir card (`showKeep`), the costume
  grant (`capy.wear`), a chase starting or ending (only `musChaseT`), a ghost
  beaten (collapses into the record chime).
- **The pause card leaves the band at full tilt.** `pauseShow` gates sfx and
  floors the weather bed; `musTick` is gated only on `ac.state`. A salsa band
  under a pause card reads as a music menu.
- **No underwater state and no interior within a chapter.** Nothing keyed to
  submersion touches a gain or a filter; Palawan's marquee ("be under when the
  water lights up") gets the open-air mix. Rooms are per-chapter
  (`sysRoomSet` reads `sysROOMS[live]`), so the basilica, the salon and the
  deep cave share one impulse response with their exteriors.
- **Flight and slide have no air.** The wind bed is written from weather only;
  the condor ride, the balloon, the dune surf and the Uji run play one
  `rustle` at slide start and nothing while airborne.
- The capybara has two vocal synths (`wheek`, `gasp`); nothing for the loaf or
  the herd bond, which the score already reacts to.
- Thinnest ambience rows now: the Drift (2 ladder lines), Iceland (3, no
  bespoke voice), the cave (4, none), Manly (4). Antarctica, Palawan and the
  Pantanal have no voice of their own.
- Housekeeping: 31 `force: true` against a comment that says eleven; six call
  sites at volume 1.0 louder than the chapter-done ceremony; no global
  polyphony cap (per-name gaps only, `thud`/`clink` at 0.05 s).

**AAA principle:** every kind of payoff has its own sound, in key; a state
change (under, inside, aloft, paused) is audible before it is visible.

### 5. The chase — the meta-loop exists and is invisible

- **Records are invisible until a chapter is 100 % done.** The picker prints a
  record line only inside `done >= ids.length`, and the DONE HERE board inside
  the same guard. Mid-chapter, the only surface is the live line during an
  attempt; a player cannot tell which of the 60 rows are measured or what par
  is.
- **The incident is the only repeatable reward and is never counted, saved or
  shown.** `sysINC_*` produces a card and a chime; no `incCount`, nothing in
  `jrFile`, the ledger tallies done/places/kept/noticed only.
- **Nine "be there when" tasks ride clocks of 54–205 s and the paper never
  says when.** `iceWHALE_CYCLE` 54, `palCYCLE` 124, `hkCYCLE` 152, `gorCYCLE`
  156, `venTIDE_PERIOD` 205, Hanoi 96. Göreme's sunrise window is ~11 s per
  156 s with a 32 s climb, and its own comment calls it cruel. Waiting on an
  unstated clock is the game's main chore.
- **`fold-the-street` (Hanoi) is a single-edge gate** — `was < 0.5 &&
  hanFoldK >= 0.5 && inAlley`, a crossing that lasts under a second once per
  96 s. Exactly the shape the symphony fix removed in Kowloon ("the marquee is
  the show, not the first frame of it").
- **Endgame has one completion state: tasks.** `sysFinaleAll` checks
  `chapComplete` only; 47 pars, 60 finds, 60 records and the scene count have
  no recognised "all of it" anywhere.
- Ghosts: `sysGHOST_KEEP` 8 against 60 records, oldest evicted silently; a
  completionist's Kyoto ghost is gone by Iceland. Nothing marks which rows
  have one.
- `placeHeat` — the accumulator the docs call "a square that has had enough
  of you" — reaches four finds and some dialogue and no card, record or line.
- `jrChapMs[n]` is a saved per-chapter clock shown only in the ledger; DONE
  HERE could be a score card and is a list.

**AAA principle:** the board is the endgame; a measured thing says so before it
is beaten, and the loop the player is meant to chase has a number on it.

### 6. The through-line — the journey has no sentence in it

- **Nothing says why she is moving or that the places connect.** The premise
  is one title-card line; the journal is arithmetic; the ending is three
  toasts. The one narrative fact — Pantanal `sub: 'where you are, as it
  happens, from'` — is picked up by nobody: not a local, not the souvenir, not
  the ending. And every exit says `wheek three times to go home`, which is
  Sydney, which the text says she is not from.
- **Ten of nineteen door toasts promise Sydney** ("somebody down there is
  going to Sydney", "that ocean goes all the way to Sydney") and the third
  wheek now opens a board to anywhere. The best writing in the exit flow, and
  it lies.
- **Wariness has one voice in seventeen chapters.** Only Sydney and Pasto own
  `says.wary`/`incident` pools; every other local falls through to the same
  seven neutral lines, so the Hanoi barber, the Monaco doorman and the
  Antarctic barman say "I have got my eye on you" in the same words. The
  record shape already accepts `says.wary`; no chapter passes it.
- **The condor flap is still untaught.** `wantFlap = input.honkPressed ||
  airspeed < STALL*0.6`; the only in-flight text is "hold on". R6 deferred
  this to R8 and R8 did not touch it. Also: Pasto's act 1 hides the condor
  behind six market chores after the picker sold "a condor"; `condor-ride`'s
  `wow` and `acts[2].kick` are both `GALERAS`, three seconds apart.
- **Ten chapters are flat lists and five of them are consecutive (11–15).**
  Acts gate nothing (`shared.js`), so this is authoring only.
- Eleven arrival tasks are "Turn up in X"; the ones that were written are the
  best titles on the list. Eight chapters' `open` line is the literal text of
  `acts[0].line`, said twice on arrival. Fourteen completion lines in Palawan
  repeat the local's own `after:` pool within seconds. Two typos, two missing
  diacritics (`Hallgrimskirkja`, `Mot hai ba`).
- Three named people in the whole game (a dog, a mentioned aunt, a cellist);
  nobody recurs between chapters.

**AAA principle:** the spine is environmental — a line per place, a voice per
place, one face that comes back — never a cutscene.

### 7. Under the hood — nothing a player sees this week, all of it a batch away

- Adaptive DPR is a one-way blur on any display that cannot reach 50 fps (a
  30 Hz-throttled laptop, a 48 Hz monitor): `fps < 50` cuts by 0.15 to 0.7,
  recovery needs `> 58`, and `fps` is derived from the already-scaled `dt`, so
  a slow-motion beat reads as a frame-rate change.
- Every visited chapter stays resident (`main.js` hides, never disposes) —
  ~4,500 objects with all 19 seen. Bounded, not a leak; the reason an old phone
  dies in chapter 12.
- 41 % of the shipped bundle is comments (`systems.js` 10,446 of 25,466
  lines); `build.mjs` strips imports only. Dist 9.3 MB raw / 2.8 gzip; a
  tokeniser-aware strip cuts a third of the parse at boot.
- `server.mjs` sends `no-store` and no compression; the README presents
  `npm start` as a way to play.
- Carrier frames are linear-only (no ω×r, no yaw inheritance); a passenger
  10 m off-axis on a deck turning at 0.1 rad/s drifts at ~1 m/s. Hanoi hides it
  with a walled tray. Suspected; measure on the big ship's turn.
- Kinematic bodies are never sanity-capped (`mainSaneWorld` skips `mass <= 0`);
  every carrier derives velocity as Δ/dt and only `quay.js` clamps. Under
  hitstop `dt` can be 0.0006 s.
- `qa/` holds 1,452 probes and one runner; `package.json` has no `test`. The
  five static audits are the real regression suite and nobody can tell.
- Docs: README's module table lists 13 of 27 files; "seventeen" in
  `CONTRACT.md` ×3 and 42 src comments; `package.json` 0.52.0 predates R1–R10.
  Pasto has three `setTimeout`s that fire through pause.

---

## The batches

Ordered by what a player feels first. Each 2–3 h, one commit. R4, R8 and R9
each ran long against the same estimate, so every batch below names the slice
that must land and the slice that spills to the shelf if it does not.

**Batch P1 — the subject. Done, 2 Sep 2026.** Four things landed, one was
measured and removed, and one bug was found by the instrument rather than by
the plan. The batch's premise — "a canopy between the lens and the animal" —
was the right symptom and the wrong cause.

**The instrument first, because everything below is one number.** Render the
frame, hide the capybara, render again, and count the pixels that changed:
that is exactly how much of the animal you can see, with no classification of
leaves or fur, and the mean luma of those pixels against what replaced them is
the silhouette contrast. Both fall out of one pair of renders in one JS turn
(`qa/p1-see.js`). It found more than the roadmap asked it to.

**1. The framing collapses as the boom is cut — the real fix.** The occlusion
ray shortens the boom and moves nothing else, so the eye comes in while the
look target stays 0.6–1.6 m above the animal's feet, and the closer the eye
gets the larger that offset is in degrees. Measured across 21 stations, as how
far below centre the animal sits:

| boom cut to | where the animal is | |
|---|---|---|
| 1.00 (16 chapters) | −0.21 | the frame the rig was designed for |
| 0.54 Manly | −0.39 | |
| 0.26 Antarctica | −0.78 | on the edge of the picture |
| 0.16 under a pine | **−1.40** | off the bottom of the screen, **0 px of capybara** |

So the tightest places in the game — the souk, the stairwell, the cave passage,
the colonnade — are exactly where the animal slides out of shot, and the harder
the rig works the worse it gets. `sysLOOK_RAISE` is now multiplied by
`camClearF`: the ratio of raise to distance is what sets the angle, so holding
it constant holds the composition, and at `clear = 1` the line is arithmetically
what it was. **Under the pine: 0 px → 57,412 px, and the animal moves from
−1.40 to +0.07.** Antarctica −0.77 → −0.21, Manly −0.35 → −0.16, and the
sixteen chapters that measured 1.000 are unchanged to two decimal places.

**2. The canopy dissolve was built, measured and removed.** A cone from the
lens to the animal, dithered discard in `leaf()` so it reached every plant in
the game through the material they already share — it worked, and it bought
nothing. Paired A/B in one session (`game.state.noCut`, on and off in the same
frame): 24 yaws at each of four stations and 30 legs of a walk through the
Sydney grove. **84,479 px of capybara with it off, 84,627 with it on** — a
fifth of one per cent, with as many yaws worse as better, and the animal never
once badly hidden. The frame that started this was real; it was §1, not the
leaves. The `material.userData.capyLeaf` marker stays, because
`hud.canopyAudit()` walks for it and that is how this was measured.

**3. The animal has its own rim, and the direction was backwards.** `matSelf`
binds the capybara's six body materials to their own rim uniforms — same
source, same program, different numbers — so the animal stops sharing the
scenery's. The first table lifted hardest where the silhouette measured
faintest (Cali is **4.5 levels of grey**, eight chapters are under 20) and was
wrong in ten of nineteen, because **a rim is light**: it separates the animal
from a background she is brighter than and closes the gap on one she is darker
than. Paired, `game.state.noSelfRim`, and the sign of the change is the sign of
the contrast every single time:

| animal brighter — gained | animal darker — lost |
|---|---|
| antarctic +9.2 · drift +8.9 · pantanal +8.3 | venice −4.2 · sydney −4.1 · hanoi −3.2 |
| iceland +8.1 · cave +6.6 · kowloon +4.6 | sahara −2.9 · pasto −2.8 · quay −2.5 |
| cali +1.3 · monaco +0.8 | palawan −2.3 · goreme −2.0 · rio −1.3 |

The table is now that measurement: eight chapters keep a lift that held across
**two** paired runs, and the other eleven are handed the scenery's own number,
which is what they had before. Kyoto is among them because it returned +0.5 and
then −2.7 at the same strength — a number that changes sign between two runs is
a number nobody measured. What the darker-animal chapters want is a *darker*
edge, and that is a contact-occlusion term, not this one with a minus sign.

**4. Two camera corrections, both quiet.** `sysCamRayHit` now skips
`userData.npc`, `userData.local` and every kinematic body that is not the deck
underfoot — the block above it has claimed "static geometry only" since it was
written and it was never true, and it is the ignore list `capyClimbRayHit`
already keeps. **Measured and it bought nothing**: four crowd stations, 25 s
standing still, 10–32 people, `clear` 1.000 before and after with zero dips.
Kept as a contract alignment, not sold as a fix. And `camClearF` is reset in
`teleportCapy` — it only ever eases outward, so a chapter left from somewhere
tight handed its cut to the next one's arrival.

**5. The find: an uncaught RangeError in the score, on the unmodified tree.**
`Failed to execute 'setValueAtTime' … Time must be a finite non-negative
number: -0.000127775`, seen in Cali and Marrakech at two different voices.
−0.128 ms is the size of `musFeel`'s own humanising jitter: `musStart` calls
`musTick()` synchronously on the line that builds the graph, `ac.currentTime`
is still exactly 0 there, the band re-anchor guard is `musBarAt < now` so
`0 < 0` leaves the anchor at zero, and half the notes of the first bar land
before the origin. Whether it throws is a coin toss per note, which is why
nineteen chapters of R10 soak reported a clean console: that run read
`state.lastError` and console messages, and an uncaught RangeError out of a
`setInterval` callback is neither. `musFeel` now clamps to `ac.currentTime` —
one place, six band schedulers, every voice in the file.

**6. The veil was measured and left alone.** The batch said to trim the grade
only if the milky three came out as a class. They do not, and one of the three
is the opposite of what the review claimed. Full-frame luma over a centre crop,
19 chapters, ranked by how far the blacks are lifted (`p05`, which is the veil's
signature):

| lifted | | deep |
|---|---|---|
| venice 133 · sydney 118 · palawan 117 · sahara 117 | quay 102 · pasto 103 · cali 100 | monaco 59 · kowloon 58 · **kyoto 57** · drift 54 · iceland 48 |

Venice and Marrakech do sit high, and Venice's 133 is the highest black level
in the game. **Kyoto is third from the bottom** — it has among the deepest
blacks of the nineteen, and the review called it milky from a screenshot. There
is no gap anywhere in the range to cut a class along: it runs 48 to 133
continuously, the top of it is what a sunlit white-stone square legitimately
looks like, and the two chapters with the narrowest range at all (the Drift and
the cave, both 44) are night chapters that are meant to be narrow. Re-grading on
this would be undoing v47's measured exposure work on a hunch. Recorded, not
acted on.

**Probes:** `qa/p1-see.js` (21 stations, before and after, by stash), `p1-ab.js`
and `p1-yaw.js` and `p1-walk.js` (the paired canopy tests), `p1-rim.js` (the
paired rim test, run twice), `p1-crowd.js` (the crowd differential, by stash),
`p1-veil.js`. New audit: `hud.canopyAudit()` — foliage in the chapter, what is
on the eye-to-animal ray, both rim strengths, and how many of the animal's
meshes actually bound to its own rim.

**Two instrument lessons, both of which produced a confident wrong answer.**
A zero-width ray is the wrong detector for a volume: `canopyAudit` reported
"nothing in the way" in 17 Göreme frames where the dissolve was plainly
changing the picture, because the cone is 1.7 m across and a ray is a line.
And **two runs of this game are not comparable** — people, props and carriers
are not in the same places, and cross-run contrast differences of ±20 levels
are ordinary. Every verdict above that matters is a paired A/B inside one
session, toggling the term between two reads of the same pixels.

*Original scope:*
*Must land:* (a) `sysCamRayHit` skips `userData.npc`, `userData.local` and any
kinematic body that is not `rideBody` (it already has an ignore list for the
climb ray — same shape); `camClearF` reset in `teleportCapy`. (b) A canopy
registry: chapters and `environment.js` register foliage meshes (they are the
`SphereGeometry` canopies already built in one place), and one per-frame
three.js ray from the eye to the animal against that list — never
`scene.children` — fades whatever it crosses to ~0.25 over 150 ms and back.
Budget: ≤ 64 nearest canopies, one ray, no allocation. (c) The capybara's rim
becomes a cool, value-separated rim keyed off the chapter's `sysGRADES` tint,
and a 1.10 hero scale — measured, not eyeballed: silhouette contrast against
the dominant ground luma in all 19 rest PNGs, before and after.
*Measure first, change only if the number says so:* the veil — RMS contrast of
the mid-band at rest in Venice, Marrakech, Kyoto against Sydney and Rio; if the
milky three are a class apart, trim `sysAIRLIGHT` (or the rest-distance
exposure term) for those rows only.
*Spill:* the arrival yaw anchor (a per-chapter `look` in `CHAPTERS` that the
arrival shot and the idle yaw tidy-up bias toward).
*Verify:* idle occlusion soak — fraction of frames with `camInfo.clear < 0.95`
standing in the Sydney lawn, Circular Quay and the souk, before/after; a
scripted walk under the Sydney figs with the animal's NDC and a canopy-hit
count logged; the 19 rest shots re-taken through the picker. **Trap:**
`biome.switchTo` bypasses the arrival and leaves the hidden chapters in the
raycaster's path — `Raycaster` does not honour `visible`. Enter through the
picker for every picture, and filter the ray by the registry, never the scene.

**Batch P2 — the pad and the card. Done, 2 Sep 2026.** Measured with a
synthetic pad installed over `navigator.getGamepads`, because a controller is
the one input surface a headless run cannot otherwise reach.

**The baseline, and it is worse than the review said.** Three wheeks at the
wharf raise the departures board and the world pauses behind it — and then all
**seventeen buttons and both sticks in eight directions** leave it exactly
where it is. Start does not close it; it stacks the pause card on top. On that
card focus never left `resume`: d-pad did nothing, A pressed nothing, the three
faders read 100/100/100 throughout, B closed nothing. R5's touch trap with a
pad in place of a thumb, and worse, because the only exits were to travel
somewhere nobody asked to go or to reload a three-hour game.

**What landed.** `sysPadCard` drives the DOM rather than reimplementing four
menus — d-pad walks focus, A clicks, B is Escape, left/right step a fader,
Start on a card means what B means. It runs before the verbs, because A is both
`hop` and `press this`. A full pad-only journey now works end to end: title →
Sydney → wharf → board → walk the rows → **travel to Pasto** → pause → settings
→ fader moved (master bus 0.85 → 0.81, read off the graph) → quit → confirm.
Slide moved to **G**; `Ctrl` is unbound, because Ctrl+W closes the tab and no
page can cancel it. A third vocabulary rewrites clues for a pad (`press Q,
anywhere` → `press B, anywhere`), checked statically: 191 clue literals, 39
rewritten, zero other lone capitals. BACK gained a hold for the stuck-rescue
(21.9 m back, measured) while its tap still hides the paper. `sysFocusWrap`
took Tab from **3 of 14 presses leaving the pause card to 0 of 12**. And calm
now reaches the freeze: driving the card's own checkbox, a hitstop applies
`scale` 0.08 with calm off and 1 with it on.

**Three bugs in my own driver, each of which looked like a game bug.** The
button that opens a card is still down on the next frame, so a zeroed edge
state closed the board on the frame it opened — which reads exactly like three
wheeks no longer working. `button:not([disabled])` matches a button whatever
its tabIndex, so the pad walked the nineteen souvenir slots the journal had
deliberately taken out of the tab order, and never reached a destination. And
the quit question is a card inside a card: one press down from "stay here"
landed on a volume slider.

**And two probe defects worth recording.** Matching `/Pasto/` against
`activeElement.textContent` matched on the first press, because the card itself
takes focus when the board opens and its text contains every chapter name in
the game — every later step then ran with the board still up, and four separate
assertions failed for that one reason. And the freeze cannot be read while a
card is open, because the card pauses the world and a paused world runs no time
step: the first calm measurement read `scale` 120 ms into a 350 ms hitstop with
the settings still up and got 1.0 both ways, which reads exactly like a freeze
that never fires.

**Left as spill, deliberately:** the HUD text floors (8.5 px clue, 9.5 px task,
8–10 px on the phone block). Raising them is one CSS block and a phone
screenshot pass, and it belongs with the other type work in P7 rather than
half-done here.

Verified: R1, R4 and R5 re-run green, 19/19 soak clean with 0 NaN, 0 errors and
0 record orphans, no page or console errors in any pad run, build 9143.6 KB.

*Original scope:*
*Must land:* (a) The board: Start or B while `jrShown` closes it; d-pad walks
its rows, A travels. (b) One `sysPadCard(dt)` that, while any of the four cards
is up, maps d-pad up/down to synthetic Tab/Shift-Tab within the card, A to
`click()` on `document.activeElement`, B to Escape, d-pad left/right on a
focused `<input type=range>` to a step. (c) A third vocabulary in `sysScheme`
/`sysSay` keyed on `padOn` (Q→B, E→X, Shift→RT, Ctrl→LT, R→d-pad down or
whatever the map says); the connect toast names all nine bindings; a pad
binding for R (stuck). (d) Slide moves to **C** on the legend and in the touch
words, Ctrl stays as a silent alias; `preventDefault` on S and D while Ctrl is
held (W cannot be caught; that is why the legend moves). (e) `sysFocusWrap`
used by all four cards and `#hud.inert = true` while any is up; Tab in the
ledger reaches its controls. (f) `hitstop()`/`slowmo` and `padRumble` read
`calmOn()` live; one `matchMedia('change')` listener.
*Spill:* the `K, then Enter` toast gated on device; text floors to 11/12 px
with a phone re-screenshot.
*Verify:* a fake `navigator.getGamepads` in playwright (real keys unlock
audio; the pad is polled, so a stub array is enough) driving a pad-only run:
Sydney → wharf → board → close → pause → fader moved → journal → quit-to-title
→ confirm → title. Every step asserts the DOM, not a hook (`the-closing-four`:
hooking a public name shows what the chapters say and none of what the game
says). A keydown soak with Ctrl held proving S/D are cancelled.

**Batch P3 — the chase. Done, 2 Sep 2026.** Every system in this batch already
existed and was invisible.

**Sixty of the 231 tasks are measured and the paper never said which**, because
the record board only appears once a chapter is finished — so for the whole of
a first pass a player could not tell which tasks were races, and by the time
they could, the cheap first attempt was spent. There is a glyph on the row now
and the par on the clue, in three sentences because there are three cases
(never raced with a par, raced, and measured with no par — which is thirteen of
the sixty). Cross-checked statically: **231 tasks, 60 timed, 60 records, 0 keys
that are not task ids.** The picker's record line came out from behind the
100 % guard: that guard's argument holds for the souvenir, which is a thing you
get for finishing, and not for a number you have already set.

**Nine tasks wait on a clock nobody could see.** A biome may now publish
`nextIn(taskId)` — seconds until the window, 0 while it is open, −1 for "not a
clock" — wired in the six cycle chapters and rendered as "next in 40 s".
Measured live: iceland 8.8 s, hanoi 23.6, palawan 40.7, goreme 58.9, kowloon
68.6, venice 86.0, each returning −1 for an id it does not own; and on the paper
"next in 6 s" became "next in 2 s" four seconds later. Iceland's is the
interesting one — its clock runs faster near the pier head, so the number gets
shorter when the player does what the chapter wants.

**The incident was the only repeatable reward and was never counted.** Per
chapter now, additive on the save. Verified by causing one: 21 people watching,
eight props dropped, `inc {"1":1}` and `scn {"1":1}` on the file, both still
there after a reload. DONE HERE became a score card off four facts that were
already on the file and shown nowhere, photographed at Circular Quay as `0:08
here · 0 of 3 timed`, and record rows with a ghost stored carry a replay mark.

**Four smaller things.** Ghost storage 8 → 24, because eight against sixty rows
meant a completionist's Kyoto ghost was evicted around Iceland by the act of
playing the chapters in between. Hanoi's fold stopped being a rising edge on a
damped value sampled once every 96 s — verified by arriving three seconds late
and ticking. The condor's wingbeat is taught, through a new `game.say` so a pad
reads B and a phone reads WHEEK. And Pasto stopped saying GALERAS twice three
seconds apart.

**Two probe defects, both of which reported a working thing as broken.** The
incident test used `page.addInitScript` to clear storage, which fires on EVERY
navigation — so the reload that was meant to prove the save survives wiped the
file it was checking, and reported `inc: null` on a run that had just written
`inc: {1:1}`. That is harness trap 10, in the exact shape the trap is written
down in. And the first attempt to cause an incident stood the animal on the
lawn: the chain is gated on somebody having seen it, `findPeople` returned 0,
and eight thrown props counted for nothing — correctly.

**Left as spill:** the second lawn ring for all-pars/all-finds, and the
place-heat tier card. Both are new authored beats rather than exposures of
existing state, which is what the rest of this batch was.

Verified: R1 green, 19/19 soak clean with 0 NaN, 0 errors and 0 record orphans,
no page or console errors in any run, build 9163.3 KB.

*Original scope:*
*Must land:* (a) A "measured" glyph and the par on the paper row itself for any
task with a `RECORDS` row (the row already renders a hint line four times a
second) and the record line in the picker/DONE HERE outside the 100 % guard.
(b) Per-chapter incident and scene counts in `jrFile` (additive field, the
save's "nothing migrates" rule holds), one line on the ledger row, and DONE
HERE becomes a score card: time here (`jrChapMs`), records n/m, pars met,
finds, scenes. (c) `api.nextIn(id)` — optional per chapter, seconds until the
next window — rendered as "next in 40 s" on that row; wire the six cycle
chapters (whale, lagoon, symphony, sunrise, tide, train). (d) Hanoi's fold gate
becomes a state gate (`hanFoldK >= 0.5 && inAlley` while the train is pending).
(e) `sysGHOST_KEEP` to 24 and a ghost glyph on board rows whose id is in
`ghAll()`. (f) The condor flap taught — one line at mount, "Q beats the
wings", pad/touch words via P2's table — and the double GALERAS card removed.
*Spill:* the second lawn ring (all pars / all finds) on `sysFinaleStage`; a
place-heat tier card on the incident path.
*Verify:* `hud.recordAudit()` still 0 orphans; a scripted Hanoi alley entry
two seconds after the horn ticks; a scripted incident writes the count and it
survives reload (clear ONCE with `page.evaluate`, never an init script —
harness trap 10); PNG of the score card and of a paper row with its par.
**Trap:** a RECORDS key must be a TASK id or the row is invisible; measure
pars machine-floor first if any new one is added.

**Batch P4 — the punctuation. Done, 2 Sep 2026.** The last batch. Measured
under `playwright-cli` throughout, because every claim is about a real
AudioContext on a real clock.

**One bell was doing the work of seven things.** `chime` was the payoff for a
mini, an act break, a record at par, a personal best, a near miss, a find, an
incident, a chapter finished and the finale — at nine pitches — and it is also
an ambient bell in five chapters. `musSting` plays a short figure built from the
sounding chord through `musLiftNote`, so a record in Kyoto is a koto and in
Hanoi a dan bau. **No new voices**, which is why it cannot be out of tune.
Three shapes that say what the events are: record two notes up, act two notes
down and low, done three notes falling to the root. `chime` keeps the find, the
mini, the incident, the finale and every ambient bell.

**Four payoffs were silent** — the souvenir, the costume, the chase onset and
beating your own ghost. The chase is the one worth naming: it only ever moved
`musChaseT`, which the pad follows over seconds, so the score got tenser some
time after a chase began and nothing marked the moment. It is now a term in the
one expression that writes the bass gain, not a second writer on it.

**The band did not notice the pause card.** Measured off the graph: music filter
20000 → 1102 → 20000 Hz, duck gain 1 → 0.34 → 1.0.

**There was no underwater state at all**, in a game whose chapter-12 marquee is
"be under when the water lights up". One low-pass on everything that is not the
score, one on the score taken less far down because nobody in the lagoon is
playing it, and a longer room. Measured diving in Palawan: world 20000 → 620 Hz,
score 20000 → 1400, room send 0.05 → 0.27, all three back on surfacing.

**And a room is not always a chapter.** The basilica, the casino salon and the
deep end of Son Doong all played in their chapter's outdoor room, and two of
them have a comment in `sysROOMS` itself saying the chapter has two rooms.
Chapters can now name one: venice 0.199 → basilica 0.338, cave 0.417 →
deepcave 0.515, monaco 0.189 → salon 0.030 — the quietest send in the game,
because a casino is built so nobody hears the next table.

**Three probe defects, all mine.** A picker key is a one-based index and it bit
twice in one run: `Comma` is Antarctica and `Period` is Monte Carlo, so two room
tests measured the wrong chapters — caught only because the audit reports the
room key, which read `antarctic` under a heading that said monaco. The casino
floor is 28 m up, so teleporting to a point that had just passed the zone test
dropped the animal into the harbour. And the first sweep for the casino looked
between x −80 and 80 when it sits at 118.

**Left as spill:** flight and slide air, `sfxPurr` on the loaf, the Drift's
two-line ladder, and the `force`/volume-1.0 audit. All four are additions to a
mix that now has the structure they would sit in; none is a defect.

Verified: `audio2` green in 13 chapters with the score running and no errors;
19/19 soak clean with 0 NaN, 0 errors and 0 record orphans; build 9182.8 KB.

*Original scope:*
*Must land:* (a) Three stingers on `musLiftNote` that read the live chord —
`record` (two-note rise), `act` (low cadence), `done` (three-note resolve) —
and `chime` handed back to the world; the finale keeps its own. (b) The silent
four: souvenir (soft pop + arp), costume (rustle + two notes), chase onset (one
bass pulse on the band), ghost beaten (the record stinger a third up). (c)
`pauseShow`/`pauseHide` take `musVol` to ~0.35 and close `musFilt` 40 % with
`setTargetAtTime`; the visibility resume also fires on the title card. (d) One
`BiquadFilter` on `acSfxBus` plus `musPlaceLP`, driven by `capy.depth` (20 k →
600 Hz, room send up) — Palawan's marquee is the test. (e) A
`biome.api.room()` override so a zone can request a different `sysROOMS` row:
the basilica, the salon, the deep cave.
*Spill:* flight and slide air (`sysWxBedSet` takes `max(b.wind,
airspeed/25)`); `sfxPurr` on the loaf; the Drift's ladder to six lines; the
`force` and volume-1.0 audit.
*Verify:* node-count per new synth across the call (the only thing observable
without hearing it — `the-closing-four`); `hud.ambAudit()` unchanged in every
chapter that was not touched; a playwright run (real keys, real clock) that
pauses under the Cali band and reads the music bus gain; a dive in Palawan
reading the filter frequency. **Traps:** the ladder calls every bespoke voice
at 0.04–0.21 — author the stingers against the table they join, not their own
envelopes; ducking keyed on sfx events is ducking keyed on footsteps (129 in
45 s) and stays unbuilt.

---

## The shelf — sized, not scheduled

If there is a fifth and sixth session, this is the order.

**P5 — faces and bodies** (area 3, ~10 h across two sessions). One more
instanced part per person: two eye dots and a brow bar with three states
(neutral / wide / angry) driven by the existing flinch and chase states, and
per-person `headYaw`/`headPitch` already there to aim them. Three builds
(short-stout, medium, tall-thin) by per-instance scale on legs and torso;
children in Sydney, Rio, Manly. Whiskers, gaze at the nearest bubble-speaker,
ear yaw on `npc:*` events, a sniff pulse on `mNose`. Speech bubbles as paper.
This is the single largest lift to the comedy and it does not fit a 3 h
batch honestly; that is why it is here and not in P3.

**P6 — the through-line** (area 6, ~12 h, almost no code). One journal
sentence per chapter in the finds' voice on the ledger leaf and the departure
card; the Pantanal's souvenir and door line made the exception they should be
("you are taking: nothing. it was yours already."; `wheek three times to leave
again`); the ten door toasts rewritten to name a departure; `says.wary` and
`incident` pools for seventeen chapters (three lines each); eleven "Turn up
in" titles; eight `open` lines that duplicate the act kick; the Palawan and
Antarctic repeats; acts for chapters 4, 5, 6, 9, 11, 12, 13, 14, 15 (authoring
only — 12 beach/reef/deep, 13 town/aloft/landing, 15 bridge/herd/river); one
traveller who is in Sydney's chatter pool and turns up in three later chapters
having seen you before; the two typos and two diacritics. Read from `CHAPTERS`
in the two places the sub is hard-coded a second time.

**P7 — the drawn payoff** (from area 1's picture half, ~12 h). Dust pool 30 →
60; a ring decal on `capy:land`; a 60 ms emissive flash on `prop:impact`;
speed streaks at full run only; the chapter crossing carries the picker's
postcard rising through the white instead of a flat sheet; ground grain
halved with a two-tone macro per ground; the touch fan as stamped paper coins;
a token pass (4 radii, 6 type steps, one shadow scale, paper never gets ink
borders); one vendored display face; photo-mode poses and a self-timer; a
minimap underlay per chapter.

**P8 — under the hood** (area 7, ~14 h). `fps` from `rawDt` against the
observed refresh ceiling; chapter eviction two hops behind with a soak; the
comment strip in `build.mjs` (tokeniser-aware — the `$'` incident is the
warning); gzip in `server.mjs` or a README line; ω×r on carrier frames if the
big-ship turn measures a drift; a kinematic velocity clamp in `mainSaneWorld`;
`npm test` = the five static audits, `npm run soak`, and a `qa/README.md` that
says which of 1,452 files are live; the docs drift; Pasto's timers onto the
frame clock.

**Still the owner's, unchanged since R10:** the LICENSE (`LICENSING.md`) and
the host. Both are decisions, and the wiring for both is done.

---

## What the review found already strong, so it is not re-proposed

The loop and dt are right (fixed step, cannon's accumulator, interpolation,
0.1 s guard, substeps capped, zero non-dt-corrected lerps in per-frame code).
Input has coyote and a press buffer on the wall clock, and `blur` clears
everything. Carrier drop modes are declared and latched. The save is additive
and restore is always a spawn. Hint coverage is 231/231 and no tick is silent.
Act staging cannot show an empty card. The score is a place-by-place
instrument with six real band schedulers and a lift that is never out of key.
The grade and depth tables give nineteen chapters one authored voice, and the
two night chapters prove it. The task titles and the sixty finds are the best
writing in the game. The frame has real buttons, `aria-modal`, `:focus-visible`,
return-focus and `aria-live`, and zero TODOs in 147 k lines.
