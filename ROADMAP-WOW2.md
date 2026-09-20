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

TABLE-GOES-HERE

**Also measured.** A restore with one task done: 0 tutorial pills in 40 s of
walking, running and wheeking (`armed` false, `ever` false), the old paper
line once. Esc at beat three: `done` + `skipped` on the frame, 0 live pills
0.65 s later, `tut: 1` on disk, and three pills total for the whole session.
Frame time, `noTut` live vs cut (between-page, `qa/wow2-frametime-t.js`):
FRAMETIME-GOES-HERE

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
