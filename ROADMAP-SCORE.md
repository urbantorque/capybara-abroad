# ROADMAP-SCORE — the tune in front: a theme, a voice, an arc, and a quieter world (21 Sep 2026)

The brief, in the player's words after the thirteenth lift: the wavy white
noise under everything and the people's noises and the notifications of
each place are too loud, too repetitive and distracting; the music should
come forward and carry a deeper emotional tone; the bar is the great
soundtracks — Zelda, the Nintendo classics — matched to this game's own
tone; the score is already good and should be taken to great.

**Read before proposing anything to this codebase.** The score is entirely
synthesised — twenty-one palettes (`sysMUS_PAL`, `systems.js:5756`), some
fifty modelled instruments dispatched through `musLiftNote`
(`:18585`), a voice-led pad, a bass, a lead that plucks chord tones at
random gaps, five bands, a lift figure per marquee, stings in key, an
arrival phrase that is a rhythm and a contour (A4), a second voice that
answers a beat later (A6), a breath that thins the score every 78–146 s,
a room per chapter, an ensemble widener (v41) — and **one tune**:
`sysMUS_THEME` (`:4970`), eight notes in scale degrees, *do sol do' sol |
fa mi re do*, which a player hears only from the busker (L7's musician) or
as an ostinato once a chapter is 100 % done. Everything else the pad does
is a random walk through `next` tables. There is no composed melody in
ordinary play, no progression that goes anywhere, no leitmotif for a
person, and the mix was inverted on purpose: L7 E1 wrote "music sits
UNDER the sfx" (`sysMUS_BUS`, `:4780`) and built the world's one-shots as
a sidechain that ducks the pad and a flow that thins it while walking.
The ambience ladder makes 149 `sysAmb` calls over 96 rungs on a 14–34 m
ring at 0.05–0.20; the weather beds cap at `sysWX_BED_MAX = 0.19`; NPC
voices default to `npcSFX_VOL = 0.34` through a distance law (since
"sounds people make", 28 Aug). All of it is measured and none of it is
wrong; it is the wrong *balance* for what the player now wants.

**The decision reversed, in one line.** L7 E1's inversion — the score
under the world, ducked by its transients, thinned by walking — is
undone on the player's ear. The score leads; the beds sit under it and
duck for its statements; the world's transients keep their room without
pushing the pad down. Written here as a reversal with its reason, per
the law on re-basing a row: the sound rows named in Part Q are the only
ones that move, and every one of them keeps its old value behind
`noQuiet` for an A/B.

**The honest limit.** No agent in this pass can listen. Composition is
written as note data against the rules that made those soundtracks work
(one theme anybody can hum, a signature timbre that is the same in every
place while the arrangement is the place, motifs for the people and the
things that recur, an arrangement that answers where you are and what
has happened, a payoff at the end); the mix is measured on the buses;
the player is the ear. So: every layer under its own flag, a switch on
the settings card, and a build published after W1 and after W3 for the
player to hear and send back. The numbers below are proxies for
foreground, memorability, quiet and arc — not for beauty. Beauty is
returned by the player, and this file's Closed section records what they
said.

The laws stand: synthesis only (no samples, no recordings — the audio
law since v13); one writer per parameter; every new term a
`game.state.noX`; the score's own rows (chords, roots, next, dwell, cut,
instruments) are not re-based — the theme is laid *over* them.

## What this pass measures

1. **Foreground.** Music-bus RMS over the ambience beds ≥ +6 dB at rest
   and ≥ +3 dB walking, in every chapter (W0 records today's — L7's own
   drive probe read the score 9–13 dB *over* the world before it was
   inverted, and the inversion's target was "under"). Limiter tap,
   one bus muted to read the other (`qa/s1-spectrum.js`'s method).
2. **The theme, heard.** A full statement (A + B, sixteen bars, the
   ocarina, in the palette's key) within 40 s of every arrival, 19/19;
   and never more than six minutes between statements at rest.
   `game.musThemeAudit()` counts them.
3. **Quiet.** Ambience-ring events ≤ 10 per minute at rest in every
   chapter (Sydney measured 52 in 90 s before "sounds people make"; W0
   records today's), NPC voice lines ≤ 6 per minute within earshot, no
   voice twice within 45 s, the beds' ceiling down 5 dB, notifications
   never overlapping.
4. **The motifs, at their moments.** The traveller's, home's and the
   companion's four-note figures fire on the glimpse's walk-off, the
   shelf growing, the companion's approach and homecoming, the absence
   return — counted against the events that already count them
   (`travSeen`, `shelf:grew`, `compClimb`, `palAwayArm`).
5. **The arc.** Per chapter: statement at arrival → drift → countermelody
   at one third → pulse at one half → walking bass at two thirds → the
   marquee's lift as the statement's last bar → the full statement when
   the chapter is done → a leaving cadence on the board; the finale's
   nineteen notes are the theme completed. Layers counted by progress in
   `musThemeAudit()`, 19/19.
6. **The line held.** The limiter's gain reduction ≤ 3 dB on the loudest
   statement; the score's energy share at 1–4 kHz during a statement
   ≥ 8 % (today ~0 % above 5 kHz — the theme brings presence, not hiss);
   the scheduler ≤ 0.2 ms a tick with every layer live.

## Part M — the music (src/systems.js §5, the music region and its tables)

### M1 — THE THEME, IN FULL

The eight notes are a good seed and a whole tune is two phrases and a
tag. A: the existing eight — *do sol do' sol | fa mi re do*, long-short-
short-long twice (`sysMUS_THEME`/`_DUR`, kept exactly). B: the answer
that climbs and comes home — *la sol fa sol | mi re do re* → a held *do*
— written the same way, scale degrees over `scale`, the third flat in
minor palettes (the existing rule and the only thing that moves between
palettes). Tag: three notes, *sol la do'*, over the adventure cadence
(♭VI–♭VII–I where the palette's scale allows it — the Hyrule move; the
palette's own dominant cadence where it does not). A + B + tag = 8 + 8 +
3 = **nineteen notes**, which is the coda's own count (M5).

A statement plays over a **fixed progression**, not the drift: major
palettes I–V–vi–IV | I–IV–V–I, minor i–♭VI–♭III–♭VII | i–iv–V–i, modal
palettes a two-chord oscillation on their own roots (the Drift's
fourths, Antarctica's fifths, Hanoi's sus stay what they are — the theme
was already checked against every palette's chord 0, 21/21 at six
notes or more, `:4960`). One table beside the three thin ones
(`sysMUS_PROG`, keyed by palette index like `sysMUS_2ND`), never inside
`sysMUS_PAL`.

### M2 — THE VOICE (the ocarina)

One new instrument, `musOcarina`, the theme's timbre in every palette
while the palette's own lead keeps its plucks: a sine and a triangle an
octave apart through the palette's lowpass at 1.6× its cut, a breath
onset (40 ms of the mono noise buffer, band-passed 1.5–4 kHz, −18 dB),
vibrato at 5.5 Hz fading in after 180 ms (depth 12 cents), portamento of
30 ms between adjacent notes, a 220 ms release, register D5–D6, through
the ensemble bus and the room like every other voice. Dispatched from
`musLiftNote`'s switch as `'ocarina'`; `noOcarina` sends the theme to
the palette's lead instead, so the two can be A/B'd.

### M3 — STATEMENT AND DRIFT

`musStatement(kind)` schedules A, or A + B + tag, over `sysMUS_PROG` at
the palette's own tempo (a beat from `dwellA` — the theme's eight notes
run about 8.4 s at 0.6 s a beat today, `:4975`), with a countermelody a
third or sixth below a beat late on the palette's lead (the second
voice's own machinery, `sysMUS_2ND`, re-aimed) and the roots on the bass;
the pad voice-leads the progression; then the drift resumes from the
progression's last chord (the `next` walk continues from wherever the
statement left the pad, never a cut). Moments, each once:

- **arrival**: 6 s after the arrival phrase (which stays — the rhythm the
  tune is built on), A + B + tag;
- **the marquee's lift**: the existing lift figure becomes the tag's last
  bar, so the lift lands on the tune;
- **chapter done**: today's ostinato becomes a full statement, then
  continues as the tune under everything, as now;
- **the nap's wake**: A alone, on the ocarina, half tempo;
- **rest**: if nothing has played for 4–6 minutes and the animal is not
  mid-task, A alone.

`noTheme` cuts every statement (the arrival phrase and the ostinato
stay as they are today).

### M4 — LEITMOTIFS (the people and the things that recur)

Three figures, each a fixed interval shape and its own instrument, each
short enough to sit inside the drift without a progression:

- **the traveller** — a falling fourth then a rising step (*sol re mi*,
  on the mallet, three notes, 1.4 s): the glimpse's walk-off (N2), the
  stall's "you again", the four cameos' greetings, the finale's sit;
- **home** — the theme's first four notes alone, on the pad's own bank
  as a swell rather than a pluck: the shelf growing (`shelf:grew`), the
  Sydney arrival's statement opens with it, the morning after;
- **the companion** — a three-note skip up (*do mi sol*, on the pluck,
  0.9 s): the pickup (`compTake`), the comes-over (X1c), the homecoming
  (its own sound stays, the motif lands a beat after);
- **absence** — not a motif but a mode: the return arrival N3 arms
  (`palAwayArm`) plays A in the relative minor (the third and sixth flat)
  instead of the plain statement, then the drift as usual.

`noMotif` cuts the four. Every motif goes through `musLiftNote`, so it
is in key by construction, like the stings.

### M5 — THE ARC (progress, sleep, the ending)

The chapter's own progress (`musProg`) already gates the second voice at
0.15, the pulse at 0.5 and the ostinato at 1.0. Re-based as an
arrangement rather than three switches: **countermelody at one third**
(the second voice becomes M3's countermelody proper, on every statement
and under the drift's plucks), **pulse at one half** (kept), **walking
bass at two thirds** (roots and fifths on each chord change, on the
existing bass gain, velocity 0.4 — new), **the full statement at done**
(M3). The nap: A at half tempo on the ocarina alone with the room's
tail at 1.5× (the sleep-bed machinery, `musSleep`, exists). The finale:
`sysFinaleCoda`'s nineteen notes (`:36400`, one per keepsake) are
re-pitched to be A + B + tag — the theme completed once, in Sydney's key,
with every layer under it, each note still naming its keepsake; then the
hush, as now. `noArc` cuts the added layers (the three gates fall back to
today's).

- **Instrument:** `qa/score-theme.js` — `game.musThemeAudit()` (statements
  by kind and moment, motifs by event, layers by progress, the ocarina's
  note count) over a 19-arrival sweep and one full chapter from 0 to
  done (the tutorial bot's Sydney run is the cheapest route to done).
- **Cost:** scheduling only — the score is already a lookahead scheduler
  (`sysMUS_LOOK` 2 s, `sysMUS_TICK` 240 ms); a statement is at most three
  voices more than the drift. ≤ 0.2 ms a tick, measured.

### M1 — shipped (21 Sep 2026)

B is nine notes, not eight: *la sol fa sol | mi re do re | do*, degrees
5 4 3 4 | 2 1 0 1 | 0, durations 2 1 1 3 | 2 1 1 1 | 4 — the held *do*
is a note of its own, which is what the brief's degree list says and
what makes the second phrase close (re over V, then do held on I); the
tag *sol la do'* is 4 5 7 at 1 1 4. A + B + tag is therefore **twenty**
notes and the coda pays for the twentieth (M5). `sysMUS_THEME`/`_DUR`
untouched; `musDegOff(d, pal, scale)` is the one resolver for every
degree in the pass (the third and sixth flat where the scale is minor,
the existing rule). `sysMUS_PROG` is one table beside `sysMUS_2ND`:
`mode` rows build I–V–vi–IV | I–IV–V–I (major) or i–♭VI–♭III–♭VII |
i–iv–V–i (minor) from the scale on the tonic — `musProgChord` voices
the five-note pad shape just over the palette's home chord, the root
beside `roots[0]` — and the tag's cadence is ♭VI–♭VII–i where the scale
has those degrees, V–I where it does not; `own` rows never leave the
table: Kyoto's thirdless hirajoshi (D/F, closing Bb→D), the two quartal
palettes, the hijaz row, the Drift, Antarctica, Monte Carlo and the five
bands (a vamp plays its vamp, Venice its whole seven-chord sequence).
Not one chord, root or next row moved. **Measured** (`hud.themeAudit(n)`,
no palette touched): every note's pitch class in the palette's scale
**20/20 in 21/21**; against the progression chord actually under each
note, chord-tone share by beats 0.33–0.83 (the major built rows 0.64,
the minor built rows 0.44 — the held do over ♭VII is a suspension by the
roadmap's own progression; Monte Carlo's own cycle 0.83).

### M2 — shipped (21 Sep 2026)

`musOcarina(when, midi, vel, gap)`: a sine with a triangle an octave
over it at 0.18, the palette's lowpass at 1.6× its cut **with a 1.4 kHz
floor** (Iceland's 470 × 1.6 = 752 Hz would sit under a D6 — the
`sysMUS_SKYCUT` argument again), a 40 ms breath from the MONO
`noiseSrc()` band-passed 1.5–4 kHz at −18 dB, vibrato 5.5 Hz / 12 cents
on `detune` fading in after 180 ms (nothing else writes this voice's
detune), 30 ms of portamento when the note before ends where this one
starts, 220 ms release. Register: the tonic folded into MIDI 69–80
(`musOcaBase`) so the octave the tune spans sits at D5–D6 in every key.
Dispatched as `'ocarina'` from `musLiftNote`; `noOcarina` sends the same
notes to the palette's lead. It has its own gain, **`musOcaBus`, into
`musWide` — after `musSideG`, so the world's transients never duck it,
and through musWide's dry taps and its send to the room like every
sustained voice.** That node is W2's one handle. `sysMUS_OCA_VEL` 0.105
against the lead's 0.03–0.075 and the lift's 0.115: above the plucks,
not timid. **Measured** (analyser on `game.music.bus`, Sydney, context
running): master RMS 0.047 at rest → 0.06–0.14 across the eight notes of
A on the ocarina (+3 to +9 dB), 0 errors. `hud.ocarina(midi, gap, vel)`
plays one note for W2's bus work.

### M3 — shipped (21 Sep 2026)

`musSetChord` is now a wrapper on `musSetChordTo(chord, root, nextRoot,
when, xf)` — the pad's voice-leading, the bass and its walk, one path —
so a statement hands the pad a built chord exactly as the drift hands
it a table row. `musStatement(kind, moment, delay, scale)` takes one
request slot; `musStmtTick` at the top of `musTickBody` builds the
event list once (chords at the phrase's own turns — notes 0, 3, 4, 7 of
A and 0, 3, 4, 8 of B, the tag's per note; the tune on the ocarina; the
countermelody a scale-wise third below, a sixth under the held notes, a
beat late on the second voice's instrument at its row's velocity ×
`sysMUS_2ND_GAIN`) and feeds it to the same two-second lookahead, so
`musCurChord` moves when the pad does and a sting mid-statement is in
key. The beat: `0.6 × dwellA / 9` clamped 0.42–0.9 (Sydney 0.6, Kyoto
0.87, Pasto 0.42, the Drift 0.9), a band's own crotchet snapped to its
bar. `musChordAt` parks past the lookahead beyond the end; the hand-over
is scheduled inside it — a `mode` row voice-leads onto the palette's
chord 0 at the last note, an `own` row is already on a table chord —
and the walk continues from there: **never a cut** (the chord index
held for the whole 21.6 s in Sydney, then 0 with a fresh dwell). The
plucks thin to a third under a statement. Moments: arrival **6 s after
the phrase resolves** (1 s after a wait that ran out), the lift's figure
then the tag over the cadence, chapter done (the ceremony asks for the
full statement 2.4 s after the resolve, replacing the swell's tag; the
ostinato now waits for a statement to END with the chapter done —
`musOstArmed`, so it never plays under or before the tune), the nap's
wake (A, half tempo), rest (4–6 min since the last, grounded, no pill
in 6 s, not asleep). One pending slot with a rank — full > A > wake =
tag — because the harness's animal naps at ten seconds idle and every
`hud.cross` woke it, and Pasto's arrival read as a `wake` until the
arrival outranked it. A border cuts a live statement and forgets a
pending one. `noTheme` cuts all of it; the phrase and the ostinato stay.
**Measured** (`qa/score-theme.js` sweep + sweep-b, context running): a
full statement **19/19 arrivals, 6.3–10 s after the cross** (the roadmap
asked for 40), the right palette and key in every row (Pasto A minor at
0.42, Kyoto D minor at 0.867 with F and Bb, Göreme hijaz with the Eb,
Hanoi and the cave pent, Antarctica at 0.8); 20 ocarina notes and 9
countermelody notes per full statement on a palette with a second row;
lift → tag 3 notes; done → full statement, ostinato 0 under it, 12 notes
in the 26 s after.

### M4 — shipped (21 Sep 2026)

`sysMUS_MOTIF`: traveller *sol re mi* (4 1 2, mallet, 1.4 s), home (the
theme's first four as a **swell on the pad's own bank** — `musPadSwell`,
two detuned oscillators in the pad's spectrum into `musFilt`, so it has
the pad's cut, bus, sidechain and width and nothing writes
`musPad.gain`), companion *do mi sol* (0 2 4, pluck, 0.9 s). Through
`musLiftNote` (a new `'swell'` case), degrees through `musDegOff`. A
4 s same-name gap; dropped under a statement or asleep. Wired:
`npc:travSeen` and `npc:travMet` → traveller, `shelf:grew` → home, the
companion's pickup, the X1c comes-over, `compClimb` and the homecoming
(0.6 s after its own sound) → companion; Sydney's arrival statement
opens with home under its first four notes. Absence: `sysPalAwayCheck`
arms `musAbsenceArm` beside `palAwayArm`, and the arrival then says A
alone in the parallel minor (the third and sixth flat), moment
`absence`. `noMotif` cuts the four. **Measured** (`qa/score-theme.js`
motifs): each event fires its figure once — travSeen, travMet,
shelf:grew, the companion door — 0 dropped. Honest gap: the three
companion sites are wired by reading; no harness run has a herd, and
the absence mode was not driven (a 20-minute clock; the arm is one
line beside the one N3 already fires).

### M5 — shipped (21 Sep 2026)

The second voice keeps its 0.15 entry — L6 measured a naive hour at
chapProg 0.17, and an answer that starts later is one most players
never hear — and from **a third** its role changes: the scale-wise
third below the note the walk just played (`musThirdBelow` from
`musMelDeg`) instead of a random chord tone. The pulse at a half is
kept. From **two thirds** the bass walks: `musWalkNote` strikes the
root on each chord change and the fifth at half the dwell into the
bass's own filter (`musBassIn`), velocity 0.4 against the sine's 0.5,
so `musBassGain` keeps its one writer. The wake statement opens the
room ×1.5 as a term in `musRoomSet` (the wet gain's one writer). The
coda: nineteen keepsakes carry the first nineteen notes of A + B + tag
at the tune's own rhythm (0.22 s a beat, 7.9 s for 36 beats — near the
old 19 × 0.34), each on its chapter's lead in Sydney's key, the pad
walking the progression under them (`musCodaChords`); the twentieth,
the held *do'* that ends the tag, is the ocarina's, with no keepsake to
name; then the hush as before. `noArc` puts the gates and the coda
back. **Measured** (`qa/score-theme.js` sydney, coda): counter live at
prog 0.35 (every second-voice note a third below), pulse at 0.5
(8 strokes / 20 s), walk at 0.7 (one change, one strike — Sydney's
dwell is 9–15 s), the full statement 3.8 s after done; the coda 20
notes, indices 0..19 in order, pitches in D `62 69 74 69 67 66 64 62 |
71 69 67 69 66 64 62 64 62 | 69 71 86`, hush at 9 s, the ledger after.

**Cost, measured** (`qa/score-frametime-w1.js`: `musTickBody` timed
inside `musTick`, every layer live plus a full statement against
`noTheme + noArc + noMotif`, 20 s an arm × 2, headless): Sydney 0.273 vs
0.332 ms a tick, Kyoto 0.351 vs 0.195. The pass adds ≤ 0.16 ms a tick
inside a ±0.1 ms noise floor; the absolute tick with the drift alone
was already 0.2–0.33 ms on this machine, so "≤ 0.2 ms with every layer
live" is met on the delta and not on the absolute.

**What no agent could hear:** whether the ocarina sits above the plucks
on speakers (the bus is W2's), whether B's held do over ♭VII reads as a
suspension or a wrong note in Pasto and Iceland, whether the home swell
reads as the pad rising or as a fifth voice, whether 0.42 s a beat is
too quick in Pasto and Manly. The player is the ear.

**For W2 (the lines W1 touched near the pad writer and the sidechain):**
`musicStart` — `musOcaBus` is created right after `musWide.connect
(musSend)` and connects to `musWide` (after `musSideG`); `musBassIn =
bassLp` beside `musBassGain`. `musRoomSet` — a `wakeK` term on the wet
gain. The frame writer — the arrival block now asks `musStatement` when
the pend resolves; the sleep block gained the rest timer; the wake edge
skips `musChordAt` under a live statement. The pad writer's 0.3 s block
is untouched. `musTickBody` — `musStmtTick(now, horizon)` at the top,
`brK × 0.35` under a statement, the ostinato gate on `musOstArmed`.
`musSetChordTo` — the walking bass strikes at the end of it. The
settings card sets `game.state.noQuiet` with the other three.

## Part Q — the quiet (src/systems.js §5b, src/npc.js, src/weather.js)

Every row here is a reversal of L7 E1 or a level the player named; each
keeps its old value behind `noQuiet` so the two mixes can be A/B'd from
the settings card.

### Q1 — THE INVERSION UNDONE

`sysMUS_FORE = 1.7` multiplies `sysMUS_BUS` and every palette's `bus` in
one place (the pad writer), not twenty-one edits; the sidechain's depth
(`sysMUS_SIDE`) halved and the ocarina's bus taken out of `musSideG`'s
path so a statement is never ducked by a footstep; the flow's −3 dB on
the pad while walking removed (the score no longer thins for movement —
a Zelda field theme does not get quieter when you run). Measured: music
over the beds ≥ +6 dB at rest, ≥ +3 dB walking.

### Q2 — THE BEDS (the wavy white noise)

`sysWX_BED_MAX` 0.19 → 0.11; wind 0.50 → 0.30, rain 0.62 → 0.45, chirp
and rustle halved; the wind bed's window randomiser (the "wavy" — its
depth in `noiseMake`/the wind LP's LFO) halved; and the beds **duck under
a statement**: `wxBedBus × (1 − 0.5 · musStateEnv)`, an envelope the
statement raises and lets fall over 4 s — L7's sidechain turned round
and aimed at the beds only, never at the sfx one-shots.

### Q3 — THE LADDER (the ambience ring)

A token bucket on `sysAmb`: ≤ 10 events a minute at rest (refilled by
movement — a walk may hear more, a stand hears less); ≥ 45 s between
the same voice; the ring's gain 0.05–0.20 → 0.04–0.13; nothing from
the ring during a statement's first bar. The 96 rungs are untouched —
it is the clock that changes.

### Q4 — THE PEOPLE

`npcSFX_VOL` 0.34 → 0.24; a shared bucket in npc.js of ≤ 6 voice lines
a minute within earshot (the ladder's own idea, for people — the first
line of an exchange spends the token, the rest of the exchange is free,
the existing rule); company babble (V2.4) −4 dB; the Marrakech and Rio
crowd beds −3 dB; no NPC line in the 2 s after a tutorial or tick pill.

### Q5 — THE NOTIFICATIONS

Tick, chime and pill sounds −3 dB; a 1.5 s queue so two never overlap
(the pill queue already exists for the text — the sound joins it); the
wallet bump silent under three yuzu; all already in key.

- **Instrument:** `qa/score-mix.js` (limiter tap, per-bus RMS at rest and
  walking, per chapter, one bus muted to read the other),
  `qa/score-events.js` (ring / NPC / notification events per minute,
  unique voices, longest same-voice run, via the in-file `game.sfxAudit()`
  W4 built — the public `game.sfx` sees nothing the file does to
  itself), before and after.
- **Cost:** none — levels and clocks.

## Part L — the listening (the player's part)

A "score" row on the settings card: **in front** (this pass) / **as
before** (L7's mix, `noQuiet` + `noTheme` + `noArc` + `noMotif` together,
one switch), saved in `capy3.prefs.v1` like the volumes. A build
published after W1 (the theme, the world as before) and after W3 (both),
so the player can hear each half on its own. The player's own checklist,
written here so the Closed section can answer it:

- Can you hum it after one chapter? Which chapter's version stuck?
- Is there a place where the music is *wrong* for the picture?
- Is anything still too loud, too often, or in the way of the tune?
- Does the ending land?

## Order and ownership

- **W0 — the mix, before.** In an isolated worktree on its own port so
  W1's live edits cannot contaminate it: `qa/score-mix.js` and
  `qa/score-events.js` across all nineteen at rest and walking — today's
  music-over-beds, events per minute, unique voices; the "before" for
  numbers 1 and 3. Review only.
- **W1 — Part M** (systems.js: the tables at `:4940–5800` and the music
  engine `:17936–22800`; nothing in §5b's sfx/ambience code, nothing in
  npc.js or weather.js). The theme, the voice, the statements, the
  motifs, the arc, `musThemeAudit`, the settings-card row. A build
  published when it lands.
- **W2 — Part Q** (systems.js §5b: the beds `:16700–16900`, the ladder
  `:1723–1880` and `sysAmb`, the sidechain `:4770–4910` and `musSideG`,
  `sfx()` and the notification calls; npc.js's `npcSFX_VOL` and the
  bucket; weather.js's bed depth). After W1 lands — the sidechain rows
  W2 moves sit beside the pad writer W1 is in.
- **W3 — the closeout.** The six numbers; nineteen arrivals audited for
  the statement; the finale's coda heard through `musThemeAudit`;
  CONTRACT.md's entry (THE SCORE PASS); this file's Closed section with
  the player's answers to Part L left as blanks for them to fill; a
  build published.

## Rules for every agent

- Read CONTRACT.md's THE MIX PASS (v41), THE SOUND PASS (S1/S2/M1), THE
  MIX MEASURED (S1/S2) and THE SEVENTH LIFT's E1 before touching a bus:
  every level in this file was measured once already and the reason is
  written next to it.
- Never re-base a chord, root, next, dwell, cut or instrument row; the
  theme is laid over them. The sound rows Part Q moves are the only
  re-bases, and each keeps its old value behind `noQuiet`.
- One writer per AudioParam; a bed never enters the room; a sustained
  voice never enters `acSfxIn` (the v41 lesson — Son Doong's tail is a
  wall).
- Every term a flag; every number measured on the buses before and
  after; nothing claimed by ear — the player is the ear.
- One chapter per playwright run; own session only; stage by name;
  `git status` before every commit; never two live edits to one file.

## Held (named, not built)

Samples or recordings of any kind; a vocal; a tempo that follows running
speed; a theme song per NPC; a jukebox or a track list; lyrics; a why
said out loud, in music or otherwise.
