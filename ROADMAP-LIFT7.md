# ROADMAP-LIFT7 — the seventh lift (14 Sep 2026)

The brief, a seventh time: functional and enjoyable → memorable, beautiful,
engaging, in line with the top of the field; five to seven areas lifted in
detail and three to four features that change what the game is; nothing
broken. Six reviewers read the tree and PLAYED it under playwright with real
keys — game design, art and animation, audio, writing/UX, QA/performance,
and a fresh-eyes playtester who read nothing first. Their reports are the
six `review-*.md` files of this pass's scratchpad; their probes and frames
are `qa/l7r-*`. Every item below carries a file:line or a measured number
from one of them, and an instrument.

What the six agreed on, said once:

- **The first big thing in every chapter can be missed, and when it is, the
  game says nothing.** Two fresh playtesters in a row stood on the Opera
  House red and got no note — the zone is 0.35 m smaller than the carpet
  (`envZONES.operaStage` z 0–2.9, environment.js:701; the riser runs to 3.5).
  A wrong press at the marquee point is answered in 5 of 19 chapters
  (`marqueeWhy` has seven call sites, four of them the concert). Three
  clocked marquees hand a first-timer a countdown they cannot make (Kowloon
  49 m in 68 s, Göreme 70 m in 56 s) and blame them when it runs out. The
  marquee is off-screen at the arrival lens in 10 of 19 (design 2.8).
- **The most frequent sentence in the game is a shove that did not happen.**
  A sprint from standing reaches 7.4 m/s in 60 ms and trips the E1 shove
  gate (`sysIMP_V` 5.0 / `sysIMP_TAU` 0.15, systems.js:63–67): 4 of 6
  controlled trials, 7/34, 9/20 and 13/26 of every pill in Sydney,
  Marrakech and Hanoi (design 2.1). Outside chapter one, three minutes of
  honest play ticks nothing (Marrakech naive 0, follower 1; Hanoi 1 and 1).
- **The mix is a pad with a world under it.** Walking, the score sits
  9–13 dB over the whole world bus (audio 2); a startle sets `musChaseT`,
  so standing at the Sydney spawn the chase pulse runs 57 % of the time
  with nobody chasing (audio 1 — the cause of L6-5's "still state moves 4
  dB"); 0.04 % of the master's energy is above 5 kHz in Sydney; one bendir
  is the chase in thirteen chapters and the six bands have none; Hanoi's
  traffic is 722 pitch-shifted Sydney ticks; nine chapters have no bed at
  rest; the first arrival every player hears never says the tune.
- **The frame, not the light, is what stops the picture being a painting.**
  Under a cut boom the lens pitches to 36° and photographs grey boxes —
  horizon inside the top 6 % or off-frame in 29 % of an ordinary
  walk-stop-turn (Venice 32/60); a pole, awning, canopy or duckboard is
  through the animal in 12 % of samples and E1's ray only tests people
  (art 1–2, play 3); every wall is one value because the grain samples
  `vGrainW.xz` (art 3); 150 locals stand one way (torso/knee sd 0.000).
- **Each chapter's one sentence is said on five surfaces**, and the toast
  queue carries Venice's flood into Marrakech (writing W1, W2). The
  border is three whistles and a card: nothing is taken, nothing chosen,
  and a passenger travels by accident (design 2.3–2.4).
- **The machine holds and the frame does not**: zero errors across 19 × 2
  laps and 10 × 60 s of random keys, but the tick is 13–18 ms in Venice /
  Kowloon / Sydney, the governor sheds pixels when the cost is CPU submit,
  a Monaco pack car launches the animal at 34–85 m/s with "hold on." for a
  cause, and the soak diff has been green on one row for eight commits.

## The four features

### F1 · THE PARCEL — the border becomes a decision
*Bring something from where you were.* (design F1 + 2.3 + 2.4; writing B)

Nothing in 256 rows asks for a decision and nothing consumes the one thing
that already crosses a border: props.js:4887 stamps `travelFrom` on the
loose copy that follows a held thing through the white, and its only
reader is the customs remark (npc.js:14240). THE PARCEL: one row per chapter
from two onward (`needs: 'parcel'`, `anywhere: false`) — *bring something
from where you were* — ticked when a prop whose `travelFrom` is the previous
chapter's biome (`game.travelFromBiome`, or the `seen` order) is put down
inside 3 m of the traveller's cameo where the traveller stands (Quay,
Marrakech, Cappadocia, Hanoi) and the chapter's regular elsewhere; the
cameo's line names the object (*"A traffic cone. From Kyoto. Of course."* —
a line may be a function, npc.js already allows it); the notebook's entry
gains a `{parcel}` fact; the row's clue is honest for the empty-handed
(*there is always a bus back*). THE MANIFEST: the departure card
(`jrTravel`, systems.js ~27612) says what is aboard — *you are taking · a
tourist's hat · and an ibis · and a whisk* — and the price of leaving early
is printed, not hidden (*the keepsake stays here · 4 more*; today the sub is
'' by construction, 27612–27619). THE DOOR: the first time an animal is
perched and the way-on is open, one line on the perch — *it will come with
you, if you let it stay on* (`perchUpdate` ~38553 knows both facts); the
picker tile shows the companion you would arrive with. THE OVERLAP (design
2.4): in three chapters with two movers, schedule them to coincide once per
cycle ≥ 60 m apart and put both on the live line — Venice the flood's peak
and the traghetto's last crossing; Iceland Strokkur and the whale; Palawan
the bloom and the manta — *the tide, 40 s · the traghetto, 45 s · not both.*
Nothing fails; this cycle asks.

**Instrument.** `qa/l7-parcel.js`: a Pasto empanada carried into the Quay
ticks `parcel-quay` and the traveller names it; a Rio frisbee into Iceland
ticks at the regular; 18/18 rows reachable under `qa/verbs.mjs` (a `parcel`
consumer count ≥ 18, `travelFrom` readers ≥ 2); the departure card names the
manifest and the price (today ''); the perch line fires on a fresh directed
file before the whistle (today 0 lines); a stand at each overlap's midpoint
sees both countdowns inside 45 s of each other in 3/3. Effort L / risk med.

### F2 · THE MUSICIAN — the place plays the tune, and the border is heard
*A tune that comes from a person in the square.* (audio B + A)

The tune (L6 F3) is non-diegetic. Give every chapter one MUSICIAN in the
world who plays it, in the palette's instrument, from a position, through
the mover pipeline (Doppler, occlusion, distance, room — all built and only
ever used for engines): Sydney's busker (npc.js:10308 strums every 3–6 s —
give him the eight notes), Kyoto's monk on the bonshō, Hanoi's xẩm singer,
Rio's cavaquinho over the surdo, Venice's gondolier humming it, Marrakech's
ney, Antarctica's radio in the hut — a `musician` role on one local (or
prop) per chapter with a position in the chapter's spawn table; a
bed-class mover (`kind: 'tune'`) that renders `sysMUS_THEME` on a named
voice through the mover chain, once a minute, whole, carrying 40 m; the
score ANSWERS it — `sysMUS_2ND` quotes cell 0 four beats after the musician
finishes; a row per chapter *listen to the whole thing* (stand within 8 m
for a whole statement; `needs:` nothing); the coda plays the nineteen
musicians in order instead of the nineteen leads. THE J-CUT: at the third
whistle, while the white comes up, the destination's bed and one signature
rung come up under the departing chapter at −12 dB, 1.5 s before the
picture changes (`biomeFadeTo` publishes `biomePre`; `sysMoverTick` treats
a mover whose biome is `biomePre` as live at 0.25; the ladder forces one
rung for it), and the chapter left rings out 2 s after (the room already
does; the beds cut — `l7r-audio-border.json`).

**Instrument.** `qa/l7-musician.js`: in 19/19 a `tune` mover exists with a
position; standing 6 m from it a statement of ≥ 8 notes is heard within 70
s with `phraseAudit`-style key check 19/21 (the tune's intervals); the
second voice quotes cell 0 within 4 beats after (a count, `musAnswerN`);
Doppler `rate` ≠ 1 while running past it; the row ticks. Border timeline
(`l7r-audio-border.js`): destination bed ≥ −45 dBFS 1.0 s before
`g.biome.current` changes; departed bed's tail ≥ 2 s after; no 100 ms step
with a peak delta > 6 dB. Effort M–L / risk med.

### F3 · THE FIRST ONE IS ON THE HOUSE, AND SHOW ME
*The marquee cannot be missed the first time, and the paper can look for
you.* (play A + B, design 2.5 + 2.8, writing W3)

THE ZONE: `envZONES.operaStage` grows to the riser's rectangle (z −0.6..3.5)
and every marquee zone test takes a 0.5 m margin. THE WHY, EVERYWHERE: a
`why` on the marquee row in `sysHINTS` beside `clue`/`where` — the
chapter's live state to one sentence, routed through `marqueeWhy` on any of
Q/E/Space inside `sysWHY_R` of the point without a tick, fifteen lines
authored from each chapter's own state (condor: *she is over the plaza — be
under her when she comes down*; cali: *the ladder is on the back; she goes
when you are on the roof*; palawan: *she laps the drop-off — under, and wait
for her*; …); a why-pill HOLDS ≥ 4 s in the place-card slot and a
bubble-derived pill cannot push it out; the second miss at the same point
sends the nearest local over with the line. THE FIRST CLOCK: on the first
arm of each clocked marquee per file, the countdown does not start until
the animal is within 25 m of the point (or the first cycle is +90 s), the
first miss re-arms in 20 s not 107, and the E6 wear path is drawn from the
arrival point to the marquee point while the paper's clock is live; the
miss line does not blame (*you were supposed to be on it* → *it went
without you. it comes back.*). THE SIGHTLINE: at the arrival dolly
(`frameShot`) the lens yaws so the marquee point is in frame wherever it is
under 150 m (a `look` on the dolly); the four over 150 m get a foreground
stand-in the card points at. SHOW ME: Tab (or a click on a row) swings the
lens to the row's hint target for 1.5 s with the wear path drawn from the
animal's feet to it, then back; one look per row per chapter; the coda's
resting-lens code is most of the move.

**Instrument.** `qa/l7-onthehouse.js`: fresh file, up the stair, stop on the
first step of the riser, Q → `concertAudit().notes === 1` and a why/note
pill in the DOM at every 250 ms sample for 4 s (today notes 0, 1/16
samples). `l7r-design-why.js`: a marquee-specific line on Q or E in 19/19
(today 5). A fresh arrival in the five clocked chapters walking straight at
`sysMarqueePoint()` at 3.3 m/s arrives before the first `nextIn` hits 0 in
5/5 (today 0/3). `l7r-design-marq.js` on-screen at arrival ≥ 15/19 (today
9). Tab in Sydney: the lens's look point within 3 m of the hat man's
position for ≥ 1.0 s and back inside 3 s. Effort M / risk low-med.

### F4 · THE WEATHER FRONT — an event the player watches arrive
*One cause for the dark, the glare, the wind and the wet.* (art B; L6's
stretch item, held twice)

The ingredients exist — rain odds and hold, the cloud field, the gust and
the sway, the wet layer, the airlight, thunder — and none of them is an
event. One scalar in weather.js, `wxFront` ∈ [−1, 1]: a front's position
along the chapter's wind, crossing once per 6–9 minutes in the chapters
whose mood row allows rain (and forceable: `hud.front(1)`), that the cloud
field's coverage, the dome's dark lobe (weighted on the front's azimuth),
the gust (swayK 0.4 → 1.2 ahead of the line), the rain density, the wet
layer and the key's intensity all read — so the picture gets its dark, its
glare and its motion from one cause, the sun comes back on puddles, and
the score's filter and the air bed breathe with it (one term each). The
locals put umbrellas up ahead of it (the umbrella exists), the birds go up
at the line, one pill at the first drop (*here it comes*) and one line
from a local after (*that was the whole of it*).

**Instrument.** `qa/l7-front.js`: on a forced front in Sydney and Venice,
the frame's dark share (luma < 60) rises ≥ 12 points then falls within the
crossing; sway share ≥ 3× the calm value ahead of the line; sky-band sd
doubles on the front's side; the wet sheen cluster (> 200) appears within
20 s of the line passing and the key's intensity returns to ≥ 0.9 of its
start within 60 s; the world bed's RMS rises ≥ 3 dB at the line; 0 new
per-frame allocations (`qa/fuzz.js` clean). Effort M / risk med.

## The seven areas

### E1 · THE MIX, INVERTED (audio 1, 2, 7, 9, 4)
- **The startle leaves the chase.** `npc:startled` (systems.js:40499–40510)
  sets `musChaseT = max(·, 2.5)` → `musChaseHit = max(·, 0.5)` and a 40 ms
  flinch on the pad's filter (−300 Hz, τ 0.05/0.4); only `npc:chase` writes
  `musChaseT`. Instrument: `l7r-audio-startle.js` standing 30 s in 5
  chapters: chase hits 0, `chaseT` on-time 0 with nobody chasing (today
  Sydney 57 %, 40 hits); the still window's run-to-run spread ≤ 1.5 dB.
- **The world sidechains the pad.** In the one pad writer (~45400) a
  `worldEnv` follower on the sfx bus (τ 0.05 in / 0.6 out) → `× (1 −
  0.5·worldEnv)` on the pad and −500 Hz on the filter; the flow
  (`sysFlowNow`, ~45274) takes the pad DOWN 3 dB and puts +3 dB on
  `musPluckDry` — walking thins the score; `sysMUS_BUS` 0.17 → 0.14, the
  sfx floor +2 dB. Instrument: `l7r-audio-drive.js` world ≥ score − 4 dB in
  ≥ 6/8 walking windows in Sydney and Antarctica (today 0/8); master
  transient rate ≥ 0.4/s walking in 3/3 (today ≤ 0.25); marquee still ≥
  still + 5 dB.
- **A bed at rest in every chapter.** `bed: true` rows at the animal at
  0.10: `sea` for Rio, `wind` for Iceland / Antarctica / the Sahara / Göreme
  (broadband noise, 0.05–0.2 Hz AM, 1.5–6 kHz sway, throttled by the
  weather's wind), `city` for Rio / Monaco / Cali; `colony` re-levelled at
  the animal. Instrument: still window world ≥ score − 8 dB in 19/19 (today
  1/5 of the reviewer's, 4/4 of L6's).
- **The first arrival says the tune.** The Begin sting fires on
  `ac.resume().then` / a `statechange` retry (max 3 s); the lift gate
  (`musLiftNow() > 0.02`) DEFERS the arrive rather than dropping it.
  Instrument: `l7r-audio-begin.js` `themeSaid` 1 within 3 s of Begin (today
  0); `l7r-audio-arrive2.js` 3/3 including the 4 s case.
- **Air.** A per-chapter AIR bed on `sysMOVERS` (`bed: true`, 0.025;
  highpassed noise 6–12 kHz under the wind's AM, wider in the open
  chapters); the sfx shelf −5 → −2 dB and the top 11 → 14 kHz with the four
  S2 culprits (cicada, geyser, rustle, hiss) on their own 9 kHz lowpass; a
  2 ms 4–8 kHz click layer −18 dB under `thud`, `clink`, `pop`, stone/ice/
  metal `step`. Instrument: master `top` (≥ 5 kHz) ≥ 1.0 % walking in 5/5
  (today 2/5), ≥ 0.5 % still in 5/5; the harsh voices' share unchanged.
- **A bug the design probe found:** a teleport onto Sydney's podium puts
  `musTick: exponentialRampToValueAtTime` non-finite into `lastError` and
  the score may stand down for the run — guard the ramp's target (≥ 1e-4)
  and the time (finite, ≥ now).

### E2 · THE VOCABULARY OF A PLACE (audio 3, 5, 6, 8)
- **A chase per palette.** A `chase:` row on `sysMUS_PAL` `{ inst, bpm,
  pat }` read by the pulse (:19861–19876): Kyoto a shime/taiko pair at
  132, Iceland a bowed tremolo on the bass at 96, Palawan a kulintang
  ostinato, the cave a dripping double-time on the plucks; default the
  bendir. For the six bands a CHANGE OF MATERIAL: the samba's caixa to
  sixteenths and the surdo out (the break), the salsa to the mambo (montuno
  up an octave, campana on every beat), the gnawa's qraqeb double, the
  baroque continuo to running quavers, the hk kit to the ride, the bond
  brass to stabs; keep the +25 % velocity. Instrument: `l7r-audio-states.js`
  on 5 pad + 4 band chapters: chase − still ≥ +4 dB in ≥ 7/9 (today 1/5);
  pattern density (hits/bar; a `bandHits` counter) ≥ 1.5× the walk window on
  every band; the pulse's instrument distinct in ≥ 6 pad palettes.
- **Eight chapter voices.** `sfxTable` (systems.js ~20913): `bell` (two
  inharmonic partials 2.1/3.4 kHz, 90 ms — the bicycle), `moped` (two-tone
  square horn + 50 Hz exhaust burst), `penguin` (the babble's glottal pulse
  through a 600/1900 Hz formant pair), `heron` (pulsed noise at 12 Hz
  through BP 900, 180 ms), `calve` (30 ms crack at 3 kHz over a 1.5 s 60 Hz
  rumble), `crowd` (six far babbles), `kettle` (hiss + 400 Hz whistle),
  `swell` (a 2 s lowpassed noise surge); the call sites in hanoi.js
  (:4295/4312 tick → bell; :4306/4311 bark → moped), antarctic.js
  (:4310–4588 splash → swell/calve; :4625 hiss → penguin), kyoto.js
  (:1513/1534 gull → heron) rewired; `qa/l7-voices.mjs` on `npm test` lists
  generic-voice calls with pitch outside 0.7–1.4. Instrument: the lint 122 →
  ≤ 30; a Hanoi 2.5-min drive hears ≥ 6 chapter-own voices at ≥ 40 % of
  non-step calls (today 2 voices, 1.4 %); Antarctica `splash` pitch < 0.6
  count 137 → 0.
- **The ladder, fresh.** The ladder's timer ×0.5 for the first 120 s of
  every chapter (`biome:enter` resets `ladderFresh`); a per-chapter
  SIGNATURE rung inside 40 s of arrival and every 90 s after (Sydney the
  ferry horn + gulls, Kyoto the shishi-odoshi, Venice the campanile, …);
  the calm's ×1.35 on the timer removed; a stone path material inside
  Sydney's spawn ring (`capySurfacePitch`, capybara.js:2660–2664).
  Instrument: `l7r-audio-drive.js` distinct names in minute 3 ≥ 13 in 3/3
  (today 9–12); rungs ≥ 5/min in 3/3; a Sydney drive hears ≥ 2 materials.
- **Cues.** On the score's grid, in key: the countdown's last ten seconds
  tick once a second on the palette's percussion voice (through
  `musSnap`); a window's opening is one `musLiftNote` on the lead + the
  mover's throttle up 2 s before; the armed marquee plays the tune's first
  two notes when `marqueeWhy` first returns null; a denial adds a flat
  second on the bass under the snort; the exit zone's three whistles are
  answered by the destination's signature rung at −12 dB (F2's J-cut owns
  the crossing itself). Instrument: the cue census (`l7r-audio-border.js`):
  each of countdown ≤ 10 s, window open, marquee armed, `npc:denied`, exit
  zone entry produces ≥ 1 sfx or sting within 300 ms (today 1/5); key check
  21/21.

### E3 · THE LENS (art 1, 2, 8; play 3, 4)
- **The cut boom orbits instead of diving.** Camera block (the latch
  ~42228, the boom ~42619): when `camClearF < 0.6` for 0.4 s or on the
  latch, probe five bearings (±30°, ±60°, 180°) with `sysCamClear` and
  swing the yaw spring to the clearest at the driving boom; cap the
  rendered pitch at 22° whenever the boom is cut (lower the look point, do
  not shorten the boom); the rest latch clears on a bearing change.
  Instrument: the 300-sample walk-stop-turn loop (`l7r-art-occl.js`) in
  19 chapters: horizon ≥ 0.10 in ≥ 92 % (today 64 %); `rest ≥ 0.4` at 12 s
  still in ≥ 16/19 (today 3/5).
- **A world-space capsule in the rim shader.** shared.js `_RIM_FS_OUT` /
  `_lensFadeU`: two points (eye, animal chest) and a radius (0.7 m) as
  uniforms written once a frame; any fragment on any `mat()` material
  within the radius of the segment at parameter < 0.85 takes a 2×2
  screen-door discard; `capySelf`, emissive and transparent exempt; the same
  test in `customDepthMaterial`. Instrument: window-occlusion ≥ 0.5 in ≤ 2 %
  of loop samples (today 12 %); a visible animal cluster in ≥ 97 % of frames;
  no new program.
- **The walk frame.** `sysCAM_PITCH` and the driving boom: pitch 19 → 14°
  with the look point +0.4 m, boom 11 → 9.5 m. Instrument: walking-frame
  animal height ≥ 120 px in ≥ 10/12 chapters (today 84–122 in 10/12),
  horizon 0.25–0.38 on the flat chapters; the cut rate not up > 10 % in the
  street chapters.
- **Water is not where the picture goes flat.** On `capy.swimming` cap the
  boom at 7 m and the pitch at ~20°; on the dive (y < water − 0.5) the lens
  goes under with the animal in frame and a depth tint (one uniform in the
  composite); a 3 m gap in Sydney's quay kerb at the wharf end (or a rail
  that is visibly a rail). Instrument: swim at the Molo, rig ≤ 8 m; under,
  the animal's screen box ≥ 60 px tall and the frame's blue-green share
  ≥ 40 %; Sydney W from (−22, 0.3, −6) facing the harbour 4 s → `y < 0`.

### E4 · THE SURFACE (art 3, 4, 5, 6, 7)
- **Triplanar grain.** shared.js `grain()` (:5623–5641, :5757, :5797):
  `vGrainN` unconditional, weights `|n|^4` normalised, near and mid octaves
  on xz/xy/zy where `w.y < 0.8`; a `course` option (0.55 m band on world y,
  ±4 %) for buildings; rock materials (cave, Göreme, Iceland) get the broad
  octave on the wall projection at ±8 %. Instrument: cave rest 8×8
  flat-block share 91 % → ≤ 70 %, luma range 83 → ≥ 120; the Venice calle
  edge density ≥ 3×; the sky band's sd unchanged.
- **Six stances.** npc.js `buildLocalFigure` (:1545) resolves a stance per
  person — weight on one hip, arms folded, hands in pockets, hands on hips,
  a hand to the brow (vendors, sun chapters), plain — and the per-frame
  joint writes (:7060, :7209) add its offsets under the shoulder mask the
  elbow uses; a beat plays from the stance and returns to it. Instrument:
  `l7r-art-scene.js`: torso z sd ≥ 0.035, knee sd ≥ 0.06, shoulder x sd ≥
  0.35 rad in every chapter with ≥ 6 locals (today 0.000 / 0.000 / 0.05).
- **The animal is not the ground's value.** A character key on layer 1
  (only the animal; 35° elevation on the lens side, 0.35 of the key in the
  key's colour, no shadow) and −12 % albedo on the legs and the barrel's
  lower third (the belly gradient extended, capybara.js:1001); both under
  the `noSelfRim` switch. Instrument: `l7r-art-sep.mjs` |ΔL| ≥ 15 in ≥ 80 %
  of settled frames (today 56 %); the animal's own luma sd within ±3.
- **The clipped awning and the blank pane.** `sysEXPOSURE` a `sahara: 0.90`
  row; the awning canvas 0.88 → 0.74 linear (sahara.js:1191); Kowloon's
  lit-window material takes a shelf line and a shadow band at 0.55 of the
  pane in the emissive term. Instrument: Sahara rest > 230 share ≤ 3 %
  (today 15.4) and the top decile spans ≥ 18 levels; Kowloon pane sd ≥ 12.
- **The water reflects the place.** In the water fragment, for each spill
  point above the waterline a vertical smear below its foot
  (`exp(-|dx|/w)·exp(-dy/h)` in the emitter's colour, jittered by the
  sparkle's noise), and by day the same column in the sky's complement at
  0.15 for the `_bounceP` points; N ≤ 8. Instrument: Kowloon pier at night,
  luma correlation strip-above vs mirror-below ≥ 0.4 (today ≈ 0); the Quay by
  day, a dark column under each pylon ≥ 8 luma below the water 2 m away.

### E5 · THE PAPER'S HONESTY (design 2.1, 2.2, 2.6, 2.7; play 2, 6, 7, 8; writing W2, W4, W5)
- **The shove that was your own.** The shove block (~43857–43877): `own`
  also when grounded, `input.run` down and the gain within 30° of the stick
  (`input.x/z` rotated by `camYaw`) ending ≤ 7.6 m/s. Instrument:
  `l7r-design-shove.js` 0 pills in 6 trials (today 4); ≤ 1 unnamed shove
  pill in a 180 s naive walk in Hanoi and Sydney (today 13 / 7); a real
  Hanoi hit still names the traffic.
- **An answering row in every chapter.** One act-one row per chapter,
  first in author order, no `needs`, ticked by the chapter's own first verb
  inside 20 m of the spawn — Marrakech *turn a head in the square*
  (`npcHeardArm`), Antarctica *the first step on the ice* (the first
  `groundSlip` frame), Hanoi *get a horn* (`offWant`, hanoi.js:1534), and
  the same for every chapter whose naive 180 s ticks < 2 (audit them all
  with the follower probe). Instrument: the 180 s naive walk ticks ≥ 2 in
  every chapter with the first non-free tick ≤ 45 s (today Marrakech 0 /
  none, Hanoi 1 / none); the follower's longest gap in Marrakech and Hanoi
  ≤ 60 s (today 177 / 180).
- **The locked wharf answers.** Three wheeks at the way-on under the gate
  → *not yet — 7 more here, or Choose a place from the title*; the journey
  panel's locked rows say *N more here*; the picker reachable from the
  pause card. Instrument: at 3/20, wheeks ×3 at the exit marker → a pill
  containing "more" within 2 s (today 0/1).
- **Silent walls.** capybara.js contact sweep: a movement key held and
  horizontal speed < 0.3 m/s for 0.4 s → the snort, a pitch nudge, and once
  per chapter *that's a wall*. Instrument: run into three known walls, a
  pill or sound event within 0.6 s in 3/3 (today 0/3).
- **Pills that refer to nothing.** The nap line (~39499) gated on a nap in
  the live chapter; wow-recap pills through the E4 queue and never inside 6
  s of a chapter card; the puff and incident tutorials once per file; the
  free photo tick needs the animal moved ≥ 2 m; `toast()`'s queue and held
  pill cleared in `biomeFadeTo` (a `note` survives; a `say` carries its
  biome and is dropped if it differs); the save notice and the governor
  line become a 3 s map-corner badge; the paper tutorial waits for the
  first pause in bubbles; ≤ 2 bubbles on any frame in a fresh file's first
  10 s; count records committed at the mob's END (npc.js:13310–13317, the
  chips; `pigeon-storm`) with `recordLive` meanwhile. Instrument: a 3-minute
  Sydney run + one cross: 0 repeated tutorial pills, 0 pills whose subject
  is > 30 m from the lens, 0 Venice text in Marrakech's first 30 s (today
  2), first `say` pill a chapter line, fresh file 20 s no keys → 0 ticks,
  ≤ 1 record toast per event per 30 s (today 4 in 7 s).
- **The notebook comes up, the locked rows can be read.** `jrNbDet` above
  the rows once it has an entry; the fold opens on the next J after a new
  page; locked rows opacity 0.36 → 0.6. Instrument: `jrNbDet.offsetTop <
  200` with ≥ 1 entry; locked `.capyui-jrrec` contrast ≥ 3:1 (today 1.5).
- **The finale has a back wall 80 m from the spawn.** hanoi.js: the south
  edge becomes a THING — a ring-road lane along z ≈ −150 (scooters as a
  wall) or the lake's far shore built; `backVoid` turns the animal round
  rather than putting it back. Instrument: 180 s naive walk from the Hanoi
  spawn, void rescues 0 (today 2); the frame at any rescue point ≥ 20 %
  built geometry. Also: the minimap's way-on label after chained crosses
  read *the ferry wharf* in the Pantanal and Hanoi — key it on the live
  chapter.

### E6 · THE WORDS (writing W1, W6, W7, W8; A; B)
- **One sentence per surface.** shared.js CHAPTERS: rewrite `nb[0]` in the
  11 chapters where it quotes the sub (Pasto, Iceland, Sahara, Drift,
  Kowloon, Palawan, Manly, Cave, Monaco, Kyoto, Antarctica) so the traveller
  opens on something only they saw; rewrite `left` in the 6 that reopen the
  sub (Quay, Iceland, Kowloon, Palawan, Manly, Monaco); the weakest five
  (Kowloon and Palawan notes say "chapter"; Cali's note; Antarctica's left;
  Manly's left); `left` lines ending on a *You…* sentence 9 → ≤ 5; the
  notebook loses ten of its "did not"s; the acqua alta clue loses its 95 %.
  Instrument: `qa/l7-echo.mjs` on `npm test`: 0 shared trigrams sub~nb[0]
  and sub~left in 19/19 (today 11 / 6); 0 "chapter" in note/left/nb; 0 clue
  literals with `%`.
- **The people of this square.** npc.js: a third per-chapter slot
  `passing` (6 lines each, what THESE people say to each other when nothing
  has happened) read by the idle path before `npcLOC_SAY`; the `startled`
  pool gets a per-chapter override of 3 in Venice, Hanoi, Kowloon, the
  Sahara, Rio, Cali. Instrument: 90 s naive walk in 19/19, ≥ 50 % of bubbles
  from the chapter's own pools (today Venice 38 %, Marrakech 0 %).
- **THE ASK — the traveller wants something, once.** In Cappadocia the
  traveller stands on the launch field with a ticket they cannot use (*I
  booked this three months ago*); the balloon row gains a variant — take
  them UP: the seat (F1's THE SEAT) mounts the traveller figure in the
  basket beside you (a `carried` state on the figure, 3 lines), and the
  Cappadocia notebook page rewrites from *I saw it across the square* to
  *I was in the basket. I am not going to explain how.*; the finale's *I
  still could not tell you how you got to half of them* names its one
  exception. Instrument: `qa/l7-ask.js`: the traveller aboard at take-off
  (`travUp` true), the page rewritten, the finale line differs (today the
  arc has no middle).
- **The place answers back.** Nineteen `again:` strings on CHAPTERS on
  the place card's `news` slot when `chapter:enter` finds `jrSeen` and ≥ 1
  row done; the regular's first line the tier-2 *You came back*.
  Instrument: leave Sydney at 4 rows and return → the card's news line is
  the `again` (today the same card).

### E7 · THE MACHINE (qa F1, F2, F3, F6, F7, F8, F4)
- **The governor sheds CPU before pixels.** `game.state.perf.ms` (the perf
  review's per-module timing in main.js, kept) and `game.state.tickMs`;
  the rungs re-ordered — rung 1: far cascade off + shadow ½ rate; rung 2:
  half composite chain (2 blur taps, DoF off) + dpr 0.8; rung 3: today's —
  and the step-up on `tickMs` (< 12 ms sustained) rather than the rAF
  period, so a vsync-locked 33 ms with a 12 ms tick climbs; per-chapter
  static same-material merging in the two worst (Venice, Kowloon: calls
  284/329 walking). Instrument: `l7r-qa-frame.js` quiet: at `pretty`
  `tickMs ≤ 12` standing in ≥ 15/19 (today 14.5–31); at `fast` p50 ≤ 17 in
  19/19 (today 4/6); the governor at rung ≤ 1 in ≥ 15/19 after a 20 s walk.
- **The soak diff cannot be green on nothing.** `qa/soak-diff.mjs` FAILS
  when the history has < 2 rows or the last row's commit is not an
  ancestor within the branch's last 3; `npm run soak` writes a row for this
  pass at the end. Instrument: `node qa/soak-diff.mjs` non-zero on a stale
  history; ≥ 2 rows after this pass.
- **The pack does not launch you.** monaco.js car tick: gained speed over
  the car's + 2 m/s with a car within 3 m → clamp to the car's velocity +
  4 m/s up, `capy.shove(…, 'the pack')`; `sysIMPULSE_BY.monaco = { dry:
  'the pack', wet: 'the harbour' }`. Instrument: `l7r-qa-monaco2.js` 4/4:
  maxSpd ≤ 12, apex ≤ 3 m, pill names the pack (today 34–85 m/s, 28 m).
- **The fuzz can find it.** `qa/fuzz.js` takes a duration (soak 45 s) and a
  per-chapter `maxSpeed` ceiling as a FAIL row (30; the Drift 26 fall,
  Cappadocia the balloon). Instrument: `npm run soak` 19/19 with the
  ceiling.
- **The HUD writes on change.** `recordLive` (~30557), the stamina bar and
  the minimap (`mapDraw` ~25079, 20 Hz) write only on a changed value.
  Instrument: CDP RecalcStyleCount ≤ 10/s, LayoutCount ≤ 5/s over a 25 s
  walk with no pill (today 59 / 21).
- **The save checks its elements.** `saveShapeOk` (~30123): `seen` integers
  1..19, `tasks` strings in TASKS, `nb[k].d` a string; bad elements dropped,
  not the file. Instrument: `l7r-qa-save2.js` seenHuge reads back `[1,10]`.
- **The probes say which are alive.** `qa/_boot.js` (the Begin/Carry-on
  door) and `qa/probes-alive.mjs` on `npm test` that lists probes pressing
  the card (`mouse.click(400, 400)` / `(640, 400)`) or reading a name `src/`
  no longer publishes; the five audits the memory names (`npchealth`,
  `props`, `pointers`, `audio2`, `kine`) rewired to the door. Instrument:
  the five write `started: true`; the report counts 160 → the number
  honestly left.

## Held (named, not built)
THE FAVOUR (design F2 — rows given by people, L, two writers on the
regular); THE VIEW THE PLACE COMPOSES (art A — authored vantages; E3's cut
boom first); planar reflections; a sliced generator build (E7's crossing
number with company is the machine's); the 160 dead probes rewritten
wholesale (E7 retires and counts them).

## Order and ownership
Wave one (six agents, disjoint regions): E1 audio-mix, E2 audio-vocabulary,
E3 lens, E4 surface, E5 paper, E6 words. Wave two (five agents): F1 parcel,
F2 musician, F3 on-the-house, F4 front, E7 machine. Every batch under
playwright with its own instrument, `qa/fuzz.js` in the chapters it
touched, `npm test` green; one commit per wave; the closeout in CONTRACT.md
with the numbers as measured, met or not.
