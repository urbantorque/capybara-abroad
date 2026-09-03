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

### Batch D5 — the water's edge (area 5)

**LANDED 3 Sep 2026.** All five items. Contract section **THE WATER'S EDGE —
D5**; instruments `qa/d5-shore.js`, `qa/d5-glow.js`, `qa/d5-wet.js`, plus
`game.shoreAudit()` and `weather.ringAudit()`.

- **`shore` is an option on `grain()`**, not a mesh: every grained fragment
  already carries its world position and a chapter's waterline is one shared
  float, so `uShoreY - vGrainW.y` buys a soak, a depth tint and an animated
  lace for no draw call and no new program (107 in Palawan, Antarctica and
  Venice, the same in all three). Measured as the fraction of the frame it
  paints, against an A/A noise floor: **palawan 42.7 %, iceland 9.9 %, venice
  1.9 % at low tide and 21.5 % under the acqua alta, quay 0.75 %, antarctic
  0.40 %** — and **manly and sydney 0.00 % with zero shored materials**, which
  is what the controls are for.
- **It is `venWet` generalised.** Venice had run this exact difference through
  a wet band and a STATIC 0.11 m rim since chapter 10 — its own private hook,
  varying, uniform and cache key — and the review still counted its `foam` at
  zero, because a waterline that does not move is a contour. Same numbers, one
  hook, and the tide drives it through the `waterLevel` that module already
  rewrote every frame: 61 distinct values from −1.30 to +0.95.
- **The rain lands.** Twelve rings on one instanced cylinder in `weather.js`,
  one draw call and only while it is raining: 6–10 a second in a 6 m disc round
  the ANIMAL, measured at **9.0/s** at `rainT` 0.69, each on the live water
  surface, the terrain, or the animal's own foot height when it is standing on
  a deck.
- **A wet floor stretches a light toward the eye.** The spill's falloff
  measures an anisotropic distance — the component along the view azimuth
  divided by `1 + 2.4·wet` — so Mong Kok's neon smears vertically instead of
  pooling. Behind one uniform branch, and bit-for-bit the old `length()` when
  dry (`qa/d5-wet-kowloon-dry.png` against `-wet.png`).
- **`EMIT_OVER` 1.45**, with `matEmit`/`emitSet` replacing the same emitter
  constructor six chapters had each written out. Göreme's threshold 0.46 →
  **0.78** and its `wide` 0.58 → **0.42**: `qa/d5-goreme-before.png` is a
  square under a milky veil and `-after.png` has its paving slabs back with the
  lamps still glowing. Above-0.90 luma 0.07 → 0.22 %, above-0.75 0.23 → 0.24 %
  — the same amount of frame is bright and it has moved onto the sources.
  Sydney, the control, does not move.
- **Manly untouched**, to the character.

**Four things this batch found rather than fixed.**

1. **`biome.switchTo` does not arrive at a chapter, it starts arriving** — the
   grade, the airlight and the hemisphere damp in over about eight seconds. A
   probe that settles for three measures the previous chapter's atmosphere, and
   it looks exactly like a feature decaying: twelve consecutive samples in
   Antarctica with nothing moving read 0.88 down to 0.01. Every station in
   `d5-shore.js` settles for ten seconds now, and every future picture probe in
   this repository should.
2. **A shore probe that moves `waterLevel` is measuring the props.** It also
   moves buoyancy, the swim threshold and the underwater camera, and the first
   run read 0.42 % of the frame in MANLY, which has no shore term in it.
   `game.shoreAudit(y)` is a render-only override so that it cannot.
3. **The `blown`/`lit` luma metric cannot hold a line in a chapter with a big
   flat sky.** Hanoi read 21.2 %, then 8.8 %, then 19.4 % lit across three runs
   and Monte Carlo 13.6, 12.3 and 4.4 — the last two runs being the same code.
   At a fixed 0.75 cut a sky sitting near that value flips tens of thousands of
   pixels on a passing cloud. Göreme held 0.22 / 0.24 across every run after the
   change, which is the only row the threshold moved in.
4. **In Antarctica the waterline is the dark half.** A white lace on snow under
   the highest bright-pass threshold in the game is invisible — the albedo
   ceiling, again — so it is a deep soak with a whisper of lace on top, and it
   is still the weakest row in the table. Written down rather than chased.


### Batch D6 — the frame (area 6, first of two sessions)

**LANDED 3 Sep 2026 — nine of the ten items.** The tenth, the diegetic exit
board, is the second session and stays on the shelf below. Contract section
**THE FRAME — D6, FIRST HALF**; instruments `qa/d6-frame.js` and
`qa/p7-tokens.cjs`, which grew a motion column and now reads `index.html`.

- **Motion is a token.** 13 un-named curves across 18 uses and 37 durations
  across 102 → **four named curves and three durations**, with the rule that
  decides which things get one: *a curve is a claim about mass*, so colour and
  opacity stay on plain `ease` and anything that MOVES takes one of the four.
  Measured after: **0 un-named curves**, 7 un-named durations at or under .55s
  (a touch press, two delays, a linear knob, the picker's stagger), and 13
  story beats over .55s listed separately and deliberately left.
- **The journal and the pause card are dealt**, on `mGlide`, each keeping its
  own rotation. They were the two most-opened cards in the game and the only
  two with no entrance at all.
- **The pen moves.** The tick is a stroked path on `pathLength=1`, measured
  1px → 0.559 → 0 through a tick landing; the strike is a clip inset, 90 ms
  behind it, at constant weight on any row width, anchored half a line down so
  it strikes the first line rather than the gap between two.
- **Nine glyphs, one dialect.** `chev` (four rotations: `▸ ▾ ← →` and every
  arrow keycap), `clock`, `speaker` + crossed, and the six verbs that were
  words in circles. Measured live: **0 Unicode used as a picture** in the HUD
  and on the title card, 74 glyphs drawn, 0 stroked icons that are not the pen.
- **`toast(text, kind)`** with `say` (the default — 140 of the call sites are a
  sentence somebody would say), `note` and `last`. Stack capped at **3**, and
  the ledger takes the last word: six toasts leave 3, opening the ledger leaves
  0, two raised over it leave 0.
- **Four UI sounds** from four existing synths — `pop`, `rustle`, `tick`,
  `clink` — on one delegated listener, detents on a step rather than a pixel
  (11 over a full sweep), gated on calm (0 played, 2 suppressed).
- **The pause card keeps its native controls** and loses the Material speaker
  and the platform's `accent-color` checkbox.
- **The boot card is the title card's paper**, with the ornament breathing
  where the spinner was — and `p7-tokens` reads `index.html` now so the
  hand-copied recipe cannot drift: 2 radii, 5 type sizes, 2 shadows, 0 colours
  that are not the card's.
- **The masthead is cut**: fifteen letters on a 2.6-stem grid, 65 shapes, 0
  strokes, still an `<h1>` with the words in it.

**Four things this batch found rather than fixed.**

1. **`vector-effect:non-scaling-stroke` moves the dash pattern into screen
   units and bypasses `pathLength`.** `stroke-dasharray:1` then means one
   PIXEL, and every unticked task in the chapter was wearing a dotted line. It
   measured clean — `getComputedStyle(...).strokeDashoffset` is the DECLARED
   value and says `1px` whatever the renderer did with it — and the
   phone-width screenshot is what caught it.
2. **`getComputedStyle` on the frame a class lands returns the OLD value.** The
   entrance check read `dealt:false` on three cards that are all dealt.
3. **`document.querySelector('button')` in a probe finds the boot card's *Try
   again*, whose handler is `location.reload()`.** The run died on "Execution
   context was destroyed" three sections later and it read as a harness fault.
   Scope every selector to `#hud`.
4. **The title card is torn out of the DOM when the game starts**, so anything
   measured about the masthead or its footer must be measured before the first
   chapter key.

**Known and left:** the seven un-named short durations above are each a
measured one-off and are reported rather than snapped; and the strike crosses
the FIRST line of a wrapped row rather than every line, which is a strict
improvement on a bar that used to land in the gap between two but is not the
same as one strike per line box.


### Batch D6b — the door is an object (area 6, second of two sessions)

**LANDED 3 Sep 2026.** The tenth item, and the only one in area 6 that was not
on the paper. Contract section **THE DOOR IS AN OBJECT — D6, SECOND HALF**;
instruments `qa/d6-board.js`, `qa/d6-probe.js`, `qa/d6-open.js`,
`qa/d6-sheet.cjs`.

- **There is something standing at the door now, in all nineteen.** One builder
  in `shared.js`, three mounts — posts, a stone stele, a hanging beam — and a
  table of nineteen dressings in `systems.js`, planted from `way` rather than
  from nineteen new constants, because the door already knew where it was. Four
  draw calls whatever the dressing; one material for all nineteen, so the
  colours are in the vertices and nineteen boards are one program.
- **It is a departures board and it has no words on it.** Six rows of
  split-flap tiles with a colour chip at the head of each, and the chip is that
  destination's own `sysMARKS[biome].tint` — the same wash that backs its tile
  on the picker. A row for a place you have finished flips between the paper
  white and the gold; one for a place you have not flips between two slates.
- **A tile turns over about every 2.4 s**, only within 26 m, never behind a
  card, never under calm, with the clack rationed by distance inside 15 m.
- **The card comes out of it.** Three wheeks buys 0.86 s of camera — the same
  `frameShot` every marquee asks for, killed by a hand on the lens — and the
  departures card then grows from the board's own position on the screen, with
  the origin following the board while it grows. Measured: 28 px, at rest.
  Everything about it degrades to the card as it was: no board, a board behind
  the lens or more than 15 m off, calm on, or Tab.

**Three things the numbers could not have found, and the photographs did.**

1. **The Corso's door is inside a building.** Chapter 3's `way` is the literal
   (118, -586) and a grid of downward rays says there is a chip shop on it. The
   arrow has pointed through a wall since the chart was drawn and nothing could
   see it, because the exit ZONE is the whole street. The board stands on the
   open Corso; the chart's own mark is left alone.
2. **The board stood on the roof of a surf shop for one round.** The drop test
   read the door's floor by dropping from three metres above the board, which
   on the Corso is above the awnings. It reported 5.65 with total confidence.
3. **Sydney's door has a roof over it** — the exit zone is the footprint of the
   wharf shelter. The board is under it now, on a low mount with no hood, 2.37 m
   beneath a 2.70 m soffit, which is where a ferry timetable lives on a real
   wharf.

**And the thing this batch is really about: there is no general answer to
"what is the floor here".** Two rules, opposite failures, one chapter apart —
*lowest surface at or above the terrain* puts the Uji board in the river,
*highest surface* puts the Sydney board on the shelter roof. Fourteen of the
nineteen doors are a built thing rather than ground, so the automatic rule
holds the open ground it was written for and the eight built doors carry their
deck height as a measured number.

**Known and left:** two boards stand further from their door than the 2.2 m the
rest do — Hong Kong's at 15.9 m and Antarctica's at 22.6 m — because the
published point is past the end of the pontoon in one and at the seaward head
of a 2.6 m-wide jetty in the other; both are inside the zone the three wheeks
are answered in. And the drop test cannot see furniture: Manly reads 2.03
because it lands on a flag pole and the Corso reads 47.15 because the animal
bounces off a shopfront and is rescued. Both are correct in the photographs.


---

### Batch D7 — world life, the systems (area 3, second of two sessions)

**LANDED 3 Sep 2026.** All five, and the roadmap was wrong about one of them
before a line was written. Contract section **WORLD LIFE — D7**; instruments
`qa/d7-life.js`, `qa/d7-anchor.js`, `qa/d7-hang.js`, `qa/d7-beat.js`,
`qa/d7-flock.js`, `qa/d7-act.js`.

- **Nothing in this game hung off anything.** `game.hang()` in `props.js` — a
  single-bone damped pendulum on a fixed anchor, pushed by the air, by a wheek
  and by the animal walking into it, with the material's own voice on contact.
  Five shapes in `shared.js` (a chime, a lantern, a sign, a strand, a windsock),
  one draw call each, and **one hanging off the header of every one of the
  nineteen exit boards** — because the board is the only point in every chapter
  that is already measured, already level, already attached to something and
  already photographed. Five of the nineteen reach far enough down to walk
  through; the other fourteen belong to the weather and the shout.
- **The air a pendulum feels is not the air a prop feels.** The props' wind has
  a 2.8 m/s floor under it so that a ferry ticket stays where the player put it,
  and that floor reads exactly 0.000 in nine chapters. A wind chime that only
  moves in the four squall chapters is a chime that is broken in fifteen, so
  `physAirNow` is the raw sum — and a hung thing can be turned by it and never
  displaced.
- **The bell comes off the campanile.** `sysAMB_AT`: forty rows across
  seventeen chapters, every one of them a key on that chapter's own published
  api rather than a new coordinate, so the muezzin is at the top of the
  Koutoubia, the burners are in the balloon field, Galeras hisses from Galeras
  and the far bell in the Drift is under the crown you cannot reach yet. An
  anchored voice is at a REAL distance — a wide near and a long far instead of
  the ring's guaranteed gain of 1 — which is the whole point: it is quieter,
  and further, and off to one side, and there is a tower on that side.
- **Everybody in this game was standing perfectly still.** `beat` on
  `addLocal`: three shapes (a work stroke, a two-handed reach, a shift of
  weight), forty-three people in seventeen chapters, each one chosen because
  the chapter's own line already said what they were doing — the cleaver, the
  ladle, the broom, the potter's wheel, the barber's scissors, the chisel, the
  net. Outranked by everything, jittered per person, stretched by the calm, and
  abandoned rather than paused when something interrupts it.
- **Something follows food now.** `game.flockOffer` — two independent channels
  on the herd's own `count`/`at`/`put` contract, because it is the same
  question. A dropped edible pulls up to seven birds into a ring round it; a
  RUN through a flock puts it up. Venice, Manly and Cappadocia, and Manly is
  the one that matters: a chapter with a chip shop, a task about chips and
  thirty gulls on the parapet above it, in which no gull had ever noticed one.
- **The hour moves.** `sysACT_LIGHT` — a one-way lerp of a chapter's grade and
  airlight toward a second row as its acts go by, over about six seconds, in
  seven chapters. Monte Carlo gets later; Sơn Đoòng gets darker and mistier as
  you go in; Venice goes flat and silver as the water comes up; Reykjavík walks
  out of a lit town onto an empty lava field under an aurora.

**Four things that were not what the roadmap said.**

1. **There are no five one-person chapters.** Measured first: the smallest cast
   in the game is six and the largest is thirteen, and the only two chapters
   with no `locals` at all are the two with a `humans` cast instead. That line
   was written against a state P5 had already fixed. What is true is bigger:
   every one of a hundred and fifty people was doing nothing at all.
2. **The train was already off the line.** Hanoi's horn and Kyoto's bell were
   both already positional through their chapters' own cue helpers; what had no
   source was the AMBIENT ladder over the top of them, which is what
   `sysAMB_AT` is.
3. **Eleven chapters must not get an act light, and four of them for a reason
   that would have broken something.** Göreme runs its own clock and sunrise,
   Marrakech its own dusk and storm, Palawan's second act is underwater where
   the dive owns the grade, and the Pantanal turns over into its own evening —
   a delta on top of any of those is two writers on one look. The other seven
   chapters' acts are about place and not about time.
4. **A chapter that builds its `addLocal` call field by field drops anything
   new you put in its table.** The Drift does, so two beats were dropped in
   silence and read exactly like a system that does not work.

**Measured.** 19/19 hung things planted; the air moves them 0.009 to 0.464 rad
over eight seconds, one wheek 0.087 to 0.486, and walking through one 0.77.
Forty-three people with a job in seventeen chapters, and 174 completed strokes
over a 45 s park in each. Forty ambient anchors, 40 of 40 resolving to a point.
The act light walks 0 → 0.496 → 0.996 across three movements, and the corners
of Monte Carlo move 7.6 of 255 between its first act and its last, Sơn Đoòng's
16.9. R10 soak: 19 rows, 0 NaN, no console errors, no orphaned bodies.

**One inverted sign, three times.** The bob of a group rotated by (ax, az) sits
at (+len·sin az, −len·cos, −len·sin ax), so +X wants az up and +Z wants ax
down. Written the intuitive way round, the wind, the wheek and the contact were
all exactly inverted and all of them self-consistently: the lantern leaned into
the wind and swung towards whatever shouted at it, smoothly, and looked like a
feature.

---

## The shelf — sized, not scheduled

**D8 — the body, second half** (area 2, ~12 h). The climb pose on
`capyClingT`; the condor hang (flail 1.2 s, then trailing legs and a slow
sway on `carriedBy.hold`); the capybara's face — two brow boxes and a
`capyMood` with the crowd's asymmetric damping, driven by whiff, refuse, wheek,
loaf and the fall; `rec.gest` read by `animHuman` so the instanced crowds
gesture when they speak; the Pantanal herd split into body and two leg-pair
instanced meshes.

**D9 — housekeeping** (area 7, ~4 h). **LANDED 3 Sep 2026**, all nine.
Contract section **HOUSEKEEPING — D9**; instruments `qa/d9-clock.js`,
`qa/d9-audio.js`, `qa/d9-rush.js`.

- The `sfx()` comment said eleven `force: true` and there are 31. Corrected,
  and not restated as a number.
- **The `nextIn` audit exists**, and it found the two missing hooks: Sydney's
  ferry and Pasto's carroza — the two OLDEST chapters, and `ferry-ride` is the
  first task in the game that asks you to wait. Both now count down and hold at
  0 through the window. There is no sensible "default": a window is a fact
  about a chapter's own machinery.
- **ω×r measured and NOT built.** Every mass-0 body big enough to stand on, in
  seven chapters, 900 samples each: **every reading 0.000**. The decks in this
  game translate along a path and their colliders never turn. The only mass-0
  bodies that rotate at all are three in Monte Carlo (2.27 rad/s) and nobody
  stands on those. Do not re-propose without a carrier that turns.
- Pasto's three `setTimeout`s are on the frame clock.
- **The rush bed** is the weather bed's fifth voice, off the animal's own
  velocity: 0.831 at 23.1 m/s falling in the Drift, and 0.031 — 0.0001 of gain
  — sprinting across a lawn. Its floor is 9.0 and 6.5 was measured as too low.
- **The voice ceiling**: twelve starts in 165 ms, below the per-name throttle
  and below the distance cull. One drop in the first minute of chapter one, ten
  of twenty on a synthetic cascade.
- README module table 13 → 27; the journal shelf's "seventeen" corrected in
  both documents; `package.json` 0.60.0; and a note at the top of `CONTRACT.md`
  saying how to read a number in a dated section, because most of the remaining
  "seventeen"s are true sentences about August.

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
