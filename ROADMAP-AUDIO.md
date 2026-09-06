# ROADMAP-AUDIO.md — the sound review, and the six no-regret items

> **CLOSED, 7 Sep 2026.** All six items are built, across three commits:
> `5c010c5` (A1 the mover, A2 for movers), `3ec97d6` (A1 the rest, A2 for
> one-shots, A3 the flock) and `33795ba` (A4 the arrival phrase, A5 the sky,
> A6 the second voice). See CONTRACT.md for what each one measured, and for
> the two things that are wired but unproven: the Freshwater's levels and the
> rain half of A5.

6 Sep 2026. Written from the audio director's chair after the character pass
landed (`ee4a0b2`). Scope: the score, the effects, the ambience ladder, the
weather bed, the rooms and the spatial law — all of `src/systems.js` §5/§5b,
the nineteen chapter files, `weather.js`, `npc.js`, `condor.js` and
`environment.js`. The companion document `HANDOFF-AUDIO.md` turns this into
tasks for the composition, sound design and implementation teams.

**How this was reviewed, honestly.** This is a code and instrument audit, not
a listening session: every voice was read at its call site, every bus traced
to the limiter, and every number below is either a constant in the source or a
figure a harness probe has reported. The harness cannot hear. Where a finding
depends on how something *sounds* rather than on what the graph does, it says
so.

---

## 1. WHAT IS THERE

The premise of this review is that capy3's audio is already unusually complete
for a game with **no audio assets at all** — every sound in it is synthesised
in Web Audio at the moment it plays. The previous passes (v41 the mix, P4 the
punctuation, F3 the sound over an hour, D7/D9, R4, R9) built a real production
chain. What follows is what a new director inherits.

| layer | what exists | where |
|---|---|---|
| **score** | 21 palettes (19 chapters, the title card, and Monte Carlo/Hanoi appended), a voice-led pad that never repeats, ~50 modelled instruments, six band arrangements (salsa 100, samba 132, baroque 96, HK synth 112, gnawa cell 1.7 s, Bond 132), a rhythm section for Pasto | `sysMUS_PAL`, `musPluck…musSongLoan` |
| **score dynamics** | ONE writer per AudioParam, a 0.3 s block reading `chaos`, `calm`, `loaf`, `flow`, `heat`, `lift`, `breath`; the Bond heat, Venice tide → organ pedal, Iceland aurora → choir, Sahara storm → gnawa strip | `systems.js:31508–31600` |
| **score production** | ensemble widener on the dry path, per-chapter room via `sysROOMS` (two convolvers cross-faded), `musFeel`/`musVel` humanisation, the breath (9–13 s dip every 78–146 s), the paradinha, the crossing duck (1.0 → 0.30 → 1.0), the pause lid, underwater lids at 620/1400 Hz | `musWide`, `musIR`, `musRoomSet`, `musBreathStep`, `musDuckG`, `sysSubSet` |
| **payoffs** | the lift (per-palette shape on the place's own instrument, in key by construction), five stings, the title score | `musSwell`, `musSting`, `sysMUS_STING` |
| **effects** | ~40 synth voices in `sfxTable`, per-name throttles, a global voice ceiling (12 starts / 165 ms), the `acMaster` swap that routes 64 `connect(acMaster)` sites through one bus | `sfx()`, `sfxGap`, `sysVOICE_*` |
| **space** | one inverse-distance law (near 6, rolloff 0.35, far 140, taper 45), a StereoPanner per placed call against the camera's right vector, an ear ¾ of the way from lens to animal, a room send per chapter with three interiors, the wheek echo off real reflectors | `audioPlace`, `sysROOMS`, `sysECHO_*` |
| **ambience** | a ladder of ~144 rungs across nineteen chapters on a 14–34 m ring, an anchor table of 19 rows so a bell comes off its campanile, a 120-entry log for the harness | `sysAmb`, `sysAMB_AT`, `hud.ambAudit` |
| **beds** | rain (two bands), wind, crickets, leaves, the rush (air past you), the scrape (a body on a surface) — all stereo, all placeless, capped at 0.19 and ducked 45 % under a swell | `wxBedStart`, `sysWxBedSet` |
| **people** | every NPC cue positioned through `sfxAt` (near 7, far 70, default 0.34); every bubble blips | `npc.js`, `sfxBlip` |
| **probes** | `hud.audioProbe`, `hud.mixAudit`, `hud.ambAudit`, `hud.stingAudit`, `hud.roomAudit`, `game.musAudit()`, `game.music.bus` for an analyser, `qa/tune-audio.js`, `qa/v41-rooms.js`, `qa/v41-ir.mjs`, `qa/audio2.js` | — |

**The serene core is real and it is structural.** Calm, loaf, breath and flow
all lean on the same three parameters through one writer; nothing in the
score can stab, because nothing in the score is a sample; the lift is built
out of the chord that is sounding. Nothing in this roadmap touches any of
that. Every music item below is a TERM in an expression that already exists,
or a figure played by `musLiftNote` on the palette's own lead — the two
shapes the previous passes proved safe.

---

## 2. FINDINGS

Eight, in the order they matter. Each names its evidence.

### F1. Every sound in the game is a one-shot with its pan frozen at birth

`sfx()` builds a `StereoPannerNode`, sets `pan.value` once, runs the synth,
and forgets it (`systems.js:15750–15760`). There is no handle, no `stop()`, no
way to move a sound after it has started. `playbackRate` appears once in the
audio code and it is the noise-window randomiser; **there is no Doppler
anywhere.** The only continuously-positioned sound in the whole game is the
Cali band, which has its own private placer — `musPlaceTick`
(`systems.js:15404`) — with exactly the right model: gain by distance, a
low-pass that closes with distance before the level does, pan against the
camera's right, all on `setTargetAtTime`. It has one customer.

Consequence: a vehicle passing you is a row of separate sounds, each panned
from wherever the vehicle was when that one fired, with silence between them.
The floatplane's engine is four notes per circuit by design (`environment.js:
101–117`), because a note every 1.4 s read as a pulse — the rationing was
right, and it was rationing a one-shot because a one-shot was all there was.

### F2. Space has one axis

`audioPlace` computes pan from the component along the camera's right and
nothing else (`systems.js:9372–9376`). There is no front/back cue and no
elevation cue. A gull directly overhead, a gull twenty metres ahead and a gull
twenty metres behind, at the same lateral offset, are the same sound. The one
sound whose direction the player most needs — something scattering *over* them
— cannot be told from something on the ground.

### F3. The movers are mostly silent, and the ones that speak are misplaced

The chapters are full of things that go past you. What they sound like today:

| chapter | mover | speed | what it plays | placed? |
|---|---|---|---|---|
| Sydney | the Whippy van | 3.15 m/s | a chime every 5.4 s inside 56 m; **no engine** | yes, `near 12 far 70` |
| Sydney | the floatplane | circuit at 58 m | four `hiss` notes a circuit | yes |
| Sydney | the lorikeet flush | — | one `gull` + one `rustle` at the tree | yes, at the canopy |
| Quay | the ferry (yours) | — | `hiss` puffs, `horn` | yes |
| Pasto | the condor arriving | orbit | `gull` at **volume 1.0, mono** (`condor.js:1477, 1492`) | **no** |
| Cali | the chiva | — | `horn` + `strum`, mono (`cali.js:2112`) | no (you are on it) |
| Rio | the bonde ×2 | 4.2 m/s | an ambient `tram` rung from a random bearing on the ring (`systems.js:30924`) | **no — it comes from nowhere near the tram** |
| Kowloon | the bus | 5.4 m/s | door `pop`s, a `chime` | partly |
| Venice | the gondola | — | nothing of its own | — |
| Hanoi | **240 scooters** at 5.4–9.6 m/s | — | nothing. `hanCue` fires bark/thud/whistle/tick/pop; no engine voice exists in `sfxTable` | — |
| Monaco | the silver car, 5.4–26.5 m/s | — | `hiss` only while you ride it (`monaco.js:3811`) | — |
| Antarctica | six orcas | 12 m/s | `splash`/`hiss`/`gull` events | partly |
| Pantanal | the herd, the cowbird | — | `rustle`/`bark` | partly |

The loudest place in the game — the alley that `sysROOMS` describes as "a
hundred and fifty engines in it" — has a room and no engines. Hanoi's medium
is traffic and its traffic is mute. Monaco's marquee object is the one thing in
the game that would sell Doppler and it makes a sound only for its passenger.

### F4. A flock cannot scatter

The Sydney flush (`environment.js:1690–1697`) is the right *event* — rising
edge on arrival, always on a wheek — and it is two one-shots at the canopy.
Nothing rises, nothing crosses the frame, nothing lands over your shoulder.
Pasto's 28 vencejos scatter when the bell goes and are silent; Venice's
pigeons are an anchored rung at the piazza; the storks clatter from the
parapet; the Antarctic colony has ten thousand birds and one `bark` anchor.

### F5. There are no continuous place sounds

The only sounds that run rather than fire are the weather bed, and the weather
bed is placeless by design. There is **no surf line** (Manly's surf is
`splash` one-shots every 3.5–8 s; Manly is described as the driest room in the
game), no river under the Uji run, no crowd bed for the Rio parade or the
Jemaa el-Fnaa, no traffic bed for the ring road, no colony roar. A shoreline
you walk toward and away from is the single most legible spatial cue an open
world can give, and this game has nineteen open worlds and none of them has
one. The primitive F1 asks for is the same primitive: a mover that does not
move is a placed bed.

### F6. The score reads eight things and not the sky, and not the chapter

The 0.3 s writer reads chaos, calm, loaf, flow, heat, lift, breath and the
palette. It does not read `game.weather` — `bed().rain`, `cloud()`, `gust()`
and `wetness()` have seventeen authored moods behind them and the score is
identical in Neon Rain and Harbour Midday. And minute 1 and minute 30 of a
chapter sound the same (`ROADMAP-FINISH.md` §3 said this and it is still
true): the only progression reader is the shimmer, driven by the game-wide
`musProg`, which a whole chapter moves by ~0.05.

### F7. The journey has no phrase

Twenty-one palettes and not one melodic idea that travels between them. The
title card is "Sydney heard from the next room" and the lifts share a gesture
family, and that is the whole of the through-line. The arrival — 3.6 s of
framed shot under a place card, the one moment every player of every chapter
sees — is musically a key glide. The place says its name on paper and not in
sound.

### F8. Diegetic music exists in exactly one chapter

Cali's band is somewhere; you walk toward it and the cymbals arrive before the
congas. Pasto's banda is an anchored one-shot rung; Sydney's busker is a
`strum`; the parade, the fire circle, the continuo are the score. This is
noted and **deliberately not on the roadmap** — see §5.

---

## 3. THE ROADMAP — six no-regret items

"No-regret" here means: high impact, low risk, built out of a shape this
codebase has already proved, reversible by deleting a call, and measurable
with an instrument that exists or is named. Ordered by value per hour.

### A1. THE MOVER — a sound that keeps its place (the spatial primitive)

**What.** `game.sfxMover(kind, opts) → handle` — a continuous voice with a
position that is read every frame. The handle exposes `at(x, y, z)`,
`vel(vx, vy, vz)`, `set(k)` (throttle/intensity 0..1), `stop(fade)`. Each frame
the mover runs `audioPlace` for gain and pan, the Cali low-pass for distance
(`780 + 19220·(1−t)²`, `t = over/62`), a front/back term from A2, and
**Doppler** from the radial velocity of the source relative to the ear:
`rate = c / (c − v_r)`, `c = 343`, clamped to ±12 %. All four are
`setTargetAtTime` at 0.08–0.20 s so a fast car sweeps rather than steps. A
mover that does not move is a placed bed (surf, river, crowd, traffic).

**Why it is no-regret.** It is `musPlaceTick` generalised — the model, the
curve and the time constants already ship and have been heard. It lives on
`acSfxIn`, so the room send, the three faders, the pause lid, the underwater
lid and `document.hidden` all apply for free. It allocates one graph per mover
and reuses it; nothing per frame.

**Budget.** At most **4 live movers**, chosen each frame by delivered gain;
the rest park at 0.0001 (not stopped, so a re-entry has no attack). A mover
parked for 30 s is stopped and rebuilt on demand. Peak authored level 0.22 at
8 m, which is the ladder's ceiling. Nothing in a mover is periodic.

**First wiring, in this order.** The Whippy van (engine + the chime through
the mover, so the chime Dopplers too), Hanoi (the three nearest scooters as
movers + a `traffic` bed on the ring-road centreline), Monaco's silver car
(the reason the item exists), Rio's bondes (rail hum + bell from the tram,
replacing the ring rung), the Quay ferry, the Kowloon bus, the floatplane
(the four notes become one voice with a throttle), and three placed beds:
Manly's surf line, the Uji river, the Antarctic colony.

**Measure.** New `hud.moverAudit()` — live movers with `kind, gain, pan,
rate, lp`. `qa/mover-pass.js`: stand still, drive the van past at 3.15 m/s,
sample at 10 Hz; pan must sweep monotonically through 0, `rate` must cross
1.000 within one sample of the closest approach, gain must peak there.
Node count flat over a 5-minute Hanoi stand (`qa/rv-churn.js` shape).

Cost: 6–8 h including the nine wirings. Risk: low. Regret path: `stop()` every
handle; the one-shots are untouched.

### A2. TWO MORE AXES — behind you, and above you

**What.** `audioPlace` publishes two more numbers beside `sysSfxPan`:
`sysSfxBack` (0 ahead … 1 directly behind, from the dot with the camera's
forward) and `sysSfxUp` (|dy| / d). `sfx()` inserts **one** BiquadFilter, and
only when `back > 0.3` or `up > 0.35` — otherwise the graph is bit-identical
to today. Behind: low-pass 20 kHz → 4.5 kHz at fully behind. Above: pan width
× (1 − 0.55·up) — things overhead are less lateralised — plus a +2 dB high
shelf at 6 kHz, which is the film-mix convention for "up" and the cheapest cue
that reads.

**Why.** A gull over your head stops being a gull in front of you. Movers get
the term free (A1 reads the same numbers). No level changes anywhere.

**Measure.** `hud.audioProbe` grows `back` and `up`; one Sydney lawn test —
the same gull at (0, 30, 0), (30, 0, 0), (0, 0, −30) — must return three
different filter states. Cost: 2 h. Risk: minimal (a filter on a minority of
calls). Regret path: two thresholds to 1.0 and the node is never built.

### A3. THE FLOCK — movement through many one-shots

**What.** A compound voice `wingburst` in `sfxTable`: 6–14 wing puffs
(band-passed noise, 600–1400 Hz, 70–110 ms, a whoosh envelope) at staggered
starts with ±25 % jitter, each placed at a **moving centroid**: from the
source, up 6 m, across the camera's right 14 m (side chosen away from the
animal), forward 4 m, over 1.4 s — plus two or three cries on the path at
0.3 s and 0.9 s. **One `sfx()` call, one voice slot, many panners** — the
motion is the difference between the panners, so it needs no new primitive
and respects the D9 ceiling by construction.

**Where.** Sydney's flush (replace the two one-shots), Pasto's vencejos on the
bell (`pastoBellSwinging` is already read), Venice's pigeons when the animal
runs through the piazza (> 4 m/s inside 6 m of the anchor), the storks when
the muezzin fires, Antarctica's colony when it is chased, Kyoto's heron as a
single slow `wingbeat` (four flaps) when it decides to leave.

**Measure.** `hud.stingAudit`'s trick — patch `create*` and count: a burst is
≈ 3 nodes a flap; pan spread across the burst ≥ 0.6 (first flap to last);
never more than one burst per source per 12 s. Cost: 3 h. Risk: low; the
level is authored against the ladder (0.10–0.20 per flap).

### A4. THE ARRIVAL PHRASE — the place says its name in sound

**What.** A four-note figure, played on the palette's own lead through
`musLiftNote`, on the frame the place card lands (`biome:enter` + 0.55 s, the
top of the arrival shot). **A rhythm is the thing that survives a key change:**
the phrase is defined as a rhythm (long – short – short – long) and a contour
(chord degree 0 → 1 → 2 → 1), so it is built from `musCurChord` like the lift
and the stings and cannot be out of key by construction — and it is the same
*shape* in Kyoto on a koto, in Rio on a cavaquinho, in the Drift on glass.
Velocity 0.7 × the lift's own; suppressed while a lift envelope is above
0.02; never on a rollback arrival.

**Why.** F7: nineteen chapters and the one guaranteed moment has no music in
it. It costs no new synth and ~40 lines; it is `musSting('arrive')` with a
per-palette `oct`/`gap` override, and the title card gets the plain version
so the menu teaches it.

**Measure.** `qa/motif.js` renders it in all 21 palettes and asserts every
note ∈ `musCurChord`; `hud.stingAudit('arrive')` returns 4. Cost: 3 h
(1 h composition, 2 h wiring). Risk: minimal.

### A5. THE SCORE READS THE SKY

**What.** Three terms in the one writer, all from `game.weather`:

- `bed().rain` closes `musFilt` by up to 180 Hz and lifts the pad bus 12 % —
  rain is cosy, not dull;
- `cloud()` takes 8 % off pluck velocity through `musVel` — overcast is a
  softer touch;
- `wetness()` adds up to 0.05 to the score's room send — wet stone reflects.

**Why.** Seventeen authored moods, zero musical consequence. Every number
here is small on purpose: the sky may make an hour weather and may not make
it a different hour, which is the rule `weather.js` already keeps.

**Measure.** `game.musAudit()` grows `sky: {rain, cloud, wet}`; a
`qa/wx-fuzz.js`-style run with odds forced to 1 must show the filter move
and the bass not move. Cost: 1.5 h. Risk: minimal.

### A6. THE PLACE WARMS TO YOU — a second voice that enters as you finish

**What.** Per-chapter progress, `musChapProg` = this chapter's done tasks
over its task count (the `TASKS` rows carry a biome), and an optional
per-palette `second: { inst, gap, oct, vel }` — a second instrument that
answers the pluck scheduler a chord tone below, 0.6–1.2 s later, only once
`musChapProg ≥ 0.33`, with its density proportional to progress. Pluck spacing
shortens by up to 20 % at a finished chapter. Kyoto already has the shape
(`shaku: true`), Iceland has the choir; this makes the shape a table.

**Why.** F6's second half. It turns "done" into something the ear notices —
the place has more to say once you have been there a while — and it costs
no new instrument: each palette names one of the fifty it already has.

**Measure.** `game.musAudit()` grows `chapProg` and `second`; a soak that
completes three tasks must show `second` notes appear, and a restored save
must show them already present (`silent` restore path). Cost: 4 h. Risk: low
— it is a gain and a gate on a scheduler that exists.

### Batches

| batch | items | hours | what it buys |
|---|---|---|---|
| **S1** | A1 (+ A2 read by it) | 8–10 | the primitive, nine movers, three beds |
| **S2** | A3, A2 for one-shots | 5 | flocks, and behind/above for every placed sound |
| **M1** | A4, A5, A6 | 8–9 | the phrase, the sky, the second voice |

S1 before S2 (the flock reads the elevation cue). M1 is independent and may
run alongside.

---

## 4. GUARD RAILS — how the core stays serene

These are the rules every item above is written to, and the handoff repeats
them per task.

1. **Authored against the ladder.** New voices peak 0.05–0.20 on the ring,
   0.22 for a mover at 8 m. 1.0 stays reserved for things that happen TO the
   player. `qa/tune-audio.js` for 90 s standing still: any non-positional
   sound over 0.4 is the bug.
2. **Nothing new is periodic.** Every interval carries ≥ 15 % jitter. The
   floatplane's four notes are the precedent.
3. **Four movers, and no more.** By delivered gain, every frame.
4. **Everything on the sfx bus.** A new sound that bypasses `acSfxIn` is a
   sound outside the faders, the room, the pause and the water.
5. **One writer per AudioParam.** Every music item is a term in the existing
   expression. A second `setTargetAtTime` on `musPad.gain`, `musFilt.frequency`,
   `musBassGain.gain` or `musDuckG.gain` is a defect, not a feature.
6. **The calm still empties the world** — for beds. A traffic or crowd bed
   scales by `(1 − 0.35·calm)`. A discrete vehicle passing you does not,
   because a scooter does not get quieter because you sat down.
7. **Sound is a reward, never a requirement.** Every new call is safe with
   no context, a suspended context, or a muted bus.

---

## 5. NOT ON THIS ROADMAP, AND WHY

- **A sample pipeline.** Every sound here is synthesis; adding assets means
  a loader, a decode budget, licensing and a 16 MB build ceiling. Nothing in
  §3 needs one.
- **HRTF / `PannerNode`.** `StereoPannerNode` was a deliberate choice (v16)
  and the v41 note on stereo-input panning explains why the whole sfx tree
  depends on it. A2 buys most of what HRTF would for two thresholds.
- **Diegetic bands beyond Cali (F8).** Making Rio's bateria positional would
  take the band away from most of the chapter; making Pasto's rhythm section
  a plaza band is a taste call about the páramo. Worth a listening session,
  not a no-regret line.
- **Per-NPC voice seeds.** Real, small, and already on `ROADMAP-FINISH.md`.
- **Tempo handover between bands.** F3b suppressed scheduling under
  `transBusy`; the crossing duck covers the rest.
