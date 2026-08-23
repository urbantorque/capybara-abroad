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
  state,         // { time, dt, paused, started, score, chaos }
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
are currently watching for you, both crowds in one number.

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
