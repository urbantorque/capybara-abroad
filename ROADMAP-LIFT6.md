# ROADMAP-LIFT6 — the sixth lift (13 Sep 2026)

The brief, a sixth time: functional and enjoyable → memorable, beautiful,
engaging, in line with the top of the field; six to eight areas lifted in
detail and four to five features that change what the game is; nothing
broken. Six reviewers read the tree and PLAYED it under playwright with real
keys — game design, art and animation, audio, writing/UX, QA/performance,
and a fresh-eyes playtester who read nothing first. Their reports are the
six `review-*.md` files of this pass's scratchpad; their probes and frames
are `qa/l6r-*`. Every item below carries a file:line or a measured number
from one of them, and an instrument.

What the six agreed on, said once:

- **The game teaches nine skills, ten costumes, a hide, a perch, a herd, a
  camera and a dive in eleven seas, and not one of the 234 rows on the paper
  asks for any of them** (design 2.1: the count is zero — `capySkill` has no
  reader outside capybara.js; TASKS rows have six keys and no `needs`). The
  loop in Hanoi is the loop in the Gardens.
- **The picture stops at twenty-two metres.** One shadow cascade, box ±22 m;
  the walking lens sees to the fog (art 1). Past the box, every daylight
  frame is unshadowed ground; the sky is a gradient with hard-edged
  octagons in it; the ground is one value per chapter. The animal's face is
  three pixels from behind and its jump has a 23 ms anticipation.
- **The score has three decibels of dynamic range and no tune.** Still,
  walking, a chase and a marquee sit within 3 dB in four of five chapters
  (audio 2); the room returns 27–39 dB under the sound in it (3); the
  arrival phrase's intervals differ in 16 of 21 palettes (1); nothing is
  ever silent, including the nap (8).
- **The writing is the best thing in the game and it is behind a door**:
  the nineteen sentences are read only at 70–100 %; the one through-line
  (the traveller) is four unpointed 8 m cameos met in 0 of 3 runs; overheard
  lines become unattributed pills; Sydney's rows tick in Venice (W1, W2, W4,
  W7).
- **The fresh player fought the camera, not the game**: a camera that
  drifts while you are away and does not come back while you walk; a
  marquee that never says why it is not happening; a stolen hat the card did
  not notice; a 25 m launch with no named cause (play 1–5).

## The five features

### F1 · THE COMPANION — the stowaway grown up
*One animal stays.* (design F1 + 2.4; the best unbuilt idea of L4, built as a
one-border gag in N3 and grown here)

Today `stowRelease` (systems.js ~35775) ends the stowaway on the first Space
press: 2.4 s of walking away and a shrink. THE COMPANION: it gets down and
FOLLOWS (position from `herdTrailAt`, y from `sysGroundY`; a bird flies at
1.2 m over water, a walker waits at the last dry point and calls); it CLIMBS
BACK ON when you loaf two seconds beside it (the perch's own climb; it is
`taken[0]` as today); it STAYS across every border until you take it home
(`to === stowFrom`, the existing branch), leave it (> 60 m for 40 s — the
existing walk-off), or tell it (hold Q 1.2 s beside it: "off you go"); it is
SAVED (`stow: { kind, from }` in `saveWrite`, restored lazily on the first
started frame); the six per-chapter `stow()` drawables become six
biome-neutral builders in systems.js on PALETTE colours so nothing shares a
detached chapter's material. THE SEAT: when `capy.atHelm || capy.carriedBy`
it re-mounts, so the ferry, the chiva, the balloon and the boat carry two.
THE PORTRAIT: photo pose "with the companion" and it is in the tag-2 frame.
THE DECOY: while `game.hidden() > 0.8`, Q sends it to the aim ring and the
march's last-seen (npc.js `npcHIDE_LOSE`) reads the decoy for 4 s. Three rows
in the back half (Venice *bring it across on the traghetto*; Marrakech *lose
them with somebody else's bird*; Monaco *the two of you at the podium*) and
authority `when:` lines ("Is that yours?").

**Instrument.** `qa/l6-companion.js`: carried out of Venice into Kowloon;
dismount on Space; `follow` within 3 m over 60 s of walking including water;
re-mount on a 2 s loaf; survives `page.reload()`; a decoy ending a Marrakech
march `npc:lost` with the capybara stationary. Effort L / risk med-high.

### F2 · THE SECOND ASK, AND THE WINDOW
*Every chapter from eight on asks for something you were taught; every
chapter has a clock you can miss.* (design F2, 2.2, 2.3, 2.5)

Nineteen rows, one per chapter, with a `needs:` key read by `qa/verbs.mjs`
(a clue can never name a skill before its chapter). Each tick reads a field
`capy` already publishes — `vaultN`, `mantleN`, `seedT`, `sliding`,
`committed`, `hidden()`, `perchCount()`, `herdCount()`, `worn`, `heldProp`
— on the chapter's existing `where:`. Examples with the geometry in place:
Marrakech *out of the souk over the wall* (vault); the Drift *the long gap
without the puff* (seed); Venice *the Rialto's parapet from the canal*
(mantle); Kowloon *unseen through the wet market* (hidden 20 s); Palawan *the
drop-off with three on your back* (perch ≥ 3, depth > 3); Cappadocia *in the
flying cap, at the rim*; Monaco *the floor, in the jacket, with a pigeon*;
Hanoi *hold the line with a following*; Rio *the Selarón steps on your
belly* (G — the front-of-box verb no row asks for). THE CARRY: where the
chapter has a prop an earlier row put in your mouth, the row's object is
that prop (`carry: 'empanada'`; the tick needs `heldProp.type === carry`
released inside the zone). THE WINDOW: in the five chapters with no clocked
event (Kyoto, Cali, the Pantanal, Sơn Đoòng, Antarctica) the row is a
window on an existing mover — the heron lifts off the pond every four
minutes; the kites dive on the gust; the jabiru returns to the nest; the
drips come in a burst; the glacier calves — with a countdown on the live
line through `game.recordLive`.

**Instrument.** `qa/verbs.mjs` grows a `needs`-before-chapter blocker and a
per-verb consumer count (G ≥ 1, dive ≥ 4 in ≥ 3 chapters); rows whose tick
reads a skill-backed field ≥ 11 (today 0); a seeded save with all nine
skills and one with none, the same directed run in three chapters — the tick
set differs by ≥ 3 rows (today identical); the naive walk ticks ≥ 1 clocked
row in each of the five. Effort M / risk low.

### F3 · THE TUNE
*One melody a player can carry from Kyoto to Venice.* (audio 1, feature B)

An eight-note theme in scale degrees over a per-palette `scale` tag on
`sysMUS_PAL` (three shapes cover the twenty-one), transposed to the
palette's tonic, the third flattened where the scale is minor and nothing
else re-fitted; played whole by `musLiftNote` on the palette's lead at the
top of the arrival shot (replacing the contour), quoted as cell 0, ended on
by the lift figure, sung by the choir under the aurora, and played once,
complete, across the nineteen leads by the coda before the hush.

**Instrument.** `hud.phraseAudit(n).iv`: the interval sequence identical
(mod the third's quality) in ≥ 19/21 palettes (today 5/21 share one shape);
≥ 6 of 8 notes in the sounding chord in every palette. Effort M / risk med.

### F4 · THE TRAVELLER'S NOTEBOOK
*The narrator the game has been missing.* (writing A + W1 + W2)

The journal gains a second page in the traveller's voice: one entry per
chapter, written the moment you LEAVE a place, from a per-chapter template
of three or four authored sentences filled from what the journey already
counts (the recap's inputs, the regular's name for you, the keepsake, the
incidents); the first entry written before you meet them; an entry you
never earned a blank line with a date; a second visit rewrites it. Beside
it: `CHAPTERS[n].left` — a second sentence per chapter for the player who
did NOT stay, on the departure card whenever `jrTravel` fires with ≥ 1 row
done and `!chapEnough` (today 0 of 19 read anything); the traveller's four
cameos get a `where()` and a paper row (*somebody keeps turning up*); the
finale's last line becomes the notebook's last page. Saved as `nb`.

**Instrument.** `qa/l4-depart.js` extended: travel out of 19 chapters at one
row each → a card with a sentence 19/19; the notebook holds ≥ 1 entry after
the first departure and rewrites on a return; `game.travMet() ≥ 1` in 4/4
seeded drives. Effort M / risk low.

### F5 · THE LOCALS SPEAK
*Every bubble is a sentence in capybarese.* (audio 6, feature A)

`sfxBabble` beside `sfxBlip`: a glottal pulse train through two formant
band-passes (`sysMUS_FORMANT`'s vowel set), 3–7 syllables from the line's
word count at 6–8 Hz with ±20 % jitter, a contour that falls for a statement
and rises for a `?`, the person's `vpitch` as the fundamental and a
per-person formant offset; the authority a fifth lower, the storyteller
slower; placed through the same `sfx(n, rec)` door, 0.26 peak, inside 14 m,
one slot per line; "sound as text" on the settings card falls back to the
blip. Today: 166 blips in two minutes in Sydney, the most frequent sound
after the footstep.

**Instrument.** Distinct voices per person ≥ 3 (pitch, formant set, rate);
≤ 12 % of the world's energy in the 640 Hz blip band over a two-minute
Sydney drive; babble onset within 80 ms of the bubble. Effort S–M / risk low.

## The eight enhancement areas

### E1 · THE FAR SHADOW, AND THE LENS THAT COMES BACK (art 1, 2; play 1, 2, 5)
- A second shadow cascade: the key split into NEAR (0.6 of the intensity,
  today's box) and FAR (0.4, a 140 m box at 2048, radius 2, refreshed every
  other frame, casters under 1.2 m culled by layer); `sysKEY` reads the two
  summed; pretty tier only; the governor's second rung drops FAR first.
- The crowd in the lens: each frame the lens→animal segment against the
  crowd's spheres; a person inside 3.5 m of the lens on it fades through a
  screen-door dither over 0.25 s (instanced walkers through an instance
  attribute); where a mesh cannot fade, the boom biased up 0.6 m and out 12°.
- The camera comes back while you walk: the tidy-up branch (systems.js
  ~38420) also fires when the stick has been held STRAIGHT (|ix| < 0.15,
  iz < −0.5) for 0.8 s — the one case the feedback loop is stable — at a
  slower lambda (0.8); a held strafe or a turn never triggers it. The animal
  out of the frustum for 0.5 s → a 0.3 s cut that puts it back. The first
  time a player walks 5 s away from the arrow's target, one toast: *C puts
  the camera behind you*.
- Every external impulse over 5 m/s on the animal names its cause on a pill
  (the ferry's wake, Murray, the geyser) — `game.shove` already carries a
  source in most chapters; the pill reads it.

**Instrument.** `qa/l4r-art-sunaz.js`'s shadow diff restricted to the band
y 0.20–0.45: shade share ≥ 8 % in Sydney/Venice/Pasto/Sahara/Pantanal
walking frames (today ~0); the extra pass ≤ 1.8 ms at 1280×760. A 30 s
piazza walk: person on the segment inside 3.5 m and unfaded ≤ 3 % of frames.
W held 6 s from a 90° rig: |camYaw − (heading + π)| ≤ 0.3 rad by 4 s.

### E2 · THE BODY (art 3, 4, 8; audio 7)
- The hop: a 70 ms armed crouch (`capyHopArm`; squash −0.26, ears back, the
  impulse when the timer expires; 50 ms from a run); air pitch on the model
  `clamp(−vy·0.045, −0.22, 0.30)` blended by `airPose`, the head
  counter-rotating 40 %; the landing squash held under −0.15 for 120 ms with
  the head dipping.
- The grab is a lunge (nose-down 0.12 rad, 8 cm forward, the foreleg −0.6
  for 120 ms, the head up with the object 200 ms later); the wheek has
  120 ms of inhale (head down 0.2, pop −0.15, ears back) before the call;
  the stop's lean 0.089 → 0.14 with a 60 ms overshoot.
- The face reads: an eye catchlight bead over 1.0 (a 2 px white dot at
  12 m); the head 12 % larger at the driving lens only; the ears 30 % longer;
  the rest lens's flank drift finished (20° → 60° over 6 s once rest ≥ 0.45
  and nothing is chasing) — and undone by the walking recentre of E1.
- Four body sounds in `sfxTable`: `shake` (7–9 low-passed noise puffs at
  ~12 Hz with drip grains, wet-scaled), `chew` (a soft double click every
  0.4 s while `capyChewT > 0`), `snort` (a 90 ms burst through the wheek's
  band, on a denial), `yawn` (the wheek's contour inverted and slowed ×3, on
  the nap's entry); the wheek's question contour for the soft row.

**Instrument.** `animAudit` at 60 Hz: ≥ 4 consecutive grounded frames with
pop < −0.15 before airborne; pitch range across the arc ≥ 0.35 rad; ≥ 6
frames under squash-y 0.92 on landing; the wheek's headX minimum ≥ 100 ms
before its maximum. Face-visible (dot > 0.2) ≥ 40 % of rest frames over 60 s.
Four sfx clusters ≥ ⅓ octave from `rustle`; a 90 s Sydney soak with a swim
and a nap fires `shake ≥ 1`, `yawn 1`, `chew ≥ 4`.

### E3 · THE MIX (audio 2, 3, 4, 5, 8, 9)
- Range: `sysMUS_CHASE_PAD` −0.25 → −0.6; the pulse's velocity ×2.5;
  intensity on the pad 0.3 → 0.8; the marquee lift on the pad 0.32 → 0.9;
  the calm lean allowed to take the pad DOWN 4 dB.
- The room: a per-room make-up on `acRoomOut` from the IR's energy at
  build; `sysSEND_NEAR` 0.35 → 0.7 for the interiors and the cave, 0.5
  elsewhere.
- The still state is the world's: `sysMOVER_CALM` −0.35 → +0.5; the
  ladder's timer ×(1 + 0.4·calm) rather than slowed; the near ring drawn in
  past calm 0.7; Kyoto and Palawan get a leaves/lagoon bed at 0.10.
- Stings over the pad: `× (1 − 0.45·musStingEnv)` on the pad and −300 Hz on
  the filter in the one writer, τ 0.15 in / 0.8 out.
- THE SLEEP: while `capy.nap > 0.6` the pad and bass to 0.0001 over 10 s,
  the beds +3 dB, the purr the only voice; on wake the next chord first, one
  `musLiftNote` as an upbeat. The second voice at 0.15; a slow pulse at 0.5;
  the theme (F3) as ostinato at 1.0 — `musAudit().layers`.
- The stems: `bassK` 0.5 → 0.35, `bass2` 0.22 → 0.4, the pad `cut` floor
  620 → 900 with `cutK` 1.6, the pluck stem +3 dB, a second tilt at 2.4 kHz.

**Instrument.** `qa/l6r-audio-states.js`: chase RMS ≥ still + 4 dB and chase
centroid ≥ still centroid in 5/5; marquee ≥ still + 5 dB; peaks < −6 dBFS,
`red` 0. Room − world on a wheek ≤ 12 dB in the cave, ≤ 18 in Venice/Hanoi.
Still window: world RMS ≥ score − 8 dB in Kyoto/Venice/Palawan/Pantanal.
Every sting ≥ bed + 4 dB with the pad ≤ bed − 3 dB. A 60 s nap: score
≤ −50 dBFS for ≥ 20 s, back ≥ −30 within 4 s of wake. `l6r-audio-spectrum`:
share ≥ 500 Hz ≥ 20 % in 15/19, `laptopDb ≥ −5` in 17/19, above 5 k < 1 %.

### E4 · THE PAPER, THE PILLS, AND THE REASON WHY (W3, W4, W6, W8; play 3, 4, 7, 8; design 2.6)
- A priority on `toast()`: a line raised while `wowLive` is fresh takes the
  place-card slot alone and `showMoment` tutorial cards defer 8 s; ambient
  narration shares E3's 6 s fence; one toast at a time with a queue; a
  bubble line cannot repeat within 20 s; the governor's apology never in the
  first 30 s.
- Overheard pills are attributed (*"Hundred and eighty. I counted twice." —
  somebody on the Molo*), roman not italic, and skipped when the speaker's
  bubble is on-frame.
- The marquee says why not: Q inside 10 m of the podium with no concert →
  *closer to the middle* / *nobody's here yet — wait* / *that's one — again*;
  the podium raised 0.3 m so "up onto" is true. The same pattern for the
  other eighteen through one `game.marqueeWhy(text)` channel.
- The hat row shows *armed · get away with it* while `wasStolen && chase`;
  PUFF is named the first time it appears (*a wheek in the air is a puff*);
  the arrival tick (`photo-op`) names its cause; records say their unit.
- The paper: `.capyui-finds`/`.capyui-marqsay` fold into the tuck only; one
  clue on the sheet; wow-row text ≤ 48 chars; `marqhow` 12.5 px; `jrkey`
  contrast ≥ 3:1; the picker's third row reachable at 1280×760.
- The recap is one sentence in the note's voice, italic, under the note.

**Instrument.** Flood onset in Venice: ≤ 1 pill and no `.capyui-moment` for
6 s; leaf text nodes ≤ 30 in every marquee-live frame. 0 frames with the
same bubble and pill text. The armed state within 1 s of `capy:grab` on the
hat. Arrival frames 19/19: paper ≤ 45 % of the viewport, ≤ 12 lines, no HUD
text < 10.5 px. `doneLines` one sentence.

### E5 · THE TICK BELONGS TO THE PLACE, AND THE ENDING COMPOSES (W7; design 2.6, 2.7, 2.8; play 6)
- `completeTask` refuses a row whose chapter is not the live chapter unless
  the row is `anywhere: true` (`wheek`, `swim`); `bin-chicken`, `dog-loose`,
  `sprinkler` stop ticking abroad; a 3 s arrival grace on non-arrive rows.
- `to-monaco` ticks at the door, not the spawn; Venice's siren says *forty
  seconds*; the Drift's cloud sea darkens within 3 m of an island's edge and
  the fall keeps the animal on screen.
- The coda: the rig at 6 m on the resting lens; the paper, map and aim
  hidden from `closing` to the ledger; a crowd keep-out on the lawn once
  staged; the gardener's chase off on a finished file; each keepsake's flash
  paired with its name on the note line as its note sounds.

**Instrument.** A 60 s Venice soak that tips every bin ticks 0 Sydney rows;
the fuzz asserts `chapterOf(tick) === live` on every tick. Coda frame:
keepsakes ≥ 12 px in ≥ 15 of 19; `npc:caught` 0 on a finished file's walk.

### E6 · THE SKY, THE GROUND AND THE LAMPS (art 5, 6, 7)
- Clouds as two soft cards per puff (radial alpha, depthWrite off) over the
  geometry with a lit term `0.5 + 0.5·dot(n, sun)`; a horizon strip taking
  the sun's lobe on its side.
- `grain()` gains a third octave: a 6–10 m value field at ±6 % with a hue
  drift toward the chapter's secondary; a 1.5 m wear band along the
  spawn-to-marquee line in the floor-graphics mesh; Hanoi's lake takes the
  water shader.
- Emitters emit: two lamp boxes over 1.0 per night car and a wet-road bar
  under each (Kowloon, Iceland, Monaco); a ground pool decal per lit window
  (one merged additive plane per chapter); the yacht's cabin has windows.

**Instrument.** Luma step across a cloud edge over 4 px ≤ 30 (today > 60);
sky-band sd ≥ 1.5× on four arrivals; bottom-band sd Sahara rest 11 → ≥ 20;
Kowloon ≥ 1 cluster > 230 under each car within 30 m; Iceland pavement under
a window ≥ +15 luma over the pavement 5 m away.

### E7 · THE VOICE'S TICS (W5)
A phrase table in `qa/l4-lines-dups.mjs` (*eleven years*, *Tuesday*, *every
single*, *, that is.*, *nobody has ever*) with a ceiling of three files each;
the surplus rewritten in the chapter's own idiom (the Drift keeps *eleven
years*); the four capitalised toasts lowered. **Instrument.** The audit green.

### E8 · THE MACHINE (qa F1–F8)
The machine holds — 19 chapters × 3 laps, the fuzz 19/19, 76 walked legs,
three hostile saves, the `file://` build: zero NaN, void falls, errors,
leaks. What it does not hold is the frame, and one body is falling for ever.
- Every first entry is one frozen frame of 1–5.5 s (the cave 5.5 s,
  Antarctica 4.6, the Pantanal 3.5, Hanoi 3.2): `ensureBuilt` runs inside a
  fixed 460 ms hold and `renderer.compile` is never called (269 programs by
  the end of a lap). `renderer.compile(scene, camera)` inside `biomeGo` after
  the build and behind the white; the card held until the build has
  returned, not until a timer; the postcard's rise on a compositor-only
  property.
- The governor sheds pixels but never physics: `MAX_SUBSTEPS = 5` made a
  contended Quay 4 fps with `world.step` at 33 ms (5 × 6.6). At rung ≥ 2 the
  substeps are 2 and `dt` is clamped to 1/20; the shadow pass at half rate
  (`shadowMap.autoUpdate = false`, `needsUpdate` every other frame); said on
  the settings card.
- Monaco's `camera` prop is `hidden` yet DYNAMIC, falling at the 90 m/s cap
  1.5 km under the world, one solver save per frame (+211 in 9 s standing at
  the spawn; Hanoi's wine bottle the same). `physHide` parks the body STATIC
  and `physUnhide` re-types it DYNAMIC before the rescue; the fuzz FAILS on
  a `solverSaves` delta.
- The soak is a test: `npm run soak` runs the fuzz and the load probe under
  playwright and appends one JSON line per run to `qa/soak-history.jsonl`;
  `qa/soak-diff.mjs` fails on any column moving > 30 % against the last
  three rows.
- The idle lens parks 2.5 m up and 48° down beside furniture and C does not
  release it: the boom clamp tries ±25° and ±50° of yaw before it shortens
  under 5 m (taken by E1, which owns the camera).
- The budget section of CONTRACT.md rewritten with the measured table (ten
  chapters over 220 calls; Hanoi 467k triangles; `post.render` 4–12 ms is
  the frame, the simulation 3 ms). A `v:1` save with wrong types quarantined
  rather than treated as empty.

**Instrument.** `qa/l6r-qa-load.js`: longest frame after `hud.cross` ≤
250 ms in 19/19 quiet (today 1.7 s median); the fuzz `solverSaves` delta 0
in 19/19 (today Monaco +274); under CPU throttle ×6, `world.step` per frame
≤ 2.5× its per-substep mean in Quay and Manly; `qa/soak-history.jsonl` ≥ 1
row per commit.

## Order of work
L6-1 E8 + E5 (the instruments and the gates first) → L6-2 E4 ‖ E2 ‖ E7 →
L6-3 E1 ‖ E3 → L6-4 F3 ‖ F5 ‖ E6 → L6-5 F4 ‖ F2 → L6-6 F1 → closeout
(CONTRACT.md, memory, the summary). Every batch: `npm test` green,
`node build.mjs` green, its own instrument moved, the fuzz started in
nineteen chapters, the settled frames re-taken where the picture changed.
Batches joined by ‖ run as parallel agents on disjoint files or disjoint
regions of systems.js, edited only with the Edit tool.

## Not taken, and why
- A mischief score with multipliers; a day/night clock: refused, again.
- THE WEATHER FRONT (art A): the best picture idea and the one that touches
  weather.js, the cloud field, the dome and the wet at once; held as the
  stretch item after L6-6 if the budget allows.
- The far-field rewrite of every chapter's ground: E6's octave and wear band
  are the version that costs no triangles.

## After (13 Sep 2026)

Built in two sessions (the first's limit fell with E1, E3, E6, F4 and F5
in flight; the second finished them and built F1–F3). The record, the
numbers and what is owed are in CONTRACT.md's top section. Twenty-two
`qa/l6-*.js` probes carry the measurements.
