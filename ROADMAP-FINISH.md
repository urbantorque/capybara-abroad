# The finish pass: five gaps, three batches

Written 5 Sep 2026 as a hand-off for execution in three sessions of about two
hours each, one commit per session. It follows `ROADMAP-RELEASE.md`,
`ROADMAP-POLISH.md`, `ROADMAP-DELIGHT.md`, `ROADMAP-PHYSICS.md` and
`ROADMAP-TITLE.md`, all of which are closed except for the two owner decisions
(the LICENSE and the host). Nothing below duplicates them.

Method: seven parallel read-only reviews of the tree (onboarding and teaching;
settings, input and accessibility; the 231 tasks and their stakes; long-session
health; audio and music; NPC believability; a regression hunt over the ~40
commits since `REVIEW-2026-08-31.md`), each finding verified against the
surrounding code and cited by file and line, plus eight measured runs of the
game itself under `playwright-cli` — a stranger's first 75 seconds, the arrival
frame of all nineteen chapters through the real crossing, a two-lap 19-chapter
soak with heap, geometry, body, timer, listener and frame-time counters, and
four targeted reproductions. Line numbers in `systems.js` move by the thousand
between batches; grep for the symbol.

The headline, said plainly:

> **The game is finished. What is not finished is the part a player meets
> first (the first ten minutes and every arrival), the part a player meets most
> (people reacting, and the same 45 milliseconds of noise ten thousand times),
> and the part nobody meets until the fortieth minute (three ways a session can
> end without an error).** None of the five gaps is a system that has to be
> built. Every one is wiring between systems that already exist, and the
> biggest single item in the whole plan is two and a half hours.

---

## The measured state

All numbers from this session, on the dev server at 5188, headless Chromium,
1440x900 unless stated. Scripts are in `qa/` and listed under "Instruments".

| what | value | where |
|---|---|---|
| chapters entered, both laps | 19 / 19, `lastError` null in every row | `qa/rv-long.js` |
| console errors, NaN, solver saves | 0, 0, 0 | same |
| JS heap, lap 1 | 61 MB in Sydney to 259 MB in Hanoi | same |
| JS heap, lap 2 | 212–254 MB, flat — resident, not leaking | same |
| geometries uploaded | 109 → 1754 (lap 1), 1754 → 2252 (lap 2) | same; see the trap below |
| geometries made by any verb in 10 s | **0** (wheek, grab, hop, walk, run, slide; Hanoi and Cappadocia) | `qa/rv-action.js` |
| geometries made standing still 10 s | 0–2, in ten chapters | `qa/rv-churn.js` |
| shader programs | 40 → 253 across the journey | `qa/rv-long.js` |
| world bodies after N Sydney↔Quay round trips | 160 + N — **one dead collider per re-entry** | `qa/rv-board.js` |
| live timers, listener adds, bus subscriptions over two laps | ≤ 8 timeouts, 2 listeners, 0 bus adds | `qa/rv-long.js` |
| AudioContext nodes created standing still | 40–107 per second (Monte Carlo 1 071 in 10 s) — synthesis, not a leak | `qa/rv-churn.js` |
| frame time, standing in Sydney, fresh vs. after all 19 | median 18.5 ms vs 18.5 ms | `qa/rv-churn.js` |
| what a stranger is told in 75 idle seconds | `be a menace.` at 0.7 s; a find toast at 63 s; `saved` at 64 s; nothing else | `qa/rv-first.js` |
| place card on starting chapter 1 | **not shown** — the only chapter without one | `RV-first-5s.png`, `systems.js:22811` |
| settings block | sound / music / effects faders, less motion, one note | `RV-pause.png`, `systems.js:16109–16217` |
| arrival frames with a defect | 3 of 19 (Manly, Antarctica, Monte Carlo) + 2 with a bubble over the paper | `RV-arrive-*.png` |
| Antarctica arrival boom | 3.5 m from the animal, every mode; `sysCAM_DEF` is 9.5 | `qa/rv-monaco.js` |
| Monte Carlo on arrival, no input | five cones moving at 3.98 m/s at 1.5 s; `chicane` **ticked** by 9.5 s | same |
| tasks within 20 m of spawn | Sydney 6, Pasto 4, Rio 4; Cappadocia **0**; eight chapters 1 | `qa/rv-spread.js` |
| median distance from spawn to a task | Sydney 30 m; Monte Carlo 199 m; Circular Quay 252 m | same |
| records without a par | 13 of 60; the paper prints `timed · no par set on this one` | `qa/audit-tasks.mjs`, `systems.js:17648` |
| `npm test` | 10 checks, 0 failed | |

**The one measurement that looked like a leak and is not.** Geometries rose by
498 on the second lap while mesh and object counts stayed flat at 4 499 and
5 768, and Hanoi alone added 155 in seven seconds. Two probes settled it:
standing still adds nothing, and no verb adds anything. `renderer.info.memory.
geometries` counts geometries on their **first render**, so a random walk that
brings resident scenery into view raises it with nothing created. The lap-2
frame-time drift (medians 17.7–21.9 ms against 16.6–19.0) is the same random
walk in denser places plus headless noise: the controlled A/B, standing in
Sydney fresh and after all nineteen, is 18.5 against 18.5. `main.js:656–660`
states the keep-everything policy out loud and P8 measured it; it holds.

---

## The five gaps

### 1. The first ten minutes, and every arrival

Fifty passes made the title card the best-composed screen in the game. Press
Begin and the composition stops. Measured (`qa/rv-first.js`): the paper deals
in, four rows, `be a menace.` for 2.6 s, and then 60 seconds of nothing until a
find congratulates the player for doing nothing.

- **Chapter 1 is the only chapter that never gets the place card.** `showPlace`
  is inside `if (landed)` at `systems.js:22811`; Sydney takes the else branch.
  `name: 'Sydney', sub: 'the gardens, unsupervised'` (`shared.js:2806`) is
  shown to everyone except the person starting a new journey.
- **Escape is named nowhere a keyboard player looks.** The front legend
  (`systems.js:4141–4163`) has no pause row; the fold says `Tab · Esc — the
  journal · close`, but Escape with nothing open opens the pause card
  (`systems.js:23049`). The title footnote `sound and settings are behind MENU,
  once you are in` (`15339–15341`) names a button that exists only on touch
  (`menuBtn` lives in `touchLayer`, `23296`, `display:none` unless `.on`).
- **Seven verb-teaching toasts name keyboard keys and bypass `sysSay`.** The
  first-encounter teaching for dive (`palawan.js:4045`), climb (`kowloon.js:4537`),
  the burner (`goreme.js:4093`), the soft rock (`goreme.js:4835`), both helms
  (`quay.js:4826`, `antarctic.js:3686`) and the traghetto (`venice.js:4477`) all
  go through raw `toast()`, which does not rewrite (`systems.js:17794`); only
  hint clues and `game.say` do. `sysTOUCH_WORDS`/`sysPAD_WORDS` (`4285–4320`)
  have no row for `W/S` or `A/D`, so the two helm strings cannot be rewritten
  as written. The one teaching string that does it right is the slide beat
  (`systems.js:28815`), and it is the template.
- **The tutorial chapter is the only one in nineteen with no shape.**
  `CHAPTERS[0]` has no `acts` and no `win`; `todoRefresh` says so in its own
  comment (`systems.js:20059–20060`). The act card, the soft chime and the
  header-as-movement are dead in the chapter that decides whether anyone plays
  chapter 2. The marquee (`opera-stage`, row 9 of 19) and the mini
  (`whippy-run`, row 19) are unmarked on the paper — the only badge is the
  clock glyph on measured rows (`16419`) — so with a four-row window neither is
  visible for the first hour.
- **No nudge exists.** The only elapsed-time state is `startMs`, read by clocks
  and the ledger. A player who wanders for three minutes gets the same four
  rows. The one thing that fires on inactivity is the `perfectly-still` find.
- **The way out is untaught until 19 / 19.** The door row (`__way`) only turns
  on when `openIds.length === 0 && chapComplete(n)` (`20105–20106`); the
  minimap's door ring is drawn from frame one and unlabelled — `sysMAP_WORLDS`
  authors a `t` for every mark (`5541`) and `fillText` appears nowhere in
  `systems.js`. "Nineteen places, in any order" has no reachable expression
  during chapter 1.
- **The arrival lens inherits the previous chapter's zoom.** `teleportCapy`
  resets `camYaw`, `camHandT`, `camDolly`, `camClearF`, `skyEyeT`, `titleT`,
  `shakeAmt` (`systems.js:24514–24583`) and not `camDist`, which is used two
  lines later to compose the arrival (`24526–24528`). `RV-arrive-13-manly.png`
  is that bug as a picture: arriving from Cappadocia, the boom is at the far
  zoom over open water, the sea fills the lower half and the animal is a head
  behind a bin. Arriving from Sydney (`RV-cam-manly-1.png`) the same spawn
  frames correctly. Eighteen composed arrivals are composed at whatever zoom
  you left the last place on. `chaos` and `musChaseT` are not cleared either
  (`27919`, `11106`), so a chapter left in a riot scores the next arrival.
- **Antarctica's arrival is a photograph of the animal's rump.** Boom distance
  3.5 m against `sysCAM_DEF` 9.5 in every mode (`qa/rv-monaco.js`); the spawn
  (`main.js:395`) sits against the station hut and `sysCamClear` pulls the
  boom in. `MONACO_SPAWN` (`main.js:425`) is the precedent for a spawn that
  declares `dist`, `pitch` and `raise`.
- **Monte Carlo ticks a task nobody did.** `monSpawnChicane` runs on the first
  `onEnter` (`monaco.js:4578`), the cones are spawned on the track, a car goes
  through them, and one is in the harbour before the player has moved — five
  cones at 3.98 m/s at 1.5 s, `chicane` done by 9.5 s (`qa/rv-monaco.js`,
  `RV-arrive-17-monaco.png`: `TICKED · PUT THE CHICANE IN THE HARBOUR`).
  `prop:water` (`monaco.js:4319–4325`) has no "the player touched it" term.
- **Speech bubbles paint over the paper.** The pool mounts into the HUD root
  after the to-do card (`npc.js:8719`); `.capyui-todo` (`systems.js:7082`) has
  no z-index, so DOM order wins. `RV-arrive-19-sydney.png` (`Reckon it'll
  rain.` across row four) and `RV-arrive-17-monaco.png` (`Busy?` on the header)
  both show it.
- **`to-quay` is pre-ticked by the departures board.** `jrTravel` calls
  `completeTask(def.arrive)` in the fade (`systems.js:18507`); the real cast-off
  implementation at `quay.js:5262–5281` never runs first. Chapter 3's act one
  is therefore one task, and its act three is one chip.

### 2. The world answers — people, and the tasks that ask them to

The premise is a capybara and the people who react to it. Chapter 1 has seven
tasks that need a person to react. **Twelve of the other eighteen chapters have
none** (2, 3, 4, 5, 7, 10, 11, 12, 13, 16, 17, 19) — 15 of 231 rows are
person-reaction rows, and 7 are Sydney's. Pasto is a market chapter with its
own `wary`/`incident` pools whose eleven rows are all props and flight;
`steal-empanada` ticks on `physTask` at pickup (`props.js:2673–2675`),
mechanically a sandwich off a rug.

- **216 background people in five chapters never turn a head.** Monte Carlo's
  46 watchers turn to the nearest *car* and have no capybara term
  (`monaco.js:3197–3216`); Circular Quay's 30 (`quay.js:4547–4592`), Hanoi's 70
  (`hanoi.js:2886–2917`), Venice's 48 (`venice.js:6083–6087`) and Manly's 22
  (`manly.js:3377–3381`) get a position nudge and nothing else. Rio's ala
  (`rio.js:2563–2572`) and Cali's watchers (`cali.js:3096–3100`) already do the
  thing, in the same loop shape.
- **Monte Carlo's crowd is already pointed at the car the capybara is riding
  and does not know it.** `monRider` is module state (`monaco.js:322`); the
  watchers pick their target from `monCarG` only (`3204–3209`). The funniest
  thing in chapter 18 has an audience of 46 who register a car.
- **Giving a chapter its own voice shrank its vocabulary.** `npcSay` is
  own → chapter → neutral, first hit wins (`npc.js:1467–1475`). `npcPLACE_SAY`
  gives every chapter exactly three `wary` and three `incident` lines
  (`1370–1461`); the neutral pools carry seven each and are now unreachable in
  every chapter that has locals. `npcHEAT_SOON` drops the wary bar to 0.14 in a
  hot square, so the three-line pool is the one a menace hears most.
- **The witness chain arms off array order, not loudness.** `locChainFrom` is
  set only inside `localReactLine` (`npc.js:2564–2567`), reached in `locals`
  order behind a cooldown; the loudest reactor is computed (`loud`, `2124`)
  and used only for one `npc:startled`. D3 asked for the loudest to hand the
  look on; the answerer was fixed to nearest, the source never was.
- **The person who tidies up teleports the object home.** `localOwnStep`
  reaches the prop and calls `game.physics.rescue(p)` (`npc.js:3007–3016`),
  a hard `position.set` (`props.js:1815–1832`), from up to 26 m; the crate
  vanishes and the person walks back empty-handed. Sydney's `reclaim` pins the
  prop to the hand (`npc.js:5984–5999`, `6860–6880`) and is the honest version.
- **The most-heard dialogue bypasses the resolver.** `localsChat` fires every
  11–28 s in every chapter through `localLine` directly (`npc.js:4045`, `4078`)
  — ten openers and ten replies shared by a gondolier, a Mong Kok cook and an
  Antarctic scientist.
- **Finishing a task in front of somebody moves one head.** `task:complete`
  uses `localLine`, not `localReactLine` (`npc.js:3411–3416`), so the chain is
  not armed at the one moment a chapter is for.
- **The animal looks at the joke and has no opinion about it.** `capyMood` is
  driven by the wheek, the fall, the whiff, the refusal and the loaf
  (`capybara.js:5756–5768`) and not by `capy:incident` or `npc:chase`;
  `capyBeatFlash` documents itself as unread (`5670–5673`).
- **`swim` is the only steering state with no ceiling** (`npc.js:6295–6341`),
  and `qa/npchealth.js` parks the animal at spawn, covers Sydney and Pasto
  only, and structurally cannot enter the six states a player causes.
- **The game's one wager cannot be lost.** `monPay` returns 8/2/1, never zero or
  negative; `monStack` is only ever `+=` and never reset (`monaco.js:282–284`,
  `3391`, `3455`). The one place in 231 tasks where the fiction promises risk
  is a ratchet. And owner recovery walks at 1.25 m/s with a 10 s ceiling
  against a 7.4 m/s animal (`npc.js:2202–2218`): between Marrakech and Monte
  Carlo nothing can take anything off you.
- **Chapters 17–19 have no state-aware clues** — 44 tasks, every clue a static
  string (`systems.js:19263–19352`), and neither `antarctic.js` nor `monaco.js`
  publishes `nextIn`, while Venice's marquee rides a 205 s clock the file
  already computes for two other rows and returns −1 for `acqua-alta`
  (`venice.js:5313`). Eight chapters peak in act 2 and four then end on one or
  two rows; `chapterCeremony` (`systems.js:22347–22383`) is byte-identical
  across nineteen worlds.

### 3. The sound over an hour

The mix is produced, the limiter is real, underwater is right, the lift cannot
be out of key, and one writer per AudioParam holds across thirty thousand
lines. What the audio pass would still find is repetition — the thing a
ten-minute soak cannot hear and a thirty-minute chapter cannot avoid.

- **Every one-shot noise voice is the same 45 ms of noise, every time.**
  `noiseMake` randomises `loopStart`/`loopEnd`/`playbackRate`
  (`systems.js:9150–9162`) and **no caller passes an offset to `start()`** —
  43 sites of `.start(t)`, zero of `.start(t, offset)`. With playback beginning
  at sample 0 and every voice 45–220 ms long, the loop window is never reached
  and the randomisation is dead code for exactly the sounds that needed it: the
  footstep (~10 000 a session), the caixa (~90 000 strokes a Rio), the snare,
  the hats, the thud, the splash. The ear locks onto a repeated micro-transient
  and a shaker becomes a buzz.
- **Rio and Cali repeat a 7–19 s loop for half an hour, and the one system
  that would break it is off in those chapters.** `sysMUS_NEXT7 = [[1],[2],[3],[0]]`
  (`3275`) and `NEXT6` are deterministic; `musSambaBar`/`musSalsaBar` write
  fixed tables every bar. `musBreathStep` — the only long-form phrase
  structure in the score — is gated `!musPal.band` at `11384`. The six chapters
  with the shortest repetition have no macro breath at all. The pad chapters
  are fine: Markov harmony and random dwell never literally repeat.
- **Swimming is silent and sliding plays a gallop.** Footfall is gated
  `!capySwimming && grounded && !carried` (`capybara.js:5168`) and
  `capySliding` is not in it; the animal is grounded throughout a slide
  (`3499–3512`) and `capyLegPhase` advances in the `moving` block (`5158`), so
  footfalls fire at up to `capyGAIT_MAX` with the belly on the ground. There is
  no swim stroke; the only swimming sound is a hop off the water.
- **A chapter crossing does nothing to the mix.** `musCross(-1)` at `24789`,
  `musSetPalette` inside `biome:enter` at `26858`; nothing touches `musVol`,
  `musDuckG` or `musDrum` during the 820 ms — `musDuck()` has exactly two
  callers, the pause card. Cali → Rio is a 100 bpm salsa hard-cutting to a
  132 bpm bateria with up to 0.7 s of both bands sounding.
- **The band bus never ducks, so the marquee is quietest where it most needs
  to be heard.** The 0.3 s mix block (`29923–29957`) writes pad, filter, bass,
  shimmer and choir from `lift`, `calmLean`, `musBreath` and never touches
  `musDrum` (pinned at 0.62, `14345`) against three lift voices summing to
  0.118 (`sysMUS_LIFT_L`, `4456`).
- **Every bubble in the game is silent and every person gasps at pitch 1.0.**
  `sayBubble` (`npc.js:1032`) is the one place every line goes through and it
  fires no sound; `function sfx(n, rec, vol, pitch)` defaults `pitch || 1`
  (`npc.js:4295`) and no record carries a voice seed. Props already have
  `vpitch`/`vgain` per impact; people were skipped.
- **Every interior threshold goes wet → dry → wetter.** One convolver;
  `sysRoomSet` (`11043`) forces `want = 0` while `acRoomFor !== live` and only
  swaps the IR at `acRoomWet < 0.006` — about 1.5 s with no room on the two
  crossings (Venice, the cave) where the send is going up.
- **Minute 1 and minute 30 of a chapter sound identical.** The only progression
  reader is `musShimGain = musProg*0.85` and `musProg` is game-wide
  (`doneCount / TASKS.length`, `21976`): a whole chapter moves it by ~0.05.
- The wheek has two variants and the loaf no sound (`sfxPurr` unbuilt,
  `ROADMAP-POLISH.md:601`); Iceland's ambience is three lines and the Drift's
  two (`29142–29181`); the organ's reverb send goes to the music bus
  (`14665–14667`) so muting music takes the church's room away.

### 4. The frame and the options

The pause card has three faders and one switch. The modal discipline behind it
(`inert`, focus return, `sysFocusWrap`, `sysPadCard` driving the real DOM) is
better than most shipped games. What a AAA options screen would still have, in
this game's own paper:

- **Camera look is one hardcoded constant on every device.** `camYawTarget -=
  dx * 0.005` (`systems.js:23227`) for mouse and finger alike; pad yaw
  `sysPAD_YAW`, wheel `* 0.012`, pinch `* 0.035`. No sensitivity, no invert.
- **No HUD text scale, and the floors are 7.5–9.5 px** (`.capyui-task` 9.5,
  `.capyui-clue` 8.5, the timed glyph 7.5 at `.72` opacity; `7106`, `7214`,
  `7196`). Fifty independent `clamp()`s, no root token, all `px`.
- **An off-screen speaker is silently dropped.** `npc.js:8733` computes
  `onScreen`; `8787` sets `display:none`. Somebody talking to the capybara from
  behind the camera says nothing, and this is the channel the game uses to say
  you were noticed. (Sound cues are already captioned: Venice's siren toasts,
  Strokkur's warning is a dome.)
- **Every held input is hold-only** — sprint, slide, dive (up to 16 s), the eye,
  the rescue, the climb. For RSI or a motor impairment that is the whole game.
- **"Less motion" is one lever over eight effects, and the one unrequested
  camera move escapes it**: the automatic recentre after `sysCAM_IDLE_T` 1.1 s
  (`27235–27244`) is ungated. There is no FOV setting; `sysFOV_MIN/MAX` 41/61
  are ready-made bounds around a fixed 48.
- **The stamina bar signals "low" by colour alone** — `tick` `#69a05a` to
  `accent` `#e98b7a` is 1.25:1 — and "blown" by a blink that `.capy-calm`
  deletes (`7503`, `7814`).
- **There are no settings until the game has started** (`pauseShow` gated on
  `started`, `23049`; Escape on the title only turns the page). A stranger who
  needs it quiet must begin a journey first.
- The legend fold still reads `Tab · Esc — the journal · close` and names
  neither Escape's real job nor START/BACK on a pad (`4176`); touch cannot hide
  the paper, recentre the camera, take a photo or re-aim the hint; there is no
  "do this place again"; `\` is an ungated debug teleport a player will find
  because it is also a printed picker key (`23151`, `sysPICK_EXTRA` `4067`);
  `qa/uicontrast.js` measures one card.

### 5. The long session

Two laps of nineteen chapters, clean. The engine work (fixed step, the
accumulator, `mainSaneWorld` covering kinematic bodies, the event bus with 59
constructor-time subscribers and none per rebuild, boot-time listeners only,
one `setInterval`, a bounded three-key save layer, WeakMap caches on the hot
path) is the best-kept part of the tree. What remains is three ways a
three-hour session can end without an error in the console, and a handful of
state that crosses a border it should not.

- **A single non-finite AudioParam write deletes `systems` from the update
  loop.** `main.js:2043–2046` splices any module that throws four frames
  running, four lines under a comment saying `systems` must never stop.
  `setTargetAtTime` throws `RangeError` on a non-finite value; there are 30 of
  them in the tick, all fed through `clamp()`, which is NaN-transparent
  (`shared.js:3512`), and `damp` is a lerp, so a NaN in `musIntensity`
  (`systems.js:29885–29926`) is permanent. Four frames later the HUD, the
  camera and the pause gate are gone with the world still stepping.
- **Camera NaN is unrecoverable.** `camYaw`/`camDist` go through `damp`
  (`27087–27088`) and `camera.position.copy(sysCamPos)` (`27812`); there are
  exactly two `isFinite` calls in 30 076 lines and neither is on the rig.
- **The departures board leaks one collider per re-entry.** `boardPlant` adds
  its group and body through the patched `scene.add`/`world.addBody`
  (`systems.js:19704–19718`), which tag them into the chapter's capture set;
  `boardDrop` (`19617–19628`) removes them from the scene and the world but not
  from `s.objects`/`s.bodies`, and `attach()` (`main.js:600–605`) puts every
  dropped body back. **Measured: 160 → 166 bodies over six Sydney↔Quay round
  trips** (`qa/rv-board.js`). Static, so gameplay is fine; `mainSaneWorld`
  walks the list every frame and the orphaned groups hold their geometry.
  `physSceneAddLoose`/`physWorldAddLoose` (`props.js:3501–3507`) are the idiom.
- **A build failure rolls back without `biome:enter`** (`main.js:669–672`), so
  the seven subscribers — shadow box, `camera.far`, weather prime, carry
  release, customs, the incident chain — all skip and you land in the chapter
  you left with the other chapter's sky.
- **Sydney's and Pasto's crowds keep their alarm across a two-hour absence.**
  The npc `biome:enter` handler resets bubbles, `gather` and carries
  (`npc.js:8531–8547`), not `wary`/`alarm`/`chase`; decay is in `stepHuman`,
  which is biome-gated, so a crowd left mid-panic is frozen there and
  re-arrives hostile for the first 26 s.
- `ghWrite()` stringifies the whole ghost store (up to 24 runs, ~1 MB) on the
  frame of every personal best (`20936–20940`); the album re-decodes 36 JPEGs
  per open (`17405–17431`); `musTick` keeps scheduling in a hidden tab
  (`14528`); the per-frame prop sweep is O(all props ever built)
  (`props.js:5392–5405`) — 391 by chapter 19, filtered by two cheap branches.

### And the regressions since 31 August

Not a sixth gap — a list. The ~40 commits since `REVIEW-2026-08-31.md` were
read as a diff and checked against the current tree. The engine half is
clean: every new optional-hook call site guards for absence, every new divide
has a floor, no new `Math.acos`, no two-writer sites, the z-index ladder is
collision-free, the stripper survives the new data-URI and template literals,
`npm test` is green, and there is not one TODO in the tree. What slipped is
all in the D6 glyph sheet, where `.wave`/`.cross` moved from SVG paths to HTML
wrappers and four CSS rules did not follow:

- **The mute icon jumps to button size when pressed.** `.capyui-setmute.off
  .cross{display:inline;}` (`systems.js:7407`) — `display:inline` on a box
  discards the 16 px `width`/`height` at `7399`, so the inner `svg` resolves
  100 % against the button. *Fix: `inline-block`, one word.*
- **The closing sentence never arrives alone.** `toast(..., 'last')` calls
  `sysToastPush(toastWrap.children.length)` (`17805`); `sysToastPush(keep)`
  counts live pills and loops `while live > keep`, and `children.length ≥
  live` by construction, so the condition is never met. `and that is the lot.`
  lands under whatever autosave pill is up. *Fix: `sysToastPush(0)`, as at
  `18006`.*
- **The touch STUCK glyph is 3.5 px off centre.** `.capyui-back .capyui-g
  {margin-right:7px}` (`6614`) was written for the title's back button and
  `capyui-back` is also the touch rescue button (`23285`). *Fix: scope to
  `.capyui-page .capyui-back`.*
- **The touch fan's glyphs are sized off the old word font-sizes.**
  `.capyui-g.big` is `1.6em` (`6076`) and MENU/LOOK/STUCK carry `font-size:
  10px` from the words they replaced (`7890`), so the glyph authored to be
  legible at 24 px renders at 16. *Fix: `.capyui-btn .capyui-g{width:24px;
  height:24px}`.*
- The glyph background token `--capyui-gbg` is the card's paper (`6066`) and
  paints cream `o` shapes on the translucent LOOK button (`5119–5121`); the
  pause card's `.off` state already re-declares it (`7405`) and the touch
  buttons do not.
- **Latent:** `titleFit()` reads the card's rect synchronously inside the
  page-two `swap()` while `max-width` is mid-transition (`15692–15695`,
  `6283`), so `titleCardR` is wrong for 300 ms; the anchored-ambience branch
  restores `at`/`far` but not `near` (`14922–14930`); `sysSHADOW_SKY_DEF` is
  0.45 under a comment that says 0.55 (`258`, `262`) for the ten chapters not
  in the table; `EMIT_OVER = 1.45` went in globally and only Göreme's bloom
  threshold was retuned while the note names Mong Kok too (`shared.js:2101`,
  `systems.js:1838`); the hint's rise tell is still a platform `↑`/`↓`
  (`28067`) under a comment claiming the glyph sheet replaced every one; four
  shape counts in comments are wrong (`index.html:68`, `126`; `systems.js:5073`,
  `5030`). `qa/sheet.html` (untracked) is a D6b contact sheet pointing at
  ignored PNGs and belongs in `.gitignore` beside `dp-top.png`.

---

## The batches

Ordered by what a player meets first. Each is sized for one commit and one
session; the "must" list is about two hours of sized work, the "if the clock
allows" list is the order to continue in. Verify from rendered PNGs and the
harness (`headless-qa-harness` in memory), never from a frame-mean metric, and
prove every fix with a differential (harness trap 9). Gap 4 does not fit in
three sessions and is shelved, sized, below — except the four items of it that
cost under fifteen minutes each, which are in F1.

### Batch F1 — the first ten minutes, and the arrival (gap 1, the arrival half of gap 5)

> **DONE, 6 Sep 2026.** All nine must-items. `CONTRACT.md` carries the F1
> paragraph. Two of the nine turned out to be different from how they are
> written below, and both are worth reading before the next batch trusts this
> file:
>
> - **Item 4's camera half was right and its remedy was wrong.** The roadmap
>   says `camDist = camDistTarget = sp.dist || sysCAM_DEF`, which deletes the
>   player's wheel on every border crossing. Only `camDist` is set; the target
>   is left alone and the same number is handed to `frameShot`, so the arrival
>   is composed *and* the zoom comes back when the hold expires.
> - **Item 9's `.capyui-back` collision runs both ways.** Scoping the card's
>   rule fixed the touch button (−2.00 px off centre → 0.00), and the touch
>   block is still bare, so eight of its declarations reach the card. Recorded
>   in the source and shelved below rather than fixed: it is a visual decision.
>
> Also worth carrying forward: **the roadmap's Antarctic remedy ("`dist`/
> `pitch`/`raise` in the `MONACO_SPAWN` idiom") could not have worked.** The
> boom was not short because the request was small; it was short because
> `sysCamClear` cut it to a quarter against the rock behind the animal, and a
> bigger request is cut by the same fraction. The spawn had to move. Three
> repeats each, before and after: 3.68 m / clear 0.25 → 11.9 m / clear 1.00.
>
> **Not built, and deliberately:** the whole "if the clock allows" list below.

**Must.**

1. **The Sydney place card.** `showPlace(cdef.name.toUpperCase(), cdef.sub)`
   in the else branch at `systems.js:22813`, behind the same 700 ms as `be a
   menace.`. *0.25 h.*
2. **Escape on the legend, and a footnote that is true.** `['Esc', 'pause,
   settings and the journey']` and `['Tab · J', 'the departures board']` in
   `sysLEGEND_MORE` (`4176`); promote `F` to the front legend; `['tap a row',
   'aim at another task']` in `sysLEGEND_TOUCH`; the title footnote chosen per
   `sysScheme` so a keyboard player is not sent to a button that does not
   exist (`15339–15341`). *0.5 h.*
3. **Seven teaching toasts through `game.say`.** The sites listed under gap 1;
   add `W/S` and `A/D` rows to `sysTOUCH_WORDS` and `sysPAD_WORDS`. Check every
   rewritten string against the 191-clue substitution table's own rule: no
   lone capital survives. *0.75 h.*
4. **The arrival lens debts.** `camDist = camDistTarget = sp.dist ||
   sysCAM_DEF` beside the `camYaw` write in `teleportCapy` (`24514`);
   `game.state.chaos = 0; musChaseT = 0` in the systems `biome:enter` handler
   (`26791`); `ANTARCTIC_SPAWN` gets `dist`/`pitch`/`raise` in the
   `MONACO_SPAWN` idiom (`main.js:395`, `425`) or moves three metres off the
   hut. *0.5 h.*
5. **Monte Carlo's chicane belongs to the player.** Arm the `prop:water`
   handler (`monaco.js:4319`) on the cone having been touched (`p.held`, a
   `capy:grab`, or an impact with the animal) or on `monArrived && t > 20`,
   and spawn the cones clear of the car line. *0.5 h.*
6. **Bubbles under the paper.** A z-index on `.capyui-todo` and `.capyui-map`
   (`7082`, the map rule) above the bubble pool, or mount the pool before the
   card. *0.25 h.*
7. **Gate the backslash teleport** on `location.hostname === 'localhost'` or a
   `?dev` query (`23151`). *0.1 h.*
8. **`to-quay` is Circular Quay's to tick.** Drop `arrive` from
   `CHAPTERS[3]` or skip `completeTask(def.arrive)` when the chapter implements
   its own (`systems.js:18507`, `quay.js:5262–5281`). *0.5 h.*
9. **The four glyph-sheet regressions.** `inline-block` at `7407`;
   `sysToastPush(0)` at `17805`; scope `.capyui-back .capyui-g` to the title
   page at `6614`; `.capyui-btn .capyui-g{width:24px;height:24px}` and a
   transparent `--capyui-gbg` on `.capyui-btn`. `qa/sheet.html` into
   `.gitignore`. *0.5 h, all five.*

**If the clock allows.** The idle nudge — one banked timer in the
`restIdleT`/`sysREST_FORGET` idiom that re-says the top row's clue as a `note`
at ~150 s of no tick, once per chapter (1 h). A `wow`/`mini` glyph on the paper
beside the clock glyph, via `sysGlyphEl` (1.5 h). Three acts for Sydney over
the existing rows — the lawn, the Opera House, the promenade — with `win: 4`
and nothing gated (2 h, authoring). `acqua-alta` and `passerelle` in Venice's
`nextIn` branch (0.5 h). `whippy-run` in Sydney's `nextIn` (`environment.js:3538`,
1 h). A latched first-contact `game.say` for slip when `groundSlip > 0.3` and
moving (1 h). Draw `t` for the `way` mark on the minimap (2 h).

**Traps.** The place card and the first toast fight for the same 700 ms; the
act machinery already holds its card back `sysACT_CARD_WAIT` for this reason.
`camDist` is damped, so resetting the target alone leaves the arrival composed
mid-transition — set both. The chicane fix must not break the legitimate
shove: test by driving a cone in with the animal. A z-index on the paper
changes what the departures board grows out of; re-shoot `boardOpen` after.

**Verify.** `qa/rv-first.js`: the place card is in `RV-first-1s.png`; the
75-second log gains the card and, if built, the nudge. Press a mute button
on the pause card and measure the `.cross` rect: 16 px. Finish a chapter's
last row in a probe with an autosave pill up: `and that is the lot.` is the
only live pill. Touch emulation at 390x844: the STUCK glyph is centred to
the pixel and 24 px. `qa/rv-arrive.js` run
**from Cappadocia into Manly and from Sydney into Manly** — both frames match;
Antarctica's boom is ≥ 8 m; Monte Carlo reaches 9.5 s with `chicane` false;
zero bubbles intersect the paper's rect in any of nineteen frames. `npm test`
green; `qa/p2-clues.mjs` still reports zero lone capitals over the seven
rewritten strings. Frame time within 0.5 ms.

### Batch F2 — the world answers (gap 2, and the two people-sounds from gap 3)

> **DONE, 6 Sep 2026.** All nine must-items; `CONTRACT.md` carries the F2
> paragraph. One correction worth carrying forward:
>
> - **Item 1's "pin the watchers' target to that car" is wrong as written.**
>   Pinning outright drops every watcher beyond the existing 90 m gate to
>   their idle phase, so a lap at the far end of the circuit leaves forty
>   spectators facing nothing — measured: watchers facing their nearest car
>   fell from 1.00 to 0.07. The ridden car is PREFERRED where it is visible
>   and everyone else goes on watching the race, which measures 1.000 of the
>   watchers who can see the animal facing it at 0.001 rad.
>
> Also: `sayAudit` reimplemented `npcSay`'s lookup, so item 4 would have been
> invisible to its own verification. Both go through one helper now.
>
> **Not built, and deliberately:** the whole "if the clock allows" list below.

**Must.**

1. **Monte Carlo's crowd watches the rider.** When `monRider >= 0`, pin the
   watchers' target to that car (`monaco.js:3204–3209`) and add Cali's `hit`
   rise (`cali.js:3098`) with one `sfx('cheer')` on the frame the ride starts.
   *1.5 h.*
2. **The chain arms off the loudest reactor.** After the loop in `localsReact`:
   `if (loud) { locChainFrom = loud; locChainT = npcCHAIN_WIN; }`
   (`npc.js:2124–2153`). *0.25 h.*
3. **`task:complete` uses `localReactLine`** (`npc.js:3411–3416`). *0.1 h.*
4. **`npcSay` merges chapter and neutral for `wary` and `incident`**
   (`npc.js:1467–1475`); the bag at `2007` refills on a length change. *0.75 h.*
5. **`localsChat` through `npcSay`** with `chatOpen`/`chatBack` kinds
   (`npc.js:4045`, `4078`) — code only; authoring rows for six chapters is the
   shelf. *0.5 h.*
6. **A voice per person.** `rec.vpitch = rand(0.82, 1.22)` at spawn, multiplied
   into `npc.js:4297`; children higher. *0.75 h.*
7. **The speech blip.** Two or three filtered pulses per bubble, count from
   `text.length`, pitch from `rec.vpitch`, fired from `sayBubble`
   (`npc.js:1032`) so it can never be out of step with the words; level in the
   ladder's 0.04–0.21 band, authored against the table and not its own
   envelope (the R9 trap). *2 h — the one new voice of the batch.*
8. **The animal has an opinion.** `moodUp = 0.6` latched ~1.2 s on
   `capy:incident` and `npc:chase`, through the existing asymmetric damp
   (`capybara.js:5756–5768`). *0.75 h.*
9. **A ceiling on `swim`** — `|| rec.stateT > 12` on the exit
   (`npc.js:6295–6341`). *0.25 h.*

**If the clock allows.** Heads turn in Venice and Circular Quay first
(`venice.js:6083`, `quay.js:4547`; one `atan2` blended by `clamp(1 - d/12)`
inside the existing loop; then Hanoi and Manly) (2 h for two). The owner carries
the prop home instead of teleporting it — `reclaim`-style pin on arrival,
`rescue` on the `ownBack` leg at `dh < 0.5` (3 h). One person-reaction row for
Pasto: `steal-empanada` counts only if a local is looking (1.5 h). A losing
pocket on the roulette, or being seen at the table costs the stack (2 h).
`qa/npchealth.js` driven through the crowd and sweeping `game.locals` (1 h).

**Traps.** `sfx('cheer')` is a positional bang and will start
`localsReact('startled')` on the casino locals — that is the escalation, not a
bug, but count `npc:startled` emissions before and after. The Drift builds its
`addLocal` field by field and drops new keys (D7 finding 4). `npcSay`'s bag is
keyed on a pool signature; a merged pool must produce a new signature or it
will not refill. The blip is the most-heard new sound in the game after the
footstep: measure it by counting node creations across a `sayBubble` call,
and listen to a crowd chapter before shipping the level.

**Verify.** `game.sayAudit()` reports pool lengths of 10 for `wary`/`incident`
in Venice. A scripted ride in Monte Carlo: all 46 watchers' yaw error to the
ridden car under 0.2 rad within 1 s. `qa/eng-rate.js` in Pasto and Venice
before and after (startles, chains). Node creations per bubble = the pulse
count. 19/19 soak clean.

### Batch F3 — the sound over an hour, and the safety net (gap 3, the rest of gap 5)

> **DONE, 6 Sep 2026** — seven of the nine must-items in full, two in part.
> `CONTRACT.md` carries the F3 paragraph. What is partial, so that nobody has
> to find out by looking:
>
> - **Item 3 is half.** `capySliding` is in the footfall gate, so the slide has
>   stopped galloping. The sustained scrape — a filtered noise loop riding
>   `gsp` and `capySurfacePitch` — is not built; the slide still has its entry
>   `rustle` and the shared air-rush layer, both correct.
> - **Item 2 is Rio only.** The paradinha is in `musSambaBar`; Cali's
>   `musSalsaBar` is untouched. Samba is the acute case (a 1.818 s rhythm
>   cycle against salsa's 4.8 s) and the shape ports directly — suppress the
>   tumbao and the campana, keep the clave and the congas.
> - **Item 5 is half.** The crossing ducks the score, which is the audible
>   part. Band scheduling is still not suppressed under `transBusy`: that is a
>   change to the clock `game.music.beats()` publishes, which Cali's and Rio's
>   floors are scored against, and the duck already takes most of the sting
>   out of the tempo overlap.
>
> Two harness-only hooks were added because the things they observe were
> otherwise unverifiable: `game.musAudit()` (every mix gain read back, since
> `setTargetAtTime` means the only proof a duck happened is the param itself)
> and `game.forceCamNaN()` (the rig is closure-local, and an untestable safety
> net is one you find out about in production).
>
> **Not built, and deliberately:** the whole "if the clock allows" list below.

**Must.**

1. **The noise offset.** In `noiseMake`, rebind `start` so every source begins
   at `rand(loopStart, loopEnd - 0.6)` (`systems.js:9150–9162`) — five lines,
   all 43 sites. Listen to the caixa and a sprint before and after. *0.5 h.*
2. **The paradinha.** Allow the breath on band palettes as a *break* — drop
   surdo and bass for one bar every sixteen (`musBarIndex % 16 === 15`), keep
   the caixa — instead of the `!musPal.band` gate at `11384`. Rio and Cali
   first. *1.5 h.*
3. **The slide stops galloping.** `&& !capySliding` in the footfall gate
   (`capybara.js:5168`), and a filtered noise loop whose cutoff and gain ride
   `gsp` and `capySurfacePitch` while sliding. *1 h.*
4. **The band ducks under the lift.** One term in the 0.3 s block:
   `musDrum.gain.setTargetAtTime(0.62 * (1 - lift*0.35) * musBreath, …)`
   (`29923–29957`) — one writer, like everything else there. *0.5 h.*
5. **The crossing touches the mix.** `musDuckG` down to ~0.25 over 500 ms on
   `musCross(-1)`, back over 1.2 s after `musCross(1)`; suppress band scheduling
   while `transBusy` so two tempos never overlap. *1 h.*
6. **The organ's room** goes to `acRoomSend`, not `musSend` (`14665–14667`).
   *0.1 h.*
7. **The safety net.** Exempt `systems` and `capybara` from the splice at
   `main.js:2043` and add `sysAudioSet(param, v, t, tau)` that drops non-finite
   writes (1 h). `sysSaneCam()` at the top of the camera block rolling
   `camYaw`/`camDist`/`sysCamPos` back to their last finite values (1 h). The
   board through `physSceneAddLoose`/`physWorldAddLoose` or a `biome.unclaim`
   (0.5 h). `game.events.emit('biome:enter', { name: from, from: to })` on the
   rollback path (`main.js:669`) (0.25 h). `wary`/`alarm` zeroed and chase
   states calmed in npc's `biome:enter` (`npc.js:8531`) (0.5 h).

**If the clock allows.** A swim stroke on the `capyLegPhase` half-cycle with
a `splash` at 0.35 (1.5 h). A second convolver and a crossfade pair for the room
(3 h). `musChapProg = doneInChapter / idsInChapter` on its own gain (2 h). A
wheek variant table on `capy.stamBlown`/`chaos`/`capyStillT`, and `sfxPurr` on
`capyLoaf > 0.6` (2 h). Two bespoke voices each for Iceland and the Drift
(3 h). `ghWrite` per run key or on `saveSoon` (2 h). `document.hidden`
early-return in `musTick` (0.5 h).

**Traps.** The noise offset changes the footstep the whole game was balanced
on — level unchanged, only the transient; A/B by ear, not by RMS. A break that
drops the surdo drops the beat Rio's floor is scored on: `game.music.beats()`
must keep ticking through the paradinha (the clock is deliberately not
jittered; keep it that way). Exempting `systems` from the drop means a real
per-frame throw in it now logs every frame — rate-limit the `console.error`.
The board fix changes `world.bodies.length` on every chapter; re-baseline the
R10 soak's body column.

**Verify.** `qa/rv-board.js`: 160 bodies after six round trips. A forced NaN
into `musIntensity` in a probe: `updaters.length` unchanged and the pause card
still opens. A forced NaN into `camYaw`: the next frame renders with
`renderer.info.render.triangles > 0`. `qa/audio2.js` green across thirteen
chapters. Count node creations per footstep before and after the offset: equal.
19/19 soak, both laps, clean.

---

## The shelf — sized, not scheduled

Gap 4 in full, and the objective-design items that need authoring more than
code. If there is a fourth and fifth session, this is the order.

**The frame and the options** (~20 h across two sessions). A `look` fader
(25–200 %) feeding one `sysLookK` at the five input sites plus an "invert
turning" switch, both in `capy3.prefs.v1` (2.5 h). A `--capyui-t` multiplier on
`#hud` and a three-stop text row (3 h). Off-screen speakers within 25 m routed
to the toast at `note` weight (`npc.js:8787`, 2 h). A hold-to-toggle switch
wrapping run and slide only (2 h). Split "less motion" into three rows, gate
the auto-recentre, and a field-of-view fader clamped 41–61 on `sysFOV_BASE`
(3 h). The stamina bar hollows to an outline when blown (1 h). The `pauseSet`
node reachable from the title card, and MENU/START opening it before start
(1.5 h). Camera and paper on the pause card for touch; re-aim as a tap on the
row (2 h). "Do this place again" with the in-paper confirm (3 h).
`qa/uicontrast.js` generalised to the in-play HUD at 1440 and 390 (2 h).
`sysPrefsRead` hard-rejects `v !== 1` (`2928`): grow the schema additively only.

**Objectives** (~30 h, mostly authoring). Eleven pars from constants already in
the source — `three-winds` 152 (`gorLAYERS`), `great-wall` 24 m, `the-floor`
23 m, `thermal-peak` from `pastoHeight(pastoCRATER_R)`, `passerelle` from
`venBOARD_KNOTS`, `laundry-pole` ~5 s, `uji-run` ~50 s, `dune-surf` ~14,
`souk-escape` ~18 s, `the-rip`, `ride-the-flow` — and soak the two that need a
run (3 h). Dynamic clues and `nextIn` for Antarctica, Monte Carlo and Hanoi
(5 h). An audit rule for a marquee in act N−1 with fewer than three rows after
it; move Pasto's `wow` to `thermal-peak`; a second Manly row (3 h). Two records
on Sydney's existing rows (3 h). A world beat on `chapter:done` for four
chapters — the gardener downing tools, the bateria playing you out (6 h). Three
beat rows in chapters that already have a bed (4 h). One person-reaction row in
each of the twelve silent chapters (9 h). Positional confiscation (3 h). The
eighteen free arrival ticks: fold into the place card or give each a first
action (2–8 h).

**The touch fan is seven divs** (~1 h, found by F1's guidelines pass). All
seven controls are `<div role="button">` with a good `aria-label` and no
`tabindex`, so they are not keyboard-focusable and they trip the guidelines'
`<div>`-with-a-click-handler rule. They are a touch-only surface, and they
carry `touch-action:none` with pointer capture for the stick, so a change to
`<button>` has to be re-measured against the drag handling rather than typed.
Pre-existing; not introduced by F1 and not fixed by it.

**`capyui-back`, the other direction** (~0.5 h, found by F1). The touch block
at `.capyui-back{right:…}` is unscoped, so eight of its declarations land on
the title card's back button: `width`/`height` 58px, `font-size:10px`, the
0.42 sail, `border-style:dashed`, `box-shadow:none` and `opacity:.62`. The
pill its own rule describes — content-sized, a 1px solid edge, `tMd` type,
full opacity — has therefore never been drawn, and what the card shows is a
faint dashed 58px disc. Make it deliberate without changing a pixel: scope the
block to `.capyui-btn.capyui-back` and copy those eight declarations onto
`.capyui-p2head .capyui-back`, then diff the two page-two screenshots. While
there, `opacity:.62` on 10px `inkSoft` is the faintest text on the card and
`qa/uicontrast.js` has never covered it.

**The latent regressions** (~3 h). `titleFit()` re-run on `transitionend`
for `max-width`; `near` restored in the anchored-ambience branch; decide
whether `sysSHADOW_SKY_DEF` is 0.45 or 0.55 and make the comment match;
re-measure the `kowloon` and `cave` bloom thresholds against `EMIT_OVER` from
a frame, or write down that they were checked; the rise tell as a `chev`
glyph in its own span; the four shape counts.

**People** (~10 h). Heads turn in all five crowd chapters (4–5 h). The owner
carries (3 h). A second-hand tier for the chain when `placeHeat > 0.6`, look
only (3 h). `beat` rows for the ~100 locals who still only breathe (3 h,
authoring). Venice's duckboard queue made bargeable (the chapter's best domino
is unreachable). The ending keyed on `Σ jrChapInc`, and `npcGather` preferring
the people you annoyed (2 h).

---

## Rejected by measurement, so not re-proposed

Chapter eviction (twice now: P8's number and this session's two-lap flat heap;
the geometry rise is lazy upload, not creation). A per-frame allocation pass
(every `new Vector3`/`Vec3`/`clone()` in the six hot files is module-scope or a
builder; `sysCtcMeasure`'s cache is a WeakMap). Listener and timer hygiene
(2 listener adds and 0 bus subscriptions over 38 chapter entries). A global
polyphony cap, air rush, the pause duck, underwater, the limiter — all built
and correct. A vendored font (a licence decision before a design one).

## Already strong, so not touched

The title pass, all three batches. The slide beat and the condor wingbeat as
teaching. The 39 state-aware clues and the par-before-best paper. The modal
discipline on all four cards and `sysPadCard`. The calm channel reaching the 3D
camera. The save layer and its quarantine. Wariness as a derived, non-gating
field. The head-ranking on every person, the capybara's gaze and ears. The lift
table, the stinger table, the feel pass, the stereo noise pair, one writer per
AudioParam. Build-once chapters with a real rollback. The dynamic clue
system, the act contract, and Iceland's aurora chained behind the hot spring.

---

## Instruments this review leaves behind

All in `qa/`; all need the dev server on 5188 and a `playwright-cli -s=<name>
open http://localhost:5188/` first; all post their result through the `/shot`
sink as `qa/<name>.json.png`.

- `rv-first.js` — a stranger's first 75 seconds: title pages, every HUD text
  change with a timestamp, the pause card's text, the journal.
- `rv-arrive.js` — the arrival frame of all nineteen chapters through
  `hud.cross`, 9 s in, at 1440x900, plus position, FOV and visible bubbles.
- `rv-spread.js` — per chapter: tasks pointed at, distance from spawn to every
  pointer (`game.hintTarget`), within-20 m and within-50 m counts, median,
  the marquee's distance, records and finds.
- `rv-long.js` — two laps of nineteen with a random drive; geometries,
  textures, programs, scene objects, meshes, bodies, props, npcs, locals, DOM
  nodes, heap, live timers, listener adds/removes, bus on/off, frame-time
  median and p95 per row.
- `rv-churn.js` — geometry first-render attribution by `src/` stack line
  standing still, audio node creations by kind, and a fresh-vs-after frame-time
  A/B in Sydney.
- `rv-action.js` — the same attribution per verb (wheek, grab, hop, walk, run,
  slide) in two chapters.
- `rv-monaco.js` — the chicane tick across three arrivals with prop positions
  and velocities, and the arrival boom for Manly and Antarctica by crossing
  and by teleport.
- `rv-board.js` — `world.bodies.length` across six round trips.

**Six harness traps, measured this session**, in the numbering of
`headless-qa-harness`:

28. **`renderer.info.memory.geometries` counts first renders, not creations.**
    It rose 498 on a lap in which nothing was made. Before calling a rise a
    leak, hook `BufferGeometry.prototype.computeBoundingSphere` and attribute
    by stack, and hold the camera still.
29. **`create*` lives on `BaseAudioContext.prototype`.** Patching
    `AudioContext.prototype` counts zero nodes and reads as "no audio".
30. **A traverse counting `mesh.visible` cannot see a detach.** Roots are
    hidden, children keep `visible = true`; the column climbs to 3 800 and
    means nothing.
31. **The arrival lens depends on the chapter you came from.** `camDist` is
    not reset on travel, so an arrival audit that always arrives from Sydney
    passes a frame that fails from Cappadocia. Arrive from a far-zoomed
    chapter as well.
32. **`.capyui-todo .capyui-txt` returns chapter 1's rows in every chapter.**
    The paper keeps hidden rows; measure rendered rects, as R8 already said of
    `textContent`.
33. **Frame time under headless moves 3 ms with nothing changed** between two
    random-walk laps. Only a same-session, standing, fresh-vs-after A/B is
    evidence (18.5 vs 18.5).

---

## Definition of done

- All three batches committed; `CONTRACT.md` carries an F1 to F3 paragraph.
- `qa/rv-first.js`: the place card is in the first-second frame of a new
  journey; the legend names Escape; no teaching string in the seven files
  names a key when `sysIsTouch()`.
- `qa/rv-arrive.js` from Sydney and from Cappadocia: nineteen frames each, no
  frame with the boom under 8 m, no bubble over the paper, Monte Carlo at
  9.5 s with `chicane` false.
- `qa/rv-board.js`: 160 after six round trips. A forced NaN in `musIntensity`
  and in `camYaw` each survive one frame with the HUD drawn.
- `game.sayAudit()`: `wary`/`incident` pools of 10 in a locals chapter; a
  `sayBubble` call creates nodes; Monte Carlo's watchers face the rider.
- `.start(` in `noiseMake` carries an offset; the footfall gate names
  `capySliding`; `musDrum` has a writer in the 0.3 s block; the crossing moves
  `musDuckG`.
- `npm test` green; the 19/19 soak clean on both laps; frame time within
  0.5 ms of today in every chapter; `web-design-guidelines` run against the
  changed HUD block; `playwright-cli close-all` run last.
