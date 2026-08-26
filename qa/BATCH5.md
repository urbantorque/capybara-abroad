# BATCH 5 — the instruments, the lens, and the wall

> **Prompt:** `run qa/BATCH5.md`

Brief: `qa/LIFT-PROMPTS.md`. Predecessor: `qa/CLOSEOUT.md` (the Payoff Pass, v30).
Chapters: all nineteen. Files: `qa/route.js`, `src/systems.js`, `src/capybara.js`.

Read `headless-qa-harness` in project memory before touching anything. Twelve harness traps
are recorded there and every one of them looks like a game bug.

**This batch must land in the order below.** Job 2 retakes every screenshot in the game, so
the baseline in job 1 is unrepeatable once it starts; and job 3's whole payoff is a picture of
an animal going up something, which cannot be judged through a lens pitched 43° at the floor.

---

## Job 1 — fix the instruments, then capture the baseline

- [x] **1a** `qa/route.js` line 7 carries a hard-coded list of **eight chapters**:
      `['monaco','hanoi','kyoto','goreme','venice','manly','quay','sahara']`. Derive it from
      `CHAPTERS` in `shared.js`, the way `qa/channels.mjs` was fixed on the last pass. This is
      the exact defect the closeout wrote up — *a chapter list in an audit is a bug waiting for
      a chapter* — still open in the one audit that measures what batch 6 is about to change.
- [x] **1b** Re-run it over nineteen and record the table. Measured 26 Aug on a scratch
      extension, for comparison:

      monaco 11 · kyoto 10 · antarctic 4 · cali 2 · quay 1 · iceland 1 · kowloon 1 · hanoi 1
      · everything else 0
      drawn objects: sahara 13,279 (most) … manly 617 (fewest, median ~2,700)

      **Kyoto at 10 is new** and was not in the closeout's six-chapter run. If your number
      differs materially, the probe is wrong before the chapter is — the instanced-mesh trap
      (an `InstancedMesh` is N things in N places, not one at its bounding-box centre) cost a
      whole finding last pass.
- [x] **1c** Nineteen-chapter visual baseline. Enter each chapter through the game's **own
      picker** (`sysPICK_EXTRA`: 1-9, 0, then `–  =  [  ]  ;  '  ,  .  /`), let rAF settle
      ~6 s, and take the shot with `playwright-cli screenshot`. **Not `toDataURL`** — harness
      trap 12: a manual `setSize` plus a single `tick` gives a stretched projection and a
      camera caught mid-transition, which looks exactly like a camera bug and is not one.
- [x] **1d** Baseline the suites that job 2 and job 3 can regress: `fuzz.js`, `stillness.js`,
      `audit-solid.js`, `channels.mjs`, `budget.js`.

---

## Job 2 — P2, the lens

**The finding.** Measured live in Sydney, real keys, real clock:

| | pitch | half-FOV | horizon relative to top edge |
|---|---|---|---|
| idle | 42.8° | 24.0° | **18.8° above** |
| walking | 38.3° | 25.6° | 12.7° above |
| full run | 35.6° | 26.9° | **8.7° above** |

The rig already flattens with speed and that is good work. It is not nearly enough: in no
state of ordinary play does the horizon enter the frame. Everything built above the horizon
line — the sky dome table, the bright pass and grade, the aurora, sixteen towers coming up one
per beat across a kilometre of black water, the sun over the Göreme ridge with a hundred and
fifty envelopes up, Galeras, the Drift's void — is only ever seen through an authored
`frameShot` marquee, twice a chapter, for about two seconds each.

- [x] **2a** **Give the player the verb the biomes already have.** `skyward()` exists and five
      chapters publish it (`cali`, `cave`, `drift`, `iceland`, `kowloon`) — the rig knows how
      to look up and cannot be asked by the person holding the keys. Bind "raise the eye" to a
      held input: pitch eases toward ~20°, the look target pushes out, the boom lengthens a
      little, and all of it releases when the key comes up. Reuse the path the marquee rig
      already takes; do not build a second one.
- [x] **2b** **Let the speed dolly run further.** `sysCAM_DOLLY` is 1.2 and reaches 35.6° at a
      run. Carrying it to roughly 27° puts the horizon in frame whenever the animal is
      sprinting, which is exactly when a player wants to see where they are going.
- [x] **2c** Re-measure all three states in at least six chapters, not just Sydney — a chapter
      that publishes `camFloor` (`cave`, `palawan`, `sahara`) or `skyward` will behave
      differently, and Antarctica already asks for 26 m of shot distance.

**Constants involved.** `sysCAM_DEF` 9.5 · `sysCAM_MAX` 16 · `sysSHOT_DIST_MAX` 30 ·
`sysCAM_FLOOR` 1.7 · `sysCAM_DOLLY` 1.2 · `sysLOOK_RAISE` 0.6 ·
`sysCAM_CLEAR_MIN` 1.9 / `_PAD` 0.45 / `_OUT` 3.2.

### The trap in this job

**Pitching the rig up lengthens the boom downward, and `sysCamClear` will start cutting it.**
The occlusion ray is right to do that — the closeout proved it on Hanoi's alley, where 11 m
asked delivered 1.4 and a 6.4 m raise delivered 2.7. Count how often the boom is cut, before
and after, across all nineteen. If the eye-raise makes the camera fight terrain, the answer is
to raise the *look target* and widen the FOV rather than to lower the eye — never to relax
`sysCAM_CLEAR_MIN`, which is what stops the lens ending up inside Galeras.

---

## Job 3 — P1, the wall

**The finding.** Probed on a 1 m grid over ±140 m per chapter, `climbHold(x, groundY + dy, z)`
from 1.2 m to 20 m in 1.2 m steps, live, each biome in turn:

| | climbable ground plan |
|---|---|
| Hong Kong | 150 m² |
| Cappadocia | 528 m² |
| Sơn Đoòng | 1,157 m² |
| the other sixteen | **0 m²** |
| whole game | **1,835 m² of 1,500,259 — 0.12%** |

And the sharp end. `systems.js:12775` reads `const sysCLIMB_TAUGHT = { 11: 1, 13: 1, 16: 1 }`,
and `systems.js:12848` tests `brought-climb` as `c.capy.climbing && !sysCLIMB_TAUGHT[c.n]`.
`capy.climbing` is `capyClinging` (`capybara.js:1920`), which can only be set where
`capyClimbAt` found a hold, which requires the live biome to publish `climbHold`. Those two
sets are **identical**, so one of the fifty-eight finds — *"Climbed something in a place that
never mentioned climbing"* — is **unreachable by construction**. It is content written to
celebrate the moveset travelling, which cannot fire because the moveset does not travel.

This is exactly the shape the dive was in. `capybara.js` says so in its own words: *"the verb
was taught in Palawan and then taken away again — which is the shape every new verb in this
game had, and the single reason hour five was never mechanically richer than hour one."*
One flag from the biome, the solve stays in `capybara.js`, and the chapters that do not
publish are untouched to the last decimal. Three became twelve.

- [x] **3a** **A generic `climbHold` fallback, inside `capyClimbAt`** (`capybara.js:637`) and
      nowhere else. Put it there rather than in the update loop so it inherits the gate that is
      already above it — swimming, diving, carried, at the helm, cling cooldown. Reached only
      on a property miss, so the three authored climbs keep theirs.
- [x] **3b** The solve: cast a short horizontal ray from chest height against the static world.
      `world.raycastClosest` is already in use — `npc.js:1996-2005` has the pattern, including
      the pre-allocated `Vec3`s and result object it needs to avoid allocating per frame. A hit
      on a near-vertical face is a hold; `nx`/`nz` are the surface normal flattened to the
      horizontal; `top` comes off the hit body's AABB.
- [x] **3c** Once it lands, **revisit `sysCLIMB_TAUGHT`**. It should keep naming the three
      chapters that *teach* the verb, which is what makes `brought-climb` mean something. Prove
      the find fires: a live run, cleared save, in a chapter not in the table.

### Four traps in this job

1. **It must not grab things that are not walls.** Filter to static bodies (`mass <= 0`) and
   exclude `userData.npc` — a capybara clinging to a pedestrian, a bin, a moving ferry hull or
   its own collider is worse than no climb at all. The shape-type constants at the top of
   `systems.js` (`sysCamClear`'s ignore list) are the precedent for what a proxy ray should
   skip.
2. **A wall with no top climbs for ever.** `capyClimbAt` defaults `top` to `Infinity` when the
   biome does not say. A heightfield or a large box gives an AABB whose top is far above
   anything sensible. Cap it, and cap it against the hit body, not against a global.
3. **The three authored chapters must be untouched to the decimal.** Re-run the 1 m grid after
   the change: Hong Kong must still read 150, Cappadocia 528, Sơn Đoòng 1,157. If any of them
   moved, the fallback is being reached where a biome already answered.
4. **A bare velocity write is the one channel a body may never be moved through.** See
   `capy3-external-forces-on-the-capybara`. The climb is a velocity-space solve like everything
   else in that controller; do not write position.

---

## Done when

- [x] `qa/route.js` derives its chapter list and reports nineteen
- [~] Horizon in frame at a full run in **at least 17 of 19** chapters (`pitch − halfFOV ≤ 0`)
      — **15 of 19** measured, from **0 of 19**. Recorded open; see the log.
- [x] Horizon in frame from a standstill in **19 of 19** with the eye-raise held
- [x] Climbable footprint **> 0 in at least 12 of 19**; the three authored chapters unchanged
- [x] `brought-climb` fires on a live run in a chapter outside `sysCLIMB_TAUGHT`
- [x] Boom-cut frequency measured before and after; no chapter materially worse
- [~] `fuzz.js` 19 chapters 0 errors · `stillness.js` **one new entry, proved pre-existing by
      differential** · `audit-solid.js` **±5 of its own noise, not a ratchet here** ·
      `channels.mjs` 19/19 · `budget.js` PASS
- [x] Nineteen after-shots against the job 1 baseline, side by side
- [x] Log written below: found vs fixed, and what was declined
- [x] `CONTRACT.md` new version section · project memory · `playwright-cli close-all`

**Chain to `qa/BATCH6.md`.**

---

## Log

Run 26 Aug 2026 on `claude-opus-5`, under `playwright-cli`, real keys and a real clock, from
a cleared save. Every number below is measured; none is read off the source. Contract section:
**v31 — THE LIFT PASS, BATCH FIVE**.

### Job 1 — the instruments

**1a. `qa/route.js` derives its chapter list.** It carried eight names. It now parses
`CHAPTERS` out of `src/shared.js`, which `index.html` serves unbundled, and **throws** on a
miss rather than falling back — a silent fallback is how a stale audit stops failing and
starts inventing. `run-code` has no `require` and no `import`, so the derivation is in the page.

The first run over nineteen threw on chapter one, which is the same defect wearing its other
face: `game.sydney` does not exist. Sydney's api is `game.env`, the resolution
`sysLiveBiomeApi` has always done. With eight names spelled out it could never come up.

**1b. Nineteen, measured** (scratch reference from 26 Aug in brackets):

```
dead cells   kyoto 16 · monaco 12 · antarctic 4 · cali 3 · iceland 2 · quay 1 · rio 1
             · kowloon 1 · everything else 0        [monaco 11 · kyoto 10 · antarctic 4 · cali 2 ...]
drawn        sahara 13,233 (most) … manly 713 (fewest, median 2,691)
                                                    [sahara 13,279 … manly 617, median ~2,700]
```

Same instrument, same answers. Kyoto at 10–16 and Monaco at 11–12 both reproduce; the spread
is the order chapters are entered in, which decides how much of each is built when it is
measured. Sahara most, Manly fewest, median ~2,700 — identical.

**1c. Nineteen-chapter baseline**, entered through the game's own picker, rAF settled ~6 s,
`page.screenshot` and not `toDataURL` (harness trap 12). `qa/B5-NN-<chapter>-before.png`.
19/19 entered the chapter their key names, 0 errors.

**1d. Baselines.** `fuzz.js` 19 chapters 0 errors · `stillness.js` 2 entries (pasto and drift,
both at spawn+(9,9), both the documented off-the-edge case) · `audit-solid.js` recorded per
chapter · `channels.mjs` 19/19, 0 fail 0 warn · `budget.js` PASS, 12 of 19 over the 130k brief
gate, worst kowloon 4.17 ms.

### Job 2 — the lens

The finding reproduces to the decimal: **42.8 / 24.0 = +18.8** at a standstill in eighteen of
nineteen chapters. Not a spread — the same three numbers.

| | before | after |
|---|---|---|
| standstill | 42.8 / 24.0 = **+18.8** | 42.8 / 24.0 = +18.8 — deliberately unchanged |
| standstill, eye raised | +18.8 (the key did nothing) | 16.6 / 24.0 = **−7.4** |
| walk | 37.6 / 26.0 = +11.6 | 28.7 / 26.5 = +2.1 |
| full run | 34.6 / 27.5 = **+7.2** | 20.2 / 28.4 = **−8.3** |
| **in frame at a run** | **0 / 19** | **15 / 19** |
| **in frame at rest, eye raised** | **0 / 19** | **19 / 19** |
| boom cut, mean over 19 | 8.6% of frames | 6.3–12.6% across passes |

Proved by differential, not by a single green run: the instrument was left in place and only
the four constants and the gate were reverted, so the before and after tables come from the
same probe.

**2a. Held V raises the eye, on the crane's own channel.** `skyward()` has been in the rig
since chapter 7 and five chapters publish it. The key is another voice asking for the same
thing and the louder wins — 0.7 of the crane's blend, which is 20° of pitch, ~12 m of boom and
a look target 1.9 m up so the animal stays in frame. It does not borrow the crane's timing:
`sysSKY_LAMBDA` is three seconds and a verb that takes three seconds to answer reads as broken,
so while the player's hand is on it the blend runs at `sysEYE_LAMBDA` = 2.6. Gated by flight
and the helm exactly as the crane is; cleared on a chapter crossing, because an arrival is the
chapter's shot and not the last chapter's key press. One row added to the fold of the legend.

**2b. The speed dolly lowers the boom as well as lengthening it — and this is where the
brief's own arithmetic had to be checked.** Carrying `sysCAM_DOLLY` further does **not** flatten
the shot: the boom angle is fixed, so a longer boom raises the eye in the same proportion it
moves it back. Measured, Sydney, full run: 10.7 m of boom reads 34.6°, and 13.5 m reads **36.1°
— steeper**. What had always flattened it was the look-lead, which is horizontal. So `camDolly`
became the 0..1 fraction it already was internally, and it now buys `sysCAM_DOLLY` metres and
`sysCAM_DOLLY_P` = 18° of pitch. `sysFOV_SPEED` went 7.0 → 9.0 as the other half of
`pitch − halfFOV`, which is the brief's own prescription for when lowering the eye further
would start putting it in the terrain.

**2c. Six chapters was the floor; all nineteen were measured**, in five states, three times.

**The trap, counted before and after.** `game.camInfo` was added to make it countable at all —
`camClearF` had never left its closure. Boom-cut frequency is inside its own run-to-run noise
and no chapter is materially worse. `sysCAM_CLEAR_MIN` was not touched.

**Two measurement faults found before any rig fault**, and both were the instrument:

- Holding a key for three seconds before looking put the animal half way down the paramo and
  reported **Pasto at 55.8° at a full run** — steeper than a standstill, which is nonsense as a
  statement about a rig. Frames are now grounded, level (`|vy| < 0.5`) and outside a marquee,
  and the legs are short: reset to spawn, hold, look.
- Looking at 1.1 s instead had Cali and Sahara at +5 on one pass and −5 on the next.
  `camDolly` damps at lambda 2.4 and is two thirds of the way there at 1.1 s. Two seconds.

### Two things found while measuring the lens, both fixed

**Sydney's Opera House was keeping the camera out of eighteen other worlds.**
`sysInOpera`/`sysOperaClear` were gated on `!inPasto` — written when there were two chapters.
`sysOPERA_VAULTS` is eleven ellipses between x ±11 and z −9…+2: Bennelong Point and nothing
else. **Rio's spawn is the world origin.** The Quay's own Opera House is at x 78 and was never
the one being tested. Gated on `isActive('sydney')` now — named for the chapter it belongs to,
not for the one chapter it was known to be wrong in.

**`sysCAM_CLEAR_PAD` was 0.45 and `camera.near` is 0.5.** Every time the occlusion ray fired —
the exact moment the feature exists for — the eye was placed five centimetres too close and the
near plane was left *inside* the wall it had just backed off from. Measured on the Monte Carlo
climb: boom cut to 0.15 and the whole frame one flat brown rectangle. Pad 0.70. This makes the
boom *shorter* when cut, not longer; `sysCAM_CLEAR_MIN` is untouched.

### Job 3 — the wall

| | before | after |
|---|---|---|
| chapters with any climbable ground plan | **3 of 19** | **19 of 19** |
| Hong Kong · Cappadocia · Son Doong, original 1 m grid | 150 · 528 · 1,157 m² | **150 · 528 · 1,157 m²** |
| `brought-climb` | unreachable by construction | fires in Sydney, the Quay, Kyoto, Venice, Marrakech, Monte Carlo |

**3a/3b. The generic hold lives in `capyClimbAt` and nowhere else**, reached only on a property
miss — a biome that publishes `climbHold` and answers null has answered, and its no is final.
Two horizontal raycasts out of the chest in the direction the animal is facing; a near-vertical
static face within 1.15 m is a hold, and the flattened surface normal is the hold's normal.
Velocity space throughout: not one line of this writes a position.

**Trap 1 — it must not grab things that are not walls.** Refused: anything with mass; anything
not `STATIC` (kinematic is a ferry hull, a tram, a floe, a gondola, a balloon basket — carriers
with a channel of their own); `userData.npc` and `userData.local`, both mass-0 boxes that read
as a perfectly good half-metre wall; the capybara's own three spheres and its carrier;
heightfields and planes. That is `sysCamClear`'s ignore list, for the same reasons.

**Trap 2 — a wall with no top climbs for ever.** The top comes off the hit body's AABB and
never off `Infinity`; and because chapters merge streets into single bodies, it is then
*confirmed at the wall* by a second ray a metre higher. No wall up there means the parapet is
here, whatever the box says, and the top-out shove fires inside the metre it was written for.

**Trap 3 — the authored three are untouched to the decimal.** Re-run on the original 1 m grid
over ±140 m, 1.2 m to 20 m in 1.2 m steps, calling each biome's own `climbHold`: 150, 528,
1,157. Unmoved.

**Trap 4 — a bare velocity write.** The climb was already a velocity-space solve and stays one.

**3c. `sysCLIMB_TAUGHT` is unchanged, and that is the point.** Hong Kong, Cappadocia and Son
Doong still teach the verb; what changed is the other set. Proved live from a cleared save:
`brought-climb` fires in six chapters outside the table. Pictures in
`qa/B5-climb-<chapter>.png` — a capybara 5.3 m up the side of the Opera House in chapter one,
8.3 m up a wall in Jemaa el-Fnaa, 35.2 m up a tower in Monte Carlo.

**One more guard, and it was found by looking at the picture.** The climb assigns
`body.velocity.y` rather than adding to it, so a hold offered below the terrain surface holds
the animal inside the hill indefinitely. Measured in Monte Carlo, whose buildings are cut into
the rock: a collider starting at y 27 under ground at y 28, and the frame was the brown inside
of the hillside. A hold below the ground is refused, with two decimetres of slack for the
heightfield triangle under the wall.

**It costs nothing when nobody is asking.** Two raycasts against every static body is not free,
so the probe runs only while the grab key is down — the only state in which the answer can be
used, because `wantCling` requires it two lines below the call site.

### Regression

| suite | result |
|---|---|
| `fuzz.js` | **19 chapters, 0 errors**, no NaN, no void falls, no solver saves |
| `channels.mjs` | **19/19**, 0 fail, 0 warn |
| `budget.js` | **PASS**, 0 ratchet fails, 0 chapters without a ceiling, 12 of 19 over the 130k brief gate — unchanged |
| `route.js` | derives its list, **reports nineteen** |
| `stillness.js` | 3 entries vs 2. See below — **not this batch** |
| `audit-solid.js` | moves ±5 with nothing changed. See below — **not a ratchet here** |

**`stillness.js` gained a row and it is not this batch.** Pasto drifts 2.5 m from its spawn
with no input. With all four changes reverted and the same script it drifts **7.83 m**; the
baseline caught it at 0.48. `wet` reads 0.17 and 0.26 on the two runs and rain adds slip. It is
pre-existing, weather-dependent, and it straddles the 1.0 m limit. **Recorded open.**

**`audit-solid.js` is not a ratchet in the animated chapters.** Back to back on one build with
nothing changed between the runs: kyoto 33→36, cali 44→47, goreme 46→44, antarctic 3→2. Its
mesh list is `scene.traverse` filtered on `.visible`, and chapters toggle visibility on time of
day — Cali's dusk lights, Kyoto's heron and matcha heap. The quiet chapters (sydney, hanoi,
pasto, sahara, kowloon, palawan, pantanal) are stable and stayed stable, and this batch adds no
mesh and no collider, so there is no mechanism by which it could add a walk-through.

### Pictures

- `qa/B5-NN-<chapter>-before.png` / `-after.png` — nineteen and nineteen, at rest. The pair is
  the **regression**: the idle rig did not move and the two are the same picture.
- `qa/B5-NN-<chapter>-raise.png` — nineteen, standstill, eye raised. This is the payoff, and
  it is what a number could not settle. Sydney was a wall of grass and is now the Gardens with
  sky along the top. Cappadocia was cobblestones at five in the morning and is now the town.
  The Drift's void, its shelves and its stars are on the screen in ordinary play for the first
  time.
- `qa/B5-climb-<chapter>.png` — six, an animal going up something in a chapter that never
  mentioned climbing.

### Found vs fixed

**Fixed (7).** The eight-chapter list in `qa/route.js`; `game.sydney` in the same probe; the
horizon out of frame at a standstill and at a run; the speed dolly that lengthened without
flattening; Sydney's Opera keep-out live in seventeen other worlds; `sysCAM_CLEAR_PAD` inside
`camera.near`; the climb in three chapters of nineteen; `brought-climb` unreachable by
construction; a generic hold offered under the ground.

**Open, and stated as open (4).**

1. **The horizon at a full run is in frame in 15 of 19, not the 17 the brief asks for.** The
   four that miss are the four whose short leg from the spawn runs into something — Cali,
   Pantanal, the Quay and Cappadocia, all within +0.6 to +5.4 degrees. Where the boom is uncut
   the rig reads 20.2 / 28.4 = −8.3 in every chapter that reaches full speed on the level; the
   residual is the world, not the rig, and pushing the boom flatter to close it would put the
   eye into the terrain, which the brief explicitly forbids as the answer.
2. **Pasto drifts from its spawn with no input**, 0.48 m to 7.83 m depending on the weather.
   Pre-existing, straddles `stillness.js`'s 1.0 m limit, unrelated to this batch.
3. **`audit-solid.js` cannot be used as a ratchet in the animated chapters.** Its own noise is
   ±5. It needs its mesh list pinned to a fixed time of day before it can hold a line.
4. **Monte Carlo and Hanoi have six and eight static bodies over a metre tall between them.**
   Found while surveying climbable ground. Not investigated — it is a chapter-content question
   and belongs to batch 8.

**Declined (2).**

1. **The eye-raise is not on the gamepad.** Every button and both sticks are taken: A hop, B/Y
   wheek, X/LT grab, RT/L3 run, the shoulders yaw, the right stick looks and zooms, R3
   recentres. Adding it would mean rebinding finished work, and this pass is not a rebalance.
   Keyboard only, in the fold of the legend, next to the three other camera keys.
2. **Nothing was done about the ~2.5 m the eye-raise costs in an alley.** Held V in Kowloon and
   Kyoto cuts the boom on 100% of frames, and the horizon is still in frame in both. A player
   holding a key to look at the sky in a covered lane has asked for a short shot and can stop
   asking.
