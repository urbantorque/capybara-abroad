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

### A1: the living, all of them

Crowds, animals and Hanoi's bikers get the same treatment. The bikers also
get continuous motion.

### A2: the weak places

Lift the flattest chapters by composition and colour: the lantern glow
discs, grey arcades, empty foregrounds.

### A3: mischief with consequences

A nemesis who notices, chases and can be escaped or out-foxed. Visible
"you did that" feedback, and trolls that pay off.

### A4: a reason to be here

A premise in the first minute, a goal the paper states plainly, and an
ending the goal points at.

### A5: clarity

One next thing at a time, in plain words.

### A6: the repository

Archive the closed roadmaps, and write a README that fits on a screen.

### A7: release

Run the full gates and browser checks, merge to `master`, push, and verify
Pages.
