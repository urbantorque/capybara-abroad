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
