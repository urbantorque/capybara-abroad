# THE MOVEMENT PASS — five things, measured

> **Rows 1, 2 and 4 have since LANDED — this page is the analysis that preceded them, kept as
> written.** It said "analysis only, nothing in `src/` was changed", and that was true when it
> was written and stopped being true in the same working session. Corrected here rather than
> rewritten below, because the measurements are what the fixes were sized against and they are
> worth more unedited.
>
> | row | state | proved by |
> |---|---|---|
> | **1** the sprint has no stopping distance | **landed** — `capySTOP_LAMBDA` reaches the ground path, two bands split at `capyGRIP_SNAP` | `qa/mv-stop.js`: **0.185 m in 3 frames → 0.50 m in 9**, decaying 5.63 → 0 instead of 2.72 → 1.00 → 0. The turn is untouched at 7.4 → 5.1 over 12 frames |
> | **2** static impacts are silent | **landed** — the collide listener returned on `other.mass < 0.8` before looking at anything, so every collision with the world itself was discarded. Static branch added: punch, spatialised thud, squash, and a bounce through `capyShove` | three gates keep it off the floor — normal mostly horizontal, closing speed along that normal, and a throttle for the three-sphere compound |
> | **4** momentum buys nothing | **landed** — the run-up, gated on speed over the floor rather than on the run key, applied along the travel and not along the nose | apex and airtime unchanged to the centimetre (1.37 m, 0.717 s) — the trade is purely horizontal, because eighteen chapters of geometry are sized against that height |
>
> Rows **3** and **5** are still open. Row 3 is `qa/BATCH5.md`'s job 3. Row 5 is unscheduled.
>
> Also landed alongside: the second-whistle toast in `condor.js` no longer fires at a player
> whose bird is already on its way down, and three dead constants went out of `capybara.js`
> (`capyUP_KP`, `capyTUG_RADIUS`, `capyTUG_EFFORT` — zero references repo-wide).

> Every number below came off one of the five new probes in `qa/`, all of which are re-runnable:
>
>     node server.mjs                                   # PORT=5188
>     playwright-cli -s=mv open http://localhost:5188/
>     playwright-cli -s=mv run-code --filename=qa/mv-stop.js     # stop distance, turn cost
>     playwright-cli -s=mv run-code --filename=qa/mv-feel.js     # walk/run/hop, 19 chapters
>     playwright-cli -s=mv run-code --filename=qa/mv-bonk.js     # what happens when you hit a wall
>     playwright-cli -s=mv run-code --filename=qa/mv-verbs.js    # verb surface area per chapter
>     playwright-cli -s=mv run-code --filename=qa/mv-condor2.js  # the flight, mounted, at a thermal (mv-condor.js = summon + board)
>     playwright-cli -s=mv run-code --filename=qa/mv-prof.js     # tick cost vs frame budget
>
> Results land in `qa/mv-*.json.png` (the sink's `.png` suffix is cosmetic).
>
> **The instrument caveat that nearly cost a finding.** A first frame-time sweep across all
> nineteen chapters in one session reported Kowloon at a 37 ms p50 and Venice at 27 ms, with
> spikes to 1.3 s. All of it was contamination — a loaded machine and three browser sessions.
> Re-measured on a clean load, one chapter per page load, the same chapters sit at 16.7 ms.
> See `capy3-instruments-that-cannot-hold-a-line`. The performance finding was withdrawn.

---

## What is already good, so it does not get touched

Worth stating, because four of the five rows below are small and it would be easy to read this
as a list of things that are wrong.

- **The turn has real weight.** A hard 90° at a full sprint costs 31% of the speed
  (7.40 → 5.10 m/s), settles in 12 frames, and takes about a metre of arc to re-establish
  the heading. A 45° weave costs 19% (7.40 → 6.00). That is a good curve: a lane change is
  nearly free and a hairpin is not.
- **The hop is identical in eighteen of nineteen chapters** — apex 1.37 m, 0.717 s of air,
  0.82 m on a tap rather than a hold. The nineteenth is the Drift at 4.51 m and 2.083 s,
  which is the third-gravity working. Consistency in the most-used verb is the right answer.
- **The condor's flight law is the best-simulated thing in the game.** Boarded, and held on a
  bearing to the nearest thermal, it climbed **+32.1 m in 60 s** in stable ~6 s orbits,
  airspeed cycling 9.9–17.3 m/s, no stall, no wing-drop, still mounted at the end. Rows 1–4
  of `qa/mv-condor2.json.png`. The phugoid the module's comments spent four paragraphs on is
  damped and behaving.
- **There is a whole frame of headroom.** On a clean load at 1280×720 on an Intel Arc 130V:
  `game.tick` — the solver, all nineteen module updates and the composite pass — runs at a
  **5.2–6.4 ms p50 and 7.7–8.8 ms p99** against a 16.7 ms budget, with the frame delta itself
  at 16.5–16.7 ms p50 in Sydney, Venice, Hong Kong and Manly. Roughly 2.5× spare. Anything
  proposed below is affordable.

---

## 1 · A SPRINT STOPS IN 0.185 m, AND THE CONSTANT THAT DOES IT IS NOT THE ONE NAMED FOR IT

**Measured, Sydney, full sprint, stick released:**

    frame 1   v 2.72 m/s   travelled 0.123 m
    frame 2   v 1.00 m/s   travelled 0.169 m
    frame 3   v 0.00 m/s   travelled 0.185 m

7.4 m/s to a dead stop in **three frames and eighteen centimetres**. The animal is 1.1 m long:
it stops inside a sixth of its own body length, at about 15 g. `tStop` reads 0.050 s in every
one of the eight chapters where the probe got a clean run (`qa/mv-feel.json.png`).

This is not a taste call — **the code does not do what its own comment says it does.**
`capybara.js:22-31` reads:

> *At `capySTOP_LAMBDA` it is enough to stop a run on flat ground but NOT enough to stand on
> Galeras… A stiffer damper **plus a snap-to-zero below walking pace** is static friction.*

That describes two bands. The implementation has one. `capySTOP_LAMBDA = 14` appears **nowhere
on the ground path** — its only two references in the file are the airborne bleed at
`capySTOP_LAMBDA * 0.15` (`capybara.js:2540-2541`). The ground branch runs `capyGRIP_LAMBDA`
— commented `// idle, grounded` — at **every speed**, so the number that exists to hold a
parked capybara on a volcano is also the number that stops a sprint.

**The fix is the design the comment already describes.** In the `else if (effGround)` branch,
pick the lambda by speed: `capySTOP_LAMBDA` above `capyGRIP_SNAP`, `capyGRIP_LAMBDA` below it.
Both existing behaviours survive untouched, because both live below walking pace —

- the Galeras fix: a parked animal on a 50° flank is at 0 m/s, so it gets the 60 and the snap;
- the anti-creep pin (`capyPinOn`, the 0.0226 m/s that walked Manly 13.36 m into the sea):
  fires inside the snap branch, which is unchanged.

At λ = 14 the same sprint settles over ~0.15 s and ~0.46 m — still snappy, but with a skid you
can see, land in, and lean out of. The pose rig already has the channels to sell it:
`capyPop` (squash), the `capy:land` dust event, and the bank at `capybara.js:3293`.

**Why it is first.** Stopping distance is the precondition for every other momentum idea. While
a run can be cancelled in three frames, speed is never a commitment and therefore never a
decision — which is the difference between a movement system and a locomotion system.

---

## 2 · HITTING A WALL AT FULL SPEED IS COMPLETELY SILENT

`qa/mv-bonk.js` sprints the capybara out on sixteen bearings from each spawn and catches every
run whose speed collapses while the stick is still hard over. Twelve impacts across Sydney,
Kyoto, Venice, Hong Kong and Monte Carlo; nine of them lost more than two-thirds of their speed
(Kyoto: **7.43 → 0.28 m/s** in one bearing). Wrapping `game.punch`, `game.shake` and `game.sfx`
for the two seconds around each one:

**Zero `punch()`. Zero `shake()`. No impact sound in any of the twelve.** The only thing the
game said was footsteps.

The cause is one line. `capybara.js:1532`:

```js
body.addEventListener('collide', function (e) {
  const other = e.body;
  if (!other || other.mass < 0.8) return;      // <-- static geometry is mass 0
```

Every collision with the world itself — a wall, a kerb, a parked bus, a torii leg, a
scaffold pole — is discarded before it is looked at. The listener is only ever a channel for
things hitting *you*.

This is not a gap in the presentation layer. Loose props are already handled well:
`physOnCollide` stamps a material voice out of a 38-type table and emits `prop:impact`, which
`systems.js:16212` turns into a spatialised thud plus a speed-scaled `punch()`. The static half
of the world was simply never wired into it.

**The fix is a second branch in the same listener**, roughly twenty lines and one file: above
about 4 m/s of closing speed on a mass-0 body, fire `game.punch()` scaled the way
`prop:impact` already scales it, a `thud` at the contact point, a negative `capyPop`, and a
small `capyShove` back off the wall. It costs nothing at a waddle because it is speed-gated,
and it lands in all nineteen chapters at once. Running into things is the most common physical
event in this game and it is currently the only one with no answer.

---

## 3 · THE VERB SURFACE IS BACK-LOADED, AND THE TWO NEWEST VERBS ARE ROUNDING ERRORS

`qa/mv-verbs.js` samples a 200 m × 200 m grid (41 × 41) about each spawn and asks the live
biome's own hooks what is available there. Percentages are of sampled cells.

| chapter | water | divable | slip > 0.2 | climb | published hooks |
|---|---|---|---|---|---|
| 1 sydney | 34.0 | **0.0** | 0.0 | 0.0 | — |
| 2 pasto | 0.0 | **0.0** | 0.0 | 0.0 | — |
| 3 quay | 75.8 | **0.0** | 0.0 | 0.0 | — |
| 4 kyoto | 17.7 | 6.7 | 0.0 | 0.0 | flow |
| 5 cali | 5.4 | 1.4 | 0.0 | 0.0 | — |
| 6 rio | 34.3 | 30.6 | 0.0 | 0.0 | flow, carry, localWater |
| 7 iceland | 31.6 | 29.3 | **0.0** | 0.0 | slip, carry, localWater |
| 8 sahara | 0.0 | **0.0** | **0.0** | 0.0 | slip |
| 9 drift | 93.9 | 0.0 | 0.0 | 0.0 | **wind**, airControl |
| 10 venice | 49.6 | 49.4 | 0.0 | 0.0 | — |
| 11 kowloon | 2.1 | 2.1 | 0.0 | **0.4** | climb, airControl |
| 12 palawan | 39.9 | 34.6 | 0.0 | 0.0 | canDive, carry, airControl |
| 13 goreme | 0.0 | 0.0 | 0.0 | **1.4** | climb, carry, airControl |
| 14 manly | 23.8 | 16.7 | 0.0 | 0.0 | flow, carry, localWater, canDive |
| 15 pantanal | 22.2 | 8.8 | 0.0 | 0.0 | flow, carry, airControl |
| 16 cave | 6.7 | 5.2 | 0.0 | **0.0** | climb, flow, carry, canDive |
| 17 antarctic | 53.3 | 45.9 | 3.3 | 0.0 | slip, airControl |
| 18 monaco | 53.1 | 51.5 | 0.0 | 0.0 | slip, carry, canDive |
| 19 hanoi | 12.7 | 11.4 | 15.1 | 0.0 | slip, carry, canDive |

Three readings.

**a) The first three hours are walk, hop and surface-swim.** Sydney, Pasto, Circular Quay and
Marrakech publish no movement hook at all beyond the terrain, and none of them has a single
divable cell — Sydney's harbour is 34% of the box and it is a flat plate over a collision
plane; the Quay is 75.8% water and none of it is anywhere to go. Four of the first eight
chapters ask for exactly two verbs. The vocabulary does not start growing until chapter 7.

**b) The climb is not a verb, it is three set pieces.** It is reachable on 0.4% of Hong Kong's
spawn box, 1.4% of Göreme's, and 0.0% of Sơn Đoòng's (the Great Wall is outside the sample —
which is itself the point). Three chapters of nineteen publish `climbHold`. Göreme's own
comment states the principle: *"a verb that appears once is a gimmick and a verb that comes
back is a vocabulary."* At three chapters and under 2% of the ground, it is still a gimmick.

**c) The same problem was already solved once, for the dive.** `capyCanDive` used to be
`!!api.canDive` in three chapters; it became a **measurement** — is there more than
`capyDIVE_MIN_D` of water under this point — and the table above shows the result: 30–52% of
six chapters, self-selecting almost exactly right. `capybara.js:911` calls this out as *"the
fourth time this codebase has replaced a list of biome names with the question the list was
standing in for."*

**`climbHold` is the fifth and has not had it.** The question the list stands in for is "is
there a vertical face within reach that is tall enough to be worth going up". A shared
`sharedClimbAnyFace(x, y, z)` in `shared.js` — a short outward ray fan against the live
biome's static colliders, returning the same `{nx, nz, top}` record the three bespoke
implementations already return — would let a chapter opt in with one line and no new geometry.
Venice's palazzo walls, Kyoto's torii legs, Rio's Selarón steps and Marrakech's souk walls are
all already built and already solid.

**And the wind is worse: one chapter of nineteen.** `wind()` is a reference frame — the
cleanest channel in the codebase, the one that made the ferry's deck, the Uji current and the
balloon basket all one idea — and only the Drift publishes it. `weather.js` already has a
global wind. Marrakech's sandstorm moves the animal through `capy.shove()`
(`sahara.js:4515`) rather than through the frame, which is the same effect built the other way,
and Antarctica and Manly have weather that does nothing to the animal at all.

---

## 4 · MOMENTUM SHOULD BUY SOMETHING (the payoff of row 1)

With a stopping distance in place, the sprint becomes a state you are *in* rather than a speed
you *have*, and there is currently nothing to spend it on. Two cheap things, both speed-gated
so they are invisible at a waddle and teach themselves the first time you sprint:

**The barge.** `physOnCollide` already contains exactly this idea for one prop type — a
capybara shoulder-barge above 3.5 m/s converts into an off-centre impulse so a bin actually
goes over (`props.js:2493`). Generalise it: closing speed above a threshold turns a
capy→prop contact into an off-centre impulse scaled by speed and the prop's own mass, with
`punch()` and the material voice already on the wire. A stall you have to *run at* is a
different verb from a stall you walk into and push.

**The long jump.** A hop carries whatever horizontal speed it had, so a sprinting hop already
travels 5.3 m against a walk's 3.0 m — but the apex and the airtime are identical (1.37 m,
0.717 s, measured in eighteen chapters). A sprint-gated flatter, longer arc — more horizontal
launch, slightly less height, on the same `capyJUMP_V` machinery — makes the run-up mean
something on a gap, which is a thing eight chapters already have and none of them ask for.

Both are additive, both are one file, both are affordable inside the 10 ms of measured
headroom. Neither should ship before row 1: a committed move on top of a three-frame stop
would just read as the controller sticking.

---

## 5 · THE BEST-PILOTED THING IN THE GAME IS USED ONCE, AND COSTS TEN SECONDS TO GET AT

Nineteen chapters contain **two genuinely piloted vehicles** — the Circular Quay ferry
(throttle + rudder, chapter 3) and the Antarctic zodiac (chapter 17) — plus **one mount** (the
condor, chapter 2) and **one half-vehicle** (the Göreme balloon, chapter 13, vertical only).
Everything else you can get on is a carrier: the bonde, the traghetto, the raft, the deck.
Chapters 4–12 and 14–16 contain nothing you drive.

The condor is 2,522 lines of real aerodynamics — lift proportional to airspeed squared, an
angle-of-attack elevator that is G-limited rather than angle-limited, induced drag, a
weathervane yaw, thermals as a rising airmass — and the measured flight confirms all of it
works (see the top of this document). Its own header says it is **already biome-neutral**:

> *Biome-neutral module: the condor exists only while Pasto is live, but it is owned here
> rather than by either biome set so the mount survives streaming.*

**Two opportunities, in cost order.**

**a) The approach is the weak part, not the flight.** Measured: `summon()`, then the bird
arrives high and circles, and it takes a **second whistle to lower it and about ten seconds of
standing still** before `talonInReach()` goes true. Ten seconds of waiting is a long time to
ask for before the best two minutes in the chapter, and it is the *only* thing between the
player and a system that is otherwise ready. A shorter high orbit, or a lowered orbit on the
first whistle once the bird has been ridden once, would cost almost nothing.

**b) A second flier is mostly content, not code.** The flight law does not know it is in Pasto.
The Drift already draws a skein over the void, Antarctica has the sky for it, and Rio has the
frigatebirds. One more chapter that ends in the air would do more for the shape of the journey
than any single task on the current backlog — and it is the one thing this codebase can build
cheaply that nothing else can.

The same argument applies half as strongly to the helm: `quay.js` and `antarctic.js` carry two
parallel implementations of the same idea (`quayHELM`/`antHELM`, `quayHELM_R`/`antHELM_R`, the
same boat-local→world transform written twice). A shared helm — throttle, rudder, rudder
authority gated on way-on, the camera hand-off — would make a third and fourth boat nearly
free, and would guarantee the two that exist feel like the same hands.

---

## Ranking

| # | row | confidence | cost | reach | state |
|---|---|---|---|---|---|
| 1 | the sprint has no stopping distance | **measured, root-caused** | one branch, one file | all 19 | **landed** |
| 2 | static impacts are silent | **measured 12/12** | ~20 lines, one file | all 19 | **landed** |
| 3 | the climb is three set pieces, the wind is one | **measured surface areas** | a shared helper + opt-ins | 16 chapters that have none | open — `qa/BATCH5.md` job 3 |
| 4 | momentum buys nothing | design, built on row 1 | one file each | all 19 | **landed** |
| 5 | one mount, two helms, nineteen chapters | measured flight + census | approach: small · a second flier: content | the shape of the journey | open, unscheduled |

Rows 1 and 2 are small, safe, root-caused and land everywhere. **Do those two first, together,
and re-measure the stop trace and the bonk log before anything else on this page is designed.**
That is what happened: 1, 2 and 4 went in together and the stop trace was re-measured
(0.185 m in 3 frames → 0.50 m in 9). See the correction at the top of this page.
