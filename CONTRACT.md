# CAPYBARA SYDNEY — LOCKED MODULE CONTRACT v1

**Do not deviate.** Every developer agent writes exactly ONE file. Any change to this contract
must be requested from the Coordinator, not made unilaterally.

## Aesthetic law (Untitled Goose Game benchmark)

- Low-poly. Every mesh is built from `BoxGeometry`, `CylinderGeometry`, `SphereGeometry`
  (low segment counts: sphere `<= 8x6`, cylinder `<= 8`), `ConeGeometry`, `TetrahedronGeometry`,
  `LatheGeometry`, `ExtrudeGeometry`, or hand-authored `BufferGeometry`. **No textures. No image files.**
- Materials: `MeshLambertMaterial` with `flatShading: true` ONLY (use `mat()` from shared.js).
  No PBR, no metalness/roughness, no env maps, no normal maps.
- Colours come from `PALETTE` in `shared.js`. Never hardcode a hex outside shared.js.
  Palette is flat + pastel + sun-bleached Australian: soft yellows, sage greens, chalk whites,
  dusty terracotta, pale harbour blue. No saturated primaries, no black outlines, no neon.
- Silhouette-first: shapes must be readable from the fixed ~35° overhead-behind camera.
- Whimsy > realism. Slightly oversized props, chunky proportions, exaggerated reactions.
- **There is a composite pass now** (bloom, grade, vignette) and a procedural
  world-space `grain()` on the big surfaces. Neither is a texture and neither
  touches the law above; see **THE PICTURE** further down before adding either.

## Runtime & imports (bundler-critical — obey exactly)

Each module file may contain imports ONLY in these exact forms, ONLY at the very top:

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, TASKS, rand, randInt, clamp, damp, lerp } from './shared.js';
```

- Export ONLY via `export function name(...)`. No default exports, no `export const`, no classes.
- **Every internal helper function/const at module top-level MUST be prefixed with your module tag**
  (`env`, `capy`, `phys`, `npc`, `sys`) e.g. `function envMakeTree()`, `const envTREE_COLORS = ...`.
  The bundler concatenates all modules into one scope — unprefixed top-level names WILL collide.
- No `await` at top level. No dynamic `import()`. No `fetch`. No external assets of any kind.

## The `game` object (single source of truth, created in main.js)

```js
game = {
  THREE, CANNON,
  scene, camera, renderer, world,   // world = CANNON.World
  clock,
  events,        // { on(name, fn), off(name, fn), emit(name, payload) }
  input,         // written by systems.js, read by capybara.js — see below
  state,         // { time, dt, paused, started, score, chaos, heat, heatN }
  npcHeat(x, z, r),        // people near a point watching FOR you — npc.js, live-gated
  placeHeat(x, z),         // how cross the PLACE is, 0..1 — the v33 accumulator
  forceHeat(v),            // TEST HOOK: pin the field (-1 releases). Never a verb.
  mats,          // cannon contact materials: { ground, prop, capy, npc }
  props: [],     // interactive prop records — populated by props.js
  npcs:  [],     // npc records — populated by npc.js
  capy:  null,   // set by capybara.js
  env:   null,   // set by environment.js
  weather: null, // set by weather.js — see THE GLOBAL ENVIRONMENT
  physics: null, // set by props.js
  hud: null,     // set by systems.js
  completeTask(id),        // provided by main.js -> systems
  toast(text),             // provided by main.js -> systems, floating message
  shake(amount),           // provided by main.js -> systems, camera shake 0..1
  sfx(name, opts),         // provided by main.js -> systems ('wheek','thud','splash','gasp','pop','rustle','whistle')
  registerShadowTarget(o3d)
}
```

## THE FOUR CHANNELS OF "THAT LANDED" (v16 — the global core pass, 23 Aug 2026)

Four things a biome may now ask for that did not exist before. Every one of them
is **additive**: a chapter that asks for none of them behaves exactly as it did.

```js
game.punch(a)                 // shake + lens kick + freeze + rumble, one call
game.hitstop(dur, scale)      // a near-freeze. Instant on, instant off.
game.slowmo(scale, dur)       // a held beat. Eased. `wow` only — see below.
game.sfx(name, { at: pos })   // ...and the sound comes from where it happened
```

**`game.punch(a)` is the one to reach for.** `a` is the SAME 0..1 magnitude
`game.shake(a)` already takes, so a call site moves over by changing four
letters and nothing needs re-tuning. It fires all four channels at once and
each has its own floor, so a small event is only a shake and a big one is
everything.

**Do not call `slowmo()` from a biome.** It is paid out by `completeTask` on a
`wow` row and nowhere else, for exactly the reason the banner is: seventeen rows
in ninety-odd carry the flag, and a second caller halves what the first is
worth. If a new set piece deserves it, MOVE the flag.

**Nothing needs to opt into slow motion.** `game.state.dt` is the scaled frame
time and every `update(dt)` already reads the dt it is handed, so the solver,
the gait, the crowd, the wind, the tide and the score all slow together.
`game.state.rawDt` is the wall clock if you genuinely must not.
`game.time.scale` is the ratio; `game.time.slow` is the slow-motion component
with the freeze taken out — **presentation must read `slow`, never `scale`**, or
a 55 ms hitstop reads as a dropped frame.

Time stands down entirely while paused and under `prefers-reduced-motion`, and
is cleared on `biome:enter`. So does `shake()`.

### THE SOUND COMES FROM SOMEWHERE (v16)

`game.sfx(name, opts)` takes an optional position — `{ at: body.position }`, or
a bare `{ x, y, z }`, plus optional `near` and `far` in metres. It is attenuated
on one inverse-distance law with a taper into a 140 m far plane, and panned
against the camera's own right vector. **A call with no position is untouched**:
mono, full level, exactly as all 290 of them behaved before.

Do not hand-roll `clamp(0.30 - far * 0.0026, ...)` any more. There were three
different such laws in the biome files and none of them panned.

`game.hud.audioProbe(x, y, z)` answers what the mix would do with a sound there.

### A PROP SOUNDS LIKE WHAT IT IS MADE OF (v16, props.js owns)

`prop:impact` carries three more optional fields — `voice`, `vpitch`, `vgain` —
stamped from `physVOICE`/`physMAT`. A listener that ignores them reads `prop`,
`speed` and `position` as it always did. A prop type with no material row falls
back on its **density**, so a new type gets a plausible voice rather than
silently rejoining the thuds.

### THE PAD (v16, systems.js owns)

Polled into `game.input`; no reader changes. Left stick and d-pad move, right
stick looks and zooms and clicks to recentre, RT/L3/full deflection run, A hops,
X or LT grabs, B or Y wheeks, Start opens the journal, Back hides the paper.
Its press edges are published at the very END of `update()`, after the clear —
a polled press latched at the top would be wiped on the same frame.

### RELIEF IS NOT A LIST OF CHAPTERS (v16)

Camera terrain clearance and the shadow box's altitude used to be gated on
`inPasto || inKyoto || inCali || inRio`. **Never add a rung to a list like
that.** The question is `sysHasRelief()` — does the live biome answer
`terrainHeight` — and sixteen of seventeen do.

`game.input` (read-only for everyone but systems.js):
```js
{ x: -1..1, z: -1..1,   // desired move on camera-relative axes
  run: bool,            // shift held
  action: bool,         // E / left-click held (grab)
  actionPressed: bool,  // true for exactly one frame on press
  honk: bool,           // space held
  honkPressed: bool,    // true for exactly one frame on press
  camYaw: number }      // radians, camera orbit yaw, owned by systems
```

## Events bus (exact names)

Emitted by capybara.js: `capy:wheek {position}`, `capy:grab {prop}`, `capy:drop {prop}`,
`capy:move {position, speed}`, `capy:dig {position}`
Emitted by props.js: `prop:impact {prop, speed, position}`, `prop:water {prop}`, `prop:destroy {prop}`
Emitted by npc.js: `npc:startled {npc}`, `npc:chase {npc}`, `npc:photo {npc}`, `npc:calm {npc}`
Anyone: `task:complete {id}`, `hud:toast {text}`

## World layout (metres, Y-up, all modules must agree)

| Feature | Region |
|---|---|
| Ground (walkable) | x ∈ [-70, 70], z ∈ [-10, 70], y = 0 |
| Harbour water | z < -10, water surface y = -0.5 |
| Sea wall / quay edge | z = -10 |
| Opera House | centred (0, 0, -4), sails face north (-z), sandstone podium 26×16, steps z: +6 → 0 |
| Royal Botanic Gardens | x ∈ [14, 62], z ∈ [4, 58] — lawns, flower beds, hedges, pond, gardener |
| Promenade / coast | x ∈ [-62, -14] — sand, deck chairs, seawall, tourists |
| Picnic lawn | around (30, 0, 26) |
| Distant Harbour Bridge (decor, no collision) | around (-34, 0, -62) |
| Capybara spawn | (0, 1.2, 22) |
| Camera | follows capy, ~35° down, distance ~14 |

Terrain is **flat at y = 0** for physics. Visual ground may undulate by at most ±0.12.

`game.env` (published by environment.js):
```js
{
  waterLevel: -0.5, waterEdgeZ: -10,
  isOverWater(x, z) -> bool,
  inZone(name, x, z) -> bool,   // 'operaStage' | 'gardens' | 'flowerbed' | 'promenade' | 'picnic'
  zones: { ... plain {x0,z0,x1,z1} rects ... },
  navBlocked(x, z, radius) -> bool,   // static obstacles, for NPC steering
  randomPointIn(name) -> {x, z},
  update(dt)
}
```

## Prop record shape (props.js owns; everyone else reads)

```js
{ id, type, name,        // type: 'hat'|'coffee'|'sandwich'|'ball'|'bin'|'deckchair'|'flower'|
                         //       'esky'|'thong'|'frisbee'|'basket'|'cone'|'handbag'|'icecream'|'sign'|'towel'
  mesh, body,            // THREE.Object3D + CANNON.Body
  grabbable: bool, mass,
  holdOffset: THREE.Vector3,   // local offset when in capy's mouth
  owner: npc|null,       // set by npc.js when a tourist carries it
  held: bool,
  spilled: bool }        // for coffee/icecream
```

`game.physics` (published by props.js):
```js
{
  grab(prop) -> bool,       // attach prop to capy mouth anchor, sets held=true
  release(impulseVec3|null) -> void,  // drop/throw whatever is held
  nearestGrabbable(pos, radius) -> prop|null,
  spawnProp(type, x, z) -> prop,
  removeProp(prop),
  update(dt)
}
```

## Capybara (capybara.js) publishes `game.capy`

```js
{
  group,        // THREE.Group (root)
  body,         // CANNON.Body (capsule-ish: sphere-compound), mass 30
  mouthAnchor,  // THREE.Object3D on the head, world-positioned each frame
  position,     // THREE.Vector3 mirror, updated every frame
  velocity,     // THREE.Vector3 mirror
  heldProp,     // prop|null
  grounded,     // bool
  wet,          // 0..1
  isRunning,    // bool
  update(dt)
}
```

## NPC record shape (npc.js owns)

```js
{ id, kind: 'tourist'|'gardener'|'jogger'|'ibis',
  group, body, state, alarm: 0..1, target, heldProp, speak(text), update(dt) }
```

## Rendering physics transforms — INTERPOLATION IS MANDATORY (v2)

main.js drives cannon with `world.step(1/60, dt, 5)`. cannon-es therefore maintains, for every
body, `body.interpolatedPosition` and `body.interpolatedQuaternion` — the transform at the
*display* time, not at the last completed physics tick.

**Every mesh sync must read `body.interpolatedPosition` / `body.interpolatedQuaternion`.**
Reading `body.position` / `body.quaternion` for rendering pins visuals to a hard 60Hz ladder
and is the reason motion looked jerky. Use `body.position` only for gameplay logic (distance
tests, zone tests, spawn placement, task causation).

Exceptions, which must set the interpolated fields explicitly after moving a body:
- Bodies you teleport or drive kinematically by writing `body.position` directly. After the
  write, also `body.previousPosition.copy(body.position)` and
  `body.interpolatedPosition.copy(body.position)` (same for the quaternion), otherwise the
  renderer will lerp from a stale origin and the object will visibly smear.

## Chapters (v3)

`TASKS` in shared.js now carries a `chapter` field, and shared.js exports `tasksInChapter(n)`.
Chapter 1 (the original 12) is visible from the start. Chapter 2 — the Circular Quay set — is
hidden until every chapter-1 task is done, at which point systems.js reveals it with a beat of
ceremony. `game.completeTask(id)` stays idempotent and chapter-agnostic: any module may complete
any task at any time, and the end-of-game flourish fires only when ALL tasks across every
chapter are done.

Chapter 2 world content lives at Circular Quay, WEST of the Opera House podium
(roughly x -46..-14, z -10..10), built around the existing ferry wharf.

## Chapter 3 — Pasto, Nariño (v4)

A second biome. **Authored in the same world coordinates as Sydney** — only one biome is
ever attached to the scene and the physics world at a time, so they can never overlap.
Do not offset Pasto geometry.

### Biome streaming — `game.biome` (main.js owns)

```js
{
  current: 'sydney' | 'pasto',
  SYDNEY_SPAWN: {x,y,z}, PASTO_SPAWN: {x,y,z},
  isActive(name) -> bool,
  switchTo(name) -> bool,          // detach current, lazily build + attach target, emits 'biome:enter'
  register(name, {ensureBuilt, onEnter, onExit}),
  capture(name, fn),               // run fn with everything it adds tagged to `name`
  claim(name, object3dOrBody),     // manual tagging escape hatch
}
```

Ownership is captured automatically by intercepting `scene.add` and `world.addBody`.
**Anything a module adds at runtime is tagged with the live biome** — props spawned in
Pasto belong to Pasto, NPCs spawned in Sydney belong to Sydney. You do not need to call
`claim()` unless you build a body without `world.addBody` or parent a root outside `scene.add`.

Detach = `visible=false` on scene roots (zero draw calls, geometry stays resident so
re-entry is instant) + `world.removeBody` for every body (zero broadphase/solver cost).

**Every module's `update(dt)` must early-out when its biome is not live.** environment.js,
props.js and npc.js must skip Sydney logic when `!game.biome.isActive('sydney')`; pasto.js
and condor.js must skip when `!game.biome.isActive('pasto')`.

Event: `biome:enter {name, from}`.

### Pasto world layout (metres, Y-up)

| Feature | Region |
|---|---|
| Valley floor (walkable) | x ∈ [-110, 110], z ∈ [-110, 110] |
| Plaza de Nariño (cobbles, flat y=0) | x ∈ [-24, 24], z ∈ [8, 46] |
| Church (colonial, bell tower) | centred (0, 0, 44), faces south (+z) |
| Market stalls | ring the plaza, x ∈ [-26, 26], z ∈ [10, 30] |
| Colonial street / balconied houses | x ∈ [-34, 34], z ∈ [46, 62] |
| Coffee farm terraces | x ∈ [30, 90], z ∈ [-20, 30] |
| Galeras volcano | centred (-40, 0, -70), base radius ~70, summit y ≈ 62, crater rim radius ~11 |
| Páramo / frailejón slopes | the volcano flanks above y ≈ 22 |
| Capybara spawn | (0, 1.4, 26) — middle of the plaza |

Pasto terrain is **not** flat: `game.pasto.terrainHeight(x, z) -> y` is the authority and
must be cheap (no raycasts). Physics uses a `CANNON.Heightfield` for the volcano and a
plane for the valley floor. NPCs and props read `terrainHeight` for placement and steering.

`game.pasto` (published by pasto.js):
```js
{
  built() -> bool,
  terrainHeight(x, z) -> y,
  inZone(name, x, z) -> bool,      // 'plaza' | 'market' | 'church' | 'coffee' | 'paramo' | 'crater'
  navBlocked(x, z, radius) -> bool,
  randomPointIn(name) -> {x, z},
  thermals: [ {x, z, radius, strength, top} ],   // read by condor.js
  craterCentre: THREE.Vector3,
  update(dt)
}
```

### Condor (condor.js) publishes `game.condor`

```js
{
  active,        // in the world right now
  mounted,       // capybara is hanging off the talons
  state,         // 'gone'|'inbound'|'circling'|'carrying'|'leaving'
  group, body,   // THREE.Group + CANNON.Body
  talonAnchor,   // THREE.Object3D the capy hangs from
  summon(),      // called on whistle
  update(dt)
}
```

**Flight is physics, never rails.** Gravity always pulls. Lift is a function of airspeed
(`lift ∝ v²`, applied along the wing normal), banking comes from a roll impulse, and
altitude is bought only by (a) trading speed for height or (b) flying through a thermal
column. Thermal columns are volumetric triggers listed in `game.pasto.thermals` that apply
an upward force falling off with radius and capped at `top`. No `position.y = f(t)`.

Mount = a `CANNON.PointToPointConstraint` (or `LockConstraint`) between the condor body and
the capybara body at `talonAnchor`. Releasing removes the constraint and leaves the capybara
with the condor's velocity — the drop is the joke, do not damp it.

### Input (systems.js owns) — v8, ONE VOICE

The wheek and the whistle were two keys for one act. They are now the same button and the
CONTEXT decides what the noise means. `game.input.whistle` / `whistlePressed` remain as
ALIASES of `honk` / `honkPressed` so existing readers are unchanged; do not bind them to a
separate key again.

| logical input | key | notes |
|---|---|---|
| `honk` / `whistle` | **Q** | wheek, condor call, ferry horn, condor flap, and the three-call exit |
| `action` | **E**, `Numpad0`, left click | grab / dig / mount / helm. Also the ONLY condor dismount — the voice key flaps, so dismounting on it would drop the passenger every flap |
| `jump` | **Space** | |
| camera yaw | **Z** / **X**, right-drag | `Q`/`R` are free again |

Every edge flag is latched at the event source (systems.js runs LAST) and cleared at the very
end of the frame.

### Stamina (capybara.js owns, systems.js draws)

`game.capy.stamina` (0..1) and `game.capy.blown` (bool). Drains only while the player is
ASKING to run — intent, not resulting speed, so sprinting into a wall still costs. A hop costs
`capySTAM_HOP`. Swimming, the helm and the condor's talons are free. At zero the animal is
blown: walk only, no hops, and it stays blown until `capySTAM_RECOVER` is back, so there is no
stutter-sprinting. Anything that wants to gate on exhaustion reads these two fields; nothing
else may write them.

## Chapter 3 — Sydney Harbour (v5)

A third biome, `quay`, in the same world coordinates. `src/quay.js`, prefix `quay`,
`export function createQuay(game)`. Circular Quay's apron and three finger wharves sit at
z ∈ [16, 44]; the fairway runs north to Manly at (118, -556); the Harbour Bridge spans the
fairway at z = -58.

```js
game.quay = {
  built(), waterLevel, isOverWater(x,z), waterHeightAt(x,z), inZone(name,x,z),
  SPAWN, MANLY, lanterns?,          // MANLY is the wharf head
  boat: { position, helm, speed, heading, rudder, throttle, maxSpeed, atHelm },
  voyageProgress() -> 0..1, arrived() -> bool,
  update(dt),
}
```

`game.state.sailing` is true exactly while the capybara is at the wheel. systems.js reads it
for the camera rig (a longer, flatter boom) and for the music palette; capybara.js reads
`game.capy.atHelm` and hands the body over to quay.js entirely for that frame.

The boat is a **kinematic body driven by velocity**. Every write of `body.position` is followed
by the previous/interpolated copy (contract, "Rendering physics transforms"); the velocity is
kept accurate so capybara.js can solve in the deck's frame.

## Chapter 4 — Kyoto & Uji (v5)

A fourth biome, `kyoto`. `src/kyoto.js`, prefix `kyo`, `export function createKyoto(game)`.
Not flat: `game.kyoto.terrainHeight(x, z)` is the authority, analytic and cheap, matched by a
CANNON `Heightfield`.

```js
game.kyoto = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel, isOverWater(x,z), waterHeightAt(x,z), inZone(name,x,z),
  SPAWN, toriiStart, toriiNext(), toriiProgress(),
  pond, zen, bamboo, uji, bowl, matchaHeap, lanterns,
  update(dt),
}
```

## WHOSE WATER, WHOSE GROUND (v5 — this bit is load-bearing)

`game.env` is SYDNEY'S and stays resident when Sydney is detached. Asking it about the harbour
while standing on a volcano answers "yes, water, z is less than -10". Any module that needs to
know whether there is water underfoot, or how high the ground is, must ask the **live** biome:

- capybara.js: `capyWater(game)` and `capyGroundY(game, x, z)`
- systems.js: `sysGroundY(x, z)`

A new biome publishes `waterLevel` / `isOverWater(x, z)` and, if it has relief,
`terrainHeight(x, z)`; those three names are the whole interface. Chapter 9 adds two more
optional ones on the same rule — `wind()` and `airControl` — and they are asked of the LIVE
biome and nobody else, for the same reason: `game.drift` stays resident when the Drift is
detached, and a thirty-eight-second gale still blowing across the Botanic Gardens would be a
very hard bug to find.

## Chapter 5 — Cali (v6)

A fifth biome, `cali`. `src/cali.js`, prefix `cali`, `export function createCali(game)`.
Not flat: `game.cali.terrainHeight(x, z)` is the authority, matched by a CANNON `Heightfield`.
Publishes the same three water/ground names every biome does, plus the dance state:

```js
game.cali = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel, isOverWater(x,z), waterHeightAt(x,z), inZone(name,x,z),
  SPAWN, gato, ermita, lulada, chiva, floor, cristo, cane,
  combo(), comboTarget, onFloor(),
  update(dt),
}
```

## Chapter 6 — Rio de Janeiro (v7)

A sixth biome, `rio`. `src/rio.js`, prefix `rio`, `export function createRio(game)`.
Not flat: `game.rio.terrainHeight(x, z)` is the authority, matched by a CANNON `Heightfield`.
Publishes the same three water/ground names every biome does, plus the parade state:

```js
game.rio = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel, isOverWater(x,z), waterHeightAt(x,z), inZone(name,x,z),
  SPAWN, globo, volei, arpoadorRock, sugarloaf, station, selaron, lapa, corcovado,
  column(), columnX(),          // the desfile MOVES — ask, never cache
  combo(), comboTarget, inColumn(), riding(), cabin(),
  update(dt),
}
```

### The samba is not the salsa

Cali's floor is a circle you stand in and any beat scores. Rio inverts both halves, and the
inversion IS the chapter — without it this is chapter 5 in a hat:

- **The scoring zone moves.** A desfile is a column going somewhere. `rioInCol()` is measured
  against where the bateria is *this frame*; the combo lapses if you fall out of it.
- **Only the two counts.** Samba is in 2/4 and the surdo de marcacao lands on beat two.
  Hitting the one is not a near miss — it breaks the run, and says so.

systems.js schedules the bateria as `band: 'samba'` (palette 6): a 2/4 bar of eight sixteenths
at 132 bpm, anchored on a downbeat, with `musBeatLen` set to HALF a bar. `game.music.beats()`
therefore counts one, two, one, two — and **odd beats are the surdo**. rio.js scores exactly
that parity. Do not renumber it.

Note that `game.music.beatInBar()` assumes 4/4 and is meaningless under the samba palette; use
`beats()` parity instead.

### TERRAIN COLLISION — WHICH WAY THE SECOND AXIS RUNS (v7)

A CANNON `Heightfield` is authored in its own xy plane with height along local z. The rotation
that stands it up as a floor, `Rx(-90 deg)`, maps its local **+y onto world MINUS z**. So

```js
data[i][j] = terrain(X0 + i * EL, Z0 + j * EL);  b.position.set(X0, 0, Z0);   // WRONG
data[i][j] = terrain(X0 + i * EL, Z1 - j * EL);  b.position.set(X0, 0, Z1);   // right
```

The wrong form does not cover z0..z1 at all — it covers z0 and everything *behind* it, leaving
the biome with no collision floor. **This is nearly invisible from the capybara**, because
capybara.js carries its own analytic ground backstop (`capyGroundY`) and will walk on terrain
the solver knows nothing about. It shows up the moment anything else dynamic is added.

Sample it fine enough, too: at 13 m cells the solver's floor sat metres away from the drawn one
on anything with relief. Rio uses 5 m.

### SIZES: THE MERGER TAKES FULL EXTENTS, CANNON TAKES HALF (v7)

`rioMerger().box(cx,cy,cz, sx,sy,sz)` scales a **unit** cube, so `sx` is the FULL width.
`CANNON.Box` takes **half** extents. Mixing them silently builds a world where the visible
thing and the solid thing are a factor of two apart — Rio's parade avenue was half its intended
width and the bateria marched off the edge of its own road. Keep one convention per file and
make the collision helper speak the same language as the geometry helper.

## Chapter 7 — Iceland (v8)

A seventh biome, `iceland`. `src/iceland.js`, prefix `ice`, `export function createIceland(game)`.
Not flat: `game.iceland.terrainHeight(x, z)` is the authority, matched by a CANNON `Heightfield`
sampled at 5 m. Publishes the three water/ground names every biome does, plus:

```js
game.iceland = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  groundSlip(x,z),                 // 0..1 — SEE BELOW. The one new verb in seven chapters.
  waterLevel, isOverWater(x,z), waterHeightAt(x,z), inZone(name,x,z),
  SPAWN, pylsa, organ, church, strokkur, spring, cliff, pier, glacierTop,
  aurora(),                        // 0..1 — systems.js grows the score a choir on it
  skyward(),                       // 0..1 — how far the camera rig should crane UP
  soak(), soakSeconds, sliding(), geyserPhase(), geyserSwelling(),
  update(dt),
}
```

### SLIP — when the ground stops holding you

A biome may publish `groundSlip(x, z) -> 0..1`. capybara.js asks the LIVE biome every frame
(`capySlipAt`) and blends four things against it: the idle grip damper, the steering authority,
the speed ceiling and how gently the ceiling is enforced.

**Slip is linear in the resulting TERMINAL VELOCITY, not in the damper.** Gravity supplies a
constant downhill acceleration `a`; the damper removes `L` times the current speed; they
balance at `v = a/L`. So the player-facing quantity is `1/L`, and interpolating `L` is
interpolating the wrong end of a reciprocal — `grip x (1 - slip)` at slip 0.5 leaves L = 30 and
a terminal velocity of 0.3 m/s, and at 0.97 leaves 4.8 m/s. Both were measured; the first cut of
the glacier was a slightly downhill walk. Interpolate `1/L`:

```js
const grip = 1 / lerp(1 / capyGRIP_LAMBDA, 1 / capyGRIP_ICE, slip);
```

The forward force is untouched and does not need to be: the ground contact is already
frictionless, so on a slope the contact normal alone accelerates the body downhill. **Removing
the damper IS the mechanic.** The steering target speed must rise with the ceiling, or pressing
forward down a glacier is a hard brake.

### `skyward()` — the rig may be asked to look up

At the standard 41-degree pitch and a 48-degree vertical FOV the top of the frame points 17
degrees BELOW horizontal: **the sky is never in the picture.** That is fine for seven biomes and
fatal for one whose payoff is a hundred metres up. A biome may publish `skyward() -> 0..1`;
systems.js blends the rig toward `sysSKY_PITCH` (11 degrees) and `sysSKY_DIST` over ~3 s, and
raises the look-at with it. It is not blended against the flight or helm rigs — those already
own the camera.

## Chapter 8 — Marrakech & the Erg (v8)

An eighth biome, `sahara`. `src/sahara.js`, prefix `sah`, `export function createSahara(game)`.

```js
game.sahara = {
  built(), terrainHeight(x,z), slopeAt(x,z), groundSlip(x,z),
  waterLevel: -400, isOverWater() -> false, waterHeightAt() -> -400,   // no standing water
  inZone(name,x,z), navBlocked(x,z,r),
  SPAWN, cart, basket, gate, koutoubia, camp, duneTop, souk,
  caravan(),                       // it MOVES — ask, never cache
  storm(), dusk(),                 // 0..1 — systems.js reads both for fog, light and the band
  chasing(), chaseTime(), chaseNear(), riding(), surfing(), onFire(),
  update(dt),
}
```

**The slip is a PLACE, not a gradient.** Deriving it from the local slope was wrong twice over:
every ripple in the erg cleared the threshold so the whole desert crept underfoot, and the great
dune's own windward face is only twenty-five degrees and did not clear it by enough to matter.
The middle 70% of the windward face slides; the two shoulders are firm and are the way UP. Every
slide in this game has one of those — Iceland's is a rock moraine with a cairn on the end of it.
A slope you cannot climb is not a slide, it is a wall.

## Chapter 9 — The Drift (v9)

A ninth biome, `drift`. `src/drift.js`, prefix `dri`, `export function createDrift(game)`.
It is the first place in this game that is not a place: an archipelago of floating islands over
a sea of cloud, in a third of a gravity, with more air in it than ground.

```js
game.drift = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel: -0.5, isOverWater(x,z), waterHeightAt(x,z),
  inZone(name,x,z), navBlocked(x,z,r),
  SPAWN, gravity,
  wind(),                          // {x,z} — READ BY capybara.js AS A REFERENCE FRAME
  windSpeed(), airControl,
  lit(), glow(), skyward(),
  lampflies(), lampfliesNeeded, puffReady(),
  shelf, jetty, lamp, column, column2, orchard, arch, crown, lantern,
  wanderer(),                      // it MOVES — ask, never cache
  update(dt),
}
```

### GRAVITY IS PER-BIOME NOW

`onEnter` sets `game.world.gravity.y` to `driGRAVITY` (−8.6, against −24 everywhere else)
and `onExit` puts it back. It is done to the WORLD rather than faked per body so that every
loose prop, every hop and every fall in the chapter gets the same physics the capybara does.
Any biome that changes world state like this **must restore it on exit** — a world left at a
third of a g would make the Opera House steps unclimbable in a way nobody would ever diagnose.

### THE AIR IS A REFERENCE FRAME (the one new thing in capybara.js)

A biome may publish `wind() -> {x, z}`. capybara.js adds it to `platVX/platVZ` — the SAME
channel the ferry deck uses — for an airborne animal, so everything else is solved relative to
the parcel of air and the parcel's own velocity is added back at the end. Three things fall out
of that for free and all three are correct: the airborne bleed damps toward the AIR rather than
toward the ground (which is what drag does); the speed cap limits airspeed, so a tailwind can
carry you further than the controller would ever accelerate you; and world velocity is
continuous across the frame you land on. Do not re-implement wind as a force or as a velocity
write — it is a frame, and it is free of the speed cap for exactly the reason the deck is.

A biome may also publish `airControl` (0..1). It is 0.35 in the eight chapters where a jump is
a hop over a kerb, and 0.64 here, where the jump IS the traversal: a third of a second of no
steering is a flourish and two full seconds of it is a punishment.

### THE PUFF LIVES IN THE BIOME, NOT IN THE CONTROLLER

Pressing the voice key with the animal's feet off the ground gives one burst of lift per flight,
recharged the moment anything solid is underneath (the cloud counts). It is implemented entirely
in `drift.js`, because the update order runs the biome BEFORE capybara.js and nothing in that
module touches vertical velocity for an airborne animal — so writing `body.velocity.y` there
is read and solved against, and no change to the controller was needed.

It is the same button as the wheek, and it must stay that way. CONTRACT.md, "ONE VOICE": a
capybara has one mouth, and the context decides what the noise means.

### THE CLOUD IS THIS GAME'S WATER

`waterLevel` is −0.5 and `isOverWater` answers TRUE for everything that is not an island —
which is most of the biome, and is what makes a gap a gap rather than an invisible ledge at
cloud height (it switches off capybara.js's analytic floor backstop). The archipelago therefore
sits THIRTY METRES over it: at a deck of y = 0 the drop off the spawn island was eighty
centimetres and the chapter's third task was a puddle.

Falling is not a fail state and must never become one. After ~1.2 s in the cloud it gathers
under the animal and hands it back up to y ≈ 38. While that bloom is running its patch of cloud
**stops being water**, which is what ends the swim — otherwise the buoyancy spring in
capybara.js pins the animal to the waterline and no amount of lift moves it.

### ISLANDS NEVER OVERLAP IN PLAN

`driIslandAt(x, z)` is single-valued and every spatial question in the file resolves to it, so
two decks sharing a footprint would have no honest answer. Each island's collider is ONE
`CANNON.Box` whose footprint is exactly the rectangle that test uses, six metres deep so
nothing tunnels a deck at terminal velocity. The wanderers are kinematic, driven by velocity,
with `allowSleep = false`, and their swept paths are clear of every static footprint too.


## Chapter 10 — Venice (v10)

A tenth biome, `venice`. `src/venice.js`, prefix `ven`, `export function createVenice(game)`.

```js
game.venice = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel,                      // MUTATED EVERY FRAME — see below
  isOverWater(x,z), waterHeightAt(x,z),
  inZone(name,x,z), navBlocked(x,z,r), surfacePitch(x,z,y),
  SPAWN, piazza, basilica, campanile, molo, cafe, campo,
  rialto(), boards(), boardKnots(),
  gondola(),                       // it MOVES — ask, never cache
  tide(), tideY(), rising(), flooded(), seenFlood(), boardsOut(), onBoards(),
  pigeonsUp(),
  update(dt),
}
```

### THE WATERLINE MOVES NOW

For nine chapters the sea was the constant −0.5 and capybara.js wrote three
separate numbers against it as absolute world heights: swim below `y = 0.2`,
float at `y = −0.42`, stop clambering above `y = 1.80`. That is fine while
nothing tidal exists and it makes a TIDE flatly impossible.

They are offsets from the live biome's `waterLevel` now:

```js
capySWIM_ENTER 0.70   capyFLOAT_OFF 0.08   capyHAUL_TOP 2.30   capySWIM_OUT_H 0.60
```

At `waterLevel = −0.5` every one of them is numerically identical to the
constant it replaced, so the other nine chapters did not move a millimetre.
**A biome with a moving sea must write `api.waterLevel` every frame** (venice.js
does it at the end of `update()`, and again in `onEnter` so the first frame of a
re-entry is not solved against the tide it left behind).

`isOverWater(x, z)` in Venice is not a rectangle, it is
`waterY > terrain(x, z) + 0.22` — the 22 cm of slack is what keeps two
centimetres over the paving a puddle to walk through rather than a hole to fall
into, because capybara.js switches its analytic floor backstop OFF wherever this
is true.

### THE LEVELS ARE THE MECHANIC

San Marco is the lowest ground in the city and everything else stands a metre
over it. At the top of the tide that is the difference between a square you swim
and a lane you walk, which is the whole chapter. The first cut had the city only
85 cm up, the whole island went under together, and there was nothing to learn.

    piazza / piazzetta   0.00        molo 1.00
    calli, campi         1.30        fondamente 1.55
    tide                −1.30 .. +0.95, on a 205 s cycle

## Chapter 11 — Hong Kong (v10)

An eleventh biome, `kowloon`. `src/kowloon.js`, prefix `hk`,
`export function createKowloon(game)`.

```js
game.kowloon = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel, isOverWater(x,z), waterHeightAt(x,z),
  inZone(name,x,z), navBlocked(x,z,r), surfacePitch(x,z,y),
  SPAWN,
  climbHold(x,y,z),                // THE NEW VERB — see below
  airControl: 0.50, skyward(),
  bakery, market, scaffold, roof, poles, sign, pier,
  ferry(),                         // it MOVES — ask, never cache
  show(), showing(), seenShow(), litTowers(), neon(), climbing(),
  update(dt),
}
```

### THE CLIMB — `climbHold(x, y, z)`

The one new verb in eleven chapters, and it is built exactly the way slip and
wind were: the biome publishes a hook, capybara.js owns the solve, and the ten
chapters that never publish it are untouched.

A biome answers with the outward normal of the face within reach —
`{ nx, nz, top }` — or null. Hold the GRAB key against it and the animal clings.
The stick is then read against that FACE rather than against the ground:

    into the face   -> up          (out of it -> down, and faster)
    across the face -> shuffle
    the face itself -> a steady pull toward it, so contact is never lost

Gravity is not in the answer: `velocity.y` is assigned rather than added to, so
whatever the solver applied this step is replaced — the same trick the Drift's
puff plays from inside its own biome, and safe for the same reason. Space kicks
off the wall (out as well as up) and bars the wall for `capyCLIMB_COOL`, or the
grab key — which is still held, because that is what clinging IS — catches you
again on the very next frame.

Two things about the band that are not guessable and were both measured:

- **It must reach THROUGH the wall behind the lattice.** The cling pulls the
  animal toward the face at `capyCLIMB_STICK` and the building's collider stops
  it half a metre further in, so a band that ended at the face let go of the
  animal on the frame after it took hold, every time.
- **`top` must be ABOVE the deck it serves, not level with it.** Clinging stops
  the moment the animal is past `top` and hands it the last shove; a top of 33
  against a roof at 34.2 left it airborne at 3.5 m/s, which under a full gravity
  buys 26 cm, so every successful climb ended by sliding back down.

### THE MARQUEE IS SCORED

At eight o'clock the far shore lights one tower per `game.music.beats()` —
the same audio clock the notes are scheduled against, so it cannot drift from
what the player is hearing. When there is no pulse at all (muted, suspended, a
backgrounded tab) it falls back to a fixed interval, because sound is never a
requirement, only a reward. It comes round every two and a half minutes:
nothing in this game may be missable for ever.

## Chapter 12 — Palawan (v11)

A twelfth biome, `palawan`. `src/palawan.js`, prefix `pal`,
`export function createPalawan(game)`.

```js
game.palawan = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel: 0, isOverWater(x,z), waterHeightAt(x,z),
  inZone(name,x,z), navBlocked(x,z,r), surfacePitch(x,z,y),
  SPAWN,
  canDive: true,                   // THE NEW VERB — see below
  airControl: 0.42,
  rig(), camFloor(x,z),            // the lens goes under with the animal
  submerged(), bloom(), blooming(), seenBloom(),
  beach, jetty, reef, wreck, clam, crack, lagoon, cathedral, foot,
  turtle(), bangka(),              // both MOVE — ask, never cache
  update(dt),
}
```

### GOING UNDER — `canDive`

Twelve chapters in which the water was a wall, a floor or a road, and the
animal paddled across the top of it like a duck. Built exactly the way slip,
wind, the river and the climb were built: the biome publishes ONE flag,
capybara.js owns the solve, and the twelve chapters that never publish it are
untouched to the last decimal.

    HOLD E IN THE WATER   -> down       (release -> up, on its own buoyancy)
    SPACE                 -> a hard kick for the surface, and the dive is over
    breath                -> the STAMINA BAR, because that is what it is

E is also the grab key and that is deliberate rather than survivable:
`capyDIVE_GRACE` holds the animal's depth for 0.42 s after the key comes up, so
a TAP of E underwater fires the grab edge without ending the dive. Hold to stay
down, tap to take things, and neither fights the other.

Four things about it that are not guessable and were all measured:

- **The buoyancy spring had to be clamped.** It is proportional to the gap,
  which is harmless while the deepest water in the game is knee-deep and hands
  back 84 m/s once there is a seabed eleven metres down.
- **The sea-wall clamber must not arm while diving.** It arms on "in water,
  holding the stick, not making much progress", which underwater is true every
  time you slow down: a capybara that paused on the seabed was hauled eleven
  metres to the surface at 4 m/s and pinned under the tunnel roof.
- **The camera has to go under too**, or none of it is visible. The standing rig
  puts the lens six metres over the animal, so `rig()` asks for 5.0 m at 0.12
  rad while diving — 1.6 m over the animal, and clear of the coral.
- **`sysCAM_FLOOR` is a biome question now.** A hard clamp at y = 1.7 is a floor
  under the lens in twelve chapters and a CEILING over it in the one whose
  ground is at minus eleven, so a biome may publish `camFloor(x, z)`.

### THE KARST IS NOT IN THE HEIGHTFIELD

A heightfield cannot hold a vertical face: at any sane cell size a forty-metre
wall is a forty-metre RAMP, and capybara.js's analytic ground backstop will
levitate the animal up it at three metres a second. Every cliff in this chapter
and the next is a static box with rock drawn over it, and `terrainHeight`
answers only for the surface you can stand or land on — which is also the DIVE
floor, since the animal levels out `capyDIVE_FLOOR` above it.

### THE DOOR IS UNDER THE WATER

`palCRACK.lintel` = −1.55. A capybara floats with its body centre 8 cm over
the waterline, so anything at or below about −1.2 cannot be swum through on the
surface at any speed. The one gap in the island's cliff is roofed 1.55 m down:
the chapter's new verb is the key to its one locked door, and there is no
argument about whether you scraped under by accident.

## Chapter 13 — Cappadocia (v11)

A thirteenth biome, `goreme`. `src/goreme.js`, prefix `gor`,
`export function createGoreme(game)`.

```js
game.goreme = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel: -400, isOverWater(), inZone(name,x,z),
  navBlocked(x,z,r), surfacePitch(x,z,y), SPAWN,
  climbHold(x,y,z),                // the SECOND chapter to publish it
  airControl: 0.52,
  rig(),                           // the lens, while flying
  carryFrame(),                    // THE NEW CHANNEL — see below
  windAt(y,x,z), layers, layerOf(y),
  sunUp(), dawn(), seenSun(), flown(), aboard(), burner(), altitude(),
  town, plaza, field, valley, cliff, tether, landing, chimney,
  balloon(), truck(),              // both MOVE — ask, never cache
  update(dt),
}
```

### YOU DO NOT GET A STEERING WHEEL

    HOLD E     the burner. up, and it takes about four seconds to answer.
    LET GO     it cools, and it comes down. THERE IS NO SECOND CONTROL.
    SPACE      the hop, exactly as always — which is how you get OUT.
    the stick  nothing at all. That is the joke and it is also the lesson.

The wind goes a different way at every height (`gorLAYERS`), so you steer by
choosing a height. That is not an invented mechanic — it is exactly and only
how balloon pilots navigate, and it is why they all fly at dawn.

**The vent was deleted.** Space is the hop and the hop is how you leave the
basket; a vent on Space would have thrown the animal over the side sixty metres
up, every time. One lever is also a better chapter: the whole of the difficulty
is in the four seconds the burner takes to answer, so you commit to a layer
before you can see whether it was the right one.

**The wisps are the UI.** A hundred and twenty streaks of cloud, each living at
one altitude and moving at that altitude's own wind. The entire wind map is
legible out of the window and nothing had to go on the HUD.

**The rim curls the wind back.** Past `gorRIM` the layer's bearing bends toward
the middle of the valley and by `gorRIM_HARD` it points there outright — which
is what a valley actually does with pooled cold air, is visible while it happens
because the wisps read the same function, and means no sequence of burns can
strand anybody. Without it the balloon is four hundred metres outside the world
in ninety seconds.

**The chase truck drives to under the balloon** for the whole flight, so the
landing task can never be unwinnable: the target comes to you. What it cannot do
is corner, so it lags, and the skill is coming down somewhere it has reached.

### `carryFrame()` — A BIOME MAY DECLARE THE REFERENCE FRAME

The fourth thing to use the moving-world channel after a ferry's deck, the
Drift's air and the Uji's current, and the first to be DECLARED rather than
sniffed off a solver contact. A basket carrying the animal upward at the same
rate the animal is rising barely penetrates its own floor, and a contact that is
barely there is a contact that is sometimes not there: measured, the capybara
fell out within a second of the wind taking it, every time.

Horizontal goes through the channel (so the speed cap, the airborne bleed and
the continuity of world velocity on the frame you step off are all already
right). **Vertical is assigned from inside the biome**, because the channel is
horizontal-only and the alternative is a floor dropping away at 1.3 m/s under a
capybara — the Drift's puff trick, safe for the same reason.

### THE ONE EXEMPTION FROM THE FLAT-SHADING LAW

`gorBuildSky`'s dome. Flat shading is what makes every OBJECT in this game read
as folded paper; on a nine-hundred-metre dome it turns a dawn gradient into
thirty-two visible quads. A gradient is not a silhouette and the law is about
silhouettes. It also takes `fog: false` — it is there to REPLACE the fogged
background, not to be dissolved into it.

## Chapter 14 — Manly (v14)

A fourteenth biome, `manly`. `src/manly.js`, prefix `man`,
`export function createManly(game)`.

```js
game.manly = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  localWater: true,               // THE NEW HOOK — see below
  waterLevel: 0, isOverWater(x,z), waterHeightAt(x,z),
  flow(x,z),                      // the wave, the rip and the feeder
  canDive: true, airControl: 0.38,
  inZone(name,x,z), navBlocked(x,z,r), surfacePitch(x,z,y), SPAWN,
  rig(),                          // the lens, and only while a ride is running
  wave(x,z),                      // {y, amp, face, foam, push, depth, brk, ground}
  setNear(), seenSet(), riding(), rideDist(), atFlags(x,z),
  beach, flags(), pines, club, rip, bank(), bommie, pool, shelly, castle,
  boat(), carryFrame(),           // the surfboat MOVES — ask, never cache
  update(dt),
}
```

### THE WATERLINE IS A FUNCTION OF POSITION NOW — `localWater`

Venice moved the waterline in TIME. This moves it in SPACE, and no single
scalar can describe a surface with a metre and a half of relief on it
travelling at eight metres a second. A biome may declare `localWater: true`,
and capybara.js asks `waterHeightAt(x, z)` everywhere it used to read the
scalar `waterLevel`:

```js
function capyWaterY(env, x, z) { ... }        // the whole change
```

Built exactly the way slip, wind, the current, the climb and the dive were
built: ONE flag from the biome, the solve stays in capybara.js, and the
fifteen chapters that do not publish it cost one property miss and are
untouched to the last decimal. Everything that already reads it — the swim
threshold, the float target, the clamber ceiling, the wake rings, `capy.depth`
— becomes correct on a wave for free, because all five were already offsets
from "wherever the water is" rather than world heights.

A biome that publishes it must STILL publish `waterLevel`, because everything
that only wants to know roughly where the sea is (the fog, the minimap, a
prop's rest height on a still day) should get the still-water level and not
whatever a wave happens to be doing this frame.

**And `capy.swimming` is published now.** A biome cannot infer it from
`capy.depth > 0`: the depth of a capybara floating on its own waterline is
zero, and a wave passing under it makes that number flicker. Same rule as
`carriedBy` and `climbing` — if two modules have to agree about state, one of
them writes a flag.

### THE SWELL IS A PHASE TABLE, NOT A SINE

A wave in shallow water travels at `sqrt(g*d)` and nothing else, so as it
comes up the beach it slows down and — its period being fixed — it gets
SHORTER: sixty-six metres out the back, thirty-two over the bank, nineteen in
the shorebreak. That is integrated once at module load into a table of
accumulated phase against distance from the bar, and because every beach
profile here is the same profile shifted by `manBankZ(x)`, one 1-D table is
exact for the whole bay — which also means a crest line is a contour of the
bathymetry, so the swell refracts round the bar with no line of code about
refraction.

Running the swell at one speed everywhere put a wave and a half across the
hundred metres the player actually looks at, and the whole surf zone rendered
as one smooth gradient with nothing in it to aim at.

### THREE THINGS THAT WERE MEASURED AND NOT CHOSEN

- **The foam has to come in BANDS.** Making it a function of depth turned the
  fifty metres between the bank and the sand permanently white. It is
  phase-locked instead: about a third of a wavelength, straddling the crest.
- **The face darkening must be gated on there being NO foam.** Darkening the
  face and whitening the foam over the top of it CANCELS — the two are in
  antiphase along a wave. Measured off the vertex buffer: a crest at
  (0.27, 0.40, 0.42) and a trough forty metres behind it at
  (0.06, 0.35, 0.37), which is a difference nobody can see.
- **A ride is a fixed point or it is nothing.** In broken water the push is
  `sqrt(g*(d+eta)) * (0.86 + 0.26*foam)` — slightly faster than the bore where
  the white is thickest and slower at its leading edge, so an animal in the
  band is carried forward through it until the two speeds match and then stays
  there. That is trim, it is stable with no input, and it is the difference
  between a 13.5 m ride and the whole fifty-metre ramp. Measured both ways.

### AND THE FLAT SEA MUST NOT COVER THE LIVE ONE

The obvious build lays one enormous plane at the still-water level and puts
the live surf mesh over it. A TROUGH is below the still water level, so
wherever the live surface dips the flat plane is ON TOP OF IT: half of every
wave is painted out by its own backdrop, and no `renderOrder` fixes it because
both are opaque and the depth test is doing exactly its job. The flat water is
cut around the live water — far, west and east of it, and never under it.

## Chapter 15 — The Pantanal (v14)

A fifteenth biome, `pantanal`. `src/pantanal.js`, prefix `pan`,
`export function createPantanal(game)`.

```js
game.pantanal = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel: 0.25, isOverWater(x,z), waterHeightAt(x,z), flow(x,z),
  inZone(name,x,z), navBlocked(x,z,r), surfacePitch(x,z,y), SPAWN,
  carryFrame(), airControl: 0.36,
  following(), dusk(), crossing(),
  fazenda, baia, nest, palm, otters, bridge, bank, sandbar,
  matStart(), matAt(i), matCount(),
  herd(), anteater(), caiman(), cowbird(),   // all MOVE — ask, never cache
  update(dt),
}
```

### THE HERD IS A TRAIL, NOT A FLOCK

Wheek near another capybara and it joins the line; `order` places back. Each
follower steers to where the PLAYER ACTUALLY WAS `2.6 * (order + 1)` metres
ago, off a ring buffer sampled every 35 cm. There is no flocking, no
separation force and no steering behaviour, and that is the point: a line off
a trail cannot pile up, cannot orbit, cannot oscillate and cannot walk through
the termite mound the player just went round. Nine matrices, about forty
lines. A follower that is behind RUNS (up to 8.5 m/s), or the line stretches
on the first sprint and never comes back.

### A FLOATING MAT IS GROUND, AND IT HAS TO SAY SO IN `terrainHeight`

The camalote sink under load and come back up more slowly. Making them
colliders is not enough: capybara.js decides whether the animal is swimming
from `isOverWater`, and `isOverWater` reads `terrainHeight` — so a capybara
standing on a raft over two metres of water was being told it was in the
water, and the crossing could not be completed at all. `panTerrain` reports
the mat top while the mat is within `panMAT_SOLID` of the waterline; past
that it stops being ground and you are swimming, which IS the mechanic.

**And a rate is metres per SECOND.** The first build left the `* dt` off and
the mats went down at eighteen metres a second: the whole mechanic fired and
finished inside a single frame, so from the player's side the meadow simply
was not solid.

### THE FLOOD IS DRAWN WITH VERTEX ALPHA

A single opacity cannot describe water that is two and a half metres deep in
the middle of the baia and eight millimetres at the edge of a corixo. three.js
reads a vec4 colour attribute as colour AND alpha, so the sheet fades out
where it gets thin — which is what shallow water does. Pushing the dry
vertices under the ground instead leaves a visible one-cell RAMP round every
shoreline in the chapter.

### AND THE 22 CM OF SLACK IS LOAD-BEARING AGAIN

A third of this chapter is under two inches of water, and two inches of water
is a thing you WALK THROUGH. `isOverWater` is true only where the water is
properly deep — the corixos, the baia and the river — or the animal would be
swimming at 2.6 m/s across half the map. Same rule Venice uses to keep a
flooded piazza walkable.

## Chapter 16 — Sơn Đoòng (v14)

A sixteenth biome, `cave`. `src/cave.js`, prefix `cav`,
`export function createCave(game)`.

```js
game.cave = {
  built(), terrainHeight(x,z), slopeAt(x,z),
  waterLevel: -7.4, isOverWater(x,z), waterHeightAt(x,z), flow(x,z),
  inZone(name,x,z), navBlocked(x,z,r), surfacePitch(x,z,y), SPAWN,
  climbHold(x,y,z),               // the THIRD chapter to publish it
  canDive: true, airControl: 0.46, carryFrame(),
  echo(), daylight(), seenLight(), echoReady(),
  mouth, river, hand, doline, wall, roost, pearls, phyto, exit,
  fish(), log(),                  // both MOVE — ask, never cache
  update(dt),
}
```

### THE VOICE IS THE TORCH

Press Q in the dark and a pulse of light goes out from the animal, lights what
it reaches, and dies: one `THREE.PointLight` whose range grows outward and
whose intensity has a hard attack and a long tail (a light that fades UP is a
torch; a light that arrives all at once and goes is a noise), plus an
expanding ring on the floor. `cavECHO_COOL` is 1.05 s, so it is a rhythm
rather than a switch.

It is NOT a new control. CONTRACT.md, ONE VOICE: a capybara has one mouth and
the CONTEXT decides what the noise means — it has meant hello, a condor, a
ferry's horn, a burst of lift in the Drift and a ticket out of a chapter, and
here it means "where am I". The chapter binds `capy:wheek` and nothing else.

### `daylight()` IS THE CHAPTER'S ONE NUMBER

0 in the passage, 1 outside, 1 under the hole in the roof and 0.85 at the slot
at the far end. systems.js reads it for the fog near and far, the hemisphere,
the ambient, the sun and the grade's threshold, so there are exactly three
places in a hundred and seventy metres of mountain where the chapter does not
look like the inside of a mountain.

**The threshold goes UP under the shaft, not down** — the Cappadocia rule. In
the dark nothing clears 0.20 and the only pixels that bloom are the four
things that make their own light; under a hundred and fifty metres of genuine
daylight, a threshold tuned for a glow-worm smears the whole doline into one
sheet of paper.

### THREE THINGS ABOUT DRAWING THE INSIDE OF A MOUNTAIN

- **A floor and a roof is not a cave, it is a canyon with a lid on.** The
  first build had no side walls: standing in the doline and looking along the
  passage, the eye went straight past the edge of the floor mesh and out into
  `scene.background`, which at that moment was pale blue daylight. There was a
  wall of sky at eye level INSIDE A MOUNTAIN.
- **A shaft of light must be ADDITIVE.** A translucent cylinder at 0.17 over a
  nearly black background renders as a solid tan slab, because 17% of white on
  top of nothing IS a wall. Light does not occlude, it adds; and it is far
  brighter at the hole than by the time it reaches the floor, which is what
  the vertex alpha is for.
- **The roof needs a hole and PlaneGeometry cannot have one.** It is
  hand-authored: quads are emitted only where the roof is actually there, and
  they are wound so the normals point DOWN, because you are underneath them.
  Getting a ceiling's winding backwards renders it invisible from the only
  side anybody will ever see it from — the same mistake as the Uji's riverbed.

### THE CLIMB BAND REACHES OUT AS WELL AS IN

Chapter 11 established that a `climbHold` band must reach THROUGH the wall,
because the cling pulls the animal in and the collider stops it half a metre
further. The other half of that had never been paid for. The Great Wall's
collider is eight metres deep, so its outer face is four metres from the
middle and a capybara pressed against that face has its CENTRE another seventy
centimetres out: a band of ±4.2 never fired at all, and from the player's side
the animal walked into the wall and stood there. ±6.5.

## Chapter 17 — the Antarctic Peninsula (v15)

A seventeenth biome, `antarctic`. `src/antarctic.js`, prefix `ant`,
`export function createAntarctic(game)`.

```js
game.antarctic = {
  built(), terrainHeight(x,z), slopeAt(x,z), waterLevel, isOverWater(x,z),
  waterHeightAt(), groundSlip(x,z), surfacePitch(x,z,y), inZone(name,x,z),
  navBlocked(x,z), airControl, SPAWN,
  packAt(x,z),        // 0..1 pack-ice density. THE CHAPTER'S MAP.
  pack(),             // ...and how much of it the tender is in right now
  seenPod(),          // has the pod ever formed up on you (the exit opens on it)
  withPod(),          // 0..1 — are they on you NOW
  atHelm(), boat: { position, helm, speed, heading, atHelm, maxSpeed },
  jetty, huts, colony, highTop, whalers, bones, berg, gate, blueIce, glacierToe,
  mug(), pod(), seal(), nearestFloe(),      // these MOVE — ask, never cache
  update(dt),
};
```

The land is four rocks and a glacier and they are eleven hundred metres apart, so
the verb is STEER and the chapter is written around two fields:

* `antIceAt(x, z)` — pack density. The tender's top speed is
  `VMAX * (1 - antICE_DRAG * ice)` and her acceleration the same way; the sea
  mesh's vertex colour is the same function, so the LEAD is found by looking.
* `antGroundSlip(x, z)` — six frictions expressed as regions, which is only
  possible because slip is linear in terminal speed (see capybara.js).

**A PENALTY APPLIED INSIDE THE FRAME LOOP MUST BE A RATE, NOT A FACTOR.** Three
separate things here were written `speed *= k` and all three were bottomless
wells: `0.45` per frame is `0.45^60` per second, so a hull that touched
anything settled at `acc*dt / (1-k)` — measured 0.45 m/s — and could never get
its way back. Write `v *= 1 - clamp(rate * dt, 0, cap)`. And a position CLAMP
must take the speed with it, or a body pinned against the world edge goes on
reporting twelve metres a second to the wake, the score and the sound.

**A DOME HIDES ITS OWN FOOT.** A smoothstep hill is convex, and from anywhere on
a convex hill you cannot see the bottom of it. If a chapter's opening view is
"there is the thing you are here for", the ground between has to be a straight
cone: `0.86*clamp(1.12-d,0,1) + 0.14*smooth(1.16-d)`.

## THE HELM CAMERA (v15 — one term, wrong since chapter 3)

`camYaw` is the bearing FROM the animal TO the camera, so behind is `+ PI`. The
walking branch carries it and the chiva branch carries it; the SAILING branch did
not, and at the wheel `capy.group.rotation.y` is the ship's heading. Measured
under way: Circular Quay put the rig 20.8 m toward the bow and Antarctica 14.0 m.
Both boat chapters were driven looking backwards down the ship.

## THE AIR, AS A TABLE — `sysAIR` (v14)

Thirteen chapters of atmosphere are thirteen hand-written blocks in the middle
of `update()`, each with its own `xxxT`, its own six constants and its own
rung in `atmosPrime`. Every one is correct. But the fourteenth, fifteenth and
sixteenth would have been three more, and this codebase has now been bitten
four separate times by a per-place if-ladder that shipped missing a rung — the
beacon's ground height, the departures board's digit keys, the spawn point and
the far plane. **A table cannot be missing a rung.**

```js
sysAIR = { manly: { fogN, fogF, haze, hazeK, bg, bgK, sun, sunK,
                    hemi, gnd, hemiK, amb }, ... }
```

One row per place, one loop, one line of damping and one rung in `atmosPrime`
that works for every chapter including the ones not written yet. The old
blocks are left alone: they do things this cannot — an aurora, a tide, a
sandstorm, a sun coming over a ridge — and rewriting thirteen working
atmospheres to prove a point is how you break eleven of them.

**The rule going forward: a chapter whose air is a CONSTANT belongs in the
table; a chapter whose air is an EVENT keeps its own block, and layers it on
top of the table.**

## THE GLOBAL ENVIRONMENT (v17 — the micro-weather pass, 23 Aug 2026)

`sysAIR` above answers "what is the air in this chapter". This answers a
different question — "what is happening to it this minute" — and it is a new
file, `src/weather.js` (prefix `wx`), publishing `game.weather`. It runs after
every biome and before props/capy/npc/systems.

**There is no clock in it and there never will be.** Seventeen chapters are
each welded to an hour, and that is the strongest thing about how they read: a
place you can only ever see at one hour becomes THAT HOUR, the way a photograph
does. A day/night cycle would take seventeen places and make them one place
seen seven times. So `lock` — `'midday' | 'golden' | 'sunset' | 'dusk' |
'night' | 'overcast' | 'predawn' | 'interior'` — is a LABEL. Nothing computes a
light from it.

### The mood table — `wxMOOD`

One row per chapter, and **the row IS the configuration interface**. There is
no per-biome code anywhere in that file, and no biome file was touched.

```js
{ label, lock, wet, rain: { odds, peak, hold, gap },
  cloudK, pulseK, gust: { base, swing, hz }, dir,
  motes, bed: { rain, wind, chirp, drip, rustle, thunder }, slipK, cold }
```

`wxBASE` is the all-zero row and it is what a chapter with no entry gets.
**Measured: on that row `sunK`, `hemiK`, `fogNK` and `fogFK` are exactly 1 and
`amb`, `hazeMix`, `bgMix`, `bloom` and `slip` are exactly 0.** That is the
backwards-compatibility guarantee, and it is a measurement rather than a claim.

### The four signals, and they are all centred on zero

`drizzle` (a shower, on an asymmetric envelope — one arrives faster than it
leaves, always), `cloud` (half-wave rectified: there is no such thing as
negative shadow), `pulse` (the sky breathing at one to four per cent) and
`gust` (which swings its HEADING as well as its speed). Each is three sines at
incommensurable ratios so the sum has no loop a player can hear.

**IT MAY MAKE AN HOUR WEATHER AND IT MAY NOT MAKE IT A DIFFERENT HOUR.** That
is the rule every constant in the file was tuned against, and the test is: can
you say what time it is in a screenshot taken at the bottom of the signal as
well as one taken at the top? Measured across seventeen with showers forced —
sun swings 0.14–0.32, hemisphere 0.05–0.13, far plane 0.00–0.26. The Drift is
untouched in every channel; Marrakech moves its sun by three per cent, which is
its cloud shadow and nothing else.

When re-measuring a chapter's own atmosphere, read `game.weather.light()`
rather than the resulting light: Goreme's sun swings 0.53 and Kowloon's
hemisphere 0.27 through a soak, and both are the CHAPTERS' own events (the
ridge letting go, the Symphony). At the weather module's own output they are
0.03 and 0.13.

### `wetness()` vs `shine()` — and this distinction is load-bearing

`wetness()` is how wet the ground is. `shine()` is how much wetter than this
chapter's own baseline. **Anything that changes how a chapter PLAYS or how it
was TUNED to look reads `shine()`.** Son Doong's floor is wet limestone at a
baseline of 0.52 and Kowloon's asphalt never dries; both were authored and
shipped that way, and keying slip off the absolute handed Son Doong a permanent
0.20 of slide the day a weather system arrived. That is a rebalance of finished
work wearing a weather system's clothes.

The one deliberate exception is `splash()`, the footfall's wet layer, which
uses the absolute — a footstep is characterisation, not play or grade, and a
wet cave floor sounding faintly of water is the brief rather than a regression
of it.

Wetness **saturates** at the shower's own intensity. Integrating a rate has no
ceiling but the length of the shower, and Sydney's deliberately-lightest
sunshower measured 0.559 — a wetter street than Kowloon's.

### What reads it

- **systems.js** layers `light()` on the atmosphere ABSOLUTELY LAST, after the
  hand-written blocks as well as the `sysAIR` loop. **The sky moves less than
  the fog** — rain is between you and the far half of the world and barely
  between you and the zenith, and moving both equally is what makes video-game
  rain look like somebody turned the lights down.
- **systems.js** also layers the wet-street grade in `sysDressFrame`. A wet
  road is not a darker road, it is the same road with a mirror on it: more
  bloom, a threshold low enough for a reflection to clear, a little more colour
  and contrast.
- **capybara.js** ADDS `slip()` to the biome's own `groundSlip` (a glacier in a
  shower is a glacier plus a shower), takes a FLOOR on `capyWetLevel` from the
  sky, and passes `splash()` as `opts.wet` on the footfall.
- **npc.js** gives every local an umbrella, a huddle, a glance upward and a
  lean off the gust.

### `wind()` IS NOT THE GUST, AND THE GUST MUST NEVER GO INTO IT

The obvious thing to do with a seven-metre gust over the Erg is to add it to
`capyWindAt()`, and it would be a serious bug. `wind()` is **the air as a
reference frame** — a chapter-owned mechanic that goes into `platVX/platVZ`
beside a moving ferry deck and a balloon's basket. A five-metre ambient breeze
on that channel slides a capybara across Jemaa el-Fnaa at walking pace with
nobody touching a key, and in Cappadocia it fights the one system that chapter
IS. The gust drives the motes, the rain's lean, the wind bed and which way the
locals turn. It does not touch the controller.

### `cold` IS ITS OWN FIELD, NOT AN INFERENCE FROM `lock`

npc.js originally derived "is anybody cold here" from `{ night, predawn,
interior }`, which is true in sixteen chapters and wrong in the seventeenth:
Antarctica is locked to `'midday'`, because it IS midday there for four months.
Measured — a crowd standing in a 4.4 m/s katabatic wind at huddle 0.00 while
Reykjavik, which is warmer, sat at 0.89. **A rung inferred from a different
table is a rung waiting to be missing.**

### The emitters

Two `InstancedMesh`es, allocated once at max and never rebuilt on a biome
change. Nine mote KINDS as data (`petal`, `leaf`, `seed`, `firefly`, `spore`,
`mote`, `spray`, `drift`, `pollen`), so the update loop has no idea what a
sakura petal is — only that it falls at 0.55 and spins at 1.9. Flat Lambert via
`mat()`, no shadows, and **deliberately never handed to
`registerShadowTarget`**: three hundred tumbling quads in the shadow pass is
three hundred draw calls for a shadow nobody could resolve.

Three things about them that were measured rather than chosen:

- **A streak points the way it falls.** Built from Euler angles on the shared
  quad, every drop lay flat and the first shower rendered as white tally marks
  hanging in the air. `setFromUnitVectors` onto the fall vector, and a BOX
  rather than a ribbon — a petal tumbles so a folded quad always has a face
  turned somewhere, but a raindrop is welded to the fall vector and an edge-on
  ribbon is not there at all.
- **The field sits IN FRONT of the lens, not around it.** A box centred on the
  camera spends half its instances behind the near plane, so the density you
  author is twice the density you get.
- **`transparent: true` + `side: DoubleSide` DRAWS THE MESH TWICE.** three
  renders back faces then front faces to sort transparency within one object.
  One field of 150 motes cost 2 draw calls and 600 triangles; the same field
  opaque, or transparent and single-sided, costs 1 and 300. The motes are 92 %
  opaque specks a few centimetres across — they go opaque and keep DoubleSide,
  which the folded quad needs. The rain is a closed box, so DoubleSide was pure
  waste — it stays transparent and goes FrontSide.

### The wet ground — `wetTick()` (shared.js owns, and it is a THIRD half of `grain()`)

`grain()` now takes two more shared uniforms — a level and a colour — set once
a frame by `wetTick(shine, hemiColour)` from `sysDressFrame`. Same deal the
sparkle clock gets: one float and one colour written per frame moves every
grained surface in the live chapter at no per-material cost.

**This exists because expressing a wet street ONLY in the composite pass does
not work.** The first version did exactly that — more bloom, a lower threshold,
more saturation — and in Kowloon it looked right, because Mong Kok is full of
lights for a wet road to reflect. In Kyoto and Venice it did almost nothing: a
lowered bloom threshold needs something bright on the ground to bite on, and
the grass and the stone were exactly as light as they had been in the dry. The
wetness was in the lens and not on the floor.

What wet ground does is two things, and only the second can be faked in a post
pass. **It goes darker** — water fills the surface's micro-pores and traps
light that would have scattered back out; porous things lose 20–40 % of their
diffuse. **And it acquires a sheen at grazing angles**, which is the half that
makes it read as WET rather than as merely in shadow. The sheen is deliberately
allowed to run over 1.0, so the wet-street grade's lowered threshold finally
has the highlight it was lowered for — exactly the relationship `sparkle`
already has with the composite pass on water.

Three things about it:

- **It is gated on which way the face points** (`vGrainN.y` squared), and that
  gate is most of what makes it convincing for free: water lies on TOP of
  things. Measured in Mong Kok at full wetness — **the road −15 %, a vertical
  shop front −0.6 %.** A per-mesh flag would have been the only other way to
  get that and there are seventeen chapters of meshes.
- **It is not applied to water.** `spark > 0` is this helper's existing and only
  marker for "this material is a sea", and darkening a sea because it is
  raining on it is nonsense twice over.
- **The sheen colour comes from the HEMISPHERE**, so a wet street reflects the
  sky it is actually under — neon over Mong Kok, flat grey over Kyoto — and
  every event that already moves the atmosphere moves the reflection with it,
  without a table and without either chapter knowing this exists. Same argument
  the sky dome's horizon colour is built on.

The world normal is taken in the vertex shader at the existing `begin_vertex`
replacement: `objectNormal` is defined by `<beginnormal_vertex>`, which three
emits BEFORE `<begin_vertex>`, so no second hook is needed. It must be world
space and not view space, because the whole question is "is this facing up".

Cost: a branch on one uniform, so a dry chapter pays a uniform read and nothing
else. Measured over four chapters — **16.5–16.9 ms median, dry and wet,
unchanged.** (p95 moved from 17.6–18.0 to 18.3–19.4 across the board INCLUDING
the dry control, Marrakech, whose branch never runs — so that is machine noise
rather than the shader.)

### The bed (systems.js owns)

Four continuous voices — rain in two bands, wind swayed on its CUTOFF rather
than its level, gated crickets, leaves — plus a scheduled `drip`, which must
NOT be continuous or it is a tap left running. Rain made of scheduled one-shots
is a machine gun with a low-pass on it.

**The score is the point and this is not.** Two mechanisms: a bus ceiling at a
fifth of what the master would allow, and a duck against `musIntensity`, so the
bed gets out of the way of a swell and comes back. Crickets stop when it rains.

Two new synths. `thunder` is **always distant** — there is no lightning in this
game and there will not be, because a flash is a hard cut in a game whose whole
argument is that its light is stable, and the absence of a crack IS the
distance. `drip`'s downward sweep is the whole sound; at a constant pitch it is
a marimba.

### What this cost (measured 23 Aug 2026)

Draw calls read the way this file already insists on — `autoReset = false`,
`reset()`, ONE tick, read — and as the difference between two ADJACENT frames
with only the two fields' `visible` changed. **The first version of this
measurement compared a dry frame with one ninety seconds later and reported
+113 draw calls in Kowloon; ninety seconds of Kowloon is a Symphony cue, two
buses and a crowd. The tell was Sydney reporting MINUS six.**

- **+1 draw call and ~300 triangles in a chapter that cannot rain** (Marrakech,
  Son Doong: the mote field only).
- **+2 draw calls and 2 484 to 3 756 triangles at the peak of the heaviest
  shower** (Kowloon 289 streaks, Kyoto 265, the Pantanal 273).
- **Frame time did not move**: 16.6–16.8 ms median and 17.6–18.0 ms p95, dry
  AND wet, under rAF in Marrakech, Kowloon, the Pantanal and Kyoto.
- **17/17 clean on a weather-forced `qa/wx-fuzz.js`** — eight seconds of random
  input per chapter with `odds: 1`, so the wet path is actually exercised. No
  NaN, no camera NaN, no void falls, no errors.

**AND MEASURE A CHAPTER AT ITS WEATHER.** Marrakech's note further down this
file is now live in seventeen places: the rain field draws nothing at all until
it rains, so every number above is taken at a forced shower peak.

## THE PICKER SCALES NOW (v14)

The title card's chapter picker was a bento: four columns, chapter one
spanning 2x2, and therefore exactly twelve other chapters or a ragged half-row
at the bottom. That is an arithmetic problem disguised as a layout, and it
held for precisely as long as there were thirteen places.

- **The hero is out of the grid entirely.** Chapter one is a full-width row of
  its own above the shelf. It gets more space than it ever had and the number
  of chapters no longer has to divide by anything.
- **`sysPickCols(n)` chooses the column count.** Four, five or six, whichever
  leaves the fullest last row (a remainder of zero wins outright). Fifteen
  gives five; seventeen gives six; nineteen gives five. Nine lines.
- **The shelf is a scroll region, not a taller card.** Fifteen tiles is three
  rows and thirty would be six, and a card that grows without limit pushes the
  control legend — the only statement of the control scheme this game has —
  off the bottom of a 720p laptop. Measured: the card was 803 px in a 720 px
  window before this, and 717 after.
- **Every tile is the same object.** The subtitles run from three words to
  nine; clamped to two lines with a floor under the body, the shelf is a grid
  the eye can run down instead of a ragged wall.
- **`sysPICK_EXTRA` runs to twenty chapters**, and a row past the end of it
  simply gets no key badge and stays clickable.
- **The departures board carries the same marks.** It is the other half of the
  same decision — which of these places do I want to be in — and it was
  answering it in a completely different language. Sixteen lines of text is a
  timetable; one 44 px mark per row makes it scannable by COLOUR, which at
  sixteen rows is the only way anybody scans anything.

## CHAPTERS IS THE ONLY TABLE (v10)

`CHAPTERS` in shared.js carries, per chapter: `biome`, `name`, `sub`, `arrive`
(the task ticked by turning up), `far` (camera far plane), `tall` (deep shadow
frustum), `pal` (index into `sysMUS_PAL`), `hint` (the title card's line),
`open` (the first thing the game says on arrival), `way` (the one way out, in
words), `keep` (the souvenir), and optionally `acts` and `win` (the shape of the
chapter — see **THE SHAPE OF A CHAPTER** below).

It absorbed eleven separate if-ladders across five files — the spawn point, the
far plane, the shadow box, the palette, the arrival task, the place card, the
opening toast, the picker, the digit keys, the to-do chapter and the departures
board. The ninth chapter shipped with two of them missing a rung. **A table
cannot be missing a rung.** Anything per-place goes here, and anything that
needs it asks `chapterDef(chapterOf(name))`.

Two more ladders went the same way and for the same reason:

- `main.js` publishes `biome.spawnOf(name)` — `<NAME>_SPAWN` by lookup.
- `capybara.js` and `systems.js` ask the LIVE biome by property lookup
  (`game[name]`, or `game.env` for Sydney) instead of naming each one. Every
  optional hook — `terrainHeight`, `groundSlip`, `wind`, `flow`, `airControl`,
  `climbHold`, `surfacePitch`, `skyward`, `rig`, `canDive`, `camFloor`,
  `carryFrame` — is now a property that either exists or does not, and a biome
  that does not publish it costs a failed lookup.

### `soaking(x, z)` — a biome may get you wet without a swim (v20)

Optional, 0..1, same shape and same ladder as `groundSlip`. capybara.js takes it
as a **floor** on `capyWetLevel`, exactly as it already takes the sky's, so it
can never dry an animal that has just climbed out of the harbour and it sits
below the 1.0 a swim gives.

It exists because of a tell the rain block's own comment had already named and
nobody had applied twice: *"an animal that walks through a sixty-second downpour
and comes out with a dry coat is the tell that the weather is a decal."* The
Botanic Gardens have had a working sprinkler since v1 whose entire job is to
soak a **tourist**; a capybara could stand in the arc of it indefinitely and
come out bone dry. Sơn Đoòng has been dropping twenty-six drips out of its roof
since it was built, ringing the floor and ticking, and not one of them could
land on you. The wet fur, the shake and the drips all existed and were reachable
by exactly one route.

Two publishers, and they are deliberately different in kind:

- **environment.js** answers `envSPRINK_WET` (0.92) inside a running sprinkler's
  **circle**. Not inside the sector: the rotor SWEEPS at 1.35 rad/s, so
  `sprays(x, z)` is true for a given point in pulses about twice every four and
  a half seconds. Measured — five seconds stood in the fan with a hold on the
  sector reported zero, and `wet` decaying at an eighth a second rides the
  pulses between 0.77 and 0.92 without ever falling out of the band.
- **cave.js** ACCUMULATES: `cavSoakT` rises while the animal is within
  `cavDRIP_HIT` (1.15 m) of any of the twenty-six columns and falls at twice the
  rate off them, so it is about four seconds under a drip to get damp, it never
  passes `cavSOAK_MAX` (0.62), and stepping out from under it is immediately the
  right move. It ignores its (x, z) — the accumulator is already a function of
  where the animal is standing and computed once a frame in `cavUpdateDrips`.

### `surfacePitch(x, z, y)` — a biome may answer for its own footsteps

The footfall voice was nine chapters of hand-written rectangles in capybara.js.
A biome may publish `surfacePitch` and never appear in that ladder at all:
`< 0.9` soft ground, `~1.0` stone, `> 1.15` hollow timber.

## THE JOURNEY — save, records, departures (v8, systems.js owns)

```js
game.record(taskId, value)   // a measured task hands over its number
```

`RECORDS` in shared.js declares which tasks are measured and how (`label`, `unit`,
`better: 'lower'|'higher'`, `dp`). **A record never gates anything.** `CHAPTERS` in shared.js is
the single source of truth for which biome a chapter is, what it is called and its subtitle —
that used to live in three places at once, which was survivable at two chapters and is not at
eight.

The save is one `localStorage` key (`capy3.journey.v1`), written on a debounce so a four-tick
streak is one write, and every read and write is wrapped: storage disabled, a private window or
a full quota must never be why a capybara game stops working. `completeTask(id, silent)` exists
for the restore: reloading a half-finished journey must not fire forty toasts and six chapter
ceremonies in the first second.

**Every place still has exactly ONE way out of it**, standing somewhere obvious, using a verb the
player already has. The third wheek there now opens the departures board (Tab opens the same card
read-only) rather than picking the destination itself.

## THE BEAT — `game.music` (systems.js owns; v6)

Anything that has to move in time with the band reads this, and NOTHING may keep its own
tempo clock: a parallel timer drifts out of sync with the audio inside a minute.

```js
game.music = {
  playing,          // bool — false when muted, suspended, or the palette has no pulse
  beatLen,          // seconds per beat, 0 when there is no pulse
  beats(),          // beats since the anchor, float; -1 when there is no pulse
  off(),            // signed distance to the NEAREST beat, in beats (0 = dead on)
  beatInBar(),      // 0..3
  swell(k),         // 0..1 — lift the score for a set piece. See below.
}
```

It is derived from `ac.currentTime` and the same anchor the notes are scheduled against, so it
cannot drift from what the player is hearing. Gameplay must degrade gracefully when
`playing === false` — sound is never a requirement, only a reward.

### THE LIFT — `swell(k)` (v7)

The score is generative and never stops, so a celebration cannot be a stinger: a fixed
flourish would be in the wrong key half the time and would sound like a notification. The lift
is made of the score itself — three voices an octave and a twelfth above the pad, pushed into
`musVoices` so they voice-lead into the same chord as everything else and **cannot be out of
key by construction**, plus a rising arpeggio built from the chord that is actually sounding.
It is per-place for free, because it reads the live palette.

`completeTask` fires it for every task carrying `wow` in `TASKS`, so a biome never calls it for
the tick. Call it only for the other half of a set piece — the part with a BUILD in it, where
the moment starts half a minute before the tick lands (iceland.js holds it up for the twelve
seconds the aurora is climbing). It takes the max of the live envelope, so calling it every
frame HOLDS the swell rather than restarting it, and it is safe on a suspended or muted
context.

**Exactly one task per chapter carries `wow`.** The scarcity is the entire mechanism: sixteen
rows in a hundred and sixty-nine. If a better set piece arrives, MOVE the flag — never add a
second one to a chapter. `sfx(name, {force: true})` skips the anti-machine-gun throttle and
exists for this payoff alone (three biomes fire ambient `cheer`s, which would otherwise swallow
it).

### THE MIDDLE RUNG — `mini` (v12)

With the banner built, a chapter had exactly two kinds of line in it: the one moment it is for,
and a hundred and fifteen switches. Everything in between — riding a thing, being carried by a
thing, standing somewhere at the moment something happens — was paid out exactly like picking a
sandwich up off a rug.

A row may carry `mini: 'CAPTION'` instead. **One or two per chapter, never more, and never on the
same row as `wow`** — `qa/audit-tasks.mjs` enforces both. `completeTask` pays it on the same three
channels at roughly half of each: `musSwell(sysMINI_SWELL)` (0.55 — the same figure from the same
palette, so it still cannot be out of key), the **moment card** (`showMoment`: paper like a toast,
composed like the banner, caption ABOVE the rule, 2.6 s), and eighteen scraps instead of
twenty-four. It is a BIGGER TICK, not a smaller marquee; the two have to stay different in kind or
the banner stops meaning anything.

It is also the pacing lever, and as of 20 Aug 2026 the second slot is USED: Rio, Venice, Hong
Kong and Palawan measured furthest under the band in `qa/pacing.mjs`, and each has two now — o
bonde, il Volo dell'Angelo, the lion on the poles, and the manta. Seventeen minis in a hundred
and thirty-three lines.

**AND THE HONEST NUMBER, because it is the point of measuring at all: a second mini is worth
25-35 s and moved each of those four chapters by about a minute and a half.** It is real density
and it is not, on its own, enough to lift a nine-task chapter from thirteen minutes to twenty.
`qa/pacing.mjs` prints the remaining backlog directly, and it printed sixteen ORDINARY tasks over
ten chapters at 75 s a task — because an ordinary task costs its own time AND another crossing of
the map, which is why the number was so much smaller than it looks.

**THOSE SIXTEEN ARE BUILT, AND THE BACKLOG IS NOW ZERO.** 185 tasks over sixteen chapters, and
every chapter is inside the 20-35 band at 60, 75 and 90 seconds a task. The rule the sixteen were
chosen by is worth keeping, because it is what made them cheap: **use something the chapter has
already drawn and never used.** Every one of them is a thing that was in the world already —
Kyoto's stepping stones (described in their own comment as "the only dry way aboard"), the Arcos
da Lapa's deck, Rio's kiosk counter, the snowcat, the Koutoubia's palmeraie, the Drift's
weathervane, the campo's cistern head, the calli, Victoria Harbour, the Star Ferry's horn, the
jetty, the beach fire, and two of Göreme's five launch crews. Two of them needed geometry and
neither needed more than twenty lines.

**AND ONE OF THE SIXTEEN COULD NOT BE BUILT AS DESIGNED, which is worth more than the fifteen
that could.** 'Come up underneath an island' in the Drift is impossible: every island footprint
answers `driTerrain` with the island's TOP, and capybara.js's analytic ground backstop levitates
anything below it straight up. Measured — a capybara teleported twelve metres under the Shelf,
the Anvil and the Arch arrived on all three of their upper surfaces inside a frame. **The keels
are drawn and they are not a place.** It became 'Let the cloud hand you back' instead, which is
the chapter's own safety promise and had never been said out loud.

## THE SHAPE OF A CHAPTER — `act`, `acts`, `win` (v18 — 23 Aug 2026)

Seventeen chapters had exactly one structure between them: turn up, work
through eight to nineteen switches in any order you like, tick the one marquee
somewhere in the middle, three wheeks, leave. The CONTENT of them could not be
more different and the SHAPE of them never varied once in eight hours — and
shape is what a player feels at hour four rather than at hour one.

```js
// shared.js — TASKS, on any row
{ id: 'sandstorm', text: 'Stand in the sandstorm', chapter: 8, act: 3 }

// shared.js — CHAPTERS, on any row
win: 3,                                  // how many open rows the paper shows here
acts: [                                  // one entry per movement
  { kick: 'JEMAA EL-FNAA',   line: 'do not rob anybody yet. or do.' },
  { kick: 'EAST, THEN',      line: 'the maze stops. everything stops.' },
  { kick: 'AFTER THE STORM', line: 'it is evening, and somebody has lit a fire.' },
]
```

No `act` means act 1. The paper offers **the lowest act that still has anything
open in it** — not a counter that advances, so order does not matter, doing an
act-3 thing early does not skip act 2, and a restored save lands on the right
movement with nothing about the act written to the file. The paper's own header
becomes the act, so the structure is visible without one extra element on the
card. `todoActShown` is reset on arrival, so an act break can only fire once,
inside one visit, going up.

**TWO RULES, AND THE SECOND IS THE WHOLE SAFETY ARGUMENT:**

1. **Nothing is gated.** `completeTask` has never heard of an act and never
   will. An act stages the TELLING, not the world.
2. **F and a tap still reach every open row in the chapter**, whatever act it
   is in — `todoStep`/`todoPinTo` run on the full open list and the window
   follows the pin across a boundary. So an act cannot soft-lock a chapter and
   cannot hide a task from somebody looking for it. Measured in Iceland: one F
   from act 2 puts both act-3 rows on the paper.

**An act break is not a reward channel.** It gets `showPlace` — the game's
"something has changed" card, which is what an ARRIVAL uses — and a soft chime,
and nothing else. No lift, no confetti, no tick, no slow motion: `wow` keeps all
four and stays worth what it was worth. It is held back `sysACT_CARD_WAIT`
(2.9 s) because the tick that CLOSED the last act very often has a card of its
own, and two cards on one frame is one card nobody reads. It is cancelled if the
chapter finished inside that wait, or if the player left.

**Six of seventeen carry one, and eleven are flat lists.** That ratio is the
point: a game where every chapter has a twist has no twists in it. The six:

| | |
|---|---|
| 3 Circular Quay | THE QUAY (2) · OPEN WATER (5) · MANLY (1), `win: 3` — the chapter is a voyage and now reads as one |
| 7 Iceland | REYKJAVÍK (5) · OUT OF TOWN (3) · AND THEN SIT STILL (2) — a narrowing, into a chapter that ends in stillness |
| 8 Marrakech | JEMAA EL-FNAA (5) · EAST, THEN (3) · AFTER THE STORM (2) — the world already gated the fire behind the storm; the paper now says so |
| 10 Venice | LOW WATER (9) · ACQUA ALTA (3) — the one chapter whose entire argument is a turn |
| 16 Sơn Đoòng | no acts, `win: 2` — in the dark, two things at a time |
| 17 Antarctica | THE STATION (3) · THE ICE (8) · THE PACK (3), `win: 3` |

`qa/audit-tasks.mjs` enforces it: an act that is declared must have tasks, a
task may not be in an act that is not declared, the arrival is act 1 by
definition, and a chapter with no `acts` may not carry `act` on any row. It
warns if the marquee is in act 1 of a multi-act chapter — the chapter would
peak before it started. None of the six do.

## THE SHELF — `keep` (v18)

Seventeen chapters and nothing had ever crossed a boundary between two of them.
The departures board made travel cheap and in doing so made the chapters MORE
sealed rather than less: a menu of seventeen dioramas.

`CHAPTERS.keep` is one noun per place — *a tourist's hat*, *a piece of the
glacier*, *the station's enamel mug*. **You hold it exactly when the chapter is
finished**, and that is a PROJECTION of the save rather than a field in it
(`keepHeld(n) === chapComplete(n)`), so there is nothing to migrate, nothing
that can desync, and no way to hold one you did not earn.

It is drawn from `sysKEEPS` in systems.js — the same little shape table as
`sysMARKS`, three to six shapes each, in the biome's own palette keys, on a
32-square rather than the postcard's 64x40 because a souvenir is an OBJECT and
wants a square. `sysDrawShapes` is now shared by both; the marks keep
`preserveAspectRatio="none"` (a scene stretches to its tile) and the souvenirs
take `xMidYMid meet` (an object does not).

It surfaces in four places, and it is a REWARD FOR FINISHING A PLACE, which had
no per-item payoff at all before:

- the chapter ceremony's **second beat** — the souvenir card, `sysKEEP_WAIT`
  after the DONE card, no lift and no confetti because the ceremony has just
  spent all three channels;
- **the shelf** at the top of the journal — seventeen slots, always all
  seventeen, the unearned ones drawn greyscale at 0.30 so you can see there is a
  shape in the box and not what it is;
- **the title card**, bottom-left of a finished place's postcard;
- **the ledger**, below.

## THE LEDGER (v18)

`showEnd` was a full-screen div reading MISCHIEF COMPLETE, one number, and
`location.reload()`. A hundred and ninety-nine tasks, forty-two records,
seventeen places and eight hours resolved to one string and were then thrown
away — and it was the screen almost nobody ever saw, because it only existed at
199 of 199.

It is now built out of what the journey actually leaves behind: the postcards,
the souvenirs, the records and the clock, one leaf per place you have STOOD IN
(seventeen rows with eleven blank is a table; the ones you have been to are a
journey), each arriving on its own `sysLED_STAGGER` beat.

**And it is openable from the journal at any point** — "the journey, laid out".
The board answers *where can I go*; the ledger answers *where have I been*. A
retrospective one player in a hundred sees once is a trophy, not a feature.

- `jrChapMs[n]` is how long each chapter actually took, and it is saved
  (`chapms`). Additive: the version does not move, and a file written before
  this prints a tally with no clock beside it rather than a zero.
- **`jrChapAt.lastTotal` is now seeded from `jrCarriedMs` on restore.** It was
  not, so the first chapter finished after a reload reported its duration as
  every session that had ever been played.
- `sysFmtTime` grew hours. Under an hour it is unchanged to the character, so
  every record and every chapter time still reads as it did; the journal header
  was printing an eight-hour journey as `504:11`.
- z-index **66** — over the place card (58) and the journal (62), under the
  biome fade (70). Nothing may be drawn across the last word about a journey.
- The final tick of the game is always also the final tick of a chapter, so
  `showEnd` **waits for the ceremony it just started** (`1100 + sysKEEP_WAIT +
  sysKEEP_CARD + 500`) instead of opening underneath it at 900 ms. Finish the
  place, take the thing, then lay the journey out.
- Escape closes it and the world is still there. Reloading was the only thing
  you could ever do with the end of this game, and a sandbox whose ending throws
  the sandbox away has it the wrong way round. At the true end, a tap or Enter
  still reloads, exactly as it always did.

## THE DIVE IS A PROPERTY OF THE WATER (v19 — 23 Aug 2026)

`capyCanDive` was `!!api.canDive` and exactly three chapters published it. The
comment under it gave a good reason — the harbour is two metres of nothing over
a collision plane, and sinking into it would be a way to be STUCK — but that is
an argument about **depth**, and the game has a depth.

```js
function capyCanDive(game, x, z) {
  const api = capyBiomeApi(game);
  if (api.canDive === true)  return true;    // an explicit yes still wins
  if (api.canDive === false) return false;   // ...and so does an explicit no
  return capyWaterY(api, x, z) - capyGroundY(game, x, z) >= capyDIVE_MIN_D;  // 1.75
}
```

**The rule self-selects, which is the tell that it is the real question.** A
chapter that MODELLED a seabed gets the verb; one whose water is a flat plate
over nothing does not publish `terrainHeight`, answers 0, and is left alone.
Measured over all seventeen, as a percentage of wet cells with ≥1.75 m under
them and the deepest point found:

| | | |
|---|---|---|
| Sydney, Circular Quay | **0%** | no `terrainHeight`; the harbour stays a wall, exactly as the old comment demanded |
| the Drift | **0%** | the cloud is not water and has no floor. `handed-back` is untouched |
| Pasto, Marrakech, Cappadocia | — | no water at all |
| Cali | 24%, 1.9 m | a shallow city river; only the deepest cells |
| Kyoto | 47%, 3.9 m | the golden pond and the Uji |
| Venice | 100%, 2.5 m | the canals and the lagoon |
| Kowloon | 100%, 3.7 m | Victoria Harbour |
| the Pantanal | 41%, 4.5 m | the flooded campo — the one place the animal is from |
| Iceland | 91%, 13.2 m | the bay, in the dark |
| Rio | 96%, 13.0 m | the Atlantic off Copacabana |
| Antarctica | 95%, 30.1 m | under the ice |

Three chapters could dive; **eleven can now**. Nothing is gated on it and no
task changed.

### AND THE PICTURE HAD TO FOLLOW, OR THE VERB IS INVISIBLE

Palawan published `rig()`, `camFloor()` and `submerged()` for exactly this and
was the only chapter that could dive. Four things in systems.js, all of them
"the thing Palawan already measured, for everybody":

- **`sysSUB`** — one row per divable chapter: the fog near/far and two palette
  keys. Palawan's row is its four shipped constants, so that chapter is
  unchanged to the character. The fog does most of the work: Venice's canals get
  26 m and Rio's Atlantic gets 70.
- **`subT` is fed from the LENS**, against `sysWaterY` at the camera, in every
  chapter — the note that says to judge it from the lens rather than the animal
  was already there and is now obeyed twice. Palawan keeps its own smoothed
  value. `sysSUB_FADE` is 0.3 m.
- **The dive rig and the dive camera floor** are Palawan's numbers (5.0 m at
  0.12 rad; terrain + 0.95) offered as a **candidate, strictly greater** — so
  Palawan's own request wins on a tie and a biome that wants the camera more
  than the dive does (a river, a balloon, a helm) keeps it.
- **The eye comes IN rather than going UP.** Every clearance rule in the file is
  right in sixteen chapters and exactly wrong under water: an animal three
  metres down in a lagoon has the bank four metres behind the lens, and the
  terrain clearance dutifully lifted the eye over the paving. Measured in Venice
  before the fix: animal at −3.04, eye at **+2.90**, and the grade never fired
  because the lens never went under. The boom now shortens in eight gentle
  steps, stopping at the first one where the eye is not inside the ground, and
  the clearance is capped at `waterY − sysDIVE_LENS` at both call sites.

**And the grade block had to move.** It was nested inside `if (palT > 0.002)`
and is now after every chapter's own atmosphere and before the dome — because
`subT` can only be lit where there is a `sysSUB` row, which is already the whole
condition. `flat` (no sky to draw) and the vignette/saturation/threshold under
water came out of the Palawan block with it.

## THE FINDS — the things nobody tells you about (v19)

Every one of the 199 tasks is delivered the same way: on the paper, with an
arrow, a beacon and a distance. That is an excellent net, and it was the ONLY
way anything had ever been handed over — so in seventeen dense hand-built worlds
nothing had ever been **found**.

`FINDS` in shared.js is twenty rows of text; `sysFINDS` in systems.js is twenty
predicates over live world state, swept four times a second (`sysFIND_TICK`) and
never again once found. **Three rules they all keep:**

1. **Nothing is ever listed.** No paper row, no arrow, no beacon, no clue. If it
   needs telling it is a task and belongs in `TASKS`.
2. **Nothing can be missed** — any point, any order, for ever.
3. **Nothing is blocked by one.** No task, record, chapter or exit depends on a
   find, so a player who notices none of them plays the game that shipped.

The payoff is deliberately the **smallest channel in the game**: a toast, a
chime a fifth above the tick, six scraps of paper. A find is a private pleasure
and a banner would make it an achievement — and an achievement is something you
are told to go and get, which is the one thing a find may never be. They
accumulate on the **ledger**, under the place each one happened, in their own
line and their own colour.

`qa/audit-tasks.mjs` enforces: every row has a predicate, every predicate has a
row, no find id collides with a task id, and no find has a hint row.

### AND THIRTY-FOUR OF THEM BELONG TO A PLACE (v20 — the delight pass, 24 Aug 2026)

The design above reserved two fields for this in writing — *"`where` is the line
the ledger prints under the place it happened; `chapter` is 0 for the ones that
can happen anywhere and a number for the ones that belong to a place"* — and
neither field appeared on a single one of the twenty rows, nor was either string
read anywhere in systems.js. **Every find in the game was a question about the
moveset or the clock**: diving, climbing, cold, breath, stillness, distance
walked, being watched, highest ground, far corner, long drop. All twenty work
identically in all seventeen worlds, which is precisely why nothing in
seventeen dense hand-built places had ever been found *in* one of them.

- **`chapter: n`** means the predicate is swept only in chapter n. Gating in the
  sweep rather than inside each predicate is what keeps `findTick` cheap: the
  place finds outnumber the neutral ones two to one, and without it every one
  would be evaluated four times a second in all seventeen places, asking after
  a gondola in Antarctica. **A wrong number does not throw and does not warn** —
  the row is simply never reached — so `qa/audit-tasks.mjs` checks it against
  `CHAPTERS`, and warns on a chapter with none and on a chapter with over three.
- **`where`** is an optional ledger line for the rows whose toast does not read
  right underneath a place name. Two rows carry one.
- **Any field goes AFTER `text`.** The audit finds a row by matching `id`
  immediately followed by `text`; a field inserted between them deletes the row
  from four of the six checks in silence. The audit now re-parses whole rows and
  blocks if the two counts disagree.

**THE FOURTH RULE, and it is what the other thirty-four are held to: a place
find may not be a task with the paper taken away.** The test is whether a player
could plausibly do it without ever knowing it was there. Nine of the thirty-four
are literally *you were there and you did nothing*, which this game had never
rewarded once; several more are the deliberate opposite of the chapter's own
task in the same spot — the still bamboo against `bamboo-dash`, the walk up to
the mirador against `chiva-mirador`, under the arches against `o-bonde`, the two
worst seats in Kowloon for a light show whose task is the best one, and being
ignored in the middle of the rookery whose task is to start something in it.

**A THROW IN A PREDICATE IS NOW REPORTED.** It is still swallowed — one bad row
may not take the sweep down — but a swallowed find is indistinguishable from a
find that is merely not met yet, which over fifty-four rows is the failure mode
this table cannot afford. It writes `game.state.lastError` once per id per
session, which is the channel the harness already reads. It is never a
`console.error` and never anything the player sees.

**`game.noticed(id)`** is `taskDone` for the other table: read-only, count with
no argument. Nothing in src reads it; it exists so a find can be PROVEN to fire.

#### Five things that were drawn and could not be asked about (v20)

All additive, all read-only, and each one existed as geometry for versions
before anything could find out where it was:

| biome | member | why |
|---|---|---|
| `quay` | `bridge` | the one landmark the chapter is named after, built from `quayBRIDGE` and never published |
| `kyoto` | `heron()`, `heronStanding()` | the garden's only animal that can DECIDE to leave, and nothing could tell when it had |
| `iceland` | `fox()`, `foxInterest()` | it has answered a wheek inside `iceFOX_HEAR` since it was built and nothing could tell that it had |
| `cave` | `soaking()`, `nearestDrip()` | twenty-six drips, no way to ask where one lands |
| `environment` | `soaking(x, z)` | see the hook above |

**Each accessor that returns a point gets its OWN scratch vector** (`kyoV3h`,
`iceV3f`, `cavV3d`). Two getters sharing one is the Göreme `gorV3b` bug and it
costs a caller holding one of them the other one's answer.

**AND A PREDICATE MAY NOT ASSUME WHICH KIND OF THING A POINT IS.** The api
contract is *"a fixture is an object, a thing that moves is a function"* and it
is kept — but `craterCentre` is a Vector3 constant and `carroza()` is a call,
and a predicate that guesses wrong does not crash, it **silently never fires**.
`findPt(v)` in systems.js resolves either. The crater's find was written
`typeof a.craterCentre !== 'function' -> false` and was unreachable in a way
that neither the audit nor a soak would ever have shown.

Two of the four families are load-bearing on the other two passes: **what you
brought** is the moveset arriving where it was never taught (dive, climb, cold
water), and **what nobody saw** is the only place wariness is allowed to bite.

## WARINESS — the world remembers you for half a minute (v19)

For eighteen versions `rec.alarm` damped to zero in under a second and nothing
survived it: rob a stallholder, be chased, be shouted at, and four seconds later
you were an unremarkable rodent again. That is the missing half of the mischief
loop — approach, get spotted, back off, come at it another way.

`wary` is 0..1 on every person in both crowds this codebase owns, and it is
**derived rather than set**: `stepHuman` takes it from `alarm` (so all six
existing causes feed it for free and no call site learned a new word), and the
locals take it from `localsReact` — but only when the animal was within
`npcWARY_BLAME` (7 m) of the event, or a square would turn to watch you because
a shutter fell over on the far side of it. It decays **linearly** over
`npcWARY_T` (26 s), because a memory that fades exponentially never quite goes.

**What it buys is attention and nothing else:**

- locals watch you from `npcWARY_NEAR` × further out, and go on watching;
- the Sydney/Quay crowd notices you from `npcWARY_SEE` m further and re-notices
  three times as often;
- and both have a line for it (`npcLOC_SAY.wary`, `npcLINES.wary`).

**IT DOES NOT DENY ANYTHING.** Not one of the 199 tasks is harder, no grab
fails, nothing is lost. The stakes live in the finds instead, where four rows
were written knowing wariness exists — which is why the old content could not be
destabilised by it. `game.npcHeat(x, z, r)` answers how many people near a point
are currently watching for you, both crowds in one number — **gated on the live
chapter, and reading `max(wary, alarm)` for the two old casts, since v33; before
that it swept a frozen Sydney in seventeen chapters and never swept Pasto.**
`game.placeHeat(x, z)` is the accumulator that sits on top of it — see BATCH
SEVEN below.

Measured: three wheeks beside the Botanic Gardens crowd took the maximum from
0.00 to 0.95 with five people watching; twenty seconds later the heat was 0.

### A KINEMATIC CARRIER: FIVE RULES, AND THE ONE THAT KEEPS BEING RELEARNT

Nine of the thirteen minis are things that carry the animal, so this is written down once:

1. `mass: 0`, `type: CANNON.Body.KINEMATIC`, `allowSleep = false` (a sleeping body is skipped in
   narrowphase, and a floor that stops existing is the worst bug in this game).
2. **Move it with `velocity`, and NEVER by assigning `position`.** A body whose position is
   assigned every frame is a body cannon never integrates: the contact under the passenger is
   remade from scratch each step, there is no relative velocity for friction to act on, and the
   passenger slides off on the first corner. Measured on Cali's barrow, every run.
3. **Difference against the PREVIOUS TARGET, not against the body's own position** — cannon
   integrates kinematic bodies inside `world.step`, which runs before every module update.
4. Yaw goes through `angularVelocity`; pitch and roll go on the MESH only. Rate-integrating three
   axes to hold a body on a switchback is a lot of machinery to tilt a collision box eight degrees,
   and the box is what the passenger is standing in.
5. Render from `interpolatedPosition`, never from `position`.

The two carriers that break rule 2 on purpose are the player's own ferry and the balloon basket,
and both park their passenger by hand for exactly that reason. Palawan's manta is the third and
it is not a precedent to reach for: it rolls its passenger through a full revolution under water,
where there is no floor and no contact to have.

6. **DO NOT ASSIGN THE PASSENGER'S VELOCITY UNLESS THE CARRIER RISES AS FAST AS THE ANIMAL DOES.**
   Venice's Volo was written the way the balloon is written — `carryFrame()` for the horizontal
   and the vertical assigned inside the biome — and it threw its rider off the top of the haul on
   every run. Measured: a steady 0.44 m over the cradle floor for thirty metres of ascent, then
   0.78, then thirty-two metres down onto the paving. Assigning the velocity makes the animal
   match the floor EXACTLY, so it never penetrates it, so there is no contact at all; and a
   DECLARED frame is latched for `capyPLAT_AIR` (1.2 s) whether or not anything is underfoot. At
   the top of the ease-out the cradle slows, the animal — genuinely in free flight — does not, and
   it carries its whole horizontal frame over a 26 cm kerb. The balloon needs that machinery
   because it rises at the same rate the animal does. A winch does not: a floor coming up at three
   and a half metres a second under an animal standing still is as honest a contact as this solver
   ever gets. Ordinary friction, ordinary contact sniffing, no biome-side writes.

   The safety argument is the ACCELERATION and not the speed. Smoothstep over thirty-two metres in
   twelve and a half seconds peaks at 1.3 m/s², an eighth of a gravity, so the floor never falls
   away from its passenger. Hong Kong's lion is on the same rule: its leaps are half a metre over
   two seconds — a tenth of a gravity — which is why a carrier that jumps can hold a passenger at
   all.

7. **AND A CARRIER'S WHOLE ROUTE MUST BE CHECKED AGAINST THE WORLD'S OWN STATIC BOXES.** The Volo's
   first top anchor was (11.4, 33.4, -18.6), which is inside the campanile's own collider on all
   three axes; the cradle rode perfectly for thirty metres, entered the tower over the last two,
   and the solver resolved the overlap by ejecting its passenger. Same family as the herd running
   through a fairy chimney. Check the ENDPOINTS as well as the middle.


## THE TWO LOOPS, v37 — THE GHOST AND THE INCIDENT (29 Aug 2026)

The two that ADD a loop rather than finishing one. Both are built out of machinery that was
already running; neither adds a task, a key or a gate.

### THE GHOST — `capy.ghost`

While an attempt is open on a record you already hold, your own best run is played back beside
you, translucent, at the same point in its own clock.

**Ownership is split and the split is the design.** systems.js owns the TRACE — it knows when
an attempt opens and closes (`recordLive` / `recordEnd`), whether a figure improved
(`recordValue`), and it owns localStorage. capybara.js owns the ANIMAL. Two functions between
them:

    capy.ghost.show(x, y, z, yaw, a)    a is 0..1 of the material's own opacity
    capy.ghost.hide()
    capy.ghost.on()                     harness only; nothing in src reads it

- **One mesh, not eighteen.** `capyModel`'s parts are baked ONCE, at construction, into a
  single geometry with the rest pose folded into the vertices — which is also the only moment
  the model is in a pose worth freezing, because the gait, the loaf and the idle beats have
  not run yet. Built on the FIRST `show`, so a player with no record never pays for it.
- **One material of its own, and NOT a clone of the fur.** `mat()` caches by colour and
  options, so a cloned fur material is either shared with the real animal (a wetness write
  would dye the ghost) or a fresh one that misses the cache. Flat, transparent, no shadow
  either way, `depthWrite: false`.
- **Five rules.** It gates nothing and cannot fail you. There is no ghost on a first attempt,
  because a trace is only kept when a figure IMPROVES — a property of the mechanism, not a
  rule to remember. There is no readout of the gap, ever. It has its own storage key, oldest
  out on quota, for the reason the album has one. And **a run that did not go anywhere is not
  a run**: `sysGHOST_MIN_M` sorts the fifty-three out by itself, so the glacier and the Uji
  qualify and a four-minute sit in a hot spring does not.
- **Four floats a sample at a FIXED rate**, so a sample's time is its index and nothing
  carries a clock. Two decimal places.

**TWO TRAPS.** A second go at the SAME record is a new attempt and "the id changed" cannot
see it — `ghWasOpen` is what does. And `ghId` is deliberately NOT cleared when the line
closes, because a chapter may file its record after `recordEnd` or after the watchdog, and
`ghKeep` has to still recognise the trace it is handed.

### THE INCIDENT — `capy:incident`

Three things you did that somebody saw, in one place, inside twelve seconds. systems.js
decides WHEN; npc.js decides what it sounds like.

| | |
|---|---|
| what counts | a prop hit over `sysINC_HIT` · something in the water · something broken · something taken off its owner — each of them **only if `prop.disturbed`**, which is props.js's own causation stamp |
| who saw it | `findPeople(x, z, sysINC_SEE) > 0` |
| tiers | 3 → `AN INCIDENT` · 5 → `A SCENE`, half a lift, a chime, a card, confetti |

**`findPeople` AND NOT `npcHeat`.** `npcHeat` answers "who near here is watching FOR you" —
it counts only people whose `wary`/`alarm` is already over `npcWARY_HEAT`, i.e. people you
have already had a go at. As a gate on the FIRST event of a chain that is a chicken and an
egg: measured, six hard impacts two metres from the animal in a Venetian square and heat was
zero for all six.

**THE COOLDOWN GATES THE CARD, NOT THE COUNTING, and starts when the chain ENDS.** Checked at
the top of the counter — the obvious place — it silently makes the second tier unreachable,
because a chain that has just carded stops being counted and `incN` can never reach five.

Four things keep it from being noise, and all four are measured: one prop counts once
(`sysINC_SAME`); it has to be one place (`sysINC_R` from the first); the cooldown; and the
audience. It obeys the finds' three laws — unlisted, ungated, unmissable — and breaks their
fourth on purpose: it is **repeatable**, because it is a moment and not a collectible.

npc.js answers in three casts, as every reaction in that file has since v30: `incident` in
`npcLOC_SAY` for the seventeen locals chapters, and `npcINC_SYD` / `npcINC_PA` for the two
that have none. Held to the pools' own chapter-neutral standard **and one rule further: none
of them may name what was done**, because the same line is spoken over a knocked-over crate,
a stolen hat and a bicycle in a canal. All any of them can be about is the pattern.

---

## THE LIFT PASS, v36 — FIVE THINGS THAT WERE ALREADY BUILT (29 Aug 2026)

Five systems that existed, were paid for, and were reaching a fraction of the game. Nothing
here invents a mechanic, adds a task or gates anything; every one is a channel that was
already open being pointed at the rest of the game.

### 1. `par` — a target before there is a best

`RECORDS` rows may carry `par: n`, an authored figure meaning "this is what a good one looks
like". **It gates nothing.** A row without one behaves exactly as it did; thirteen of the
fifty-three have none, because a par nobody can defend is worse than no par.

- **The live line** prints the par where it printed `no best yet`, and the running number
  goes the ticked-row green when it is past whatever the line is showing.
- **`recordValue` still says nothing on a first run.** That silence is the v32 doctrine and
  it stays. What is new is one sentence the first time a figure MEETS the par — a different
  fact from beating yourself, which is why it may happen on a first attempt.
- **Nothing new is stored.** "Have I passed par" is `jrRecs[id]` read against `par`, the same
  way the shelf is the tick list read differently. A reload cannot say it twice.
- **Every figure is derived from a constant the source already states** — the task's own gate
  improved on, or a fraction of a population or a length that is written down. Provenance is
  on the row.

**AND EVERY RECORD HAS A LIVE LINE NOW.** Twenty-one of fifty-three never called
`recordLive`, so for two fifths of them the block whose own comment calls that readout "the
whole of the game's replay surface" was dark. `qa/audit-tasks.mjs` **fails** on a record with
no live caller and reports the par coverage.

Two shapes, and the choice is not a style question:

| | |
|---|---|
| **a clock or a distance** | hand it over EVERY FRAME the attempt is open |
| **a count** (pigeons up, chips won, stools over) | call it ONCE on the frame the number moves. `sysREC_STALE` (1.6 s) takes the line down by itself, so it is a flash and not furniture, and it costs no timer and no new state |

**A LIVE LINE MUST REPORT THE QUANTITY THE RECORD FILES.** The Drift's `updraft` files
`driColPeak`, an ALTITUDE, while the task is measured on a RISE; a line showing the rise
would have been a different number under the same label. One deliberate exception, named in
the source: Monte Carlo's `chip-stack` shows what you are up NOW against a best that is the
peak, because "you are 6 up, best 14" is a true and useful sentence and "peak 14, best 14"
is not.

**ONE SLOT, SO ORDER IS THE API.** `recLiveId` holds one attempt; the LAST caller in a frame
owns the line. A chapter with two open attempts decides which by call order — the Quay's
dolphin escort sits below the voyage clock on purpose, Monte Carlo's tunnel below the lap.
Where two systems in different update functions can be open at once and the wrong one runs
later, a small timer is the fix: `monChipShow` exists because the wheel runs before the floor
and the chip flash otherwise lived exactly one frame.

### 2. `game.addCrowdBodies` — a crowd you cannot walk through

props.js owns it, main.js promotes it onto `game` **after `createProps`** (`game.physics` is
assembled there, not in `createPhysicsWorld`). Signature:

    game.addCrowdBodies({ n, at(i, out), moving, y })  ->  { bodies, moving, step(at) }

`at(i, out)` writes the i-th person's **foot** position into `out` and returns `false` for
anybody who is not there.

| | |
|---|---|
| `moving: false` (default) | ONE body, N shapes, offset into place. Correct whenever nothing moves after placement — one broadphase entry for three hundred people. Rio's pattern. |
| `moving: true` | one body EACH, because a compound body cannot move one of its shapes. Call `handle.step()` from the chapter's update, AFTER the loop that moved the people. Kowloon's pattern. |

Four rules, all of them paid for:

1. **The box is npc.js's** — `CANNON.Box(0.26, 0.85, 0.24)` on `game.mats.npc` — or a person
   drawn by a chapter feels different from a person drawn by the locals rig.
2. **The shape is offset by its own half-height.** `at()` gives the feet.
3. **A moved body carries all three of cannon's position fields AND sets `aabbNeedsUpdate`.**
   The three fields are the render transform; the flag is the BROADPHASE. `position.set()`
   does not set it, so a hand-moved static body keeps the AABB it was built with for ever and
   both the contact test and `raycastClosest` go on using it. Every box in the right place and
   Venice still measured 44% solid.
4. **It is not a wall.** These bodies are deliberately in no chapter's static/solid list: a
   crowd is something you push through the edge of, not something to route around.

`at` returning `false` for a moving crowd **parks** the box under the world rather than
skipping it — leaving it where it was is an invisible body standing in the square, which is
worse than the ghost it replaced.

### 3. The calm registry has two halves and only one was used

`game.addCritter` publishes `near` AND `appr`, and every chapter before v36 read only `near`.

| | |
|---|---|
| `near` | a FLEE radius shrunk by how settled the player is. `if (d < cr.near) spook()` |
| `appr` | 0..1, how much this animal has decided to come over. For an animal that does not flee, what stillness buys is that it notices you from FURTHER — multiply the radius it already had |

Antarctica's seal and colony and the Drift's lampflies are the first readers of `appr` outside
Iceland. **Ten of nineteen chapters still register nothing, and that is a content gap and not
a plumbing one:** they have no living animal with a proximity reaction to register.

### 4. `npcLINES` goes through `localResolve`

`pickLine` runs the same `{ t, after, before }` gate every other chapter's pool goes through,
so **Sydney and Pasto** — the two oldest casts, the two with the most tasks in the game, and
the two that predate `addLocal` — can react to what you have done. `qa/lines.mjs` audits
npc.js as a SET of two chapters and scores its floor **per chapter**, or Sydney's twenty-eight
would carry Pasto's zero.

### 5. `albShotOn(biome, host)` — three surfaces, not one

The album's `albBest` had one reader. It has three: the picker tile, the ledger leaf and the
departures board row. The authored mark is still built, still appended, and still the ground
and the tint under the photograph; a place you have never photographed is unchanged. **Not**
the chapter-done card (a ceremony is the game's own voice) and **not** the shelf (that holds
the object you took, a different question). The board's rows are built ONCE at boot and only
their text is refreshed, so the image is latched per row — appending on every refresh stacks
a hundred of them on one span.

---

## THE MOVEMENT PASS, ROW 5b — THE SECOND FLIER (v35 — 28 Aug 2026)

The last open row of `qa/MOVEMENT-PASS.md`, and the sixth time this codebase has replaced a
list of biome names with the question the list was standing in for. Full log in that file.

**A CHAPTER HOSTS A FLIER BY PUBLISHING `thermals`.** `condor.js` has called itself
biome-neutral in its own header since it was written, and the flight law is — lift with the
square of airspeed, induced drag, a G-limited elevator, a weathervane yaw. The plumbing was
not: every terrain sample, the fence, the updraft, both early-outs, the marquee shot and all
three task ids went to `game.pasto` **by name**. `condorHost()` resolves the live biome
instead. The contract, in full:

| | |
|---|---|
| `thermals` | **REQUIRED.** Array or getter. No thermals, no host, no bird. |
| `terrainHeight` | ground under the bird. Missing → sea level |
| `bounds()` | the fence. Missing → `condorFENCE_FALLBACK` |
| `condorShot()` | the chapter frames its own launch. Missing → the rig's own |
| `craterCentre()` | Pasto's joke, and Pasto's alone. Missing → no rim task |
| `flier` | `{ name, plume, tasks }` — appearance and which lines it ticks |

Strengths are in **pasto.js's units** — the updraft acceleration, mapped through
`condorTHERMAL_ACC_PER_MS`. A second host inventing its own scale is how two chapters end up
with the same bird flying differently.

**PLUMAGE BELONGS TO THE HOST AND IS SIX COLOURS.** The silhouette of a big soaring bird is the
same bird everywhere; the plumage says which one. Baked into a merged geometry with
`vertexColors`, so it is a rebuild rather than a material write — `condorRePlume()`, called from
the summon, which is the one moment the bird is guaranteed to be off screen. The only state
`condorBuildMesh` owns is the wing rig and three pivots, all cleared there. Not in `PALETTE`: a
bird belonging to one chapter belongs in that chapter's file, like the grade and ambience rows.

**A BIRD BELONGS TO THE CHAPTER IT WAS CALLED IN.** The despawn line read `e.name !== 'pasto'`,
and the obvious translation — `if (!condorHost()) condorDespawn()` — is wrong: it keeps the
bird alive across a border between two hosts. Despawn at **every** border; the host only
decides whether a new one can be called on the far side.

**A MODULE LATCH MAY NOT GATE A CHAPTER'S TICK.** `condorRodeOnce` / `condorSummonedOnce` mean
"the player has done this before" — global, and what arms the low orbit. The tick is the
host's, fired every time, because `completeTask` is idempotent. The marquee keys off
`completeTask`'s **return value**, true only on a genuine first completion, so each host gets
its own payout.

**A RECORD IS FILED WHEN THE ATTEMPT ENDS.** `game.record` shows a card whenever it beats the
saved value, so filing on every improvement files every few centimetres of climb — measured as
four stacked *personal best · carried up to 9 m* cards over Copacabana. `recordLive` on the way
up, `record` once on release. It needs a climbing flight to show, which is why one chapter of
thermals never surfaced it and two did.

**Chapter 6 hosts the second.** Four columns off the sunward faces of Pão de Açúcar, Morro da
Urca and the Corcovado massif; a fence at ±150 / −120..130; two ordinary tasks and
deliberately no `mini` — Rio already carries the wow and two minis, and no chapter has two of
the same kind of moment. Pasto unchanged: same 200 m ceiling over four 45 s runs, identical
thermals, bounds and terrain. 231 tasks, 19 chapters, `qa/fuzz.js` 19/19 with 0 errors.


## THE LIFT PASS, BATCH EIGHT — THE INDEPENDENT LIST (v34 — 27 Aug 2026)

Nine per-chapter rows that contend with nothing, plus one restatement. Six fixed, four
restated with a current measurement. The Lift Pass ends here. Full log: `qa/BATCH8.md`.

### A PROCESSION STOPS FOR A CAPYBARA (pasto)

**The oldest open finding in the game was a kinematic slab, and it was never a velocity write.**
Three passes hunted a bare `body.velocity` write in Pasto because a parked animal drifted 8 m in
60 s while holding *exact* velocities. Instrumented properly — a `Proxy` on `capy.body.velocity`
tallying every setter by stack trace — there are exactly three writers and all three are
`capybara.js`. A `Proxy` on `body.position` named it in one run: **every millimetre came from
`world.step` at `main.js:993`**, cannon's integrator answering a contact with `pastoCarBody`.

The Carnaval float's collider is 3.24 × 6.60 m, stands **on** the cobbles (y 0…1.55) and runs
the x = 10.5 line. Spawn+(9,9) is x 9.0, which is **0.12 m inside its near edge**. It drove
through the animal at 2.15 m/s and pushed it the length of the plaza in silence.

And the "exact −3.000" everybody read as a bare write was `capyPIN_VMAX` — the anti-creep pin
saturating against a push it could not beat. **The tell was the fix fighting the bug.**

1. **A KINEMATIC BODY DOES NOT NEGOTIATE, SO THE YIELD HAS TO BE UPSTREAM OF THE CONTACT.**
   `pastoCarBlocked()` holds the float while the animal is in the lane. Being ABOARD is not
   being in the way — the deck is 1.55 m up and riding it is the chapter's mini.
2. **THE REAR BOUND OF A "SOMETHING IN FRONT OF ME" TEST IS THE BODY'S OWN BACK FACE, NOT ZERO.**
   `ahead > 0` waves through the case where the animal is standing *inside* the footprint,
   which is exactly the case the first cut of this fix leaked at 30 m. `ahead > −HZ`.
3. **AND NOT AS FAR BACK AS THE BOARDING POINT.** The hitch is at −3.72 and is the way aboard;
   she must keep rolling while you climb it.

Differential, four float phases, 60 s parked, no input: **9.18 · 28.76 · 7.63 · 7.98 m without;
0.24 · 0.42 · 1.78 · 0.61 m with.** `qa/stillness.js` no longer lists Pasto at all.

**The residual is not a defect.** At the actual spawn the animal still moves ~0.2 m per 10 s,
one writer, every 2.6 s: `paShoveCapy(rec, 78, 46)` from `paStepHuman` — the abuela, chasing,
connecting with the broom, through `applyImpulse`. `npcBlockedFor` gates chase out on purpose.

### A LADDER HOLE THAT CLOSES BECOMES A LID (kowloon)

`HOLE = (b === nBay) ? 0 : 2.2` stopped a player topping out over an open shaft and made the
topmost scaffold deck a continuous plank at y 34.68…34.92 **directly over the climbing face**.
Measured: the climb line is x −9.07, the head meets the underside at 34.68, the climb tops out
at 34.365, and the roof deck's edge is 0.63 m west with nothing in between. That is the whole
of "the roof is 0.65 m out of reach" — **a height, not a distance**, and `hkSCAF.top` (34.8) is
innocent of it.

**The hole moves rather than closing.** The top deck is two planks with a 1.30 m slot between
them **along the outer face, where a climber actually arrives**, instead of a hole across the
middle where the beacon points. climbPeak 34.36 → **34.85**; tops out at 13.2 s; four seconds
after letting go it is standing at y 35.06 instead of falling 34 m.

**RULE: a deck over a climbable face is a ceiling. Check the climb line against every collider
above it, not just the ones beside it.**

### A POOL OF LIGHT IS ROUND *AND* IT IS THE SIZE OF ITS SIGN (kowloon)

The comment warning against a rug was right; the arithmetic under it was not.
`rr = (w + h) × 0.42` drawn at `rr × u × 1.5` is an outer **radius** of `(w + h) × 0.63` — nine
metres across for an ordinary sign, sixty of them, overlapping. Now `× 0.25`: **a sixth of the
area**, one pool about as wide as its own sign. Judged from the arrival PNG, not the number.

### A PUBLISHED API WITH NO READER IS A DECISION NOBODY MADE

Three of them, all now read, all proved firing live:

| api | reader |
|---|---|
| `palawan.inZone('shaft')` | **`in-the-shaft`**, a new chapter-12 place find — down on the sand, in the beam, five seconds |
| `cave.nearestDrip()` | **`wet-in-a-mountain`**, which now requires you to be within 2.4 m of one. It used to mean "wet, and still, anywhere in the mountain" — which the river satisfies too |
| `cave.echoReady()` | **`let-it-return`**, a new chapter-16 place find — the cool-down running *is* the echo still out |

FINDS 58 → **60**. `qa/audit-tasks.mjs`: 0 blockers, 0 warnings, 19 of 19 chapters.

### THE ROUTE-DENSITY PROBE MEASURES PLACEMENT STYLE, NOT DENSITY

Re-run over nineteen: Monte Carlo 11 → 9, Kyoto 10 → 7, everything else 0–4, with nothing done
to any of them. Then the cells were photographed, and **the number does not mean what it says**:
Kyoto's dead cells put the camera *inside a Gion machiya* with the wall two metres away.
`route.js` locates a mesh at its **bounding-box centre**, so a chapter of large merged surfaces
reads as empty from a metre away and a chapter of 13,458 scattered instances scores zero.
Monte Carlo's are a straight line over the headland, which is not a walk.

**Nothing padded** — and Manly's 617 objects, the same measure's other alarm, is the same fact:
photographed from three cameras, Manly has the crescent, the pines, the Corso, the ocean pool,
both headlands and a full beach, and 30.5% of its plan is water. Decision recorded: leave it.

**RULE: before spending work on a ranking, check that the instrument ranks what it names.**

### ONE MORE ANIMAL IN THE REGISTRY (venice)

Venice's pigeons now call `addCritter({ biome: 'venice', r: venPIGEON_R, bold: 0.85 })` and the
flush reads `.near`. The square with the most famous pigeons in Europe in it had a flush radius
that could not hear the player being still, in a chapter whose `pigeons-back` find is about
exactly that. 6 of 19 chapters register a critter now. The other thirteen were checked one at a
time: Antarctica's penguins *deliberately* ignore you (`ignored` is a find), the Pantanal's
egrets are a timed marquee flush, and the remaining eleven have no ground animal with a
proximity radius — content to author, not a flag to clear.

### RESTATED, NOT RE-LITIGATED

- **Iceland's snowcat stays at x 34.** Measured, not asserted: the moraine is the flat shelf at
  x ≥ 26 and everything at x ≤ 22 is glacier ice at slip 1.0, so the track can move six metres
  of a fifty-four metre walk before it hangs over the ice. And it is a walk, not a miss —
  `iceCAT_HOLD_R` 58 / `iceCAT_HOLD_MAX` 26 reach the runout, and with the animal parked at
  (−20, −86) the machine **held at the bottom for 26.4 s**.
- **Room tone is still keyed per biome, not per space.** Declined a third time. Venice and
  Palawan remain its worst cases. Unchanged from v27.

`qa/fuzz.js`: 19 chapters, 0 errors, 0 NaN, 0 void falls.


## THE LIFT PASS, BATCH SEVEN — THE PLACE REMEMBERS (v33 — 27 Aug 2026)

The genre this game is styled after runs on one loop: approach, get seen, be driven off, come
back another way. **The first half was built and built well** — `npcHeat`, the witness chain,
the wary lines, a twenty-six second memory per person, 477 conditional lines over 17 casts.
The second half did not exist. There was no state above the individual, so a square you had
been tormenting for four minutes was exactly as easy to walk into as one you had never
visited, and that is why hour six played like hour one: the list got shorter and the world
never changed its mind.

`state.chaos` is not that state and never was — one wheek takes it to 0.21 and it is back to
0.07 in 8.7 s, and its only two readers in the repo are a music-layer gain and the calm
counter.

### HEAT IS AN ACCUMULATOR ON TOP OF WARINESS, AND IT IS A FIELD

`npc.js` owns it; `game.placeHeat(x, z)` publishes it; `game.state.heat` and `.heatN` are the
live figures. Its input is the existing `npcHeat(x, z, r)` — "how many people near here are
watching FOR you" — so nothing new is measured and **mischief nobody saw is worth nothing**,
which keeps the finds exactly as they were.

**A field and not one number, and the diameters decided it.** The people-span of all nineteen
chapters was measured for this decision (`qa/b7-diam.js`, chapter list derived from `CHAPTERS`):
median **169 m**, from Palawan's 90 to the Quay's 638, and only two under a hundred. A single
number per chapter would mean robbing the market makes the far side of the plaza harder, and
that is wrong in seventeen of the nineteen.

**The radius and the range are derived from each other**, which is trap 3 of the closeout
obeyed by construction rather than checked afterwards:

    npcHEAT_R = npcCHAIN_R × npcHEAT_LOOK = 20 × 1.6 = 32 m

The floor is the chain radius — the measured distance at which one person in a square hears
another — times the largest range multiplier heat can buy, so **a witness can never be
recruited from outside the heat its own witnessing creates**. The ceiling is half the smallest
chapter's people-span (Palawan 90 → 45). If `npcHEAT_LOOK` moves, the radius moves with it.

Six sites per chapter, merge at R/2, **90 s linear decay** — 3.5× the 26-second personal clock,
because the point of it is that the individuals have forgotten and the square has not. Decayed
above the biome gate: a place cools in real time, not in chapter time.

### WHAT IT MAY BUY, AND THE LIST IS CLOSED

**Attention, and nothing else.** Nothing is denied, nothing lost, no task made harder — the
same sentence the wariness block has made since v19, one layer out. There are eight readers of
the field and they are: two look radii (`localsReact`'s circle and the chain's), the locals'
head-turn radius, the two old casts' notice radius, the wary/laugh register threshold, the
notice cooldown, a 0.55 m shuffle bias, an arm rotation, and a music gain. **None of them is a
gate**, and the one that can obstruct anything — the guard shuffle — is the one with a proof:

- max drift from a chapter-given anchor is **0.54 m hot and 0.54 m cold**, both at
  `npcLOC_STEP_R`. Heat POINTS the shuffle; it does not lengthen it.
- **0 of 19 chapters** move anybody more than `npcLOC_STEP_R` toward a prop, hot or cold.
- the guard refuses any target within `npcHEAT_GD_R` (1.6 m) of **any** prop home in the live
  chapter, not merely of its own stock. The centroid-only version measured a systematic
  closing in eleven chapters of nineteen.

### FOUR RULES THIS COST

1. **AN INCIDENT IS NOT A FRAME.** The witness chain arms on every startle and a wheek in a
   thirty-eight-person park startles most of it, so four seconds of ordinary play took the
   field from 0 to 1 with twenty-six bumps logged. A site may be bumped once every
   `npcHEAT_GAP`. Ten people turning round at once is one thing that happened.
2. **ONE WITNESS IS AN INCIDENT, SEEN — NOT A THIRD OF ONE.** A step proportional to the
   witness count made a single witness worth 0.116, gone in ten seconds against a 90 s decay,
   in exactly the chapters with six to ten people over a hundred and fifty metres where one
   witness is the normal case. The step is mostly flat; the count is its top four tenths.
3. **`wary` IS ONE FRAME BEHIND ITSELF IN SYDNEY AND PASTO.** A local's is written inline by
   `localsReact`; those two derive it from `alarm` inside `stepHuman` on the NEXT tick. Anything
   that asks who is watching at the instant of an event must read `max(wary, alarm)` — measured,
   two people at wary 0.64 three metres away and `npcHeat` answering 0 on the frame.
4. **AND `npcHeat` HAD NO LIVE-BIOME GATE.** `stepHuman` runs only while Sydney is attached, so
   a Sydneysider startled on the way out of chapter 1 is frozen wary for the session, at a
   coordinate that exists in every other chapter. `most-wanted` and `not-a-soul` — the two finds
   that read it — were answering questions about a park in Sydney in seventeen chapters. And it
   never swept `paHumans`, so chapter 2 could not raise heat at all.

### THE MUSIC (systems.js)

`chaos` is a spike and a 2.5 s chase tail was the rest of the input, so the layer could say
"something just happened" and could not say "this is a square that has had enough of you".
Heat does both halves of *sustain*: `sysHEAT_HOLD` slows the chase tail (2.5 s reads as 8.3 at
full heat) and `sysHEAT_MUS` puts a quarter-height floor under the intensity. It cannot reach
the top on its own, because a hot square is a mood and a chase is still an event.

### `forceHeat` IS A TEST HOOK AND NOT A VERB

`game.forceHeat(1)` / `(0)` pins the field and `(-1)` releases it. "Zero tasks made harder" is
only provable by running the same sweep twice with nothing else different, and this is cleaner
than a stash because there is nothing else that could have moved between the halves.

## THE LIFT PASS, BATCH SIX — THE NUMBER AND THE FIRST FRAME (v32 — 27 Aug 2026)

Two shallow sweeps across all nineteen chapters. Neither invents a system; both take something
the game already had and make it visible at the one moment it is worth seeing.

**The through-line is that both were already written and both spoke too late.** `recordValue`
has filed 53 numbers since v18 and says nothing until the run is over. `frameShot` has been
able to compose a shot since v26 and no chapter had ever asked it for the one shot every
player is guaranteed to see. Neither of these is a repair; both are the same move — take a
thing that exists and point it at the moment it is for.

### 1. THE RECORD YOU CANNOT SEE WHILE YOU ARE SETTING IT

`game.recordLive(id, value)` / `game.recordEnd(id)` — one channel, two verbs, on the pattern
every other cross-module thing here uses. It writes two strings into a div under the tally on
the to-do card and it does **nothing else**: it cannot gate, deny or fail anything, and
`recordValue`'s contract is untouched.

- **It is meant to be called EVERY FRAME the attempt is open**, out of the same block that is
  already incrementing the timer the biome eventually hands to `game.record`. That is what
  makes the watchdog possible, and the watchdog is what makes the whole thing safe: a chapter
  that forgets `recordEnd` still drops the line `sysREC_STALE` (1.6 s) later, so **"no attempt
  open" is the resting state of the mechanism rather than a promise nineteen chapters have to
  keep**. Crossing a border ends any open attempt outright, the way shake and time do.
- **`recText` does the formatting and nothing new was written.** With no figure yet the line
  IS `recText(id)` — the standing best, which is the target. With a figure it is the label,
  the live value and the unit on the first line and `best NN unit` on the second.
- **A first attempt still says nothing at the end.** That silence is deliberate and stays. The
  live readout is what a first attempt gets instead.
- **`sysREC_STALE` is wall clock**, on `rawDt`, for the same reason the finds are: an attempt
  does not stop being open because a `wow` put the world at 0.45x.

**Wired in 31 places across 19 of 19 chapters.** Measured, sixty seconds of ordinary play in
each of the nineteen at ten samples a second: **17 of 19 show the line for 0 of 605 frames**.

**A RIDE NEEDS A FLOOR, AND THE FLOOR IS THE RECORD'S OWN.** Rio's wave and Manly's surf ride
are `on` for any swim in the shore break, so the line was up for 187 and 310 of 605 samples of
wandering — a permanent counter on two beaches. Both now ask for two metres of ride before
they say anything, which is the cheapest thing that is a ride; on the sand, in the same sixty
seconds, both read **0 of 603**. Every other wired ride borrows its floor from the number the
record itself refuses below (8 m for the van, 6 m for the float, 12 m for the balloon and for
Hanoi's scooter, 8 m for Monte Carlo's roof).

**AND SOMETHING THAT HAPPENS TO YOU IS NOT AN ATTEMPT.** The Pantanal cowbird lands on its own
and rides for up to seventy seconds; it was on the brief's list of measured runs and it is the
one that does not belong there. 60 of 60 samples standing still, 562 of 605 even gated on the
animal moving. It has no live line. The line belongs to things a player GOES AND DOES.

### 2. THE DONE-FLAG THAT FREEZES A RECORD — SIX OF THEM, ONE SHAPE

Wiring the live line meant reading every measured run, and six of them turned out to stop
counting the moment their task was ticked:

| | record | what the gate was |
|---|---|---|
| Cali | `salsa-dance` | `if (!caliOnFloor \|\| caliDanceDone) return` |
| Rio | `samba-parade` | `if (!rioInColumn \|\| rioSambaDone) return` |
| Rio | `selaron-steps` | `if (!rioSelaronDone) { …the whole flight… }` |
| Cali | `cart-run` | `if (!caliCartDone && aboard) game.record(…)` |
| Monte Carlo | `the-floor` | `if (!monFloorDone) { …the whole crossing… }` |
| Circular Quay | `manly-voyage` | (per visit only — correct, and left alone) |

Five were fixed and the rule is the same every time: **the TASK happens once; the counting does
not stop.** A record that cannot be beaten is not a record, and these are the only reason to
re-enter a finished chapter. Iceland's glacier and Venice's passerelle already had the right
shape and are what the five were made to look like.

### 3. THE ARRIVAL IS A SHOT, AND NOW IT IS FRAMED

`yaw` is set on **19 of 19** spawns. Each one is `atan2(-(tx - sx), -(tz - sz))` from the spawn
to the thing that chapter's own paragraph in `main.js` names.

`teleportCapy(sp, arrive)` gained a second argument and composes the frame:
`frameShot({ yaw, pitch, raise, hold: sysARRIVE_HOLD })`. `arrive` is what separates walking
into Venice from the stuck-rescue putting you back on the road — a rescue that pinned the lens
for two seconds would be taking the camera away from a player who has just been stuck.

- **0.55 in + 1.95 hold + 1.10 out = 3.60 s = `sysFADE_CARD` to the millisecond.** The place
  card is holding the screen for exactly that long anyway, so the shot underneath it is free
  and it is over on the frame the card leaves.
- **`sysARRIVE_PITCH` 0.28 rad and `sysARRIVE_RAISE` 2.0 m — the arrival is not the
  walking-about lens.** At `sysCAM_PITCH` (41 degrees) against a 24 degree half-FOV the horizon
  is seventeen degrees above the top edge, so the Opera House at 38 m, the Koutoubia at 52 and
  Galeras at 104 were ALL out of frame and the first picture of nineteen chapters was a patch
  of ground. Measured, on nineteen PNGs, before these two numbers existed. Neither touches
  ordinary play: the shot is over in 3.6 s and the rig it hands back to is untouched.
- **A spawn may name `dist`, `pitch` or `raise`** and two do. Most name a bearing alone,
  because most should: Hanoi's train marquee proved that a distance written into an alley is a
  number the world refuses, and the rig's own occlusion ray solves it better than a constant.

### 4. FOUR MODULES USED `placeCue` AND NONE OF THEM IMPORTED IT

`manly.js` (3 call sites), `antarctic.js` (6), `palawan.js` (1) and `pantanal.js` (2) call
`placeCue` and none had it on its import line. `build.mjs` concatenates every module
into one scope, so the shipped `dist` build resolves it and this has never been visible there;
the unbundled path `index.html` serves is a **ReferenceError inside a biome update**, which is
the failure mode `capy3-module-drop-failure` is about. Found by a soak, not by reading: chapter
14's take-off mini threw on the frame it paid out.

**The rule this is a reminder of:** a name from `shared.js` is only in scope in `dist`. If a
module uses it, the module imports it.

## THE LIFT PASS, BATCH FIVE — THE LENS AND THE WALL (v31 — 26 Aug 2026)

Two things stopped travelling and one instrument had stopped counting. This section is the
first batch of the Lift Pass: `qa/route.js` derives its chapter list, the player can raise
the eye, and the climb has left Hong Kong.

**The through-line is that both features already existed and neither could be reached.**
`skyward()` had been in the rig since chapter 7 and five chapters published it — the camera
has always known how to look up and there was no way to ask it. `climbHold` had been in the
controller since chapter 11 and three chapters published it — and `sysCLIMB_TAUGHT` named
those same three, so the find that exists to celebrate the climb travelling could not fire in
any chapter, ever. Neither of these is a repair. Both are the dive's move, again: one flag
from the biome, the solve stays in the shared module, and the chapters that already answered
are untouched to the decimal.

### 1. A CHAPTER LIST IN AN AUDIT IS A BUG WAITING FOR A CHAPTER

`qa/route.js` — the one audit that measures scenery density along each chapter's own route —
carried a hard-coded list of **eight** for the whole of the Payoff Pass. Eleven chapters were
not measured and it printed a confident table every time.

`run-code` has no `require` and no `import`, so the derivation happens in the page:
`index.html` serves `src/shared.js` unbundled and the probe parses `CHAPTERS` out of it. It
**throws** on a miss rather than falling back to a spelled list. A silent fallback is how a
stale audit stops failing and starts inventing.

The first run over nineteen found the second half of the same defect: `game.sydney` does not
exist — chapter one's api is `game.env`, the resolution `sysLiveBiomeApi` has always done —
so the derived list threw on its own first chapter. With eight names spelled out, that could
never come up.

### 2. THE HORIZON WAS NOT IN THE FRAME, IN ANY STATE OF ORDINARY PLAY

Measured, all nineteen, real keys and a real clock. The number is `pitch − halfFOV`: the angle
of the horizon **above the top edge** of the screen.

| | before | after |
|---|---|---|
| standstill | 42.8 / 24.0 = **+18.8** | unchanged, deliberately |
| standstill, eye raised | +18.8 (the key did nothing) | 16.6 / 24.0 = **−7.4** |
| full run | 34.6 / 27.5 = **+7.2** | 20.2 / 28.4 = **−8.3** |
| horizon in frame at a run | **0 of 19** | **15 of 19** |
| horizon in frame at rest, eye raised | **0 of 19** | **19 of 19** |

Three changes, and the first is the one that matters:

- **`sysEYE_RAISE_W` — held V raises the eye, on the crane's own channel.** Not a second rig.
  The key is another voice asking for `skyward` and the louder of the two wins; it borrows the
  crane's whole geometry and stops at 0.7 of it, which is 20 degrees of pitch, twelve metres of
  boom and a look target 1.9 m up so the animal stays in frame. It borrows none of the crane's
  timing: `sysSKY_LAMBDA` is three seconds, which is right for a chapter easing the lens up at
  an aurora and useless for a key, so while the player's hand is on it the blend runs at
  `sysEYE_LAMBDA`. Gated by flight and the helm exactly as the crane is.
- **`sysCAM_DOLLY_P` — the speed dolly lowers the boom as well as lengthening it.** The dolly
  shipped as distance alone and distance alone very nearly does not flatten the shot: the boom
  angle is fixed, so a longer boom puts the eye higher in the same proportion it puts it
  further back. Measured: pushing the distance from 10.7 m to 13.5 m moved the view pitch from
  34.6 to 36.1 — the **wrong way**. What had always flattened it was the look-lead, which is
  horizontal. So `camDolly` is now the 0..1 fraction it always was internally, and it buys a
  metre of boom and eighteen degrees of pitch.
- **`sysFOV_SPEED` 7.0 → 9.0.** The other half of `pitch − halfFOV`. The brief's own
  prescription for when flattening further would start putting the eye in the terrain.

**The trap, counted.** Raising the eye lowers it relative to the animal and `sysCamClear`
starts cutting the boom. `game.camInfo` was added for this — one pre-allocated object written
once a frame and read by nothing in src — because `camClearF` had never left its closure and
"is the occlusion ray fighting the terrain in this chapter" was a question no audit could ask.
Boom-cut frequency over all nineteen, before **8.6%** of frames and after **6.3–12.6%** across
passes: inside its own run-to-run noise, and not materially worse anywhere.

**Two things the instrument caught before the rig did**, and both were the instrument:

- A four-direction key sweep that held W for three seconds before looking measured **Pasto at
  55.8 degrees at a full run** — steeper than a standstill. The animal was half way down the
  paramo. Frames are now filtered to grounded, level (`|vy| < 0.5`) and outside a marquee, and
  the legs are short: reset to spawn, hold, look at 2.0 s.
- Looking at 1.1 s instead reported Cali and Sahara at +5 on one pass and −5 on the next.
  `camDolly` damps at lambda 2.4 and at 1.1 s is two thirds of the way there.

**And one real bug the lens work turned up.** `sysCAM_CLEAR_PAD` was **0.45** and `camera.near`
is **0.5**. Every time the occlusion ray fired — which is the exact moment the feature exists
for — the eye was placed five centimetres too close and the near plane was left *inside* the
wall it had just backed off from. Measured on the Monte Carlo climb: boom cut to 0.15, and the
whole frame one flat brown rectangle. The pad is 0.70. This is not a relaxation of
`sysCAM_CLEAR_MIN`, which is what keeps the lens out of Galeras and is untouched.

### 3. SYDNEY'S OPERA HOUSE WAS KEEPING THE CAMERA OUT OF EIGHTEEN OTHER WORLDS

`sysInOpera`/`sysOperaClear` were gated on `!inPasto` — written when there were two chapters
and never revisited. `sysOPERA_VAULTS` is eleven ellipses between x −11 and x +11, z −9 and
z +2: the Bennelong Point podium and nothing else. That volume has been live in seventeen
other worlds, and **Rio's spawn is the world origin**. The Quay's own Opera House is at x 78
and was never the one being tested.

Gated on `isActive('sydney')` now. Named for the chapter it belongs to, not for the one
chapter it was known to be wrong in — that is the difference between a gate and a patch.

### 4. THE CLIMB HAS LEFT HONG KONG

`capyClimbAt` gets a generic fallback, reached **only on a property miss**: a biome that
publishes `climbHold` and answers null has answered, and its no is final. Two horizontal
raycasts out of the chest in the direction the animal is facing; a near-vertical static face
within 1.15 m is something to hang on to, and the surface normal flattened is the hold's
normal, which is the whole of the contract `climbHold` already had.

| | before | after |
|---|---|---|
| chapters with any climbable ground plan | **3 of 19** | **19 of 19** |
| Hong Kong / Cappadocia / Son Doong, 1 m grid | 150 / 528 / 1,157 m² | **150 / 528 / 1,157 m²** |
| `brought-climb` | unreachable by construction | fires |

**What it will not grab, and every one is load-bearing.** Anything with mass — a bin you could
otherwise pick up. Anything not `STATIC` — kinematic means a ferry hull, a tram, a floe, a
gondola, a balloon basket, and those are carriers with a channel of their own. `userData.npc`
and `userData.local` — both are mass-0 boxes that read as a perfectly good half-metre wall, and
a capybara clinging to a stallholder is worse than no climb at all. The capybara's own three
spheres and whatever is carrying it. Heightfields and planes: terrain is not a building and its
AABB is the whole chapter. This is `sysCamClear`'s ignore list, for the same reasons.

**A wall with no top is climbed for ever.** `capyClimbAt` defaulted `top` to `Infinity`, which
for an authored lattice is fine — the biome says where it ends. For a ray it is a licence to
climb past the parapet into the sky. The top comes off the hit body's AABB, and because several
chapters merge a street into one body, it is then **confirmed at the wall**: a second ray a
metre higher, and no wall up there means the parapet is here whatever the box says.

**And you may not hang off something from under the ground.** The climb assigns
`body.velocity.y` rather than adding to it, so a hold offered below the terrain surface holds
the animal inside the hill indefinitely. Measured in Monte Carlo, whose buildings are cut into
the rock: a collider starting at y 27 under ground at y 28, and the frame was the brown inside
of the hillside. Refused, with two decimetres of slack for the heightfield triangle.

**It costs nothing when nobody is asking.** The authored hooks are arithmetic; this is two
raycasts against every static body in the chapter, so it runs only while the grab key is down —
which is the only state in which the answer can be used, because `wantCling` requires it two
lines below the call site.

`sysCLIMB_TAUGHT` is **unchanged**, and that is the point. Hong Kong, Cappadocia and Son Doong
still teach the verb. What changed is the other set.

### 5. THREE INSTRUMENTS THAT CANNOT SETTLE WHAT THEY LOOK LIKE THEY SETTLE

Recorded because a green run from an instrument nobody has checked is worth less than no run.

- **`qa/stillness.js` gained a row and it was not this batch.** Pasto drifts 2.5 m from its
  spawn with no input. With all four changes reverted and the same script, it drifts **7.83 m**;
  the batch-5 baseline caught it at 0.48. It is weather-dependent (`wet` 0.17 vs 0.26 across
  runs, and rain adds slip), pre-existing, and it straddles the 1.0 m limit. **Open finding, not
  a regression.**
- **`qa/audit-solid.js` is not a ratchet in the animated chapters.** Back to back on one build
  with nothing changed between them: kyoto 33→36, cali 44→47, goreme 46→44, antarctic 3→2. Its
  mesh list is `scene.traverse` filtered on `.visible`, and chapters toggle visibility on time
  of day — Cali's dusk lights, Kyoto's heron, Kyoto's matcha heap. The quiet chapters are
  stable and stayed stable. No mechanism exists by which this batch could add a walk-through: it
  adds no mesh and no collider.
- **`qa/b5-climb.js`'s survey is not repeatable to the cell.** Its body list is rebuilt per run
  and the world does not always have the same number of bodies in it (cave 145 vs 146). The
  1 m authored grid, which is pure arithmetic, is exact — and that is the one the trap-3 test
  uses.

### 6. WHAT MOVED

`src/systems.js`
- `sysEYE_RAISE_W` 0.70, `sysEYE_LAMBDA` 2.6 — held V, on the `skyward` channel.
- `sysCAM_DOLLY_P` 18° — the speed dolly lowers the boom. `camDolly` is now 0..1.
- `sysFOV_SPEED` 7.0 → 9.0.
- `sysCAM_CLEAR_PAD` 0.45 → 0.70 — it has to clear `camera.near`.
- The Opera keep-out is gated on `isActive('sydney')`, both halves of the pair.
- `game.camInfo` — reach, dist, clear, pitch, sky, rig, shot, lift, lift2, floor. Written once
  a frame, read by nothing in src.
- One row in `sysLEGEND_MORE`.

`src/capybara.js`
- `capyClimbProbe` — the generic hold, in `capyClimbAt` and nowhere else.
- `capy.climbAt(x, y, z, yaw)` — QA only. A biome's `climbHold` can be probed on a grid
  because it is arithmetic; the fallback cannot, because it needs a facing. Without it the
  change is unmeasurable, and an unmeasurable change is one nobody may claim.

`qa/route.js` derives its chapter list. New: `qa/b5-cam.js`, `qa/b5-camrep.mjs`,
`qa/b5-climb.js`, `qa/b5-brought.js`, `qa/b5-climbshot.js`, `qa/b5-shots.js`.


## THE CLOSEOUT — WHAT AN AUDIT IS FOR (v30 — 26 Aug 2026)

The Payoff Pass closed at v27 with a found-versus-fixed report, and then chapters 18 and
19 shipped. This section is the pass that finished it: the items batches 1-4 left open,
the five pillars on the two chapters that arrived after the pass, and the formal close.

**Its through-line is not a feature. It is that ten of the findings below were invisible
to an audit that was reporting green**, and that a green run from an instrument nobody has
checked is worth less than no run at all — because it is believed.

### THE SEVENTEEN-CHAPTER BLIND SPOT

Every browser audit in `qa/` carried a hard-coded 17: `channels.mjs`, `budget.js`,
`stillness.js`, `fuzz.js`, and `lines.mjs`'s `FILE_CHAPTER` table. So for the fortnight
after Monte Carlo and Hanoi shipped they were the two chapters nothing checked, and each
audit went on printing a confident `17/17`. What it hid:

- Neither chapter had a row in the event grade layer — `lit` was not a channel either of
  them had. Nor did sydney, pasto or quay, for the third version running.
- Neither had a ratchet ceiling, and `budget.js` passed them SILENTLY: `if (c && r.tris >
  c)` reads "no ceiling recorded" as "within its ceiling". **Hanoi is the largest chapter
  in the game at ~245,000 triangles**, half again over the Pantanal.
- Neither had a single `after:`/`before:` line — nobody in either chapter reacted to
  anything the player had done — and `lines.mjs` could not see it twice over: the file was
  not in its table, and its regression list named four specific files, so "this chapter has
  none at all" was not a condition it tested anywhere.

`channels.mjs` derives the count from its own table now. The rule is that a chapter list in
an audit is a bug waiting for a chapter.

### AN INSTRUMENT HAS TO BE CHECKED BEFORE ITS OUTPUT IS

Four measurements in this pass were wrong in ways that produced confident numbers:

1. **The cost gate reported FAIL from machine load.** Single-mean readings swung 1.68 to
   5.31 ms for the same chapter minutes apart, and iceland measured SLOWER with the shadow
   pass off — which is impossible. Now the minimum of five repeats (noise only ever ADDS
   time, so the minimum is the robust estimator), with that impossibility as an explicit
   self-check; a contaminated run reports COST GATE UNUSABLE and may not fail anything.
2. **The ratchet's slack was measured on the wrong axis, then with the wrong script.** The
   scatter randomises at page LOAD, not on `switchTo`, so re-entry inside a session is the
   same build: Göreme spreads 12,652 across loads against a ±1,500 global figure, and
   tripped its line by 630. A side probe with a shorter settle then under-read Hanoi by
   nine thousand and its new ceiling tripped by 546 with nothing added. **A ratchet is a
   promise about a measurement, so it must be sized by the thing that will do the
   measuring.**
3. **The keepsake-hover check tested the wrong prop.** `fuzz.js` read `keepOut('sydney')`
   in all nineteen chapters, so what it measured was whether a Sydney plaque could be
   rescued onto the origin of Monte Carlo. It reported 3.41 m there; the chapter's own
   keepsake in its own place was 0.34.
4. **The route-life probe could not see scenery.** It took an InstancedMesh's
   BOUNDING-BOX CENTRE as one object, so every scattered lamp, palm, bollard and tree —
   90% of what a chapter draws; Monte Carlo is 253 plain meshes and 2,780 things — was
   counted once, in the middle. It read 48 dead cells in Monte Carlo, and adding fifteen
   lamps along the exact line it complained about moved the number **UP** to 53. A detector
   that gets worse when you fix what it points at is not measuring what it says.

### THE FINALE COULD NOT BE REACHED BY ANY OF ITS OWN TESTS

`qa/all-task-ids.json` is the save `pf2-finale.js`, `pf2-finale2.js` and `pf2-finshot.js`
all write to reach the ending, and none of them checks it. It stayed at 199 of 229 ids when
18 and 19 shipped, so `sysFinaleAll()` has been false ever since and all three scripts were
exercising **an ending that cannot fire** — the lawn stages nothing, the ledger never
opens, and the run reports whatever it happened to measure. Found from `keeps: 0`.

`qa/audit-tasks.mjs` now BLOCKS on any drift between that fixture and the task table.

### THE TWO CHANNELS CHAPTERS 1-3 NEVER HAD

`framed` and `lit`, both left open by batch 2 as its findings B and C, both closable only
after batch 3 built `frameShot` and never revisited. Measured on Sydney's podium, by
projecting the shell mesh's own vertices into the frame:

    the rig, at the payout   dist 2.97 m   pitch 50.6   sails in frame    0 of 714
    with env.operaShot()     dist 17.25 m  pitch 16.2   sails in frame  714 of 714

Chapters 2 and 3 got theirs with `over: true` — the flag v27 built while naming the two
chapters it was for, *"Antarctica's orca-ride is at the helm and Pasto's condor-ride is in
flight"*, before wiring Antarctica and stopping.

`lit` was structural, and that is why three passes wrote the finding down instead of
closing it: `sysAirT` carries six chapters and the other thirteen weights are hand-declared
scalars, so using the second channel meant adding a damped weight in three separate places
first. **`sysChapT` is that table over all of CHAPTERS.** No chapter has to again.

### A ROW GETS MEASURED BEFORE IT IS BELIEVED

Pasto's new grade row keyed on crater proximity and measured **0.000 across an entire
ride**: the marquee is `condor-ride`, which fires at the LAUNCH, and the launch is at the
spawn — 104 m from the caldera against a 70 m falloff. Tracked over two minutes the
unsteered bird never came within 95.4 m. v25's own finding, reproduced inside its fix.

Hanoi's `trainGlow` read 0.00 at the exact moment its marquee paid out, because it derived
the train's position as `x0 + s` when the train runs from `x1 + 60` downward. **A row keyed
on a position must take that position from whatever moves the thing.**

### CHAPTER 19'S MARQUEE FIRED WITH THE TRAIN NINE HUNDRED METRES UNDERGROUND

`the-train` paid out in the DESPAWN branch, which runs when the train has cleared the alley
and ninety metres more. The card, the music swell and the camera shot fired **17.7 s after
the train passed the player**, and three lines above them the same branch had set
`hanTrainG.visible = false` and put the body at y = -900. At the payout frame: body y -900,
`trainGlow()` 0.00 for the whole fourteen seconds before it.

The payout moves into the pass. The RECORD still files at despawn — it is the closest
approach over the whole pass, and **the moment is not the same thing as the score**.

Two more, both found from the PNG and invisible to every number: the bearing was a
hard-coded `1.5708`, across the tracks, and any z term at all points the lens at a wall —
the frame was a flat beige wall with the wow card over it while the train was present,
visible and 82% inside the frustum. And **no distance or raise survives that alley**: 11 m
asked, 1.4 delivered; 6.4 m of raise asked, 2.7 delivered. It is the occlusion ray and it
is right — the alley is walled and roofed, and a lens that backs off cannot see the animal.
So the request is a BEARING ALONE. **The framed channel is not fully available in Train
Street, and the reason is the chapter working exactly as designed.**

### THE FIRST TWO HOURS GET A WORLD THAT REACTS

Batch 1's *"13 of 15 locals chapters carry two of the three chains"* was true and hid that
**Sydney and Pasto are not locals chapters at all** — they predate `addLocal` and their
casts are npc.js's own `humans` and `paCast`, so every gate in the reaction layer is shut
in the opening of the game. Both casts come out of the same `buildHuman`, so the witness
chain and the produce reaction port without building anything new.

Two traps paid for, and the second generalises:

- **`gawpT` counts UP.** The obvious way to hold a look open is that timer, and
  `paStepHuman` LEAVES the gawp past 1.8 — so writing 2.6 into it *ends* the look.
- **A bare `lookX` write is worth nothing.** It measured 9 of 16 people in Sydney and 5 of
  13 in Pasto facing the reaction on the frame it fired, and **2 and ZERO a fifth of a
  second later**: twenty-odd sites inside the two state machines write `lookX` every frame.
  The hold has to be re-asserted AFTER the state machine has run, and is deliberately not a
  state of its own — the cheapest way to obey the catch-all-state rule is not to add one.

### THE ENDING GATHERS A CAST

Batch 2 built THE LAWN and marked "gather a cast" PARTIAL because Sydney registers zero
`game.locals`. Built now as a `gather` state on the terrace's `resit` idiom — slot assigned
once, arrival test, hard ceiling, damp and stop — with `sysFinaleStage` emitting
`finale:staged` and npc.js answering, so the finale never learns what a `humans` array is.

Three faults, all found by tracking the walk rather than reading the code: the recruit
radius and the ceiling did not know about each other (Sydney's cast is spread over a park —
the five nearest the lawn are 10, 16, 17, 19 and 28 m out — and at 14 s only 11.8 m is
reachable, so four of five were stopped mid-walk and one never moved at all); and one slot
landed inside a flower bed, a point nobody can stand on. `npcGATHER_MAX_D` is derived from
the ceiling and the walk speed now, and a blocked slot rotates round the ring.

### AND A WALKER WALKS ROUND THE PLAYER

`navBlocked` was static world geometry and nothing else, so a walker steered neatly around
a building and went straight through the capybara — measured at 3.04 m/s of imparted speed
with `capy.frame` null, which makes it a shove and not a carry. `npcBlockedFor` adds the
player at one squared distance per probe, gated off for the ten states whose whole point is
to reach it. **It does not close Pasto's drift**, and saying so is the finding: three runs
each way measured 7.97-9.71 m with and without, and an earlier run with fourteen shoves
drifted 1.22 m. What is left is a steady 8 m slide on ground whose gradient samples 0.0000,
with the body holding exact velocities — `vz = -3.000`, then `vx = -0.368` — while barely
moving. A held exact value is a bare velocity write.


## THE BUDGET, AND WHAT A SILHOUETTE MAY COST (v28 — 26 Aug 2026)

v27 measured the performance budget and deliberately did not act on it, for reasons that
still stand and are restated below. This section is what a SECOND batch-4 run — the
scheduled task fired twice and two sessions worked the same tree — did on top of that: it
reallocated the part of the overage that was waste rather than content, and it turned the
budget audit into a gate that can be green.

### THE RULE: DETAIL IS A FUNCTION OF WHERE THE PLAYER CAN STAND

Three chapters were carrying their far field at near-field resolution. This is now written
into the three builders, and it is the pattern for any chapter that needs the same:

- **`driAddIsle(..., MN, det)`** — `src/drift.js`. `det` is 1 for the islands you land on,
  0.45 for the deep and far ranks (110-260 m) and 0.28 for the far field (260-400 m). It
  scales the COUNTS only — spike fringe, torn-lip plates, rib steps, rim boulders — and
  never the shape, so the lip still goes all the way round and the crag is still torn
  rather than conical. `dri:under` 50,524 → 34,268. `driBuildFarDressing`'s `dress()`
  takes the same term: the third rank keeps its crown line and its lamp, and loses the
  six-sided trunk under a crown 300 m away.
- **`quayHeadRouteDist(x, z)`** — `src/quay.js`. Distance from a headland's NEAR EDGE to
  the rhumb line the player actually travels: the berth on the apron, then the fairway to
  Manly. Past 60 m a plant loses the fork inside its own crown, the second crown on top of
  the first, the sandstone at its foot and the grass tree beside it. **The plant count is
  untouched** — the wood is as thick as it ever was, because the canopy line is the read
  and the trunk is not. Manly's own banks and North Head's nose keep everything.
- **the Pantanal's grass** — `src/pantanal.js`, `panBuildGrass`. 4,249 tufts at one uniform
  density over 56,000 m². The density now follows the causeway and thins going out, which
  is also what a cattle road looks like: the verge is rank and the pasture beyond it is
  grazed short.

Measured: quay 201,851 → 157,975, drift 206,474 → 185,166, pantanal 224,488 → 210,776.
Verified by differential (`git stash`, rebuild, same script) from a free camera pointed at
the changed geometry — `qa/b4-view.js`, `qa/J2A-*.png` after against `qa/J2B-*.png` before
— and re-certified against `qa/audit-solid.js` and `qa/fuzz.js` (17/17, 0 errors).

### THE AUDIT: THREE GATES, AND ONLY TWO OF THEM DECIDE

`qa/budget.js`. `out.pass` is green when nothing is over the cost gate and nothing is over
its ratchet ceiling.

1. **Triangles, 130,000** — the Payoff Pass brief's gate. Ten of seventeen are over it and
   the audit REPORTS rather than fails on it, with the cost beside every chapter that
   misses. Closing the rest means cutting density where the player is standing, and the
   same brief forbids visual regressions.
2. **Cost, 5.5 ms** — milliseconds of real render, and the gate that decides. rAF is pinned
   to the display, so every chapter reads 16.67 ms and a frame-time measurement says
   nothing; the only way past vsync is N renders back to back with a `gl.finish()`. The
   worst chapter in the game is 1.86 ms of a 16.67 ms frame. **The triangle count does not
   predict this** — a four-to-one spread in cost per triangle, with the two cheapest
   chapters per triangle among the three largest.
3. **The ratchet** — a recorded per-chapter ceiling, set at the 26 Aug figure plus 6,000.
   This is the gate that will catch something: quay went 132,423 → 202,391 in two days of
   content work and nobody saw it. **The 6,000 of slack is not generosity.** The scatter
   helpers call unseeded `rand()`, so a chapter re-measures within about ±1,500 run to run,
   and a gate inside its own noise cries wolf. Raise a line only with a measurement and a
   reason, in the same commit as whatever needed it.

### MEASUREMENT DISCIPLINE, WHICH BOTH RUNS ARRIVED AT SEPARATELY

`renderer.info` is meaningless with the post chain in place: a read after a frame returns
the composite quad, 1 call and 1 triangle. Walk the scene instead and respect the whole
visibility chain (`for (let p = o; p; p = p.parent) if (!p.visible) return`), and multiply
an `InstancedMesh` by its `count`. `qa/b4-tris.js` is the probe; `qa/b4-cast.js` is the
same walk restricted to casters.

### FOUND AND NOT TAKEN: EVERY CHAPTER'S GROUND SHEET CASTS A SHADOW

Measured 26 Aug across all seventeen. The single biggest shadow caster in venice, cave,
kowloon, kyoto, cali, manly, rio, sahara, iceland, goreme and palawan is that chapter's own
terrain plane, receiving AND casting. Antarctica and the Pantanal already exclude theirs.
It is the only remaining lever with a real millisecond behind it — kyoto's shadow pass is
0.88 ms, the largest in the game — and it was not taken because a terrain with genuine
relief (Iceland 91 m, Cali 49 m, Kyoto 39 m) casts shadows a player can see. It is eleven
separate picture decisions and not one rule, and it needs a screenshot each.

## THE MIX PASS (v41 — 30 Aug 2026)

The score has been beautifully *composed* for thirty-odd versions — nineteen palettes,
twenty-eight modelled instruments, six band arrangements, a voice-leading pad that never
repeats — and it had never once been **produced**. Everything here is mixing and
performance, not composition: not one chord, root, next-table, dwell, tempo, riff or
instrument model changed. Five things, all in `src/systems.js`, all in section 5/5b.

The brief was *keep the chill*, and every one of these is on the side of calm: width,
depth, a room, a pocket, and a place where the music stops.

**MEASURED, both arms, three minutes each** (`qa/v41-ab.js` with `qa/v41-arm.mjs off|on`):

| | Sydney before | Sydney after | Son Doong before | Son Doong after |
|---|---|---|---|---|
| L/R correlation | 0.558 | **0.483** | 0.395 | **0.264** |
| side energy | 0.226 | **0.264** | 0.310 | **0.374** |
| master RMS | 0.0501 | 0.0516 | 0.0666 | 0.0794 |
| peak | 0.272 | 0.275 | 0.408 | 0.507 |
| clipped frames | 0 | 0 | 0 | 0 |
| `lastError` | none | none | none | none |

Correlation down and side energy up in both, with the level and the headroom held: the mix
is wider and it is not louder. Son Doong ends 1.54× Sydney's RMS where it was 1.33×, which
is about what "much more reverberant" should cost. Both arms carry the breath (it is held
constant), and both fired it, to a floor of 0.42.

### 1. THE NOISE FLOOR WAS 1.2 SECONDS OF MONO (`noiseBuf`)

Every continuous non-tonal sound in the game — rain, wind, surf, crowd, crickets, the
cave's drip, the ambience bed, and a good half of the sfx — was **one** 1.2 s **mono**
buffer on loop. Two consequences, both audible:

- a mono source up-mixes to two *identical* channels, so the entire weather and ambience
  layer was a panel one pixel wide in the exact centre of the head, while the score's
  plucks panned around it;
- 1.2 s is short enough to *hear*. Noise has no melody to give a loop away but it has
  texture, and the same texture fifty times a minute reads as a machine, not as weather.

Now **6.0 s, two channels, partially decorrelated**: a shared core plus a per-channel
difference, landing near 0.59 correlation. Fully independent noise is wider still and has
a hole in the middle of it — mono-summing loses 3 dB and the centre goes hollow — which
is why it is not that. The one-pole colour is bit-for-bit what it was, so no filter
downstream needed re-tuning. Every source also gets its **own loop window**
(`loopStart`/`loopEnd`), so no two voices on the one buffer come round together.

**AND THERE ARE TWO BUFFERS, WHICH IS NOT AN OPTIMISATION.** `StereoPannerNode` uses a
different algorithm for a stereo input than for a mono one, and it has to: at pan 0.5 a
mono source lands 0.38/0.92 across the ears and a stereo source lands 0.71/1.22, because
the panner has an incoming left channel it may not throw away. Right for a bed, wrong for
a footstep — one buffer would have quietly taken ~40% off the positional cue of every
noise-based effect in the game, which is exactly what a width improvement may not cost.
So **`noiseSrc()` (everything placed) stays mono and pans exactly as it did**, and
`noiseWideSrc()` (the ambience and the four weather voices — none of which is anywhere) is
the stereo one. Both are cut from the same three streams in one pass.

### 2. THE PAD WAS IN THE MIDDLE OF YOUR HEAD (`musWide`, `sysMUS_ENS_*`)

Same fault, one layer up. Oscillator banks → shared low-pass → one gain → out: every node
mono. So the sustained bed under the whole game — pad, shimmer, choir *and* lift — was
dead centre and only the transients had an image, which is exactly backwards.

`musWide` is a bus that all four sustained layers now feed, with **two short modulated
delays panned hard apart underneath the dry centre** — the oldest widener there is and
what a string machine literally is. 16–23 ms is below the echo threshold so it does not
read as a repeat; moving it ±3 ms on a slow LFO detunes each copy a few cents so the
sides beat against the centre and never settle. Rates are incommensurate with each other
*and* with the three LFOs already on the bus. `sysMUS_ENS_TRIM` pays back the ~1.4 dB the
taps add in **one** place, so nineteen chapters' level balance is untouched, and
`musPad.gain` still has exactly one writer.

**THE TAPS GO TO THE DRY PATH ONLY, AND THAT IS THE WHOLE POINT.** The first version fed
`musWide` through one trimmed output into *both* `musDry` and `musSend`, and it was
measurably worth nothing: Sydney's master L/R correlation was **0.559 without the ensemble
and 0.564 with it** — no change at all, over a three-minute sample in each arm
(`qa/v41-ab.js`). The reason is the wet/dry ratio. This score runs ~0.95 wet against 0.5
dry, so two thirds of what reaches the speakers is the convolver's output — and **a
convolver replaces the stereo image of whatever goes into it with the image of its own
IR**. Widening the reverb's *input* buys nothing, because the IR's two decorrelated
channels were already doing that, and it costs something: delayed copies smear the
reverb's attack. So the send takes the pad exactly as it always did — clean, un-widened,
one signal — the ensemble lives entirely on the dry path, and the trim moved with it, so
the **wet level is bit-for-bit what it was before v41**.

### 3. THE REVERB WAS A WASH, NOT A ROOM (`musIR`)

Decayed noise starting at sample zero. Three properties of a real space were missing:

1. **No pre-delay.** Sound reaches you before it reaches the wall. An IR starting at zero
   glues the tail to the source and the price is paid in *clarity* — every pluck, mallet
   and footstep was smeared by its own reverb. It is the cheapest thing that makes a wet
   mix legible, and it is why a ~65% wet score can still sound like notes.
2. **No early reflections.** Room *size* is told by the handful of discrete bounces before
   the tail goes dense, not by the tail — tails all sound alike. Eight taps, irrationally
   spaced so the cluster has no pitch, alternating sign, and at **different times in the
   two channels**, which is what gives a room a width as well as a depth.
3. **The tail never got darker.** Air eats treble far faster than bass. The one-pole
   coefficient now walks `sysIR_LP0 → sysIR_LP1` across the buffer (≈3.6 kHz → 1 kHz), with
   a `sqrt(1-k²)` term so the darkening does not double as a fade. 0.4842 is the constant
   that makes `k = 0.62` come out at the old 0.38, so the *head* of every tail is unchanged.

Plus a **build**: the diffuse half starts at `sysIR_BUILD` and fills in over the ER window,
because at full density on arrival the noise swallows the taps and you have built early
reflections nobody can hear.

**Measured — `node qa/v41-ir.mjs`**, which rebuilds these buffers offline and reports them.
Pre-delay 29.5 ms (Manly) → 42.0 ms (Son Doong, at the clamp). ER span 33 → 85 ms, ER peak
2.0–3.0× the diffuse level just behind it. Tail brightness 7.4 kHz at the head → 4.0 kHz at
the end; **the old one was 7.4 → 7.6, i.e. flat**. RT60 3.0 s (Manly) → 6.3 s (the cave),
where it used to be 3.60 s in all nineteen places. Run it after touching any `sysIR_*`.

The first `erSpan` was `secs * 0.024` and that measurement is why it is not: the music rooms
only run 3.45–6.5 s, so a straight proportion pinned **every chapter but Manly at exactly the
85 ms ceiling** and the one number that says how big a place is said the same thing
everywhere. `(secs - REF) * K + BASE` gives the 2.6× spread above.

### 4. THE SCORE WAS IN THE SAME ROOM IN ALL NINETEEN PLACES (`musRoomLoad`/`musRoomSet`)

One convolver, `musIR(3.6, 2.4)`, built at the first gesture and never touched. The ice
cathedral, the tuff valley, the 4.5 m Hanoi alley and the open beach at Manly all played
their music in an identical hall — while the **sound effects** in those same places have
had per-chapter rooms from a hand-tuned table since v16. The half of the mix that runs for
the whole hour was the half that never moved.

It reads **`sysROOMS`**. There is no second table: those numbers were written by somebody
standing in each place and they are the same places. They are stretched
(`sysMUS_ROOM_A/B`) because a chord wants a longer tail than a footstep does. Manly
3.45 s, Sydney ≈3.8 (the old fixed value), Son Doong 6.5.

**WHICH ROOM AND HOW LOUD ARE NOT THE SAME QUESTION.** The first version took the send
straight off that table's `wet` column and measured badly: Son Doong came out **3.4 dB
louder than it had been**, 0.094 master RMS against Sydney's 0.045 — twice its neighbours
on the same pad palette, where before v41 it was 1.22×. A pass that turns 1.22× into 2.06×
has not deepened the cave, it has turned it up. Two things were leaking into level:

- `wet` in `sysROOMS` spans 0.04–0.42, a factor of **ten**. That is right for a footstep
  and absurd for a bed that runs for an hour. `sysMUS_WET_BASE/_SPR` compress it to about
  ±1.4 dB around the old fixed 0.95 (measured range 0.81 Drift → 1.01 Hanoi).
- **A longer tail is louder at the same send, and `normalize` does not fix it** — it
  normalises the *impulse*, but a sustained input into a 6.5 s tail has nearly twice as
  much of its own history summed into it at any instant. True of a real cave, still a mix
  fault. The send comes down by `sqrt(sysMUS_WET_REF / secs)` to cancel it.

What survives is that the cave has a 6.5 s tail and an 85 ms early cluster, both the
longest in the game, and Manly has 3.0 s and 33 ms. *That* is what a different room sounds
like. Being louder is not. Re-measured, the send now spans 0.81 (the Drift) to 1.01
(Hanoi) around the old fixed 0.95, and the cave's excess fell from +3.4 dB to +1.5 dB.

**Two convolvers, not one.** A convolver whose buffer changes while it is ringing *drops*
the tail in it, and the cave's is 5.5 s. The border cross-fades between slots over
`sysMUS_ROOM_XF` — so for a moment you are in both rooms, which is what walking out of
somewhere sounds like — and the room being left is then **disconnected from the send**, so
a chapter never pays for a room it is not in. Same shape as `sysRoomSet`, driven from the
same line of `update`.

### 5. THE BAND WAS NEVER LATE (`musFeel` / `musVel`)

Every struck note was scheduled at `t0 + step * grid`, to the sample, in all six bands,
forever. That is the single thing that most reliably tells a listener they are hearing a
machine, and no amount of instrument modelling fixes it.

Three things people do, and all three are now here: they **scatter** (triangular, not
uniform — human error is bell-shaped and a flat distribution sounds drunk rather than
alive); they **sit somewhere** (the bass and the surdo lean late, the montuno and the
cavaquinho push early — a constant, because it is a style, not an error); and they **do
not hit everything the same** (`sysMUS_VEL_H`). Numbers are in `sysMUS_F_*`, in
milliseconds, and they are small.

The asymmetry is the trick: the **pulse-keepers barely move**, because the clave, campana,
ride, caixa and hats are what the rest of the band is early or late *against*, and a grid
that wobbles is not a grid. Two deliberate exemptions: the **harpsichord's velocity** (a
harpsichord has no dynamic — that constraint *is* the instrument, so only its timing
moves) and the **Kowloon drum machine**, which stays quantised because the chapter is a
joke about a city that runs like a machine and a swung kick would be a different joke.
Its guzheng — the one thing there played by a person — does get a feel.

**`musBarAnchor` and `musBeatLen` are untouched.** Cali's dance floor and Kowloon's towers
are scored against the *bar*, and the bar is exactly where it always was. Only notes move.

### 6. AND THE SCORE NEVER STOPPED (`musBreathStep`, `game.music.breath`)

Not once, in nineteen chapters, for the whole hour: chord, pluck, chord, pluck, at a
density set only by how much chaos the player was causing. That is a **carpet**, and a
carpet is the one thing a beautiful piece of music is not — a phrase is beautiful because
it ends, because you notice it ending, and because something comes back.

Every 78–146 s, for 9–13 s, the music **thins**: the plucks stop (thinned by a gliding
number, so the last few fall away rather than hitting a wall), the pad comes down and
**darkens with it** — the one parameter combination none of chase, calm or lift makes, and
the difference between *quieter* and *further away* — and the room opens up
(`sysMUS_BREATH_WET`) so what you hear is mostly the space the last chord is dying in.
Then it returns, over a longer ramp than it left by.

**Nothing is ever silent.** `sysMUS_BREATH_DIP` is 0.42, not 0: a game that goes quiet
reads as a bug and half the players reach for the volume. It goes *distant*, which is what
the return is bought with.

Deliberately unavailable under a **band** (salsa, samba, gnawa, Kowloon, Monte Carlo — an
arrangement that evaporates mid-bar is a dropout, not a phrase), while a **lift** is up
(the opposite gesture), or above `sysMUS_BREATH_MAXI` **intensity** (the point of a breath
is that nothing is going on). Any of those *cancels it early* rather than blocking it, so
the music can never hold a hush through a moment that wanted the opposite.

### THREE NEW GETTERS ON `game.music`, ALL READ-ONLY

`breath` (0..1), `room` (which chapter's IR the score's convolver holds), and `bus`
(`{ac, out}` — a place to hang an analyser, nothing in `src` reads it). The breath is slow,
rare and invisible; a soak that samples it for two minutes and never sees it move has found
a bug no screenshot could.

### HOW TO MEASURE ANY OF THIS AGAIN

| | |
|---|---|
| `node qa/v41-ir.mjs` | Rebuilds the IRs offline and prints pre-delay, ER span, ER/tail ratio, head and tail brightness, RT60 and the send, per chapter, plus the old shape for comparison. **Zero-crossing rate is a fine brightness proxy and needs no FFT.** Run after touching any `sysIR_*` or `sysMUS_ROOM_*`. |
| `qa/v41-rooms.js` | One reload per chapter through the title picker, a `ChannelSplitter` and two `AnalyserNode`s on `game.music.bus`, reporting RMS, peak, L/R correlation, side energy, clip count and `music.room`. |
| `qa/v41-ab.js` + `qa/v41-arm.mjs off\|on` | **The differential.** Sydney and Son Doong, three minutes each. |

**`git stash` DOES NOT WORK FOR AN AUDIO DIFFERENTIAL HERE.** The pre-v41 build has no
`game.music.bus`, so the probe has nothing to hang an analyser on and the whole arm comes
back `"no bus"`. `qa/v41-arm.mjs off` instead switches the three mix changes off *in place*
and leaves the hook — which is a cleaner isolation anyway, because it holds the reverb
internals, the feel and the breath constant and moves only the width and the room. `on`
must leave the file byte-identical; it round-trips 7/7.

**AND `KeyJ` + A DIGIT DOES NOT TRAVEL.** `jrTravel` returns immediately without
`jrDepart`, and `jrToggle` opens the read-only book. A nineteen-chapter sweep came back
with `biome: "sydney"` in all nineteen rows and read exactly like a room system that never
switched. The **title card takes a picker digit directly** (`sysPickFromKey` → `startGame`),
so a per-chapter sweep is one reload per chapter and that is the only keyboard route in.
Assert `game.biome.current` in every row — that is the only reason it was caught.

## THE LENS PASS (v40 — 30 Aug 2026)

Five things between the Lambert output and the canvas, and one bug found while
measuring them. Everything is in `mainMakePost` / the three `MAIN_POST_*`
shaders plus one table and eight lines in `sysDressFrame`. **No mesh, no
`PALETTE` entry, no chapter file and no line of the aesthetic law was touched**,
and every one of the five is a no-op at its default, so a chapter that opts into
nothing is byte-for-byte the chapter that shipped.

The review that specified it was nineteen arrival frames (`qa/vis-review.js`),
and it found the same two sentences over and over: **a light in this game was a
sticker, and a frame in this game had one tint on it.** The lamp on the Monte
Carlo quay was a white disc with a hard edge. Reykjavík's windows were yellow
rectangles on a flat grey street. Sydney's lawn, the Jemaa's sand and the
Piazzetta were each one value from corner to corner.

### 1. A SECOND BLOOM OCTAVE — `wide`

One scale of blur is the glow ON a light. The air AROUND it is an octave down
and much wider, and without it a bulb is a shape rather than a source. The wide
pass starts **from the finished quarter-res bloom**, not from a second reading
of the scene: four more separable passes at an eighth, so the halo is the tight
one carried outward and cannot disagree with it. Composited on its own uniform
at `bloom * wide`.

`wide` is one number per chapter in `sysLENS`. **A chapter whose subject is
light wants most of it and a noon chapter wants a third**, because in Sydney the
pixels over threshold are a hundred square metres of sunlit sail and a wide blur
of that veils the whole frame. Mong Kok was authored at 0.90 and pulled back to
0.72 for exactly that reason — at 0.90 the pink sign across the street washed
the shelves of the shop under it.

### 2. THE BRIGHT PASS READ ONE TEXEL IN SIXTEEN

A quarter-res texel covers sixteen source texels and the bright pass point-
sampled one of them. **A one-pixel light therefore flickered in and out of the
bloom as the camera moved**, because whether it survived depended on which of
the sixteen the sample landed on — a glow-worm, a window across the street, a
speck of sea sparkle. Four bilinear taps at the centres of the four 2×2
quadrants is an exact 4×4 box average for four reads, and a light that is
averaged IN cannot flicker out. It is also the other half of the note in the
cave's grade row about a quarter-res lattice.

### 3. A SHOULDER

Everything over white met `clamp(c, 0.0, 1.0)`, so a sunlit wall, a bulb and a
sheet of foam all arrived at exactly 1.0 with a visible edge where they got
there. The top rolls off now: `min(x,k) + (1-k)(1 - exp(-(x-k)/(1-k)))`, which
is continuous at the knee and asymptotic to white — 1.2 lands at 0.99, 3.0 lands
at 0.9999, and there is a gradient between them. **At `shoulder = 1.0` it is
arithmetically the old clamp**, which is what the A/B switch writes.

`sysSHOULDER` is 0.86 and it is NOT per-chapter: it is a property of the lens,
not of the place.

### 4. SPLIT TONING — `splitW` / `splitC`

`uTint` is one multiply over the whole frame, so half the rows in `sysGRADES`
were **written about something the code could not do**. Monte Carlo's says "the
tint splits, warm in the highlights and blue in the shadows, which is what blue
hour IS and is the only reason to set a chapter in it", above a line that
multiplies every pixel by the same three numbers.

Two tints against luminance now. Two things about how:

- **TWO RAMPS WITH A GAP BETWEEN THEM, not one mix from shadow tint to
  highlight tint.** A single mix has no neutral: every pixel gets one tint or
  the other in proportion, and Sydney's lawn is 0.55 luma and two thirds of the
  frame, so it took most of the warm push and the chapter went olive. The
  shadow ramp is spent by 0.45, the highlight ramp starts at 0.55, and the
  middle of the picture is left alone. That is what a split tone is.
- **A row is two numbers, not six.** The warm and cool axes live in main.js
  (`MAIN_SPLIT_WARM`, `MAIN_SPLIT_COOL`); a chapter says how far along each it
  sits, and a chapter that wants the reverse writes a negative one. 0.03 is a
  five per cent red-blue spread between the sun side and the shade side of the
  same white wall — about what an afternoon does, and well under what anyone
  reads as a filter.

### 5. THE VIGNETTE HAS A COLOUR

The corner of a real lens does not only go dark, it loses colour and goes cool.
`vigTone` mixes toward a cool desaturation **in proportion to the vignette the
row already asks for**, so a chapter that barely vignettes barely tones and no
second table is needed. It is the half of a vignette that makes the middle of
the frame look lit instead of the edge look painted.

### AND THE BLOOM ONLY EXISTED AT ONE WINDOW SIZE

Found while photographing the lamp at three resolutions to check the wide
octave. The blur offset was `radius / bw` — **the same number of quarter-res
texels at every size, and a quarter-res texel is a smaller piece of the picture
on a bigger monitor.** So the halo shrank as the window grew, and nineteen grade
rows tuned by eye at 720 only existed at 720. Anchored to `MAIN_POST_REF_H` now,
with the correction capped at 2× so the five taps of the second octave cannot
spread far enough apart to ring on a very large screen.

Measured with `qa/lens-res4.js` — mean luminance of an annulus 0.10–0.20 of
frame HEIGHT out from the bulb, which is the same piece of the picture at every
size (the first probe walked outward from the brightest pixel and measured the
BULB, which is constant, and read almost no difference):

| frame height | old | new |
|---|---|---|
| 720 | 0.3001 | **0.3001** — the anchor, identical to the byte |
| 1080 | 0.2918 | 0.3045 |
| 1440 | 0.2871 | 0.3057 |

### WHAT IT COST

**+0.009 ms (Sydney), +0.013 ms (Monte Carlo), +0.021 ms (Mong Kok)** — the
whole pass, all five things. Frame time 16.5–16.9 ms median in every chapter
measured, unchanged, a locked 60 in both arms.

An rAF-interval benchmark cannot see any of this: the game is vsync-locked, so
both arms read 16.6–17.0 and the number is the display, not the work. The
figures above are `post.render()` × 60 with a `gl.readPixels` at each end to
drain the command queue, medians of five, arms interleaved — **and the first
arm of every single run was 5–10 % slow**, exactly as the presence pass wrote
down, so a two-arm comparison that does not interleave and take a median
measures warm-up.

### THE SWITCHES

`noWide`, `noSplit`, `noShoulder`, `noVigTone`, `noBloomRef` on `game.state`.
All five **CUT rather than fade**, for the reason in the presence pass: a probe
reads two frames at `dt = 0`, a damped switch does not move in two frames, and a
fading switch therefore makes both arms of an A/B identical and the feature
measures as doing nothing.

## CAN EVERY TASK ACTUALLY BE DONE (v39 — 29 Aug 2026)

Prompted by one report from play — the Monte Carlo dinner jacket could not be
reached. It could not, and neither could the chapter's high dive; see chapter 18
below. The question that followed was whether anything else in the other
eighteen chapters had the same shape, and it needed an instrument rather than a
reading.

**`game.hintTarget(id)`.** `sysHINTS` and its dozen `hint*` helpers are
closure-local, so before this an audit that wanted a task's pointer target had
to re-implement `hintObj` / `hintProp` / `hintNpc` / `hintZone` / `hintXZ` /
`hintKyoLantern` / … and got `ReferenceError` for its trouble. One getter, no
setter, and null for anything that throws — a `where()` that dies answers the
same way an unbuilt chapter does.

**Three sweeps, and what each is worth:**

| | |
|---|---|
| `qa/taskaudit.mjs` — static | Every id in the `TASKS` table against every reference in the nineteen chapter files, both directions. **271 rows, 0 orphans, 0 ghosts.** Cheap, and it only proves the wiring exists. |
| `qa/reach2.js` — the pointer sweep | For all 271: resolve the target, drop the animal on its column, let it settle, and report the gap between the target and what it ended up standing on. **207 targets resolved, 64 null — and all 64 are the arrival rows, the place finds and the call-an-animal verbs, which is correct.** 45 flagged; every one accounted for (moving carriers — the chiva roof, the bondinho, the snowcat, the gondola, the volo cradle mid-flight; underwater targets in Palawan where the animal floats; and the Venice passerelle, which is not deployed until the siren). Nothing else of the yacht's shape. |
| `qa/buried.js` — the buried-platform detector | Every axis-aligned static box in the live world whose TOP FACE is inside another box, over 75% of its area. This is the detector for the class the yacht was in — a floor you cannot stand on. Monte Carlo now returns clean. Of the 54 elsewhere, 40 are Son Doong's interior floors under the mountain and the other 14 were drop-tested by hand (`qa/buried2.js`): every one is a foundation inside terrain or a step in a stack, and the animal lands on a real surface at or above the flagged slab. **It cries wolf and it is still worth running** — it found the only real instance in the game in one pass. |

**What this does NOT cover, and it should be said plainly:** the sweep proves a
task's target sits somewhere the animal can stand. It cannot prove a task's GATE
can fire. A completion playtest of all 271 was not run; chapter 18 was walked
end to end because it was the reported one.

## CHAPTERS 18 AND 19 — MONTE CARLO AND HANOI (v29 — 26 Aug 2026)

Two places, and they were built together on purpose: they are the two ends of
the same argument about what a CITY is. Monte Carlo is the smallest city on
earth at blue hour with everything switched on and five people paid to look at
you; Hanoi is ten in the morning, twenty-nine degrees, and two hundred and
forty motorbikes that are not going to stop. One is a locked door and one is a
river. Neither of them is a landscape with tasks in it, which is what the
previous seventeen have in common.

### CHAPTER 18 — MONTE CARLO (`monaco`)

**THE EYE — the first thing in this game that is ever denied.** Five croupiers
sweep the Casino floor on their own phases; `monSeen` fills inside a cone and
drains fast outside one, and at 1.0 you are picked up under the forelegs and
put back on the steps.

The whole penalty is **ten seconds and whatever was in your mouth**, and that
is not a compromise, it is the rule the other seventeen chapters keep. Nothing
becomes impossible, nothing is lost, you may walk straight back in, and no task
in the chapter is gated on not being seen — `the-floor` is a run you can
re-attempt for ever and its record is a time.

**It is built out of verbs the player already has, and that is why it needed no
tutorial.** THE LOAF — sitting still, which this game had rewarded exactly once
before — halves the range at which a cone finds you (`monEYE_LOAF`). RUNNING
raises it by half again. Carrying something raises it a little. There is no
meter: the cones are real wedges on the floor and they go red as they fill,
because this game has never had a HUD element and was not going to grow one.

Four numbers were measured rather than chosen:

| | |
|---|---|
| `monEYE_FILL` 0.86 / `monEYE_DRAIN` 0.58 | at 0.60/0.95, thirty seconds of pacing across the atrium **at a run** peaked at 0.46 and never once ejected anybody. A sweep at 0.7 rad/s holds a point for about 1.3 s; a fill that cannot reach 1.0 in a pass and a half is a mechanic that is switched off and looks exactly like one that is working. |
| the croupiers are **not** in `monCOVER` | `monBlockedSight` casts FROM the watcher's own position, so a cover circle centred on the ray's origin is a ray blocked at t = 0. With one, the room could not see anything, ever. |
| `monCAR_VMIN` 5.4 | the hairpin is the one place on the lap a capybara can board a car, so it is the one number the third act needs. A capybara runs at about seven. |
| the corner law's constant, 3.4 → 2.8 | `v = C/sqrt(k)` is a constant-lateral-acceleration law and C² IS that acceleration. At 3.4 the corners peaked at 1.2 g and no amount of friction holds a passenger through that. |

**THE STACK.** The only economy in the game. A plaque is a real prop, the
roulette wheel is a real kinematic disc, and dropping a plaque into a turning
wheel pays what the pocket says — red two, black one, green eight. **Nothing is
ever lost**: a gamble with a downside would be the first thing in eighteen
chapters that could take something off a player, and the pleasure is the two
seconds of watching, not the arithmetic. What it buys is the first number in
this game that goes UP because you did something, and the first task that is a
threshold rather than a switch.

**THE CIRCUIT.** Three cars lap the streets on their own clock. It is the
fifteenth thing in this game that carries the animal and the first that does 26
m/s, so it DECLARES its frame (`carryFrame`) rather than leaving the animal to
the contact sweep, and it keeps all five carrier rules. Two things about it are
worth writing down:

- **The car is open-topped, and that was a gameplay decision.** The first build
  was a fastback with a roof at 1.44 m; `capyJUMP_V` peaks at about 1.2 m of
  rise, so the hop that boards it missed by twenty centimetres every time.
  Splitting the collider into a deck and a cabin made the boot 55 cm long, the
  animal landed on the cabin instead, and the solver posted it off the side
  inside eighty-four frames. An open car is ONE BOX at 95 cm with **four rails
  round the cockpit** — a hop a capybara can make, a well it cannot fall out
  of, and a better picture.
- **A one-frame gap is not getting off** (`monRIDE_GRACE`). The rider test is a
  box in the car's own frame; at 26 m/s a corner puts the animal outside it for
  a frame with the contact perfectly sound. Without the latch the tunnel's
  entry mark was thrown away and re-taken every five to ten frames all the way
  through the bore and the marquee could not be earned at all.

**AND THE TUNNEL IS A CUTTING WITH A LID ON.** The terrain conforms to the
circuit (the chiva-road pattern), so the one leg that is roofed gets a much
wider shoulder — eleven metres against three and a half — because a 20 m cut
with 5:1 walls is a slot canyon and a five-metre heightfield turns 5:1 walls
into a staircase. The lid is collided ON TOP: walking over your own tunnel is
one of the chapter's two place finds.

**ROTATIONS ARE +yaw AND NOT −yaw.** A box turned about Y by θ sends its local
+z to (sin θ, cos θ), which is the convention every heading in this codebase
already uses. Negating it mirrors the piece about the z axis: on a straight it
looks like nothing at all and on the west quay it produced a hundred metres of
crash barrier lying across the road like a cattle grid.

**FOUR SPAWNS INSIDE FOUR DIFFERENT OBJECTS.** (-62,−46) was eight metres
behind the circuit's own barrier; (−20,−6) was inside the palm row; (−26, 8)
was inside a building; (0,−84) put the CAMERA inside a palm. The fifth was
found by SWEEPING the quay against `navBlocked` at 3.2 m, against a road-distance
test, and against a clear camera arm at the spawn's own yaw — which is what a
chapter with 153 lamps, 54 palms and 34 bollards on it requires. **A spawn is
not a coordinate you pick off a map.**

**THE SUN DECK WAS INSIDE THE DECKHOUSE, AND TWO TASKS WERE UNCOMPLETABLE.**
Reported from play: the dinner jacket could not be reached. It could not. The
yacht's two deckhouses were collided as solid boxes running from the main deck
at 2.8 m up to 8.7 m, and BOTH companionways were drawn and collided inside
them — every tread sealed in the wall it was supposed to climb. The measured
standable surfaces on the boat were 2.8 (the main deck, off the passerelle) and
then nothing until 6.0 and 8.7, which are the two deckhouse ROOFS; `capyJUMP_V`
peaks at about 1.2 m of rise. There was no route above the main deck at all.

`black-tie` (the jacket, lying in plain sight on a lounger at 8.4 m) and
`high-dive` (which needs a departure above 5.5 m over the water) were therefore
both impossible, and neither said so — the card pointed at the jacket and gave
its range all evening.

Three rules came out of it and all three are cheap to check on any vessel or
building with a floor above another floor:

| | |
|---|---|
| **a deckhouse collider stops at the deck it carries** | cabin 1 spans `monDECK1..monDECK2` and cabin 2 `monDECK2..monDECK3`. They were 0.4 and 0.3 m too tall, so each deck's teak was buried under the roof of the house standing on it and the animal stood on a slab a hand's width above the floor it could see. |
| **a companionway must be in open air** | flight A is on the aft deck abaft the deckhouse; flight B is on the foredeck ahead of the sun-deck house and climbs aft. Eight treads each, 0.40 m of rise on 0.62 m of run, and the top tread lands flush on the deck above rather than a hand's width under it. |
| **the route between two flights has to be walkable** | with the flights at opposite ends of the boat, the walk between them is eleven metres past the sun-deck house. At `B − 2.4` that left a 70 cm side deck. `B − 3.8` gives 1.4 m a side and the sun deck above overhangs it. |

Verified by walking it, not by reading it: quay → passerelle → aft deck →
flight A → bridge deck → port side deck → foredeck → flight B → sun deck →
grab. `superyacht`, `black-tie` and `high-dive` all tick, and the dive files
9.7 m.

**AND THE JACKET GOES ON.** `black-tie` used to tick and leave a dinner jacket
in the animal's mouth, which is the one place a dinner jacket does not go. The
prop is removed and `capy.dress(true)` puts the costume up instead: a midnight
jacket over the barrel and the shoulders, a satin shawl collar, a wing collar
and a black bow under the jaw, and sunglasses with a brass rim. Three things
about it are the whole of the implementation and each was a bug first:

- **Built once at `createCapybara`, hidden, never built on demand.** A costume
  assembled on the frame a task ticks is a hitch in the middle of a
  celebration; twelve boxes cost nothing to carry around invisible.
- **The jacket rides `capySquash` and the glasses and tie ride `head`.** Put
  the glasses on the body and they leave the face the moment the animal looks
  up; put the jacket on the head and it swims on every hop.
- **A capybara has no neck.** The first pass put a shirt front on the chest at
  z 0.30 and a bow tie at head-y −0.115, and both were invisible from every
  angle a player ever has: the skull box runs z 0.08–0.58 and the jaw 0.52–0.76,
  so there is nothing between the shoulders and the muzzle that is ever on
  screen. The only part of this animal that reads as a throat is the four
  centimetres under the jaw's front, and that is where the collar and the tie
  are.

Nothing in the costume joins `wetParts` — the soak swaps a mesh for its wet
twin, and a jacket with no wet twin comes out of the harbour wearing the
belly's colour. It is asked for every frame in `update()` rather than raised on
an event (`isActive('monaco') && taskRec['black-tie'].done`), because a save
restore, a chapter change and a picker jump are three places an event does not
fire, and `dress` is idempotent.

### CHAPTER 19 — HANOI (`hanoi`)

**THE FLOW.** Two hundred and forty scooters over four street centrelines,
nine floats each, no object anywhere. Every rider can see the capybara: inside
`hanSEE` it swings its lateral offset away and lifts off, and two hundred and
forty of those, damped, IS a river parting.

**What decides whether it works is you.** A rider commits to a line about a
second and a half ahead. Hold your speed and your heading and that is the same
place you will be. Change your mind — `hanDither` is the accumulated heading
change over the last second and a half — and it is not.

Four attempts at what happens then, and the two wrong ones are the useful part:

1. **A clip: a shove and a horn.** It is the obvious reading of "do not stop"
   and it is wrong twice over. It made standing still cost twelve metres of
   being pushed down the street, which is a punishment rather than a joke; and
   it made the chapter's own first mini UNREACHABLE, because a flow that parts
   at 3.4 m and shoves you when it cannot is a flow you can never touch.
   Measured: sixty-six seconds in the middle of the busiest street and the
   nearest machine never came inside 2.08 m.
2. **Letting them through you.** No.
3. **They JAM.** What a Hanoi street actually does to somebody who plants
   themselves in it is stop. Everybody brakes, nobody says anything, and
   thirty seconds later there are forty of them in a fan round one capybara.
   It is funnier, it is true, and it is what makes the mini possible — a
   stopped scooter is a thing you can hop into.
4. **And the clip is reserved for changing your mind**, which is the one thing
   a rider a second and a half behind you cannot allow for.

**AND NOBODY IS LOOKING UP.** While the animal is AIRBORNE, any rider inside
seven metres stops avoiding and lines up under it instead. That single line is
what makes `ride-the-flow` reachable at all, and it is the chapter's verb: you
do not walk up to a scooter, you hop into the traffic.

**THE RECORD IS A COUNT OF PEOPLE, NOT AN INTEGRAL OF TIME.** `cross-the-road`
reports HOW MANY OF THEM HAD TO GO ROUND YOU. As a time integral a clean
four-second crossing of the busiest street scored **one**, because the
accumulator only ran while a rider was inside a nine-metre window. On the
rising edge, one per rider, it scores forty-four, which is both the truth and
the joke.

**TRAIN STREET.** A metre-gauge line down an alley with a hundred people living
in it. Twice in the chapter a horn sounds and `hanFoldK` — driven by the CLOCK
and never by the player, because a street that folds because you walked into it
is a street reacting to you and the whole point of this one is that it is not —
lerps every awning, stool, table, crate and drying rack in the alley from its
open transform to its folded one over about four seconds. Eleven seconds later
a train comes through at 11 m/s. **The marquee is a thing you do by not moving**,
which is the opposite of the chapter's other two.

The alley is 6.4 m wide and not the real 4. At four, a third-person camera
twelve metres behind the animal at 35° is inside somebody's first floor and the
marquee happens off screen.

This paragraph used to end by claiming the train's own clearance was *untouched*
at 45 cm, "because that is the number the chapter is about". That was true of the
real Hanoi and has never been true of the shipped chapter. Widening the alley
widened the clearance with it: the hull is 1.45 m in a 6.4 m street, which leaves
about 2.6 m either side, and **2.6 m is the number the chapter actually pays out
on** — see `hanTRAIN_WOW` in hanoi.js, which is what the in-pass payout and the
despawn safety net both read. The 45 cm constant was a leftover from before the
widening, was read by no line of code, and has been deleted. If the tight
clearance is ever wanted back, it is the alley's `half` that has to come in, and
the camera problem above comes back with it.

### AND FOUR THINGS BOTH CHAPTERS PAID FOR

**1. `InstancedMesh.instanceColor` multiplies EVERYTHING.** It is applied per
instance and not per part, so a merged scooter whose tyres, helmet, skin and
crate carry their own vertex colours came out as two hundred and forty entirely
monochrome scooters, one of them yellow including the rider's face. And a plain
`BoxGeometry` handed to a material with `vertexColors: true` has no colour
attribute at all and renders **black** — every shop sign in the Old Quarter was
a black slab. Two rules cover every instanced mesh in both files:

- one colour all through (a stool, a sign, a backdrop block) → the geometry is
  WHITE, or plain with a plain material, and `instanceColor` supplies it;
- many colours, one of which varies (bodywork, a shirt) → **one mesh per
  variant** with the colour baked into the merge, and no `instanceColor`.

**2. AN ELLIPTICAL PAD CANNOT HAVE A GENTLE SIDE.** Le Rocher's rim went from
22 m to 58 m in ten metres of ground — a grade of 1.79, sixty degrees — so the
one way onto the one place in the chapter with one way onto it was a wall.
Widening the pad does not fix it: the rim is a smoothstep and most of it is
spent below the height the neighbouring pad has already reached, so at a
46-metre soft the worst grade is still 0.69. **The ramp is a ROAD** — a second
centreline with the terrain blended toward it — and it is 24%.

**3. A GENERATOR THAT LAYS BUILDINGS ALONG A CENTRELINE DOES NOT KNOW THE NEXT
CENTRELINE CROSSES IT.** Eight of Hanoi's tube houses stood in the middle of the
east-west road, `navBlocked` said X for the whole width of it, `cross-the-road`
was unreachable and the bia hoi corner — the chapter's second mini — was inside
a building. `hanTerraceOk` tests THREE points per house (shopfront, middle,
back wall) against every lane and against a list of keep-outs, because a
twelve-metre-deep house whose centre is clear can still have its back half in
the next street.

**4. A RAILING THAT IS DRAWN AND NOT COLLIDED IS NOT A RAILING.** The Huc
bridge is a 3 m arched deck over eighty metres of lake and Long Bien is a 9 m
deck twenty-six metres over a river; both had balustrades in the merge and
nothing in the solver, and every crossing of either ended in the water. Both
now carry parapet colliders, and the chapter's way out is at the far end of one
of them.

### THE TWO SCORES

Nineteen and twenty in `sysMUS_PAL`, appended after the title card at eighteen,
so not one of the first eighteen chapters' `pal` numbers moved.

**Monte Carlo is the fifth BAND in that table and the first that is a piece of
fiction.** Salsa, samba, gnawa and the Kowloon synth are the music that is
actually playing in those four places. Nothing is playing in Monaco; what is
playing in Monaco is what a player has in their head the moment they see a
casino, a dinner jacket and a silver car, and pretending otherwise would be the
one joke the chapter is for. E minor with a major ninth and no third in the
bass, a tremolo-picked guitar through a very hard reverb send, a walking
upright, brushes and a ride — and a brass section that plays four notes once
every eight bars and is the loudest thing in the chapter when it does.
Everything else in the arrangement is turned down so that there is somewhere
for the horns to arrive FROM.

**...AND THE LOUD HALF OF IT HAD NEVER ONCE PLAYED (v39).** Reported from play:
the chapter does not sound like the thing it is a joke about. It did not, and
the reasons were three, all of them the same shape as `monEYE_FILL` at 0.60 —
a documented top end that no session had ever reached.

| | |
|---|---|
| **`musBondHeat` had four readers and no writer.** | The arrangement is written against it exactly the way the gnawa cell is written against the sandstorm: doubled brushes, harder tremolo picking, the chromatic approach on the bass, and **the horns every fourth bar instead of every eighth**. It was `let musBondHeat = 0`, read in four places, assigned in none — so the section was permanently at rest and 20% under its own level. It is driven now from `game.monaco.heat()`: the eye, the stack and the circuit, which are the chapter's three mechanics. It rises in a fifth of a second and falls over two, because a cue that tracks the eye frame by frame flutters instead of swelling. |
| **The riff played the same bar twice, in unison.** | `for (half = 0; half < 2)` worked out at `(half * 16 + r.t)` sixteenths and a bar is sixteen, so `half = 1` was this bar's figure written a whole bar late, landing exactly on top of the next bar's `half = 0`. Not a second statement — a unison double, twice the notes and twice the level for nothing. The figure spans eleven sixteenths of a sixteen-sixteenth bar and never could have gone twice. It states once — **at 1.65 and not at its written 0.95**, because two identical notes at the same instant are one note 6 dB up: taking the double away at the written level drops the palette's lead voice by a third, which is the opposite of the fix. |
| **Chord 0 was not the chord.** | It was `E B D F# B`: an Em9 with no third. The sound everybody means is a **minor triad with a MAJOR SEVENTH on it** — the minor third and the major seventh sounding at once, one semitone below the octave, and that semitone is the whole identity of the idiom. The palette's own comment called it "the single most identifiable five-note stack in twentieth-century film music" and then wrote a different stack. `E G B D# F#`. |

The sting — the whole chord, arpeggiated on the guitar when the harmony reaches
it — now takes the brass with it once `heat > 0.34`, because a minor-major
ninth held on three saxophones IS the gesture and firing it every eight bars
regardless would spend it. It is the idiom, written from the idiom's own
ingredients: it is not a transcription of anybody's tune, and it must not
become one.

**Hanoi is the sparsest palette here after Kyoto's**, and for the opposite
reason to every other quiet chapter: the place is the loudest in the game, so
the score gets out of the way completely. A drone, a pentatonic five notes wide
with no semitone in it anywhere, and a dan bau — one string, no frets — playing
about one note every three seconds. Everything that makes that instrument
recognisable is a PITCH GESTURE and not a timbre: approached from below, bent
while it sounds, and a deep slow vibrato on the tail, which is six frequency
ramps and a sine.

### MEASURED, AFTER BOTH (26 Aug 2026)

| | monaco | hanoi |
|---|---|---|
| triangles | **126,665** | **230,790** |
| draw calls | 66 | 80 |
| shadow-casting triangles | 54,992 | 176,064 |
| bodies in the world | 41 | 40 |
| worst body speed, 90 s random-input soak | 30.4 m/s | 28.7 m/s |
| NaN / thrown errors in that soak | 0 | 0 |

Hanoi is the largest chapter in the game and it is a city of four hundred
frontages; the gate was re-affirmed in batch 4 as **not predictive of cost**
(quay is 201,503 and is one of the two cheapest per triangle in the game), and
what was actually spent here was measured and cut where it was free: three
balusters per balcony rather than five (57,000 triangles of twelve-triangle
sticks nobody can resolve past eight metres), six-segment wheels rather than
ten on two hundred and forty machines, and a five-metre terrain grid on a
terrain with three features in it. 262,436 → 230,790, with nothing visible
changed.

**AND THE CABLES DO NOT CAST.** Two thousand three-centimetre wires over every
street in the quarter put a black hatch across the whole road surface, because
a shadow map cannot resolve a 3 cm wire and what it draws instead is a smear.
They read perfectly well as a silhouette against the sky, which is the only
place anybody ever looks at them.


## THE PAYOFF PASS, BATCH FOUR — THE STEP THAT ALREADY HAPPENED (v27 — 26 Aug 2026)

The five pillars on chapters 12-17 (Palawan, Cappadocia, Manly, the Pantanal, Sơn Đoòng,
Antarctica), plus the performance re-measure and the release sweep. Six measurement
subagents, fixes on the main thread, one commit per chapter. `qa/BATCH4.md` is the
handover and the found-versus-fixed report for all four batches.

### THE ONE THAT WAS NOT A CHAPTER — a parked capybara slid down every slope in the game

`world.step` runs BEFORE `capybara.js`. So by the time the idle snap (`capyGRIP_SNAP`)
decides the animal is stationary and writes `vx = vz = 0`, the solver has already given it
`g·sin(θ)·dt` of down-slope velocity **and integrated that into the position**. Zeroing the
velocity afterwards erases the evidence and keeps the displacement. Every frame. For ever.

The arithmetic closes to three decimals, which is what turns this from a hypothesis into a
diagnosis:

| where | slope | predicted `24·s/60` | measured |
|---|---|---|---|
| Sơn Đoòng, spawn | 0.055 | 0.0220 m/s | 0.0226 |
| the doline | 0.0475 | 0.0190 | 0.0190 |
| (30, −70) | 0.175 | 0.0700 | 0.0674 |

and it is a **fixed-step** quantity, which is the clincher: ticking at 1/120 and 1/240 gives
the identical 0.0228 m/s, and 1/30 gives 0.0371. A real slide scales with time, not with the
step.

**It was never one chapter.** Over sixty seconds, no input, `body.velocity` reading exactly
0.000 and `capy.loaf` at 1.0 the whole way: Manly's beach 13.36 m into the sea, Antarctica's
spawn 3.12 m, Palawan's beach 3.65 m, Pasto 3.04 m, the cave 1.34 m. **Two previous batches
looked at four of those and wrote them up as five separate chapter faults.**

**THE RULE: static friction is a POSITION, and it cannot be expressed as a velocity write
after the integration has already happened.** capybara.js deliberately never assigns a
position, so the snap now holds an ANCHOR — taken when the animal stops, carried in the
FLOOR'S frame (`platVX/platVZ`, so a capybara asleep on a moving ferry is pinned to the deck
and not to the harbour) — and hands back exactly the velocity that returns to it. To first
order the next step's own creep is cancelled and the net displacement is zero: bounded, not
linear. `capyPIN_MAX` (0.55 m) is the reach past which the animal has genuinely been moved —
a teleport, a rescue, a launch, a carrier — and the anchor is re-taken instead.

Measured after: **14 of 17 chapters are now exactly 0.00 m at both `qa/stillness.js` sample
points.** The three that are not: Antarctica's off-spawn 20-degree glacier, which still
slides and should — its `slip` is over the snap's own threshold, and an ice slope that holds
you is a wall; the Drift's off-spawn point, which is a 24.95 m FALL off the Shelf and not a
slide at all, and the audit prints `fell` so you can tell; and Pasto, which is left open —
see the handover.

### AND NOBODY WALKS THROUGH THE PLAYER

The other half of the same symptom, and it looked identical from outside. A walker's collider
is **mass-0 KINEMATIC**, so cannon resolves any overlap between it and the capybara by moving
**the capybara**. `npcSeparate` was already pushing people out — to `npcSEP_R` = 1.05 m — and
the two shapes touch at **1.065**: the capybara is three spheres of r 0.34 at z = 0, ±0.34
(reach 0.68) and a walker box is he (0.18, 0.30, 0.34), xz half-diagonal 0.385. So the
separation parked every walker exactly on the contact boundary and the solver spent the rest
of the encounter resolving a hair of penetration.

Measured in Pasto, parked at the spawn with no input for sixty seconds: the animal was
displaced **4.30 m, 12.29 m and 28.86 m on three runs of the same build** — the spread is the
parade's phase, not noise — while the nearest body throughout was a walker at 1.83–1.91 m/s
holding station 0.95–1.07 m away.

`steerTo` cannot fix it: `navBlocked` forwards only to `game.env.navBlocked`, which is
**static world geometry**, so a walker dodges a building and has never had a term for the
animal at all. The guarantee is in `npcPlaceBody` instead — the one place any of these bodies
is written — at `npcBODY_CLEAR` = 1.30 m, and only for bodies carrying `userData.npc`, because
anything else placed through there may be a floor the animal is standing on and a carrier that
refused to go under its passenger would drop it.

**No exemption list, deliberately.** A person whose errand IS the player stops when they get
to them, which is what arriving means; flee, plunge and cornered all move the other way, so
the clamp is inert for them by construction. Only the INWARD component is removed, so anyone
can still walk past, around or away at full speed. The DRAWN figure is not moved: the two
disagree by under a metre for about a second, and the alternative is a person who cannot walk
down a path the player is standing on.

### A GHOST HAS NO SILHOUETTE — `sysEnableShadows` leaves alone the things that said no

`registerShadowTarget` is the last line of every biome's build and it answered with an
unconditional `castShadow = true` over every mesh it could reach — so **every
`castShadow = false` written anywhere in a chapter file was undone about four lines later**.
Rio noticed and wrote its own repair pass; Göreme copied it; nobody else did, and the two who
did had to remember to run it *after*.

Measured across the seventeen at spawn, visible meshes only: pantanal 222,730 of 225,526
casting (98.8%), venice 179,354 of 181,814, cave 156,824 of 158,516, kowloon 151,614 of
154,058 — **of which 36,144 were transparent**.

Two ways to say no, both already in the codebase:

- **`userData.noShadow`** — an explicit refusal, used by the Drift's island keels and
  Göreme's headlight wedges since before this existed.
- **a GHOST MATERIAL** — transparent, `depthWrite === false`, or additive. Nothing you can see
  through has an honest silhouette to cast, and there is no case in seventeen chapters where
  one should.

About **145,000 triangles** left the shadow pass across the game with no scene geometry
removed and nothing lost from any picture. It is a PICTURE fix as much as a cost one: the
Pantanal's flood sheet is 260 × 232 m of transparent water at y = 0.3 and it was laying a
hard shadow on everything under it — the same fault as Palawan's water sheet over the reef and
Rio's eighty metres of surf shadowing the sea it was breaking on.

### `frameShot({ over: true })` — the channel the vehicle chapters could not reach

v26's rule was that a shot is weighted to nothing under the helm, a ride and a condor, and for
a generic task-completion shot fighting a rig whose whole point is to sit behind the vehicle
that is right. It also means the channel is **unreachable by exactly the chapters whose
marquee happens ON the vehicle**, and there are two: Antarctica's `orca-ride` is at the helm
and Pasto's `condor-ride` is in flight. Measured: the shot Antarctica asks for at its payout
changed the lens by **0.00**, because `sw = shotW * (1 - sailT)` was zero for all of it.

`over` says the chapter that owns the vehicle is the one asking. It is still not a command:
`camHandT` — the player's hand on the camera — kills it in a third of a second exactly as
before, it still expires on its own envelope and it is still cleared on `biome:enter`. It only
removes the argument about which of two systems in the same file should win, in the one case
where they are the same author.

### A MARQUEE NOBODY WAS NEAR IS OWED THE LINE, NOT DENIED IT

v26 raised `wow` praise from 15 m to 40. Forty metres is enough for a square and nothing like
enough for a chapter whose marquee happens out in the world, and this batch measured three:
Antarctica's `orca-ride` pays out **212.0 m** from the nearest of its six locals, Palawan's
`the-bloom` is 47.9 m from the nearest of its seven at the reef, and the western half of the
Pantanal's legal crossing is 41.0 m from both of its witnesses. In all three the chapter had
**written** the lines — `onTask: { 'orca-ride': [...] }` appears on four Antarctic locals —
and they were unreachable code.

So the line is HELD (`npcWowOwed`) and delivered by the first person the player comes back
within earshot of, at the praise radius rather than the wow radius because this one is said to
your face. One at a time, and it dies at the border. It is also simply better: an empty ocean
has nobody in it BY DESIGN, and being met on the jetty by someone who already knows is a
warmer answer than a stranger applauding from the water.

### `placeCue(o, x, y, z, far)` in shared.js — and why it must not mutate

*The loudest cue is the most likely to be mono* has been true in every batch of this pass.
Batch 4 measured 24 mono calls in Cappadocia, 48 in Manly, 47 in the Pantanal, 35 in Palawan
and 29 in Antarctica — five whole chapters in which nothing has a direction, including the one
sound the player is owed. What made it so easy to leave is that every one of those files
**already computes the source's (x, z)** in order to scale the volume by distance, and then
throws the position away.

`at:` alone is not the fix: `sfx()` applies its OWN inverse-distance rolloff, so passing a
position attenuates everything twice and halves the chapter's tuning silently. `placeCue` sets
`near` to the chapter's own `far`, which makes `audioPlace`'s gain exactly 1.0 everywhere the
chapter thinks the sound is audible, and leaves PAN as the only thing it contributes; the
outer `far` clears `sysSFX_FADE` (45 m) so its taper never reaches back inside.

**AND IT COPIES RATHER THAN WRITES.** Every one of these chapters fires its cues through ONE
shared, mutated options object — `manSfx`, `panSfx`, `sysSpatial` — reused for the life of the
page precisely so that a sound in an update loop allocates nothing. Writing `at` into that
object would leave it there, and the next forty mono calls that set only volume and pitch
would inherit a position from whatever was last placed: a gull would start coming from a wave,
silently. Same shape as the `mat()`-keyed-by-colour and `grain()`-keyed-by-uuid caches this
codebase has already paid for twice.

### A CAMERA IN THE DARK HAS TO OPEN UP — `sysPHOTO_LIFT`

The one chapter that is about darkness produced a black postcard. Photo mode had three
parameters — saturation, contrast and VIGNETTE — and a vignette makes an already-black frame
blacker. Measured in Sơn Đoòng at (0, −86), daylight 0.001: the stored 288×180 album thumbnail
came back at **mean luma 17.6 of 255 with 52.3% of its pixels under 16**, kept for ever in the
album and offered to the title card as a postcard.

The post chain already had a `lift` channel nothing used. `sysSceneLit` is now read once a
frame where the lighting blocks finish moving the three lights — the same place and for the
same reason the dome and the grade are read there — and photo mode opens up by
`(1 - sysSceneLit)`: exactly zero in fifteen chapters, and it never touches a frame that
already has light in it. The vignette fades out as the lift comes in, and some contrast is
given back, because opening up flattens. Differential, same spot, same shutter,
`git stash` on systems.js: **mean 19.0 → 26.4, black pixels 41.7% → 4.9%**.

### A LIGHT SOURCE IS NOT SOMETHING YOU ADD ON TOP OF NOON

Palawan's bloom block only ever ADDED — +0.35 hemi, +0.16 ambient, a 0.14 background lerp — on
top of a chapter whose identity is a BLEACHED noon (sun 1.16, hemi 1.10). Over white sand at
3 m, which is where the chapter's own task sends you, the result was a flat whitening of
something already white: bloom 1.00 against 0.00 from a fixed camera moved the mean RGB
**+21.8 / +21.7 / +15.9 — the blue channel rose LEAST**, and 97.8% of the frame changed
without any of it reading as a light. At the drop-off the identical bloom is the whole
picture, so the effect was only ever legible where the chapter does not put you.

A bioluminescent bloom is legible because **the day goes away**. Sun, sky and ambient come
down by the same `kb` before the water puts its own cyan back, and the fog goes with them,
because the water you are IN is the source and lighting the surfaces while the volume between
them stays noon is half an effect. After, measured underwater on the reef at 2.25 m depth:
**R −1.96, G +8.68, B +4.28** — red falls, green and blue rise, green hardest, which is what
`palBloom` (0x63f0d8) actually is.

### THE TRIANGLE GATE DOES NOT PREDICT THE COST (job 2, and it was not done)

Ten of seventeen chapters are over the 130k gate, not the five the brief lists — the count
grew with real content across batches 1-3 (quay 132,423 → 201,503; kowloon 130,390 → 154,058).

**Frame time cannot show whether that matters.** rAF is pinned to the display, so all
seventeen read mean 16.67 ms and p95 16.8, with the 99.9th percentile inside a single frame
everywhere. Rendering each chapter forty times back to back with a `gl.finish()` — the only
way past vsync — puts **the worst chapter in the game at 1.6–1.9 ms of a 16.67 ms frame,
about eleven per cent**, stable over three runs.

**And the count does not predict the cost.** Manly is the second SMALLEST chapter and the most
expensive per triangle at 1.95 ms per 100k; Iceland and Quay are the second and third LARGEST
and the two cheapest, at 0.43 and 0.45 — a four-to-one spread, with the two cheapest per
triangle being two of the three largest. What predicts cost is the shadow pass and the
draw-call/material count: switching the shadow map off is worth 0.70 ms in Manly (42% of its
whole frame), 0.63 in Kowloon, 0.59 in the Pantanal.

So the reallocation was **deliberately not done**. Warping ten chapters' terrain and foliage
would risk the one thing this project guards hardest to buy a fraction of a millisecond on a
budget already 89% unspent, against a metric demonstrably not doing the work.
`qa/budget.js` runs both gates — the triangle one kept and reported exactly as asked, with
each chapter's measured cost beside it, and the FAILING one milliseconds — and `qa/BATCH4.md`
carries the named structural offender in every over-budget chapter as a work list, should the
gate ever be re-affirmed on evidence.

### THE RELEASE SWEEP — what the interplay fuzz found, and three of them were new

**The graze was deleting props in sixteen of seventeen chapters.** The drain that puts a
bitten prop back is the ONLY caller of `physUnhide`, and it lived inside `physPastoUpdate`,
which is gated on `biome.isActive('pasto')` for a good reason of its own. Measured: a Sydney
sandwich hidden at t = 526.7 s with `hiddenUntil` 560.7 was still hidden ninety seconds later,
and switching to Pasto un-hid it on frame zero. It takes TASK-CRITICAL props with it — holding
the Quay's chips and standing still for 5.63 s eats them, and both `qgFindChips` and the hint
arrow skip a hidden prop, so `seagull-chips` was quietly unwinnable. **A clock is not a place.**

**A relocated keepsake was rescued into mid-air, in 12 of 17 chapters, by up to 3.34 m.**
`homeY` is a SURFACE — `physRescue` places at `homeY + originY + 0.05` — and the border
crossing wrote the capybara's spawn, which is a DROP height with the animal's own radius and
clearance already in it. `physRescue` then slept the body on the frame it placed it, and a
sleeping body is skipped in the integrator, so the error froze there for ever.

Asking `terrainHeight` instead is wrong in the other direction: five spawns are on a
STRUCTURE — Venice's quay, the Pantanal's causeway, Antarctica's jetty, Göreme's plaza floor,
Palawan's jetty — and the terrain function answers for the ground *underneath* a deck.
**Only the solver knows what is under a point**, so the prop is dropped and LEARNS its home
from where it comes to rest (`physHomeLearn`). Hover: exactly 0.00 in 14 of 17, worst case
3.34 m → 1.74 m.

**And two of them were in this batch's own new code**, which is the argument for running the
fuzz after the fixes rather than before:

- **The idle pin answered any outside position write under `capyPIN_MAX` with `-ex/dt`.** A
  0.50 m nudge asked for **26.4 m/s** — ten times the walk cap — for one frame, and overshot
  0.16 m *past* its start, so a shove that should have moved the animal half a metre threw it
  backwards instead. The creep the pin exists to cancel is 0.02 m/s, so `capyPIN_VMAX` = 3.0
  leaves it untouched to the last decimal and makes a real nudge a pull rather than a catapult.
- **`frameShot` clamped `dist` to `sysCAM_MAX`, which is the ceiling on the PLAYER'S ZOOM.**
  Antarctica's helm plate is authored at 26 m and silently got 16 — the exact frame the shot
  was written to fix. A marquee is one authored composition held for two seconds, not an
  interaction: `sysSHOT_DIST_MAX` = 30.

### AND THE UI

- **Escape opened the journal on top of a live viewfinder.** K and P both exit photo mode and
  Escape did not, which made it the one key that puts a paused card over a HUD still
  pretending to be a lens. It backs out of the innermost thing first now.
- **The ledger and album buttons called `jrHide()` BEFORE `ledShow()`/`albShow()`**, and those
  capture `document.activeElement` to return focus to. Blurring first meant what got captured
  was BODY: a keyboard player who tabbed four times to the button, pressed Enter and then
  Escape was returned to nothing at all, with the journal shut behind them.
- **`inkSoft` was 3.77:1 against the 4.5 required** — and it is the BODY of the card in every
  chapter, at 9.7 to 12px. The card is opaque, so this was never a fog-chapter problem, it was
  the whole game. 0.62 → 0.70 alpha is 4.67:1. The coral accent is 2.31:1 and is doing two
  jobs — an outline, a hover, a rule, a filled button, where contrast against the paper is not
  the question, and small uppercase TEXT, where it is the only question — so it is split.
- **33 font-size floors below 11px raised to 11px.** At 390×844 there were 13 distinct strings
  between 7.9 and 10px. No horizontal overflow at any of the six sizes afterwards.
- **NPC speech bubbles ran off the screen.** The bubble is positioned by its CENTRE
  (`translate(-50%,-100%)`) and clamped to ±0.93 in NDC — a limit on the ANCHOR that says
  nothing about the box hanging off it. Six distinct bubbles in a fourteen-sample soak, the
  worst losing **132 px of a 399 px bubble at 1920×1080**: a third of a sentence, gone, in the
  one channel this game has for saying that somebody noticed you. Clamped in pixels now, width
  and height, measured once per text change rather than per frame.


## THE PAYOFF PASS, BATCH THREE — FRAMED (v26 — 26 Aug 2026)

**`game.frameShot(...)` — the fourth channel, which no chapter could ask for until now.**

v16 named four ways a moment can say *that landed*: framed, lit, audible, acknowledged. Three of
them were reachable from a biome file. **Framed was not.** `rig()` lets the live biome ask for a
distance, a pitch and a raise, and there has never been any way at all to ask for a **bearing** —
`camYawTarget` is a systems.js module-local with no setter. So the one silhouette a chapter exists
for was shown from wherever the player happened to be standing when the row ticked. Measured in
Sydney in v25: the Opera House podium payout fires with the rig jammed to 3.05 m at 68.6 degrees,
looking down at the sails from underneath them.

```js
game.frameShot({ yaw, dist, pitch, raise, hold, w })   // every field optional
game.framing()                                          // 0..1, for the harness
```

`yaw` is the bearing FROM the capybara TO the camera, the same convention `camYaw` and a spawn's
`yaw` already use, so `yaw: 0` puts the camera north of the animal looking south.

**IT IS A REQUEST WITH AN ENVELOPE, NOT A CUTSCENE**, and the three things it deliberately is not
are the whole design:

- **Not a cutscene.** The animal keeps walking, every key still works, nothing is paused.
- **Not a command.** Touch the mouse, Z, X or the right stick and it is gone inside a third of a
  second. `camHandT` is the same flag the self-steering rig yields to; this yields to it harder.
- **Not for the helm or a condor.** Those rigs own the lens outright and the weight is multiplied
  to nothing under them — the identical argument `rig()` already makes. Being on a condor beats
  being framed, and there is no argument to have.

**AGED ON `game.state.rawDt`, NEVER ON THE SCALED `dt`.** A marquee is the single moment most
likely to be under slow motion — `completeTask` pays `slowmo` out on exactly the `wow` rows a shot
belongs to — so a hold that promises 2.2 s of wall clock would become 3.5 s at `timeScale` 0.62.
This is the third timer in this codebase found on the wrong clock; see `sysSAVE_DEBOUNCE` in v23.

Cleared on `biome:enter` the way shake and time are, because a framing left running into a
teleport fights the arrival yaw the spawn sets two lines later.

Call it ONCE, at the payout. Calling it every frame restarts the envelope and it never leaves the
ease-in. Measured, `qa/b3-frame.js`, five assertions green: bearing lands 0.2° off the ask;
`dist: 14` at 26° pitch holds 12.58 m of horizontal reach, exact; the envelope peaks at 1.000 and
releases to 0.000; a `Z` keypress takes it 1.000 -> 0.011; a `switchTo` takes it to 0; and a
yaw-only shot moves the distance by 0.47 m.

### THE CHANNELS ARE AUDITED NOW — `qa/channels.mjs`

Three of the four are visible in the source, so they no longer need a browser. Per chapter: exactly
one `wow` row; a row in the event grade layer (*lit*); a `frameShot` call in the chapter's file
(*framed*); and **no `addCritter` without `bold`**, which v25 established is not a shy animal but a
dead registration — `appr` never leaves zero and the whole v23 calm inversion is absent for that
species.

Two things about how it is written, both paid for:

- **The grade test tokenises; it does not use a `\b` regex.** That is precisely the shape of bug
  `qa/verbs.mjs` shipped in v24 — the heredoc that wrote the file ate one backslash of each pair,
  `\b` became a literal backspace, and the audit passed clean against the exact clue it existed to
  catch. Reproduced once while writing this file, from the same cause.
- **The critter scan prints how many calls it examined.** "No bare `addCritter`" and "this scan
  found no `addCritter` at all" are otherwise the same green line. That is the mistake
  `qa/pf-mischief.js` was caught making at the top of this very batch.

**WHAT IT FOUND AT ITS FIRST RUN.** All 17 chapters have exactly one `wow` row and every
`addCritter` names `bold`. But **only 5 of 17 chapters register a critter at all** — quay, kyoto,
iceland, manly, goreme — so batch 1's calm inversion, the payoff of stillness as a verb, has
nothing to invert in twelve chapters. And **five chapters have no row in the event grade layer**:
sydney, pasto, quay (known from v25) and **kyoto and rio**, which are new.

### THE EIGHT CHAPTERS — what the five pillars found in 4-11

**THE SHAPE OF THE BATCH: seven of the eight marquee moments were broken, and not one
of them in a way any audit could raise.** A wrong bearing is not an error. A mono cue is
not an error. A grade row that does not exist is not an error. Marquee moments in this
project fail SILENTLY, and this is the fourth pass in a row to say so.

**THE FOUR WORST, in the order a player would feel them:**

1. **ICELAND'S AURORA WAS BEHIND THE CAMERA.** The curtains fan across −Z; the town, the
   pier, the sea and the rig's own rest yaw are all +Z, and the camera parks behind the
   animal looking +Z. Measured at full ignition: **0 of 984 curtain vertices in front of
   the eye**, best dot −0.078. Force-painting every curtain magenta at opacity 1 with
   `depthTest: false` still rendered nothing. The crane-up, the score swell, the fox, the
   locals and the toast all fired correctly around an empty star field. **Two comments
   directly above the line fix this aurora's ELEVATION, twice, and neither pass checked
   its azimuth.** Mirrored in z (the yaw sign flips with it, or every ribbon turns edge-on
   and disappears a second time): 330 of 336 in front, worst dot 0.13.
2. **KYOTO'S MARQUEE FIRED SIXTY-SEVEN TIMES AND RECORDED 0.00 s.** The Uji run's finish
   set `kyoRunT = -1` — the same value the clock idles at — and the mill sits inside the
   arming window, so the next frame re-armed it and the 13 m circle fired again on a run
   16 ms long. Thirty seconds of floating in the mill pond: 67 chimes, 67 splashes, 67
   toasts, 67 `record()` calls. **A one-shot payout needs a state that means ALREADY PAID,
   not the value it starts life in.** `-2` is that state and only leaving the pond clears
   it. And separately, the arming window reaches to 40 m short of the mill, so paddling in
   just above it completed the chapter's wow in 0.4 s — a run under five seconds now pays
   nothing at all.
3. **RIO'S CAPYBARA WAS 1.56 m UNDER THE WAVE IT WAS RIDING.** `localWater` was never set,
   so `capyWaterY` never called the `waterHeightAt` Rio publishes, and the animal floated
   at the flat sea level while the set rolled through it. **This is the same bug, in the
   same field, that batch 1 found in Iceland's hot spring.** Second time.
   **ANY CHAPTER THAT PUBLISHES `waterHeightAt` AND DOES NOT SET `localWater` IS BROKEN.**
4. **VENICE'S CAPYBARA SLID INTO THE LAGOON WHILE STANDING PERFECTLY STILL** — 2.76 m of
   +z in sixty seconds, `body.velocity.z` reading **exactly 0.000** the whole way, and
   `capy.loaf` at 1.0, so the chapter's answer to stillness was to loaf and slide into the
   water at once. The collision heightfield sampled every 4 m; the Molo edge is a THREE
   metre ramp. The triangle under the animal was a 6.6° slope four metres back from the
   real edge, while `slopeAt` answered 0.003 and nothing applied any anti-slide.
   **A SAMPLE SPACING HAS TO RESOLVE THE SHARPEST FEATURE IT CARRIES** — the other
   chapters get away with 5 m because their features are hills.

**AND THE ONE THAT COULD NOT BE FINISHED.** Kowloon's roof — the chapter that hands over
the CLIMB verb — could not be climbed to. The roof deck ran to x −9.50; the animal clings
at −9.16 and its west extent is about −9.51, so **roughly one centimetre of overhanging
slab** stopped the climb at 33.36 m against a deck at 34.2, and held it there for forty
seconds. The `bamboo-climb` record could never exceed 33.36. Pulling the edge to −9.70
takes the climb to 34.36 — but the animal then tops out in open air 0.65 m east of the
deck and cannot move west onto it, because the scaffold's colliders fill the bay to its
full height and there is no way to step off a lattice sideways. `symphony` is NOT blocked
(it tests height, and ticks from the cling at 73.7 s), but the hut, the pigeon loft, the
aerials and the chair on that roof are still unreachable. **Left open for batch 4, with
the numbers.** Lowering `hkSCAF.top` to 34.5 to start the shove earlier was tried and is
worse: the peak drops to 34.09.

### THE PATTERNS, which are worth more than the individual fixes

**A SURFACE LADDER MUST ASK THE CHAPTER WHERE THINGS ARE.** v25 found this in the Quay.
It is in **four** more chapters. Kyoto's `if (z < -40 && z > -140)` stood in for the torii
path, and Kyoto's zones do not lie along one axis: half the bamboo grove footfalled as
granite, and **the whole of Uji — the town, the mill, the granite spine — fell off the far
end of the band into the 0.82 SAND default, in a chapter with no beach in it**. The Drift
had ONE hard-coded rectangle for a chapter of thirty islands, twenty-nine of which
answered grass, while `driISLES` has recorded which are stone since the archipelago was
laid out. Cali covered two of its six surfaces. Venice's `venSurfacePitch` **declared `y`
and never read it**, so the Rialto's deck four metres above the canal footfalled as the
canal — in the chapter whose own task is "Take the Rialto at a run" — and its whole dry
city was one footstep four per cent wide. Kowloon's `y > 8` fallback called the steel neon
sign bamboo.

**THE LOUDEST CUE IN A CHAPTER IS THE MOST LIKELY TO BE MONO.** v25 found this in Pasto
and chapter 3. Every chapter in this batch had it. Kyoto: 24 mono cues around the payout
while all six stepping-stone notes forty metres away were positional — **the toy was
better mixed than the wow**. Iceland: 0 of 17. Sahara: 0 of 31. The Drift: 0 of 30, in a
biome whose whole subject is distance across empty air. Cali: 0 of 70 across a two-minute
ride. Venice: 1 of 27, and its marquee emitted **no sound at all**. Rio's payout cheer was
the only mono cue in the chapter — the five escalation cheers under it, at a fifth the
volume, all carried `at:`.

**A `wow` ROW IS PRAISED FROM FORTY METRES, NOT FIFTEEN.** `npcLOC_PRAISE_R` is the right
distance for stealing a spritz and the wrong one for the moment a chapter is for, which is
usually staged in the largest open space the chapter has. Measured: San Marco's nearest
local is 16.5 m from the centre and only **41% of the piazza** is inside the old radius, so
three locals carried `acqua-alta` lines they could not say from the natural place to stand
for it.

**AND TWO GAPS THAT ARE NOT FIXABLE FROM A BIOME FILE.** *Only five of seventeen chapters
register a critter at all* (quay, kyoto, iceland, manly, goreme), so batch 1's calm
inversion — the payoff of stillness as a verb — has nothing to invert in twelve chapters,
and Cali, Rio, Venice, Kowloon and Marrakech have no ground animal drawn to register.
*Room tone is keyed per BIOME, not per space*, so Venice's fifty metres of colonnade down
each side of the square, and a floor that turns into a hard reflective sheet, never move
the reverb.

**THE MISCHIEF NUMBERS ARE NOT STABLE BETWEEN RUNS.** The scatter is randomised at build,
so `ownedProps` varies run to run — Cali measured 3, then 0, then 2 across three runs of
the same build with no source change between them. **A single run cannot certify
adoption.** Take the best of three, or seed the scatter.

## THE PAYOFF PASS, BATCH TWO — THE LAWN (v24 — 25 Aug 2026)

**Finishing this game was a RECEIPT.** The last tick anywhere scheduled `showEnd`, which paused
everything and opened the ledger on top of whatever you were standing in — most likely Antarctica,
because chapter 17 is where a completionist ends up. The journey has a thread (the shelf) and a
spine (the souvenirs) and both were only ever shown to you on a card.

**Now: come home.** Return to Sydney with all seventeen chapters complete and the seventeen
souvenirs are laid out on the Botanic Gardens picnic lawn in a horseshoe. Walk into the mouth of
it and SIT DOWN, and that is the ending — the loaf, then one line, then the ledger. The last thing
the game asks of you is the first thing it taught you to do for its own sake.

    sysFIN_X, sysFIN_Z   30, 26     the picnic lawn (envZONES.picnic, 16 x 16 m, bed-free)
    sysFIN_R             2.6 m      horseshoe radius — A COMPOSITION NUMBER (see below)
    sysFIN_GAP           1.75 rad   the mouth, ~100 deg, aimed at the sydney spawn
    sysFIN_IN            1.8 m      "inside", for the closing test
    sysFIN_LOAF          0.6        ...and settled, not merely standing there
    sysFIN_HOLD          1.1 s      held, so that a pause is not an ending
    sysFIN_BEAT          2600 ms    between the line and the ledger

**`physStageKeep(place, x, z, restY)`** (props.js, published as `game.physics.stageKeep`).
`physSpawnKeep` is idempotent — which is what makes it safe to call on every restore and exactly
what stops a caller ARRANGING the seventeen: ask for one that exists and you get the one lying
wherever the last border crossing fanned it. This is the mover. It clears velocity, angular
velocity, force and torque, **sleeps the body**, and moves `homeX/Y/Z` — where `homeY` is a
SURFACE, not a body centre, because `physRescue` adds `originY` back on.

**FOUR THINGS THAT DECIDE THE SHAPE OF THE CODE:**

1. **`showEnd` is dead on a restored save.** `completeTask`'s `silent` early return sits ABOVE the
   `doneCount >= TASKS.length` branch, so a player who reloads with everything done never triggers
   anything. The lawn has its own trigger and does not reuse that branch.
2. **props.js relocates every loose keepsake to the spawn on EVERY chapter entry** and rewrites
   `homeX/Y/Z` doing it. Its `biome:enter` listener is registered before systems.js's, so staging
   from systems.js simply happens after the huddle and overrides it. Nothing in props.js had to
   change; only a mover had to be published.
3. **The ledger may not open on arrival.** `ledShow(true)` pauses the game and arms a
   tap-anywhere `location.reload()`. Opening it on arrival would replace the ending with its own
   receipt again and put a page-reload footgun under the player's first click.
4. **TWO DOORS IN, because Sydney is the one chapter that emits no `biome:enter`:** the
   `biome:enter` handler for a return, and the `else` branch of `startGame`'s `landed` test for a
   restored file that opens straight into Sydney.

**Staged every time, closed once.** Leaving Sydney clears the staging flag (props.js will huddle
them at the next spawn), so the lawn is laid on every return, for ever. `fin` in the save —
additive, `v` does not move — only suppresses the closing beat. Coming home must not stop working
because you have already been home.

**RADIUS IS A COMPOSITION NUMBER, NOT A GEOMETRY ONE, AND ONLY THE RENDERED PNG CAN TELL YOU.**
The first build used 4.2 m, which is geometrically fine and reads as LITTER: a keepsake is a 24 cm
box, and seventeen at 1.55 m spacing is seventeen specks scattered over eight metres of lawn. And
a closed ring puts one souvenir between the shoulder camera and the animal at every approach
angle — the capybara was behind a jar in its own ending. Both were found by looking at the
screenshot and neither would ever have shown up in a number.

**STILL OPEN:** the seventeen vary enormously in DRAWN scale though their physics shape is a
uniform 0.12 box — Rio's is a two-metre tram, Cappadocia's a waist-high jar, Sydney's a hat. At
2.6 m the big ones still crowd the frame. Sort the horseshoe by drawn size so the big ones sit at
the horns, or give the finale its own wider camera. The moment works; it is not yet as good as it
should be.


## THE FIRST HOUR, AND THE PILLARS OF 1-3 (v25 — 25 Aug 2026)

**A CLUE MAY NOT NAME A VERB THE PLAYER HAS NOT BEEN GIVEN.** Sydney's `cafe-table` read *"climb up
onto the tabletop"*. The action is a HOP, and CLIMB is a distinct verb this game does not hand over
until chapter 11 — so chapter one spent a chapter-eleven word on something that is not it, and the
player who remembers it goes looking for a wall. Before this pass **no clue in any of the 199 tasks
named Shift or Space at all**. Now both are first named in chapter 1. `qa/verbs.mjs` enforces it.

**AND RE-ORDERING WAS THE WRONG TOOL.** Sydney rows 1-12 are the gardens and forecourt (east),
13-19 the quay (west), and the café terrace is 39 m west of the spawn: pulling the hop row into the
first window sends the player across the chapter and back for one keystroke. **The order is good;
the words were wrong.** Note also that `opera-stage` looks like it needs a hop and does not — the
podium is a STAIR of 0.17 m treads, which environment.js calls "the largest step the capybara
reliably walks up". Nothing in Sydney's gardens half requires Space at all.

**A SURFACE LADDER MUST ASK THE CHAPTER WHERE THINGS ARE, NOT GUESS FROM ONE AXIS.**
`capySurfacePitch`'s quay branch was written as if z grew toward Manly. It does not — the Quay is
z 0..46, Manly is z = -556 — so `if (z < 16) return 1.22` swallowed the whole far end of the
chapter (beach, Corso, chip shop all sounding like hollow wharf timber) and the `0.82` sand line
below it was UNREACHABLE. It is now routed through `quay.inZone`, and **corso is tested before
manly because the corso rect is inside the manly rect** — measured, (118, -582) answers true to
both. A wrong footstep pitch is not an error and no audit will ever raise it; only a map will.

**A CRITTER WITH NO `bold` IS NOT A CRITTER THAT NEVER APPROACHES — IT IS A DEAD REGISTRATION.**
`quay.js` registered its only critter without the field; the registry defaults it to 0, `appr`
never leaves zero, and the whole v23 inversion is silently absent. Measured after giving the apron
gull `bold: 0.9`: sitting still takes `appr` 0 -> 0.900 and the flee radius **3.45 m -> 0.16 m**.
The calm field alone could only reach ~2.8. **Any `addCritter` call with no `bold` should be read
as a bug until proven deliberate.**

**THE LOUDEST THING IN A CHAPTER IS THE MOST LIKELY TO BE MONO.** Pasto's church bell played
`sfx('pop')` from nowhere while `pastoBellPos` sat on the line above; chapter 3's arrival at Manly
— the payout of its wow — fired horn and chime with no `at:` on a hull whose position was in scope.
In both cases the *quieter* cues nearby were already positional. Positional audio landed in v16 and
the marquees never got it.

### FOUR THINGS MEASURED IN THIS PASS AND DELIBERATELY LEFT OPEN

1. **The mischief economy is gated on `locals`, and chapters 1 and 2 register none.** `localOwnerOf`
   scans `locals`; the 20 m chain lives inside `localsStep`, which returns early on an empty list.
   Sydney gets produce/shoo only via a duplicate that `biomeLive()` hard-codes to sydney, so
   **Pasto's 13 edible props can start no reaction whatsoever.** The first two hours of the game are
   the two hours with the least reactive world.
2. **No chapter can frame its own marquee.** `camYawTarget`/`camDistTarget` are systems.js
   module-locals with no public setter, so "framed" is not a channel a biome can opt into. Measured
   in Sydney: walking onto the podium the camera collapses from 7.2 m / 45° to **3.05 m / 68.6°**,
   which is exactly where `opera-stage` pays out, and recovers a metre later.
3. **"Lit" is absent in chapters 1 and 2.** Twelve chapters have a row in the event grade layer;
   Pasto has none, so riding a condor off a live volcano changes no bloom, threshold or vignette.
4. **`api.vanRiding()` has zero readers repo-wide** — Sydney's one unique verb is a timer and a chime.

## THE ALBUM (v24 — 25 Aug 2026)

Photo mode has existed since v22 and **every picture it ever took left immediately**: `photoShoot`
rendered, read the canvas, hung the dataURL off a hidden `<a download>`, clicked it and dropped it
on the floor. The game has never been able to show you a photograph you took of it. The journal
remembers every place you stood, every record, every find and every souvenir — and not one of your
own pictures.

    sysALB_KEY   'capy3.album.v1'   a SEPARATE key from the journey save (see below)
    sysALB_W/H   288 x 180          the thumbnail; 16:10, legible at the 150 px the grid uses
    sysALB_Q     0.72               jpeg quality — ~6 KB of base64 per picture, measured
    sysALB_MAX   36                 oldest-out; ~0.5-0.7 MB of characters at worst

`albAll` / `albWrite` / `albAdd` / `albBest` are the store; `albEl` + `albBuild/Show/Hide/Refresh`
are the card; `game.hud.albumAudit()` reports without returning 36 dataURLs.

**FOUR CONSTRAINTS, THREE OF THEM THE STORE:**

1. **It may not ride in the journey save.** `saveWrite` puts the whole file through ONE `setItem`
   and its catch swallows the failure, so an album that grew too big would silently take the
   tasks, the records and the finds with it. Separate key, separate try/catch.
2. **A full-frame PNG is 1-3 MB** and base64 adds 1.37x. Two of those is the whole origin quota.
   What is kept is a 288x180 JPEG thumbnail — measured at ~6 KB each.
3. **Quota is handled, not hoped for**: evict the oldest and retry.
4. **The downscale must happen in the same JS turn as the render.** No `preserveDrawingBuffer`, so
   the drawing buffer is gone by the next turn — `drawImage` straight off the live canvas, one
   blit, no loading the full PNG into an `Image`.

**THE JOURNAL HAS NO PAGE MECHANISM** — it is one flat, source-ordered scrolling card, so an album
could not be "a page in the journal" without restructuring it. The album is the LEDGER'S SIBLING
instead: same veil, same title, same hint, its own overlay, reached by a button on the journal
exactly as the ledger is. The ledger is the only modal in the file that has already solved pause,
`inert`, focus return, Escape and the keyboard swallow, and a second half-solved one is how a card
ends up leaking keys into the game behind it. Its button is hidden until there is a first picture.

**THE TITLE POSTCARDS PREFER YOUR OWN PICTURE.** `buildPick` still builds and appends the authored
mark — it stays the ground the photograph sits on, and a chapter you have never photographed looks
exactly as it always did — then lays `albBest(biome)` over it. The menu of a game about going
places should show the places as YOU saw them.

**AND ONE MENTION OF THE CAMERA PER PLACE, AT MOST ONCE**, on the chapter ceremony, only when there
is no picture of that chapter yet. A SUGGESTION AND NEVER A TASK: it goes nowhere near the paper,
ticks nothing, blocks nothing and is counted nowhere. A photograph you were told to take is an
errand, and the album is worth having precisely because nobody asked.

**THE DECLARATION-ORDER TRAP, WHICH COST THE MOST TIME AND GENERALISES.** `sysALB_KEY` and
`albShots` are declared at the TOP of systems.js beside `sysSAVE_KEY`, not with the rest of the
album. The title card asks the album for a postcard **while it builds**, and the title card is
built earlier in the file than the album's block. Declared down there, both were in their temporal
dead zone at that moment, and the two ways of getting it wrong are the lesson:

- as **`const`**, the read threw a `ReferenceError` — swallowed by the caller's `try/catch`;
- changed to **`var`** it stopped throwing and got WORSE: the declaration hoists but the assignment
  does not, so the key was `undefined`, `localStorage.getItem(undefined)` answered null, and
  `albAll` **cached an empty album for the rest of the session**.

Both measured identically from outside — 0 of 17 tiles, no error anywhere — and `albumAudit()`
called later reported the album perfectly, because by then the assignments had run. **If a thing is
read during construction, declare it above the constructor, not beside its friends.**

One harness note that invalidated a test: **`playwright-cli close-all` then `open` is a fresh
browser context and localStorage does not survive it.** A run that writes a save and then re-opens
is measuring an empty store. Take the pictures and check the title card in ONE session.


## THE PAYOFF PASS, BATCH ONE (v23 — 25 Aug 2026)

Three jobs: a baseline audit, the mischief economy, and stillness as a verb.
The theme of the batch is that **two of the three biggest things it found were
systems that had been written, published and never once asked** — Iceland's
three water heights and props.js's own gust — and the third was a timer running
on the wrong clock.

---

### THE MISCHIEF ECONOMY — `npc.js`

`game.state.chaos` has driven the music and the calm field since the day it was
written and it has never driven one person. A chapter would let you walk off
with a stallholder's fruit, eat it in front of them and put the crate through a
window, and the reaction was one line from a pool of nine, from whoever happened
to be nearest, about nothing in particular.

Three systems, all chapter-neutral, all built out of what the chapters already
have — people with anchors, props with homes — so no biome file was touched and
all seventeen got them at once.

**OWNERSHIP.** A prop belongs to whoever stands nearest to **where it lives**
(`homeX`/`homeZ`), not to where it is now: a prop in the animal's mouth is
halfway across the square and the person whose it is, is not, so matching on
home keeps the owner for the whole of the theft, which is the only version of
this that is funny. Rob it (`capy:grab`) or knock it over at `npcOWN_BANG`
(6 m/s) and they walk out and get it: `dropOwned()` if you still have it,
`physRescue` plus a puff if you have put it down. `game.physics.rescue` and
`game.physics.typeOf` are new, additive exports.

**TWO HARD CEILINGS, AND THEY ARE THE WHOLE SAFETY ARGUMENT** (§THE CATCH-ALL
STATE). `npcOWN_OUT_T` 10 s walking out, `npcOWN_BACK_T` 14 s walking home, and
at the second the state is torn down unconditionally and the person is put on a
course for their own anchor at shuffle speed. There is no branch in which a
local can be left steering. Plus a LEASH: the prop may never be further than
`npcOWN_LEASH` (15 m) from the person's anchor or they stop, say so and go back —
which is what makes this safe to switch on in seventeen chapters at once, because
nobody can be led away. Measured against a target pinned three metres beyond the
chaser for ever — the shape that ran the waiter for forty seconds — it ends at
16 s having gone 10.5 m out, and the person walks back onto their own spot at
their authored height.

**PRODUCE.** `capy:graze` fires once per bite, carries the prop, and was heard by
capybara.js for a chew pose and by nobody else. Eat somebody's stock and you get
a line and a **shoo** — the flinch spring driven at the animal rather than at a
bang — and then they come for it. Sydney and Pasto are populated by the steering
cast and not by locals, so they get the same beat through `startle` plus the
existing `shoo` pool.

**CHAINS.** One reaction line turns every head within `npcCHAIN_R` and exactly
one of them answers. It cannot ripple: a second look uses `localLine` and not
`localReactLine`, so it does not arm a third.

**TWO NUMBERS WERE MEASURED RATHER THAN CHOSEN.**

- `npcOWN_R` is **11 m**. The first cut was 5.5 and at that radius five chapters
  of fifteen had nobody who owned anything. Distance from each prop's home to
  the nearest local who can walk, closest per chapter: Antarctica 1.8 · Iceland
  1.9 · Venice 2.1 · Göreme 2.8 · Marrakech 3.6 · Kyoto 3.8 · Manly 4.1 · Quay
  5.2 · Rio 5.8 · Kowloon 6.2 · **Cali 9.5** — and then nothing until 14.7.
  **Sơn Đoòng 9.4, the Pantanal 21.3, the Drift 24.0.**
- `npcCHAIN_R` is **20 m and not the 13 m chat radius**, because hearing somebody
  and talking to them are different distances. The pair-chat pass measured the
  closest pair in each chapter: at 13, Reykjavík (17.16), Manly (18.38) and the
  Drift (36.16) have no pair at all. At 20 the first two come in and the Drift
  does not, which is correct — its eight people are on separate floating islands
  and there is no honest radius at which one of them can hear another.

**AND THE STEP TEST HAD TO MOVE.** The blocked-step ray started 0.45 m out —
clear of the walker's own half-width and nothing else — and a Marrakech
stallholder chasing a hat 4.4 m away **moved 0.48 m in 18.5 seconds**, because
their own counter is the first solid thing in front of them and every step read
as blocked. Most of the people who own anything in this game stand behind the
thing their stock is on. It starts at 1.20 m now, so a counter is already behind
them by the time the ray begins and a wall three metres off still stops them.

**ADOPTION: 13 of the 15 locals chapters carry two of the three chains**
(`qa/pf-mischief.js`). The Drift and Sơn Đoòng do not, and the reason is
measured, not guessed: their people and their props are 21–24 m apart and the
Drift's closest pair of people is 36 m. Neither is fixable from `npc.js` — it is
a chapter-layout matter for the five-pillars passes.

---

### THE GUST BLOWS THINGS ACROSS A SQUARE NOW — `props.js`

v21 left this as the one item that did not land its intent, with the analysis of
why (a stiction cliff with no band between its sides, because a prop's terminal
velocity under drag IS the wind speed) and the two mechanisms needed. Both are
here.

**THE KICK** is a puff, not a force: an impulse a couple of times a second at a
scattered heading with a vertical component. It arrives all at once, which is
exactly what continuous drag cannot do, and between puffs ordinary friction
stops the prop dead.

**THE CAP** stops the kick becoming the cliff: drag may slow anything down at any
speed, and may not speed anything UP past `physGUST_VMAX` (2.2 m/s) along the
wind. Only the accelerating component along the wind axis is removed, so a prop
still gets turned by a gust and never launched, and a thrown frisbee is
untouched — measured, 9 m/s decays to 0.9 with or without.

**AND THE PUFF WAS MEASURED AGAINST THE CONTACT, NOT AGAINST THE WIND.** The
first cut was 1.6 m/s and produced 3 cm of net drift in 40 s: jiggle, not travel.
Single impulses on Manly's sand at friction 0.35, one 0.10 kg prop:

| impulse | distance |
|---|---|
| 0.6 m/s | 1 mm |
| 1.2 m/s | 2 mm |
| 2.0 m/s | 5 mm |
| 3.5 m/s | 6 mm |
| **3.5 m/s + a 1.4 m/s hop** | **0.53 m** |
| 6.0 m/s | 0.52 m |

**There is a cliff in the IMPULSE too, at about 3.5 m/s and only with a hop, and
above it one puff is worth half a metre and no more.** So the puff is 4.5 m/s
with a 1.5 m/s hop at full strength and the ramp is set so only a near-peak gust
clears the cliff — which is what turbulence actually is.

Measured over 40 s of each chapter's own weather, one dry light prop
(`qa/pf-gust2.js`):

| chapter | net | path |
|---|---|---|
| Manly, 0.10 kg sunglasses | **2.24 m** | 4.94 m |
| Marrakech, 0.35 kg hat | 0.61 m | 2.53 m |
| Antarctica, 0.42 kg mug | 0.67 m | 6.76 m |
| Kyoto · Venice · Göreme · Palawan | **0.00 m** | 0.00 m |

Bounded by `physGUST_ROAM`: 8 m from home, ever. Refused outright for anything
over `physGUST_LIGHT` (0.6 kg), anything held, owned, planted or frozen, and
**every souvenir** — seventeen of those are the spine of the journey and none of
them may blow into the sea.

**A MEASUREMENT TRAP, for whoever retunes this.** Measuring "how far did the
light props move" over a whole chapter is meaningless: a prop that drifts into
the surf is carried by `physFlowAt` and `physBUOY_DRIFT`, which are a current and
not the wind. Manly's dry props moved 1.8 m and its whole light population
"moved" 29 m in the same run. Filter on `!p.inWater`, and park one prop by hand.

---

### STILLNESS AS A VERB — THE LOAF (`capybara.js`, `systems.js`)

This game rewards being settled — the calm field, the soft wheek, the graze and
every critter's flee radius all read it — and the animal itself did not do one
thing differently for it.

```js
capy.loaf      // 0..1, published. The camera, the score and the critters read it.
capy.loafAsk   // a biome writes 1 per frame to ASK for it. Cleared every frame.
```

`capyRestT >= capyLOAF_T` (6.5 s) and it sits down: the model sinks 14.5 cm, the
nose comes up, the legs fold under — all on the **render** channel, so the
collider is untouched and sitting cannot change what you are standing on or what
task you are inside. `capyLOAF_LAM` in, six times faster out. **No new button**:
the control scheme is settled and this is what the animal does when you stop
asking it to do anything.

6.5 s is under `sysCALM_FULL` (8.0) on purpose, so the animal sits down a beat
BEFORE the world goes quiet around it and the sitting reads as the cause of the
calm rather than as a second symptom of it.

**ON `capyRestT` AND NEVER ON `capyStillT`.** The two lists are one entry apart
and the entry is `heldProp`. Reading `stillT` would collapse the loaf the moment
you pick anything up, which is exactly the bug the calm field and the graze each
shipped with. Measured: with a prop in its mouth, `stillT` 0.0, `restT` 20.7,
loaf arrives at 4.07 s.

**THREE READERS, which are the three channels a moment in this game has.**

1. **The lens** eases `sysLOAF_DOLLY` (1.15 m) back and `sysLOAF_PITCH` down —
   measured 7.17 → 7.79 m of reach — multiplied down by the helm, flight and
   skyward rigs so it never joins a fight over one number.
2. **The score** gets a wider LEAN rather than a bigger number. `musCalm`
   saturates at 1 and gets there a beat after the loaf, so adding to it would
   buy nothing; `sysLOAF_MUS` widens how far the three parameters may go.
3. **The animals turn round.**

**THE CRITTER REGISTRY INVERTS.** Past `sysCALM_INVERT` (0.72 of loaf) a BOLD
species stops fleeing and comes over.

```js
game.addCritter({ biome: 'kyoto', r: 9, bold: 1 })   // bold defaults to 0
c.appr   // 0..1 published, damped BOTH ways at sysCALM_APPR_L
c.near   // ...and this is now r * (1 - calm*k*CRIT) * (1 - appr)
```

**The fleeing half is one line and needs no biome file at all**: every consumer
of this registry is `if (d < c.near) spook()`, so an animal that has decided to
come over has a flee radius of nothing and simply stops being startled. The
approaching half IS the chapter's, because only the chapter knows where its
animal's feet may go — that is what `appr` is published for.

Adopted per species: **Kyoto's heron 1.0** (it wades off its perch, stops 3.2 m
short and faces you), **Manly's gulls 0.9**, **Göreme's cats 0.85** (they re-aim
their NEXT walk rather than being dragged — a cat is never seen to decide, only
to have arrived — and then flop), **Iceland's sheep 0.7**. Everything else
defaults to `bold: 0` and is untouched, so no chapter starts walking animals at
the player because a shared file changed under it.

Measured in Kyoto: flee radius 8.66 → 0.00, `appr` 0 → 1, and the loaf breaks
0.17 s after a key.

**AND THE LOAF FEEDS THE CALM FIELD**, `Math.max(restT/FULL, loaf)`. Everywhere
except water the two are the same thing; in water `capySwimming` zeroes `restT`,
correctly, and the animal can still be sat down because a chapter asked.

---

### THE HOT SPRING — A MARQUEE THAT WAS UNDER THE WATER

Iceland's soak is the loaf's marquee adoption, and certifying it found the
chapter's quietest and best-loved moment failing silently in the one channel a
metric never checks.

**ICELAND HAS THREE BODIES OF WATER AT TWO HEIGHTS AND NOTHING ASKED.**
`iceSurfaceY` has answered for all three since it was written; `capyWaterY` only
calls `waterHeightAt` when the biome declares `localWater`, and Iceland never
did. So the capybara floated to `waterLevel` — `iceSEA_Y`, −1.0 — inside a hot
pool drawn at `iceSPRING_Y`, −0.30.

**Measured mid-soak: the top of the drawn animal at −0.594 against a drawn
surface at −0.300. The whole capybara was 29 cm under the water for the entire
seven seconds,** reading as a faint dark smudge under a teal sheet.

One flag. After: model top **+0.128**, 43 cm proud, back and head clear, steam
coming off it. The swim threshold, the float target, the clamber ceiling and the
wake rings were all already written as offsets from *wherever the water is*, so
all four become correct for free; the sea and the lagoon are both −1.0 so nothing
outside the pool moves.

**AND IT SITS IN IT NOW.** `capySwimming` is on the `capyBusy` list — correctly,
or the animal would sit down mid-crossing in five chapters — so the loaf could
never arrive in the one place the game explicitly asks for it. `capy.loafAsk` is
the answer: asked per frame, cleared per frame, so a chapter that stops asking
cannot leave the animal sat down. The paddle folds away with the legs and the
model drop is cut to 30% in water, where buoyancy already owns the height.
Before the calm-field change: loaf 1.00, calm 0.00, so "the score goes soft" did
not happen in the one place it was written for. 0.99 now. Task still completes
at 5.52 s.

---

### THE SAVE RAN ON THE WRONG CLOCK

`sysSAVE_DEBOUNCE` promises 700 ms of REAL time and was aged on the SCALED `dt`,
so the ticks that arrive with the clock slowed down waited 1/scale times as long
— and those are every marquee (`sysWOW_SLOW` 0.55) and every chapter close (a
punch, which is a hitstop). **The biggest moment in a chapter had the latest
save, which is backwards.** Measured: a plain tick wrote at 718 ms, Kyoto's
marquee at 1046 ms at a live timeScale of 0.62. After: 713 and 719. main.js
states this rule for hitstop and slow-motion in its own doctrine block; this was
the one timer that had not taken it.

---

### WHAT WAS MEASURED, IN A BROWSER, AFTER THE BATCH

`qa/pf-soak.js` closes all seventeen chapters twice — once in ACT ORDER, which is
the only order in which "every declared act was the paper's header" is a fair
assertion (the header is *the lowest act with anything still open*, so closing an
act-3 row early legally hides an act-3 header for ever), and once in reverse.
199 tasks, 0 issues, 0 console errors both ways, all six act chapters showing all
their headers ascending, the way-on pseudo-row on the paper at the end of every
one.

`qa/pf-restore.js` saves and reloads at four hostile moments — mid-act,
mid-carrier, mid-dive, mid-ceremony — and asserts the hostile state was REACHED
before it asserts anything about the restore. Both of those assertions were
earned: `g.condor.summon()` once leaves the bird circling high and the mount
reads `input.actionPressed` (a rising edge), so a held `input.action` never
boards it; and Palawan's bay is dry 60 m south of the spawn and swimmable 60 m
north.

`qa/audit-tasks.mjs` 0/0 over 199. `qa/lines.mjs` 0/0 over 426 conditional lines.

`qa/audit-solid.js` on 14–17 and 1–3: nothing new — everything left is on the
cry-wolf list (instanced vegetation, the terrain shell, the sky dome) or is
Manly's flag, which is a 5.5 cm pole you are meant to pick up. The audit now
prints an identity that survives a reload (geometry type, world position,
triangle count): `o.id` is a global THREE counter and is different on the next
load, so a report that names a hit by id names nothing an hour later.

`qa/pf-npchealth.js` audits LOCALS for the first time — fifteen chapters' entire
population, which `qa/npchealth.js` has never looked at — and does it live-gated.
0 drift, 0 body desync, 0 off-ground. The cry-wolf in the old audit is confirmed
and named: the steering records carry their chapter in their **id** and nowhere
else (`npc<n>`/`ibis<n>` for Sydney, `pasto-<kind><n>` for Pasto), and getting
that wrong reports all 38 of Sydney "stuck, moved 0.0 m" from anywhere else.

`qa/pf-parent.js` checks an invariant nothing had: `physUpdate` skips any prop
whose mesh is not parented to the scene, which is written for "an NPC picked it
up and is driving it" and would silently switch off buoyancy, aero, gust, spill
and tip for anything parented elsewhere for any other reason. 0 of 224 props
across 17 chapters.

**AND `qa/fuzz.js` WAS RUNNING AGAINST A TITLE SCREEN.** It assumed something
else had already booted the page and pressed past the card, and when nothing
had, all seventeen chapters came back identical — `maxSpeed` 0, the same end
position to the decimetre, no errors — which reads as seventeen clean passes.
A suite that cannot fail is worse than no suite. It boots and starts the game
itself now, and it also asserts the three things this batch added: the loaf is
finite and in range and is DOWN after eight seconds of random keys, no local is
steering past `npcOWN_OUT_T + npcOWN_BACK_T`, and no light prop is further than
`physGUST_ROAM` from its home.


## THE DELIGHT PASS, WAVES THREE AND FOUR (v22 — 24 Aug 2026)

Six items over nine files. **If wave one was about code that had been written and
never wired, this one is about numbers that had been written and never read** — a
mayhem input with nothing on the other end of it, seventeen weather names with zero
call sites, a hundred and ten people welded to a coordinate, six hundred and fourteen
sound effects with no room to be in, and a hundred and fourteen thousand lines about a
capybara in which nothing could eat anything.

### WAVE THREE — the systems

#### 1. THE CALM (systems.js owns; capybara.js feeds it; five chapters read it)

`game.state.chaos` has been the game's mayhem input since v2 and there has never been
anything on the other side of it. There is now, and **it is not the negation of chaos**:

- **chaos is a SPIKE.** It jumps on an event and decays. Resting value zero.
- **calm is a HOLD.** It accrues while nothing happens and collapses the instant
  something does. Resting value zero as well, because a player who is playing is
  never still.

A single signed number could not hold both shapes, which is why there are two.

**`game.calm(x, z)`** answers 0..1 and — this is the whole geometry of it — **blends
toward 1 with distance**, because the only disturbance in any of these worlds is the
capybara. A heron on the far bank does not care that you are sprinting. With no
argument it is the global figure.

**`game.addCritter({ biome, r, k })`** is a registry, not seventeen calls to
`game.calm()`, and the reason is that this is a feel knob which will be retuned: a
curve that lives in seventeen biome files gets retuned in fourteen of them. It writes
`rec.near` once a frame for the LIVE chapter only. Adopted in five places, each of
which was already a literal number in a distance test — Göreme's cats (2.5 m),
Reykjavík's sheep (6.48, and it was the literal `42` in a squared test), Manly's gulls
(7), Kyoto's heron (9) and the Quay's apron gulls (3.5).

**`musCalm`**, beside `musIntensity`, on the same three centralised writers in the
opposite direction: the pad comes UP, the filter closes DOWN, the bass thins. The
filter and bass terms are PROPORTIONAL rather than absolute — the palettes run from
cut 470 to cut 1320 and a flat 500 Hz subtraction takes the Drift below its own
fundamental.

**AND capybara.js NEEDED A SECOND TIMER, WHICH IS THE ONE THING HERE THAT MEASURED
WRONG.** `capyStillT` is zeroed by `capy.heldProp` — correctly, because an empty mouth
is part of what the soft wheek's register MEANS. Reading it for the calm meant the
whole field collapsed the moment the animal picked anything up, and it made THE GRAZE
(below) impossible in every circumstance: its precondition is standing still holding
food. So `capyRestT` is the same list minus that one entry, `capyStillT` keeps its
original meaning to the letter, and both are published. **Two names because they are
two questions.**

#### 2. THE LOCALS LIVE (npc.js, plus four chapter files)

- **The shuffle.** A hundred and ten locals had never moved a metre. The note in npc.js
  ruling out walking is still right — a local has no nav mesh — but "may not cross a
  square" and "may not shift their feet" are not the same sentence. A local now takes a
  step every fifteen seconds or so, **always to a point within 0.55 m of the ANCHOR THE
  CHAPTER CHOSE** and never from where they have got to, which is what stops a random
  walk from wandering off one step at a time. It moves the group, the speech anchor and
  the collider. No legs are drawn — a local's legs are a merged mesh — so what sells it
  is a second bob at step frequency and a lean into the move. Gated on `r.fig` for the
  same reason the umbrella is: a chapter that handed over its own Group may have merged
  that person into a jetty.
- **`fam`, the positive twin of `wary`.** Same shape, same arithmetic, pointed the other
  way. It rises while you are inside somebody's circle and NOTHING IS HAPPENING — which
  is THE CALM, read once for the whole population — and it buys attention and nothing
  else: a warmer pool, a shorter cooldown, one line the first time it crosses. **And it
  is what finally answers the soft wheek**, which wave one built and nothing in the game
  listened to: a soft call at somebody you have been standing beside is worth
  `npcFAM_WHEEK`, a loud one is worth nothing, and a familiar person answers a soft call
  from the `fam` pool instead of the wheek pool.
- **Two locals talking to each other**, which `chatStep` has done in two chapters of
  seventeen since it was written, because it is written against the Sydney roster's
  shape. `localsChat` is its twin against the locals' shape — a separate function, not a
  generalisation, because a Sydney human is a state machine with a nav target and a
  local is a fixed point with a bubble anchor, and one function reading both is four
  `||`s in a hot loop to avoid twenty lines twice.
- **`after:` / `before:` lines in the four chapters that had none.** Circular Quay,
  Cappadocia, Manly and the Pantanal used the conditional-line system in exactly nought
  places, so the deckhand who unlocks the wheel went on telling you the wheel was
  unlocked while you stood at Manly having driven the boat there yourself. 426
  conditional lines now, across all fifteen chapters that carry a cast.

#### 3. THE SOUND OF SOMEWHERE (systems.js)

- **One `ConvolverNode` on a wet send off the sfx bus** fixes all 614 call sites at once
  and costs one node. `musIR` — the impulse-response generator that has been in this
  file since the score was written — had one caller and now has two. Four things are
  deliberate: **it is a send, not an insert** (the dry path is untouched to the sample,
  so `wet: 0` is bit-identical to before); **the music does not go through it** (the
  score has its own convolver, and a pad through two reverbs in series is mud); **nor
  does the UI** (a menu tick is not standing anywhere, and it is the one sound allowed
  to play while the world is not); and **the IR is regenerated on a chapter change, not
  cached** — seventeen stereo buffers of up to 5.5 s is thirteen megabytes to avoid one
  JS loop that runs behind the white hold of `biomeFadeTo`.
  `sysROOMS` is one row per chapter. Sơn Đoòng is the whole reason it exists: 5.5 s of
  tail at a send twice the next loudest room in the game, in a chapter whose entire
  argument is the size of the space you are standing in, which until now sounded exactly
  like Manly (1.0 s, and the driest room in the game).
- **The ambience knows where it is.** The 440-line ladder makes 96 `sfx()` calls and
  passed `at:` on none of them, so every gull, bell, horn and bark that says which
  country you are in arrived dead centre at the animal's own nose. They go through
  `sysAmb()` now, which puts each event on a ring 14–34 m out at a random bearing.
  **NO LEVEL CHANGES, and that is the design**: the ring is inside `sysAMB_NEAR` (40),
  so `audioPlace` answers a gain of exactly 1 and the ninety-six hand-tuned volumes are
  untouched. What changes is the pan. The two rungs that already knew where their sound
  was — the bell on the yellow buoy at the turn, the other ferry's engine — pass `at`
  and go straight through.

### WAVE FOUR — the keepsakes

#### 4. A SOUVENIR YOU CAN PICK UP (props.js; systems.js drops it)

Seventeen souvenirs, drawn on a shelf since v18, crossing every border as an ICON. Each
is now also a real object, built from the same shapes and **the same PALETTE keys** as
its own icon, so the thing in the journal and the thing in the grass are recognisably
one object. `physKEEPS` is a table of boxes and cylinders and one shared builder rather
than seventeen builder functions, because seventeen hand-written functions to make
seventeen objects out of three boxes each is how a table goes stale.

**TWO THINGS MAKE A KEEPSAKE DIFFERENT FROM EVERY OTHER PROP AND BOTH ARE LOAD-BEARING:**

1. **It has no biome.** `physOnBiomeEnter` confiscates a held prop at the border for a
   good reason — its body leaves the world with its home biome, so a prop released
   abroad is dynamic, unsimulated and invisible. A keepsake goes in through
   `physSceneAddLoose` / `physWorldAddLoose` (the hatch the particle pools and
   weather.js already use) and carries `biome: ''`, which **three of the four biome
   gates in props.js already read as "everywhere"**; the fourth was changed. It is the
   only object in the game that genuinely travels.
2. **It is always solo.** An `InstancedMesh` is created under the live capture tag and
   is owned by whichever chapter was up when the first one spawned — exactly the bug the
   per-biome instance key was invented to fix, and unfixable for an object whose whole
   point is having no chapter. It draws itself.

On a border crossing the loose ones are moved to the arrival spawn — every chapter is
authored in the same coordinate space, so a pine cone left on the sand at Manly is, in
Venice, thirty metres out in the Bacino — **and `homeX/Y/Z` is moved with them**, or
`physRescue` returns a keepsake that went over an edge in Venice to a point in Sydney's
gardens. The fan is tight (0.7 + 0.12n, reaching 2.7 m and not 4.5): a spawn point is
only guaranteed standable AT the spawn point, and four metres off the Drift's shelf is
open air.

#### 5. THE POSTCARD (systems.js)

Photo mode, and **every part of it already existed**: `bare` (v12) takes the furniture
off the window and already knows which things are the game talking and must stay; the
composite pass (v13) is the lens; and `weather.label()` has had seventeen authored
names since the micro-environment shipped — 'Harbour Midday', 'Violet Nowhere', 'Neon
Rain', 'Inside the Mountain' — and **zero call sites in 114k lines**. K puts a 3:2
letterbox, four corner ticks and a caption on the frame; the caption is the chapter's
own name, the sky's own name and the journey's own clock. Enter takes the picture, and
it is a PNG the player keeps — the only thing in this game that leaves it.

**THE RENDER AND THE READ ARE IN ONE JS TURN** and that is not a style choice: the
renderer has no `preserveDrawingBuffer`, so `toDataURL` called from a key handler reads
back a blank canvas about as often as it does not. The frame is drawn again inside
`photoShoot` and read on the very next line. The grade lean is small on purpose
(saturation +0.06, contrast +0.05, vignette +0.10) and is applied AFTER the events, so a
marquee moment still out-blooms the camera.

#### 6. THE GRAZE (props.js; capybara.js animates it)

`nibble`, `graze` and `forage` appeared nowhere in 114k lines about a capybara. The verb
is built out of the two most conservative decisions available:

- **No new button.** You graze by holding something edible and standing still — the same
  settle THE CALM is built on — so eating happens to a player who has stopped, which is
  what eating is. Anybody mid-mischief never sees it.
- **Nothing is ever destroyed.** The last bite `physHide`s the prop on the restock path
  this file has had since the market stalls, so a sandwich you ate is a sandwich that is
  back on the picnic rug 34 s later and no task can be starved of the object it needs.
  **There is no state this verb can reach that the world does not repair by itself**,
  and that is the whole safety argument.

Four visible bites, not a smooth shrink: a thing that scales down continuously reads as
a bug and a thing that goes in steps reads as being eaten. `mesh.scale` has **one
writer** — the pop and the graze are two independent reasons for a held prop not to be
its own size, and two `setScalar` calls a few lines apart is the trap this codebase has
already paid for once.

### The two things that measured wrong, so nobody re-derives them

1. **`npcLOC_CHAT_R` WAS 4.6 m AND AT 4.6 m THE FEATURE DOES NOT EXIST.** A local is a
   fixed point, so unlike the Sydney crowd — which walks and therefore forms pairs on
   its own — this radius is the entire question of whether anybody in fifteen chapters
   ever speaks to anybody. Measured, closest pair per chapter:

   | under 4.6 m | under 13 m | never |
   |---|---|---|
   | Cali 4.20 · Marrakech 2.25 · the Pantanal 2.83 | twelve of fifteen | Reykjavík 17.16 · Manly 18.38 · the Drift 36.16 |

   Thirteen metres is a word across a square rather than a confidence, and the pool was
   already written for that: every line in it is a greeting you can call. The three it
   never fires in are the right three — Reykjavík's cast is at separate stalls down a
   street, Manly's is over 120 m of beach, and the Drift is a chapter about being the
   only one there.

2. **THE TRIANGLE BUDGET IS ALREADY EXCEEDED AND THIS WAVE IS NOT WHY.** Measured 24 Aug
   2026, one scene render, shadow map off: the Pantanal 207,072, the Drift 201,886,
   Antarctica 179,788, Kowloon 130,390 and Circular Quay 132,423 are all over the 130k
   line in the budget below, before a single keepsake exists. Seventeen keepsakes out at
   once add **1,612 to 2,388 triangles** (under 1.2%) and 16–22 draw calls. This is a
   standing item for a later pass, not a thing to fix by deleting a souvenir.

### What was measured, in a browser, after the wave

Bundle 5,499 top-level declarations, no collisions. `qa/audit-tasks.mjs` 0 blockers /
0 warnings over 199 tasks. **New: `qa/lines.mjs`** — 426 conditional lines over fifteen
chapters, every id a real task, every id in its own chapter, 0 blockers / 0 warnings;
it also fails outright if any of the four chapters this wave opened up goes back to
having none. `qa/fuzz.js` **17/17 clean** — no NaN, no void falls, no solver saves, no
errors, `state.lastError` null in all seventeen.

- **Frame time, worst case (all seventeen keepsakes out in every chapter): 16.6–17.0 ms
  median, 18.4–19.5 ms p95, in all seventeen.**
- **Draw calls** (one scene render, shadow map off) 64–129 base → 80–147 with all
  seventeen out, against a budget of 220.
- **Cannon bodies** 48–198 base → 65–215. Sơn Đoòng, Kyoto and Venice are the three over
  200 and all three were near it already.
- **The calm**: half at ~8 s of stillness, nine tenths at ~24 s, 0.99 at 38 s — and one
  step takes it from 0.96 to 0.005 in under a second. Göreme's cats measured 2.5 m base
  → 1.01 m at calm 0.96.
- **The room**: all seventeen load their own IR on the border (Manly 1.0 s → Sơn Đoòng
  5.5 s) and cross to their own send level. Cave 0.365 of a 0.42 target 3.2 s after
  arrival, still crossing.
- **The locals**: all ten in Cappadocia had left their anchor within 20 s, maximum drift
  0.52 m against a 0.55 m cap. Conversations fired in Marrakech, Venice and Sơn Đoòng
  within 22 s of arriving. `fam` 0 → 0.494 in 26 s of standing beside somebody, and the
  line that came out was "Hello, you." from the `fam` pool.
- **The keepsakes**: all seventeen build (36–176 triangles each), rest on their own
  ground, and survive two border crossings still visible, still in the world, none
  fallen through, arriving 4.5–7.5 m from the animal.
- **The graze**: four bites at ~1 s, scale 1 → 0.81 → 0.62 → 0.43, hidden, mouth
  emptied, restocking in 29 s.
- **The postcard**: K on → lens 0.96, `bare` on, caption "SYDNEY · HARBOUR MIDDAY ·
  0:04"; Enter → a 1.4 MB PNG named `capybara-sydney-1.png`; K off → `bare` restored to
  what it was before, not to false.

## THE DELIGHT PASS, WAVES ONE AND TWO (v21 — 24 Aug 2026)

Nine items over four files. **The theme of the wave is that most of it was already
written.** Three systems had been built, commented and left unwired; one verb had
its constants and its spec in a comment and no implementation; and one four-channel
API the props already used had never once been called by the animal itself.

### What is new, by file

**shared.js** — `grain(m, { wetOnly: true })`. The wet darken/sheen term with none
of the world-space noise and none of the sparkle, and it forces `sparkle = 0` so the
invariant holds whatever a call site passes. It exists because the grain's scale is
authored for a road and on a half-metre prop it reads as dirt, while the up-facing
gate (`vGrainN.y²`) already does the right thing on a bin lid for free.

**props.js**
- **The gust reaches the solver.** `physWindNow()` sums `weather.gust()` on top of
  the biome's `wind()`, with the floor taken off the SPEED and the heading carried
  through — subtracting a constant vector turns a wind shift into a wind reversal.
  **This is not the thing CONTRACT §"`wind()` IS NOT THE GUST" forbids:** that rule
  protects `capyWindAt()`, the reference-frame channel feeding `platVX/platVZ`, and
  that function is untouched and still asks the biome alone.
- `physFlowAt()` **is called now**, for the first time since it was written. Flow
  enters as a drag toward the water, never a velocity write, so it composes with the
  linear drag and the righting torque; a prop settles at 0.60 of the current. The old
  `physBUOY_DRIFT` sine survives as the still-water fallback.
- **The particle pools are biome-neutral.** `physDust`, `physFoam`, `physPuffMesh`
  and the shard meshes AND their bodies now go in through `physSceneAddLoose` /
  `physWorldAddLoose` (raw prototype calls, the same escape hatch weather.js uses),
  and the `if (sydneyLive)` gate on the updates is gone. Landing dust, sprint scuffs,
  spill dust and the three foam rings on water entry drew NOTHING in fifteen chapters
  for the life of the game; the splash sound has been playing over an empty screen.
  Dust colour became `physDUST_BIOME` → `physDUST_COLOR` (soil/sand/snow/spray) on
  the pool's OWN cloned material — `mat()` hands back a shared instance and writing
  to it recolours every soil-coloured mesh in the game.
- **`capy:wheek` moves things.** Radial nudge over the live biome's props, `1/mass`,
  capped as a velocity change, applied at the centre of mass so it can never topple
  anything, with `physSquashHit` so each prop flinches in its own material's give.
  One prop answers with a `prop:impact` voice — only one, because that event feeds
  `chaos`, which drives the music and the crowd, and the wheek is the most-pressed
  button in the game.

**capybara.js**
- The hop gate and `capyTryGrabStart` read the buffer. `capyBUF_WINDOW = capyCOYOTE`
  by construction, so forgiveness is symmetric in both directions.
- Water entry, the hard landing and the dig scoop call `game.punch()` at their
  existing magnitudes. A refused hop (blown) and a grab whiff now have a body.
- **The shake-dry is implemented** — `capySHAKE_DUR`/`capySHAKE_DELAY`/`capyWET_FAST`
  were dead constants under a comment asserting the system worked. Wet 0.998 → 0.017
  in 1.6 s where the flat decay took 8.
- **Gaze**, added to the idle look rather than replacing it. **A held prop resolves to
  a FIXED downward glance and never to its live position:** the prop is pinned to the
  mouth anchor, the anchor is derived from `head.rotation`, and aiming the head at it
  is a control loop feeding its own output back in — the gaze walks off centre and
  takes the prop with it.
- The idle roster is a weighted table conditioned on `mood().cold`, wetness, held prop
  and stamina, and **`!capy.heldProp` is gone from `idleOk`** — it disabled all
  personality during the activity the game is mostly about.
- `capyWheekPayload.soft` is true when the animal has been settled `capyWHEEK_CALM_T`
  (1.2 s). No new button, no fire-on-release, no latency: **you settle before you call
  and the call comes out gentle**, so a player mid-mischief always gets the loud one
  and every existing listener's content is preserved.

**systems.js**
- The four `*Pend` flags are timers and `jumpBuf`/`actionBuf`/`clearJumpBuf()`/
  `clearActionBuf()` are published. Aged on `rawDt`, never the scaled `dt`, so a
  buffered press cannot outlive its window in slow motion. Cleared on `blur`.
- **`musSwell(1)` in `chapterCeremony`.** The scarcity law in §THE LIFT governs TASKS;
  a chapter close is a different and rarer event — seventeen in the game. And the
  ceremony's `confettiBurst(..., 34)` ATE ITS OWN FRONT (`sysCONF_MAX` is 26 and
  `confHead` wraps), so the biggest moment in a chapter looked thinner than a `wow`'s
  24: it is two bursts of 26, `sysCONF_REFILL` apart. New `showDone()` card, so the
  chapter close is no longer the same paper as "you have arrived".
- **`sysWAY_ID = '__way'`** — a pseudo-row, not in TASKS, the tally, the save or the
  ledger. On `chapComplete` the arrow, the beacon and the metres come back pointed at
  the exit, and every one of the seventeen `sysMAP_WORLDS` rows carries a `way` mark.
  Navigation used to switch off at the exact moment the exit started to mattering.
- **The picker cannot wipe a save by mis-click.** A tile is restore-and-travel; three
  bare `startGame()` calls (canvas press, both touch buttons) were each a silent
  `saveClear()` and now go to `startResume()`. Wiping is an explicit labelled path
  that names the cost and defaults focus to **keep it**.
- The crossing has a `musCross(dir)` built from the live chord, the destination's
  postcard in the white, and `sysFADE_CARD_LAG` so the place card is not rising
  underneath an opaque sheet.

### AND THE ONE THAT DID NOT LAND ITS INTENT — read this before retuning it

**A gust cannot blow a prop across a square with drag alone, and the numbers say so.**
Swept in Manly (the windiest `wxMOOD` row) at held raw gusts of 2/4/6/8/10/14 m/s
against ground-to-prop friction 0.35, every light prop shows a stiction CLIFF with no
band between its sides:

| prop | raw 6 m/s | raw 8 m/s |
|---|---|---|
| sunglasses 0.10 kg | 0.002 m in 5 s | **9.86 m** |
| thong 0.12 kg | 0.000 m | **4.55 m** |

Under the cliff nothing stirs. Over it the prop accelerates toward the wind — a
prop's terminal velocity under drag IS the wind speed — and sails four to ten metres,
which is not charm, it is props migrating away from where the player set them down,
and tasks read prop positions. So `physGUST_K` stays at 1.2, which keeps the effective
wind (4.8 m/s at Manly's absolute peak) far under the cliff, and **what the gust buys
is what a prop already moving or in the air feels**: a thrown frisbee drifting
downwind, not a hat leaving the beach. Measured after tuning: 3 mm of drift in 10 s in
Manly, 0 everywhere else.

What DID have to change is the wake test. It was `> 16` (4 m/s of effective wind) and
the effective wind NEVER REACHES IT — measured over 20 s in Manly the top of the range
was 3.7 and a settled prop was asleep for all 1200 frames, so the drag was not being
applied to anything at rest at all. `physGUST_WAKE = 2.0`.

**Doing it properly needs a second mechanism this does not have:** a turbulent KICK to
break stiction and a cap on the speed the prop may leave with, so it skitters and
stops instead of reaching wind speed. That is a design task, not a tuning one.

### What was measured, in a browser, after the wave

Bundle 5461 top-level declarations, no collisions. `qa/audit-tasks.mjs` 0 blockers /
0 warnings over 199 tasks. Console 0 errors, 0 warnings across a played session and a
17-biome sweep; `state.lastError` null in all seventeen. Pools visible in all
seventeen (dust Tetrahedron×30, foam Cylinder×8, puff Sphere×24 — **identify them by
geometry, not by `count`: several biome-owned meshes also have a count of 8** and a
naive match reads a hidden Sydney mesh and reports a bug that is not there). Wheek on
a settled prop: control 0, loud 1.0–1.4 mm, soft 0.3–0.4 mm. Kyoto completed: arrow
opacity 1 after the last tick, paper reading "the way on: the bridge at Uji · 79 m",
done card "11 OF 11 · 0:06 · 1 OF 17 PLACES", souvenir card following. Save: 145 bytes
survived a reload and a tile click, and progress restored.

## RENDER TRANSFORMS — PREDICT, THEN CORRECT (v6)

Reading `body.interpolatedPosition` straight into a mesh is correct at a steady frame rate and
wrong at a real one: cannon's alpha is `accumulator / step` computed AFTER the substeps, so with
variable frame times some frames take two steps and some take none and the alpha is not
monotonic. The rendered transform then walks forward, forward, back across up to a whole step.

Every module that renders a fast-moving body must therefore:

1. advance its own render position by `velocity * dt` (exact at constant velocity, so no lag);
2. damp that toward the interpolated transform (this is what eats the sawtooth);
3. snap when the error exceeds a teleport threshold.

See `capyRENDER_LAMBDA` in capybara.js and `condorRender()` in condor.js.

## Update order (v6)

`env → pasto → quay → kyoto → cali → rio → iceland → sahara → drift → venice → kowloon → palawan → goreme → manly → pantanal → cave → antarctic → weather → physics/props → capy → condor → npcs → systems`

An updater that throws is NOT dropped on its first exception. main.js gives each module three
strikes (reset by any good frame) and logs which module and which strike; only a module failing
every frame is removed. A silent permanent drop of capybara.js is indistinguishable, to a
player, from the game ending.

## THE PICTURE (v13 — the presentation pass, 20 Aug 2026)

Everything above this line is about what the world is MADE of. This section is
about what happens to it between the Lambert shader and the player's eye, which
until now was nothing at all. Four things were added; none of them changes a
single mesh, a single colour in `PALETTE` or a single line of the aesthetic law.

### 1. The composite pass — `game.post` (main.js owns)

`renderer.render(scene, camera)` is no longer called by anybody except the post
chain. `game.tick()` calls `game.post.render()`, which:

1. renders the scene into a **multisampled half-float target** (`samples: 4`, so
   the antialiasing this art style lives on is exactly what it was, and values
   over white survive to be seen rather than being clamped on the way out);
2. runs a **bright pass** at quarter resolution with a soft knee;
3. runs **two separable blur pairs**, also at quarter resolution;
4. **grades and composites** to the canvas — bloom, an S-curve contrast applied
   in DISPLAY space, saturation, a per-biome multiply, a vignette, and a
   one-255th dither that is what stops the sky domes banding.

If WebGL2, half-float or a multisampled target is unavailable, `post.enabled`
goes false and the game renders exactly the way it did before. Never assume it
is on.

`game.post.params` is a flat object of numbers. **systems.js is the only module
that writes it**, from `sysDressFrame()`, once a frame, at the end of the
atmosphere section. A biome must not reach into it.

### 2. The grade — `sysGRADES` (systems.js owns)

One row per chapter. `bloom / threshold / knee / radius / contrast / saturation /
vignette / vigStart / tint`. It cross-fades on a biome change at the fog's own
rate, and `sysDressPrime()` slams it on the first frame for the same reason
`atmosPrime()` exists.

**Three more since v40, in `sysLENS` rather than in the literal above** — `wide`
(how much of the row's bloom goes out into the second octave) and `splitW` /
`splitC` (how warm the highlights and how cool the shadows). They cross-fade on
the same keys. `sysSHOULDER` and `sysVIG_TONE` are lens constants and are
deliberately NOT per-chapter. See **THE LENS PASS (v40)** above.

**The threshold is the whole trick.** In a night chapter nothing on the ground
clears 0.4, so a low threshold blooms the lights and only the lights. In a noon
chapter the sunlit whites sit just over 1.0, so a threshold just under it catches
glare and nothing else. **A chapter built out of white stone must have a HIGH
threshold** — Venice at 0.94 bloomed the Piazzetta itself into one sheet of paper.

Events add on top of the damped row rather than being baked into it: the aurora,
the Symphony of Lights, the lantern on the Shelf, the bloom in Palawan, the sun
clearing the ridge over Goreme, the mirador taking Cali's sun down, the dusk and
the storm over the Erg, and the tide in Venice.

### 3. The sky dome (systems.js owns, biome-neutral)

Every chapter except Sydney, the Drift and Cappadocia — which carry their own —
now gets a shared gradient dome. It is a **skybox, not a piece of world**: it
rides on the camera, it neither reads nor writes depth, `renderOrder = -20`, and
it is drawn before everything. That is why one radius is correct for a
four-hundred-metre far plane and a two-thousand-two-hundred-metre one.

**The horizon colour is not in the table.** It is whatever `scene.background`
finished the frame as, so every event that already moves the atmosphere moves the
sky with it and the fog and the sky can never drift out of step. Only the ZENITH
is a per-biome number (`sysSKY_TOP`). A new chapter adds one row there, or one
row to `sysSKY_OWN` if it builds its own.

The dome takes the `gorBuildSky` exemption from the flat-shading law, for the
`gorBuildSky` reason.

### 4. The fill light (systems.js owns)

A second `DirectionalLight`, no shadow, aimed back through the subject from the
sun's reversed azimuth and flattened toward the horizon. It takes its colour and
its level FROM THE HEMISPHERE every frame (`sysFILL_K`), so every biome, event
and time of day already tuned in `atmosApply` carries it without a table.

It exists because the hemisphere light fills from ABOVE, which does almost
nothing for a vertical face: a wall gets a 50/50 blend of sky and ground and
lands in the middle of the palette no matter which way it points. The fill is the
cheapest silhouette separation there is.

### 5. `grain()` and the sparkle (shared.js owns)

```js
import { grain } from './shared.js';
const m = grain(mat(PALETTE.sand), { scale: 0.6, amount: 0.15, warp: 0 });
```

Two octaves of world-space value noise multiplying the diffuse term by a few per
cent, evaluated in the fragment shader. **No draw call, no triangle, no byte of
memory, and no texture** — which is the point, because there are none in this
game and there will be none.

It is not decoration. Every ground here is one enormous mesh in a handful of
colours and the camera sits six metres above it, so two thirds of every frame was
a single unbroken value. Sydney's lawn IS vertex-coloured — on a noise whose
wavelength is thirty-three metres, in a frame thirty metres wide.

`grain()` returns a **clone** (mat() hands back a shared cached material) and it
sets `customProgramCacheKey`, without which three shares one compiled program
between the grained and the ungrained variant and which one you get depends on
draw order. Applied at two strengths per biome: a whisper over everything merged
(`xxxVC()`), and a real one on the ground (`xxxVCG()`).

`sparkle` is the same helper's second half and is only ever for water. Lambert has
no specular term, so every sea in this game was a flat wash of one colour. Two
multiplied noise fields, thresholded through a NARROW ramp (a wide one leaves
every speck at a third of the strength asked for and the sea reads as dirty), and
then two things without which it is not water but static:

- it **dies with distance** (`fwidth` on the sample point) — a sub-pixel speck
  does not twinkle, it crawls, and the far half of the harbour boils;
- it **comes in patches** — one very low-frequency drifting noise, because real
  glitter is a sun path and a bit of chop, not an even dusting.

The amount is allowed to exceed 1.0: the composite pass blooms anything over the
biome's threshold, and that is what turns a bright pixel into a glint.

`grainTick(t)` advances one shared uniform object; systems.js calls it once a
frame and every water surface in the game moves. Do not add a second clock.

### What this cost (measured 20 Aug 2026, 1600x900, 150 real rAF frames each)

- **Frame time: 16.7 ms median, 16.8 ms p95, in all thirteen** (re-measured over sixteen on 20 Aug 2026; see below). A locked 60 with
  no dropped frames, before and after.
- **Draw calls: +1 per biome** (the sky dome), 0 where a chapter owns its own.
  Sydney 122, Kowloon 71, everything else 43 to 77.
- **Triangles: +1 152** (the dome).
- First entry into a biome peaks at 33–100 ms while its shaders compile; every
  entry after that peaks at 17.6 ms. The white hold in `biomeFadeTo` covers it.
- 16/16 clean on `qa/fuzz.js` (eight seconds of random input per biome, real
  keyboard, real clock): no NaN, no void falls, no solver saves, no errors.

### AND RE-MEASURED OVER SIXTEEN (20 Aug 2026, after chapters 14-16)

- **Frame time: 16.6-16.8 ms median, 17.6-18.2 ms p95, in all sixteen.** A
  locked 60 with no dropped frames.
- **Draw calls:** Manly 45, the Pantanal 48, Son Doong 48. Sydney is still the
  worst at 122; everything else 43 to 58.
- **Triangles:** Manly 35 664, Son Doong 52 572, the Pantanal 116 954. The
  Pantanal was 172 550 on its first build and the grass was a hundred and five
  thousand of it — seven boxes a tuft, twelve hundred and fifty tufts. Five
  boxes and eight hundred and twenty reads exactly the same from six metres up
  and costs 48 000.
- **Cannon bodies:** Son Doong 100, the Pantanal 73, Manly 40. The Pantanal was
  185, of which fifty was one static box per four-metre segment of the
  Transpantaneira; it is drawn every four metres and collided every twelve,
  and the road bends 2.6 m over its whole length so nobody can tell.
- 16/16 clean on `qa/fuzz.js` again.

## Performance budget (hard limits — critics will enforce)

- Total draw calls < 220. Use `InstancedMesh` for repeated flora/crowd filler. **Re-measured 20 Aug
  2026 after the presentation pass: 43 to 122, and Sydney is still the worst. The
  sky dome is +1 in the ten chapters that do not own one.**
- Total triangles < 130k. **Palawan broke this and has been fixed.** Measured 20 Aug 2026: 145,639
  in the chapter and 152,640 rendered from the drop-off, where three of its tasks are. It was not
  the reef and it was not any one prop — the manta added the same day is 672 triangles, four
  tenths of one per cent. **It was the seabed: a flat 150 x 190 grid, two-metre cells over the
  whole 300 x 380 m, 57,000 triangles, thirty-nine per cent of the chapter, and most of it spent
  on the abyssal plain where the floor is one number.**

  The fix is Pasto's, and it is the one to reach for whenever a heightfield mesh is the biggest
  thing in a biome: **warp the grid instead of shrinking it.** A monotone squeeze (`palWarp`,
  k = 0.5, and k < 1 is what keeps it monotone) pulls vertices toward the middle where the reef,
  the drop-off, the crack, the lagoon and the cathedral all are. 96 x 122 warped gives 1.6 m cells
  through the middle — FINER than the uniform grid it replaced — and 6 m out on the plain, for
  23,424 triangles. s = ±1 maps to itself, so the mesh still ends exactly where the world does.
  Palawan is now 112,495. Everywhere else: 13k to 71k.

  **Re-measured 23 Aug 2026 after the deep pass over chapters 12 and 13: Palawan
  117,867 → 128,510 and Cappadocia 82,776 → 116,170.** Palawan had twelve thousand
  triangles of headroom and needed thirty, so like Marrakech its uplift is mostly
  REALLOCATION — about 22,000 reclaimed (palm fronds 483 boxes → V-section leaves, 5,796
  → 3,864; 540 seagrass blades from boxes to crossed quads, 6,480 → 2,160; the flat water
  sheet warped like the seabed already was, 13,024 → 7,616; the seabed 96×122 → 80×100 at
  still-finer-than-uniform 1.9 m cells; the caustic sheet trimmed to the 4-6 samples a
  cycle its own note requires) and spent on a karst island that is tapered, fluted and
  streaked instead of stacked boxes, coral that has a stem and a rim, and five new
  populations of animals. Cappadocia had fifty thousand of headroom and simply used it.

  **AND THE OTHER MEASUREMENT IN BOTH WAS THE SHADOW PASS.** `registerShadowTarget` ends
  every biome build with `traverse(n => n.castShadow = true)`, so everything either file
  had authored NOT to cast was casting: Palawan 116,663 of 117,867 triangles and
  Cappadocia 82,660 of 82,776. In Palawan the worst of it was VISIBLE and had been for the
  life of the chapter — the water sheet is a transparent double-sided plane over the whole
  bay and a shadow map does not care about transparency, so the entire reef, which is the
  half of that chapter the chapter is about, sat in one flat unbroken shadow with the
  caustic net being drawn on top of it. In Cappadocia the painted balloon shadows were
  themselves fed to the shadow map: a shadow casting a shadow. `palNoShadowOnGhosts` /
  `gorNoShadowOnGhosts`, the same two rules Marrakech and the Drift already use, and the
  ghost-caster count in both is now zero. Shadow-pass triangles 116,663 → 105,374 and
  82,660 → 95,390 (Cappadocia's rose with the chapter, and its ghosts are gone).

  Earlier, 23 Aug 2026, after the deep pass over chapters 8 and 9: Marrakech 123,844
  (125,016 at its PEAK, which is mid-sandstorm) and the Drift 83,008.** Marrakech had no
  headroom at all — it went in at 126,820 — so its uplift is entirely REALLOCATION: about
  29,000 triangles of waste reclaimed (palm fronds as boxes 19,440 → V-section quads 8,640;
  a uniform 120 × 78 ground grid 18,720 → a warped 114 × 52 at 11,856 with FINER cells through
  the medina; 200 stars as six-by-four spheres → tetrahedra, −6,400; capped trunk cylinders →
  open ones; a ripple field trimmed to the ground anybody crosses) and about 27,000 spent on
  new content. **And the peak is not the number you get at the spawn**: 200 star spheres and a
  seventy-eight-lobe wall of sand are `visible = false` at noon, so every measurement this
  chapter had ever had was 10,000 triangles under its real maximum. Measure a chapter that
  changes its weather AT ITS WEATHER.

  **ALSO 23 AUG 2026, THE FOURTH PASS OVER CHAPTERS 10 AND 11, AND BOTH ARE OVER THE LINE ON
  PURPOSE.** Venice 126,346 → **168,506** and Kowloon 118,522 → **151,694**: that pass was
  briefed for an explicit ~30 % lift in geometry and juice, and this records the result rather
  than quietly rewriting the limit. Frame time did not move — 1.6 ms and 1.7 ms median against
  a 16.6 ms budget, which is where the headroom actually was. Two things about how it was paid
  for are worth keeping:

  - **AUTHOR THE EXPENSIVE VERSION ONLY WHERE THE PLAYER STANDS.** Venice's fifty palazzi carry
    nine windows each. The full Venetian-Gothic ogee — pane, four steps of head, two jambs, ten
    arch stones and a sill — costs **97,000 triangles**, three quarters of the chapter, on
    buildings that are mostly a hundred metres away behind other buildings. The eight round the
    Rialto get it; the other forty-two get the four boxes that carry the silhouette. 97k → 27k,
    and the picture is identical from every camera anybody uses.
  - **AND THE GROUND IS STILL THE FIRST PLACE TO LOOK.** Venice's ground was 150 × 124 over
    280 × 230 m = 37,200 triangles, a quarter of the chapter, on a city whose height is one
    number everywhere except two squares, a quay and two channels — all of which are 3.5 m
    blends or wider. 128 × 106 resolves every one of them and hands ten thousand triangles back.
    Third chapter running where the heightfield mesh was the biggest single object in the biome
    (Palawan's seabed, Marrakech's warp, this).

  **Draw calls, measured properly 23 Aug 2026** — `renderer.info.autoReset = false`, `reset()`,
  one tick, read. (The naive read straight after `tick()` returns **1**, because the post pass
  resets the counter, which is why every draw-call number in this file before today came from
  counting meshes instead.) Venice 156, Kowloon 265, Rio 146, Pasto 179, **Sydney 267**. The
  220 above was measured without the shadow pass; every shadow-casting mesh is a second call.
  Sydney has been the worst since long before this pass and Kowloon is now level with it.

  Earlier, 21 Aug 2026, after the deep pass over chapters 6–8 (walk the scene graph and
  multiply instanced geometry by `.count` — `renderer.info.render.triangles` after `post.render()`
  counts the shadow pass as well and reads roughly double): Rio 119,320, Iceland 114,394,
  Marrakech 125,472. Marrakech went OVER at 143,564 on the way and it was one thing: 2,340 sand
  ripples drawn as BOXES. **A ripple is a facet of the ground seen only from above, so eleven
  twelfths of every box is faces that cannot be seen** — a pre-rotated `PlaneGeometry` is 2
  triangles instead of 12, and the same argument applies to any flat ground detail (frond blades,
  towels, whitewater, painted markings). The catch: a quad has no side faces, so a corrugation
  needs two OPPOSED quads per pitch rather than one tilted one.
- Zero per-frame allocations in `update()` — reuse scratch vectors declared at module top level
  (prefixed!). No `new THREE.Vector3()` inside any update loop.
- Cannon bodies < 130 total. Sleep static/idle props (`body.allowSleep = true`).
  **Re-measured 20 Aug 2026 after the second minis**: Sydney 130, Kyoto 150, Venice 104, Cappadocia
  76, Rio 74, Cali 73, Sahara 63, Pasto 61, Palawan 60, Kowloon 56, Drift 29, Quay 11, Iceland 11.
  Kyoto has been over since chapter 4 and is the only one past the line; Rio absorbed twenty-two
  new static boxes (the bonde's viaduct and the aqueduct deck, which had no floor at all before)
  and is still comfortably inside it. Recorded here rather than quietly rewritten.

  **Re-measured 23 Aug 2026 after the deep pass over chapters 12 and 13: Palawan 78 → 79,
  Cappadocia 113 → 77.** Cappadocia was seventeen off the hard limit before a single new
  rock was added, and it was one thing: eighty fairy chimneys spending eighty whole
  `CANNON.Body` objects. `gorPoolBody` puts them on four compound bodies split by region —
  the same argument as `sahStaticGroup`, `rioStaticGroup` and `iceStaticGroup` — which paid
  for the chimneys' new variety (leaning, multi-headed and beheaded ones, each with its own
  shapes) AND for making the east ridge solid. That ridge was 116 of the chapter's 146
  walk-through samples: it is decorative, a hundred and twenty metres of it, and a player
  could simply keep walking east into the middle of it. Solidity residue 146 → 41 and
  Palawan's beach 179 → 26, all of it vegetation and terrain false positives.

  Earlier, 23 Aug 2026, after the deep pass over chapters 8 and 9: Marrakech 122 → 42,
  the Drift 65 → 75. Marrakech was two bodies off the hard limit and it was not one big
  thing: 32 souk blocks, 14 food stalls, 12 wall segments, 14 pisé walls, 8 sluice gates and 9
  arcade piers, each spending a whole `CANNON.Body`. `sahStaticGroup` puts a whole terrace on
  one compound body — identical shapes, one broadphase entry — exactly as `rioStaticGroup` and
  `iceStaticGroup` already do. The Drift's rise is eight new deep-field islands and two
  standing stones, and it is nowhere near the line.

  **Also 23 Aug 2026, the fourth pass over 10 and 11: Venice 171 → 182, Kowloon 77 → 85.**
  Venice's is the Torre dell'Orologio (three boxes) and the Loggetta (one); Kowloon's is a
  siu mei shop (two), a rooftop hut and a pigeon loft (two), and — the one worth naming — ONE
  compound body carrying the whole street's furniture: four signal poles, four guard rails,
  five lamp posts, six litter bins and a bus stop, twenty shapes and a single broadphase entry.
  A metre-high guard rail you can walk through is the forty-two-centimetre problem again
  (Sydney's bollards, Venice's rio wall), and the answer is never twenty more bodies.

  Earlier, 21 Aug 2026, after the deep pass over chapters 6–8: Rio 78, Iceland 114,
  Marrakech 103. Iceland's jump from 11 is the whole of that chapter's solidity residue
  arriving at once — 34 seracs, 18 fumaroles, 11 parked cars, 5 quay sheds, 3 moored boats, a
  nine-shape polygon for the basalt plug and one kinematic body carrying sixteen icebergs.
  `qa/audit-solid.js` over the three: Rio 27 → 29, Iceland **105 → 12**, Marrakech **90 → 47**,
  and what is left in all three is vegetation, the instanced crowd and terrain false positives.
- **THERE IS A THIRD QUESTION AND NOTHING HAD EVER ASKED IT.** A solidity audit says *is this
  thing solid*. A driven walk says *can I get past it THIS way*. Neither of them says **is
  there a continuous corridor at all** — and that is the one that catches a route being sealed
  by two objects that are each individually correct.

  `qa/wn-clear.js` is nine lines of it: take every static and kinematic Box in the world as an
  AABB, then for each half metre along a corridor, sweep across it and report the widest
  unblocked run, inflated by the animal's own half-width. Anything under 1.0 m is a report.
  Run against Mong Kok 23 Aug 2026 it found the west pavement **0.0 m wide for five metres**,
  sealed by a bakery counter that had been there since the chapter was written and a taxi
  parked half on the kerb — with the chapter's FIRST TASK at the end of it. Nothing had ever
  noticed because the task itself is reachable from the road side, the solidity audit says
  both objects are properly solid, and a driven walk down the other pavement passes.

  It also found the price of every local standing in the middle of a pavement: a 0.6 m figure
  plus a 0.9 m animal on a 3.3 m footway leaves 0.4 m on one side. Locals go against the
  shopfront, and street furniture goes on the kerb line, or they are a wall with dialogue.
- Target 60fps on integrated graphics at 1600×900.
- Shadow map: one shadow-casting directional light, 2048² (it was quietly 1536 for a
  year; the difference is visible on every palm shadow in Palawan), `PCFSoftShadowMap`,
  `shadow.camera` fitted to a ~44 unit box that follows the capybara (systems.js owns
  this). There is a SECOND directional light — the fill — and it does not cast.

## File ownership (do not write outside your file)

| Agent | File | Exports |
|---|---|---|
| A Environment | `src/environment.js` | `export function createEnvironment(game)` |
| A Pasto | `src/pasto.js` | `export function createPasto(game)` — prefix `pasto` |
| A Quay | `src/quay.js` | `export function createQuay(game)` — prefix `quay` |
| A Kyoto | `src/kyoto.js` | `export function createKyoto(game)` — prefix `kyo` |
| A Cali | `src/cali.js` | `export function createCali(game)` — prefix `cali` |
| A Rio | `src/rio.js` | `export function createRio(game)` — prefix `rio` |
| A Iceland | `src/iceland.js` | `export function createIceland(game)` — prefix `ice` |
| A Marrakech | `src/sahara.js` | `export function createSahara(game)` — prefix `sah` |
| A Drift | `src/drift.js` | `export function createDrift(game)` — prefix `dri` |
| A Venice | `src/venice.js` | `export function createVenice(game)` — prefix `ven` |
| A Hong Kong | `src/kowloon.js` | `export function createKowloon(game)` — prefix `hk` |
| A Palawan | `src/palawan.js` | `export function createPalawan(game)` — prefix `pal` |
| A Cappadocia | `src/goreme.js` | `export function createGoreme(game)` — prefix `gor` |
| A Manly | `src/manly.js` | `export function createManly(game)` — prefix `man` |
| A Pantanal | `src/pantanal.js` | `export function createPantanal(game)` — prefix `pan` |
| A Son Doong | `src/cave.js` | `export function createCave(game)` — prefix `cav` |
| A Antarctic | `src/antarctic.js` | `export function createAntarctic(game)` — prefix `ant` |
| W Environment | `src/weather.js` | `export function createWeather(game)` — prefix `wx` |
| B Capybara | `src/capybara.js` | `export function createCapybara(game)` |
| B Condor | `src/condor.js` | `export function createCondor(game)` — prefix `condor` |
| C Props/Physics | `src/props.js` | `export function createPhysicsWorld(game)`, `export function createProps(game)` |
| D NPC AI | `src/npc.js` | `export function createNPCs(game)` |
| E Systems | `src/systems.js` | `export function createSystems(game)` |
| Coordinator | `src/main.js`, `src/shared.js`, `build.mjs`, `index.html`, `CONTRACT.md` | — |

Each `create*` returns an object with an optional `update(dt)` method. Called in this order each frame:
`env → pasto → quay → kyoto → cali → rio → iceland → sahara → drift → venice → kowloon → palawan → goreme → manly → pantanal → cave → antarctic → weather → props/physics → capy → condor → npcs → systems`.

`weather.js` is **biome-neutral and always resident**, like the capybara, the condor and
systems: the micro-weather is a property of wherever you are standing rather than something
any one chapter owns, and its two instanced fields are one set of buffers every chapter
borrows. It runs AFTER every biome (so it can ask the live chapter what it is) and BEFORE
props/capy/npc/systems (so the wetness, the gust and the light deltas it computes are read
the same frame by the controller's grip, the locals' umbrellas and the atmosphere pass).

Draw-call and body budgets are **per live biome**, not global — the inactive biome costs zero.
