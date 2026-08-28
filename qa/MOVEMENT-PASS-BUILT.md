# THE MOVEMENT PASS — four rows built, one withdrawn

> Companion to `qa/MOVEMENT-PASS.md`, which is the analysis that preceded these fixes and is kept
> as written. This is what was built, what it measures at, and what it cost to verify.
>
> **Landed on master in `708ecf9`.** It was built on the branch `movement-pass` (worktree
> `../capy3-mv`) because two other live sessions were writing this tree at the same time and
> reverted two of the edits mid-run; the three source files are byte-identical between the two,
> so the branch is now a record rather than a fork.
>
>     node server.mjs                                   # PORT=5189, from ../capy3-mv
>     playwright-cli -s=mv open http://localhost:5188/
>     playwright-cli -s=mv run-code --filename=qa/mv-stop.js    # stopping distance, turn cost
>     playwright-cli -s=mv run-code --filename=qa/mv-park.js    # 60 s parked, 19 x 3 spots
>     playwright-cli -s=mv run-code --filename=qa/mv-bonk.js    # does a wall answer
>     playwright-cli -s=mv run-code --filename=qa/mv-noise.js   # ...and does it answer too often
>     playwright-cli -s=mv run-code --filename=qa/mv-feel.js    # walk, run, hop across 19
>     playwright-cli -s=mv run-code --filename=qa/mv-condor3.js # first ride vs every ride after
>     playwright-cli -s=mv run-code --filename=qa/mv-climb.js   # the climb, through the REAL path
>     playwright-cli -s=mv run-code --filename=qa/fuzz.js       # the existing random-input soak

---

## WHAT THE ANALYSIS GOT WRONG — row 3, withdrawn

Row 3 said the climb was three set pieces and the wind should be published by more chapters.
**Both halves are wrong, and the code says so in its own comments.**

- **`capyClimbProbe` already gives every chapter a generic wall climb** — *A WALL IS A WALL, IN
  EVERY CHAPTER (v31)*, a two-ray probe against the static world, reached on a property miss.
  `qa/mv-verbs.js` asked `api.climbHold`, which is hook publication and **not the verb**. Driven
  through the real path (`qa/mv-climb.js`), the climb fires in chapters that publish nothing:
  Kyoto **+4.84 m and +4.95 m** up two walls, Antarctica **+1.99 m**, Cali **+0.83 m**. The
  0.12%-of-the-ground figure the analysis leaned on is the *pre-v31* number — and it is quoted
  inside the comment that fixed it.
- **The wind is deliberately not the weather.** `capyWindAt` carries a long note — *AND THE
  MICRO-GUST DELIBERATELY DOES NOT COME IN HERE* — saying that `wind()` is the air as a
  **reference frame**, added to `platVX/platVZ` beside a ferry deck, and that putting the ambient
  gust on it would slide a capybara across Jemaa el-Fnaa at walking pace with nobody touching a
  key. The proposal was the exact bug that note exists to prevent.

The only useful residue: `qa/mv-verbs.js`'s `climb` column measures the wrong thing, and
`qa/mv-climb.js` replaces it.

---

## 1 · THE SPRINT HAS A STOPPING DISTANCE

`capyGRIP_LAMBDA`, commented `// idle, grounded`, was the damper at **every** speed, so the number
that holds a parked capybara on the flank of Galeras also stopped a sprint. `capySTOP_LAMBDA` —
the one named for it — was referenced nowhere on the ground path.

| | frames | distance |
|---|---|---|
| before | 3 | **0.185 m** |
| after | 9 | **0.502 m** |

    after:  1:v5.63 d0.123   2:v4.43 d0.217   3:v3.51 d0.291   4:v2.78 d0.349
            5:v2.20 d0.396   6:v1.74 d0.432   7:v1.38 d0.461   8:v1.09 d0.484   9:v0 d0.502

Split at `capyGRIP_SNAP`, as the note at the top of `capybara.js` has always described. It is a
`min`, not a lerp, so it can only ever soften the damper — on ice `grip` is already far under
`capySTOP_LAMBDA` and the slide is untouched to the last decimal.

**The band edge is provably out of reach of gravity.** The stiff band settles at `v = a/60`, so
leaving it would need 54 m/s² of downhill acceleration against a world gravity of 24. Not on any
slope, at any angle, anywhere.

**And it was measured anyway.** `qa/mv-park.js` — 19 chapters × 3 spots (spawn, spawn+(9,9), the
steepest patch within 60 m) × 60 s with no input at all, run against HEAD and against the fix:

    57 cells.  Not one changed.  Worst drift 8.33 -> 8.31 m, which is the Drift's +9+9
    spot being off the island — the cloud catching you and handing you back. Antarctica's
    slippery flank 3.56 -> 3.38.  Everything else reads 0.00 on both sides.

A skid tell rides on it: one negative pop and one puff of the dust a hard landing already kicks
up, gated at 5.2 m/s and armed by the stick, so one release is one skid however long the slide.

Unchanged: 90° at a sprint still costs 31% (7.40 → 5.10, settling in 12 frames); 45° still 19%.

**One interaction worth knowing:** a stop taken while carrying a shove is longer, because
`capyShove` decays on its own λ of 4 and widens the speed cap while it does. A clean sprint stops
in 0.502 m; a sprint that has just bounced off a wall measured 0.865 m. That is the bounce, and
it is the intended behaviour of both features at once.

---

## 2 · A WALL ANSWERS

The collide listener returned on `other.mass < 0.8` before it looked at anything, and a static
collider is mass 0. The analysis measured 12 bearing-impacts with no response; the soak is worse:

    45 s of driving per chapter, sprinting and turning about once a second:
    FOURTEEN OF NINETEEN chapters fired zero punch() of any kind.
    Sydney, Kyoto, Cali, Rio, Iceland, Marrakech, Hong Kong, Palawan, Cappadocia,
    Manly, the Pantanal, Son Doong, Antarctica, Hanoi — nothing landed, ever.

A second branch in the same listener gives a static hit a speed-scaled `punch()`, a spatialised
`thud`, a squash and a bounce-off through `capyShove`. Three gates keep the floor out of it: a
mostly-horizontal normal, a real closing speed **along that normal** (so a graze is silent and
only an arrival counts), and a throttle, because three spheres against one flat face make several
contact points on the same frame.

**The thresholds were set by how often it fires, not by how hard it looks.** The first cut —
2.6 m/s, 0.22 s — rattled. `qa/mv-noise.js`, punches per 45 s:

| | HEAD | first cut | shipped |
|---|---|---|---|
| Circular Quay | 2 | 23 | **5** |
| Hong Kong | 0 | 18 | 15 |
| Cali | 0 | 14 | 16 |
| median chapter | 0 | 10 | **5–7** |
| chapters firing none | 14 | 0 | 0 |

Hong Kong and Cali sit near one per three seconds, which for a narrow street of scaffold poles
under *random* driving is honest. `qa/mv-bonk.js` answers **7 of 8** clean impacts; the one that
stays quiet is an oblique stop whose normal component never reaches the line, which is the gate
doing its job.

---

## 3 · WITHDRAWN — see the correction at the top

---

## 4 · MOMENTUM BUYS SOMETHING

**The barge.** `physOnCollide` knew the difference between walking into a thing and running into
it for exactly one prop type in thirty-eight. Generalised, with the one rule that stops the street
becoming a bowling alley: the impulse is **scaled by the prop's own mass**, so it grants a
*velocity* — capped at 1.9 m/s, under half a walk — rather than a momentum. A straw hat and a
market crate get the same metres per second and neither is launched. Directionally confirmed: a
Sydney deckchair 0 → 1.27 m, a basket 1.59 → 4.99 m, a Venice menu board 4.52 → 7.26 m.
`qa/mv-barge.js` does not re-seat the prop between trials and is a rough instrument, not a gate.

**The run-up.** A sprinting hop already travelled 5.3 m against a walk's 3.0, but only in
proportion to the speed it had. There is now a forward shove above 4.6 m/s, ramped in over the
next 1.6 m/s so there is no step at the boundary, applied along the **travel** rather than the
nose, and through `capyShove` — the one channel an external force may use.

**The apex and the airtime are untouched, and that was the constraint.** Eighteen chapters of
geometry are sized against a 1.37 m apex, and a flatter arc would put a ledge somewhere out of
reach: the worst regression this game can have. `qa/mv-feel.js` after: **1.37 m and 0.717 s in
seventeen of nineteen**, the Drift still 4.51 m and 2.083 s. Hanoi reads 1.06/0.267 because the
probe's flat patch had a motorbike parked on it.

---

## 5 · THE CONDOR COMES WHEN CALLED

A cold summon is four seconds of inbound spiral, then the bird circles at fourteen metres and
**waits for a second whistle**, then two and a half seconds of descent — ten seconds of standing
still in front of the best two minutes in the chapter.

That is right the first time. The toast says *whistle again to bring it down*, and the chapter is
built on the whistle being a conversation rather than a button. It is a tax every time after. So
once the ride is on the file — `game.taskDone('condor-ride')`, which is what makes it survive a
reload — the low orbit is armed from the start and the "whistle again" line is suppressed:

    first ride          9 s, two whistles     (unchanged — the lesson)
    every ride after    6 s, ONE whistle      (measured, qa/mv-condor3.js)

The inbound spiral is deliberately untouched: it still eases to the high orbit over its four
seconds, because that spiral is the arrival and it is the best thing the bird does.

**Not built, and it is content rather than a fix:** a second flier in a later chapter. The flight
law is already biome-neutral and the measured flight is excellent — +32.1 m in 60 s at a thermal,
stable ~6 s orbits, no stall. The same goes for a shared helm between `quay.js` and
`antarctic.js`, which carry two parallel implementations of one idea.

---

## Regression

- `qa/mv-park.js` — 57 cells, HEAD vs fix: **no cell changed.**
- `qa/fuzz.js` — 19 chapters of random input: **no NaN, no camera NaN, no void falls, no solver
  saves, no dropped modules, no console errors.**
- `qa/mv-feel.js` — hop apex, airtime, tap height, walk top and run top all unchanged.
- `qa/mv-bonk.js` — 0/12 answered → 7/8.
- `qa/mv-noise.js` — the new feedback measured against HEAD, 45 s per chapter.
- Live browser, Sydney, real keyboard and real rAF: **0 console errors, 0 warnings.**
