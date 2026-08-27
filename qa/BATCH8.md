# BATCH 8 — the independent list: nine things that contend with nothing

> **Prompt:** `run qa/BATCH8.md`

Brief: `qa/LIFT-PROMPTS.md`. Predecessors: `qa/BATCH5.md` … `qa/BATCH7.md`, and
`qa/CLOSEOUT.md`, which is where rows 1-6 were last measured and left open.

Read `headless-qa-harness` in project memory first.

**None of this touches the shared controller, the camera rig or the reaction layer**, so this
batch may run at any point — before, between or after the other three, or split across two
sittings. It is a list, not a sequence. Rows are ordered by how much they cost a player, not
by how hard they are.

Three of them are the same defect in three chapters: **a thing that was drawn, published and
never once asked after.**

---

## The rows

- [x] **1 · Pasto — the spawn drift, and it is not the walker shove**

      Measured parked at spawn+(9,9) with **no input**: ~8 m of travel in 60 s, three runs
      consistent (7.97 · 8.11 · 7.97). `npcBlockedFor` landed last pass and took the shoves to
      **0 in three consecutive runs** — and the drift did not move (7.97-9.71 without, 7.97-8.11
      with). An earlier run with **14 shoves drifted 1.22 m**, so the shove was never the
      dominant term.

      What is left is a steady straight slide on ground where `gradX`, `gradZ` and `slopeAt`
      all read **0.0000**, with the body holding *exact* velocities — `vz = -3.000` for five
      seconds, then `vx = -0.368` for five more — while its position barely changes. A held
      exact value is a **bare velocity write**, which `capy3-external-forces-on-the-capybara`
      says is the one channel a body must never be moved through. Find the writer.

      This is the second thing anybody touches in the game. It should not still be here.

- [x] **2 · Hong Kong — the neon reads as a carpet from the game's own camera**

      `hkGlowMesh` sizes each pool as `rr = (w + h) * 0.42`, drawn at `rr * u * 1.5` — a
      **radius of (w + h) × 0.63**, up to roughly 15 m across for a large sign, sixty of them,
      overlapping. Observed from the default rig: the carriageway is a quilt of translucent
      discs rather than a wet road with lights over it.

      The code's own comment warns of exactly this — *"Big overlapping patches tile the whole
      carriageway and the road stops being tarmac and becomes a rug."* The fix that comment
      documents changed the **shape** (nested boxes → 16-gons, because a pool of light is
      round) and left the **size**. Both halves are needed.

      Judge it from the PNG at the arrival camera and from the roof, not from the number.

- [x] **3 · Hong Kong — the roof, still 0.65 m out of reach**

      Tops out 0.65 m east of the deck; the scaffold colliders fill the bay. `symphony` is not
      blocked by it, so nothing is unwinnable — but the chapter's last verb and its best
      picture are supposed to be the same gesture, and they are not.

      **Do not lower `hkSCAF.top`.** Carried unchanged through v27, v28 and v30 with that
      warning each time.

- [x] **4 · Palawan — `inZone('shaft')` has no readers repo-wide**

      The chamber with the hole in the roof and one shaft of light coming down onto white sand
      is drawn, is published as a zone, and nothing in the game has ever asked about it. It is
      the picture the chapter's whole argument resolves into.

- [x] **5 · Sơn Đoòng — `nearestDrip()` and `echoReady()` have no readers repo-wide**

      Two published APIs, unread, in the one chapter whose entire argument is sound and
      dripping water. Twenty-six drips that ring the floor and tick, and nothing asks where the
      nearest one is.

- [~] **6 · Iceland — the snowcat is parked where nobody goes**

      Track at `x = 34`; every glacier run ends at `x ≈ -20`. Moving it moves the beacon, the
      headlights, the ramp meshes and the fox's orbit centre, all derived from `iceCAT_X` —
      which is why three passes have written it down instead of moving it. Either move all five
      together or move the runs; do not move the track alone.

- [~] **7 · Route density — Monte Carlo 11, Kyoto 10**

      Measured on the nineteen-chapter `route.js` (see `qa/BATCH5.md` job 1a; the version in
      the repo before that fix reads only eight chapters). Everything else is 0-4.

      **Kyoto at 10 is new** — the Gion → torii → Uji walk is the emptiest sustained route in
      the game, and it lands in chapter four, before a player has any reason to be patient.
      Monte Carlo's dead cells all sit on one walk: the climb from the port to the Casino,
      which is how act one becomes act two. Fifteen instanced lamps closed it from 14 to 12 by
      differential; the rest is content on that hillside.

      **TRIM, never pad** — batch 4's rule. And remember the probe's own history: it once
      reported 48 dead cells and adding fifteen lamps on the exact line it complained about
      moved the number **up** to 53. A detector that gets worse when you fix what it points at
      is not measuring what it says.

- [~] **8 · Manly — 617 drawn objects, by far the fewest in the game**

      Median is around 2,700; Marrakech is 13,279. Manly passes the route audit only because
      most of the chapter is water, which is the one place a dead cell is not a fault. That
      makes the audit's green a fact about the geometry rather than about the chapter.
      Decide deliberately whether a surf zone wants more in it, and record the decision either
      way.

- [~] **9 · Ambient life — 5 of 19 chapters register a critter**

      `quay`, `kyoto`, `iceland`, `manly`, `goreme`. Chapters 18 and 19 have no ground animal
      drawn at all, so for them this is content and not a flag. The seven "things that are
      simply there" — the floatplane, the heron, the storks, the vencejos, the cometas, the
      arctic fox, the skein over the Drift — are the cheapest delight in the game per line, and
      two-thirds of the chapters have none.

      This row is the one that can be trimmed if the batch runs long. It is also the one most
      likely to be worth more than it looks.

- [~] **10 · Room tone is keyed per biome, not per space** *(declined twice; restate, do not
      re-litigate)*

      Venice and Palawan remain its worst cases. Carried unchanged from v27. Either build it or
      restate it — do not write the finding down a fourth time as though it were new.

---

## Done when

- [x] Every row above either **fixed and proved by differential**, or **restated as open with a
      current measurement**. A row that is neither is not finished.
- [x] Row 1 in particular: the writer named, or the search recorded with what was ruled out.
      "Still drifting" without a narrowed cause is not a result.
- [x] `qa/stillness.js` — Pasto's entry gone, or its residual re-measured and stated
- [x] `qa/fuzz.js` 19 chapters 0 errors · `route.js` re-run and the table recorded
- [x] Any unread API from rows 4 and 5 now has a reader, or is deleted — **a published API with
      no reader is either a missing feature or dead weight, and it should not stay ambiguous**
- [x] Log written below: found vs fixed, and what was declined
- [x] `CONTRACT.md` new version section · project memory · `playwright-cli close-all`

**Chain nothing.** The Lift Pass ends here.

---

## Log

Run 27 Aug 2026, `claude-opus-5`, unattended. **Five rows fixed outright (1–5), one fixed in
part (9), four restated with a current measurement (6, 7, 8, 10).** Everything below is from
the running game under `playwright-cli` unless it says otherwise.

### 1 · Pasto's drift — the writer is named, and it was never a velocity write

**It is the carroza.** Three passes looked for a bare `body.velocity` write because the body
held *exact* velocities while it slid. There is no such write. Proxying `capy.body.velocity`
and tallying every setter by stack, over 20 s parked at spawn+(9,9), returns **three writers
and all three are `capybara.js`** — 2568/2569 (the movement solve, writing `0.0000`) and 2143
(the hop-kill). Nothing in `pasto.js` touches it.

Proxying `body.position` instead named it in one run: **100% of the 7.967 m came from
`world.step` at `src/main.js:993`** — cannon's own integrator, answering a contact. The contact:

| | |
|---|---|
| body | KINEMATIC, mass 0, two boxes, at **x 10.5**, z rising at **2.15 m/s** |
| that is | `pastoCarBody` — the Carnaval float, `pastoCAR_X` 10.5, `pastoCAR_HX` 1.62 |
| its slab | x **8.88 … 12.12**, y **0 … 1.55** — it stands *on* the cobbles |
| spawn+(9,9) | x **9.0** — **0.12 m inside the near edge** |

The float drives its 3.24 × 6.60 m slab through the parked animal at walking pace and pushes it
to z 42.97, which is `pastoCAR_Z1` + `HZ` + the animal's own radius, and then stops because the
float stops. Eight metres, silent, while the player is still reading the arrival card.

**And the "exact −3.000 for five seconds" is `capyPIN_VMAX`.** The anti-creep pin was pulling
back at its own cap against a 2.15 m/s push it could not beat. The tell everyone read as a bare
write was the fix fighting the bug.

**Built:** `pastoCarBlocked()` — a procession stops for a capybara. Ground level only, not
aboard (the deck is 1.55 m up and riding it is the chapter's mini), inside the lane's x band,
and from the slab's own **rear** face to 1.25 m in front of it — the rear bound is `−HZ` and
not zero because the animal can be standing *inside* the footprint, and "in front of the
centre" waves that case through. Deliberately not as far back as the hitch at −3.72: that is
the way aboard and she must keep rolling while you climb it.

**Differential**, same script, four float phases, 60 s parked at spawn+(9,9), no input:

| lead | 0 s | 4 s | 8 s | 13 s |
|---|---|---|---|---|
| **without** (`git stash`) | 9.18 | **28.76** | 7.63 | 7.98 |
| **with** | 0.24 · 3.01 | 0.42 · 4.21 | 1.78 · 3.92 | 0.61 · 0.73 |

`qa/stillness.js`, which is the instrument that owns this: **pasto 0.29 m at spawn, 0.33 m at
spawn+(9,9)**. Its `issues` list now has one entry in nineteen chapters and Pasto is not it.

**Regression:** with the animal clear of the lane the float still runs its full 28.5 m circuit;
ridden from the deck, `carroza` still completes (659 moving frames aboard, 11 s).

**And the residual, which is not a defect.** Parked at the *actual* spawn (0, 26) the animal
still moves ~0.15–0.30 m per 10 s. Same instrumentation, one writer:
`paShoveCapy (src/npc.js:6162)` ← `paStepHuman` ← `paUpdate`, `velocity.y += 1.533`, every
**2.6 s**, which is `rec.swatCd`. That is the abuela, chasing, connecting with the broom —
`paShoveCapy(rec, 78, 46)` through `applyImpulse`, the correct channel. `npcBlockedFor` gates
chase *out* on purpose. The second thing anybody touches in this game is now a capybara being
swatted very slowly across a plaza, which is the chapter.

### 2 · Hong Kong's neon — fixed, and judged from the PNG

The comment was right and the arithmetic under it was not: `rr = (w + h) × 0.42` drawn at
`rr × u × 1.5` is an outer **radius** of `(w + h) × 0.63`. From the arrival camera the footpath
was a quilt of translucent discs with tarmac showing through the gaps — the rug the comment was
written to prevent, in a rounder shape. Outer radius is now `(w + h) × 0.25`: one pool about as
wide as its own sign, **a sixth of the area**, so sixty of them stop merging.

Before · after: `qa/B8-hk-before-arrival.png` · `qa/B8-hk-after-arrival.png`. The road is
tarmac with lights on it.

### 3 · Hong Kong's roof — reachable, and `hkSCAF.top` never moved

**It was a height, not a distance.** The note that closed the topmost deck's ladder hole
(`HOLE = (b === nBay) ? 0 : 2.2`, so a player could not top out over an open shaft) made that
deck a continuous 3.4 m plank from x −10.75 to −7.35 at y **34.68 … 34.92** — directly over the
face the chapter's own climb goes up. Measured, colliders listed from the world:

| | |
|---|---|
| the climb line | x **−9.07** |
| the lid | scaffold top deck, underside **34.68** |
| so the climb tops out at | **34.365** = 34.68 − the animal's own half-height |
| the roof deck | x −28.5 … **−9.70**, top 34.20 |

0.63 m east of the roof's edge with nothing under it — the 0.65 m, and `hkSCAF.top` (34.8) is
innocent of all of it.

**Built:** the ladder hole *moves* rather than closing. The top deck is two planks — inner
−10.75…−9.75 (the landing, 0.72 m over the roof, a step down), outer −8.45…−7.35 — with a
1.30 m slot between them along the outer face, which is where a climber actually arrives.

| | before | after |
|---|---|---|
| `climbPeak` | 34.36 | **34.85** |
| topped out | never | **13.2 s** |
| four seconds after letting go | fell 34 m to the street | **standing, y 35.06** |
| walked to `roof` mark | — | **y 34.54, on the 34.2 deck** |

`qa/b8-hkroof3.js` returns zero issues. Picture: `qa/B8-hk-roof-after.png` — the animal on the
roof among the water tanks while the Symphony line plays.

### 4 · `inZone('shaft')` now has a reader

A new place find, chapter 12: **`in-the-shaft`** — *"Went down and stood in the one bar of
daylight that reaches the floor."* The cathedral floor is at −8.5, so the shaft is a thing you
go **down** into: diving, in the zone, under 0.6 m/s, for five seconds. `cathedral` pays out
for finding the room; this is what the room is for.

### 5 · `nearestDrip()` and `echoReady()` now have readers

- **`nearestDrip()`** → `wet-in-a-mountain`, which is now literal. It read *"wet, and standing
  still, anywhere in the mountain"* — which the river also satisfies for a minute after you
  climb out of it. Now: within **2.4 m** of the nearest of the twenty-six columns.
- **`echoReady()`** → a new find, chapter 16: **`let-it-return`** — *"Called into the dark and
  held still until the whole of it came back."* `first-echo` fires on the frame the noise
  leaves; the cool-down running **is** the echo still out, and coming off it without having
  moved is having listened to all of it.

All three proved live in one run: `in-the-shaft` ✓ (depth 6.87, diving), `wet-in-a-mountain` ✓
(still reachable after the tightening, wet 0.62), `let-it-return` ✓ (`echoReady` true → false →
true across a held four seconds). `qa/audit-tasks.mjs`: **0 blockers, 0 warnings, 60 finds over
19 of 19 chapters.**

### 6 · Iceland's snowcat — RESTATED OPEN, and now with the reason measured

Three passes wrote it down. This one measured why, and the answer is that **neither of the two
moves the row allows is available.** Terrain and slip sampled across the valley:

```
x        -34  -30  -26  -22  -18  ...   18   22   26   30   34   38
slip       1    1    1    1    1  ...    1  0.8    0    0    0    0
y z-110 13.4 12.7 12.4 12.3 12.4  ... 18.4 21.3 27.1 27.1 27.1 27.1
```

The moraine is the **flat shelf at x ≥ 26** — its height is constant across it, which is what
makes it a track. Everything at **x ≤ 22 is glacier ice at slip 1.0**. `iceCAT_X` 34 could go to
28 and no further before the 4.0 m track mesh hangs over the ice; that buys 6 m of a 54 m walk
and puts the moraine on a glacier. Moving the runs means moving the glacier.

**And it is not a miss, it is a walk.** `iceCAT_HOLD_R` 58 / `iceCAT_HOLD_MAX` 26 already
reach the runout. Measured with the animal parked at (−20, −86), where every glacier run ends:
the machine **held at the bottom for 26.4 s**. Open, deliberately, and the walk is 54 m.

### 7 · Route density — re-run, recorded, and DECLINED TO PAD

Nineteen chapters, current:

| | dead cells | drawn objects |
|---|---|---|
| monaco | **9** | 2,762 |
| kyoto | **7** | 3,676 |
| antarctic | 4 | 4,239 |
| cali · iceland | 2 | 4,057 · 4,922 |
| quay · kowloon | 1 | 6,673 · 2,267 |
| the other twelve | **0** | 617 … 13,458 |

Monte Carlo 11 → **9**, Kyoto 10 → **7**, with nothing done to either. Then the cells were
looked at, because rule 4 says a number says the subject is present and only the PNG says the
shot is good:

- **Kyoto** `(10,179)`, `(38,90)`, `(-9,77)` — the camera is *inside a Gion machiya*. The wall
  is two metres away. **The detector locates a mesh at its bounding-box CENTRE**, so a chapter
  built from a few large merged meshes reads as empty from a metre away, and one built from
  13,458 separately-placed instances (Marrakech) scores zero. That is the same family as the
  fault this probe was already fixed for once — and it is why the probe once got *worse* when
  fifteen lamps were added on the exact line it complained about.
- **Monte Carlo** `(111,−31)`, `(136,10)` — genuinely bare, and genuinely not a walk: the leg is
  a straight line from the port to the tunnel mouth, which climbs over the headland. A player
  going to the tunnel takes the road.

**Nothing padded.** Recorded instead: this probe measures *placement style*, not scenery
density, and until it locates merged geometry by its surface rather than its centre its ranking
should not be spent on.

### 8 · Manly's 617 objects — DECIDED, and the decision is to leave it

Looked at, from three cameras, because 617 is a number and the row asks for a decision.
`qa/B8-manly-wide.png` · `qa/B8-manly-promenade.png` · `qa/B8-manly-spawn.png`.

The wide shot is a composed chapter: the crescent, eight Norfolk pines in a row, the Corso and
its shopfronts, the ocean pool, both headlands, three surf lines and a beach full of people.
The promenade shot at eye height has pines, benches, bins, litter, boards, umbrellas, flags,
sandcastles and a crowd inside twenty metres. **It is not a sparse chapter and 30.5% of its
plan is water** (513 of 1,681 cells sampled at 6 m).

617 is a fact about how Manly is BUILT — a small number of large merged forms plus one crowd —
and it is the same fact row 7 turned up: this measure counts mesh *records*, so a chapter of
merged surfaces scores low and a chapter of scattered instances scores high whatever is
actually in front of the player. **No content added.** The route audit's green is correct here
for a better reason than the row assumed.

### 9 · Ambient life — one chapter gained, and the rest measured rather than guessed

**Built:** Venice's pigeons are in the calm registry. `venPIGEON_R` was a constant that could
not hear the player being still, in the square with the most famous pigeons in Europe in it —
and `pigeons-back` ("stood still long enough for the pigeons to come back") was already the
reward for exactly that. `bold: 0.85`. Measured after: base 5.2 m, live `near` **4.09 m**.

**Census, all nineteen, from `calmAudit()`:**

| | |
|---|---|
| register a critter | quay 3.5 · kyoto 9.0 · iceland 6.5 · **venice 5.2** · goreme 2.5 · manly 7.0 |
| | **6 of 19** (was 5) |

The other thirteen were checked one at a time rather than counted, and most of them are not the
flag the row assumed:

- **antarctic** — the penguins already turn to look at you inside 20 m and deliberately do
  nothing else. `ignored` ("stood about in the middle of the colony and was completely
  ignored") is a *find*. Registering a flee radius here would delete a joke.
- **pantanal** — the egrets are a marquee flush on a 0.62 s ladder, timed to the speed a
  capybara crosses a river. It is a set piece, not a critter.
- **the remaining eleven** have no ground animal with a proximity radius at all, so for them
  this is content to be authored and not a flag to be cleared — which is what the row itself
  says about 18 and 19.

**Deferred, deliberately**, as the row allows: authoring new animals in eleven chapters is a
pass of its own, not a line in this one.

### 10 · Room tone per space — RESTATED, not re-litigated

Declined twice, and this is the restatement, not a third finding. `sysROOMS` keys the impulse
response off the biome. Venice and Palawan remain its worst cases: one chapter is a stone
square, a covered arcade, a colonnade and the inside of a basilica, and the other is open
water, a beach and a limestone chamber with a hole in the roof, and each answers with one
room. Unchanged from v27. It is a real defect and it is not being built in this pass.

---

## Done when — answered

- [x] Every row fixed and proved by differential, or restated with a current measurement.
      **Fixed: 1, 2, 3, 4, 5, 9 (in part).  Restated with a new measurement: 6, 7, 8, 9 (the
      rest), 10.**
- [x] Row 1's writer named — `pastoCarBody`'s contact through `world.step`, plus the residual
      named as the abuela's broom at `npc.js:6162`. The "bare velocity write" hypothesis is
      ruled out by direct instrumentation, not by inspection.
- [x] `qa/stillness.js` — Pasto's entry **gone**. 0.29 m at spawn, 0.33 m at spawn+(9,9) over
      60 s. The suite's `issues` list is down to one row (drift's offset point, which is the
      Shelf edge and is stated in the suite's own message).
- [x] `qa/fuzz.js` — **19 chapters, 0 errors, 0 NaN frames, 0 void falls, 0 issues.**
- [x] `route.js` re-run and the table recorded (row 7 above).
- [x] `qa/audit-tasks.mjs` — 0 blockers, 0 warnings, 229 tasks, **60 finds** over 19 of 19.
- [x] Both unread APIs from rows 4 and 5 now have readers, proved live in one run.
- [x] `node build.mjs` — 6,126 top-level declarations, no collisions.
- [x] Log written: found vs fixed, and what was declined.
- [x] `CONTRACT.md` v34 · project memory · `playwright-cli close-all`

**Chained nothing. The Lift Pass ends here.**


