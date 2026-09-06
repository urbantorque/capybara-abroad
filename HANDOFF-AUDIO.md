# HANDOFF-AUDIO.md — production handoff for the six audio items

6 Sep 2026. Companion to `ROADMAP-AUDIO.md` (the review and the reasoning).
This document is the work order: what each team delivers, in what form, into
which hook, and how it is accepted. Read §0 before anything else.

---

## 0. READ THIS FIRST — there are no audio files

capy3 ships **zero audio assets**. Every sound is synthesised in Web Audio at
the moment it plays, from `src/systems.js` §5 (effects) and §5b (score). So
in this handoff:

- a **"stem"** is a *voice recipe*: a named function in `sfxTable` or the
  `mus*` instrument set, its node graph, its envelope, its level and its bus;
- a **"cue sheet"** is a *table*: chord degrees, gaps, octaves and velocities
  the engine reads (`sysMUS_STING`, `sysMUS_PAL[n].lift` are the precedents);
- a **"mix"** is the set of terms in the one 0.3 s writer block
  (`systems.js:31508–31600`) and the constants at the head of the file.

Composition delivers tables and listening notes. Sound design delivers
recipes and level targets. Implementation delivers the hooks, the wiring and
the probes. Nobody delivers a WAV. If a team decides it needs one, that is a
new pipeline and a separate conversation (see roadmap §5).

### The bus map

```
one-shots ─ sfx() ─┬─ StereoPanner (placed) ─┐
                   └─ (mono) ────────────────┤
movers (A1) ── gain·pan·LP·rate per frame ───┤
                                             ├─ acSfxIn ──┬─ dry ──────────────┐
weather bed ── wxBedBus (cap 0.19) ──────────┘            └─ acRoom (convolver)┤
                                                                               ├─ sysSubLP (620 Hz under water) ─┐
score ── musPad/plucks/bands ─┬─ musWide (ensemble, dry only) ─┐               │                                  │
                              └─ musSend ─ musConv (room) ─────┼─ musOutLP (1400 Hz under water; pause lid 1100) ─┤
                                                               │                                                  ├─ master (0.85) ─ limiter ─ out
UI ticks ──────────────────────────────────────────────────────┘ ─────────────────────────────────────────────────┘
```

Faders: `sysVolMaster/Music/Sfx` are SCALES on 0.85, never replacements.
Every new sound goes through `acSfxIn` (effects) or a `mus*` bus (score).

### The rule set (from roadmap §4, repeated because it is the acceptance test)

| # | rule | how it is checked |
|---|---|---|
| G1 | new voices peak 0.05–0.20 on the ring; a mover 0.22 at 8 m; 1.0 is reserved for things that happen TO the player | `qa/tune-audio.js`, 90 s standing still |
| G2 | nothing new is periodic — every interval carries ≥ 15 % jitter | code review + `hud.ambAudit` intervals |
| G3 | at most 4 live movers, by delivered gain | `hud.moverAudit().live ≤ 4` |
| G4 | everything on `acSfxIn` or a music bus | `hud.mixAudit` sees it under the faders |
| G5 | one writer per AudioParam | grep for a second `setTargetAtTime` on the six named params |
| G6 | beds scale by `(1 − 0.35·calm)`; discrete movers do not | `hud.calmAudit` + `moverAudit` |
| G7 | safe with no context, a suspended context, a muted bus | `qa/audio2.js` soak |

---

## 1. TASKS BY TEAM

IDs: **C** composition, **SD** sound design, **I** implementation. Hours are
the roadmap's. "Accept" is the instrument that closes the task.

### Composition

| id | task | delivers | accept |
|---|---|---|---|
| C1 | **The arrival phrase.** Choose the rhythm (long–short–short–long is the proposal) and the contour (chord degrees 0→1→2→1) and confirm it reads as one idea across the 21 palettes. Provide per-palette `oct`, `gap` (seconds), `vel` overrides where the lead demands it (the ney and the bow want ~2× the gap; the samba pluck wants half). | `sysMUS_MOTIF` row + a 21-row override table (§5) | `qa/motif.js` green: every note ∈ `musCurChord` in all 21 |
| C2 | **The second voice.** For each of the 16 pad palettes (not the five bands, not the title), name the instrument that answers the pluck a chord tone below, its gap range, its octave and its velocity relative to the pluck. Bands get `second: null` — a band is already the second voice. | the `second` column of §5 | `game.musAudit().second` non-null in 16 palettes |
| C3 | **The sky terms.** Confirm the three numbers (rain −180 Hz / +12 % bus; cloud −8 % pluck velocity; wetness +0.05 send) or replace them, per palette if a palette is an exception (Iceland's cut is 470 and cannot lose 180). | a 3-column table, default + exceptions | `game.musAudit().sky` moves under `qa/wx-fuzz.js` |
| C4 | **Mover pitch centres.** For each engine kind in SD1, name the fundamental it idles at so it sits *between* the palette's bass and pad — a scooter at 95 Hz under a D lydian pad is a pedal note the score did not write. | a per-kind Hz range | listening note; no instrument |
| C5 | **Listening references** for C1–C4 (§6). | the reference list | — |

### Sound design

| id | task | delivers | accept |
|---|---|---|---|
| SD1 | **Mover voice recipes** (§3): `prop`, `diesel`, `twostroke`, `v8`, `rail`, `surf`, `river`, `crowd`, `traffic`, `colony`. Each: node graph, idle/throttle mapping, Doppler-able params, level at 8 m. | recipes in the `sysMOVERS` table | `hud.moverAudit` gain at 8 m = 0.22 ± 10 % |
| SD2 | **`wingburst` and `wingbeat`** (§3): the flap puff, the burst timing, the cries. | two `sfxTable` entries | node count ≈ 3/flap; pan spread ≥ 0.6 |
| SD3 | **The chime through the mover.** Sydney's van chime moves from a timed one-shot to a figure the mover plays with a throttle, so it Dopplers. Keep 5.4 s ± 20 %, keep the roof case at 0.50. | the `van` mover's `figure` | `qa/mover-pass.js` rate sweep on the chime |
| SD4 | **The behind/above filters** — confirm 4.5 kHz at fully behind and +2 dB @ 6 kHz above by ear against the Sydney gull; adjust. | two constants | `hud.audioProbe(...).back/up` |
| SD5 | **Placed-bed levels** for Manly's surf, the Uji river, the Antarctic colony, the Hanoi ring road, the Rio parade crowd — near/far per bed. | five rows in §4.3 | `moverAudit` at spawn ≤ 0.12 (a bed is under the ladder) |
| SD6 | **Field-recording references** for SD1–SD5 (§6). | search terms + notes | — |

### Implementation

| id | task | delivers | accept |
|---|---|---|---|
| I1 | **`game.sfxMover`** — the primitive (§4.1): handle, per-frame update, budget, park/stop, Doppler, `hud.moverAudit()`. | `systems.js` §5 | `qa/mover-pass.js`; node count flat 5 min |
| I2 | **Wire nine movers + three beds** (§4.3). | chapter files call the handle | per-chapter row in `moverAudit` |
| I3 | **Two more axes** (§4.2) in `audioPlace` + `sfx()`. | `sysSfxBack`, `sysSfxUp`, the conditional filter | probe returns 3 states for 3 gulls |
| I4 | **`wingburst` triggers** (§4.4): six sources. | six call sites | one burst per source per 12 s |
| I5 | **`musSting('arrive')`** on `biome:enter` + 0.55 s, gated on lift envelope and on `arrive === true` (not the rescue, not a rollback). | one call in the enter handler | `stingAudit('arrive') === 4` |
| I6 | **The sky terms** as terms in the writer block. | three lines | `musAudit().sky` |
| I7 | **`musChapProg` + the second-voice scheduler** gated at 0.33. | the `second` reader in `musTick` | `musAudit().chapProg`, `.second` |
| I8 | **Probes**: `moverAudit`, `motif.js`, `mover-pass.js`, `flock.js`, the `sky` and `second` fields on `musAudit`. | `qa/` scripts | they run in `npm test` |

---

## 2. SEQUENCE

```
S1  I1 → SD1 (in parallel from day 1, against a stub handle) → I2 → SD3, SD5
S2  I3 → SD4 ;  SD2 → I4
M1  C1 → I5 ;  C3 → I6 ;  C2 → I7 ;  C4 alongside SD1
I8 threads through all three.
```

S1 first: A3 (the flock) reads A2's elevation, and A2 is cheapest to build
inside A1's update. M1 is independent and may run the same week.

---

## 3. VOICE RECIPES ("stems")

All recipes: mono `noiseSrc()` (never the wide buffer — a placed source must
pan), oscillators from `ac.createOscillator`, output `.connect(acMaster)` so
the swap routes them. Levels are *authored* levels before `audioPlace`.

### 3.1 Mover kinds (`sysMOVERS`)

| kind | graph | throttle `k` maps to | Doppler param | level @ 8 m | first customer |
|---|---|---|---|---|---|
| `prop` | sawtooth 42 Hz + square 84 Hz (detune ±7) → LP 900 Hz; AM by a 24 Hz sine at 0.3 (the prop beat); noise → BP 2.2 kHz at 0.15 (exhaust) | osc Hz × (0.9 + 0.5k); LP 700 + 1400k | all osc `detune`, noise `playbackRate` | 0.20 | Sydney floatplane |
| `diesel` | two sawtooth at 33/66 Hz, noise → LP 400 Hz at 0.4; a 6.5 Hz triangle AM at 0.25 (the lope) | Hz × (0.95 + 0.35k); AM rate 6.5 + 4k | as above | 0.22 | the Whippy van, the Quay ferry, the Kowloon bus |
| `twostroke` | pulse (two saws, one inverted, offset) at 110 Hz; noise → BP 3.4 kHz at 0.35; 13 Hz square AM at 0.4 (the ring-ding) | Hz 90 + 160k | as above | 0.16 (there are many) | Hanoi scooters |
| `v8` | four saws at 55/110/165/220 Hz, LP 1.6 kHz, Q 2; noise → HP 4 kHz at 0.12 (intake) | Hz × (0.6 + 2.4k); LP 900 + 4000k | as above | 0.24 (the one exception, roadmap G1 notes it) | Monaco's silver car |
| `rail` | noise → BP 240 Hz Q 4 (rumble) + noise → BP 3.8 kHz Q 8 at 0.08 (the squeal, only in the curve); optional `figure`: the bonde bell | rumble × (0.5 + 0.5k); squeal × curvature | noise `playbackRate` | 0.18 | Rio's two bondes |
| `surf` | wide-band noise → LP 1.1 kHz, slow AM by a 0.11 Hz sine at 0.45 with ±20 % period jitter every cycle (G2) + a 0.9 Hz ripple at 0.12 | AM depth | none (a line does not move) | 0.14 | Manly's break |
| `river` | noise → BP 1.4 kHz Q 0.6 + BP 380 Hz at 0.3; 0.4 Hz LFO on the BP centre ±200 Hz | level | none | 0.12 | the Uji run |
| `crowd` | four detuned voiced bands (BP 300/600/1200/2400, Q 3) on noise with independent slow random walks at 0.3–0.8 Hz; one `cheer`-shaped swell every 9–20 s (jittered) | density | none | 0.12 | Rio parade column, Jemaa el-Fnaa |
| `traffic` | `twostroke` core × 3 at three detunes + noise → LP 600 Hz at 0.3; a `horn`-shaped blip every 6–14 s (jittered), each from a random point on the centreline | density | on the blips only | 0.14 | Hanoi ring road |
| `colony` | `crowd` graph with the bands at 700/1400/2100/2800 and a 3–6 Hz flutter AM at 0.25 | density | none | 0.12 | the Antarctic colony |

The `figure` slot: a mover may carry a recurring one-shot (the van chime, the
bonde bell, the traffic horn). It is scheduled by the mover, **placed at the
mover's position at that instant, and pitched by the mover's current `rate`**
— which is how a chime Dopplers without a second system.

### 3.2 One-shot voices

| name | graph | placing | level | throttle |
|---|---|---|---|---|
| `wingburst` | per flap: noise → BP 600–1400 Hz (random per flap) Q 1.2 → gain env attack 12 ms, decay 70–110 ms; 6–14 flaps, starts at `i·(1.4/n)` ± 25 %; each flap gets its **own** StereoPanner from the centroid at its start time; two or three `gull` cries at pitch 1.6–1.9 on the path at 0.3 s and 0.9 s | centroid path: `src + up·6t + right·14t·side + fwd·4t`, t ∈ 0..1.4 s | 0.10–0.20 per flap | `sfxGap.wingburst = 4.0`; per-source 12 s in the caller |
| `wingbeat` | the flap above, ×4, 260 ms apart ± 15 %, pitch 0.7 (a heron is a slow bird) | at the bird | 0.16 | 6.0 |

### 3.3 What is NOT a new voice

The van chime, the bonde bell, the ferry horn, the bus door, the train
whistle already exist. They stay; the mover only carries or places them.

---

## 4. SPATIAL TRIGGER LOGIC

### 4.1 The mover (I1)

```js
// systems.js §5 — beside sfx(). One graph per mover, reused. Nothing per frame allocates.
const sysMOVER_MAX   = 4;       // live at once, by delivered gain
const sysMOVER_TAU   = 0.12;    // s — gain, pan, LP
const sysMOVER_RTAU  = 0.08;    // s — Doppler is faster than level
const sysMOVER_C     = 343;     // m/s. Not a knob.
const sysMOVER_DOPP  = 0.12;    // ±12 % rate clamp
const sysMOVER_PARK  = 0.0001;  // gain while out of budget
const sysMOVER_STOP  = 30;      // s parked before the graph is torn down

function sfxMover(kind, opts) {
  const rec = sysMOVERS[kind]; if (!rec) return null;
  const m = { kind, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, k: 0, g: null,
              pan: null, lp: null, rate: [], parkedT: 0, bed: !!(opts && opts.bed), live: false };
  sysMovers.push(m);
  return {
    at(x, y, z) { m.x = x; m.y = y; m.z = z; },
    vel(vx, vy, vz) { m.vx = vx; m.vy = vy; m.vz = vz; },
    set(k) { m.k = clamp(k, 0, 1); },
    stop(fade) { m.dead = true; m.fade = fade || 0.4; },
  };
}

function sysMoverTick(dt) {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  const playing = game.state.started && !game.state.paused && !document.hidden;
  audioEar();                                   // sysEar, sysEarRight, sysEarFwd (A2)
  // 1. desired gain for every mover, no graph work yet
  for (const m of sysMovers) {
    m.want = playing ? audioPlace(m.x, m.y, m.z, rec(m).near, rec(m).far) * rec(m).level : 0;
    if (m.bed) m.want *= (1 - 0.35 * sysCalmNow);            // G6
    m.wantPan = sysSfxPan; m.wantBack = sysSfxBack; m.wantUp = sysSfxUp;
    m.d = sysEarTo.length();
  }
  // 2. budget: the four loudest are live, the rest park
  sysMovers.sort((a, b) => b.want - a.want);
  for (let i = 0; i < sysMovers.length; i++) {
    const m = sysMovers[i];
    const live = i < sysMOVER_MAX && m.want > sysSFX_CULL && !m.dead;
    if (live && !m.g) sysMoverBuild(m);                       // lazy: no graph until first heard
    if (!m.g) continue;
    const g = live ? m.want : sysMOVER_PARK;
    // 3. Doppler from RADIAL velocity of the source relative to the ear
    const ex = sysEar.x - m.x, ey = sysEar.y - m.y, ez = sysEar.z - m.z;
    const vr = m.d > 0.5 ? (m.vx * ex + m.vy * ey + m.vz * ez) / m.d - sysEarVr : 0;
    const rate = clamp(sysMOVER_C / (sysMOVER_C - vr), 1 - sysMOVER_DOPP, 1 + sysMOVER_DOPP);
    // 4. distance takes the top before it takes the level (the Cali curve)
    const over = Math.max(0, m.d - 8), t = clamp(over / 62, 0, 1);
    let lpHz = 780 + 19220 * (1 - t) * (1 - t);
    lpHz = Math.min(lpHz, 20000 - m.wantBack * 15500);       // A2: behind is duller
    sysAudioSet(m.g.gain, Math.max(sysMOVER_PARK, g), now, sysMOVER_TAU);
    sysAudioSet(m.pan.pan, m.wantPan * (1 - 0.55 * m.wantUp), now, sysMOVER_TAU);
    sysAudioSet(m.lp.frequency, lpHz, now, sysMOVER_TAU);
    for (const p of m.rate) sysAudioSet(p, p.__osc ? 1200 * Math.log2(rate) : rate, now, sysMOVER_RTAU);
    rec(m).throttle(m, m.k, now);                             // the recipe's own params
    if (m.figure) sysMoverFigure(m, now, rate);               // chime / bell / horn, placed and pitched
    m.parkedT = live ? 0 : m.parkedT + dt;
    if (m.parkedT > sysMOVER_STOP || (m.dead && now > m.deadAt)) sysMoverTear(m);
  }
}
```

Notes for I1:

- `sysEarVr` is the ear's own radial velocity toward the source (the rig
  moves too); without it a standing van Dopplers when the camera swings.
- `rate` params: noise sources take `playbackRate` directly; oscillators
  take `detune` in cents, hence the `1200·log2` branch.
- **`audioPlace` is called once per mover per frame** — nine movers is nine
  calls, under the four-per-frame `terrainHeight` budget the crest already
  spends.
- Called from the same place `musPlaceTick()` is (`systems.js:30186`).
- `sysAudioSet` (F3) refuses non-finite values; keep using it.

### 4.2 Two more axes (I3)

```js
// in audioPlace, after pan:
sysSfxBack = clamp(-(sysEarTo.x * sysEarFwd.x + sysEarTo.z * sysEarFwd.z) / d, 0, 1); // 1 = dead behind
sysSfxUp   = clamp(Math.abs(sysEarTo.y) / d, 0, 1);
// in sfx(), when placed:
if (node && (sysSfxBack > 0.3 || sysSfxUp > 0.35)) {
  const f = c.createBiquadFilter();
  if (sysSfxBack > 0.3) { f.type = 'lowpass';   f.frequency.value = 20000 - sysSfxBack * 15500; }
  else                  { f.type = 'highshelf'; f.frequency.value = 6000; f.gain.value = 2 * sysSfxUp; }
  node.pan.value = pan * (1 - 0.55 * sysSfxUp);
  f.connect(bus); node.connect(f);            // panner → filter → bus
} else if (node) node.connect(bus);
```

Below both thresholds the graph is bit-identical to today (G-rule: the
common case must not pay).

### 4.3 Wiring table (I2, SD5)

| chapter | mover | kind | position getter (already published) | velocity | `set(k)` | figure | near / far |
|---|---|---|---|---|---|---|---|
| Sydney | Whippy van | `diesel` | `envVanPos` (+ route heading) | route speed 3.15 | 1 rolling, 0.25 dwell | `chime` 5.4 s ±20 %, roof 0.50 | 12 / 70 |
| Sydney | floatplane | `prop` | `envPlane` group position | leg velocity | 0.2 idle, 0.6 taxi, 1.0 run/circuit, 0 moored | — | 20 / 400 |
| Quay | the other ferry | `diesel` | the ferry group | leg velocity | rpm | `horn` stays where it is | 14 / 260 |
| Rio | bonde ×2 | `rail` | `game.rio.bonde(i)` | 4.2 along the line | 1 moving, 0 dwell | `chime` (the bell) every 8–16 s while moving | 10 / 90 |
| Kowloon | the bus | `diesel` | `game.kowloon.bus()` | 5.4 | 1 / 0.3 at a stop | door `pop` stays where it is | 10 / 80 |
| Monaco | the silver car | `v8` | `game.monaco.car()` | `monCAR_V` | speed/26.5 | — | 12 / 220 |
| Hanoi | the 3 nearest scooters | `twostroke` | `game.hanoi.bike(i)` (re-pick nearest every 0.5 s) | `hanBIKE_V` | speed/9.6 | — | 8 / 60 |
| Hanoi | the ring road | `traffic` (bed) | centreline point nearest the animal | 0 | density from the bike count within 40 m | horn blips | 30 / 160 |
| Manly | the break | `surf` (bed) | nearest point on the break line | 0 | swell phase from `manly.js`'s set clock | — | 40 / 220 |
| Kyoto | the Uji | `river` (bed) | nearest point on the run's polyline | 0 | 1 | — | 20 / 120 |
| Antarctica | the colony | `colony` (bed) | `colony` anchor (already in `sysAMB_AT`) | 0 | 1; ×1.6 for 8 s when chased | — | 40 / 300 |
| Rio | the parade | `crowd` (bed) | the column's midpoint | 0 | 1 in the parade window | — | 30 / 180 |

Nine movers and four beds; at any point at most four are live (G3).

### 4.4 Flock triggers (I4)

| chapter | source | trigger | side |
|---|---|---|---|
| Sydney | lorikeet fig | existing rising-edge + wheek (`environment.js:1690`) | away from the animal |
| Pasto | vencejos | `pastoBellSwinging` rising edge | across the plaza |
| Venice | pigeons | animal > 4 m/s inside 6 m of the `piazza` anchor | ahead of the animal |
| Sahara | storks | `muezzin` rung fires | round the Koutoubia (the anchor) |
| Antarctica | colony | `npcHeat` at the colony > 0.5 | ahead |
| Kyoto | heron | `kyoUpdateHeron` decides to leave → `wingbeat` | along its arc |

Per-source 12 s gate in the caller; `sfxGap.wingburst` 4 s.

---

## 5. THE MUSIC TABLES (C1, C2, C3)

Palette index → chapter. Bands (`band:` set) get `second: null`.

| # | chapter | mode / key | lead | band / pulse | proposed `second` | phrase override | sky exception |
|---|---|---|---|---|---|---|---|
| 0 | Sydney | D lydian | mallet | — | `glass`, gap 0.8–1.4, oct +12, vel 0.55 | default | — |
| 1 | Pasto | A minor pentatonic melody, rhythm section | quena | `sysMUS_RHY` | `charango` answering, gap 0.5–0.9, oct 0, vel 0.6 | gap ×1.6 | — |
| 2 | Circular Quay | A lydian | mallet | — | `pluck`, gap 0.7–1.2, oct 0, vel 0.5 | oct +2 | — |
| 3 | to Manly (under way) | open, filter 1150 | pluck | — | `mallet`, gap 0.9–1.6, oct 0, vel 0.5 | default | — |
| 4 | Kyoto | in-scale (E–F, A–B♭ leading tones) | koto | — | `shaku` (already exists — becomes the table row), gap 2–4 | gap ×1.5 | — |
| 5 | Cali | A minor vamp | — | salsa 100 | null | `mallet`, gap ×0.6 | — |
| 6 | Rio | Am7 D7 Gmaj7 E7 | — | samba 132 | null | `pluck`, gap ×0.5, oct +12 | — |
| 7 | Iceland | dark, cut 470 | bow | — | `cello`, gap 3–6, oct −12, vel 0.5 | gap ×2.2 | **rain term capped at −60 Hz** |
| 8 | Marrakech | gnawa | — | gnawa cell | null | `mallet`, gap = pulse | — |
| 9 | the Drift | bright, cut 1250 | glass | — | `glass` two octaves down, gap 3–5, vel 0.45 | gap ×2 | — |
| 10 | Venice | baroque, real cadences | violin | baroque 96 | null | `violin`, gap = quaver | wetness term ×0 (the tide owns the room) |
| 11 | Hong Kong | A minor synth vamp | — | HK 112 | null | `pluck`, gap ×0.5, oct +12 | — |
| 12 | Palawan | lydian | kulintang | — | `glass`, gap 1.4–2.6, oct +12, vel 0.4 | default | — |
| 13 | Cappadocia | D hijaz | ney | bendir | `bendir`-free `pluck`, gap 2–3.4, oct −12, vel 0.45 | gap ×1.8 | — |
| 14 | Manly | D mixolydian | mallet | — | `pluck`, gap 0.8–1.4, oct 0, vel 0.5 | default | — |
| 15 | Pantanal | major sevenths | caipira | — | `bow`, gap 2–3.6, oct 0, vel 0.5 | gap ×1.6 | — |
| 16 | Sơn Đoòng | quartal, no thirds | glass | — | `glass` oct +12, gap 3–6, vel 0.4 | gap ×1.8, oct +12 | rain term ×0 (there is no sky) |
| 17 | Antarctica | open fifths | glass | — | `bow`, gap 3–5, oct −12, vel 0.45 | gap ×1.6 | — |
| 18 | title card | Sydney from the next room | mallet | — | null (a menu does not progress) | default, vel 0.6 | — |
| 19 | Monte Carlo | E minor-major ninth | guitar | Bond 132 | null | `twang`, gap ×0.8 | — |
| 20 | Hanoi | Vietnamese pentatonic | đàn bầu | — | `danTranh` answering, gap 2.5–4, vel 0.5 | gap ×2, on the đàn bầu with the bend | — |

C1's proposal in engine terms:

```js
const sysMUS_MOTIF = { deg: [0, 1, 2, 1], dur: [2, 1, 1, 3], gap: 0.19, oct: 0, vel: 0.70, pan: 0.18 };
// musSting('arrive') reads it exactly as the five sting shapes are read, with
// pal.phrase = { gap, oct, vel, inst } overriding per palette.
```

Sky terms (C3 default):

```js
// in the writer block; W = game.weather; b = W.bed()
const sky = W ? { rain: b.rain, cloud: W.cloud(), wet: W.wetness() } : { rain: 0, cloud: 0, wet: 0 };
// musFilt.frequency:  ... - sky.rain * (pal.skyCut === undefined ? 180 : pal.skyCut)
// musPad.gain:        ... * (1 + 0.12 * sky.rain)
// musVel(v):          v * (1 - 0.08 * sky.cloud)
// musSendGain.gain:   ... + 0.05 * sky.wet * (pal.skyWet === undefined ? 1 : pal.skyWet)
```

---

## 6. REFERENCE AUDIO

Three kinds. None is shipped; all are for the teams' ears.

### 6.1 In-engine captures (the A/B baseline — make these first)

`game.music.bus` exists so a probe can listen. Capture recipe for the harness
(`qa/capture.js`, I8): hang a `MediaStreamAudioDestinationNode` on
`game.music.bus`, record 60 s with `MediaRecorder` (WebM/Opus), standing
still at the spawn, one file per chapter, **before** S1 and again after each
batch. Name them `cap/<chapter>-<batch>.webm`. These are the only reference
clips that are the actual game; every listening judgement below is made
against them.

### 6.2 Field recordings (sound design, SD6)

Search terms that find the right thing on the usual libraries; the teams
pick their own files.

| for | search | what to listen for |
|---|---|---|
| `diesel` / the van | "ice cream van passing residential street" | the engine is under the chime; Doppler on the chime is ~16 cents at 3 m/s — barely there, which is correct |
| `twostroke` / Hanoi | "Hanoi old quarter motorbike traffic binaural" | there is no gap between engines; the *nearest three* are what the ear tracks and the rest is a bed |
| `v8` / Monaco | "F1 flyby Monaco tunnel exit", "V8 pass by 100 kmh" | ±140 cents across the pass at 26 m/s; the *approach* is brighter than the recede |
| `prop` | "Cessna 172 flyover" or "de Havilland Beaver floatplane takeoff" | the prop beat is the identity, not the exhaust |
| `rail` / the bonde | "Santa Teresa bonde", "heritage tram flange squeal" | the squeal is only in the curve |
| `surf` | "Manly beach surf set waves" | sets are ~8.5 s here (the palette's own comment) and never regular |
| `river` | "Uji river Kyoto ambience" | a river is a band, not a hiss |
| `crowd` | "Jemaa el-Fnaa night crowd", "Rio carnival street crowd distant" | swells, not level |
| `colony` | "Adélie penguin colony" | the flutter is a texture in the 3–6 Hz band |
| `wingburst` | "lorikeet flock flush", "pigeons take off piazza" | the flaps are *before* the cries |
| behind/above | any binaural walk-past | how much duller "behind" actually is (less than you think) |

### 6.3 Listening references (composition, C5)

Named works are references for a *treatment*; nothing here is transcribed,
and the Bond row keeps the contract's rule — the idiom, never a tune.

| for | reference | the point |
|---|---|---|
| the arrival phrase | Hisaishi's four-note openings (Kikujiro); the three-note broadcast idents | a rhythm-and-contour signature survives any key; four notes is the ceiling |
| the second voice | Sakamoto's answering figures on *Koko*; the shakuhachi in Kyoto's own row | the answer is *below* and *after*, never with |
| the sky (rain) | Ólafur Arnalds, *re:member* (the felted piano) | rain is intimacy, not gloom — the filter closes and the level *rises* |
| mover pitch centres (C4) | any pad-plus-drone mix where the drone is a fifth under the bass | an engine idling at the pad's fifth is a pedal you did not write; check every kind against every palette root |
| Hanoi | đàn bầu solo recordings (Ngọc Ánh) | the answer voice must keep the bend — it is the instrument |
| Monaco | the idiom's own ingredients (minor-major ninth, tremolo guitar, brushes) | the phrase on the `twang` must not outline any known tune |

### 6.4 Synthetic mock-ups (optional)

If a team wants to *hear* a recipe before I1 exists, SD can prototype any
§3 row in a scratch page with the same node graph — the recipes are
deliberately written as plain Web Audio so a mock-up is a copy, not a port.
Generated example clips can also be produced on request; they are not
required by any task here.

---

## 7. QA AND ACCEPTANCE

| instrument | exists? | what it proves |
|---|---|---|
| `hud.audioProbe(x,y,z)` → `{gain, pan, back, up}` | yes (+2 fields) | the axes |
| `hud.moverAudit()` → `{live, rows:[{kind, gain, pan, rate, lp, d}]}` | **new** | budget, Doppler, curves |
| `hud.mixAudit()` | yes | nothing new is outside the faders |
| `hud.ambAudit()` | yes | the ladder is untouched |
| `hud.stingAudit('arrive')` → 4 | yes (+1 kind) | the phrase fires and is four notes |
| `game.musAudit()` + `{sky, chapProg, second}` | yes (+3 fields) | the three music items |
| `qa/mover-pass.js` | **new** | pan sweep monotone; rate crosses 1.0 at closest approach; gain peaks there |
| `qa/flock.js` | **new** | ≈3 nodes a flap; pan spread ≥ 0.6; one burst per source per 12 s |
| `qa/motif.js` | **new** | every phrase note ∈ `musCurChord` in 21 palettes |
| `qa/tune-audio.js` 90 s still | yes | G1: nothing non-positional over 0.4; < 35 sounds/min |
| `qa/rv-churn.js` shape, 5 min Hanoi | yes | node count flat (movers reuse graphs) |
| `qa/audio2.js` | yes | 13-chapter soak, 0 errors |
| `qa/v41-rooms.js` | yes | L/R correlation of the score unchanged by M1 (the phrase and the second voice go through the ensemble like everything else) |
| `npm test` | yes | 10/10 stays 10/10 |

**Definition of done per batch:** every row above green, `CONTRACT.md` gets
a section per batch in the house style (what landed, what measured wrong
first, what is partial), and the capture set in §6.1 is re-recorded.

---

## 8. RISKS WORTH NAMING

1. **The van chime is a task cue.** Moving it into the mover must keep the
   `far < 56` gate and the 0.50 roof level — it tells the player the van is
   rolling. Verify with the Sydney task soak.
2. **Hanoi's nearest-three re-pick.** Swapping which scooter a mover follows
   mid-pass is a click. Re-pick only when the new candidate is ≥ 6 m nearer
   than the one held, and cross-fade over 0.3 s.
3. **The Doppler sign.** `v_r` positive = approaching = rate > 1. Test it
   with the pass script before wiring anything; the first cut of every
   Doppler in history has been backwards.
4. **Two rooms.** Movers go through `acSfxIn` so the room applies. A mover
   *outside* the interior (Monaco's car heard from the salon) will be in the
   salon's room. Acceptable for S1; a per-mover room bypass is a later item.
5. **A second writer.** I6 and I7 add terms; if anyone reaches for a second
   `setTargetAtTime` on the pad, filter or bass, stop. G5.
