# CONTACT — everything the player touches

**Est. 6–9 h. Blocks 4, 5, 6. A commit at each boundary.**

Three things the player's hands are on: how the animal sits on the ground, and
the two families of drawn thing you can currently walk through.

**Block 4 must run after GROUND blocks 2 and 3.** It reads `terrainHeight` to
get its gradient, and tuning it in Manly against a law that is out by +1.29 m
means tuning it against a fiction. **Blocks 5 and 6 depend on nothing** — they
are the right filler if a GROUND block finishes early, and the right work for a
second session in parallel.

Read the shared preamble in `../SKILL.md` first — the aesthetic law, the ten
harness traps, the extents convention, the baseline table, and the five
conditions that make a block done.

---

# BLOCK 4 — THE ANIMAL ON THE HILL

**Est. 2–3 h.** ~45 min of maths, the rest damping and looking at it.

## The finding

This is the reported "sinking into the ground on elevation" and **it is not a
physics bug — the collider is fine.** The collider is a compound of three
spheres of r 0.34 at z −0.34, 0, +0.34, and it rests correctly on a slope.

The **model** is never pitched or rolled to the ground:

- `capybara.js:3518` — `capyModel.rotation.x` is a *speed lean*
  (`gaitSpeed * 0.013…0.030`), plus the loaf pitch.
- `capybara.js:3509` — `capyModel.rotation.z` is a *turn roll*
  (`capyYawRate * 0.075`), plus the idle roll.
- `capybara.js:3426` — `capyModel.position.y = -capyFOOT_Y + bob + …`, a
  constant 0.34 below the body centre.
- The legs (3362–3393) are pure sine animation with no per-foot ground probe.

Neither rotation reads the terrain. **Seventeen chapters publish `slopeAt()` and
it is read for walking speed only** (`capybara.js:2560`, Tobler's hiking
function). So the animal is held horizontal at a fixed foot height while the
ground under its nose and tail diverges.

Measured on an actual 26.1° Pasto hillside (`qa/rev-slope.json.png`): ground
under the centre 2.06, under the nose 1.80, under the tail 2.34 — **54 cm of
divergence across a 90 cm animal**, and the model flat through all of it.

```
% of walkable ground where nose or tail is off by...   >10 cm   >20 cm
antarctic                                                74.5     16.2
pasto                                                    57.1     49.3
rio                                                      53.8     30.4
monaco                                                   44.1     36.5
manly                                                    36.2     20.5
cali                                                     31.8     23.3
```

## The work

1. **Sample the ground around the body, not under it.** Four `terrainHeight`
   calls at ±0.45 m along the facing and ±0.30 m across it. That is four extra
   samples per frame on top of the two `capyGrade` already takes; the law is
   analytic and cheap, but if it measures, hoist and share them.
2. **Drive pitch and roll from the gradient, added to what is already there** —
   never in place of it. The speed lean and the turn roll are both tuned and
   shipped; this is a third term beside them.
3. **Lift the model origin by the uphill offset**, so the buried end comes out
   of the hill rather than the downhill end sinking into it. Sinking is the
   symptom that was reported; floating is the one that would be introduced by
   fixing it the lazy way.
4. **Damp it, and this is the part that will take the time.** An undamped read
   of a faceted heightfield twitches at every triangle edge. Use the same `damp`
   the neighbouring lines use; expect to tune the lambda per-feel, not per-number.
5. **Gate it off where something else already owns the pose:** swimming,
   diving, climbing, `carriedBy`, `atHelm`, and the loaf. Each of those already
   writes `capyModel.rotation`, and two writers on one channel is the trap this
   repo has hit before.
6. **A module-scope constant that disables it.** The one exception to this
   pass's no-flags rule (see `../SKILL.md`): this changes how the animal is
   drawn in all nineteen chapters at once, and it is the only change here that
   could be *disliked* rather than merely wrong.

## DONE, 28 Aug 2026 — and three things on this card were wrong

Corrected in `../SKILL.md`; read that section before block 5.

1. **The direction is backwards.** The animal FLOATS on a slope, it does not
   sink — the sphere chain rests on the uphill sphere, so the body centre sits
   high and the downhill feet hang. The lift term therefore DROPS the model.
   Only Pasto genuinely sinks, and that is block 3's drawn-above-collider
   finding, not the pose.
2. **`pose>10/>20` is a terrain-roughness column**, computed from
   `terrainHeight` alone with no reference to the model. Nothing in
   `capybara.js` can move it, so the second acceptance below is unachievable by
   construction. `qa/b4-pose.js` — the four drawn feet against the drawn ground
   — replaces it.
3. **A central difference is the wrong gradient estimator for a pose.** At a
   break of slope it averages the two sides and tips the animal into a drop it
   is standing on the lip of. See `capyPoseFit`.

Result: four-foot spread on sites where the law and the drawn ground agree,
0.40–0.44 m down to 0.02–0.05 m in seven chapters; Hanoi 0.396 → 0.105 and
Venice 0.053 → 0.065, both limited by law/mesh disagreement rather than by the
pose. Jitter measured as the second difference of the drawn rotation and held
inside the shipped turn roll's own noise. Flat chapters identical to 3 mrad.

## Acceptance as it was written

- The 26.1° Pasto hillside reads **under 8 cm** of nose/tail error, from 27.
- `qa/rev-world.js` `pose>20` column: **under 10% in all nineteen**, from a
  worst of 49.3.
- **No chapter has acquired a jitter.** This does not show in any number —
  screenshot Pasto, Antarctica, Rio and Monte Carlo on real slopes, standing and
  walking, before and after, and look at them.
- The flat chapters are untouched: Venice, Kowloon, Hanoi and Quay should be
  visually identical.

---

# BLOCK 5 — CLIFFS I

**Est. 2–3 h.** Mechanical, once the meshes are identified.

## The finding

`qa/audit-solid.js` finds 294 walk-through hits. **Most of the residue is
deliberate instanced vegetation** — Pasto's frailejones (29) and shrubs (22),
Cali's cane (33), Kyoto's bamboo (25), Sahara's thorn and horn scrub, Göreme's
vines. That is by design and was left deliberately by an earlier pass. **Leave
it alone.**

Separating landform from foliage leaves six chapters with **drawn terrain
features that have no collider** — the phasing that was actually reported. This
block takes the three biggest:

```
goreme    gorRidge 10, gorCliff 10, gorValley 5, +2 unnamed (7 and 5)   = 37
monaco    one 67 m mesh, bb x −198…−50, z −59…20                        = 11
sahara    a 33 m landform, bb x 193…282; plus a 13 k-tri mesh at spawn  = 14
```

Göreme is most of the work and most of the value: the ridge, the cliff and the
valley are the three things chapter 13 is made of.

## The work

Add static boxes the way each chapter already does — and **read the helper's
signature before every call.** The convention is per-file and it does not agree
(see `../SKILL.md`): `hx/hy/hz` is half extents, `sx/sy/sz` is full, and Göreme,
Manly and Kowloon carry an explicit `CONTRACT:` comment above their helper.

For a landform, a box is a poor fit and a chain of boxes along the ridge line is
the shape that works — the same thing `quayHEAD_TIER` does for the headlands,
where one constant is read by both the collider and `quayGroundY` so the two
cannot drift apart. Prefer that pattern to a hand-placed box list.

**Watch for the crown.** The harbour pass found that on every headland the
collider stopped at the cliff rim while the mesh carried a cap up to h × 1.20,
so the top of every hill was rock you stood inside. Check the tops.

## Acceptance

- `qa/audit-solid.js`: Göreme **under 12** (from 47), Monte Carlo **under 3**
  (from 13), Sahara **under 6** (from 32) — with the residue in each being
  foliage, confirmed by object name, not by the total.
- **This audit drifts between runs.** Judge by object identity: `gorRidge`,
  `gorCliff` and `gorValley` must be absent from the hit list. A total that went
  down while they are still present is not a pass.
- Walk each chapter's cliff line for 30 s and screenshot; nothing new blocks a
  path that used to be walkable.

---

# BLOCK 6 — CLIFFS II AND THE CROWDS

**Est. 2–3 h.** The enumeration is the block; the fix is the easy half.

## Part one — the remaining landforms

```
cali      three meshes incl. a 210 m riverbank at y −2…3    = 9
rio       the mountain backdrop, Sugarloaf, Corcovado       = 5
kyoto     a 36 m hillside, bb x −39…−2, z −114…−45          = 4
```

Rio's are the far backdrop and may be deliberately unreachable — **check whether
the player can get to them before collidering them.** A collider on scenery
nobody can touch is dead weight. If they are unreachable, say so and skip them;
that is a finding, not a failure.

## Part two — the crowds, and the trap in it

The **locals** rig is fine. `addLocal` (`npc.js:1297`) gives every registered
person a static box, and `localsStep` syncs all three of cannon's position
fields as they shuffle, so a person is solid where they are rather than where
they were. Measured: 6–13 solid local bodies per chapter. **Do not touch it.**

**Instanced background crowds are a different population and they are not
solid.** Sahara's are 170 figures at **16% solid** — a horizontal chest-height
ray finds a collider at 6 of 25 sampled instances.

**The trap, and this block is worthless if it falls into it:** the probe only
found Sahara because its mesh is named `sahPeople`. Every other chapter names
its crowd differently — the Quay has instanced commuters, Cali has dancers, Rio
has a bateria — and a name-matched search finds none of them.

**Enumerate first.** Walk every `InstancedMesh` in every chapter and classify by
**instance dimensions**, not by name: roughly person-sized (0.3–0.8 m wide,
1.4–2.0 m tall), standing on the ground. Write the list down in `qa/` so the
next pass does not have to re-derive it.

Then add bodies the way `addLocal` already does: a `CANNON.Box` of
`(0.26, 0.85, 0.24)`, mass 0, the `game.mats.npc` material, positioned at the
instance's world transform. If the crowd moves, sync all three position fields
or it is solid where it used to be.

**Budget check.** Sahara alone is 170 bodies. Across nineteen chapters this
could be a thousand static bodies; the solidity pass added ~180 with no
measurable cost, but this is five times that. State ms/tick before and after,
and if it costs more than 0.3 ms, make the bodies come and go with distance the
way the contact pool does.

## Acceptance

- The enumeration exists as a file in `qa/` and names every crowd mesh in every
  chapter, with counts.
- **Every crowd mesh over 90% solid** on the same chest-ray test — Sahara from
  16%.
- `qa/audit-solid.js`: Cali under 34 (residue = cane), Kyoto under 26 (residue =
  bamboo), Rio under 16 or a written note that its backdrop is unreachable.
- Frame time stated as a number, before and after.
- `qa/npchealth.js` no worse: the locals must still walk their shuffle. A new
  static body parked on a local's path is a person who stops moving.
