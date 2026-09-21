---
name: capy3-faces-and-bodies
description: "P5 — the cast got eyes, four builds and a child; the signs, the instancing trick, and the two things that were silently dead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T13:25:39.985Z
---

Batch P5 of `ROADMAP-POLISH.md`, 2 Sep 2026. Contract section
**FACES AND BODIES — P5**. The shelf batch the roadmap sized at ~10 h.

## THE FACE IS A MATRIX, WHICH IS WHY ONE FUNCTION DRIVES ALL THREE CASTS

`npcFace(f, mood, blink)` — a scale on the eye pair, a rotation and a
centimetre of lift on each brow. No geometry swap and no texture, so it costs
the same on a local's `Object3D` as on an instanced crowd's node. That is the
whole reason ~30 hand-built locals and 45 instanced people share one function.

**The signs are the load-bearing part.** A figure faces +z; `rotation.z` takes
+x toward +y. The left brow sits at x < 0, so its INNER end is its +x end and a
positive rz lifts it. Angry is inner-ends-DOWN, wide is inner-ends-up with the
pair raised. One sign wrong and a furious trader looks mildly delighted.

## TWO DRAW CALLS FOR THIRTY-TWO FACES

- Both eyes are ONE geometry — nothing in this game winks.
- Both brows are ONE buffer at **2N instances indexed `idx*2`** — the trick
  `pLlamaL` already used for four legs. A brow must rotate independently of its
  twin; a shared *geometry* cannot do that, a shared *buffer* can.
- A local is NOT instanced, so every box is a draw call: the eye pair is a
  merged geometry there too, 3 meshes per person rather than 4.

`f.upK` exists because a local's fringe sits 1.2 cm above their brow and the
roster's does not. Same lift, different heads.

## MOOD WAS ALREADY THERE AND WAS NEVER DRAWN ABOVE THE NECK

Crowds: `alarm` plus the state names. Locals: the flinch spring, the guard that
goes up when the square is hot, the retrieval errand, and **the huddle in the
rain at a third weight** — the one mood input in the game that has nothing to do
with the capybara. On fast (λ 15), off slow (λ 3.2): a symmetric damp reads as a
mask being swapped rather than as a person.

## A CHILD IS A BUILD, NOT A ROLE

One in seven TOURISTS. Everything a small person in a crowd needs already
exists; a state machine of its own would be nineteen behaviours to keep working
for one silhouette. `npcCHILD_HEAD 1.22` — **scaling a person down uniformly
makes a scale model of an adult, which reads as a distant adult**; the head is
the proportion that says how old somebody is. Excluded from the harbour plunge.

The nominal 1.72 m rig **measures ~1.60 m to the crown**: `npcCHILD_H 0.70` gave
a 1.00 m toddler, not the intended 1.20 m. Measure the drawn thing, not the
constant it was drawn to.

## FOUR THINGS THAT WERE SILENTLY WRONG

1. **`npc:startled` was a two-chapter feature.** Emitted by the Sydney roster
   and nothing else, so the capybara ear-turn it drives was dead in seventeen
   chapters. Now emitted from `localsReact` too — but **ONCE per bang**, for
   whoever jumped hardest: systems.js answers that event with a gasp, +0.06
   chaos and a 2.5 s chase window, so per-person would be five gasps and a third
   of the chaos bar for one crate. Same shape as [[capy3-record-spam]].
2. **The payload is `{ npc: rec }`,** not the rec — `emit()` wraps it. The
   existing `npc:chase` listener took the argument as the person and used none
   of it, so the shape was never wrong until something read it. See
   [[capy3-names-nothing-publishes]].
3. **A priority list with no priority in it.** The gaze's grabbable branch had
   no `!found` guard, so a new higher-priority entry was written and overwritten
   on the same call.
4. **Gait frequency used the `npcLEG_L` CONSTANT** while everybody is scaled.
   It is derived from stride precisely so feet do not ice-skate; with four
   builds it was wrong by up to a third. **And `paMove` also carries the llamas
   and the street dogs**, which have no build fields — undefined does not throw,
   it makes stride NaN, `NaN > 0.02` is false, and both species silently fall
   through to the idle 0.4 rad/s. Default it (`rec.bLeg || 1`).

## PROBE LESSONS

- **A wheek does NOT make a local flinch.** `localsSay()` gives them a line;
  `localsReact()` kicks the spring. Two different reactions, and asserting on
  the wrong one measured the feature as dead.
- **A bare velocity write is fought by the movement system** — 3.6 m/s against
  the 6.2 that `npcLOC_RUSH_V` calls belting past. Held keys reached 7.4. But
  the closed loop still never got inside 13 m (the local is across a canal), so
  the spring was kicked directly instead: that isolates *does `r.fl` reach the
  face* from *can a player belt past a Venetian*.
- **`toDataURL` must be in the SAME `page.evaluate` as the render.** A
  `page.evaluate` boundary loses the drawing buffer; the first run posted a
  sheet of white.
- **The mean of a crowd is not in the crowd** ([[capy3-spawn-rings-and-frontage]]
  again) — and the densest neighbourhood put the camera inside the café wall.
  Render eight bearings and post all of them; it is cheaper than guessing.
- `renderer.info` read from outside the loop reports **the composite pass**: 1
  call, 1 triangle. Read it in the same evaluate as your own scene render.
- Picker keys: sydney 1, **pasto 2**, quay 3, kyoto 4. Trap 15, hit again.

## COST, PAIRED A/B, EIGHT BEARINGS

Sydney +7.8 draw calls and +1 586 triangles; Venice +16.0 and +233; Sahara
+18.5 and +264. Scene mesh deltas exactly predicted (3 per local + 6 whiskers).
Frame time on the 16.6 ms vsync cap both ways.

Not landed: children in Rio and Manly — those casts are hand-placed locals, so
a child there is a placement and a script decision per person, not a build.

Related: [[capy3-the-punctuation]], [[capy3-the-locals]],
[[capy3-sounds-people-make]], [[capy3-render-pose-heuristics]],
[[capy3-springs-are-clipped]], [[headless-qa-harness]]
