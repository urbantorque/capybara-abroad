# The delight pass — what stands between "finished" and "AAA"

Written 3 Sep 2026, after P1–P8 (`ROADMAP-POLISH.md`) closed the polish list.
This review was six independent read-only passes over the tree — the picture,
the animal's body, world life, feel and camera, the frame, and an audit of every
"left / spill / not landed" line in the two previous roadmaps — plus two live
measurements: fifteen rest frames entered through the picker key
(`qa/rv-shots.js`, the `qa/rv-*.png` set) and a paired shadow A/B in four
chapters (`qa/rv-shadow.js`). Everything below cites a symbol or a PNG; line
numbers in `systems.js` move by the thousand between batches, so grep for the
name.

The headline: **the systems are all there and half the wires between them are
not.** The rig can dolly and never does for a payoff. The ceremony asks for a
freeze and the gate refuses it. The shadow filter is contact-hardened and the
shadow it hardens is 29 levels deep. The witness chain — the most Goose-Game
thing in the game — runs in two chapters of nineteen. Nothing here is a new
system; almost everything is one function reading a number another function
already publishes.

Seven areas, ordered by what a player sees first. Four batches take the top
slice of each; the shelf holds the rest, sized. Every batch is 2–3 h, one
commit, verified with the headless harness (`headless-qa-harness` in memory)
and judged from rendered PNGs. P1 proved a paired A/B inside one session is the
only verdict worth having; every "verify" line below is that shape.

---

## Two numbers first

**The shadow is a tint.** `qa/rv-shadow.js` renders the resting frame, reads
the pixels, switches `sun.castShadow` off, renders and reads again, in one JS
turn. The fraction of the frame that changed is how much of it is shadow; the
mean lift where it changed is how deep that shadow is, in levels of 255:

| chapter | frame in shadow | depth (levels) | frame mean |
|---|---|---|---|
| sydney | 10.9 % | 29.4 | 152 |
| kyoto | 42.0 % | 26.9 | 108 |
| venice | 13.0 % | 25.2 | 164 |
| sahara | 6.1 % | 31.1 | 174 |

Sydney's lawn at 152 with a 29-level shadow is a 19 % drop; the lighting
comment in `systems.js` ("fully lit ~1.2 albedo, open shade ~0.47") promises 60.
The machinery is right (2048², contact-hardened PCF, texel-snapped follow); the
*ratio* is wrong, because `hemi` 1.35 + `amb` 0.12 + `fill` are unshadowed and
a shadow can only remove the sun's share. Manly (`rv-manly.png`) is the frame
that shows what the other eighteen are missing, and it gets there by a low sun,
not a different shadow.

**The sky is two colours.** `sysSkyPaint(hz, top)` reads only the vertex's
normalised Y. No azimuth term, so the sky is the same in every direction — no
warm lobe toward the sun, no horizon band, no disc, no stars outside the Drift.
`sysSKY_OWN` exempts four chapters; the other fifteen get the bare ramp. In
`rv-palawan.png` and `rv-rio.png` the sea and the sky dissolve into each other
and the horizon is gone. The top quarter of most frames in this game is empty.

---

## The seven areas

### 1. Depth — the picture is lit and not shaded

- The shadow ratio above. `sysInstallShadowFilter` is the one injection point
  shadows have and it is already patched; the missing term is a scale on the
  hemisphere/ambient irradiance by `mix(1, uShadowSky, 1 − shadow)`, one number
  per chapter (about 0.55 in the noon chapters, 1.0 in overcast and night rows
  so Kyoto's rain and the cave are untouched by design).
- **Reach.** `sysSHADOW_HALF = 22` is a 44 m box centred on the animal. Rio's
  parasols (~28 m) and Venice's colonnade are outside it; `shadowFitBiome`
  already swaps depth per chapter and could swap width.
- `sysSkyPaint` needs three vertex terms on the dome that already exists: a
  `dot(dir, sysAxDir)` warm lobe, a 4–10° haze band above the horizon, and the
  Drift's 300-star field lifted into a shared, chapter-gated child for the
  night rows. A sun disc only where the sun is in shot.
- **Twelve chapters have no authored air.** `sysAIR` has five rows; the rest
  fall through to the Sydney↔Pasto fog lerp. `rv-sahara.png`: near sand, mid
  stalls and the far arcade in thirty levels of one orange. This is the fog
  *distance*, not the grade — P1 measured the veil and left it, and this does
  not reopen that.
- The sun is fixed for a chapter. `sunAxes` is called on biome change only, and
  the comment at the top of `systems.js` about the sun "drifting to golden hour
  as the list gets ticked" describes something that does not run. Sahara's and
  the Pantanal's one-way `dusk()` prove the act-gated version works and looks
  good; Monaco's casino windows and Kowloon's neon rising are the next two.

**AAA principle:** shade is a value, not a tint; the sky has a sun in it; depth
is authored per place.

### 2. The body — good bones, four wrong numbers

- **The feet skate at every speed except a sprint.** `gaitRate` is derived from
  the constant `capySTRIDE = 0.62`, but the swing amplitude is speed-dependent,
  so the real half-stride at 1 m/s is ~0.20 m against a claimed 0.62 — cadence
  3× too slow, ~0.4 m of slide per step, worst at the creep-up-on-a-picnic
  speed. `paMove` in `npc.js` already derives stride from the actual swing
  (`2 · legL · sin(amp)`); the fix was written for the crowd and never brought
  back to the animal.
- **The hop has stretch and no crouch.** Takeoff seeds `capyPop = +0.30` on the
  frame the velocity is applied. Seeding `−0.16` with a positive velocity puts
  the anticipation *inside* the existing k=300 spring — real, on the input
  frame, collider untouched.
- **Lean is speed, not acceleration.** `leanTarget = gaitSpeed × k`, so a stop
  fades rather than dipping over the front feet, and a deck turning under the
  animal (the ferry, the floes, the raft — `frameVX/VZ` already carries them)
  moves a statue. The tail is built and never rotated by anything.
- Climbing has no pose (`capyClingT` is declared "for the pose" and never
  read; the air tuck plays against a wall). The condor ride uses the gardener's
  two-second flail for a minute. Digging and the carried branch write leg
  rotations directly and snap. `capyHelmPose` stands down eleven channels and
  not the sniff, the ear turn, the whiskers or the nose pad.
- The crowd has a face (P5); the star does not — one static brow box, and a
  stack of authored state (`capyWhiffT`, `capyRefuseT`, the loaf, the fall)
  drawn nowhere above the neck.
- The Pantanal herd is one merged instanced mesh with a fixed 8 rad/s bob:
  nine legless capybaras across the chapter's own photograph.

**AAA principle:** contact, anticipation, follow-through — the three things a
procedural rig can do for free and this one does not yet.

### 3. The world answers — reaction lives in two chapters

- **Barging a person produces nothing.** `capybara.js` gates the bonk on
  `other.mass === 0`; walkers are kinematic, not static, and fall through to no
  sound, no punch, no flinch. In a Goose Game the barge *is* the verb.
- **`npcWitnessChain` opens with `if (live !== 'sydney' && live !== 'pasto')
  return 0`.** One person jumps and the next one turns to look — in two of
  nineteen chapters. `localsReact` already picks the loudest reactor and every
  local already has the flinch spring and a chat-look.
- **Five chapters have zero swaying material**: `grep -c sway` gives Venice 0,
  Quay 0, Monaco 0, Manly 0, cave 0. Manly is one of the windiest rows in
  `wxMOOD` and its Norfolk pines are rigid. `swayMesh` is one call per mesh.
- Nothing hangs and nothing swings — no wind chime, shop sign, washing line,
  bell rope, beaded curtain. The game has a wind field, a wake shader and a prop
  system, and nothing suspended for any of them to act on.
- Wildlife reacts in three chapters (Venice pigeons, Kyoto cormorants, the
  ibises) and decorates in the rest; nothing follows food.
- `placeHeat` has one consumer (the score). A square that has had enough of
  you does not talk more, glance more, or empty of birds sooner.
- The ambient ladder fires one sound from a random ring point; a bell has no
  campanile, a train has no line — while `kyoUpdateBell` and `hanUpdateTrain`
  draw both.

**AAA principle:** the second-order reaction is the joke; every place answers a
bang with a look, and the wind finds something to move in every chapter.

### 4. The payoff the code promises

- **The chapter ceremony gets no freeze.** `sysPUNCH_MIN = 0.55` is a fraction
  of `sysSHAKE_MAX` (0.34), i.e. an absolute floor of 0.187. `chapterCeremony`
  calls `punch(0.18)` → m = 0.53 and a marquee calls `punch(0.14)` → 0.41.
  The comment above the constant says both "do stop the world". Neither does;
  Hanoi's passing train (`punch(0.32)`) does.
- **Shake has no distance term** in 102 of 106 call sites, and `prop:impact`
  punches on any prop over 4.5 m/s anywhere in the world — a cascade behind a
  building shakes the lens and rumbles the pad.
- **`capy:land` has one listener** (dust). The most repeated verb in the game
  lands with no lens response; `fovKick`'s integrator is the spring to drive
  a dip and it is three lines away.
- The ceremony is ten seconds of paper and audio. No camera move, and nothing
  in `npc.js` listens for a chapter close — the P5 head aim exists and nobody
  turns to look.
- Every arrival is `frameShot` on a pinned bearing — a still that eases out.
  Departure has no ceremony. The rig can lerp `dist` and `pitch` by `shotW`
  already; an arrival dolly is a second key on the same lerp.
- No roll anywhere: `camera.rotation.z` appears zero times. A condor bank and
  a dune slide render dead level. Gate it on `flyT`/`capySlideW` only, and on
  `sysCalmOn()`.
- The title is a keyboard legend over a blurred still with no capybara in it;
  every idle camera behaviour is gated on `started`. The picker sells the game;
  the title card sells the controls.

**AAA principle:** the biggest moment in a chapter is the biggest thing the
camera does in it.

### 5. The water's edge

- `grep -c foam`: Manly 34, Rio 15, Quay 6, **Palawan 0, Venice 0, Antarctica
  0, Iceland 0.** No shore lace, no wet-sand darkening, no depth tint;
  `rv-antarctic.png` floes sit *on* a flat grey wash rather than in it.
  `grain()`'s fragment injection already knows world position and the water
  plane height; a `shore()` sibling to `sparkle` is uniforms on materials that
  exist.
- **Rain is drawn in the air and never lands.** 340 streaks, a good wet-surface
  half, and `splash()`'s only consumer is the audio bus. P7's landing ring pool
  is the pool for it.
- Wet reflections are painted ellipses (`rv-kowloon.png`) — the chapter whose
  subject is neon on wet asphalt has no vertical smear. An anisotropy factor
  on the spill, gated on `uGrainWet`, comes free in Venice and Monaco.
- Bloom is one threshold per chapter and cannot serve a lantern and a road
  marking at once (`D45-13-goreme`, `D45-11-kowloon`); an over-white emissive
  on the emitters, as `sparkle` already does, stops asking the threshold to
  find them.

**AAA principle:** water has an edge, rain has a contact, wet has a smear.

### 6. The frame — the controls inside the paper belong to a different product

- The boot card in `index.html` is a self-contained mini design system with a
  rotating ring spinner; on a slow connection it is the only screen.
- The pause card is a web settings dialog printed on paper: native range
  thumbs, a native checkbox on `accent-color`, a stroked Material speaker in
  a game of filled polygons. Keep the native inputs; re-skin only.
- Motion is the one axis P7 did not tokenise: 13 distinct `cubic-bezier`s
  across 18 uses, ~24 durations across 55 transitions, five overshoots nobody
  can tell apart — and the two most-opened cards (journal, pause) have **no
  entrance at all** while the souvenir and moment cards arrive on a spring.
- The tick is `content:"\2713"` scaled from zero and the strike is a `<div>`
  bar. 231 tasks, and the pen never moves.
- **The frame is silent.** Zero UI sound: no tile press, card open, fader
  detent, focus move.
- `.capyui-toast` carries a task tick, a find, a door line, a control hint, an
  autosave notice, and the last three sentences of the game
  (`qa/p7-ledger.png`: four pills stacked over the ledger).
- Three iconographic dialects (the marks' filled polygons; a stroked UI-kit
  speaker; Unicode `◷ ▸ ▾ ✓`), and the touch fan is six words in circles.
- Nothing in the UI is in the world; the Kyoto machiya builds real signboards
  and leaves them blank. The exit board is the one diegetic element that pays.
- Typography: one system face at 400/700 for all nineteen jobs. The masthead
  can be SVG lettering (`sysBuildMark` already builds polygon SVG) with no
  licence question; `font-variation-settings` buys a middle weight where the
  platform has one.

**AAA principle:** the paper is right; the marks on it, the controls in it and
the silence around it are not yet the same product.

### 7. Under the hood — the audit of what the last two roadmaps left

Verified from code, not docs (`shelf audit`, 3 Sep):

| item | status |
|---|---|
| condor flap text, Hanoi fold gate, `nextIn` ×6, ghost keep 24, incident count saved, underwater bus, per-room interiors, rumble on calm, `matchMedia` listener, `K then Enter` gate, `npm test` | **done** |
| minimap underlay | **partial** — a per-chapter relief bake exists; only authored art is absent. Do not re-propose "no underlay". |
| Göreme sunrise | **partial** — window unchanged (~11 s / 156), clock shown via `nextIn`. |
| canopy dissolve, veil re-grade, chapter eviction, halving grain, ink outline | **rejected by measurement** — do not re-propose |
| speed streaks, photo poses/self-timer, touch fan coins, children in Rio/Manly, ω×r, Pasto timers, arrival `look` anchor, "all of it" endgame, flight/slide wind audio, polyphony cap, ambience rows for Drift/Iceland/cave/Manly, `placeHeat` card, loaf purr, HUD floors, README table (13 of 27), `CONTRACT.md` "seventeen", `package.json` 0.52.0 | **not done** |
| the `sfx()` comment says eleven `force: true`; there are 31 | **false comment** |
| `nextIn` has no default and no audit: 13 chapters silently never show a clock | **contract gap** |
| vendored face, LICENSE, host | **owner's** |

---

## The batches

Each 2–3 h, one commit, verified against `dist/` as well as the dev server (P8
found they are different programs). Every batch names what must land and what
spills, because R4, R8, R9 and P5 all ran long on the same estimate.

### Batch D1 — depth: the shadow and the sky (area 1, area 5's cheapest line)

**LANDED 3 Sep 2026.** All three must-lands. Shadow depth in levels of 255:
sydney 29.4 → **39.6**, venice 25.2 → **44.5** (and its shadowed fraction 13.0 %
→ 23.3 %, which is the campanile arriving), sahara 31.1 → **34.3**, kyoto the
1.0 control 26.9 → **27.2**. The sky's horizon band measures +0.108 to +0.230
linear luma against mid-sky in five chapters and its lobe +0.018 to +0.067 at
the sun's own elevation. Rio's shadow half is **44**, not 34: at 34 only the
near parasol casts. Contract section **DEPTH — D1**.

Two things the batch found rather than fixed. The 45–60 target **is not
reachable with this lever** — the whole indirect share of Sydney's frame is
about 15.6 levels, so even a sky factor of 0.0 tops out near 45, and the grade
and airlight eat the rest; the remaining lever is the `fill` light, which is a
DirectionalLight and cannot be told from the sun inside `RE_Direct`. And **the
boot chapter never fires `biome:enter`**, so chapter one silently kept the
neutral 1.0 while the other eighteen took 0.45 — every future per-chapter light
number has that hole.

Spill, unchanged: the star field; `sysAIR` rows for the twelve; rain rings.
Added to the spill: **the four chapters that own their sky** (`sysSKY_OWN` —
sydney, drift, göreme, cave) get neither the lobe nor the band, and Sydney is
the chapter a player sees first.

**Must land.**
1. A sky-occlusion term in `sysInstallShadowFilter`: hemisphere + ambient
   irradiance scaled by `mix(1.0, uShadowSky, 1.0 − shadow)`. One uniform,
   a per-chapter table `sysSHADOW_SKY` beside `sysBIO_SH_RAD` — 0.55 for the
   sunlit rows, 1.0 for Kyoto, the cave, Iceland, the Drift, Antarctica's
   overcast. Bind it where `matSelf`'s uniforms are bound so every material
   gets it.
2. Per-chapter shadow width: a `sysBIO_SH_HALF` row swapped in
   `shadowFitBiome` alongside depth; Rio and Venice at 34, everything else 22.
   Recompute `sysTexelX/Y` from the row or the texel snap in `sunFollow`
   shimmers.
3. `sysSkyPaint` gains the warm lobe and the horizon band. Vertex colour on the
   existing dome; repainted only on change; zero draw calls.

**Spill, in order:** the shared star field for night rows; `sysAIR` rows for
the twelve chapters without one, each `fogN/fogF` read off the chapter's own
`far`; rain contact rings on P7's ring pool.

**Verify.** `qa/rv-shadow.js` before/after in the same four chapters: depth
must move from ~28 to 45–60 levels in Sydney, Venice, Sahara and stay within
±2 in Kyoto (the 1.0 row is the control). Re-shoot `rv-rio.png` and
`rv-venice.png` at the same stations — four parasol ellipses on the sand, and
a crowd with feet. Crane the rig up in Rio and Kyoto and shoot: the sky must be
brighter toward `sysAxDir` and carry a band at the horizon. Bloom and exposure
unchanged: `sysGRADES` untouched.

**Trap.** The grade's S-curve and the airlight both sit downstream and will
eat part of the deeper shadow — measure after the composite, not in the
shadow term. And the night chapters must be in the table at 1.0 *before* the
uniform exists, or the cave goes black on the first frame.

### Batch D2 — the body: stride, crouch, lean (area 2)

**LANDED 3 Sep 2026.** All three must-lands, `capy.animAudit()` first.
Contract section **THE BODY — D2**; instrument `qa/d2-skate.js`.

The skate was **0.457 m per step at 1 m/s**, 0.144 at a walk and zero only at a
sprint — the constant was right at the one speed the game is loudest at. The
ceiling had to move with it: the derived cadence asks 41.2 rad/s at a sprint
against the old clamp of 34, so `capyGAIT_MAX` is 48. Cost: footfalls 6.8 → 8.8
per second at a walk and 10.8 → 13.1 at a sprint, and `sfx()` still has no voice
cap (D9). Lean rides +0.214 flat out (unchanged) and reaches **−0.109 for
0.61 s** on a stop. The ears whip 8.5° off a 4.94 m/s difference.

**The crouch is a frame and a half at 60 Hz and one spring cannot do better** —
the zero crossing wants a small seed velocity and the stretch peak wants a large
one, and ζ = 0.26 takes 40 % off whatever the algebra promises (8.0 was measured
after the closed form said 6.8 and the rig drew 0.238). A true anticipation
means delaying the impulse, which is 50 ms of jump latency; not bought.

**The tail is measured, not built** — it is a 5.5 cm blob pivoting on its own
centre, so rotating it moves nothing at nine metres. Off the spill list.

Spill, unchanged: the dig and carried branches onto a damped weight in the leg
lerp chain; `capyHelmPose` standing down the sniff, ear turn, whiskers and nose
pad.

**Must land.**
1. Stride from the swing, not a constant: hoist `swingAmp` above the cadence
   block and `stride = 2 · capyLEG_R · sin(swingAmp)` with `paMove`'s small
   floor; drop the 2.6 rad/s minimum. Footfall sfx and `capy:step` ride the
   same phase and get correct timing for free.
2. The hop crouch: seed `capyPop = −0.16, capyPopVel = +14` at takeoff. The
   existing sub-stepped spring passes through the crouch in the first ~35 ms
   and overshoots into the stretch. Then `capyEarLag` damped at 14 against
   `body.velocity.y`, a fifth of it into the whiskers.
3. Acceleration lean: `accel = (capySpeedSm − prev) / dt` clamped ±25, times
   0.010 into `leanTarget`; the same differentiated on `frameVX/VZ` at λ 6 for
   the deck, rotated into model space.

**Spill, in order:** the tail (two lines of lag off yaw rate and lean); the dig
and carried branches onto a damped weight in the leg `lerp` chain;
`capyHelmPose` standing down the sniff, ear turn, whiskers and nose pad.

**Verify.** `capy.animAudit()` — `{legPhase, swingAmp, stride, speed, lean,
pop}` — is the instrument, and it goes in first. Skate probe: hold forward at
1, 2.5, 5 and 7.4 m/s for 3 s each and integrate `|Δground − Δ(stride·φ/π)|`
per step; today ~0.42 m at 1 m/s, target < 0.05 at every speed. Hop: sample
`capySquash.scale.y` at 120 Hz — it must dip below 1.0 for 2–4 samples before
it rises above. Run→stop: `lean` must go negative for ~0.2 s and overshoot back
before settling. The 19-chapter soak, because the cadence feeds the sfx.

**Trap.** `capySTRIDE` is read in more than one place (the flow streak and the
dust rate key off cadence too) — grep it before the constant goes; and
`swingAmp` currently lives 58 lines below where the cadence needs it.

### Batch D3 — the world answers: the barge and the witness (area 3)

**LANDED 3 Sep 2026**, and two of the three must-lands were not the thing the
roadmap described. Contract section **THE WORLD ANSWERS — D3**; instruments
`game.reactAudit()` and `qa/d3-react.js`.

1. **The barge.** Not silent — *identical to a wall*. Both record shapes carry
   a mass-0 collider, so both landed in the STATIC branch and got the stone
   thud, the wall punch and the bounce off a face, while the person did
   nothing. Now its own branch at a third of the speed floor, half the punch,
   its own event, and a flinch driven AWAY from the animal.
   **And the two cast chapters cannot be barged through physics at all**:
   `npcPlaceBody` holds any `userData.npc` body off the animal by 1.30 m every
   frame so a walker cannot shove the player, and the drawn figure is not moved
   with it — measured, the animal reached 0.3 m of a Sydney collider's centre
   with zero events. They are barged on proximity to the figure instead.

2. **The witness chain was already built for the seventeen**, and the roadmap
   had it backwards: `npcWitnessChain` is the CAST chain, ported TO Sydney and
   Pasto *because* they have no `locals`; the other seventeen have had
   `locChainFrom` since v30. Measured live — `reactAudit().looking` reads 1 in
   Venice and 2 in Manly and Monte Carlo off one reaction. **Not rebuilt.**
   What was missing was an event that arms it outside a spoken line, which is
   item 1.

3. **Sway** in the Quay, Manly, Monte Carlo and Son Doong — verified by asking
   each material for its own program cache key, not by eye. **Venice keeps
   nothing**: it is a stone piazza with no foliage, and its only cloth is the
   three flags that `venUpdateFlags` has always driven.

Two placement findings for the owner: **Hanoi's nearest person is 87.6 m from
the spawn**, and Monte Carlo's nearest local is behind something the animal
stops 2.3 m short of.

Spill, unchanged: `placeHeat` fan-out; `game.lifeAudit(60)`.

**Must land.**
1. `npc:barge`: in `capybara.js`'s bonk, the `mass === 0` branch gets a
   sibling for `userData.npc`/`userData.local` — emit with speed and the
   record; `npc.js` answers with the existing flinch spring driven *away*
   from the animal, a gasp on the local's own voice (`sounds-people-make` in
   memory: with volume and position), and `punch(0.06)`. Chapters 1–2's
   mischief gate still applies to what it *counts*; the feedback is universal.
2. `npcWitnessChain` for seventeen chapters: after `localsReact`'s loop, the
   loudest reactor hands the nearest other local within `npcLOC_CHAT_R` a
   smaller `flV` kick with `flYaw` aimed at *the person*, plus a `witness`
   pool routed through `npcPLACE_SAY` so chapters can override. Keep the
   sydney/pasto cast branch; add the locals branch beside it.
3. `swayMesh` on the foliage and cloth of Venice, the Quay, Monaco, Manly and
   the cave, with the `lo`/`hi` each call site already knows. Venice's flags
   keep `venUpdateFlags`.

**Spill, in order:** `placeHeat` fan-out (three multiplications: ambient
timer, `npcLOC_LOOK_GAP`, flee radius); `game.lifeAudit(60)` — park, sample at
4 Hz, report movers, sfx, lines, and the longest window with none of them.

**Verify.** Barge: walk into a local in Venice and Hanoi — one gasp, one
flinch away, `camInfo` shake sample > 0, and no `task` change in Sydney. Chain:
drop a crate in each of the seventeen chapters and assert one second-order
`flYaw` pointing at the first reactor (`sayAudit` style, layer reported).
Sway: paired PNG at `gust()` peak in the five chapters; draw calls and
triangles unchanged (`p5-cost.js`).

**Trap.** `npc:startled` is emitted ONCE per bang because systems.js answers
it with a gasp and a chase window (`faces-and-bodies` in memory) — the witness
must not re-emit it. And a local inside its own stall AABB will flinch into
the counter; skip the kick when `flV` would cross a prop.

### Batch D4 — the payoff the code promises (area 4)

**LANDED 3 Sep 2026.** All four must-lands. Contract section **THE PAYOFF —
D4**; instrument `qa/d4-payoff.js`, plus `game.shakeNow()` and `game.camDip()`.

- **The freeze.** `punch(a, seconds)` — explicit, the floor untouched. The
  marquee and the ceremony both reach **timeScale 0.10** now; neither had a
  sub-1.0 sample before. The probe had to be fixed first: `game.time.slow` is
  the slow-motion component only and a hitstop deliberately does not appear in
  it, so the first run read the marquee's existing slowmo and would have
  reported a missing feature as present.
- **The distance term.** `punchAt`, squared falloff, `prop:impact` at 22 m and
  `prop:water` at 30. **Measured from the camera it read zero at every range** —
  the boom is 9.5–12 m behind the subject, so a crate five metres in front of
  the animal is fifteen from the eye. It measures from the animal.
- **The landing dip.** `capy:land` fires on every landing now (the old
  `fall > 5.5` gate moved onto the payload as `dust`). A 6 m fall dips **2.8°**
  and is back inside 312 ms; a flat hop is **0.000**, because a flat hop lands
  at 6.3 m/s and the floor is 6.5. `sysDIP_K` is measured, not solved: the
  semi-implicit integration draws 57 % of what the closed form promises.
- **The ceremony.** 9.5 → **15.5 m**, 41° → 19°, and `chapter:done` turns
  **11 people** to face the animal for three seconds. In Sydney the frame gains
  the sails, the bridge and the harbour (`qa/d4-ceremony.png`).

Spill, unchanged: the arrival dolly; the title orbit; camera roll on
`flyT`/`capySlideW`.

**Must land.**
1. The ceremony freeze: `punch(a, { freeze })` — explicit, and the two
   ceremonial callers pass it (`chapterCeremony` 60 ms at 0.10, the `wow`
   branch 40 ms). Do not lower `sysPUNCH_MIN`; the bin cascade was tuned
   against it.
2. `punchAt(a, x, z, r)` → `punch(a · clamp(1 − d/r, 0, 1)²)`, with
   `prop:impact` and `prop:water` wired through it off the payload's existing
   `position` (impact 22 m, water 30 m). The four hand-rolled sites stay as
   the default's proof; the other ~100 are the shelf.
3. The landing dip: emit `capy:land` on every landing with `fall` in the
   payload (it is already computed), and a critically-damped `camDip` in
   `sysCam`, seeded `−clamp(fall × 0.012, 0, 0.22)`, subtracted from
   `sysLook.y` and added to pitch — the `fovKick` integrator shape, zero below
   1.2 m so a walk is untouched.
4. `chapter:done`: `npc.js` runs the incident gather at 30 m (everyone turns
   to face the animal for 3 s on the P5 head aim), and the ceremony opens with
   `frameShot({ dist: +6, pitch: 0.18, raise: 2.2, hold: 3.0 })` — the
   pull-back the rig can already do and never uses for a payoff.

**Spill, in order:** the arrival dolly (`dist0/pitch0` on `frameShot`, 3 m in
over `sysARRIVE_HOLD`); the title orbit (un-gate `camIdleT`/`restIdleT` from
`started`, spawn the animal in frame); camera roll on `flyT`/`capySlideW`.

**Verify.** `game.time.slow` at 120 Hz through a scripted `wow` tick and a
chapter close: a sub-1.0 sample must exist in both (today: neither). Drop a
crate at 5, 20 and 45 m from a parked camera and read a `shakeAmt` getter:
monotonic. Eight PNGs over a 6 m drop with a `camInfo.pitch` trace: peak dip
2–4°, back inside 0.45 s, and 0.000 on a hop off a kerb. Ceremony in Sydney and
Venice at 0/1/2/4/7 s: NPCs facing the animal counted by the P5 face audit,
`camInfo.dist` rising then settling.

**Trap.** The ceremony explicitly declines slow-motion (`slowmo: false`) for a
reason that is written next to it; the freeze is a hitstop, not a timescale.
And `capy:land` is also borrowed by the skid (`payoff-and-hood` in memory) —
the skid must pass a small `fall` or the lens dips on every slide.

---

## The shelf — sized, not scheduled

**D5 — the water's edge** (area 5, ~10 h). `shore()` beside `sparkle` in
`shared.js`: a thresholded, `grainTick`-animated lace where
`waterY − groundY < 0.35`, a `smoothstep` depth tint on the same difference;
Palawan, Antarctica, Venice, Iceland, the Quay. Rain rings on P7's pool at
6–10/s within 6 m, rate ∝ `wxRain`. Anisotropic spill on wet ground. Emissive
over-white on lantern and neon materials; Göreme's threshold up and its `wide`
octave down. Manly untouched — it is the reference.

**D6 — the frame** (area 6, ~12 h across two sessions). The boot card in the
paper recipe with the ornament breathing where the spinner is; four named
curves and three durations beside the radii, and the journal and pause cards
dealt like the done card; the tick and the strike as stroked SVG paths
(`pathLength=1`, dashoffset 1→0); four UI sounds from synths that exist,
gated on calm; `toast(text, kind)` with `say` / `note` / `last`, the stack
capped at 3 and suppressed under the ledger; the pause card re-skinned around
its native inputs; one nine-glyph sheet in the marks' dialect replacing the
Unicode and the six words in circles; the SVG masthead. Then, on its own: the
diegetic exit board where `way` points, the departures card opening *from*
it. `qa/p7-tokens.cjs` grows a motion column and reads `index.html`.

**D7 — world life, the systems** (area 3, ~15 h). `hung` in `props.js` — a
single-bone damped pendulum on a fixed anchor, driven by `gust()` at rest and
a capybara impulse on contact, one sfx per material; `sysFlock` — chapters
register their existing bird meshes with `{home, r, fleeR}` and one update does
land/take-off, scatter on `capy:run`, drift toward food; `sysEvent` anchors so
the bell comes off the campanile and the train off the line; `addLocal({beat})`
for the five one-person chapters; `sysActLight` — a one-way lerp of a
chapter's grade/airlight row to a second, driven by act index, Monaco first.

**D8 — the body, second half** (area 2, ~12 h). The climb pose on
`capyClingT`; the condor hang (flail 1.2 s, then trailing legs and a slow
sway on `carriedBy.hold`); the capybara's face — two brow boxes and a
`capyMood` with the crowd's asymmetric damping, driven by whiff, refuse, wheek,
loaf and the fall; `rec.gest` read by `animHuman` so the instanced crowds
gesture when they speak; the Pantanal herd split into body and two leg-pair
instanced meshes.

**D9 — housekeeping** (area 7, ~4 h). The `sfx()` comment (31, not eleven);
a `nextIn` default and an audit for the six; ω×r measured on the big ship's
turn before it is built; Pasto's three `setTimeout`s onto the frame clock; the
flight/slide wind bed off `airspeed`; a global voice cap in `sfx()`; the README
module table to 27; `CONTRACT.md`'s stale "seventeen"s read one by one;
`package.json` to 0.60.0.

---

## Rejected by measurement, so not re-proposed

The canopy dissolve (P1: a fifth of one per cent), the veil re-grade (P1: no
class to cut), chapter eviction (P8: `mat()` caches across chapters), halving
the ground grain (P7: a tuned nineteen-row table), an ink outline (the one
thing the aesthetic law forbids, and the crease term ramps out of silhouettes
for that reason), textures, PBR, and a vendored font (a licence decision
before a design one).

## Already strong, so not touched

Manly's water. The two-octave world-space grain. `sparkle`'s distance death.
The contact-hardened penumbra. The DOF chain, the crease term, the split-tone,
the shoulder, the dither. The four night rows of `sysAIRLIT`. `wxKIND`/`wxMOOD`
and the locals' umbrellas. The occlusion boom with the P1 raise cut, the dive
rig, `rig()` as request-not-command. The swim rig, the loaf, the slope-pose
trust fade, the render predictor. The paper recipe and the nineteen postcard
marks. The picker. The minimap's relief bake. The z-index ladder. The
architecture of the micro-weather (a zero row that is a no-op). The one place
the reviewers disagreed with the code — the frozen hour — the code's own
comment block won the argument.

## Instruments this review leaves behind

- `qa/rv-shots.js` — the title, twelve resting frames through the picker key,
  a run, a wheek and the pause card, with `camInfo.clear`, FOV and DPR per row.
  The baseline for every "re-shoot at the same station" line above.
- `qa/rv-shadow.js` — the paired shadow A/B. D1's before/after is this file,
  unchanged.
- Two harness notes worth keeping: `renderer.info.render.calls` reads 1 after
  `tick(…, true)` because the composite's final quad is the last draw and the
  counter resets per render — count calls inside the scene pass, not after it.
  And adaptive DPR drops to 0.90–0.95 under headless in Kowloon, Manly,
  Antarctica and Hanoi, so a pixel count taken there is not comparable to one
  taken in Sydney; pin `dpr` before measuring.
