# THE CORE BATCH

**Est. 5–7 h.** Four phases. **Commit at every phase boundary** — that is what
makes this one command instead of four, and what makes an interrupted run
survivable. Stop cleanly at any boundary and what has landed is coherent.

This is the 80/20 of `qa/POLISH-PASS.md`. Two global picture changes, two global
sound changes. Every chapter gets a visible lift; nine get an audible one.

What is deliberately **not** here, and why, is at the bottom. Do not drift into
it — if a phase finishes early, tighten what you built rather than starting
something out of scope.

---

## PHASE 1 — The floor  (~2 h, largest single visual win)

### The finding

The ground is **40–55% of every frame** and in most chapters it is one flat
colour. Measured (bottom third, centre 60%, 109k–142k px; SD is the standard
deviation of luminance, colours is distinct 5-bit buckets):

| chapter | mean L | SD | colours |
|---|---|---|---|
| Palawan | 226.4 | **2.05** | **5** |
| Sydney | 161.3 | **3.98** | **27** |
| Venice | 188.4 | 9.06 | 68 |
| Monte Carlo | 109.3 | 12.53 | 78 |
| Hong Kong | 34.3 | 15.36 | 109 |
| Iceland | 51.6 | 15.96 | 46 |
| Kyoto | 122.2 | 23.12 | 84 |
| **Rio** | 134.8 | **51.06** | **122** |

Rio is 12× Sydney and 25× Palawan — because Rio is the one chapter with a
graphic on the floor, the Copacabana wave. Nothing else about its renderer
differs.

`grain()` in `shared.js` runs on ground at `scale: 0.5–0.72` (a 1.4–2 m period)
and `amount: 0.12–0.14` (±6%). Its two octaves sit only 2.83× apart, so the
highest frequency in the field is ~half a metre — an octave and a half too low
to see at a 48° FOV and ~35° pitch. It also has **no distance fade on the grain
term**, only on `sparkle` via `fwidth`, which is why it cannot simply be turned
up: a high-frequency term with no footprint fade boils as the camera moves.

### The work

1. Add an **optional near-field octave** to `grain()` at ~4–8× the existing
   scale, with an `fwidth`-driven footprint fade. The existing `sfw` term in the
   sparkle path is the model — it solves this exact problem for this exact
   reason. **Default it off**, so no existing call site changes behaviour.
2. Opt in **every chapter's ground material**, tuning the amount per chapter. A
   lawn, a piazza, wet asphalt and sand do not want the same number.
   Re-measure as you go, not once at the end — a single sweep followed by one
   measurement is how a regression in chapter 4 gets blamed on chapter 17.
3. Add ground scatter to the three chapters that have effectively none:
   `monaco.js` (**0**), `hanoi.js` (**0**), `cali.js` (**1**). Instanced, in the
   style `pantanal.js` (25 sites) and `quay.js` (16) already use.

### Phase 1 acceptance

- `qa/vis-flat2.js` before and after, all eight rows, reported as one table.
  **Target: no chapter below SD 12**, and Palawan, Sydney and Venice at least
  tripled.
- **No aliasing.** Pan the camera across the near ground in at least four
  chapters and confirm it does not crawl or boil. This is the failure mode the
  `fwidth` fade exists to prevent — check it, do not assume it.
- The grain must not read as a *pattern*. If you can name the noise, it is too
  strong.
- Commit.

---

## PHASE 2 — The rim  (~1 h, second visual win, same file)

### The finding

Across all 28 modules there is **no rim or fresnel term** — and no ambient
occlusion or contact shadow either. The only grazing-angle term in the codebase
is the wet sheen inside `grain()`, gated on `uGrainWet > 0.001`, so it exists
only when it is raining.

The capybara is a flat brown silhouette against flat green with nothing
separating the two. This is the single strongest "polished low-poly" cue there
is, and its absence is why the art style reads as unfinished rather than as
deliberate.

### The work

One more `onBeforeCompile` injection into the Lambert material in `shared.js`,
in the style `grain()` already establishes — a fresnel against the view vector.
`cameraPosition` is a default uniform in every shader three compiles, and
`grain()`'s wet path already demonstrates the exact computation.

**Tint it with the hemisphere light's sky colour, not white.** A rim in the
sky's own colour reads as light wrapping round the object; a white one reads as
a video-game outline.

Strength as an option, defaulting off. It will want to be **lower in the bright
chapters** (Palawan, Antarctica, Venice) than in the dark ones (Sơn Đoòng, Mong
Kok, the Drift) — a rim against a bright ground is invisible, and against a dark
one it is a halo.

### Phase 2 acceptance

- `CONTRACT.md` says **no black outlines**. A rim pushed too far is exactly that
  in reverse. If the edge reads as an edge rather than as light, back off.
- The capybara on Sydney grass, before and after, screenshotted and looked at.
  It must separate from the ground without acquiring a visible edge.
- **One bright chapter and one dark chapter checked side by side** — the term
  behaves oppositely in each and a single-chapter tune will be wrong in the other.
- Every chapter still boots with `game.state.lastError` null after a 60 s soak.
  This touches the material every mesh in the game uses.
- Commit.

---

## PHASE 3 — The sound of the place  (~2 h, largest audio win)

### The finding, and what it is NOT

The **score is already researched per place** and must not be touched in this
batch. Son clave 2-3 in absolute eighths; samba's surdo on the two; a 12/8 gnawa
cell; baroque descending fifths; the *yu* mode for Hong Kong; dorian for
Iceland. Seven bespoke ethnic voices already exist. That is the strong half.

The **ambience** is the weak half. The ladder in `systems.js` branches correctly
per biome — `bio === 'kowloon'`, `bio === 'goreme'` — and then draws from
**thirteen shared generic tokens**, separated only by a pitch and a volume:

    bark  cheer  chime  gull  hiss  horn  pop
    rustle  splash  strum  thud  tick  whistle

So Kyoto is `chime` at a pitch. Marrakech is `hiss` and `bark`. Nineteen
cultures, one bag of thirteen sounds with a knob on it.

Ambience is **positional and constant** — the player hears far more of it than
of any melodic figure — so this is where a place is most cheaply and most
convincingly established. The structure is already right. This is purely a
vocabulary problem.

### The work

New `sfx*` generators in `systems.js` in the existing style (see `sfxGull`,
`sfxChime`, `sfxStrum` for the range of technique already in use), wired into
the per-biome branches that already exist. **Six chapters:**

| chapter | wants |
|---|---|
| **Kyoto** | higurashi cicada, shishi-odoshi clack, temple bell with a real long decay |
| **Marrakech** | distant muezzin, hand-drum from another square, cart wheels on stone |
| **Hong Kong** | mahjong tiles, wet-market cleaver, tram bell, aircon drip |
| **Venice** | pigeon flock, water slapping a fondamenta, distant campanile |
| **Hanoi** | vendor cry, bowl-and-chopstick clatter |
| **Sydney** | cicadas, a magpie carol, lorikeets |

### Three rules that matter more than the list

- **Everything goes through `sysAmb`**, not `sfx` — that is what places the
  event in the world and gives it a bearing. A mono cue is the finding that has
  come out of every previous audio pass in this repo.
- **Nothing may be a stinger.** These are things you overhear. The existing
  volumes (0.03–0.26) are the range; stay inside it.
- **Nothing may become an irritation.** A sound heard two hundred times in a
  chapter must survive that. Vary pitch, spacing and placement; keep the rate
  low. This is the one way this batch can make the game actively worse.

The per-chapter convolver rooms already exist and already work, so new cues land
in the right acoustic space for free. **Do not add reverb.**

### Phase 3 acceptance

- Verified under `playwright-cli` with **real key events and a real clock**, so
  the `AudioContext` actually unlocks. The `game.tick()` loop cannot hear any of
  this and a green run from it means nothing.
- A 90 s soak per touched chapter with `game.state.lastError` still null. The
  ambience path is where a crash of this kind has hidden before.
- State, per chapter, what you added and that you listened to a full soak rather
  than a single trigger.
- **The score untouched** — no palette row, chord table, dwell or filter moved.
- Commit.

---

## PHASE 4 — The three wrong instruments  (~1 h, clearest right answer)

### The finding

Three chapters have researched **harmony** played on a borrowed **timbre**:

| chapter | row | harmony | plays it on | should be |
|---|---|---|---|---|
| **Cappadocia** | 13 | hijaz on D — correct | `quena`, the Andean flute from ch. 2 | a **ney** |
| **The Pantanal** | 15 | major sevenths — correct | `violin`, Venice's baroque bowed voice | a **viola caipira** |
| **Palawan** | 12 | lydian — correct | `mallet`, Sydney's felt mallets | a **kulintang** |

The source comments already concede two of these in writing.

### The work

Three voices in `systems.js`, modelled on `musQuena` for structure (~30 lines
each — oscillator pair, fading-in vibrato LFO, band-passed noise element):

- **Ney** (Cappadocia). An end-blown rim flute. Against the quena: far
  **breathier** — the breath audible as part of the tone, not as an artefact —
  with almost no upper partials, which is why the row's filter already sits low
  at 720. Slower, less certain attack. Add a **bendir** frame drum: low-tuned
  skin, short rattle, sparse.
- **Viola caipira** (the Pantanal). A ten-string steel guitar — **plucked, not
  bowed**, which is the whole error being corrected. Courses in octaves and
  unisons, so a note wants two or three slightly detuned voices; bright steel
  attack; a decay long enough to be the warm sustained thing the row wants.
  `musTwang` and `musKoto` are the nearest models.
- **Kulintang** (Palawan). A row of tuned bossed gongs: struck, **inharmonic
  partials**, short pitched decay with a metallic shimmer above the fundamental.
  `musMallet` for the envelope, `musBuoy` for the inharmonicity.

For each row in `sysMUS_PAL`: set `lead` to the new voice and `lift.inst` to
match. **Leave the harmony alone** — the chords, roots, next-tables, dwells and
filters in these three rows are already right and are not what is wrong.

### What must NOT change

- **Sydney, Circular Quay and Manly share mallets on purpose.** It is one city
  and the score says so deliberately. Do not "fix" this.
- **The Drift, Sơn Đoòng and Antarctica are placeless by design** — quartal
  stacks and open fifths with no thirds, chosen so the harmony refuses to tell
  you how to feel about somewhere. Do not give them an instrument.

### Phase 4 acceptance

- Each voice heard under `playwright-cli` with real key events.
- Each chapter's **lift** fired and heard, since `lift.inst` changed too. In
  Cappadocia that is the sun clearing the rim, and the row's comment notes the
  swell is held across the whole climb — so the figure is a melody, not a
  punctuation mark. Confirm it still works as one.
- Sydney, Quay, Manly, the Drift, Sơn Đoòng and Antarctica confirmed unchanged.
- Commit.

---

## Deliberately NOT in this batch

Say so in the final report rather than quietly doing any of it:

| left out | why |
|---|---|
| **Point lights** (`/polish V2`) — Hong Kong, Iceland and Monte Carlo have zero between them, so every neon sign blooms but lights nothing | Needs a new pooled subsystem with a frame-time budget. It is the one change in the pass that can plausibly cost performance, and that is not safe to fold into a long run. Highest-value thing left. |
| **The lens** (`/polish V4`) — no tone-mapping, a hard clamp, and a split tone that does not exist | Must run **last**: it re-grades every chapter, so it wants phases 1–2 settled underneath it. Also measured at 0% clipping in the ground band, so it is quality, not damage. |
| **Contact darkening** — the other half of the P3 finding in `qa/POLISH-PASS.md` | Needs prop-position plumbing. The rim in phase 2 is ~80% of that finding for ~20% of the work. |
| **Floor graphics** — Venice's Istrian banding, Kyoto's raked gravel, Hong Kong's road markings | Per-chapter authoring, not one mechanical change. Best done once phase 1 shows what the grain alone bought. |
| **Iceland and Sơn Đoòng ambience** | Real, but the least culturally distinctive of the eight. Trimmed to keep phase 3 in budget. |

---

## Final report

State all of:

1. The before/after `vis-flat2.js` table, both columns, all eight rows.
2. Which chapters got new ambience and what each got.
3. That the aesthetic law still holds — no textures, no image files, no PBR,
   flat-shaded Lambert via `mat()`, colours from `PALETTE`, module-tag prefixes.
4. Which phases completed. **If you stopped early, say at which boundary and
   why** — scaling this down is the user's call, not yours.
