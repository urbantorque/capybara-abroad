# Bodies audit — NPCs, props, carriers, world config (capy3, 4 Sep 2026)

Read-only. Code read via grep + sed; measurements via playwright-cli session `px2body` against
http://localhost:5188/. Rows are marked CONFIRMED (measured or read at the exact line) or
PLAUSIBLE (inferred from code, not measured). Written incrementally; sections fill in below.

## World config (props.js createPhysicsWorld ~L329-377, main.js L1902-2004)

Read at the line:
- `World({gravity -24})`, `SAPBroadphase` with `useBoundingBoxes = true`, `solver.iterations = 10`,
  `tolerance 0.002`, `allowSleep = true`, default friction 0.4 / restitution 0.12.
- Every ContactMaterial via `physPair`: `contactEquationStiffness 1e7`, `relaxation 3`.
  ground↔capy friction 0.00 (deliberate, documented at L342-364); ground↔npc 0.80; prop↔prop 0.30/0.40.
- `main.js L1902-1903`: `STEP = 1/60`, `MAX_SUBSTEPS = 5`; `L2003`: `world.step(STEP, dt, MAX_SUBSTEPS)`
  (cannon-owned accumulator, interpolation). Only one `world.step` caller in src (grep).
- `mainSaneWorld` (L1916+): NaN repair for every body incl. kinematic; `MAIN_V_CAP = 90` m/s clamp;
  dynamic bodies rolled back to previousPosition on NaN. Counter `state.solverSaves`.

| chapter | object | file:symbol | evidence | what is wrong | severity | fix sketch | effort h |
|---|---|---|---|---|---|---|---|
| all | world step | main.js:2003 | `step(1/60, dt, 5)` — fixed step, capped substeps | Nothing wrong with the step itself. Under a hitch > 83 ms the world runs slow rather than tunnelling (cannon clamps). CONFIRMED by read. | clean | — | — |
| all | kinematic velocity vs frame dt | every carrier `velocity = Δtarget/dt` (frame dt) + `position.set(target)` | cannon integrates kinematic bodies for `STEP` per substep, not for `dt`. At 60 Hz display the two agree; at 120/144 Hz frames alternate 0 and 1 substeps, so the integrated displacement per frame is 0 or ~2.4× the target delta. Carriers that ALSO write `position.set(target)` every frame are corrected each frame (position authoritative, velocity only read by the solver / platform frame) — harmless. Carriers that are VELOCITY-ONLY (no position write) accumulate a random-walk error at non-60 Hz refresh. See Carriers section for which. PLAUSIBLE (not measured; QA rig is 60 Hz). | low | none for the position-writing carriers; for velocity-only ones add the position write + syncBody | 0.5 each |


## NPCs (src/npc.js)

Body model, read at the line:
- Sydney/Pasto casts (`addBodyAt` L4541): mass 0, `KINEMATIC`, one Box (0.26, 0.8-0.85, 0.22), `allowSleep=false`,
  `userData.npc`. Per frame `stepHuman` L5134 / `paSyncBody` L7954: `velocity.set(move*speed)` THEN
  `npcPlaceBody(position)` — velocity for the solver, position for the truth; kinematic bodies integrate every
  step so `aabbNeedsUpdate` is raised (vendor/cannon-es.js L3932). `npcPlaceBody` L109 refuses to put an NPC body
  within `npcBODY_CLEAR` of the animal (drawn figure NOT moved — documented).
- Locals, chapters 2-19 (`addLocal` L1908): mass 0, NO type → cannon default STATIC, Box (0.26, 0.85, 0.24),
  `userData.local`. Moved by the shuffle / retrieval at L3789-3792 by writing `body.position.x/z` directly.
- Steering: `navBlocked` → `env.navBlocked` (static world only, L4276); walkers additionally avoid the animal
  (`npcBlockedFor` L4300) except in reach states; locals use a cannon ray (`localStepBlocked` L2925, mask 1,
  starts 1.2 m out so their own furniture is behind them).
- Barge: capybara.js emits `npc:barge`; npc.js L3112 answers with a flinch spring (`flV`) on locals or `alarm`
  on walkers. Nobody is displaced by the solver; a kinematic walker pushes the DYNAMIC animal instead.
- Water: `envOverWater` is only consulted in two places (grep count 2), both in Sydney-specific flee code; no
  generic "do not walk into water" gate in steering — chapters rely on navBlocked.

| chapter | object | file:symbol | evidence | what is wrong | severity | fix sketch | effort h |
|---|---|---|---|---|---|---|---|
| 3-19 | every local who has walked away from spawn | npc.js:1908 `addLocal` (no `type`), L3789-3792 shuffle/retrieval writes `body.position` | vendor/cannon-es.js: `aabbNeedsUpdate` is only raised inside `Body.integrate` (L3932) and `addShape`; `integrate` returns early for STATIC (L3892). SAP broadphase updates an AABB only when the flag is set (L5507). A STATIC body moved by a position write keeps its spawn AABB for ever. MEASURED: Hanoi local id948 in state `own` walked THROUGH the animal (minD 0.24 m, animal came out 0.88 m past the figure) while every stationary local stopped it at 0.60-0.92 m. Quay local 403 (shuffled 0.29 m) still blocked — the shuffle envelope is inside the old AABB. Retrieval goes up to 9 m (comment at L3753). | A local that has gone to fetch a prop is walk-through until they return; their spawn point keeps an invisible broadphase pair (harmless). CONFIRMED (code + walk probe) | medium | either make locals `type: KINEMATIC` with `allowSleep=false` (one line, then they integrate and their AABB refreshes — but then they will shove the animal like walkers do, so they also need the `npcPlaceBody` hold-off), or set `r.body.aabbNeedsUpdate = true` after the writes at L3790-3792 (one line, zero behaviour change) | 0.3 |
| 1 | tourists that flee | npc.js `npcPlaceBody` hold-off + `npcREACH_ST` | walk probe: tourist id108 went startled→flee; animal overlapped it (minD 0.38 m) and passed. Designed: the figure is not moved when the body is held off. | cosmetic brush-through during a flee; documented trade-off | clean/low | — | — |
| 1,2 | NPC-held props (owner-carried) | npc.js `spawnFor` L4563-4566 | kinematic + `collisionResponse=false`; sweep shows 5-6 Sydney bodies moving with velocity 0 every frame (ids 139,142-146) — these are the carried props, non-colliding | nothing wrong | clean | — | — |
