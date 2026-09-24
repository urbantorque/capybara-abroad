# ROADMAP-AAA — from a 7 to a 10

24 September 2026. The author handed over creative ownership with one brief:
cosy, fun, rewarding, beautiful, with a progression loop and a narrative.
Work autonomously, commit at milestones, push to `master` when done.

The author's notes, re-prioritised:

1. **Look.** The frame was milky and flat, people and animals were made of
   boxes, some places were weaker than others, and Hanoi's bikers looked
   bad and moved in steps.
2. **Fun.** The world reacts well, but mischief read as weather: nothing
   said "you did that", and nothing pushed back.
3. **Purpose.** Why the capybara is abroad, what it is for, and who is
   against it were not clear in play.
4. **Clarity.** The to-do paper and the directions said too much, in too
   many places at once.
5. **The repository.** Thirty roadmaps at the root, a README nobody could
   finish.

Every new visual term is a `game.state.noX` flag, measured on the reference
GPU (Arc 130V, headful Edge) with `qa/aaa-ab.mjs`. Every other law in
AGENTS.md stands.

## Milestones

### A0: light, hero, mischief, free roam, rounded people (shipped)

- `noAO` (half-res, normal-aware ambient occlusion), `noShadowLerp` (bilinear
  spiral shadow filter), `noFormShade` (turned-away faces take the chapter's
  shade level), `noNearClear` (the air fades in over 6–45 m). Together:
  0.65–1.33 ms GPU across six chapters. The darkest 2 % of the frame fell by
  1–7 levels.
- `noHero`: the capybara's belly occlusion, warm terminator and fur sheen.
  0–0.28 ms, which is noise.
- `noPuff2` (round, drifting dust), `noMischiefBeat` (punch plus a 40–50 ms
  freeze when the animal knocks something over), `noTake` (three strokes over
  the head of whoever jumped). Proven with real keys on a Sydney bin
  (qa/aaa-bin.mjs).
- **Free roam from a story file.** The title's second door says Free roam
  and opens all nineteen places; the file changes mode only when a place is
  chosen. qa/aaa-freeroam.mjs: 9 checks.
- `noPersonRound`: rounded twins of every roster, Pasto and local part —
  capsule limbs, tapered waist, rounded shoulders, flat faces kept. At most
  0.2 ms, which is noise.

### A1: the living, all of them (shipped)

Every roster, local, crowd, dog, llama and chapter animal now has a rounded
twin on `noPersonRound`. The big crowds in Rio and the Erg keep boxed bodies
for cost. `noBike2` is the redrawn Hanoi scooter: a seated rider, masks,
passengers, a lean into bends and suspension. The choppiness was measured:
the motion is exact and the frame pacing is not (see A7).

### A2: the weak places (partly shipped)

Göreme's square and bulbs (`noGorCalm`) and soft yuzu auras (`noAuraSoft`).
The Drift, the cave and Monte Carlo were looked at and left alone: they are
moody, not weak.

### A3: mischief with consequences (shipped)

- **A3a.** A march costs 1–3 yuzu, an escape pays 2, the marcher wears the
  take, and the chase pulse starts on setting off. Three bugs fixed.
- **A3b.** The takings: a pot on every carded chain, banked on a getaway and
  lost on a catch (`noTakings`).

### A4: a reason to be here (shipped)

The premise card (`noPremise`) and "N of 19 memories" on the paper. The
rival ibis, src/rival.js (`noRival`): it steals yuzu, and you catch it or
wheek at it. It is introduced with a camera shot the first time, and the
square comments on it.

### A5: clarity (shipped)

A one-line tab with an arrow and the verb. L opens the list. Modals no longer
reopen the sheet. Arrows are on by default (`ar2`), and the footer is in plain
words.

### A6: the repository (shipped)

docs/roadmaps/, docs/CONTRACT.md, docs/archive/, and a one-screen README.

### A7: release

Gates, browser checks, merge to `master`, push, and verify Pages.

Open, and said plainly:

- **Hanoi's frame.** Its world pass is 13 ms, spent on per-pixel grain()
  shading of the ground and shells, and frame pacing alternates between 10
  and 21 ms. A depth pre-pass or a far-field grain variant is the next lever;
  neither was attempted.
- **No human has played this pass.** Every check is a harness driver, not a
  novice.
