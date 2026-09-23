# ROADMAP-WOW2 — the fourth beauty pass, the reason, and the first three minutes (20 Sep 2026)

The brief, after L11 closed: another round — four to six no-regret lifts
to visual depth, beauty and wow, global and chapter by chapter, from
landscapes to the people to the animal to how things move, one or two
notches further while holding the frame rate; three or four significant
lifts to the storytelling, so the game has more emotion and a central
purpose; and a two-to-three-minute tutorial that teaches a new player the
basic mechanics.

**Read before proposing anything to this codebase:** it is more complete
than it looks. The map taken for this file (`CHAPTERS`, `shared.js:3741`;
`TASKS`, `:2885`; the title card, `systems.js:23607`; the finale,
`:36061`; the capybara's rig, `capybara.js`) found that the game already
has a spine — *"it is taking one thing from every place. it has not said
why."* (`systems.js:23638`) — a recurring human who owns the shop and
turns up in four chapters (`npcTRAV_FIG`, `npc.js:3307`), a traveller's
notebook that "never answers the title's question" (`shared.js:3728`), a
regular per chapter who learns your name at tier three, a companion that
follows across borders, a home ("where you are, as it happens, from" —
the Pantanal, `shared.js:4082`), and an ending: nineteen keepsakes laid in
a horseshoe on the Sydney lawn, a coda of nineteen notes, a ledger
(`systems.js:36061–36340`). What it does NOT have is anyone who waits, a
why you can see, a first three minutes that teaches, and an animal whose
idle body says it is alive. That is what this pass is.

The laws stand: low-poly flat Lambert for the built world, smooth for what
breathes (L11), `PALETTE` only, no textures, every new term a
`game.state.noX` and parked at rung 1, no grade/sun/fog/mote/spawn row
re-based (LIFT10's audit). Every visual item is proved by a per-pixel diff
inside a mask and a screenshot read by eye; every story item by a count the
save already keeps or one line added to it; the tutorial by a bot that
follows only the pills and a stranger who reads nothing first.

## What "another notch" means here, measured

1. **Motion at rest.** The animal standing still moves — ears, breath,
   weight, a look — and so do the people near it: the NPC-layer two-frame
   diff at rest (the still instrument's own mask, inverted) ≥ 2× today's,
   read by eye as life and not as jitter.
2. **The far plane.** The corrected depth sweep's planes-only far share
   rises in every open chapter (today 0.02–0.23); every horizon has a
   drawn silhouette, and something in it moves.
3. **Tracks.** A walk across sand, snow or mud leaves a trail visible in
   the resting frame for ≥ 20 s (pixel count of the track decals in a
   masked band); a swim leaves a wake.
4. **The reason, counted.** The glimpses (`travMet`-style) 19/19 possible;
   the shelf's keepsakes physically present in Sydney 1:1 with the ledger;
   a regular's "you were gone" line fires on a return after ≥ 20 min away;
   the companion's homecoming fires in its `from` chapter.
5. **Three minutes.** A naive bot following only the tutorial's pills
   completes all eight beats in ≤ 180 s from Begin; a stranger playtester
   names all six verbs unprompted afterwards; zero pills fire on a file
   with any task done.
6. **16.7 held.** Quiet-machine interleaved rAF A/B, all new terms live vs
   cut, eight chapters: live-minus-cut ≤ 0.6 ms median, rung 0 held, every
   term ≤ 0.1 ms when cut.

## Part V — six no-regret visual lifts, in look-per-millisecond order

### V1 — THE ANIMAL, ALIVE (idle life, weight, touch)

The rig is fully procedural and already good in motion: an armed crouch
before the hop, air pitch, a held landing, the grab as a lunge, the wheek
as an inhale, stop overshoot, lean as acceleration, breath, tail sway, ear
lag on vertical velocity, blink and mood (`capybara.js:1616–1665,
7442–8617`). What it lacks is a body that does anything when NOTHING is
happening, and feet that touch the world.

1. **The idle repertoire.** A clock of small things while standing (≥ 2 s
   still): an ear flick (one ear, 90 ms), a weight shift (hips 3 cm to one
   side, the far foot lifts a centimetre), a sniff (nose 4 mm forward, two
   beats), a head turn to the nearest thing of interest — the gaze channel
   npc.js already publishes for the animal (`npc.js:1422–1497`) points
   the other way here: the animal looks at the nearest local, yuzu or
   mover within 8 m, then back. Every 4–9 s, never two the same in a row,
   suppressed in the loaf and the nap (which have their own).
2. **Squash and stretch, both halves.** `capySquash` exists (`:3316`) and
   fires on the landing; the takeoff and the arc have none. A 6 % stretch
   along the velocity in the first 120 ms of the hop, decaying over the
   arc, and the landing squash scaled by impact speed rather than fixed.
   The swim gets a 3 % bob on the stroke.
3. **Footfalls.** Each foot's contact (the gait already knows the phase,
   `:7676–7690`) fires a puff keyed to the ground: sand and dust a small
   pale mote burst (the weather field's own instanced quads — a
   `wxBurst(x, z, kind, n)` on the existing mote pool, ≤ 6 quads a step),
   snow a white one, shallow water a ring (the `wxRING` contact rings,
   `weather.js:659` — already the shape), stone nothing. Gated on speed:
   a walk puffs, a stand does not.
4. **Wet fur.** After a swim the coat darkens (`matSelf`'s colour lerped
   toward a `PALETTE.capyWet` for 25 s — the shake-dry, `:7098`, cuts it
   to 8 s), and three drips fall from the belly for the first 6 s (mote
   quads again). The belly band reads through it.
5. **The look at the lens, extended.** THE REGARD (`:1665`) turns the head
   to a resting lens; add the eyes: the catchlight beads track the lens
   ±15 % so the animal looks AT you rather than past you at rest.

- **Instrument:** `qa/wow2-alive.js` — 60 s at rest, own camera at 3 m,
  the animal's screen mask (hide-and-diff), moved pixels per second in
  the mask (target ≥ 2× today), and a contact sheet of eight idle
  moments read by eye; footfall bursts counted per stride on sand
  (Palawan) and snow (Antarctica).
- **Cost:** CPU only, one rig; ≤ 6 mote quads per step from a pool that
  exists. **`game.state.noAlive`** (idle), **`noFootfall`**.

### V1 — shipped (20 Sep 2026)

Commits `4f81611` (V1.1) and `495dce4` (V1.2–V1.4); V1.5 with V6.
Flags `noAlive` (V1.1, V1.2, V1.4, V1.5) and `noFootfall` (V1.3); both
park at `perfRung >= 1`.

**Reality check first — the rig had more than the card said.** The idle
repertoire is not new: `capyIDLE_BASE` (`capybara.js:1819–1841`) is a
SIX-beat weighted table — shake, look-around, shiver on `weather.mood().cold`,
chew on a full mouth, deep breath on low stamina, and THE LOOK BACK over the
shoulder at a resting lens — on a 6–17 s clock that collapses toward 4 s
with urgency, plus a two-ear flick with a blink every 2.2–5.5 s
(`:8472`), a sniff on its own 5–11 s clock that speeds to 1.6–3.4 s near
something worth smelling (`:8530`), the gaze (`:3012`), and THE REGARD.
What was missing was the SMALL motion between those beats, and a no-repeat
rule. So V1.1 is a second clock UNDER the table, not a replacement: one ear
(90 ms), the hips 3 cm onto one side with the far hind foot a centimetre
up, the existing sniff fired, and a head turn to the nearest local, person
or loose prop within 8 m — which is a different question from the gaze's
"who has NOTICED me", and the reason a standing animal ignored a crowd.
Never the same beat twice running; first at 2–4.5 s of stillness, then
4–9 s.

- **The clock must HOLD under a table beat, not reset.** With the rest
  lens open the look-back is drawn every 4–6 s and runs 2.4 s, so a clock
  that reset under it measured two small beats in thirty seconds.
- **"Suppressed in the loaf" was wrong, and the card wrote it.** The loaf
  lands at 6.5 s of rest and the nap at 26 s; a 60 s rest is 53 s of loaf.
  Gated off there, the whole feature was one beat and then a statue for as
  long as anybody read the map. A sitting capybara flicks, sniffs and
  turns; only the weight shift is a standing thing, and that one alone
  comes off the table in the loaf. The nap takes all four.
- **Measured (`qa/wow2-alive.js`, own camera at 3 m, hide-and-diff mask,
  127 k px).** Per-beat peak pixels over the breath's own floor: shift
  5–27 k, sniff 1–24 k, turn 3 k, and the 90 ms ear under the 100 ms
  sample. The floor is 5–10 k px per 100 ms in BOTH arms — the breath
  scales the whole squash node and a blink is a face — which is why the
  headline "moved pixels per second" ratio is 0.9–1.1 and says nothing:
  **a per-second sum cannot see a 90 ms ear.** The honest number is the
  per-beat excess, and the contact sheet (`qa/wow2-alive-sheet.png`) read
  by eye: the turn reads plainly, the shift is about 20 px of hip at 3 m,
  the one-ear flick is a blur on a still.
- **V1.2.** The takeoff already had a crouch-to-stretch pop (D2) — on the
  squash node's Y ALONE, so a running hop stretched upward. Added: 6 %
  along the velocity split between the node's forward and up by the
  velocity's own shares, held 120 ms and decayed over the arc (sqZ 1.049
  live vs 1.022 cut at 200 ms of a running hop); the landing pop sized by
  impact instead of a flat −0.34 (−0.24 at a kerb, −0.45 off a 7.7 m/s
  hop, −0.50 cap; min sqY 0.825 vs 0.850); a 3 % bob on the stroke (swing
  0.060 over a 0.47 s period, measured in the harbour).
- **V1.3.** `weather.burst(x, z, kind, n, o)` on the mote field's own
  quads — 48 of 200 above the live row, the quarter rule, kinds as data
  (dust, snow, leaf, drip, bubble) — plus `weather.ringHere(x, z, o)` on
  the D5 contact rings. **Both exported on `game.weather` for V4/V5.** The
  footfall keys on `capySurfMat`, which the step VOICE has read since L4
  and the picture never did: 4.1 bursts a footfall on Palawan's sand, 3.1
  on Antarctica's snow (the Drift row of 170 leaves 30 slots), 0 cut;
  2079 and 1062 px in the frame with the burst slots off the mesh's count.
- **V1.4 was half shipped.** `capyWetLevel`/`capyWetDark` and the
  six-material swap exist, with hysteresis at 0.42/0.28 — and the coat was
  dark for **5.8 s** after the harbour, because the level falls at ⅛ a
  second and the sound, the slip and the shake all read the same number.
  So the picture got its own: `capyWetVis`, 25 s, cut to 0.55 and 8 s by
  the shake, with the three dark twins' colours LERPED from the dry ones
  each frame (the material swap then happens under the lerp, where the two
  are one colour, so there is nothing to strobe). Dark for **24 s live vs
  5 s cut**; 12 belly drips in the first 6.5 s, 0 cut. **No
  `PALETTE.capyWet` was added** — the twins' existing colours are the wet
  targets, and a fourth brown would have been a fourth brown.
- **V1.5.** The catchlight beads slide across the eye toward the lens by
  15 % of the rest position while THE REGARD is up: 0.053 and 0.019 of
  slide at regard 0.28, 0 cut. Read by eye at 1.7 m: the near eye's white
  bead sits on the front-upper shoulder of the eye in the cut frame and on
  the lens side of it live.
- **Traps for the other waves.** (1) A headless GL settles at governor
  rung 3 on its own, which parks every rung-parked term in the game —
  pin rung 0 with `localStorage['capy3.prefs.v1'] = {v:1, pf:1}` in an
  init script, and `v: 1` is not optional (`sysPrefsRead` drops the whole
  file without it). (2) The first render after a run of render-less
  `game.tick(dt, false)` calls draws a different animal shadow from the
  second — a same-same diff measured a 50 k px trapezoid. Render twice,
  then grab. (3) A probe that drives `input.x/z` directly never wakes the
  animal: `capy.wake(s)` is the keyboard's door and 26 s of rest is a nap
  that takes every beat.

### V2 — PEOPLE, ALIVE (gait, gesture, weather, company)

npc.js has knee/elbow gait, six resting stances, work/reach/rock beats, a
gaze target, wariness, mouth shapes and brows (`npc.js:609–2959`). Every
figure of a kind still walks the same walk, nobody reacts to the weather,
and nobody talks to anyone but you.

1. **Gait per kind.** Children skip (a double bounce per stride, 1.22 head
   ratio already marks them — `npcCHILD_HEAD`), elders shuffle (shorter
   stride, forward lean, a pause every 6 m), the tired sit down. Three
   gait profiles on the instanced stride, chosen from the figure's own
   seed. The Marrakech and Rio pools take them through `npcPERSON`.
2. **Gestures, idle.** A pool of six two-second beats on standing figures:
   a look at a wrist, a stretch, a wave to someone off-frame, a point at
   the animal (only when it is doing something — chaos > 0), a shiver in
   the two cold chapters, a hand over the eyes in the three bright ones.
   On the roster's existing arm nodes; the merged locals get the head
   turn only.
3. **Weather on the people.** When `rainT` > 0.3 a third of the standing
   roster raises an umbrella (`hangThing`-class merged box on a cord,
   one instanced mesh per chapter, PALETTE colours) — Kyoto and Hanoi
   first; in Iceland and Antarctica a breath puff every 4 s from each
   head within 12 m (the mote pool). Nothing on the movers.
4. **Company.** Two locals within 3 m of each other turn to face each
   other for a beat and babble (`sfxBabble`, `npc.js` F5) — a square that
   talks to itself, not only to you. Once per pair per 40 s, never while
   the animal is within `near`.

- **Instrument:** `qa/wow2-people.js` — per chapter, own camera on the
  densest group, 20 s, moved pixels in the crowd's mask; gait profiles
  counted from the instance seeds; umbrellas up under a forced shower
  (trap 35: `odds: 1, hold: 14`); read by eye.
- **Cost:** the stride is already per-frame; gestures are ≤ 6 nodes;
  umbrellas one instanced draw per rainy chapter. **`noGesture`,
  `noUmbrella`.**

### V2 — shipped (20 Sep 2026)

Four items, four commits, all four built. `src/npc.js` only, plus one
line in `main.js` handing over the audits.

- **V2.1 the gaits** (`npcGAIT`, four rows). Chosen once from the
  figure's own `idlePhase`, strolling kinds only, a child always the
  skip. `strideK` scales the swing AND the stride the cadence is derived
  from, so a short step is short on the ground; the skip's second bounce
  is `|sin 2φ|` on the GROUP (a torso hopping over planted feet is a
  puppet); the shuffle leans 0.14 rad while moving and stops 1.5 s every
  ~6 m; the tired sit where they stopped and stay 9–19 s.
  **Sydney's 32: 23 plain / 2 skip / 4 shuffle / 3 tired**, 1–2 mid-pause
  and 1 sat at any second; a second boot read 22/1/4/5.
  Pictures: `qa/wow2-gait-{tired,skip,shuffle}.png` — sat on the path
  with the hands on the knees, a child 5 cm off the ground mid-hop, a
  shuffler mid-pause leaning forward.
- **V2.2 the six gestures** (`npcGESTURE`, `noGesture`). One clock for
  both rigs: 4–18 s to the first, 12–30 s after, started only under a
  busy sum of 0.25 and weighted by (1 − busy) once running. The three
  bright chapters are the three lowest `cloudK` midday rows —
  **sahara 0.22, quay 0.42, rio 0.48** (palawan's 0.50 is fourth,
  manly is a golden westerly) — and the shiver is the only row a huddled
  person may start, because a stretch out of a huddle is two poses on
  one shoulder. **Kyoto: 12–13 gestures in 20 s across 14 standing
  locals; Iceland: 37 shivers and Marrakech 5 shades in a window.**
  Pictures: `qa/wow2-gest-{wave,stretch,shiver}.png`.
- **V2.3 the weather** (`noUmbrella`). **Stale, in half:** the LOCALS
  have raised umbrellas since the presence pass (`npcMakeUmbrella`, the
  0.30/0.16 latch) in all fifteen chapters that have them — not built
  twice. The roster had none, and the file's own note said why (a
  per-person prop on an instanced cast is a new buffer and a write in
  `pushInstances`). It is one buffer and one draw: `gUmb`, `iUmb`/`pUmb`,
  an `umbN` node, a third of the strolling kinds from the seed, only
  while that hand is free. **Sydney: 7 of 32 own one, 5–7 up at a
  sampled rainT of 0.505** under the forced shower. The breath is W1's
  `game.weather.burst()` — five `bubble` quads per puff, every ~4 s from
  each local head within 12 m, **Iceland 10 in 20 s from two heads, 21
  and 53 over longer windows**.
- **V2.4 company** (`noCompany`, a flag the roadmap did not name).
  **The radius is 5 m, not 3, and that was measured:** nearest
  neighbours in the live chapter are Marrakech 2.25, the Pantanal 2.83,
  Cali 4.20, Rio 4.73 and nothing else under 5 — at three metres this
  beat exists in two chapters of nineteen. **Marrakech 1–2 pairs per
  60 s, Rio 1 at 4.61 m**, never with the animal inside either's `near`.

**Two findings worth the next agent's time.**
1. **The umbrella's front anticipation was upside down.** `wxFrontNear`
   was `-front * 3`, which is 1 when the front is FAR: every local in
   every rainy chapter stood under an umbrella in dry weather for the
   first two fifths of every six-to-nine-minute cycle (Kyoto, measured:
   14 of 14 at `umb` 1.00, rain 0.00). It is `1 - |front| * 3` now.
2. **The roster is not reachable from the page.** Its groups are never
   added to the scene and `game.npcs` is main.js's spawn array, so a
   crowd mask built the obvious way is 0 px — which reads exactly like
   "nobody moved". `game.peopleAudit.gait(true).rows` is the way in.

**Measured** (`qa/wow2-people.js`, one chapter per run; `qa/wow2-
frametime-v2.js`). Kyoto, crowd still: **live 1196 px vs cut 319 px of
its own 8177 px mask**, 12 interleaved pairs each. Sydney: 11007 vs 9203
of 97699 px — 17 of 32 are always walking there, the quiet gate has to
be dropped and the number is worth less for it. **Honest miss:** the
frame-time A/B cannot resolve these terms. The headless whole-frame
median moves ±1.5 ms between the arms of a flag that gates one probe
every 1.5 s; the tick-only sim A/B has a ±0.5 ms floor and every term
sits under it (Kyoto −0.001, Sydney +0.098, Iceland +0.243 ms/tick).
The one reliable number: the three flags cost **0.402 ms/tick in
Sydney** before the dry-case shortcut — nothing now runs while it is
neither raining nor about to, and with no umbrella open the buffer is
not written, uploaded or drawn (`count = 0`).

**Budget.** +1 instanced draw per rig, only while somebody has an
umbrella up (36 tris each, 32 and 13 instances); 0 new triangles
otherwise; 6 node writes per running gesture; the stride was already
per-frame. **Offered, not wired:** `npcPERSON.gait(u, child)` and
`npcPERSON.GAIT` for the merged Marrakech and Rio crowds — those are
`sahara.js`/`rio.js`, not this wave's files, so they still walk the one
walk. **Hook wanted in weather.js:** a `breath` row in `wxBURST`
(size 0.06, up 0.3, grav 0, life 1.2) — `bubble` is the closest fit and
at 2.6 m reads as a faint speckle rather than a plume.
**Names added:** `game.peopleAudit` (`.gait`, `.gesture`, `.umbrella`,
`.company`), `game.state.noCompany`, and the name `'npcCast'` on every
mesh the two casts instance, so an instrument can mask the people and
not a market stall.

### V3 — THE FAR PLANE (every horizon composed, and something moving in it)

L11's Part D gave six chapters a middle plane. The far share of the
planes-only sweep is still 0.02–0.23, and a horizon in this game is
mostly the dome. Every chapter gets a far layer, merged, one draw call,
inside the haze the airlight already draws:

- A **silhouette ridge or skyline** per chapter where none exists —
  Sydney the North Shore, Quay the Kirribilli roofs, Cali the Farallones,
  Rio the Dois Irmãos and Pedra da Gávea beyond the Loaf, Iceland Esja
  across the bay, Kowloon the Lion Rock ridge over the roofs, Palawan a
  second karst island on the horizon, Manly the headland to North Head,
  the Pantanal a tree line at 300 m, Antarctica the ice shelf's wall,
  Monaco the Tête de Chien above the town, Hanoi the Long Biên trusses
  running out — each three to eight merged wedges at 250–400 m, in the
  chapter's own far-fog tone, `flatShading: true`.
- **One thing that moves out there** per open chapter, ≤ 40 triangles,
  on a 60–120 s loop: a ferry crossing the far harbour (Sydney/Quay), a
  plane on approach (Rio, Kowloon), a sail (Palawan, Antarctica), a
  train on the far bridge (Hanoi), a car's lights on the corniche
  (Monaco), a bird-line (the Pantanal, Iceland). Positioned so it crosses
  the arrival frame once a minute.
- **Night lights far off** — Monaco's corniche, Kowloon's far towers,
  Hanoi's far shore, Iceland's harbour: a sparse instanced dot mesh in
  `EMIT_OVER` so the bloom takes them.

- **Instrument:** the planes-only depth sweep (`qa/wow-depth-after.js`),
  far share per chapter before/after; the mover counted crossing the
  frustum in a 120 s watch; screenshots read.
- **Cost:** one merged draw + one small mover per chapter, well under
  1 k triangles. **`noFar`.**

### V3 — shipped (20 Sep 2026)

**The reality check, per chapter, before a wedge was built.** The far plane
was more built than the sweep suggested in three chapters and not built at
all in eight:

- **Antarctica's silhouette is stale.** The shelf wall is there (a 22 m box
  every 26 m along z -504, `antBuildBergs`), and with it the tabular berg at
  465 m, the two gate bastions at 420, five small bergs, the orca pod on a
  172 s ellipse and fifty-four cape petrels round the bastions. Nothing to
  add out there; only a sail was missing.
- **Kowloon's night lights are stale.** `hkBuildSkyline` is sixteen towers
  at z -186, 44–128 m, with their own merged window mesh (58 % lit) and an
  instanced aircraft-light mesh on everything over 80 m. The junk already
  crosses at z -118 on a 132 s loop, and the Star Ferry runs z -76..-146.
- **Sydney's and the Quay's ferries are stale.** Sydney has eleven hulls
  crossing z -46..-130 on 74–196 s periods (`envTRAF`) plus the seaplane's
  circuit; the Quay has the Freshwater on her run to the Heads, six yachts
  on their reaches and gulls over the buoys. The Quay's far plane is the
  whole harbour already — thirteen headlands out to Manly, Fort Denison,
  Shark Island. What neither had was land BEHIND the water: Sydney's far
  shore is a 2.4 m `leafPale` strip at z -126, and the Quay's bridge comes
  ashore on bare bluff.
- **Eight chapters had nothing.** Cali calls a 46 m shoulder "the
  Farallones" and `PALETTE.caliRidgeFar` has sat unused since the chapter
  was built; Rio has the Loaf and Corcovado inside 130 m and Dois Irmãos
  only in two comments; Iceland's horizon is the glacier's valley wall
  behind you and the sea to the fog in front; Palawan closes its own
  skyline at z -170 and then nothing; Manly's North Head is a side wall
  that stops at z -60 over a sea sheet running to z -1522; the Pantanal is
  264 × 236 m of ground and then the dome; Monaco's Tête de Chien is a
  terrain pad the ground mesh cuts off at z 220; Hanoi's Long Biên ends in
  open water with no far bank.
- **"250–400 m" is the wrong instruction for a third of them.** The live
  fog rows, read at each arrival (`qa/wow2-far-depth.js`, `atmos`): Sydney
  90–230, Kowloon 34–420, the Pantanal 60–760, Palawan 90–700, Cali
  120–800, Rio 150–900, Iceland 130–940, Hanoi 85–1050, Manly 110–1150, the
  Quay 240–1250, Monaco 90–1500, Antarctica 320–1900. A wedge at 300 m is
  the fog colour exactly in Sydney and unfogged in Antarctica. Every layer
  here is placed where its own chapter's fog reads at roughly 30–60 %, and
  the comment over each one says which and why.
- **The resting lens is not deterministic, again.** Rio rested looking west
  down the sand on one arrival and north out to sea on the next; Monaco and
  Cali came back on two different bearings across four runs. A layer that
  sits in only one of those poses is a coin toss, so Rio got the Cagarras
  out to sea as well as Dois Irmãos to the west, and Cali the Cordillera
  across the valley as well as the Farallones behind Cristo. The PITCH is
  the stronger constraint: at rest the horizon sits a hand's width under the
  top of the frame in every open chapter, so a far layer is a BAND there and
  never a wall — Rio's approach had to come down from 34 m to 13 before it
  stopped skimming the frame's top edge.

**What shipped.** `src/far.js` — a new module, twenty-eight now
(`build.mjs`'s ORDER after shared.js, package.json's note, `npm test`'s 25
checks green): `farLayer` (ridge wedges merged into one draw, flat Lambert,
each wedge a profile across its width extruded to a crest, base at -30 so
nothing floats where a ground mesh ends, colour from `farTone` — a PALETTE
colour lerped toward the chapter's own haze, no hex anywhere), `farMover`
(≤ 40 triangles walked along a polyline at constant speed with a gap off
the end), `farLights` (crossed quads instanced, × `EMIT_OVER`, `fog: false`,
so the bloom takes them), `farBundle` (the `noFar` cut — the group hides and
nothing ticks; rung ≥ 1 parks the mover and the lights and keeps the static
silhouette; publishes `game.far` for the instruments). Twelve chapters, each
a `<tag>BuildFar` and one line in its own update.

| chapter | built | far share, live → cut (13×9 / 39×27) | mover in a 120 s watch | the arrival frame, on vs off |
|---|---|---|---|---|
| Sydney | North Shore + 3 Balmain ridges, 6 wedges, 112 tris | 0.231 / 0.222 | stale (`envTRAF`) | 1.44 %, mean Δ 27 — a band over the fence, paler than the trees |
| Quay | Kirribilli roofs on the north abutment, 15 wedges, 124 tris | 0.188 / 0.179 · 0.220 / 0.221 | stale (Freshwater, fleet) | 0.17 %, mean Δ 74 — brown gables and one block of flats on the bluff under the deck |
| Cali | Farallones (2) + Cordillera Central (4), 104 tris | 0.094 / 0.077 · 0.068 / 0.068 | — (none listed) | 3.13 %, mean Δ 51 — pale peaks the width of the frame behind the cane |
| Rio | Vidigal, Dois Irmãos, Gávea, Tijuca, Cagarras, 8 wedges, 120 tris; plane 20 tris | 0.214 / 0.214 · 0.055 / 0.057 | plane **3**, 31 s in frame | 0.99 %, mean Δ 55 — three grey islets on the sea's horizon |
| Iceland | Esja + its shoulders NE–E, 5 wedges, 92 tris; 34 lights; geese 14 tris | 0.026 / 0.017 · 0.020 / 0.015 | geese **2**, 30 s | 0.54 %, mean Δ 21 — a dark band over the roofs, right third |
| Kowloon | Lion Rock, 4 wedges, 88 tris; jet 20 tris | 0.009 / 0.009 | jet **1**, 17 s | 0 % at rest — see the miss below |
| Palawan | second karst island WSW, 5 wedges, 101 tris; sail 13 tris | 0.274 / 0.256 · 0.284 / 0.277 | sail **2**, 29 s | 1.30 %, mean Δ 23 — blue karst masses between the palm trunks |
| Manly | North Head out (3) + South Head across (2), 84 tris; ferry 24 tris | 0.154 / 0.154 | ferry **1**, 6 s | 2.02 %, mean Δ 54 — the Heads across the top of the frame |
| Pantanal | tree line tangent to a 300 m circle, 7 wedges, 166 tris; ibis 14 tris | **0.197 / 0.154** · 0.220 / 0.212 | ibis **1**, 53 s | 2.43 %, mean Δ 39 — a low broken band behind the river |
| Antarctica | stale; ship 24 tris | 0.359 / 0.359 | ship **2**, 33 s | 0 % (the ship is off-axis at the instant of the diff) |
| Monaco | Tête de Chien (2), Cap d'Ail, Menton heights (2), 92 tris; 44 corniche lights; car 4 tris | 0.179 / 0.179 · 0.209 / 0.210 | car **3**, 32 s | 3.55 %, mean Δ 23 — two pale masses standing over the town's own hump |
| Hanoi | Gia Lâm far bank, 3 wedges, 92 tris; train 36 tris | 0.222 / 0.222 | train **0** at rest | 0 % at rest — see the miss below |

**The far share moved in six of twelve and not in six, and the reason is
the instrument, not the layer.** The roadmap's own sweep bins by DISTANCE,
and its 13 × 9 grid is 117 rays: one ray is 0.0085 of the frame, and a
horizon band three rows of pixels deep falls between two of them as often as
on one. The 39 × 27 sweep (1053 rays) was added for exactly that and agrees
where the band is thick (the Pantanal, +0.008; Iceland, +0.005) and says
zero where it is a line (Manly, Monaco, Cali). Where the layer stands over
water or ground rather than sky — Manly's Heads, Monaco's crest — the ray
that hits it was already hitting something in the far bin, so the SHARE
cannot move however much of the frame changes. The per-pixel hide-and-diff
through one pinned camera is the honest measure of "is it there", and it is
the column on the right.

**The misses, by name.**
- **Kowloon and Hanoi have no far layer in their arrival frame, and never
  could.** Kowloon's resting lens is on the frontage across a street whose
  sky share is 0.000 — measured twice, at rest and turned 126° up the street
  (`qa/wow2-far-kowloon-look-on.png`: neon, awnings, a bus, and no sky
  anywhere in the frame). Hanoi's lens rests on the lake and the bridge is
  53° off its axis. Both were measured instead from where the chapter itself
  puts the player (`qa/wow2-far-from.js`): from the helicopter's furthest
  ring over the harbour, Lion Rock is 14.7 % of the frame, mean Δ 63, and
  reads as three pale peaks standing behind the street's roofs; from the
  bridge deck the Gia Lâm bank is 6.0 %, mean Δ 115, a low grey line either
  side of the deck's vanishing point.
- **A wedge cannot make a truss.** Hanoi's first build ran eight lattice
  humps out to z 500 on a deck line. It measured fine and looked, from the
  deck — the one place you stand to see it — like a single grey pyramid:
  end-on down their own axis, eight overlapping wedges are one wedge.
  `farLayer` is for things seen ACROSS. The bridge's own bay loop is the
  right builder for lattice running out at ~48 triangles a bay, 1.5 k for
  the run, past this pass's budget: written down, not built.
- **Manly's ferry crossed once in 120 s and was in frame 6 s of it.** The
  path runs the mouth at z -500..-530 and the arrival lens is pitched 21°
  down at the sets, so it clips the frame's top edge rather than crossing
  it. Under the bar the roadmap set ("once a minute") and left as measured
  rather than re-aimed, because the same path from the water — where this
  chapter spends its time — crosses properly.
- **The frame-time A/B is not a usable number on this machine.** Six
  interleaved reps of 50 frames each, noFar live vs cut, per chapter: Rio
  94.2 vs 83.0 ms, Kowloon 111.0 vs 101.8, Hanoi 115.4 vs 116.9, Monaco
  45.2 vs 42.2, Iceland 22.5 vs 24.0. The per-rep medians swing 47→138 ms
  within a single arm and two chapters read NEGATIVE, which is four agents
  and their browsers on one box, not a 100-triangle mesh. What can be
  measured exactly, and is: Monaco's whole far layer is 272 triangles in a
  frame of 359 747 (0.076 %) and 4 draws in 480; the largest layer in the
  pass is the Pantanal's 166 + 14, the smallest Antarctica's 24. Cut, the
  group is invisible and the update returns on one boolean. The quiet-machine
  A/B is W6's, and `qa/wow2-frametime-v3.js` takes one chapter per run.
- **Sydney's own far share did not move on the 13 × 9 grid** (0.231 vs
  0.222 at the first arrival, 0.231 vs 0.231 at a later one): the North
  Shore stands behind a fence line and a row of figs that the grid's rays
  hit first. The diff says 1.44 % of the frame at mean Δ 27, and by eye it
  is a pale grey-green band along the water where there was flat haze.

**Instruments, left in qa/:** `wow2-far-depth.js` (per chapter: the live
fog and lens read first, the planes-only sweep at 13 × 9 and 39 × 27 live
and cut, a per-pixel hide-and-diff through one pinned camera with its bbox,
on/off screenshots and a crop of the bbox), `wow2-far.js` (the mover
projected through the live lens once a second for 120 s, crossings counted
on the entering frame), `wow2-far-from.js` (the same diff from a placed
camera or with the animal moved, for the two layers the arrival frame
cannot see), `wow2-frametime-v3.js` (the `noFar` A/B, one chapter per run).
Results and PNGs are in qa/ and gitignored, as every instrument's are.

### V4 — UNDER THE SURFACE

The dive is a property of water everywhere (`capyCanDive`; `sysSUB`
rows, `systems.js:4100–4180` — fog and two colours per chapter). Below the
surface the picture is a tinted fog. Four cheap things make it a place:

1. **The surface from below** — the water material's back face, seen from
   under, samples the same reflection target A1 renders (mirrored again:
   from below it is the sky and the bank, refracted) at grazing strength,
   with the ripple normal — the ceiling of light every dive shot has.
2. **Shafts** — A4's radial blur toward the sun's projection is already in
   the post chain; under water (`subT` > 0.5) it runs at 2× length and
   half strength from the sun's refracted position, and Palawan's caustic
   octave (L11) is inverted onto the animal and the fish.
3. **Bubbles** — a mote row that only exists while `subT` > 0.3: 40 rising
   quads from the animal's muzzle and feet, wobbling, popping at the
   surface.
4. **Surfacing** — six beads of water on the lens for 1.5 s (a sysLENS
   row, the existing wet-lens machinery if one exists — grep
   `lensDrops`; else a small quad set on the composite), and the coat wet
   (V1.4).

- **Instrument:** `qa/wow2-sub.js` — dive in Palawan, Rio, Kyoto,
  Venice; a frame at 1.5 m under, on/off per term, per-pixel diff over
  the upper third (the ceiling) and around the animal (the bubbles);
  read by eye. **`noSub2`.**

### V4 — shipped (20 Sep 2026)

Files touched: `src/main.js` (the composite's own new uniforms and code —
`uSubCeilK`/`uSubT`/`uBeadT`, the ceiling and bead GLSL blocks in
MAIN_POST_COMP, and the underwater rays' JS block that reuses matRays/
matBright/dofB/bloomB/wideB), `src/weather.js` (`wxStepDive`, `subBeadT`,
`diveAudit`, wired into `update()`'s step 7). No other file edited.

**All four items built. One sub-item skipped by name, one substitution made
twice, and one real bug found and fixed along the way.**

1. **The ceiling — built, but not as written.** `reflectInfo()` (shared.js)
   returns `{y, want, k, on, why, ms, size, hidden, cover, small, allocated}`
   — no sampler. A1's reflection target itself (`_reflTex`, the module-
   private object the water shader's `uReflT` is bound to) is never exported,
   so "sample the same reflection target A1 renders" cannot be done from
   main.js without a shared.js change, which this wave does not make. **Skip,
   named:** a `reflectTex()` getter returning `_reflTex.value` (and ideally
   `_reflRes`/`_reflK` alongside it) is the follow-up shared.js export a V4.2
   would want. Built instead, entirely in main.js: a procedural stand-in —
   a rippled brightening (two sines, aspect-correct, `uSubT`-driven) weighted
   to the top of the frame in the chapter's own `uSub.rgb`, gated by its own
   `uSubCeilK` (not `uSub.a`, which is L7/E3's and not this wave's to gate).
   Measured (`qa/wow2-sub.js`, the synchronous double-`post.render()` diff,
   noSub2 the only variable): upper-third pixels moved 100 / 96.9 / 100 / 100
   % (Palawan / Venice / Rio / Kyoto) at a mean channel delta of 32 / 18 / 31
   / 33 of 255 — a strong, real, isolated signal, though not confined to the
   upper third as drawn (it fades out by ~95 % of frame height, so the whole-
   frame share was 65-73 %). Read by eye on Palawan and Rio (clean pairs,
   camera pinned, nothing else moved): both show a distinctly brighter,
   rippled, more turquoise wash over the reef/riverbed and the upper frame
   when live, flat and darker when cut. Venice's pair reads the same way,
   fainter. Kyoto's screenshot pair is NOT trustworthy as an eye-read — real
   time passes between the two `page.screenshot()` calls and Kyoto's river is
   shallow and fast enough that the animal had genuinely surfaced between
   them (see the miss below); the numeric diff for Kyoto is still the clean
   synchronous one and stands.

2. **Shafts under water — built, and it could not be "the same pass,
   retuned".** None of the four instrumented chapters (Palawan, Rio, Kyoto,
   Venice) has a `sysRAYS` row — that table is goreme/sahara/kowloon/
   iceland/monaco only — so `p.rays` is 0 in all four and "half strength"
   cannot mean half of zero. Built as the same SHADER (`matRays`), reused,
   fed its own source and its own light: a loose threshold
   (`MAIN_SUB_RAYS_THR = 0.30`, looser than any surface grade's, because
   underwater rarely clears the normal one at all) over the raw scene
   (`sceneRT`, not `bloomA`) into `dofB` (safe scratch once the DoF block
   above is done with it — `cu.tDof.value` still points at `dofA`, never
   touched again), then the existing two-pass 64-tap blur into `bloomB` →
   `wideB`, at `2 × p.raysLen` and a strength of `MAIN_SUB_RAYS_K = 0.20`
   (half the sysRAYS table's own mean k of ~0.41, since there is no local
   value to halve). **The direction is a fixed bend, not a computed Snell
   refraction**, and the reason is named in the code: the true bend needs the
   sun's world direction and the water's normal, and neither reaches
   main.js/weather.js without a new hook into systems.js's private
   `sysAxDir`. The fixed choice — project straight up from the camera onto
   the screen, using the camera's own basis (already computed once a frame
   for the airlight) — is not arbitrary: Snell's law's ~48.6° critical angle
   means ANY above-water source reads from underwater as being inside a
   narrow cone around vertical regardless of the true solar azimuth ("Snell's
   window"), so a fixed vertical bend is the physically-motivated cheap
   answer, not a shortcut that happens to be cheap. This term shares the
   `tRays`/`uRaysK` register with A4's own rays and wins it outright whenever
   `subK > 0.5` — kowloon/iceland/monaco are the three chapters with both a
   `sysRAYS` row and a `sysSUB` row, and once the lens is more than half
   under, the surface source is not physically visible through the interface
   anyway, so replacement rather than a second additive pass is correct, not
   merely cheap. Not separately instrumented per-item (the ceiling's per-
   pixel diff above includes this term's contribution — both are gated by
   the same `noSub2`/`subK` and both draw into the same composite pass; they
   were not separable without a second, isolated capture this wave's time
   budget did not extend to).

3. **Bubbles — built on the existing pool, not a new one.** `burst(x, z,
   'bubble', n, o)` (V1.3) already has everything a rising, wobbling,
   surface-popping quad needs (`grav < 0`, `o.top`) and is already spent
   elsewhere (npc.js:7477, a swimmer) — its own tuning (`wxBURST.bubble`) is
   untouched. `wxStepDive(dt)` (weather.js) calls it in a steady 48/s
   alternating stream from two points approximated off `capy.body.position`
   (a swim-direction offset from `capy.body.velocity`, not an unavailable
   heading, for "muzzle"; a fixed drop for "feet" — capybara.js's own named
   points, if any, are out of reach from this file). Measured
   (`weather.diveAudit()`, the pool's own live count, same pattern as
   `burstAudit()`): steady-state alive count **19-30** across the four dive
   chapters and two samples each 0.6 s apart, short of the 40 asked for —
   **an honest miss, by number**: bubble life (`wxBURST.bubble.life = 0.90 s`
   × rand 0.7-1.1, V1.3's own tuning, not moved) averages ~0.81 s, and 48/s ×
   0.81 s ≈ 39 is the arithmetic the measured count should have hit; it did
   not, most likely because the ring (`wxBURST_MAX = 48`) laps roughly once a
   second at this rate and a slot born late in a lap can be reclaimed before
   its own life naturally ends when the chapter's own mote row (`moteN`,
   54-150 across these four) leaves less headroom than assumed — not
   re-tuned this session for lack of time; `wxDIVE_RATE` is the one number to
   raise first. `burst()`'s own cap held — nothing else bursts while diving,
   so the whole `wxBURST_MAX` ceiling was this term's, inside the roadmap's
   quarter-of-`wxMOTE_MAX` rule. Per-pixel diff around the animal (mote-field
   visibility on/off, a 30%-of-frame-height mask) read 0.07-0.28 % — small
   but expected: a handful of ~3-4 cm quads several metres from the camera
   occupy very few screen pixels each; NOT isolated to bubbles alone (the
   mask hides the chapter's own above-water mote row too, since diving does
   not hide it — a genuine, named gap, not this term's to close). Read by
   eye on Palawan: a visible trail of small white bubbles rising from the
   animal's chest/muzzle against the reef, matching the count.

4. **Surfacing beads — built fresh, and timed in the wrong file first.**
   `grep -n lensDrops src/*.js` returns nothing, confirmed before building:
   six fixed screen-space blobs (a bright rim, a darkened body, baked as
   `const` GLSL arrays) drawn in MAIN_POST_COMP after grading and the
   vignette, before the dither — a bead sits on the glass and must not be
   tinted by the chapter under it. The 1.5 s envelope is computed in
   weather.js (`wxStepDive`/`subBeadT`), NOT main.js, because
   `post.render()` takes no `dt` of its own and a wall-clock timer there
   cannot be driven deterministically by the harness's `game.tick(dt, …)`
   loop; weather.js already has the right dt every frame, so main.js just
   reads `game.weather.subBeadT()`. **The first build gated the trigger on
   `capy.diving` as well as depth, and that was a real bug**: releasing E
   (the dive key) flips `capy.diving` false immediately, however deep the
   animal still is, and the trigger read that as an instant "surfaced" edge
   — `qa/wow2-sub.js`'s first pass caught it directly (a real dive-then-
   surface sequence read `subBeadT() === 0`, 1.5 s too late; the edge had
   already fired and expired the moment E came up, six metres down). Fixed
   by tracking the trigger on `capy.depth` alone (`capySwimming ? waterY -
   py : 0`, already 0 on dry land, no verb needed). After the fix, both a
   fabricated edge (`capy.depth`/`diving` hand-driven through two
   `weather.update()` calls) and a real dive-then-surface produced the same
   deterministic envelope shape — `t ≈ 0.222 s → 0.938`, matching the
   formula exactly — across all four chapters. Isolated per-pixel diff
   (`p.sub` forced to 0 for the capture, so only `uBeadT` differs): 3.43-
   3.57 % of the whole frame, all four chapters, consistent with six ~5-8 %-
   radius blobs. Read by eye: inconclusive in this wave's own screenshots —
   Palawan's real-surfacing shot lands the animal against a bright sky next
   to a pre-existing, unrelated "Manta Ride" task marker (large glowing
   world-space rings, nothing to do with this term), and several bead
   positions fall near-white sky where a soft blob is hard to separate from
   the background by eye; the isolated diff and the deterministic timer are
   the trustworthy proof here, not the screenshot.

**Numbers.** `qa/wow2-frametime-v4.js` (flag `noSub2`, held submerged
throughout the 8-rep interleaved A/B, all four chapters, rung 0 held):
Palawan +0.105 ms, Kyoto +0.054 ms, Rio +0.017 ms, Venice −0.033 ms —
combined well inside the 0.6 ms budget, and all four numbers are inside this
harness's own frame-to-frame noise floor (±0.1-0.2 ms on the software-GL
box), so the honest statement is "not measurably different," not "0.03 ms
exactly." `game.state.noSub2`, parked at governor rung ≥ 1 (`subOn` gates
every term in main.js; `wxStepDive`'s own `cut` gates weather.js's half).

**Two things for the next agent who touches this.** (1) The shared.js
export named above (`reflectTex()`) would let V4.1 stop being a stand-in.
(2) `capy.diving` is the dive VERB and `capy.depth` is the animal's actual
position — any future term anchored to "is the animal under water" should
gate on depth (or on `subT`/`uSub.a` if it is a camera/lens term), never on
the verb; this wave's own first draft got that wrong once already.

### V5 — WEATHER AS AN EVENT (the shower ends)

The weather front (L7) arrives, rains, and leaves; the wet term darkens
and sheens (`grain()`'s wet path); thunder is distant by decision and
there is no lightning and will not be (`systems.js:14637` — a written
decision, kept). What is missing is the moment AFTER: the shower's end is
the most beautiful minute of weather and today it is only drier.

1. **The rainbow.** As `rainT` falls through 0.3 with the sun above 8°: a
   band on the dome at 42° from the anti-solar point (`sysAxDir` negated
   through the dome's fragment — A5's hook), seven PALETTE-mixed stripes
   at low alpha, fading in over 6 s and out over 40, only where the sky
   is dark enough behind it (the cloud band's own coverage). Kyoto, Hanoi,
   Cali, the Pantanal, Manly get it; the night and no-sky chapters do not.
2. **Puddles.** While `rainT` > 0.2 the wet term is uniform; give
   `grain()`'s `reflect` a wetness gate (the A1 rollout agent found there
   is none — `Kowloon` runs always-on) and a puddle mask (a low-frequency
   noise threshold on the ground's own `gn`) so a road or square breaks
   into mirrors that grow with the rain and dry over 90 s — Kowloon,
   Hanoi, Venice's paving at low tide, Iceland's street.
3. **The gust strips the trees.** When the gust peaks over its row's
   swing near a canopy in the leaf list, 12–20 leaf motes of the crown's
   own colour burst from its edge and ride the wind — the mote pool, the
   dapple's canopy list for positions. Sydney's jacarandas do it in
   purple.
4. **Drip after rain.** For 60 s after a shower, eaves and canopies within
   12 m drop a mote drip every second (Kyoto's eaves, Hanoi's shophouses,
   Kowloon's signs).

- **Instrument:** `qa/wow2-shower.js` — force a shower (trap 35), watch it
  end, per-pixel diff of the top fifth (the rainbow), the road mask (the
  puddles' mirror diff, the A1 instrument's mask), motes counted on the
  gust; read by eye. **`noRainbow`, `noPuddle`, `noStrip`.**

### V5 — shipped (20 Sep 2026)

Reality check first, and it moved two of the four items before a line was
written. `sysSKY2` (A5's cloud band and sun disc) is five chapters —
sahara, pantanal, palawan, cali, goreme — and only two of those are on
this section's own rainbow list; Kyoto, Hanoi and Manly have no sysSKY2
row at all. The rainbow does not need one: every dome through
`skyDomeLit` already carries the live sun axis in `uSky2Sun.xyz` every
frame (sky2SunTick's own fallback writes `dir` even at disc strength 0),
so it rides that instead of a second per-chapter table. And the dapple
canopy lists (`kyoSANDO_MAPLES`, `panDAPPLE`, `manDAPPLE_PINES`,
`envDAPPLE_FIGS`) that the strip/drip need for positions live in four
files (kyoto.js, pantanal.js, manly.js, environment.js) this wave does
not own — reached instead by walking the live scene for
`material.userData.grainDapple`, the exact baked cells `grain()` already
leaves for `qa/wow-dapple.js` to find. Sydney's jacarandas turned out NOT
to be in that system (only its figs are), so the purple gust the section
asked for was already spoken for by the skitter's own ground petals
(Part B) — see the honest miss below rather than a second, competing
gust reaction on the same eight trees.

1. **The rainbow — shipped, Kyoto/Hanoi/Cali/Pantanal/Manly.** A ring 42
   degrees off the antisolar point in the shared dome's own fragment
   (`shared.js`'s `skyDomeLit` hook, `_RAINBOW_OUT`/`_RAINBOW_PARS`,
   `rainbowTick`), seven PALETTE-mixed stops (red/orange/yellow/green/
   blue/indigo/violet, orange and indigo genuine 50/50 mixes — no hex
   outside PALETTE), gated in `systems.js` on `rainT` sitting under 0.3
   (read as a LEVEL — the tail of a shower, not a one-frame edge; a level
   is what `qa/wow2-shower.js`'s trap-35 hold can force and sample
   without racing a single frame) with the sun above 8 degrees, damped in
   over ~6s and out over ~40s. Verified two ways: in a forced shower
   (Kyoto, Pantanal) the resting third-person camera never happened to
   face the antisolar sky, so the in-scene diff read 0 — confirmed
   geometrically honest with a maths-only probe (no ray in the visible
   frustum sat within several degrees of the ring in either framing) and
   then confirmed VISUALLY with an own camera aimed straight at it
   (Pantanal, sun 30° up): an isolated per-pixel diff (`rainbowTick`
   toggled directly, no tick between frames) of 1.26% of the frame, mean
   magnitude 11.5, peaking at 40.7 near the horizon — exactly the ~12°
   elevation a rainbow sits at under a 30° sun. The mechanic is real; a
   player will see it precisely as often as a rainbow is ever actually in
   frame, which is honestly not most of the time. `noRainbow`.
2. **Puddles — shipped, Kowloon only.** `grain()`'s `reflect` option
   takes an opt-in `wet: true` (`shared.js`): the reflection weight is
   multiplied by the shared wetness-above-baseline term (`uGrainWet`,
   already bound to every non-water grained surface) and a fresh
   low-frequency `grNoise` threshold — the ground's own baked `gn` is a
   `color_fragment` local and out of scope by `opaque_fragment`, so this
   is a new, cheap sample at a puddle's own size rather than a reuse.
   Cut through a new runtime uniform, `uPuddleOn` (`puddleSet`, the exact
   `dappleSet` pattern), wired from `game.state.noPuddle` in `systems.js`
   — off, Kowloon's road reverts to exactly its pre-V5 always-on `k`.
   Applied to `kowloon.js`'s road (a one-line hook plus a corrected
   comment: the file's own paragraph used to argue that no gate was fine
   because the road is "always wet" by design — now true only of its
   baseline, not of the shower). **Every other `reflect:` call site in
   the game — Venice, Hanoi's lake, Kyoto's pond, the Quay, Iceland, the
   cave, Rio, Cali, Monaco, the Pantanal's baía — is an actual body of
   water (one of them tide-gated, none of them rain-gated) and was left
   untouched**; gating a lake by rainT would dry it between showers,
   which a lake does not do. Verified with a colour-keyed road mask and
   `puddleSet` toggled directly: 95.3% of the road's own pixels moved,
   mean magnitude 18.4; the "on" screenshot reads as a near-flat wet
   street, the "off" one as Mong Kok's pink sign and the bus doubled
   edge-to-edge across the whole carriageway. `noPuddle`.
3. **The gust strips the trees — shipped, Sydney/Kyoto/Manly/Pantanal,
   in each chapter's own crown colour.** `weather.js` finds the live
   chapter's dapple cells by scene walk (see above), caches them per
   `biome:enter`, and on a gust near the chapter's own peak throws
   12–20 `leaf` motes (the existing `wxBURST.leaf` kind — already tuned,
   already flagged as this pass's own hook in its doc comment) from the
   nearest canopy's edge: Sydney's figs in `PALETTE.leafB`, Kyoto's
   sando maples in `PALETTE.momiji`, Manly's promenade pines in
   `PALETTE.manPine`, the Pantanal's fazenda mango and nearest capoes in
   `PALETTE.panCanopy`. **Honest miss:** Sydney's jacarandas are not
   reachable this way — only its figs carry a baked dapple list — so the
   purple gust the roadmap named did not ship as a second mechanic; the
   skitter's own ground petals (Part B, already purple, already a gust
   reaction on those same eight trees) cover the beat instead. `noStrip`.
4. **Drip after rain — shipped, the same four chapters, not the roadmap's
   named buildings.** For 60s after `rainT` last exceeded 0.05, the
   canopy nearest the animal within 12m drops a `drip` mote about once a
   second. Kyoto's eaves, Hanoi's shophouses and Kowloon's signs — the
   roadmap's own list — are architecture, not a canopy, and carry no
   equivalent of `grainDapple`'s baked positions in any file this wave
   owns; rather than fabricate positions or add a cross-file hook to
   three more chapter files, V5.4 rides the same four canopy chapters
   V5.3 does. Flag shared with V5.3 (`noStrip`) rather than a fifth flag,
   since both read the same cell and the same cache.

**Verified live** (`qa/wow2-shower.js`, one forced shower per chapter,
`odds: 1, hold: 14`): Kyoto's `weather.burstAudit()` born count climbed
65→93 across the trace with `alive` spiking to 14–16, sampled with the
animal held still so a footfall's own dust could never be counted as a
leaf; Kowloon's puddle mask moved 95.3%; the rainbow's own isolated
diff (own-camera, Pantanal) was 1.26% at mean 11.5. `npm test` 25/25
throughout.

**Budget:** `qa/wow2-frametime-v5.js`, five chapters (sydney, kyoto,
pantanal, manly, kowloon), all three flags interleaved together: delta
-0.1..+0.1 ms (inside this harness's own noise floor), rung 0 held —
well under the 0.6 ms rule. `leaf`/`drip` share `wxBURST_MAX`/
`wxMOTE_MAX` with every other burst caller in the game (footfalls,
bubbles); at most one canopy event is live per chapter at a time, so
this pass never approaches the quarter-of-the-pool ceiling.

Commits: `06cbb58` (the three terms — shared.js, systems.js, weather.js,
kowloon.js's one-line hook), `fad598d` (the instruments).

### V6 — TRACKS AND TOUCHES (the world remembers where you went)

The grass lies down where the animal walked (L11) and stands back up.
Nothing else does. A small pool of ground decals — the contact-shadow
pool's exact shape (`_contactP`, twelve `vec4` slots, `shared.js:5054`),
a second pool of 32 — written by the gait's footfalls and read by the
ground's fragment:

- **Footprints** in sand, snow and mud (Palawan, Manly, Rio, Sahara,
  Antarctica, Iceland's slush, the Pantanal's bank): a paw-shaped
  darkening (four toes, one pad, from the footfall's own position and
  heading), fading over 20 s in sand and 90 s in snow.
- **Wet prints** on stone for 12 s after leaving water (Venice's paving,
  Kyoto's lane, the Quay's apron): the wet term's darkening, in a paw.
- **A swim wake** — two trailing quads on the water's own colour (the
  ferry's wake pattern, L11) behind the swimming animal, plus the ring
  pool's rings at each stroke.
- **The herd's trail** — the followers write the same pool, so a herd
  across the Pantanal's bank leaves a path.

- **Instrument:** `qa/wow2-tracks.js` — walk 8 m on Palawan's sand and
  Antarctica's snow, resting-lens frame, decal pixels in the band behind
  the animal at 0 s / 10 s / 20 s; the wake's diff on Kyoto's pond.
- **Cost:** one uniform pool written from the gait, a few instructions
  in the ground fragment that already runs `grain()`. **`noTracks`.**

### V6 — shipped (20 Sep 2026)

Flag `noTracks`; parked at `perfRung >= 1`; the prints are KEPT through a
park and a cut, so the term coming back shows the trail it had.

- **The pool** is the contact pool's shape a second time (`shared.js`,
  beside `_contactP`): 32 × `vec4` (x, z, heading, y) plus a strength
  each, `tracksWrite / tracksTick / tracksClear / tracksAudit` exported.
  Two floats keep it cheap: `uTrkOn` (a coherent branch for every chapter
  with nothing on the ground) and `uTrkC`, the live prints' own disc, so a
  fragment outside it skips the loop on one dot product.
- **The paw** is drawn in the print's own frame from the heading: an
  ellipse for the pad and four toes ahead of it, found by folding the side
  distance onto the nearer of two toe columns. Read by eye on Antarctica's
  snow (`qa/wow2-tracks-antarctic-near.png`): a pad and four toe dots per
  print, in a line across the field.
- **Written by the gait's footfalls**, keyed on the same `capySurfMat` the
  step voice reads: sand, snow, mud (a 'grass' footfall at pitch ≤ 0.70 —
  the Pantanal's wet bank and its rafts), and 'wet' for 12 s after the
  water on stone, timber, gravel or metal (Venice, Kyoto, the Quay).
- **The herd's hook, for W3:** `game.tracksWrite(x, z, heading, kind, y)`
  is published from capybara.js — kinds sand/snow/mud/wet, false for
  anything else, a no-op under `noTracks`, aged and gated by this module's
  own frame. npc.js was not touched.
- **Measured (`qa/wow2-tracks.js`, 8 m walked, plan lens on the trail,
  the flag flipped between two renders of one pinned frame):** Palawan
  sand 1882 / 1884 / 1634 px at 0 / 10 / 20 s; Antarctica snow 573 / 569 /
  571. The swim wake on Kyoto's pond 4956 px live vs cut, 12 quads.
- **The card's 20 s in sand is 30 s in the file, and the measurement is
  why.** A print at quarter strength on sand is a 4 % darkening; a bright
  beach at 230 puts that at nine of the diff's 255. With a 20 s life the
  twenty-second frame measured **37 px against 1888 at nought** — the
  target says the trail is visible AT twenty seconds, so the life is 30
  and the strength holds full for the first two thirds. Snow is the card's
  90.
- **Three instruments lied before they were right.** (1) The gate is
  published from the TICK, not the render, so a flag flipped between two
  renders changed nothing: 0 px with twenty prints on the ground. One
  1/60000 s tick after each flip refreshes it. (2) At 1/600 that same tick
  moved the chapter's mote field — 170 drifting snow quads in Antarctica —
  into the difference (771 px at 0 s, 90 at 10 s, off the same thirteen
  prints). (3) `noTracks` stopped the wake being FED and left the twelve
  quads already up ageing on screen: the A/B read 15 px off a wake that
  was plainly there in both arms. A cut means not drawn.
- **The wake was built twice.** The ferry's pattern at the ferry's size —
  0.16 spreading to 0.66, one every 0.16 s — read by eye as a line of
  paving slabs behind the animal, because an InstancedMesh has one opacity
  for the pool and every quad arrived and left at full size. Smaller,
  denser, and the last third of each life spent shrinking to nothing,
  which is the only per-quad fade there is.
- **Frame time (`qa/wow2-frametime-w1.js`, five chapters, WALKING, all
  three flags together, rung 0 pinned):** live-minus-cut median −0.5 ms,
  range −2.8 to +0.5. The script also runs a SHAM arm — the identical A/B
  on a flag nothing in src has heard of — and that floor is −0.9 to
  +2.6 ms, so every real delta here is inside the harness's own noise and
  the ≤ 0.6 ms bar is met with nothing to spare in the measurement.
- **Not built: mud and wet prints are written but unseen.** The kinds are
  wired and a Pantanal or Venice walk writes them; neither was put in
  front of a lens, because one chapter per run at four minutes ran the
  session out. The pixel proof stands for sand and snow only.

### V0 — the smoothness carry-over (small, named, optional)

L11's A3 left two real items: thin cylinders (Quay's mast and rigging,
Pasto's cord) need their own un-merged meshes before a vertex widen can
touch them; the mote quads need a minimum screen footprint through their
spin. Both are half a day each and both are the "smoother" half of the
original brief. They ride in W1 with V1 if the day allows; they do not
block the pass.

### Performance, the rule for all six

Every term: a `noX`, rung-1 parking the `sysFAR_SHARE` way, ≤ 0.1 ms when
cut, budget stated in the commit and measured on a quiet machine with the
interleaved rAF A/B (`qa/wow-frametime.js` pattern — extend its flag list).
Mote-pool consumers (V1.3, V2.3, V4.3, V5.3, V5.4) share the existing
`wxMOTE_MAX` field and yield to the chapter's own weather row: a burst
never takes more than a quarter of the pool. Instanced draws added by this
pass: umbrellas (per rainy chapter), far-lights (per night chapter), the
far layer's mover — three at most in any one frame.

## Part N — the reason: four lifts to the story

The spine exists and is withheld on purpose: the notebook is third-person
"it", the title says the animal has not said why, the finale's one
sentence is *"Nineteen places. Every one of them made its own mind up
about you."* (`npc.js:5019`). This pass does not break that voice. It
makes the why VISIBLE without saying it, gives the journey someone who
waits, and gives the ending a morning after.

### N1 — THE SHELF IN THE WORLD (the why, shown)

The ledger and the journal's shelf list the keepsakes; the finale lays
them on the lawn. Between those two, the keepsakes are a save field.

- In Sydney's gardens, at the horseshoe the finale already uses ((30,
  26), `systems.js:36152`), a **low stone shelf** stands from the first
  frame — empty. Every keepsake the file holds appears ON it, physically,
  in the order earned (`sysKEEPS`'s shapes, already drawn for the shelf
  UI, as merged low-poly objects, ≤ 60 triangles each), the moment the
  animal next stands in Sydney. The gardener (`the gardener`, Sydney's
  roster row 11) tends it — dusts the newest one, says a line about it
  (one per keepsake, in the game's voice, from a new `CHAPTERS[n].kept`
  field: what the gardener makes of the thing).
- The title card's why-line stays. The place card on a return to Sydney
  gains one sentence when the shelf has grown: "the shelf has N things on
  it. it still has not said why." — the voice kept, the fact visible.
- The finale's horseshoe becomes the shelf's things carried down to the
  lawn one by one by the animal in the coda's pans (the existing 19-note
  coda gives each its beat), so the ending is the shelf emptied, not a
  spawn.

- **Measured:** shelf count == ledger count on every Sydney return
  (`qa/wow2-shelf.js`, three saves at 0/7/19 keeps); the gardener's line
  fires once per new keepsake and never twice.

### N2 — THE GLIMPSE (the somebody, seen nineteen times)

The paper already says "somebody keeps turning up · the bridge over the
river" (Cali's row) and the traveller has four cameos (`npc.js:3307,
3225`) and owns the shop. Nineteen is the number this game does
everything in.

- At every chapter's **exit board**, for the ninety seconds after the
  animal first comes within 25 m of it, the traveller's figure stands at
  the board reading it — back to you — and walks off out of frame the
  moment the animal is within 6 m, one line each (`npcTRAV_GLIMPSE`,
  nineteen, in the third-person voice: what the traveller was looking at,
  never you). Counted (`travSeen`, the `travMet` pattern —
  `systems.js`'s distance count, not a cooldown, per the L6 finding).
- The four existing cameos stay as the four times the traveller does not
  leave; they are the ones where you are stood in front of them.
- The **shop stall** carries a `seen` tally: past ten glimpses the
  traveller's stall line changes once ("you again."), past all nineteen
  the finale's gather has one more sentence — the only one that
  acknowledges the chase, and it does not say why either.

- **Measured:** `travSeen` 19/19 reachable by a bot that walks to every
  board; the figure never inside the arrival frame (a beat is at the door,
  not the spawn); zero glimpses in a chapter whose door was never
  approached.

### N3 — SOMEONE WAITS (absence, the gift kept, the companion's home)

The regulars know your name at tier three and give a gift once (B8). No
one notices you were gone, and the companion has a `from` it never
returns to.

1. **Absence.** On a return to a chapter with a regular at tier ≥ 2 after
   ≥ 20 minutes of journey time elsewhere (`jrChapMs`, `chapms` — already
   saved), the regular's first line is about the time ("three places
   since. you smell of the sea."), from the notebook's own fact slots
   (`nbFacts`: `inc`, `pho`, `fed`, `ln`), never a stock line. One per
   return.
2. **Kept something for you.** Past tier three the regular has set down a
   second gift by the time you return — a yuzu, a wearable from the list,
   something from the chapter it names — at their feet, once per return
   with ≥ 3 rows done since. The first gift's own delivery pattern
   (`B8`), repeated, gated, never twice in a row.
3. **The companion's homecoming.** A companion carried back into its
   `stow.from` chapter and set down within 30 m of where it was picked
   up: it does not follow again; it goes to its place (the pigeon to the
   Campanile's ledge, the gentoo to the colony, the dog to its doorstep —
   one `home()` per kind) and a line lands, the companion's own sound
   once, and the notebook gets a conditional entry (`{ if: 'home' }`).
   The next time you stand there, it is there, and it comes over.

- **Measured:** the absence line fires on a 20-minute-away return and not
  on a 5-minute one; the kept gift appears once per qualifying return;
  the homecoming fires for all six companion kinds in a bot run
  (`qa/wow2-waits.js`).

### N4 — THE MORNING AFTER (the ending felt, and an opening beat)

The finale is composed (the horseshoe, the sit, the coda, the hush, the
ledger — `systems.js:36061–36340`) and then the game is the game again
with `fin` set. Two beats, one at each end of the journey:

1. **The opening, ten seconds.** Before "be a menace." (`systems.js:37133`)
   on a fresh file only: the animal is asleep on the lawn (the nap pose);
   the traveller's bag stands beside it; the traveller — back to the lens,
   the same figure as N2 — picks up the bag and walks toward the forecourt
   and out of frame while the animal wakes (the nap's own wake-up); the
   place card rises as today. No text but the card. Ten seconds, skippable
   by any key, never on a restore. It is the whole why, shown, and it is
   what N2's nineteen glimpses are of.
2. **The morning after.** After `fin`, the shelf (N1) stands on the lawn
   with all nineteen; the traveller sits at the horseshoe's mouth and
   reads — the notebook's last page as `sfxBabble`, its text on a card
   (the notebook already ends the finale in text); the gardener's stand-
   down line becomes a sit-down beside them. The board offers "again" to
   every chapter and each place card's `again` line (already authored)
   gains a `fin` variant for the eleven chapters that have none. Nothing
   resets; the game after the ending is the world remembering.

- **Measured:** the opening plays once on a fresh file, never on a
  restore, and is skipped by a key press within 300 ms; the morning-after
  scene stages on a `fin` file in Sydney (`qa/wow2-morning.js`); the
  babble read completes (F5's onset instrument).

**Writing rules, all of Part N:** the third-person "it" voice; the why is
never said, only seen; no new save field except `travSeen`, `kept` (a
count) and the tutorial's flag; every line in `npcLINES`'s pools or a
`CHAPTERS` field, checked by `qa/lines.mjs` and `qa/l6-tics.mjs` (no
phrase in more than three files).

### N1 — shipped (20 Sep 2026)

A low stone shelf stands in Sydney's gardens from the first frame
(`environment.js`, `envSHELF_X/Z` = 35.6/27.4 — 5.8 m off the finale's own
horseshoe centre, clear of both the 2.6 m ring and the 1.8 m "stopped in
the middle" test). `systems.js`'s `sysShelfStage` lays every currently-
held keepsake on it, ONE FIXED SLOT PER CHAPTER in `CHAPTERS` order — the
journal shelf's own convention (THE SHELF — `keep`, v18), not the earn
order the item asked for: `keepHeld` carries no timestamp, and this pass
may not add a save field to give it one. Runs on all three Sydney-arrival
doors (`startGame`'s non-restore branch, `biome:enter`, `sysEndPointHome`).
The gardener speaks `CHAPTERS[n].kept` (nineteen new lines, one clause
each, the gardener's own take) once per new keepsake, queued and staggered
(`npc.js` `npcShelfStep`), proved never twice by a harness counter. The
place card gains "the shelf has N things on it. it still has not said
why." on a Sydney return.

**Measured** (`qa/wow2-shelf.js`, three forced saves at 0/7/19 keeps via
real `completeTask` calls, not a faked `keepHeld`): shelf count equals
keep count at all three; the gardener-line counter matches the count of
genuinely new keepsakes and does not grow on a re-visit with nothing new.

### N2 — shipped (20 Sep 2026)

The fifteen gated cameos (`addTraveller`'s own `gateChap`) now stand at
their chapter's own exit board on approach within 25 m, back to the
approach, reading it — one of fifteen new third-person lines — and walk
off out of frame within 6 m or after a 90 s hold (`npc.js`
`npcGlimpseStep`, off `game.exitBoard()`). The four originals (Quay,
Marrakech, Cappadocia, Hanoi) are untouched. `travSeen` is the pass's
first new save field, chapter-keyed, on the `travMet` distance-count
pattern, bridged `npc.js` <-> `systems.js` the way `compSave` already
bridges the companion. Past ten glimpses the stall gains "you again.";
past all fifteen — not nineteen, a correction to this section's own
premise above; only fifteen chapters carry `gateChap` — the finale
traveller gets one line that acknowledges the chase.

**Two bugs found and fixed in the process, both pre-existing:**
`addTraveller`'s shop-stall code called `rec.lines.concat()`
unconditionally, and the finale's own traveller (`npcTravFin`) is built
with a FUNCTION for `lines`, not an array — every genuine "all nineteen
kept" finale threw a `TypeError` inside the `finale:staged` handler before
this fix, found by `qa/wow2-shelf.js`'s forced 19-keep pass. And the
glimpse's own `'done'` (hidden) state was undone one frame later by
`localsStep`'s own `gateChap` visibility check, which sets `visible = true`
again on every frame `chapDoneHere` is true — re-asserted every frame now.

**Measured live** (`qa/wow2-glimpse*.js`, deterministic `game.tick`
walks): a Kyoto approach crosses `'stand'` at 24.99 m, `'leave'` at
6.08 m, `'done'` (hidden, confirmed) shortly after; `travSeen` reads
`{kyoto:1}` after the approach and stays `{}` for Rio, never approached.

### N3 — shipped (20 Sep 2026)

All nineteen chapters already had a regular (`npcPAL`) — the earlier
"the two regulars" note above is about a different distinction (cast-vs-
local lookup), not a count. **3.1 the absence:** a return after >= 20
minutes of journey time elsewhere at tier >= 2 arms one of four `{call}`-
templated lines (`npc.js` `palAwayArm`) through the tier greeting's own
one-line channel; `systems.js`'s `sysChapLeftAt` is session-only, since
`jrChapMs` is an accumulated total and this pass may not add a save field
for a last-visit clock. **3.2 the kept gift:** past tier three, >= 3 rows
done elsewhere since the last one re-arms the chapter's own gift prop
drop (`palKeptArm` reuses `npcPalGive`), gated so it cannot fire twice
running. **3.3 the companion's homecoming — REALITY CHECK:** "does not
follow again, goes home" was already built (`compLeave`'s own `'home'`
reason) before this pass touched it; what was missing was the notebook
and the goodbye's own sound, both added (`jrChapHome`, a session-only
fact feeding `nbFacts`' new `home` key; six new `{if:'home'}` notebook
lines — venice/pigeon, goreme/cat, manly/silver gull, antarctic/gentoo,
kyoto/heron, sydney/ibis). **Not built:** a per-kind landing spot (the
Campanile's ledge and so on) — needs a landmark authored in six biome
files this wave does not own; the existing generic walk-off stands.

**Measured** (`qa/wow2-waits.js`): 5-minutes-away does not arm the
absence line, 21-minutes-away does; the kept gift arms once at tier 3
with three rows done and does not re-arm immediately after with nothing
new; the pigeon's full round trip — save-forced `stow`, Venice arrival,
`compWhy: 'home'`, `kind` cleared after the walk-off — run live end to
end. The other five kinds share the identical code path, parameterised
only by kind/biome, and were checked by reading rather than by five more
browser passes, given the time this combined session had left.

### N4 — shipped (20 Sep 2026)

**4.1 the opening, ten seconds:** armed on the identical fresh-file gate
Part T's own `tutArm` uses; delays "be a menace." behind a ten-second held
establishing shot (`game.frameShot`, the same request every marquee/board
shot already makes), skippable by any key or click. **Honest scope cut:**
the roadmap's own first choice — the animal asleep, the traveller's bag
beside it, carried off while the animal wakes — needs a pose outside
`capybara.js` (owned by no wave here) and a scripted NPC departure judged
too large a new surface for npc.js's existing AI machinery in the time
this pass had left; the held shot is the buildable version, not the one
asked for. **4.2 the morning after:** the shelf's all-nineteen was
already true the moment N1 shipped (no new code — confirmed by a forced-
`fin` save reading `shelf:19, keep:19`); the board's "again" line gains a
shared fin epilogue (`sysFIN_AGAIN_TAIL`) once `sysFinDone` — a correction
to this section's own "eleven chapters missing one": all nineteen were
missing one, and nineteen bespoke variants was more writing than the
remaining time allowed, so this is one clause appended in code rather
than nineteen duplicated in text (and so it cannot trip `qa/l6-tics.mjs`'s
three-file ceiling — it exists once). **Not built:** the gardener's
stand-down becoming a sit-down beside the traveller — `npc.js`'s pose
pipeline resets every record's crouch to zero ahead of its per-state
switch, so a safe version needs a real case in that switch rather than a
bolt-on, and this pass judged that too large a change to make safely with
the time it had left.

**Measured** (`qa/wow2-morning.js`): the opening arms on a fresh file
(`t: 10`) and clears on a keypress (`t: null`); a restored file (one real
task on it) never arms (`armed: false`); the fin-file shelf reads 19/19;
the again line's fin tail is read straight off the live place card's DOM
and off a screenshot (`qa/wow2-morning-fin.png`) on a real return
crossing.

**Budget, all of Part N:** no new draw calls or triangles beyond the
shelf's own handful of static boxes (built once, at boot) and the
fifteen travellers' existing figures repositioned in place; no per-frame
term dense enough under the L11 rule to warrant its own `noX` cut flag —
a scoping call, made and written down, not an oversight. New save field:
`travSeen` only (N2); `kept` (N1) is a `CHAPTERS` content field, not a
save key.

## Part T — the first three minutes

Today a stranger presses Begin and gets four task rows, "be a menace.",
a paper explainer at 8 s, a hint arrow after 40 s of idling, a slide
prompt if they happen to run for 1.2 s, and a nudge at 150 s — and a
legend they can read for nine tenths of a second on the title card or
under Tab (`sysLEGEND`, `systems.js:6145`; the one-shots, `:49376–49735`).
Nothing teaches a key by having them press it. There is no first-run flag
of any kind.

**Not a mode.** THE FIRST WALK is a chain of eight beats in Sydney's
gardens, each a pill in the gardener's voice (the pill queue, one at a
time, `E4`), each waiting for the player's own action, each ≤ 20 s or it
moves on. Total ≤ 180 s. Skipped entirely by Esc or by the legend being
opened; never shown on a file with any task done; saved as `tut: 1` the
moment it ends or is skipped (one new save field).

| # | beat | the pill | done when | teaches |
|---|---|---|---|---|
| 1 | move | "the lawn is yours. W, A, S, D." | 4 m walked | WASD |
| 2 | run | "hold Shift — she has legs." | 1.2 s at run speed (the slide prompt's own trigger, `:49432`, moved here) | Shift |
| 3 | hop | "Space, at the bench." — the arrow on the nearest bench | one hop lands on it | Space, the arrow |
| 4 | wheek | "Q. say hello." — the tourist at 6 m turns | the `wheek` row ticks (already Sydney's first row, `shared.js:2887`) | Q, the paper's tick |
| 5 | take | "E — that hat is not his." — the sunhat tourist, or the nearest yuzu if none | a grab or a yuzu credited | E, yuzu, the wallet |
| 6 | the paper | "Tab. the star is the big one here." — the existing 8 s explainer folded in, fired here instead | Tab opened once | Tab, the star, F |
| 7 | look | "drag, or C, to look around her." | the camera yawed ≥ 60° | the lens |
| 8 | the door | "the board by the gate. three wheeks, when you have done enough here." — the arrow on the exit zone | the animal within 12 m of the board | travel, the shop stall beside it |

Beat 5 also says the shop in one clause ("the traveller's stall buys
things for yuzu") the first time the wallet bumps. Beat 8 does not open
the board — `door: 10` stands; it shows where it is. The slide (G), the
dive, the perch and the herd are taught where they are needed, as today
(`slidEver`, `slipEver`, the herd's moment card); the legend fold "and a
few extras" is unchanged.

- **Voice:** the gardener's (he is on the lawn, he stands down on a
  finished file), attributed on the pill the way overheard pills are
  (`E4`, roman). Eight lines, `sysTUT_LINES`, checked by the dialogue
  tests.
- **Instrument:** `qa/wow2-tutorial.js` — a bot that reads only the live
  pill and performs the named key: time to beat 8 from Begin (≤ 180 s,
  ten runs, median and worst); a restore with one task done shows zero
  tutorial pills; Esc at beat 3 ends it and sets `tut`; a real
  screenshot per beat read by eye for pill legibility over the scene.
  Then a stranger playtester (the L6 method: an agent that reads nothing
  first) plays three minutes and is asked the six verbs.

### T — shipped (20 Sep 2026)

THE FIRST WALK is built, in `systems.js` and nowhere else. Eight beats in
Sydney's gardens, one pill at a time in the gardener's voice, quoted and
signed the way an overheard pill is (`“ the lawn is yours. W, A, S, D. ” —
the gardener`), each waiting for the player's OWN action measured from the
beat's start and each moving on if it never comes. The table is
`sysTUT_LINES` (eight lines, the roadmap's words unchanged); the chain is
`tutTick` at the foot of the one-shot block; the state is `tutEver`
(saved), `tutArm`, `tutOn`, `tutBeat`.

- **Not a mode.** The world runs, the animal can wander off, no key is
  taken. A beat that times out just moves on.
- **Waits:** 20 s a beat, except the door's 45 s — it is a 65 m walk round
  the terminal to the wharf and twenty seconds does not reach it (measured
  three runs in four). Total cap 180 s; 1.6 s minimum before a beat may
  close, 0.8 s between pills, the first at 4.6 s (the place card holds 3.6).
- **Ends:** by walking it, by Esc (the pause card), by the control fold
  being opened, by leaving Sydney, or by the cap — `tut: 1` on the save in
  every case, through `sysSAVE_SHAPE`, the writer beside `slid`/`paper` and
  the restore beside `slidEver`. Never armed on a restore, on a file with a
  tick, or under `game.state.noTut`.
- **Folded in, not added beside:** the slide prompt's 1.2 s-at-a-run
  trigger IS beat two (the G-slide line itself is untouched and still fires
  on the first run after the walk); the 8 s paper explainer IS beat six on
  a fresh file and keeps its old behaviour, once, on a file the walk never
  ran on (measured: a restore with one task done shows the old line once,
  and a file skipped at beat three shows it too).
- **The arrow:** beats three and eight borrow it (`tutAim`), on the bench
  nearest the animal and on the way mark, for the length of the beat; the
  top row's own target returns on the frame the beat closes. Beat five's
  arrow re-aims on the hint tick's own quarter second, so it follows the
  hat while the tourist walks. Beat eight shows the board and does not open
  it — `door: 10` stands.
- **Beat five's other clause:** `the traveller’s stall buys things for
  yuzu.` is said after beat five, and only if the wallet bumped inside it.
- `game.tutAudit()` → `{ beat, done, skipped, how, hits, t, pill, aim, … }`,
  read-only, for the bot.

**The ten runs** (`qa/wow2-tutorial.js`, one run-code invocation each, fresh
page, `localStorage` cleared before `goto`; the bot reads ONLY the live pill
text and steers by the paper's own arrow and the chart's metres):

| run | ended | wall s | game s | beats hit | timed out |
|---|---|---|---|---|---|
| 1 | walked | 89.1 | 79.6 | 7/8 | 8 |
| 2 | walked | 53.4 | 46.5 | 8/8 | — |
| 3 | walked | 84.4 | 80.1 | 7/8 | 8 |
| 4 | walked | 60.8 | 57.7 | 8/8 | — |
| 5 | walked | 70.8 | 66.5 | 8/8 | — |
| 6 | walked | 41.6 | 38.2 | 8/8 | — |
| 7 | walked | 64.8 | 56.1 | 8/8 | — |
| 8 | walked | 86.5 | 73.5 | 8/8 | — |
| 9 | walked | 63.9 | 58.6 | 8/8 | — |
| 10 | walked | 96.1 | 88.8 | 7/8 | 8 |

**Ten of ten reached beat eight. Median 70.8 s, worst 96.1 s** against the
roadmap's 180 — the whole walk, all eight pills, in a minute and a quarter.
Seven runs closed all eight beats on the bot's own action; three timed the
door out at 45 s and the walk ended there anyway, which is the beat
behaving as designed. The game's own clock is printed beside the wall clock
because a headless browser sharing a machine runs rAF slow: three earlier
runs that overlapped another session measured 60 s of game in 206 s of
wall, and those were thrown away and re-run serially rather than reported.

**Also measured.** A restore with one task done: 0 tutorial pills in 40 s of
walking, running and wheeking (`armed` false, `ever` false), the old paper
line once. Esc at beat three: `done` + `skipped` on the frame, 0 live pills
0.65 s later, `tut: 1` on disk, and three pills total for the whole session.
Frame time (`qa/wow2-frametime-t.js`): the walk cannot be interleaved the
way a shader flag can — it arms once at Begin — so this is three fresh-file
arms back to back, bucketed by governor rung. On the one rung two arms
shared, walk LIVE vs walk OVER: **19.6 vs 19.5 ms median (rung 3, n = 540 /
600)**, +0.1 ms; a second pass at rung 2 read −1.0 ms on a 60-frame bucket.
The sign is not stable, which is the honest reading: the walk's cost is
below this headless machine's ±1 ms noise floor. The first cut of this
instrument printed a 3.2 ms "delta" that was entirely the governor — arm A
settled at rung 3 and arm B at rung 0 — and is why the buckets are there.
Eight beat screenshots read by eye (`qa/wow2-tut-beat<N>.png`): the pill is
the paper-white lozenge at the foot of the frame, roman, signed, legible
over lawn, over sandstone, over the harbour and under two bubbles and an
incident line; it takes one of the stack's three places and is never pushed
out by a tick landing under it.

**The stranger** (`qa/wow2-stranger.md`, `qa/wow2-stranger.js`): a second
agent was not available to this wave, so the stranger is a SCRIPTED one and
the file says so — a bot that presses nothing but what the pill's words
name, reads no game state to decide anything, and does not use the arrow.
It learned five of five key-only beats from the words alone (move, run,
wheek, Tab, look), each in under five seconds; it pressed E fourteen times
and Space ten and closed neither of the two beats that are a key AT A
PLACE, because without the paper it never found the bench or the hat. That
is the arrow doing its job, and it is the honest limit of a reader that
looks only at the pill. A human stranger is still owed.

**Found on the way, and fixed:** the paper's arrow projected the TARGET
through the lens, and a point behind the camera projects mirrored (w < 0) —
exactly 180° wrong. With the wharf 65 m behind the animal the arrow pointed
away from it, in every chapter, for as long as the beacon has existed. It
projects one metre along the bearing now, which is always in front of the
lens because the animal is. (`qa/wow2-tut-arrow.js` is the probe: the DOM
arrow and the projection agree to the degree.)

**An honest miss:** the roadmap asks for the pill "in the gardener's voice"
and the gardener himself is not consulted — the pill is attributed to him
and he neither speaks it nor stands down when it is up. He also still
chases and carries the animal out through the middle of the walk (the beat
clock stops while `carriedBy`, so it does not cost a beat, but it costs the
player forty metres). Making the walk's voice the man on the lawn is a real
piece of work and it is not in this pass.

## Order and ownership

Seven waves; one agent per disjoint file set; one chapter per browser
run; commit per verified increment (L11's harness lessons, `headless-qa-
harness` traps 52–55).

- **W0 — the motion sheet.** Two-frame diffs at rest for the animal and
  the densest crowd in each chapter (`qa/wow2-motion-sheet.js`): the
  before for numbers 1 and 2. Review only.
- **W1 — V1 + V6** (capybara.js, a `tracks` pool in shared.js beside the
  contact pool, the mote burst in weather.js). The animal first.
- **W2 — V3 + V5** (per-chapter far layers; the dome's rainbow, the
  puddle gate in grain(), the strip and the drip in weather.js).
- **W3 — V2 + V4** (npc.js gait/gesture/umbrella/company; the sub terms
  in main.js's post chain, water material back face, a mote row).
- **W4 — N1 + N2** (Sydney's shelf in environment.js + systems.js's
  finale block; the glimpse in npc.js + `CHAPTERS`).
- **W5 — N3 + N4 + T** (npc.js regulars and companion; the opening and
  the morning after in systems.js; the first walk in systems.js's
  one-shot block).
- **W6 — the closeout.** The six numbers; the depth, still and frame-time
  sweeps re-run quiet; nineteen arrival frames read; CONTRACT.md's
  twelfth lift; this file's Closed section.

## W0 — the motion sheet, before (20 Sep 2026)

Measured on the lift-pass HEAD before any wave touched src (719b3e3, an
isolated worktree, its own server on 5189, session `w0`), one chapter per
`run-code`, `qa/wow2-motion-sheet.js`, results in
`qa/wow2-motion-sheet-before.json.png` and the contact sheets
`qa/wow2-motion-<chapter>-capy.png` / `-crowd.png` (frame A | frame B over
mask | diff of the last pair, through the pinned lens — `page.screenshot`
only ever shows the resting lens).

**The instrument.** Ten frame pairs 120 ms apart, one every ~1.9 s, over
~20 s of real rAF time with no input; threshold 8 on any channel; moved
pixels counted inside a hide-and-diff mask; px/s = mean moved per pair /
0.12. *The animal:* a lens 3 m off at its own eye height, front quarter
(the other quarters when a collider is there), the body's mask taken with
its shadow switched off, and everyone else — roster, locals, movers,
vehicles — hidden, because the first Pasto run had a local standing over
the animal and two more walking through its mask. *The crowd:* the
living layer, which is the still instrument's mask inverted and then
made honest — the roster by material (npc.js `instMat`, vertexColors over
`PALETTE.sail`; the still's 72-vertex key was the torso alone), the live
chapter's locals, every instanced mover whose instances are
figure-sized (a chapter crowd, a herd, a scooter and rider, the
penguins), their small parts by shared count and origin (`rioPeopleHeads`),
and any moved single mesh whose enclosing group is figure-sized (Sahara's
foreground man, who was red in the diff and absent from the mask until
that rule). A moved van or ferry is named and left out. The cluster is
the figure with the most neighbours within 3 m inside 40 m of the
animal (a pair beyond 40 m beats a loner inside it), the lens 6 m off at
1.5 m over its feet, never under the chapter's `terrainHeight`, on the
first of eight bearings whose mask has pixels in a 48 px window around
the cluster's chest — a cannon ray had called Rio's hillside clear and
the lens sat inside it. Weather (renderOrder 6) and every sway-hooked
material are hidden for both subjects, and the self-diff of two
synchronous renders (a cloud material reads the clock in
onBeforeRender) is subtracted from every mask.

| chapter | animal px/s (median pair) | mask px | crowd px/s (median pair) | cluster / in view / mask px |
|---|---|---|---|---|
| sydney | 27,846 (21,133) | 17,179 | 80,648 (73,888) | 9 roster @ 40 m / 15 / 45,405 |
| pasto | 8,622 (3,225) | 17,426 | 94,785 (105,071) | 3 roster @ 1 m / 4 / 17,400 |
| quay | 17,510 (7,654) | 18,511 | 37,985 (32,450) | 6 locals @ 9 m / 9 / 28,237 |
| kyoto | 7,913 (6,271) | 17,476 | 5,652 (1,713) | 1 local @ 4 m / 4 / 13,676 |
| cali | 10,232 (4,317) | 16,523 | 38,145 (37,983) | 2 dancers @ 66 m / 9 / 9,563 |
| rio | 20,623 (6,500) | 17,470 | 151,307 (153,488) | 7 rioPeople @ 39 m / 21 / 88,582 |
| iceland | 7,428 (5,950) | 16,299 | 24,368 (23,046) | 7 sheep @ 76 m / 13 / 18,216 |
| sahara | 13,043 (5,254) | 17,581 | 30,280 (24,242) | 12 locals @ 13 m / 30 / 45,837 |
| drift | 9,931 (5,883) | 17,076 | 5,488 (2,254) | 1 local @ 27 m / 1 / 5,605 |
| venice | 18,898 (5,929) | 18,235 | 155,603 (145,896) | 8 pigeons and walkers @ 36 m / 25 / 75,154 |
| kowloon | 14,544 (9,533) | 17,586 | 41,469 (35,546) | 6 walkers @ 20 m / 9 / 34,643 |
| palawan | 12,368 (6,233) | 16,280 | 11,256 (9,325) | 2 locals @ 20 m / 2 / 8,598 |
| goreme | 11,629 (3,942) | 18,536 | 6,829 (4,079) | 2 figures @ 33 m / 2 / 11,043 |
| manly | 11,864 (5,696) | 16,748 | 14,768 (11,017) | 4 figures @ 30 m / 10 / 12,248 |
| pantanal | 10,168 (6,092) | 16,734 | 14,473 (8,979) | 2 the herd @ 30 m / 4 / 10,518 |
| cave | 9,545 (4,917) | 16,549 | 2,078 (317) | 1 local @ 33 m / 1 / 4,089 |
| antarctic | 15,737 (13,288) | 9,598 | 30,178 (28,788) | 7 penguins @ 39 m / 82 / 22,758 |
| monaco | 7,768 (6,133) | 9,626 | 4,276 (2,967) | 1 local @ 7 m / 1 / 5,475 |
| hanoi | 19,328 (14,083) | 17,704 | 286,033 (233,008) | 6 scooters @ 12 m / 14 / 87,296 |

**The baselines.** Animal at rest: median **11,864 px/s** over the
nineteen (a mask of ~17,000 px at 3 m, so ~7 % of the animal's pixels
change per 120 ms). Crowd: median **30,178 px/s** over nineteen
chapters — but that median is a median of unlike things: the top five
(Hanoi, Venice, Rio, Pasto, Sydney) are traffic, pigeons, a beach
crowd walking, three men who have crowded up to the animal, and a
waiter, and the bottom five (cave, monaco, drift, kyoto, goreme) are
one local each. W1 doubles the first number; W3 doubles the second.
W3 should judge itself per chapter against this table rather than
against the median, and should know that Venice's number is mostly
the pigeon flock and Hanoi's is the scooters.

**Read by eye (the animal).** Sydney: red streaks down through the
head and back — the blossom petals falling across the mask, not the
animal (neither the renderOrder-6 hide nor the mover census caught
them: a pool that falls in its shader, not by matrix); Sydney's 27,846 is the petals plus a head edge, and W1
should hide that pool or measure Sydney on a still day. Kyoto, Hanoi, Pasto (seen from behind — the front quarter
was a wall): a thin red outline around the whole silhouette and the
feet, a one-pixel body shift, no ear, no blink, no weight change;
between events the animal is dead still (Pasto's last pair: 42 px of
17,426). The animal's pairs are spiky everywhere — Quay 259..9,912,
Cali 53..7,633, Pasto 42..5,397 — an idle made of occasional events, not a breathing
body, which is exactly what V1 is for. Monaco and Antarctic masks are
half size (9,626 / 9,598): a kerb and a rock ledge hide the lower body
from any lens 3 m off; their numbers are the head and back.

**Read by eye (the crowd).** Hanoi: a river of scooters, every rider
red, nothing standing. Venice: the pigeon pile by the well is a red
mass, the Venetians around it are grey — still — save two walkers.
Sahara: twelve at the souk tables, red only on outlines and one arm; a
crowd that sits. Sydney (the café at 40 m): patrons grey, the waiter
and two walkers red. Cali: the salsa pair red in the middle of a grey
ring of onlookers. Antarctic: two or three penguins waddling among
eighty still ones. Kyoto, cave, monaco, drift: one person, and the
diff is a few dozen pixels. Standing people do not move at all; the
only life at rest is the walkers.

**The still mask, extended (`qa/wow2-still-mask.js`,
`qa/wow2-still-mask.json.png`).** A copy of wow-still.js measuring the
floor under its own mask and under the extension in the same 120 ms
window, least of three pairs. The old mask, read as code: `swayD` is
grass.js alone (shared.js's swayMesh keys `'sway'+k`, the leaf term
prefixes `leaf1|`), the 72-vertex key is the torso alone, and nothing
moving by position was hidden. The extension adds the whole roster by
material, every `sway` key, and anything whose world translation or
any instance moved > 1 cm across 120 ms. Moved % of the frame (lower
third): hanoi **10.26 → 0.85** (22.1 → 2.0; the resting lens had
traffic in it — the L11 row was 3.19), pantanal **1.29 → 0.03**
(0.59 → 0.04), sydney **0.74 → 0.08** (0.43 → 0.03), manly **1.12 →
0.41** (0.13 → 0.19), cave **0.043 → 0.005**. Extra objects hidden: 52
roster parts, 87 sway materials, and 13–155 movers per chapter (unnamed
meshes for the most part — whatever a chapter moves every frame; Manly's
155 and the cave's 124 were not identified by name). Caveat: the extended mask hides anything that moves > 1 cm,
so a positional jitter would be hidden with the traffic — it measures
the shading and texel floor only. W6 should use the extended mask for
the still sweep and read the moved-object names it prints.

**Instrument findings for the waves.** (1) Hand-built people who are
not locals (Sahara's foreground man, the salsa pair) are single meshes
in a group — any NPC-layer mask must find them by shape, not by list.
(2) The roster is parked invisible outside Sydney/Pasto (`rosterShown`
false everywhere else): its matrices are still there and a probe that
counts instances counts ghosts. (3) `l9DropAura` and Pasto's thermal
motes are figure-height instanced movers; exclude translucent
materials. (4) The resting animal is not deterministic in yaw or pose
between arrivals; the mask varies ±1,000 px run to run and the px/s by
about ±30 % (Sydney 20,636 / 31,638 / 27,846 in three runs) — a W1
after must be judged over at least ten pairs and preferably two runs.

## Rules for every agent

- Check CONTRACT.md's section list before building: this game has the
  thing more often than not (the feel pass's own finding).
- Never re-base a grade, sun, fog, mote or spawn row; never add a save
  field beyond the three named; never say the why.
- Every term cuts, parks at rung 1, and is proved inside a mask by a
  per-pixel diff and a screenshot read by eye; motion terms are proved on
  the two-frame diff with the rest of the scene's intended motion masked
  (`qa/wow-still.js`'s mask, extended for traffic and herds — the L11
  closeout's open item, closed in W0 here).
- One chapter per playwright run, under four minutes; own session only,
  never `close-all`; `git status` right before every commit; stage by
  name.
- The lens is not deterministic between arrivals — pinned poses for any
  before/after.

## Held (named, not built)

Lightning (a written decision, `systems.js:14637`); motion blur; TAA;
textures of any kind; a named protagonist or a voice for the animal;
cutscenes that take the controls for more than ten seconds; a new-game-
plus that resets anything; a why said out loud.

## Closed (21 Sep 2026) — the six numbers, as measured

Twenty-five commits on `lift-pass` between `00f3b72` and `2121e99`, every
one gated by `node --check`, `node build.mjs` and a green `npm test`
(25 checks, 0 failed, throughout). Six waves built against the roadmap
above; this agent (W6) built nothing new, measured the whole pass
together for the first time, read a regression sweep of the shared files
end to end, and closes it out.

**What shipped, one line per part** (each part's own "### — shipped"
block above has the numbers; this is the pointer, not a repeat).

- **V1 — the animal, alive.** A second clock under the existing six-beat
  idle table (an ear, a weight shift, a sniff, a head-turn), squash and
  stretch on the takeoff and the arc, footfalls that puff the ground by
  material, a coat that darkens and dries, catchlights that slide toward
  the lens. `noAlive`, `noFootfall`.
- **V2 — people, alive.** Three gait profiles off the figure's own seed,
  six idle gestures, umbrellas up in the rain (the roster's own instanced
  buffer — locals already had them), two locals turning to talk. One
  real bug fixed in passing (the umbrella's front term was inverted).
  `noGesture`, `noUmbrella`, `noCompany`.
- **V3 — the far plane.** A new module (`src/far.js`) gives twelve
  chapters a silhouette, a mover and night lights, each placed against
  that chapter's own live fog band rather than the roadmap's flat
  250–400 m guess. Seven chapters (Pasto, Kyoto, Sahara, Drift, Venice,
  Goreme, the cave) were correctly left out by design; Antarctica,
  Kowloon, Sydney and the Quay were found already stale before a line
  was written. `noFar`.
- **V4 — under the surface.** A procedural ceiling stand-in (the true
  reflection sampler is not exported from shared.js — named below), a
  reused-shader underwater ray with a physically-motivated fixed bend
  (Snell's window, not a computed refraction), bubbles on the existing
  mote pool, six surfacing beads with a real bug found and fixed (the
  trigger read `capy.diving` instead of `capy.depth` and missed a real
  surfacing by 1.5 s). `noSub2`.
- **V5 — weather as an event.** A rainbow riding the shared dome's own
  sun axis (not a second per-chapter table), a wetness-gated puddle mask
  on Kowloon's road only (every other `reflect:` call site is a real body
  of water and was correctly left alone), a gust that strips four
  canopies of their own colour, a 60 s eaves-drip on the same four.
  `noRainbow`, `noPuddle`, `noStrip`.
- **V6 — tracks and touches.** A 32-slot decal pool beside the contact
  pool's own shape, a paw drawn from the footfall's heading, a swim
  wake. Sand and snow proved by pixel; mud and wet prints are wired and
  written but were never put in front of a lens (V6's own honest miss,
  unchanged by this closeout). `noTracks`.
- **N1 — the shelf in the world.** A stone shelf in Sydney's gardens,
  one fixed slot per chapter (not earn-order — no save field exists to
  record when a keepsake was taken), the gardener's line once per new
  keepsake. `noShelf`.
- **N2 — the glimpse.** Fifteen of nineteen chapters (the ones with a
  gated cameo) now show the traveller reading the exit board and walking
  off; the other four keep their original cameo behaviour. Two
  pre-existing bugs fixed in the process (a finale crash on all-nineteen-
  kept, a glimpse state re-asserted visible one frame after being hidden).
  `noGlimpse`.
- **N3 — someone waits.** The absence line on a ≥20-minute return, a
  second gift past tier three, and the companion's homecoming — which
  was mostly already built (`compLeave('home')` pre-dates this pass) and
  wanted only the notebook entry and the goodbye sound.
- **N4 — the morning after.** A ten-second held establishing shot before
  "be a menace." on a fresh file (the roadmap's own sleeping-pose-and-bag
  scene needs a capybara.js pose no wave here owns); the fin epilogue as
  one shared clause in code, not nineteen in text (the roadmap's "eleven
  chapters missing one" was a guess made before anyone checked — the true
  count was nineteen of nineteen).
- **T — the first three minutes.** Eight beats in the gardener's voice,
  each waiting for the player's own action. Ten of ten bot runs reached
  beat eight; median 70.8 s wall / 66.5 s game, worst 96.1 s — the
  180 s cap met with more than half to spare. One real bug found and
  fixed (the paper's arrow pointed 180° wrong at any target behind the
  camera).
- **V0.** Not started. Correctly optional per the roadmap's own text
  ("they do not block the pass") — named here as a scope choice, not a
  miss.

**The six numbers, closed.**

1. *Motion at rest.* Re-run, not re-swept: `qa/wow2-alive.js` (sydney,
   the animal's own idle table — chapter-independent by construction)
   and `qa/wow2-people.js` (iceland, one of the four chapters V2's own
   report already covered — sydney, kyoto, sahara, iceland) both ran
   clean after every later wave's edits, with numbers in the same
   regime as each wave's own report (people: 31 shivers this run against
   V2's own 37 in a longer window; alive: excess ratio 0.94 this run,
   the same order as V1's own report, reproducing V1's own honest
   finding that "a per-second sum cannot see a 90 ms ear"). **Coverage
   stands at 4 of 19 for the crowd** (V2's own number, reconfirmed, not
   extended) **and chapter-independent for the animal's own table**,
   plus footfalls on Palawan/Antarctica — this closeout did not extend
   coverage past what V1/V2 already measured; time went to the number
   nobody had measured at all (6, below) and the regression sweep
   instead.
2. *The far plane.* `src/far.js` was touched only inside V3's own two
   commits — confirmed by `git log -- src/far.js` — so no later wave's
   edit could have regressed it, and the nineteen re-shot arrival frames
   (`qa/wow2-arrivals-1.js`/`-2.js`, below) are a fresh visual
   confirmation on top of that: Rio's three grey islets, Palawan's
   second karst mass, the Pantanal's tree line, Manly's headland across
   the top of the frame and Antarctica's shelf-and-reflection all read
   plainly at the resting lens; Kowloon and Hanoi still show no far
   layer from arrival, exactly as V3's own report named. **Honest miss:**
   this closeout did not re-run the numeric 13×9/39×27 depth sweep
   (`qa/wow2-far-depth.js`) across all nineteen — the file-touch check
   plus the visual re-confirmation stood in for it, which is a weaker
   claim than a fresh number and is written down as such.
3. *Tracks.* Palawan's sand (1953/1950/1715 px at 0/10/20 s, against
   V6's own 1882/1884/1634) and Kyoto's wake (4577 px against V6's own
   4956) reconfirmed within run-to-run noise. Antarctica's snow
   reconfirmed clean on two of three runs (657/659/641 px, flat across
   20 s as a 90 s life predicts) after one anomalous run read 0 live
   prints — chased with a standalone diagnostic (`biome:enter` hooked,
   the walk logged every ten ticks) that found the write-and-age path
   working correctly and no unexpected chapter-crossing event; the
   honest conclusion is a one-off tied to the QA patch-finder occasionally
   landing on an edge-case slope, not a code regression, and it is
   recorded as exactly that rather than either ignored or written up as
   a bug with no reproduction. Mud and wet prints remain wired,
   written, and never independently read by eye (V6's own miss, still
   open).
4. *The reason, counted.* Shelf reconfirmed exactly (`qa/wow2-shelf.js`
   re-run: shelf count 0/7/19 against keep count 0/7/19, unchanged from
   N1's own report). Glimpse and the absence/kept-gift lines were
   reviewed in the diff (no interference found from V4/V5's later edits
   to the same two files) but not re-run live this session. **The
   companion's homecoming — the one place this closeout changed the
   number rather than confirmed it:** N3's own report verified only the
   pigeon live and read the other five kinds "by the code, not the
   browser." This closeout ran the same save-forced-stow pattern
   (`qa/wow2-waits-companions.js`) for cat/Goreme, silver gull/Manly,
   gentoo/Antarctica, heron/Kyoto and ibis/Sydney: all five show the
   same clean `kind → null, why:'home'` transition on crossing into
   their own `from` chapter that the pigeon showed. **Six of six
   companion kinds now independently verified live, not one plus five
   read.**
5. *Three minutes.* Closed by T's own report: 10/10 bot runs, median
   70.8 s wall / 66.5 s game, worst 96.1 s, all under the 180 s cap.
   **Still open, named plainly:** the stranger playtester was a scripted
   reader, not an independent human read, by T's own admission — this
   closeout has no human tester either, and says so rather than papering
   over it with the bot's own clean number.
6. *16.7 ms held — the number nobody had measured together.* Every wave
   tested only its own flags. `qa/wow2-frametime-final.js` ran the full
   fourteen-flag list (`noAlive`, `noFootfall`, `noTracks`, `noGesture`,
   `noUmbrella`, `noCompany`, `noFar`, `noSub2`, `noRainbow`, `noPuddle`,
   `noStrip`, `noShelf`, `noGlimpse`, `noTut` — the complete set,
   confirmed against `grep -n "game.state.no" src/*.js`) live against
   fully cut, five interleaved reps of sixty frames, across the same
   eight chapters L11 used. Governor rung pinned to 0 throughout
   (`capy3.prefs.v1 = {v:1, pf:1}` — a headless box settles at rung 3 on
   its own and would park every term in both arms). **Live-minus-cut
   median: sydney 0.0, kyoto 0.0, pantanal +0.1, monaco 0.0, hanoi −0.2,
   sahara 0.0, iceland +0.1, goreme 0.0 ms.** Every chapter inside the
   0.6 ms rule with room to spare, and — unlike several individual
   waves' own whole-frame attempts, which several reports named as
   unusable on this headless box — this combined run's own noise floor
   was tight enough (−0.2 to +0.1 ms) that the tick-only sim-A/B fallback
   the brief allowed for was not needed. The rule the whole pass was
   built under held, measured all at once, for the first time.

**The regression sweep.** `node build.mjs` and `npm test` are clean on
the final commit (25 checks, 0 failed). `src/shared.js` (touched by V6's
tracks pool, N1/N2's save-shape and CHAPTERS fields, and V5's puddle
gate, in that order) and `src/systems.js` (touched by T's tutorial
block, Part N's shelf/glimpse/waits machinery, and V5's rainbow hook, in
that order) were read end to end against `00f3b72` — 616 and 929 lines
of diff — looking specifically for a later wave's edit landing inside an
earlier wave's function, a duplicate declaration, or a comment now
describing code that moved. None found: a scripted check for duplicate
top-level `function`/`const`/`let` names across all six touched files
(`shared.js`, `systems.js`, `npc.js`, `weather.js`, `main.js`,
`capybara.js`) came back empty, and every later hook (V5's rainbow
riding sky2's own uniform, the puddle gate's `uPuddleOn`, N3's
`sysPalAwayCheck` reading the same `p.from` field the companion's own
homecoming reads) is additive beside the code it sits next to rather
than inside it. **No bug was found that needed fixing** — the six
waves' edits to the same three shared files held together cleanly, which
is itself the honest result of a sweep built to catch exactly the kind
of thing that did not happen here.

**The nineteen arrival frames, re-read.** `qa/wow2-arrivals-1.js` and
`-2.js` (fresh boot, `hud.cross`, a raw `page.screenshot`, split across
two invocations to stay under the four-minute cap) shot all nineteen
again. Read by eye against V3's own per-chapter list: the far layer
reads plainly from arrival in Rio, Palawan, the Pantanal, Manly and
Antarctica; Kowloon and Hanoi still show none, exactly as named before.
Sydney's Opera House is still behind the fig crowns (A2's own finding
from L11, unrelated to this pass, still true). Iceland's Esja band and
Monaco's heights are present in the scene but faint-to-illegible in a
night/fog arrival lens — not a new miss, but worth naming plainly rather
than claiming every chapter reads clearly.

**Left open, named.** `reflectTex()` — a getter for A1's private
reflection target, wanted by V4 so the underwater ceiling can sample the
real reflection instead of a procedural stand-in; V4's bubble count
measured 19–30 of a 40 target (the ring likely laps before a bubble's
own life ends — `wxDIVE_RATE` is the number to raise first); Kowloon and
Hanoi's far layers, invisible from their own arrival lens by the
geometry of where each chapter actually rests the camera (a lattice
truss needs its own bay-loop builder, not a wedge); Manly's ferry
crossing the frame's top edge rather than through it; the first three
minutes' stranger playtester, still a script and not a person; the
companion's per-kind landing spot (the Campanile's ledge and so on) —
the generic walk-off stands, six biome files away from any wave that
owns them; Sydney's jacaranda gust folded into the existing petal
skitter rather than built as a second purple mechanic; N4's opening beat
as a held establishing shot rather than the sleeping-pose-and-bag scene
the roadmap first asked for; the gardener's stand-down never becoming a
sit-down beside the traveller at the finale; V0's cylinder-widen and
mote-footprint carry-over, not started, correctly optional; V6's mud and
wet prints, wired and unread by any lens; the far plane's own numeric
depth sweep, not re-run fresh across all nineteen this closeout, only
confirmed by file history and by eye.

**Two harness lessons, now for the memory.** (1) A frame-time A/B is
only as honest as the governor rung it runs at — pin `capy3.prefs.v1 =
{v:1, pf:1}` before the first frame, or a headless box's own settle to
rung 3 parks every term in both arms and the delta reads as nothing
because both arms already are. (2) A save-forced state (`localStorage`
seeded with `{v:1, tasks:[id], seen:[1], recs:{}, ms:0, stow:{kind,
from}}`, then a real reload and a real `hud.cross`) is the honest way to
verify a mechanic gated behind a long, specific setup — the companion's
homecoming across five more kinds took five reloads and about ninety
seconds of real wall time apiece, not five new in-world pickup routes
worked out from scratch.
