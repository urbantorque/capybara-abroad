# CAPYBARA SYDNEY — LOCKED MODULE CONTRACT v1

**Do not deviate.** Every developer agent writes exactly ONE file. Any change to this contract
must be requested from the Coordinator, not made unilaterally.

> **How to read a number in this file (D9).** Most sections below are a dated
> record of one batch, and a count inside one is the count ON THAT DATE. This
> game had sixteen chapters, then seventeen, and now has nineteen, so "all
> seventeen worlds" in a section headed *v13* is a true sentence about August
> and not a claim about today. Numbers that are load-bearing NOW — the ones a
> reader would act on — are written against `CHAPTERS.length` or spelled out
> with the date, and the two that had gone stale as claims (the journal shelf,
> and the count of `force: true` in `sfx()`) were corrected rather than
> re-dated. Rewriting the rest would be rewriting the record of what was true
> when a decision was made, which is the thing this file is for.

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

Each module file may contain imports ONLY at the very top, and every one of them
must be a NAMED import whose specifier is `three`, `cannon-es`, or `./<name>.js`
in this directory:

```js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, TASKS, rand, randInt, clamp, damp, lerp } from './shared.js';
```

The named list from `./shared.js` is whatever that module exports and the
importer needs — it is not a fixed set of eight, and modules differ. Side-effect
imports (`import './x.js'`) are refused: the bundler has to be able to account
for every name it inlines.

- Export via `export function`, `export const`, `export let`, `export var` or
  `export class`. **No default exports** — that one is still absolute, and the
  build fails on it.

  *(This section used to say "`export function` only, no `export const`, no
  classes", and had not been true for a long time: `shared.js` exports
  `PALETTE`, `TASKS` and `CHAPTERS` as consts and `build.mjs`'s EXPORT_RE was
  widened to match. The one section headed "obey exactly" was the one section
  describing rules the build does not enforce, which is the worst place in the
  repository for that to be true.)*
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
`capy:move {position, speed}`, `capy:dig {position}`, `npc:barge {rec, speed, x, z}`
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
- **the shelf** at the top of the journal — ONE SLOT PER CHAPTER, always all of
  them (nineteen at the time of writing; it was seventeen when this section was
  written and the loop has always been over `CHAPTERS`, not over a number), the
  unearned ones drawn greyscale at 0.30 so you can see there is a shape in the
  box and not what it is;
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

1. **Triangles, 130,000** — the Payoff Pass brief's gate. Most chapters are over it and
   the audit REPORTS rather than fails on it, with the cost beside every chapter that
   misses. Closing the rest means cutting density where the player is standing, and the
   same brief forbids visual regressions.

   *(RECONCILED, R10, 2 Sep 2026. The count here said "ten of seventeen" and the game
   has had nineteen chapters for a while. Measured with `qa/budget.js` over **three page
   loads**, which is what this section has always asked for, and reported here **without
   the shadow pass** — the walk counts every visible mesh once; casters are the separate
   `shadowTris` column, and the ROADMAP's 139k–454k soak figure counted them twice, which
   is most of the gap between the two numbers.*

   ***13 of 19 are over the 130,000 line.** Worst to best over the line: hanoi 300k,
   pantanal 210k, goreme 205k, iceland 200k, sahara 198k, drift 185k, venice 183k,
   antarctic 182k, quay 169k, monaco 161k, cave 160k, kowloon 155k, palawan 130.4k.
   Under it: rio 126k, kyoto 124k, cali 112k, pasto 104k, manly 86k, sydney 90k.*

   *The measurement is stable enough to quote: across the three loads the widest spread
   was iceland at 3,690 triangles and the narrowest four chapters did not move at all.
   And the gate that decides still says the same thing it said in v28 — **the worst
   chapter in the game costs 2.02 ms of a 16.67 ms frame against a 5.5 ms budget**, and
   hanoi, which has by far the most triangles, is 1.90 ms while goreme at two thirds of
   its count is 2.02. The triangle gate is a report and the cost gate is the gate.)*
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

## THE FRAME — D6, FIRST HALF (3 Sep 2026)

Area 6 of `ROADMAP-DELIGHT.md`, whose sentence is *the paper is right; the
marks on it, the controls in it and the silence around it are not yet the same
product.* Instruments: `qa/d6-frame.js` and `qa/p7-tokens.cjs`, which now
counts motion and reads `index.html` as well.

The batch was sized at two sessions and this is the first of them. The second
is named at the bottom.

### Motion is a token now, and a curve is a claim about mass

Counted before this existed: **thirteen distinct `cubic-bezier`s across
eighteen uses** — five of them overshoots differing in the second control point
by a tenth (`.2,1.3,.4,1` / `.2,1.5,.35,1` / `.2,1.5,.4,1` / `.2,1.7,.4,1` /
`.2,1.8,.35,1`), which nobody alive can tell apart on a 400 ms transform — and
**thirty-seven distinct durations across a hundred and two uses**. It is the
same accumulation the radii had before P7, in the axis that is hardest to look
at directly, and it is why two things that ought to feel related never quite
did.

Four curves, and each is a different physical claim:

| token | curve | what it means |
|---|---|---|
| `mSnap` | `.2,.9,.3,1` | it responds — a hover, a press, a fold |
| `mGlide` | `.16,1,.3,1` | it arrives under its own weight — a sheet |
| `mSpring` | `.2,1.5,.4,1` | it lands and settles — a tick, a stamp, a pill |
| `mHold` | `.4,0,.3,1` | it starts AND stops — a height, a crossfade |

...and three durations — `dFast` .16s, `dMed` .3s, `dSlow` .5s — which are the
three the sheet was already using most (16, 11 and 6 uses).

**And the rule that decides what gets one, because "tokenise the motion"
applied literally would have rewritten every fade in the file: A CURVE IS A
CLAIM ABOUT MASS.** Colour and opacity have none — a thing fading has no
weight, no overshoot and nothing to settle — so they stay on plain `ease`.
Anything that MOVES (transform, height, width) takes one of the four.

Measured after (`qa/p7-tokens.cjs`): **zero un-named curves**, and seven
un-named durations at or under .55s — a touch press at .09s, two 140 ms
delays, the knob's .12s linear follow, the picker's 34 ms/120 ms stagger.
Thirteen more over .55s are listed separately and deliberately left: the
title's .75s, the glow's 1.1s crossfade and the ornament's five-second breath
were each measured against a specific moment, and rounding them to a scale
would undo that work to make a number smaller. That is the type scale's own
argument, applied one axis over.

### The two most-opened cards had no entrance at all

The journal and the pause card: the veil behind them faded and the paper was
simply already there, at full size, in the middle of it — while the souvenir
card, the moment card, the done card, the ledger and every tile of the picker
are dealt. Both are dealt now, on `mGlide` over `dSlow`, each keeping its own
rotation (they tilt opposite ways, because two sheets on a table do not lie
parallel).

Measured as the computed transform of the card with its parent closed and then
open: **different in all three rows**, the done card included as the control.

### The pen moves — 231 tasks, and it never had

The mark that says a task is done was `content:"\2713"` scaled from zero — a
Unicode tick, in whatever face the platform has, popping into existence at full
size — with a `<div>` bar growing sideways through the words. Both APPEARED.
Nothing was ever drawn.

The tick is a stroked SVG path on `pathLength="1"`, which is the attribute that
makes this cheap: it renormalises the path's own arc length to 1 whatever its
real geometry is, so `stroke-dasharray:1` is one dash covering the whole path
and `stroke-dashoffset` animating 1 → 0 draws it end to end at an even speed.
Measured through a tick landing: **1px → 0.559px → 0px**. It overshoots its box
top-right on purpose — a tick made inside the lines is a checkbox.

**A stroke, in a game whose aesthetic law forbids outlines, and it is not an
exception.** The law is about SILHOUETTES: a drawn edge round a thing is a lie
about a shape. This is a pen mark. A tick IS a stroke; there is no
filled-polygon version of somebody crossing something off, and the marks'
dialect is filled precisely because it is drawing OBJECTS.

**The strike could not use the same mechanism, and finding out cost a
screenshot.** Its box is stretched to the row's width
(`preserveAspectRatio="none"`), so without `vector-effect:non-scaling-stroke` a
long task is crossed out with a fatter pen than a short one — and
`non-scaling-stroke` moves the DASH PATTERN into screen units too.
`stroke-dasharray:1` then means one PIXEL, `pathLength` normalisation is
bypassed entirely, and **every unticked task in the chapter was wearing a 1 px
dotted line**. It measured clean, because the probe was reading
`getComputedStyle(...).strokeDashoffset` — the DECLARED value, which says
`1px` whatever the renderer did with it. The phone-width screenshot is what
caught it. The strike is revealed by a clip inset from the right instead: a pen
moving left to right at a constant weight, at any row width, 90 ms behind the
tick, which is the order a hand does it in and the only reason the two read as
one gesture.

...and the strike is anchored **half a line down from the top of the wrapper**
rather than at 52 % of it. A task row wraps to two lines on a phone, and the
bar this replaces was at `top:52%` of a box that is then two lines tall, which
put it in the GAP BETWEEN them, striking nothing at all. Verified across 232
rows: **no row that is not done carries a mark.**

### One dialect, not four

The HUD spoke in four picture languages at once: the marks (nineteen postcards
and nineteen souvenirs — flat filled polygons, no strokes); a stroked Material
speaker on the pause card; Unicode `✓ ▸ ▾ ← ◷ ▲ → ↑ ↓ ✔ ·`; and the touch fan,
which was **six words in circles** — a phone player's entire vocabulary of
verbs set in tracked-out capitals, which is what a lift button looks like and
is the one part of this game that could be any game.

**Nine glyphs** (`sysGLYPHS`), in dialect one, cover all of it:

- **chev** — a solid triangle. It is `▸`, and rotated it is `▾ ← →` and every
  arrow keycap in the legend: one shape, four jobs, which is what having a
  dialect means.
- **clock** — the mark on a task that is timed.
- **speaker** and its crossed variant — the pause card's three faders.
- **wheek · grab · hop · slide · stuck · menu** — the six words in circles.
  Every one keeps its word as an `aria-label`, because a picture is a
  decoration to a screen reader and these are the only controls a thumb has.

Two fills and no more: everything is `currentColor`, so a glyph is ink on
paper, accent on a hover and paper on the one button that inverts. Shapes
marked `o` take the background (`--capyui-gbg`) instead, which is how a solid
disc gets a clock's hands cut out of it without a stroke, a mask or a second
path.

Measured live: **0 Unicode used as a picture** in the HUD and 0 on the title
card, **74 glyphs drawn**, and **0 stroked icons** that are not the pen.

The last two were in a TOAST — a middle dot on a find and a heavy check on a
tick — which is why the DOM sweep never saw them: a pill is up for two seconds
and the sweep runs after. They are words now (`found · …`, `ticked · …`),
because a `note` pill already reads as the game talking about itself and what
it was missing was WHICH of the two things had happened.

### One pill, six meanings — and now three

`.capyui-toast` carried a task tick, a find, a door line, a control hint, an
autosave notice and the last three sentences of the game, all in the same bold
paper pill. The tell is `qa/p7-ledger.png`: **four pills stacked over the
ledger**, which is the card that is supposed to be the last word.

- **say** — a line in the game's voice. Italic, reading size. It is the
  DEFAULT, because about a hundred and forty of the call sites in this
  repository are a sentence somebody would say.
- **note** — a label the game is showing you about itself. Tracked caps,
  quieter, smaller; the seventeen calls in `systems.js` pass it explicitly.
- **last** — the closing sentences. A `say` that is HELD (5.2s against 2.6),
  and it arrives alone: it clears the stack, because the end of an eight-hour
  game should not be read over the top of an autosave notice.

The split is the one the card recipe already draws everywhere else — see
`.capyui-donenote`, *"the only thing on this card that is a SENTENCE rather
than a label"*.

The stack is **three**, not five. And nothing speaks over the ledger: a toast
raised while it is up is dropped, and the ones already up are pushed out the
way their own timers would have. Measured: six toasts in one turn leave **3**;
opening the ledger leaves **0**; two raised over it leave **0**.

### The frame was silent

Measured before: **zero UI sound** in the whole HUD. No tile press, no card
opening, no detent on a fader, no note under a focus move — while the world
behind it has ninety-odd voices.

Four sounds, four synths, and not one new one, because P4's lesson is that one
chime doing seven jobs is the same failure as one pill carrying six meanings:

| | synth | when |
|---|---|---|
| press | `pop` | a fingertip on paper — a tile, a button, a row |
| open | `rustle` | a sheet being dealt — a card arriving, and only that |
| detent | `tick` | a fader crossing a mark |
| focus | `clink` | a pen touching down — keyboard and pad only |

One delegated `click` listener on the HUD root rather than sixty bindings, so a
keyboard player and a pad player get the same sound as a thumb without a second
code path; the touch fan is divs with a captured pointer and is wired at its
own `pointerdown`. The focus sound asks `:focus-visible` rather than tracking
the last input device by hand, so a mouse click does not make two noises.

**On a STEP, not on a pixel:** the range fires for every unit of a hundred, so
a sound per event is a hundred clicks across one drag. Every tenth is ten marks
across the travel, which is what a detent is. Measured over a full sweep:
**11**.

Gated on calm, with everything else this HUD freezes. Measured: **0 sounds
under calm, 2 suppressed** — a counter that ticks `muted` rather than simply
not ticking, so a gate that is silently doing nothing does not read the same as
one that is working.

### The pause card keeps its native controls and loses somebody else's skin

The speaker was four 1.9 px stroked paths — a Material icon, character for
character — on hand-drawn cream paper. It is two glyphs now, filled, and the
class swap that shows the crossed one is the swap the arcs already used.

The calm switch was a real `<input type=checkbox>` wearing `accent-color`,
which paints the PLATFORM's box: a system-blue rounded square with the
operating system's own tick in it, four millimetres from three faders that had
already been re-skinned. It is still a real checkbox — keyboard operable,
announced, label-wrapped so the whole row is a hit target — and it now wears
the same square, the same 1.6 px ink rule, the same corner and the same
two-degree tilt as the task list's tick boxes, with the same drawn pen inside
it. The pause card and the to-do list agree about what a checked box looks
like, which they never have.

### The boot card is the same piece of paper

It was a self-contained mini design system with its own colours, its own type
scale and a rotating ring spinner — and on a slow connection it is the ONLY
screen a player sees. It is the title card's recipe now: the paper, the rake of
light, the laid texture, the three shadows, the second sheet behind it, the
subtitle in the accent, and the masthead device breathing where the spinner
was. A rotating ring is the one shape in this product that says *framework*.

**Hand-copied, and that is the point rather than an apology.** This markup runs
before `main.js`, before the import map resolves, before a single module is
fetched: nothing in `src/` can reach it, and a boot screen that depends on the
thing it is waiting for is not a boot screen. `qa/p7-tokens.cjs` reads
`index.html` now so the copy cannot drift silently — measured: **2 radii, 5
type sizes, 2 shadows, 0 colours that are not the card's.**

### The masthead is cut, not set

Nineteen jobs in this HUD are done by one system face at 400 and 700, including
the biggest piece of type in the product. A vendored face is a licence decision
before it is a design one and is on the owner's list, so the masthead is CUT:
fifteen letters on a grid, every stem 2.6 wide, every cap from y=2 to y=14,
every bar 2.6 deep, and the curves not drawn at all — a C is three bars, a D is
a chamfered bowl, a G is a C with a shelf. **65 shapes, 0 strokes**, a viewBox
of 255.2 × 16 sized by width alone.

Set in caps, which is a decision rather than a shortcut: lower case needs a
second set of proportions, three overshoot curves and a descender depth, none
of which this grid has.

**And the D was an O until it was photographed.** Cut the way every other
letter is — a stem, a top bar, a bottom bar and a right stem — it is a
rectangle with a rectangular hole in it. At 46 px the masthead read UNTITLEO.
It is one chamfered polygon now, and it is the only letter in the set that
needed anything but bars.

It stays an `<h1>` and it keeps the words: the mark is `aria-hidden` and the
heading carries a clipped copy of the title, so the document still has a
level-one heading with the game's name in it. A wordmark that costs a page its
`<h1>` is a picture where a heading was.

### Three ways a probe of a user interface lies to you

All three cost a run and all three are now written into `qa/d6-frame.js`.

1. **`getComputedStyle` on the frame a class lands returns the OLD value.** The
   entrance check toggled `.show` and read the transform in the same turn, and
   reported `dealt:false` on three cards that are all dealt.
2. **`document.querySelector('button')` finds the boot card's *Try again*,**
   whose click handler is `location.reload()`. The run died on "Execution
   context was destroyed" three sections later and it looked like a harness
   fault. It was the probe pressing reload. Scope every selector to `#hud`.
3. **The title card is torn out of the DOM when the game starts.** Anything
   measured about the masthead or its footer has to be measured before the
   first chapter key, or the probe reports a wordmark that is not there against
   one that is.

...and a fourth that is not about probes: **`uiSfx` calls the closure-local
`sfx()`**, so a probe that wraps `game.sfx` sees none of the four UI voices and
reports a silent frame against a frame that is not silent. `game.hud.uiSfxAudit()`
is the counter it needs.


## THE DOOR IS AN OBJECT — D6, SECOND HALF (3 Sep 2026)

The tenth item of area 6, and the only one in it that is not on the paper: an
**exit board** standing at each chapter's `way`, and the departures card
opening **out of it** rather than over the top of it.

D6's first session ended with the exit better signposted than anything else in
the game — a mark on the chart, an arrow and a beacon on the paper, a sentence
under the row — and every one of those is ON THE GLASS. In the world the door
out of nineteen hand-built places was an empty patch of jetty, indistinguishable
from the forty metres either side of it except by a translucent cylinder the HUD
drew on the ground.

Instruments: `qa/d6-board.js` (the sweep and the nineteen photographs),
`qa/d6-probe.js` (every collider surface at a door), `qa/d6-open.js` (the four
frames of the door opening), `qa/d6-sheet.cjs` (the contact sheet).

### The object — `exitBoard()` in shared.js

One builder, three **mounts** — a pair of posts, a stone stele, a hanging beam
— and a per-chapter dressing in `sysBOARD_DRESS`. It is a DEPARTURES board:
six rows of split-flap tiles with a colour chip at the head of each, and the
colour is the destination's own — `sysMARKS[biome].tint`, the same wash that
backs that chapter's tile on the picker, so somebody who has been to Venice
knows the colour of the Venice row before they can read anything.

There is no text in this world and this does not grow a font atlas.

**Four draw calls whatever the dressing**: the mount, frame and face are one
merged mesh on one material shared by all nineteen boards (so the colours are
in the vertices and nineteen dressings are one program); the flaps are one
`InstancedMesh` of 30 with `instanceColor`; the chips are another of 6; the
lamp, in the five chapters dark enough to need one, is the fourth. Both pools
are `frustumCulled = false` — an `InstancedMesh` computes its bounds from the
geometry and not from the instances, so a board seen edge-on pops its own tiles.

**A tile turns over about every 2.4 s**, only while somebody is inside 26 m,
never while a card is up, never under calm, and the clack is rationed and
placed (`clamp(0.15 - far*0.007, 0.02, 0.15)` inside 15 m). That is rule 1 of
the ambient movers, and the board obeys it because it is one.

Four things it deliberately is not: a switch (nothing is gated on it and the
exit zone is exactly where it was), a sign with words on it, nineteen models,
or a thing that demands attention.

### Planted from `way`, and never from a new constant

`boardFrame` watches `game.biome.current` rather than the `biome:enter` event,
for two reasons the codebase has already paid for: six of the nineteen doors
resolve through a getter on the biome's own published api and are not
answerable on the frame the event fires (it retries four times a second), and
**the boot chapter never fires `biome:enter` at all**. It owns its collider and
removes it at the border; the R10 soak reports `orphans: []`.

### The floor at a door is not the terrain, and there is no rule for it

The first plant used `sysGroundY`. Measured by dropping the animal at each door
(`qa/d6-probe.js`), that was wrong in six of nineteen and wrong by METRES in
four — the doors are the one place in this game where the floor is a built
thing: a wharf deck, a bridge over a river, a jetty over water, a made street.

Two rules were tried and both fail, in opposite directions, one chapter apart:

| rule | Uji (bridge deck 3.16, river bed -3.87) | Sydney (deck 0.17, shelter roof 3.04) |
|---|---|---|
| lowest surface at/above terrain | **the river** | correct |
| highest surface | correct | **the shelter roof** |

So `boardFloor` is the first rule — right on the open ground it was written for
— and the **eight built doors carry their deck height as a measured number**
(`floorY` in `sysBOARD_DRESS`). Not one of them could be derived.

**A board must also stand on the same floor as the door**, which is a different
question from the one above. "2.2 m to the right of the door" at Manly is two
and a half metres up the side of a dune: the board photographed buried to its
header while the drop test at the door reported a perfect score, because both
were true. The door's floor is the anchor and four candidate spots — right,
left, in, out — are tried for one that is level with it.

### Nineteen chapters, and what the pictures found

Every placement override in the table was a photograph before it was a number.
Three that the numbers could not have found:

1. **The Corso's door is inside a building.** `way` for chapter 3 is the literal
   (118, -586); a 28 m grid of downward rays says the street is the corridor
   x 110..126 and a chip shop sits across the middle of it at x 114..122,
   z -584..-590. The arrow has pointed through a wall since the chart was drawn
   and nothing could see it, because the exit ZONE is the whole Corso. The
   board is on the open street; the chart's mark is left alone, because moving
   it is a different batch.
2. **It stood on the roof of a surf shop for one round.** The drop test read the
   door's floor by dropping from three metres above the BOARD, and three metres
   up on the Corso is above the awnings — so it landed on the shopfronts and
   reported 5.65 with total confidence. Nothing in the numbers said otherwise;
   the wide shot did.
3. **Sydney's door has a roof over it.** The exit zone is the footprint of the
   wharf shelter. Inside it the board's header went through a 2.70 m soffit;
   outside it the camera turned onto a shelter roof with the board behind it.
   It is under the shelter now, on the low mount (`pb: 0.72`) with no hood —
   2.37 m under a 2.70 m soffit, which is exactly where a ferry timetable lives
   on a real wharf, and the one dressing in the table that is a shape rather
   than a colour.

Two boards stand further from their door than the 2.2 m the rest do — Hong
Kong's at 15.9 m and Antarctica's at 22.6 m — because the published point is
four metres past the end of the pontoon in one and at the seaward head of a
2.6 m-wide jetty in the other. Both are inside the zone the three wheeks are
answered in, which is what "at the door" means here.

### And the card comes out of it

Three wheeks buys a beat of camera — `game.frameShot`, the same request every
marquee makes, killed by a hand on the lens like any other — and then the card
grows out of the board's own position on the screen: `jrShowFrom` sets
`transform-origin` on the card in client pixels and `.capyui-jr.from` scales it
from .12.

**The turn has to COMPLETE before the card comes.** It was 0.52 s, chosen so
the card would arrive while the lens was still travelling; measured, the
framing weight at 0.52 s is 0.455, so the rig is still mostly the 41-degree
gameplay lens and the photograph at Sydney's wharf is the top of the shelter
roof. 0.86 s is `sysSHOT_IN` plus a beat, and the board is in the middle of the
frame when the card lands on it.

**The origin has to follow the board.** Written once at the open, it was 298 px
adrift by the time the card had finished growing — the camera is still swinging
and the world's pause does not stop the rig. One style write a frame for 0.62 s
holds it: measured 27 px, at rest, on a 1280-wide frame.

It degrades all the way down. No board, a board behind the lens, a board more
than 15 m away, calm switched on, or the card opened any other way (Tab, which
measures `from: false` and the default origin), and this is exactly the card it
has always been.

### Measured

19/19 planted, each with a collider, each in its own dressing. Fourteen doors
level with their board to within 0.1 m; the rest are slopes and steps. 0
un-named curves and 7 un-named durations, unchanged (`qa/p7-tokens.cjs`). The
opening: framing 0.424 at the wheek, `from: true`, origin 28 px from the board,
`depart: true`. Tiles: 30, turning. R10 soak 19/19, 0 NaN, no console errors,
no orphaned bodies.

### Two things the drop test cannot measure, and they are in the table above

Manly's door reads 2.03 because the drop lands on a flag pole, and the Corso's
reads 47.15 because the animal bounces off a shopfront and is rescued. Both
numbers are the probe, not the game; both chapters are correct in the
photographs. A drop test finds floors and only a photograph finds furniture.


## THE WATER'S EDGE — D5 (3 Sep 2026)

Area 5 of `ROADMAP-DELIGHT.md`, whose opening number is `grep -c foam`: Manly
34, Rio 15, the Quay 6, and **Palawan, Venice, Antarctica and Iceland zero**.
Four chapters about a coastline in which the land and the water were two flat
sheets that happened to intersect. Instruments: `qa/d5-shore.js`,
`qa/d5-glow.js`, `qa/d5-wet.js`; plus `game.shoreAudit()` and
`weather.ringAudit()`.

### `shore` — the waterline is a height, and grain() already had it

A new option on `grain()` in `shared.js`, beside `sparkle` and `contact`, and
it is uniforms on materials that already exist: no mesh, no draw call, no
triangle. Every grained fragment carries `vGrainW`, its own world position; a
chapter's waterline is one float in one shared uniform (`shoreTick`, written
once a frame by `sysDressFrame` from the live biome's `waterLevel`). So
`uShoreY - vGrainW.y` is the depth of THIS fragment below the surface, free,
and three things fall out of it:

- **the soak** — a band above the line and everything below it, darkened;
- **the depth tint** — a `smoothstep` below the line, multiplying the albedo
  rather than mixing toward a colour, because depth takes the red out of what
  is down there rather than painting it blue. Off unless a chapter asks;
  Palawan is the only one that does, because it is the only sea you can see
  through (opacity 0.45);
- **the lace** — two octaves of value noise through a narrow ramp, drifting on
  `grainTick`, inside a band whose CENTRE surges on two sines. One is global
  and one carries a world-space term, so the edge advances and retreats along
  the shore instead of every metre of it pulsing together.

**It is the generalisation of something that already shipped.** `venWet` in
`venice.js` had run `uVenWaterY - vVenW.y` through a wet band and a *static*
0.11 m rim line since chapter 10 — one chapter's private copy of this, with a
second varying, a second uniform, a second program cache key, an anchor on
`<emissivemap_fragment>` because grain() had taken `<color_fragment>`, and no
animation in it. A waterline that does not move is a contour, which is why the
`foam` count read zero in the chapter that had one. Venice keeps its numbers
(`shoreDark` 0.72, `shoreWet` 0.40) and loses its copy, and the acqua alta
drives the shared uniform through `waterLevel`, which that module already
rewrote every frame.

**Measured** (`qa/d5-shore.js`) — a paired A/B in one JS turn at a station on
each shoreline: render, park the waterline under the world with
`game.shoreAudit(-9999)`, render again, diff. The per-cent is the fraction of
the frame the term paints; `mats` is how many VISIBLE materials in that
chapter carry it.

| chapter | shored materials | frame painted | A/A noise |
|---|---|---|---|
| palawan | 22 | **42.7 %** | 0.00 |
| iceland | 24 | **9.9 %** | 0.00 |
| venice (low tide) | 21 | **1.9 %** | 0.00 |
| venice (acqua alta) | 21 | **21.5 %** | — |
| quay | 30 | **0.75 %** | 0.00 |
| antarctic | 5 | **0.40 %** | 0.00 |
| **manly (control)** | **0** | **0.00 %** | 0.00 |
| **sydney (control)** | **0** | **0.00 %** | 0.00 |

Venice's tide carries the line: 61 distinct values from -1.30 to +0.95 over one
cycle, which is the lace climbing the walls of the Piazzetta and crossing the
square.

Programs: 107 in Palawan, Antarctica and Venice — the same number in all three,
because the term compiles into materials that were already being compiled.

### Three things the shore term measured wrong first

**The distance fade was switching the effect off at the range you look at a
coast from.** The band dies on `fwidth(sd)` — how many metres of height one
pixel covers — for the sparkle's reason: a sub-pixel band does not shimmer, it
crawls. At a coefficient of 1.0 it reached nothing the moment one pixel covered
one band, and in Antarctica, where the beach falls at about one in one and a
half, the shoreline twenty metres from the lens is already there: the lace was
present in the close shot and simply GONE in the wide one. It fades over 1.8
bands now, so a distant shore keeps a dim continuous line, which is what
distant foam is.

**A thresholded value-noise field is a quilt, not foam.** Photographed on the
black sand at Reynisfjara the first build was a row of white rectangles a metre
across — smoothstep has zero derivative at a cell boundary, so every cell of
the lattice shows its own edge. It is the same failure the Botanic Gardens had
at `near` 0.36 and it has the same fix: warp the sample by `gn`, which is
already computed a few lines up and is free, and turn the second octave a
radian so it shares no boundary with the first.

**In Antarctica the waterline is the DARK half, and that cost two tunings.**
The first build gave it the same bright lace as everywhere else and, settled,
at the jetty, it was not there at all. It is the albedo ceiling this chapter
has been hitting since the fourth pass: the beach is snow, the grade's
threshold is the highest in the game (1.10) so that a world of white things
does not bloom into one sheet of paper, and a white line added to a white
surface under a flat overcast has nowhere left to go. What reads at an
Antarctic shoreline is the wet — dark slush, dark ice — so the soak is deep
(0.55 m down to 0.70) and the lace is a whisper on top of it. It is still the
weakest row in the table and that is written down rather than chased.

### Rain lands now — the contact rings (`weather.js`)

Three hundred and forty streaks fell through the frame, the ground went dark
and picked up a sheen, the score gained a rain bed, `splash()` told the
footfall to sound wet — and nothing in nineteen chapters drew a single drop
ARRIVING. `splash()`'s only consumer was the audio bus.

Twelve rings, one instanced open cylinder (props.js's water-entry foam shape,
ten sides rather than eight because these are drawn a couple of metres from the
lens), one draw call, and it only exists while it is raining. Emitted in a
6 m disc around the ANIMAL rather than around the lens — a streak is something
you look through and a ring is something you look at — uniform over the AREA of
the disc, at `6 + 4·rainT` a second. Each one lands on whatever the biome says
is under that point: the live water surface where it is over water, the terrain
otherwise, and the ANIMAL'S OWN FOOT HEIGHT where it is standing more than
40 cm above the terrain, which is how a ring lands on a ferry deck rather than
in the water underneath one.

Measured at `rainT` 0.69 in four chapters: **9.0 rings a second**, 5 of 12
alive, and every live ring +0.030 m above its own surface — the offset it is
given and nothing else.

### A wet floor stretches a light toward the eye

`qa/rv-kowloon.png`: the chapter whose entire subject is neon on wet asphalt
had no vertical smear in it. The reflections under the signs are PAINTED
ELLIPSES — geometry the chapter lays on the road — and the spill that actually
lights that road was a circle.

The spill's falloff measures an ANISOTROPIC distance now: the component of the
offset along the view azimuth is divided by `1 + 2.4·wet`, which makes the pool
of light reach that much further toward and away from the lens and not one
centimetre further to either side. On a ground plane that reads as a vertical
streak, which is what a reflection in a wet floor is. Nothing is added and
nothing is brightened; the same light is a different shape.

Three things hold it to its own lane. It lives in the rim's injection, so it
reaches the ground, the stalls and the animal on the program they already
share. The whole block is behind `if (uWetK > 0.001)` — a uniform, so one
coherent branch, and the eighteen chapters that are not being rained on pay
nothing. And when the wetness is zero the arithmetic is exactly the `length()`
it replaces, because `sVA` is a unit vector and `a² + |perp|² + y²` is `|sD|²`
at k = 1.

`uWetK` is grain()'s own `_grainWet` under a second name, and the second name
is not cosmetic: grain() injects `uniform float uGrainWet;` at
`#include <common>` and then calls the rim hook, which replaces the same
include again. Two declarations of one name is a compile error and the material
would have gone black rather than warned.

It is `shine()` — wetness ABOVE a chapter's baseline — so Kowloon's
permanently damp asphalt reads zero at rest by design and the smear arrives
with the shower. `qa/d5-wet-kowloon-dry.png` against `-wet.png` is the pair,
and the rings are in the same frame.

### The emitters render past white, and Göreme's threshold went up for it

The bright pass takes one THRESHOLD per chapter and a threshold is one number
asked two questions at once: *which pixels are lamps* and *which pixels are
merely pale*. In a chapter with a lantern over a limestone street those are not
separable. `D45-13` and `D45-11` are both photographs of a threshold set low
enough to find the lamps and therefore low enough to find the road.

`EMIT_OVER` (1.45) with `matEmit()` and `emitSet()` in `shared.js`. A lamp
renders above 1.0 — the scene target is HalfFloat, so it survives to the bright
pass — and any threshold at or below white finds it while nothing that is
merely white can follow it up there. It is a HEADROOM, not a brightness:
everything downstream runs through the grade's shoulder, which has always
compressed the top. `sparkle` has been exploiting exactly this since v13; its
own comment says so.

Six chapters had written the same emitter constructor character for character
(antarctic, cave, göreme, hanoi, kowloon, palawan): four of them now call
`matEmit`, and the two whose helper also takes an opacity keep their own literal
with `EMIT_OVER` in it.
`emitSet` is for the ones that MOVE — a lamp coming on at dusk, a brazier, a
bulb pulsing — which write `emissiveIntensity` every frame and would otherwise
walk straight past the factor on the first frame after construction; the nine
such writers in göreme, kowloon and the cave go through it.

**Göreme: threshold 0.46 → 0.78, `wide` 0.58 → 0.42.** The paired frames are
`qa/d5-goreme-before.png` and `qa/d5-goreme-after.png` and the difference is
not subtle: before, the whole cobbled square, the balloon envelopes and the far
valley sit under a milky veil and the paving slabs bleed into one another;
after, the individual slabs read, the envelope's facets are distinct, the
distant chimneys are visible, and the two street lamps still carry a halo.

Numerically (`qa/d5-glow.js`, differential against `git stash push -- src`),
the fraction of the frame above 0.90 luma in Göreme goes 0.07 % → 0.22 % while
the fraction above 0.75 goes 0.23 % → 0.24 %. That is the trade stated exactly:
the same amount of the frame is bright, and it has moved onto the sources.
Sydney, which has nothing switched on in it, is the control and does not move
(7.87 % → 7.33 % lit, mean luma 0.6130 → 0.6115).

**And that instrument cannot hold a line in two chapters.** Hanoi read 21.24 %,
then 8.75 %, then 19.39 % lit across three runs, and Monte Carlo 13.59, 12.31 and
4.42 — and the last two of those three runs are the SAME CODE. At a fixed 0.75
cut a chapter with a large flat sky sitting near that value flips tens of
thousands of pixels on a cloud. Göreme held 0.22 / 0.24 across every run after
the change, which is the row the threshold actually moved in; believe that one
and believe the pictures everywhere else.

### Manly is untouched, and it is the control

Nothing in `manly.js` changed. It reports zero shored materials and a 0.00 %
A/B, which is what a control is for: the first version of the shore probe moved
`waterLevel` instead of the render override and read **0.42 % of the frame in
Manly**, because moving the water level also moves buoyancy, the swim
threshold, the underwater camera and every floating prop. It was measuring the
props. `game.shoreAudit(y)` exists so that it cannot.

### A harness note this batch had to learn twice

**`biome.switchTo` does not arrive at a chapter, it starts arriving.** The
grade, the airlight and the hemisphere all damp in over about eight seconds,
and a probe that settles for three measures the PREVIOUS chapter's atmosphere.
It looks exactly like a feature decaying: twelve consecutive A/B samples in
Antarctica, camera and animal both stationary, read 0.88, 0.73, 0.66, 0.57,
0.43, 0.32, 0.18, 0.08, 0.03, 0.01, 0.01, 0.02. Every station in `d5-shore.js`
settles for ten seconds.


## HOUSEKEEPING — D9 (3 Sep 2026)

The shelf item from `ROADMAP-DELIGHT.md`: nine small things the previous three
roadmaps left behind, seven of which are a wrong number or a wrong clock rather
than a missing feature. Instruments: `qa/d9-clock.js`, `qa/d9-audio.js`,
`qa/d9-rush.js`.

### `nextIn` had no audit, and the two chapters that most needed it had no hook

The hook has existed since P3 and there was no way to tell "this chapter has no
task on a clock" from "this chapter has one and forgot the hook" —
`todoNextIn` answers −1 for both. `qa/d9-clock.js` now asks all nineteen
chapters for all of their own task ids. Six published it, for seven tasks:
`the-whale`, `mirror-swim`, `symphony`, `the-bloom`, `sunrise`,
`fold-the-street`, `the-train`.

The comment above the hook says NINE tasks in this game are "be there when X
happens". The two that were missing are the two oldest chapters:

- **Sydney's ferry.** Six nodes, five legs of five to seven seconds, and a
  twenty-second dwell at the wharf. `ferry-ride` is the FIRST task in the game
  that asks the player to wait, and it was the only kind of waiting the paper
  never explained.
- **Pasto's carroza.** `pastoCAR_DWELL` calls itself "the boarding window" in
  its own comment. The task pays out for riding her UP the plaza, so the window
  is the dwell at the SOUTH end and nowhere else — boarding at the north end
  gets you a ride back down and nothing on the paper.

Both are derived from the live position and direction rather than tracked on a
second timer, because a second clock is a second thing to keep in step. Both are
ESTIMATES while the vehicle is blocked — each waits rather than shoves, and a
stalled procession makes any countdown wrong. That is the right trade: the
number exists to tell you whether to run, and the case where it is wrong is the
case where you are already standing on the spot.

Measured over forty seconds each: the ferry counts 35.5 → 0 and holds at 0 for
the dwell; the carroza counts 30.3 → 0, holds ~8 s, and resets to 33.7. Both
answer −1 for every other task id in their chapter.

### ω×r: measured, and it is worth nothing

The reference-frame channel carries a deck's LINEAR velocity and not its
angular one, so a passenger standing off the centreline of something turning is
carried as though the deck were going straight. Whether that is worth building
depends on a number nobody had taken.

**Measured by differencing the quaternion** — not by reading `angularVelocity`,
which is zero on these bodies because they are kinematic and most are turned by
writing a quaternion. Seven chapters, every mass-0 body big enough to stand on,
900 samples each:

> **Every reading was 0.000.** The ferry, the boat, the raft, the floes and the
> bangka translate along a path and their box colliders never turn at all.

Widened to every mass-0 body in three chapters: Circular Quay 0 of 93, Manly
0 of 86, Monte Carlo **3 of 26** at up to 2.27 rad/s — the race cars, which
nobody stands on. So ω×r is not built, and the number a future turning carrier
has to beat is here. The related defect worth naming: a MESH that turns while
its collider does not (3 in the Quay, 5 in Manly, 17 in Monte Carlo — birds,
wheels and cars, all correct as they stand).

### `sfx()` said eleven and there are thirty-one

`force: true` is the one thing allowed past the per-name throttle, for the case
where a once-a-chapter payoff would otherwise land inside somebody else's
ambient cheer. The comment claimed eleven call sites. `grep -c`: palawan 6,
systems 6, sahara 4, venice 4, kowloon 3, antarctic 2, and one each in the
drift, Göreme, Iceland, Kyoto, the Quay and Rio. The RULE is still obeyed —
every one is a payoff and none is on a timer — but a number in a comment is a
claim. It is not restated as a number.

### A global voice ceiling

Every throttle in `sfx()` is PER NAME, so twenty DIFFERENT sounds inside the
same tenth of a second all pass. A bin cascade is a dozen thuds and clinks out
of props.js plus the footfall plus whatever the ambience was about to say — and
D2 raised the footfall from 10.8 to 13.1 a second at a sprint. The failure mode
is not a crash, it is mud.

A ring of twelve START TIMES inside 165 ms, not a count of live voices: the
synths schedule and stop themselves and there is no registry to consult, and
what makes mud is a burst of starts rather than a long tail. `force` and `ui`
are exempt. **Below the per-name throttle and below the distance cull**, so a
sound about to be dropped for either reason does not spend a slot.

Measured (`mixAudit().voiceDrops`): **one** drop in the first minute of chapter
one, and **ten of twenty** on a synthetic cascade of twenty distinct names.

### The fifth bed voice: air going past you

The weather bed's four voices are all facts about the weather — how hard it is
raining where you are standing. None is a fact about how fast YOU are going, and
this game has a minute-long condor flight, a dune slide, a forty-metre drop and
a bus roof, all of them silent.

Same construction as `wxBedWind` one layer over — noise through a filter whose
CUTOFF moves rather than whose level does — but bandpass rather than lowpass,
because air moving past you has a centre to it (the note a car window makes at a
crack) where weather is broadband and mostly below it. **Its own gain node**,
not a second writer on `wxBedWind`'s: two writers on one AudioParam is the trap
P4 wrote down.

Driven off the animal's own velocity and not off a rig flag, because a glide, a
slide, a bus roof and a drop are four systems and one fact. Silent under water
on purpose — there is a whole bus down there and air rushing past is the one
thing definitely not happening.

**The floor is 9.0 m/s and 6.5 was not enough.** A sprint is 7.4 on the flat,
but the gait leaves the ground between strides and the total velocity carries
the bob: at 6.5 a capybara running across a lawn drove the term to 0.073. At 9.0
it reads 0.031 on the same run, which through the squared curve is 0.0001 of
gain — the squaring is what makes the bottom of the range genuinely silent
rather than merely quiet. Measured at the top: **0.831 at 23.1 m/s**, falling
between islands in the Drift.

### Three timers off the wall clock

Pasto scheduled the crates after the stall frame, the vendor after the crates
and the cheer after the float's horn with `setTimeout`. Right idea, wrong
clock: those sounds did not know about a hitstop, about slow motion, about the
pause card, or about the player having left the chapter between the horn and
the cheer. One array and four lines, counted down on the same `dt` as
everything else in the file, and emptied outright when the chapter is not live.

### And the documents

- `README.md`'s module table listed **13 of 27** files. All twenty-seven now.
- The journal shelf was documented as "seventeen slots, always all seventeen"
  in both `README.md` and here. The loop has always been over `CHAPTERS`; it is
  nineteen.
- `package.json` 0.52.0 → 0.60.0.
- **A note at the top of this file** on how to read a number in it: most
  sections are a dated record of one batch, and a count inside one is the count
  on that date. "All seventeen worlds" in a section headed *v13* is a true
  sentence about August. Only the claims a reader would act on today were
  corrected; rewriting the rest would be rewriting the record of what was true
  when a decision was made, which is what this file is for.

## THE PAYOFF — D4 (3 Sep 2026)

The fourth batch of `ROADMAP-DELIGHT.md`, and the last of its scheduled four.
Everything here is a wire between two things that already existed. Instrument:
`qa/d4-payoff.js`, plus `game.shakeNow()` and `game.camDip()`.

### The two events the comment names did not freeze

`sysPUNCH_MIN` is a FRACTION of `sysSHAKE_MAX`, so the floor in the units
callers actually pass is 0.187 — and the paragraph above it says "a chapter's
marquee (0.14) and a ceremony (0.18) do stop the world". 0.14 is m = 0.41 and
0.18 is m = 0.53. Neither cleared it. **The only thing in nineteen chapters
that has ever stopped the world is Hanoi's passing train at 0.32.**

The floor is NOT lowered — it was tuned against the bin cascade, which is
several impacts a second in a busy market, and 0.53 would put a stutter under
every third crate. `punch(a, freeze)` takes a NUMBER now: an explicit hold in
seconds that bypasses the threshold, so the two events that deserve a freeze
are known by name at the call site rather than by being loud enough.
`chapterCeremony` asks for 60 ms, the `wow` branch for 40. Every existing
`punch(x)` and `punch(x, false)` means exactly what it meant.

Measured at 120 Hz through a whole chapter, one task at a time: `opera-stage`
(Sydney's marquee) and the ceremony after `whippy-run` both reach
**timeScale 0.10**, seven frames of it on the ceremony. Before this batch,
neither had a sub-1.0 sample.

**The probe had to be corrected first, and it is the interesting part.**
`game.time.slow` is the SLOW-MOTION component only — the lens leans in on it
and a hitstop must not narrow the lens, so a freeze does not appear in it at
all. The first run read the marquee's existing slow motion (min 0.55 for 960 ms)
and would have reported a missing feature as present. `game.state.timeScale` is
the total.

### A bang had no place, and it is not the camera that decides

`prop:impact` punched on any prop over 4.5 m/s **anywhere in the world**, so a
crate cascade behind a building shook the lens and rumbled the pad of a player
who could not see it. The sound had been spatialised for eighteen versions; the
picture never was.

`punchAt(a, x, z, r)` is `punch(a * clamp(1 - d/r, 0, 1)²)` — squared, because
a linear falloff is still audible at three quarters of the reach and this has to
be silent at the rim or it is the same bug with a bigger number. `prop:impact`
at 22 m, `prop:water` at 30 m (that channel had no lens response at all;
`sysPUNCH_SPLASH` is a third of a bin going over).

**Measured from the CAMERA, every reading came back zero.** The resting boom is
9.5 to 12 m BEHIND the subject, so a crate five metres in front of the animal is
fifteen from the eye and had already fallen under `sysSHAKE_MIN` before it got
there. "Near me" is a fact about the animal, which is also what the frame is
composed around. From the animal, a 9 m/s impact reads 0.029 at 5 m and nothing
at 12 — the reach scales with the size of the bang, which is the right shape:
a hard one still carries.

### The most repeated verb in the game had no lens response

`capy:land` had exactly one listener — props.js's dust — and fired only past
5.5 m/s of descent because that listener is the only thing that had ever wanted
it. The event now fires on EVERY landing and the old threshold moved onto the
payload as `dust`, so each listener decides for itself. The skid, which borrows
this event for a puff and is not a fall at all, sets it true at a `fall` of 3.

`camDip` is the `fovKick` integrator one term over: critically damped at k=190
(ω 13.8 rad/s), seeded on the VELOCITY rather than the position, because
writing the displacement directly is a pop and the whole point of a spring is
the approach.

**It moves the look target, not the eye.** Dropping the eye would go through
the two ground-clearance clamps thirty lines up and fight them; dropping what
the lens is pointed at pitches the frame down and back, which is the same
gesture and cannot interact with anything. Through a scratch vector, not by
writing `sysLook.y`, which is damped toward its target every frame and would
hold a write for a second.

| descent | drop | pitch | settled |
|---|---|---|---|
| 4.0 m/s | 0 | 0.0° | — |
| 6.0 m/s (a flat hop) | 0 | **0.0°** | — |
| 8.0 m/s | 0.162 m | 1.0° | 296 ms |
| 10.8 m/s (a 6 m fall) | 0.468 m | **2.8°** | 312 ms |
| 16.0 m/s | 0.790 m | 4.8° | 320 ms |

`sysDIP_V0` is 6.5 m/s because a flat hop lands at about 6.3: an ordinary hop
is untouched and a hop off SOMETHING dips. **`sysDIP_K` is measured, not
solved** — the seed aims at `v/(ω·e)`, the closed form for a critically damped
spring started at rest, and the semi-implicit integration this file uses
everywhere damps harder than that, so the rig draws 57 % of what the algebra
promises.

### The ceremony was ten seconds of paper with the lens parked

The card, the lift, the sting, the cheer and two bursts of confetti, and the
camera sat exactly where it had been for the last hour. The rig can already do
better: `frameShot` lerps distance, pitch and raise on `shotW`, yields to the
player's hand in a third of a second and expires on its own envelope. It had
nineteen obvious callers and none of them.

A pull-back and a flatter lens: 9.5 → **15.5 m** measured, 41° → 19°, the look
target two metres above the animal. That puts the PLACE in the frame rather
than the animal, which is the right subject for a card that says you have
finished it — in Sydney the frame gains the sails, the bridge and the harbour.

And `chapter:done` is a new event, because nothing in `npc.js` listened for a
chapter closing: the one moment in an eight-hour game when the place you have
been annoying for an hour has a reason to look at you. Everybody within 30 m
turns to face the animal for three seconds — **11 people, measured** — on the
head aim that has been there since P5. Attention and nothing else, the same
discipline `npcCastWitnessAt` takes: nobody moves, nobody speaks, no state
machine is entered, no wariness is written. Thirty metres is wider than any
other look in the file (a witness chain is 20, a reaction is 13) because this is
not a bang somebody heard, it is a room noticing. Locals take `chatYaw`/`chatT`
and not the flinch spring — driving that here would make a whole square jump at
the moment the game is congratulating you.

## THE WORLD ANSWERS — D3 (3 Sep 2026)

The third batch of `ROADMAP-DELIGHT.md`. Instrument: `game.reactAudit()` and
`qa/d3-react.js`, which drives the animal INTO people rather than teleporting it
next to them — the whole feature is a contact, so a probe that writes a position
has tested nothing.

### A person was a wall, and it was measured the other way round

The roadmap said barging somebody produced "no sound, no punch, no flinch". It
produced all three, of the wrong kind: a walker's collider is mass-0 KINEMATIC
and a local's is plain mass-0 static, so BOTH of them arrived in the STATIC
branch of capybara.js's collide listener and got the wall treatment — the same
stone thud, the same punch curve, the same bounce off a face. **Walking into a
person was indistinguishable from walking into a building, and the person it
happened to did not react at all.**

A person now takes its own branch ahead of the wall, with three differences:

- **less speed.** A wall needs `capyBONK_V` (3.9 m/s) before it is worth a
  noise, because at a walk you are leaning on it. Shouldering somebody at a
  walking pace is the entire joke, so `capyBARGE_V` is 1.30 — a third of it.
- **softer.** Half the punch, half the bounce, a lower and quieter voice,
  because a person gives and a wall does not.
- **an event.** `npc:barge {rec, speed, x, z}` carries the record the collider
  was already holding, so the handler does not have to search for who it was —
  which matters, because the nearest person to the animal is not necessarily
  the one it hit.

`npc.js` answers it with the flinch spring driven **away** from the animal —
the whole difference between this and `localsReact`, where a bang makes you
turn TOWARD it — a gasp on the person's own voice with a position and a volume,
a `startled` line about half the time (the neutral pool already opens with '!',
'Whoa —', 'Careful!' and 'Do you mind?', and every chapter that wrote its own
`startled` row gets its own voice for free), and half a wariness bump.
Deliberately no chase, no task and no heat of its own: being shouldered is rude,
not a crime.

### ...AND THE TWO OLDEST CHAPTERS CANNOT BE BARGED THROUGH PHYSICS AT ALL

Measured: driven into the nearest cast member, the animal reached **0.3 m and
0.2 m** of the collider's centre in Sydney and Pasto with **zero** barge events,
while the same drive in Circular Quay, Kyoto and Venice fired one every time.

The reason is thirty lines from the top of `npc.js` and it is deliberate:
`npcPlaceBody` HOLDS any body carrying `userData.npc` off the animal by
`npcBODY_CLEAR` (1.30 m) every frame, so a walker cannot shove the player — and
the comment says plainly that the DRAWN figure is not moved with it. In the two
chapters that use that path **you walk through the person**.

So the cast is barged on proximity to the FIGURE instead, which is what the
player sees anyway: `npcBargeSweep` runs once per frame over the live cast,
inside `npcBARGE_R` (1.05 m, inside the hold-off), above `npcBARGE_V`, and only
when the animal is actually going AT them — `npcBARGE_CLOSE` is the cosine
between its course and the person, because without it threading between two
people at a run barges both. Its throttle is 0.90 s against the collider
version's 0.40, because proximity is a much easier trigger and Sydney has 32
people on one lawn.

Measured after: a barge fires in every chapter the probe can reach a person in,
and in Sydney it arms the witness chain — 25 cast members holding a look at
once on the best run, 5 to 9 typically.

### The witness chain: already built, and the roadmap had it backwards

The roadmap's second must-land was "`npcWitnessChain` opens with
`if (live !== 'sydney' && live !== 'pasto') return 0` … one person jumps and the
next one turns to look, in two of nineteen chapters". That function is the CAST
chain and it was ported TO those two BECAUSE they have no `locals` — the other
seventeen have had their own since v30: `localReactLine` arms
`locChainFrom`/`locChainT`, and `localsStep` resolves it before its per-person
loop so the answer is chosen by distance rather than by array order.

Measured in the live game rather than read: `reactAudit().looking` counts locals
holding a second-order look, and it reads 1 in Venice, 2 in Manly and 2 in
Monte Carlo off a single reaction. **Not rebuilt.** What was missing was an
event that arms it outside a spoken line, and that is the barge.

### Five chapters had nothing that moves in the wind, and one of them still has

`grep -c sway`: Venice 0, the Quay 0, Monte Carlo 0, Manly 0, Son Doong 0.
Manly is one of the windiest rows in `wxMOOD` and its Norfolk pines were rigid.

- **Manly** and **the Quay** get their Norfolk pines, both merged meshes grown
  from one datum so the geometry's own extent is the right window and the trunk
  feet stay planted. 0.13 rather than the bamboo's 0.20: a Norfolk pine is a
  mast with whorls on it and what moves is the tip.
- **Monte Carlo** gets its fifty harbour-front palms — the cheapest of the
  five, because the instance's local geometry is one palm standing on its own
  origin, so `auto` windows it correctly whatever each instance was scaled or
  turned to. 0.22: a frond is a leaf on a stick and moves further than a whorl.
- **Son Doong** gets the phytokarst and nothing else. A cave has no weather and
  a swaying stalagmite is a bug; the phytokarst is the exception for the reason
  it exists at all — it grows only where the doline lets daylight in, which is
  the same hole the draught comes down.
- **Venice has nothing to sway and keeps nothing.** It is a stone piazza: no
  trees, no potted plants, and the only cloth in the chapter is the three flags
  on the piazzetta, which have had `venUpdateFlags` driving them since it was
  built. Recorded rather than faked.

Verified by asking each material for its own program cache key rather than by
eye — a hook that silently failed to bind still DRAWS, it is simply the one
batch in the chapter that does not move. Every chapter carries three swaying
meshes from the always-resident weather rig, so the deltas are: Quay +1 (1 240
triangles), Manly +1 (3 239), Monte Carlo +1 (99, instanced 50 times), Son Doong
+1 (59). Draw calls unchanged in all four.

### The probe's own findings

- **Hanoi's nearest person is 87.6 m from the spawn.** No probe walks that far
  and nor does a player who has just arrived.
- Monte Carlo's nearest local is 7.4 m away and behind something: the animal
  stops at 2.3 m on most runs. It barges other people there, so the feature is
  fine and the placement is worth a look.

## THE BODY — D2 (3 Sep 2026)

The second batch of `ROADMAP-DELIGHT.md`: contact, anticipation and
follow-through, which are the three things a procedural rig can do for free and
this one was not doing. `capy.animAudit()` went in first and is the instrument
for all three — `{speed, legPhase, gaitRate, swingAmp, stride, pop, popVel,
lean, leanTarget, accel, land, airPose, earLag, grounded, vy}`, a test hook that
nothing in the game calls.

### CONTACT: the cadence was computed from a stride the legs do not take

`capySTRIDE = 0.62` claimed to be "metres of ground per half gait cycle (~= foot
arc)". The foot arc is `2 * capyLEG_R * sin(swingAmp)` and `swingAmp` is
`0.12 + speed * 0.19` — so the constant was right at a sprint and wrong
everywhere else, and the two numbers lived fifty lines apart, which is how they
came to disagree. Measured on the ramp out of a standstill (`qa/d2-skate.js`),
metres of slip per step under the old formula:

| speed | legs produce | old formula claimed | slip per step |
|---|---|---|---|
| 1.0 | 0.163 | 0.620 | **0.457** |
| 1.6 | 0.264 | 0.620 | 0.356 |
| 2.5 | 0.338 | 0.620 | 0.282 |
| 3.4 | 0.412 | 0.620 | 0.208 |
| 4.2 (walk) | 0.476 | 0.620 | 0.144 |
| 7.2 (sprint) | 0.548 | 0.548 | 0.000 |

Worst at the creep-up-on-a-picnic speed, which is the speed most of the mischief
in this game happens at and the only one no key produces — it is on the ramp out
of a standstill, which is why a probe that holds W and reads a mean never sees
it. `npc.js` has derived a person's cadence from their own swing since the crowd
got three builds and a child in it; this is that arithmetic brought back to the
animal the camera is pointed at.

`swingAmp` is hoisted above the cadence block, `stride` is derived from it, and
the footfall sfx, `capy:step` and the flow's dust all ride the same phase and get
correct timing for nothing. **The ceiling moved**: `capyGAIT_MAX` is 48 rad/s
because the derived cadence asks for 41.2 at a sprint and the old 34 was a
ceiling under the old stride — leaving it would have put the skate back at the
top end only. The floor (2.6 rad/s) is gone in favour of `paMove`'s
`stride > 0.02`.

**What it costs.** Footfalls are 8.8/s at a walk (was 6.8) and 13.1/s at a
sprint (was 10.8, clamped). That is the honest cadence for a 0.55 m foot arc at
7.2 m/s and it is a 21 % rise in step-sfx density; `sfx()` still has no global
voice cap (D9).

### ANTICIPATION: "stretch out of the crouch", and there was no crouch

Takeoff seeded `capyPop = +0.30, capyPopVel = 5` — the animal got taller on the
frame it left the ground. It now seeds `-0.26` with `+8.0`, which puts the
compression INSIDE the existing k=300 spring: measured at 120 Hz, one drawn
frame at −0.127 (a 5 % squash), the next through zero, and a stretch peak of
0.277 against the 0.34 it had before.

**A frame and a half is what a compression that happens ON the input frame
costs, and one spring cannot do better.** The zero crossing is
`atan(x0·ω/v)/ω` and the stretch peak wants a large `v`; they pull opposite
ways, and the damping (ζ = 0.26) takes another 40 % off whatever the algebra
promises — 8.0 was measured, not solved, after the closed form said 6.8 and the
rig drew 0.238. A true anticipation would have to delay the impulse, and 50 ms
of jump latency is a gameplay regression the picture does not get to buy.

The guard is unchanged in policy: a bigger stretch already in flight (a wheek)
still wins.

### FOLLOW-THROUGH: lean was speed, and the ears were welded on

`leanTarget = gaitSpeed * k`, so a stop merely faded and a deck accelerating
under the animal moved a statue. Two derivatives now feed it:

- **the animal's own**, off `capySpeedSm` — already smoothed and already what
  the gait rides, so it is the honest one; the raw ground speed steps with
  every contact and differentiating that is a lean that shivers. Clamped to
  ±25 m/s², because a solver spike is not an acceleration.
- **the deck's**, off `capy.frameVX/VZ` — taken in world axes, differentiated at
  λ 6, and only then rotated into the model's yaw, because a deck can accelerate
  sideways and the lean is a pitch.

Measured on a sprint→stop: lean rides at **+0.214** flat out (unchanged — the
speed term is untouched), passes through zero as the animal plants, and reaches
**−0.109** for 0.61 s before settling. Peak deceleration −21.3 m/s².

**The ears lag** on the same principle: `capyEarLag` damps toward
`body.velocity.y` at λ 14 and what is drawn is the DIFFERENCE — zero whenever
the two agree, so walking, standing and a steady fall leave the term at nothing
and only a CHANGE of vertical motion shows. Peak on a hop is 4.94 m/s of
difference, 8.5° of ear. A fifth of it goes into the whiskers, which is what
stops the two reading as one hinged plate.

### The tail: measured, not built

The roadmap has "the tail is built and never rotated by anything" on the D2
spill list. It is `capyGeoBlob` scaled to **0.055 × 0.06 × 0.05** — a five-
centimetre nub — parented straight to `capySquash` with its pivot at its own
centre. Rotating it about its own centre moves nothing a camera nine metres away
can see, and giving it a pivot at the body join is a rig change, not two lines.
Left alone, and the reason recorded so it is not re-proposed.

## DEPTH — D1 (3 Sep 2026)

The first batch of `ROADMAP-DELIGHT.md`. Two numbers opened that roadmap and
this section is both of them answered.

### A shadow could only ever remove the sun's share

`qa/rv-shadow.js` is a paired A/B inside one JS turn: render the resting frame,
read the pixels, switch `sun.castShadow` off, render, read again. The fraction
of the frame that changed is how much of it is cast shadow; the mean lift where
it changed is how deep that shadow is, in levels of 255.

| chapter | frame in shadow | depth, before | depth, after |
|---|---|---|---|
| sydney | 10.9 % → 11.7 % | 29.4 | **39.6** |
| venice | 13.0 % → 23.3 % | 25.2 | **44.5** |
| sahara | 6.1 % → 9.4 % | 31.1 | **34.3** |
| kyoto (control) | 42.0 % → 43.7 % | 26.9 | **27.2** |

Twenty-nine levels on a 152-level lawn is a 19 per cent drop where the lighting
comment in `systems.js` promises 60 ("fully lit ~1.2 albedo, open shade ~0.47").
The machinery was never the problem — 2048², contact-hardened, texel-snapped.
The RATIO was, because `hemi` at 1.35, `amb` at 0.12 and the fill are unshadowed
by construction and a shadow can only take away the sun's share of the light.

**The term.** `shared.js` scales the indirect irradiance by how much sun the
fragment can see: `irradiance *= mix(1.0, uShadowSky, 1.0 - capyShadowV)`,
injected after `#include <lights_fragment_begin>` and before `lights_fragment_end`
hands it to `RE_IndirectDiffuse`. It rides the RIM's injection, because the rim
is already on essentially every opaque material in the game (`mat`, `matOwn`,
`matSelf`, and `grain`/`sway` compose on top of it) — so it reaches the whole
picture without a second program and without a second hook to forget.

**How the shadow gets out of `getShadow`.** It could not: the function returns
into an expression that multiplies the direct light and is then gone. So
`sysInstallShadowFilter` — which already owns a global override of the
`shadowmap_pars_fragment` chunk for the contact-hardening — declares
`float capyShadowV;` at the top of that chunk and writes the sun visibility into
it from both exits of its branch. The declaration is OUTSIDE the chunk's own
`#if` ladder deliberately: the ladder is about how many shadow-casting lights
there are and the declaration has to exist whether the answer is one or none.
Both halves are armed by one line — the override calls `shadeEnable()` on
success, and if three ever restructures the chunk it bails and shared.js never
injects a fragment that reads a name nothing declares.

**`sysSHADOW_SKY`** is one number per chapter: how much of the sky's light
survives where the sun does not. The default is 0.45 and five rows keep 1.0,
which is bit-for-bit the game as it was — kyoto (rain: the overcast sky IS the
light and there is no second source to occlude), the cave (no sky at all),
iceland and antarctic (flat overcast, both already near the top of the exposure
range where more darkening reads as a bruise), and the drift (above the weather,
nothing to cast onto). Four low-sun rows sit between: göreme 0.72, kowloon 0.84,
monaco 0.76, hanoi 0.74.

**The 45–60 the roadmap asked for is not reachable with this lever and the
arithmetic says so.** At 0.45 Sydney gains 10.2 levels; the whole indirect share
of that frame, measured by the same A/B, is about 15.6 levels — so even 0.0,
which would be a shadow with no sky in it at all, tops out near 45. The grade's
S-curve and the airlight sit downstream and eat the rest. What shipped is the
number where the picture reads and nothing crushes, and the ceiling is written
down here rather than chased.

**The one lever left, not taken.** `fill` is bounce light and bounce light is
the sky, but it is a `DirectionalLight` and reaches the fragment through
`RE_Direct` where its contribution cannot be told from the sun's. Moving it
into the indirect path is a shader change with nineteen chapters downstream of
it and it is not a D1-sized job.

### The boot chapter never fires `biome:enter`

Every shadow and sun constant in `systems.js` is Sydney's, so frame one has
always been right by construction — and the moment a per-chapter number arrived
that was NOT already spelled out in a constant, chapter one silently kept the
neutral one. Measured as `shade.sky` reading 1.00 in Sydney and 0.45 in all
eighteen others: the term switched off in the chapter the player sees first and
in no other. `skyOccTick` is now called once at construction beside
`sunAxes(sysSUN_DIR)`. **Any future per-chapter light state has this hole.**

### The shadow box is 44 m wide and two chapters need more

`sysBIO_SH_HALF` swaps the WIDTH in `shadowFitBiome` beside the depth, and
`shadowFitAlt` opens out from the chapter's own width rather than from the
global 22 — two separate questions that were sharing one variable, which is how
a wide chapter would have snapped back to 22 the first time the animal left the
ground. Both numbers are measured from the frame: at 34 Rio gains the near
parasol and nothing else, and only at 44 do all four ellipses and the bathers'
own shadows appear. Venice wants 34 and no more — the campanile is the caster
that matters there and it arrives at 34. The cost is texel size: 4.3 cm rather
than 2.15, about two centimetres of extra softness on a contact edge, and
`sysTexelX/Y` are recomputed from the row or the snap in `sunFollow` shimmers.

### The sky was two colours and no direction

`sysSkyPaint` read one number per vertex — normalised Y — so the sky was
identical on every bearing: no warm lobe where the sun is, no horizon band, and
in `rv-palawan.png` and `rv-rio.png` the sea and the sky arrived at the same
value and the horizon was simply gone.

Two vertex terms on the dome that already exists, no shader, no draw call,
repainted only on change:

- **LOBE**, toward the sun, on `pow(dot, 2.4) * 0.20` of the way to the sun's
  own colour — which `atmosApply` has already warmed for the time of day, so
  golden hour reddens the half of the sky the sun is in and not the other.
  Broad, not tight: the dome is 32 segments around, eleven degrees a quad, and
  anything sharper aliases into a polygon. A sun DISC needs its own geometry.
- **BAND**, the first ten degrees above the horizon lifted 24 % toward white —
  the aerial perspective the fog draws on the ground and the sky never joined
  in with.

Measured off the dome's own vertex colours (`qa/d1-sky.js`), in linear luma:
the band is +0.108 to +0.230 against mid-sky in all five chapters sampled, and
the lobe is +0.018 (venice, whose sky is already pale enough to have nowhere to
go) to +0.067 (rio, manly) at the sun's own elevation.

**`sysSkyDirty`.** The paint's call site gates on the horizon and zenith colours
having moved, and the sun's BEARING is now a third input that changes once per
chapter, inside the white of the crossing. `sunAxes` sets the flag.

**Four chapters own their sky** (`sysSKY_OWN`: sydney, drift, göreme, cave) and
none of this reaches them. Sydney is the chapter a player sees first; its dome
is `environment.js`'s and giving it the same two terms is spill, not done.

### Two harness traps this batch paid for

1. **The dome's rings sit at ten degrees of POLAR angle** — y = 1, 0.985, 0.940
   … 0.174, 0. There is nothing at all between y = 0 and y = 0.174, so a band
   sampled at "0.02 < y < 0.06" reads no vertices and reports null rather than
   nothing.
2. **A lobe has to be compared at the sun's own elevation.** Sampled in a band
   low in the sky it measures the vertical ramp instead and reports a tenth of
   the number.

## UNDER THE HOOD — P8 (3 Sep 2026)

### The comment strip, and why it is a scanner

46% of this source is whole-line comment — 3.5 MB — and the comments are the
point of the source and dead weight in the artefact, which is one file a player
downloads or opens off a memory stick.

**A slash is two things in JavaScript.** Given `/https:\/\//`, `a / b` and
`'not // a comment'`, any pattern that hunts for a double slash finds the wrong
one, and the file still parses afterwards with something missing out of the
middle of it. `strip-comments.mjs` is a four-state scanner: code, string,
template (brace-depth counted, because a substitution can contain another
template), and regex-or-division, decided the way every tokeniser decides it —
by the last significant token, with a keyword list so that `return /re/` and
`typeof /re/` are regexes.

Two deliberate conservatisms, both in the safe direction:

- **A template literal is copied out verbatim, comments and all.** Keeping a
  comment costs bytes; getting the brace depth wrong inside a substitution ends
  the template early and takes the rest of the file with it.
- **Every newline a comment contained is re-emitted**, then runs of three or
  more collapse to two. ASI needs at least one newline and never more.

**And it is guarded.** `build.mjs` parses each stripped body with `vm.Script`
before accepting it and falls back to the file's own text if it will not parse,
printing which. A bug in the stripper must cost BYTES, never correctness — the
same rule as `replaceOnce` and the dollar-apostrophe note beside it.

Which, for the record, bit again while this was being written: the script that
inserted the comment ABOUT that bug passed its replacement as a string, the
comment contained a dollar-apostrophe, and `build.mjs` was spliced into the
middle of itself and came out 526 lines long. The fix is the one already
documented in the file: pass a replacer function.

### What a player downloads

| | before | after |
|---|---|---|
| bundle | 9 245.9 KB | 5 528.8 KB |
| over the wire | 5 660 430 B | 1 331 741 B |

`server.mjs` gzips text only, only when the client asked, and always sends
`Vary: Accept-Encoding` — not optional even on a dev server, because without it
a cache in front is entitled to hand the gzipped bytes to a client that cannot
read them. Images and fonts are already compressed and are left alone.

### fps was measured on the wrong clock

`fpsAcc += dt` used the SCALED clock — the one multiplier the whole game runs
on so that a freeze is one multiplication rather than twenty-three modules
opting in. So under slow motion the accumulator crawled while the frame count
did not and fps read HIGH; under a hitstop, `dt` is zero and the next reading
was whatever a divide by nearly nothing produces.

**That number drives adaptive resolution.** The one moment the game most wanted
to shed pixels is a marquee — which is exactly when slow motion fires and when
the most is on screen — and it was the moment the game decided it had headroom.
MEASURED after the fix: 55 fps at `timeScale` 0.25, where the old expression
would have said about 212.

`< 50` and `> 58` were 60 Hz written as constants: on a 50 Hz panel the game
could never restore its resolution, and on 120 Hz a real halving to 60 read as
perfectly healthy. Fractions of the observed ceiling instead — and on 60 Hz they
come out at 50.4 and 58.2, so the common machine behaves exactly as it did.

### Ninety bodies the sanity pass was skipping

`mainSaneWorld` began `if (b.mass <= 0 || ...) continue`, and `mass <= 0` is
every kinematic body: the ferry, the lifts, the floes, the chiva, the balloon
basket, the raft. **Ninety of them in chapter one alone.** Those are the bodies
the capybara stands ON, so a NaN in one does not merely mislocate a crate — it
goes into the platform frame and comes out the other side as the animal's
position.

They get a DIFFERENT treatment from a dynamic body, and the difference is the
point: a dynamic body's position belongs to the solver and may be rolled back,
whereas a kinematic body's position is authored every frame by whichever chapter
owns it. Repair a NaN, clamp a runaway, never touch a finite position — a second
writer here would be the exact bug this function exists to prevent.

### A test that cannot fail is a report

`npm test` runs everything answerable without a browser and separates the two.
Four of the seven static audits that predate the runner print their findings and
exit 0 whatever they find. Both kinds run; only the asserting ones turn the exit
code red, and `qa/README.md` says which is which — along with which thirty of
the four thousand files in that directory are live, and that the rest are
documents rather than tests.

### Two things that had never been tested at all

1. **The built artefact.** The soak always ran against the dev server's
   unbundled source. That is a different program from `dist/`, and after a pass
   that rewrites every file on the way into the bundle it is the only one that
   matters. It runs against `dist/` now: 19/19, 0 NaN, 0 errors.
2. **The chapter picker's digit keys only work from the title card.** Every
   probe here does a fresh `page.goto` before its key, which is why nobody had
   noticed — the first run of the memory walk pressed nineteen keys in one
   session and got nineteen readings of Sydney. `hud.cross()` is the in-game
   route and goes through the crossing a player takes.

### What a full journey costs, measured at last

Nineteen chapters through the real crossing: geometries 99 → 2013, scene
objects 429 → 5776, meshes 345 → 4509, JS heap 96 → 216 MB, and returning to
chapter one releases none of it.

This is **not a leak**. `main.js` states the trade out loud: detaching sets
`visible = false` and geometry stays resident so re-entry is instant. What had
never happened is anybody taking the number.

Eviction is not built here, and the reason is specific: `mat()` caches
materials by colour ACROSS chapters, so a dispose pass has to tell a shared
material from an owned one. A pass that gets that wrong does not cost memory,
it takes out chapters that are still in use — which is why the roadmap sized it
as its own batch, with its own soak.

## THE DRAWN PAYOFF — P7 (3 Sep 2026)

### An impact is a value change, not a scale change

A prop hitting something got a squash, a thud and a camera tap, and the squash
is eight per cent of a scale on a box six metres away. The one thing that reads
at that distance is VALUE, and nothing about an impact changed the value of
anything.

**It has to be a material SWAP.** `mat()` caches one material per colour, so
every crate in a chapter shares one — writing `emissive` on it flashes all of
them. One shared flash material, swapped in and swapped back, and the prop
loses its own colour for sixty milliseconds, which at sixty milliseconds is
exactly what a flash is.

- 60 ms is three frames at 60 Hz and two at 30. That is the floor: one frame is
  a dropped-frame artefact rather than a flash. The clock is WALL time, so it is
  the same length at 30 fps and at 144.
- It restores `prop.flashWas`, not the type's colour: a prop may have been
  wetted, stained or shaded since it was built.
- It skips `InstancedMesh` outright, for the same reason as the emissive.
- Its own list, stepped from `physUpdate`, because a prop that has come to rest
  is skipped past the per-prop loop — a crate hit and settled in the same second
  would otherwise keep the flash material for ever.

### A landing needs a mark on the ground

The dust is behind the animal by the time you look at it. The ring is the thing
that says WHERE, and it is the same instanced mesh as the wheek's, so it costs
two matrix writes. It is FLATTER and FASTER than the wheek's: a pressure wave
goes out and a landing goes down.

Both scale with the fall: MEASURED ring scale 5.30 for an eleven-metre drop
against 3.55 for a step off a bench, and the dust cloud is 4 to 16 particles
rather than a flat 6. `fall` goes on the payload, because the only place that
knows how hard the arrival was is the frame that ended it — and a SKID borrows
the same event for its puff and must not borrow a forty-metre arrival's cloud
with it.

The pool went 30 to 60 because thirty was the whole game's dust: a landing, a
run scuff every stride, a dig, and Pasto's ash column all draw from it, so a
sprint into a hard landing arrived with it three quarters spent.

### A design system is how many answers the CSS gives

Not a document. `qa/p7-tokens.cjs` counts them, and before this pass one HUD
gave **thirteen** answers to "what is a corner", **twenty-six** to "what is a
shadow" and **seventy-two** to "what size is this". That is a hundred and
eleven separate decisions, and it is why a card and a button and a leaf never
quite looked related.

- **Four radii.** 2 and 3 px were the same corner; so were 4 and 5, 6 and 7,
  and 9 and 14 — nobody can see a one-pixel difference in a corner, which is
  precisely how thirteen of them accumulated. `999px` and `50%` stay: they are
  SHAPES, not radii.
- **Three shadow scales**, and they are the card's own documented recipe —
  contact, lift, room. Compound shadows carrying a focus RING keep theirs: a
  ring is not an elevation and must not be quantised with one.
- **A clamp whose floor and ceiling are the same number is a constant wearing a
  clamp.** There were five spellings of 11px and eight of them once the plain
  number was counted. Merging them changed not one rendered pixel.
- **The remaining 59 type sizes were left alone deliberately.** Every one was
  measured against a specific element at a specific viewport; P2 was an entire
  batch about this card on a phone. Rounding them onto six steps would undo
  measured work to make a number smaller.

**Verify tokens by COMPUTED style.** A malformed token does not throw: the
browser drops the whole declaration and the element silently loses its corner.
`qa/p7-css.js` reads back the computed radius and shadow of eight surfaces and
counts elements whose radius computed to empty. Zero.

### The most repeated moment in the game had never been tested

1.28 s of blank paper: every chapter change, every ferry, every line off the
departures board. The postcard in it appeared at 8%, sat perfectly still, and
left — a still image on a still ground for the exact length of time the player
has nothing else to look at, which reads as a loading screen.

It rises now, four per cent of the frame, decelerating, brightening as it goes,
with the name following half as far and a beat later — the only thing that
stops the two reading as one lump sliding up the screen.

**Two traps, both of which make the animation silently not happen:**

1. **A transition needs a start state that was laid out.** Adding `trip` and
   `rise` in the same frame sets the end state before the element has ever been
   rendered with the start state, and the transition does not run: the card
   simply appears where it was going. Two nested `requestAnimationFrame`s.
2. **The chapter picker's digit keys call `biomeGo` directly** and skip the
   crossing entirely. Every probe in this repo jumps chapters that way, which
   is why nobody had noticed. `hud.cross(biome)` exists now so it can be
   driven, and the first run of the probe sampled three and a half seconds of
   an element with no class on it and reported nothing wrong.

### Two items measured as already done

All nineteen chapters plus `environment` already pass `broad` and `broadM` to
`grain()`, tuned per place, over a shader that already runs two near octaves, a
domain warp, per-octave footprint fades and a broad octave that moves a hue
rather than a level. And paper has zero ink-coloured borders, and had zero
before. **A roadmap written before a pass shipped will ask for the pass again.**

## THE THROUGH-LINE — P6 (3 Sep 2026)

Nineteen chapters and about a hundred and thirty people, and the only thing in
the game that knew the chapters were in an ORDER was the souvenir shelf.

### An act is a boundary the geography already had

Nine chapters gained acts. Not one task moved: the lists were already sorted by
where you are, so every act boundary is a place you travel to, and the `wow`
task sits at the end of the movement that earns it. Four chapters run to two
movements rather than three — inventing a third for a chapter that has two is
how a structure stops meaning anything.

**Chapter 1 keeps its flat list on purpose.** The Pasto note has said so since
R8: the point of chapter 2 having a shape is that chapter 1 did not.

`qa/p6-static.cjs` holds the invariants, and they are worth stating because
each one is a way an act silently does nothing:

1. every declared act has at least one task in it (an empty act never becomes
   the live act, so its heading can never be seen);
2. no task points at an act its chapter does not declare;
3. no act has exactly one task (a curtain going up on one row reads as a bug);
4. the arrival row is always act 1 — it is the first thing a player reads and
   cannot be behind a movement they have not opened;
5. `open` is never act one's line.

### The open line and the act line are two lines, not one

`open` is the arrival toast, thrown 700 ms after the title card. The act kick
heads the to-do paper at the same moment. Eight chapters said the same sentence
in both places, spending two of the four or five sentences a chapter gets on
one thought. The open is now the chapter's PREMISE; the act line is the
instruction for the movement you are in.

### The note

One sentence per chapter, in the FINDS' voice — second person, past tense,
about something nobody asked you to do — on the closing card above the rule and
on the ledger leaf of a place that is FINISHED. It may not name a number,
because the numbers are on the row underneath it.

Only on a finished leaf: the note is past tense about a chapter that is over,
and putting it on a row with four tasks left would be the ledger telling the
player how a place they are still in turned out.

### Three layers of dialogue, not two

`npcLOC_SAY` is written to a rule its own comments state four times: no season,
no country, no building. That rule is correct AND it is why a Venetian, a
Hongkonger and an Antarctic diesel mechanic all said "You again." in the same
words.

`npcPLACE_SAY` is a chapter layer between a person's own lines and the neutral
pool. It is free to break the rule because it only ever plays in the chapter it
is written for. `wary` and `incident` are authored for all seventeen chapters
that have locals; the resolver `npcSay(r, kind)` is general, so any kind can be
given a chapter row later.

**`sayAudit` returns the LAYER, not just the lines.** Asserting that a Venetian
says something Venetian does not prove the chapter row was reached rather than a
neutral pool that happens to sit in front of it.

### The exception that makes the other eighteen a rule

Eighteen chapters hand you an object on the way out. The Pantanal is the one
you are FROM, and a souvenir of home is a contradiction — so `keep` is
"nothing. it was yours already." and `keepNone` suppresses the drawn object on
both the card and the leaf. The empty frame beside Sydney's hat is the point.

### The traveller

One person, in Circular Quay, Marrakech, Cappadocia and Hanoi. **A figure in
this game IS its palette** — there is no other way to be recognised at six
metres — so the palette is fixed once in `game.addTraveller` rather than copied
into four chapter files, where one of the four would eventually drift and the
joke would quietly stop working. Everything else is the chapter's: where they
stand, what they say, and which finished task gates it.

MEASURED: one instance per chapter, shirt `a8c4a2` and hat `faf6ec` in all
four, `y === terrainHeight` in all four, and the animal settles 2.2–4.1 m away
against an 8 m talking radius.

### Two audits worth keeping

- **Cross-file repeated sentences.** Caught a line said verbatim by a Rio kiosk
  man and a Marrakech snake charmer, and the ferry card writing chapter 3's
  name and subtitle out a second time three hundred lines from the only other
  place that draws them. It agreed. Nothing made it.
- **Within-file repeated sentences.** Caught five people who were given their
  own three-line pool and then filled two of the three from the chapter's
  shared array — the arrangement that makes somebody look as though they have a
  voice while guaranteeing they mostly do not.

### The line-ending trap

The nineteen chapter files are CRLF; `shared.js`, `systems.js` and `npc.js` are
LF. A multi-line anchor written with `\n` matches nothing in a CRLF file, and
that reads exactly like a stale anchor. Normalise the anchor to the file.

## FACES AND BODIES — P5 (2 Sep 2026)

Everybody in this game was a box with a nose on it, and the nose was doing the
whole job. It is there for one stated reason — without it a figure turning to
watch you is a cube rotating — and it worked, but it meant the cast could be
startled, cornered, robbed, chased off, praised, guarded against and rained on
and their expression never changed, because they had not got one.

### The face is four nodes and no per-person geometry

`npcFace(f, mood, blink)` in npc.js. `mood` runs −1 (angry) through 0 to +1
(wide); `blink` is 0..1. Everything it does is a MATRIX — a scale on the eye
pair, a rotation and a centimetre of lift on each brow — which is why one
function drives both the hand-built locals and the two instanced crowds.

**The signs are the whole thing.** A figure faces +z and `rotation.z` takes +x
toward +y. The left brow sits at x < 0, so its INNER end is its +x end and a
positive rz lifts it; the right brow is the mirror. Angry is inner-ends-DOWN,
wide is inner-ends-slightly-up with the pair raised. One sign wrong and a
furious market trader is drawn looking mildly delighted.

- **`f.upK`** exists because a local's fringe sits 1.2 cm above their brow and
  the roster's does not. Same lift, different heads.
- **Instanced crowds cost two draw calls, not five.** Both eyes are ONE
  geometry (nothing in this game winks). Both brows are one BUFFER at 2N
  instances indexed `idx*2` — the trick `pLlamaL` already uses for four legs —
  because a brow must rotate independently of its twin, and a shared geometry
  cannot do that but a shared buffer can.
- **A local is not instanced**, so every box is a draw call: the eye pair is
  one merged geometry there too, 3 meshes per person rather than 4.
- The brow is the HAIR colour, so a blond and a black-haired man read
  differently at range with no extra state.

### Mood comes from state that already existed

`npcMoodOf(rec)` for the crowds — `alarm` plus the state names; wide covers
surprise AND delight, because a tourist lining up a photograph of a capybara has
the same eyes as one who has just been barged into. For a local it is the flinch
spring, the guard that goes up when the square is hot, an errand to pick their
own crate up off the floor, and the huddle in the rain — the huddle counts as
CROSS at a third weight, and it is the one mood input in the game that has
nothing to do with the capybara.

A face comes on fast (λ 15) and goes off slowly (λ 3.2). A symmetric damp reads
as a mask being swapped rather than as a person.

MEASURED, `game.faceAudit()`: roster at rest mood 0.00 / eye 1.00 / brow 0.00
across 32; after a wheek mood 1.00 / eye 1.55 / brow −0.15; forced to `chase`
mood −1.00 / brow +0.36 with the brow 17 mm down. Venice locals: rest −0.02,
`forceHeat(1)` → −0.70 and brow +0.25, a direct flinch kick → +0.56 and eye
1.31. Pasto's thirteen reach −1.00 and +0.36 off their own state machine.
Blinks: 27 shut samples in 2 880, minimum eye scale 0.13.

### Three builds, and some of them are children

Forty-five people were forty-five copies of one skeleton at 0.93–1.08 scale: a
15 cm spread on height and NOTHING on shape. Three archetypes now, picked once,
costing a scale on nodes that already exist — plus a fourth for children.

- `bGirth` goes on `bob`, which carries torso, hips and the arm ROOTS, so a
  heavy build is a wider stance; the head divides it back out, because a wide
  man does not have a wide skull.
- `bLeg` may NOT be a second write on `legL.scale.y` — `animHuman` owns that
  line for the crouch — so it multiplies in there, and `bob` rides up with it
  or a tall-thin man has his hips inside his own waistband.
- **A child is a build, not a role.** One in seven TOURISTS. A child gardener is
  not a joke, it is a mistake. `npcCHILD_HEAD 1.22`: scaling a person down
  uniformly makes a scale model of an adult, which reads as a distant adult —
  the head is the proportion that says how old somebody is. Children are
  excluded from the harbour plunge.
- **The stride is now the person's, not the rig's.** `npcLEG_L` is a constant
  and everybody is scaled; gait frequency is derived from stride precisely so
  the feet do not ice-skate, and with four builds the constant was wrong by up
  to a third. It is defaulted (`rec.bLeg || 1`) because `paMove` also carries
  the llamas and the street dogs.

MEASURED head-above-feet in Sydney: 0.86 m to 1.47 m, arch counts [7, 9, 14, 2].

### The animal got a face too

Whiskers (three a side, deliberately oversized — a 2 mm whisker is sub-pixel at
six metres), a sniff that swells the nose pad and flicks them forward, ears that
TURN toward whatever just happened, and a gaze that finally answers "who is
speaking" and not only "who has noticed me".

- `npcSpeaker()` is published from `sayBubble` and read as gaze priority 1b.
  The grabbable branch had to be gated on `!found` — without it the entry is
  written and overwritten on the same call, which is a priority list with no
  priority in it.
- `capyHeardFrom` uses **sin(bearing)**, not the angle: it saturates at ninety
  degrees and comes back for anything behind, which is right — an ear cannot
  point further round than side-on. The gaze cannot be reused for this, because
  the gaze refuses to answer for anything behind you and that is the case an ear
  is for. MEASURED 0.40 rad at eight metres off the flank, 0.007 at forty.

### A bubble is paper

The speech bubble was the third UI dialect: a 13 px white pill, a
`sandstoneDark` hairline, bold near-black text and one soft drop shadow, beside
a to-do card that is `sail` under a warm rake and a laid texture, `sailShade` at
the edge, `ibisHead` ink, a 7 px corner and three shadows. It is now the card's
own recipe with the tail left on — the tail is what makes it speech; the pill
was never doing that job. The tail's colour is COMPUTED from the bottom of the
box's gradient (`npcCssMix`), because a rotated 10 px square cannot sample it
and a guess at solid sandstone is 34% too dark.

### What it cost

Paired A/B, eight bearings, same probe both halves:

| chapter | draw calls/frame | triangles/frame |
|---|---|---|
| Sydney | 139.3 → 147.0 | 84 160 → 85 746 |
| Venice | 116.3 → 132.3 | 151 569 → 151 802 |
| Sahara | 152.3 → 170.8 | 134 030 → 134 294 |

Scene mesh deltas are exactly predicted: 3 per hand-built local plus the six
whiskers. Median frame time sits on the 16.6 ms vsync cap both ways.

### One event that had to be rationed

`npc:startled` was emitted by the Sydney roster and nothing else, so the
ear-turn it drives was a two-chapter feature in a nineteen-chapter game. It is
now emitted from `localsReact` too — but ONCE per bang, for whoever jumped
hardest, because systems.js answers that event with a gasp, +0.06 chaos and a
2.5 s chase window, and a crate landing beside five people would have been five
simultaneous gasps and a third of the chaos bar.

It goes through `emit()`, whose payload shape is `{ npc: rec }`. The existing
`npc:chase` listener took the argument as the person and then used none of it,
so the shape was never wrong until something read it.

## THE PUNCTUATION — P4 (2 Sep 2026)

The fourth batch of `ROADMAP-POLISH.md`, and the last. Measured under
`playwright-cli` throughout, because every claim here is about a real
AudioContext on a real clock — a hand-driven tick loop never unlocks one.

### ONE BELL WAS DOING THE WORK OF SEVEN THINGS

`chime` was the payoff for a mini task, an act break, a record at par, a
personal best, a near miss, a find, an incident, a chapter finished AND the
finale, at nine pitches — and it is an AMBIENT BELL in five chapters' ladders.
So a personal best and a bell tolling over a plaza were the same sound, and
nothing about which was which could be learnt.

`musSting(kind, k)` plays a short figure built from `musCurChord` through
`musLiftNote`, exactly as the lift is: in the key of the place by construction,
on that place's own lead instrument. A record in Kyoto is a koto; in Hanoi it is
a dan bau. **No new voices** — that is the point, and it is why this cannot be
out of tune and costs nothing to carry.

| | shape | what it means |
|---|---|---|
| `record` | two notes UP | you did better |
| `act` | two notes DOWN, low and quiet | something closed |
| `done` | three notes falling to the root | the only resolve in the set |
| `keep` | a short fall, quieter | the souvenir, which was silent |
| `wear` | two notes | the costume, which was silent |

Velocities are authored at `0.115 * vel` — **the lift's own note velocity**, not
against these envelopes alone. That is the mistake R9 made with six ambient
voices, which were written five to ten times too loud because each was judged by
itself rather than against the table it was joining.

`chime` keeps the find, the mini, the incident, the near miss, the finale and
every ambient bell. Every sting falls back to the old chime if there is no chord
sounding, so a muted or not-yet-started score sounds exactly as it did.

### FOUR PAYOFFS WERE SILENT

The souvenir card (nineteen of them in a journey, each arriving with a picture
and no sound), the costume grant (the animal simply WAS wearing one on the next
frame), the chase onset, and beating your own ghost.

The chase is the interesting one. It only ever moved `musChaseT`, which feeds
`musIntensity`, which the pad and the filter follow over SECONDS — so the score
got tenser some time after a chase began and nothing marked the moment. It is
now a term in the ONE expression that writes `musBassGain`, decayed on the raw
clock. Not a second writer: that gain runs on a 1.5 s constant and a pulse
written separately would be dragged back before it was heard.

Beating your ghost is the `record` figure a shade quieter. It is the same KIND
of event as reaching par and must not need telling apart.

### THE BAND DID NOT NOTICE THE PAUSE CARD

`pauseShow` sets `paused`, which gates the sfx and floors the weather bed — and
`musTick` is gated only on `ac.state`, so the pad, the bands and the lift ran at
full level behind a stopped game. Silence everywhere except a salsa band at full
tilt reads as a music menu rather than as a pause.

Measured off the graph, not off the flags: music filter **20000 → 1102 → 20000
Hz**, duck gain **1 → 0.34 → 1.0**.

### THERE WAS NO UNDERWATER STATE AT ALL

Palawan's marquee is "be UNDER when the water lights up", the dive has been a
property of every body of water since v19, and going under changed the picture,
the camera and the controls and left the sound exactly where it was.

One low-pass between `acSfxBus` and the master catches the dry sounds, the
room's wet return, the ambient bed and the weather voices in one place. The
score gets its own, taken LESS far down — it is not diegetic, nobody in the
lagoon is playing it, and pulling it as far under as the splashes reads as a
fault rather than as a place. The room send rises too, because water makes a
space longer as well as duller.

Measured, diving in Palawan: `sub` 0 → 1, world **20000 → 620 Hz**, score
**20000 → 1400 Hz**, room send **0.05 → 0.27**, and all three back on surfacing.

Driven by `max(subT, capy.diving)` — the LENS under the surface (which is what
the picture is graded on, and is null in chapters with no `sysSUB` row) and the
VERB. A dive in a chapter with no underwater grade still has to sound like one.

### AND A ROOM IS NOT ALWAYS A CHAPTER

`sysROOMS` was keyed by biome, so San Marco's basilica, the casino salon and the
deep end of Son Doong all played in their chapter's OUTDOOR room — the three
spaces in the game that most obviously are not one, and two of them have a
comment in that very table saying the chapter has two rooms in it.

A biome may publish `room()` returning a key into `sysROOMS`; anything that is
not a row falls back to the chapter, so a typo cannot invent a space. Three
authored: `basilica` (enormous and soft — gold mosaic over brick swallows the
top end), `salon` (the quietest send in the game, because a casino is built so
nobody hears the next table) and `deepcave` (past the wall the daylight and the
vegetation stop).

Measured: venice `venice 0.199 → basilica 0.338`, cave `cave 0.417 → deepcave
0.515`, monaco `monaco 0.189 → salon 0.030`.

### TWO NEW AUDITS, AND WHY

`hud.mixAudit()` reads the four AudioParams off the graph — a probe that asserts
on `pauseShown` or `capy.diving` proves the game knows what is happening and not
that anything reached the sound. `hud.stingAudit(kind)` fires one figure and
reports how many notes it asked for; with the AudioContext prototype patched to
count node creations, that is the only thing about a Web Audio figure observable
from outside. All five build real graphs.

### THREE PROBE DEFECTS

**A picker key is a one-based index and it is easy to get wrong** — trap 15, and
it bit twice in one run: `Comma` is Antarctica and `Period` is Monte Carlo, so
the Monaco and cave room tests measured the wrong chapters entirely. The only
reason it was caught is that `roomAudit` reports the room KEY, which read
`antarctic` under a heading that said monaco.

**The casino floor is at y 28.** Teleporting to a point that had just passed
`inZone('casino')` at ground height dropped the animal into the harbour, so the
zone test that had passed at search time was false on arrival.

**And a search box has to contain the thing.** `monCASINO` sits at x 118; the
first sweep looked between −80 and 80 and reported no zone at all.

## THE CHASE — P3 (2 Sep 2026)

The third batch of `ROADMAP-POLISH.md`. Every system in this section already
existed and was invisible.

### SIXTY TASKS ARE MEASURED AND THE PAPER NEVER SAID WHICH

The record board only appears once a chapter is FINISHED, so for the whole of a
first pass through every chapter a player could not tell which of its tasks were
races — and by the time they could, the cheap first attempt was spent.

- **A glyph on the row.** `capyui-meas` on any task with a `RECORDS` entry.
  Cross-checked statically (`qa/p3-glyph.mjs`): 231 tasks, 60 timed, 60 RECORDS
  rows, **0 keys that are not task ids**.
- **The par on the clue**, via `todoParLine`. Three sentences, because there are
  three cases: never raced and there is a par ("timed · a good one is 32.0 s"),
  raced ("your best 29.4 s · a good one is 32.0 s"), and measured with no par at
  all — which is thirteen of the sixty, and a silent row there would make the
  glyph a promise the paper does not keep.
- The clue needed `white-space:pre-line` and a taller clamp. Without the first
  the newline collapses and the par runs into the end of the clue as one
  sentence; without the second a clue that already wrapped clipped the par off
  under `overflow:hidden` — the same fault the record board had before v51, and
  invisible unless you read the rendered element rather than its textContent.
- **The picker's record line came out from behind the 100 % guard.** The
  argument for that guard holds for the SOUVENIR — a thing you get for finishing
  — and not for a number the player has already set in a chapter they are
  halfway through. The picker is the only screen where sixteen places are
  compared side by side.

### NINE TASKS WAIT ON A CLOCK NOBODY COULD SEE — `nextIn`

The whale every 54 s, the train every 96, the bloom every 124, the Symphony
every 152, the sunrise every 156, the tide every 205. Cappadocia's own comment
calls its eleven-second window "cruel to anyone still on the ground" and the
paper never said how long the ground was going to last.

A biome may publish `nextIn(taskId)`: seconds until the window opens, 0 while it
is OPEN, -1 for "not a clock" — the same optional-hook shape as `camFloor` and
`localWater`, so a chapter with no opinion costs one failed lookup. Wired in six
chapters. Rendered as "next in 40 s" on the clue, rounded to whole seconds so
the element is rewritten once a second rather than four times.

Measured live: iceland 8.8 s, hanoi 23.6, palawan 40.7, goreme 58.9, kowloon
68.6, venice 86.0, all returning -1 for an id they do not own; and on the paper,
"next in 6 s" became "next in 2 s" four seconds later.

Iceland's is the interesting one: `iceWhaleT` counts down FASTER within
`iceWHALE_CALL_R` of the pier head, so the number gets shorter when the player
does the thing the chapter wants. That is the whole reason to show it.

### THE ONLY REPEATABLE REWARD WAS NEVER COUNTED

Three witnessed things in one place is AN INCIDENT, five is A SCENE. It produced
a card, a chime and confetti and then forgot: nothing counted it, nothing saved
it, nothing showed it again. `jrChapInc` and `jrChapScene` are per chapter,
additive on the save exactly like `chapms`, `finds`, `fin` and `slid`, and the
version does not move for them. Counted at the line that decides a card is owed,
not at the top of the function — the chain counts every witnessed thing, and
what a player would call an incident is the moment it pays out.

Verified by causing one: 21 people within 16 m, eight props dropped on the
forecourt, `inc {"1":1}` and `scn {"1":1}` on the file, and both still there
after a reload.

### DONE HERE IS A SCORE CARD

Four facts that were all on the file and shown nowhere: how long the chapter took
(`jrChapMs`, saved since v18 and read only by the ledger), how many of its
measured rows carry a figure, how many beat their par, and the incidents and
scenes caused in it. Above the rows, because it is the summary of them.
Photographed at Circular Quay: `0:08 here · 0 of 3 timed`.

Record rows that have a ghost stored now carry `⟲`. A ghost is replayed when the
attempt reopens and nothing said which rows had one, so the feature that makes a
number worth going back for was discoverable only by going back.

### AND FOUR SMALLER THINGS

- **`sysGHOST_KEEP` 8 -> 24.** Eight, against sixty measured rows: a
  completionist's Kyoto ghost was evicted around Iceland, silently, by the act
  of playing the chapters in between. 24 is what the store can afford — a long
  run is ~36 KB of JSON, so under a megabyte worst case against a 5 MB budget.
- **Hanoi's fold was a rising edge.** `was < 0.5 && hanFoldK >= 0.5 && inAlley`,
  on a value damped at 1.4/s, once every 96 s: walk in two seconds after the horn
  and nothing ticks for a minute and a half, with no way to know that. It is a
  STATE now — being in the alley at any point while the street is shut. Exactly
  the shape kowloon.js removed from the Symphony. Verified: the train arrives
  while the animal is 90 m away, it walks in three seconds late, and it ticks.
- **The condor's wingbeat is taught.** `wantFlap` reads `input.honkPressed` and
  the comment beside it says THE PLAYER PRESSES IT; nothing ever told them. Said
  on the second beat after 'hold on', through the new `game.say` so a pad reads
  B and a phone reads WHEEK — the first line outside systems.js to name a
  control. R6 measured what it is worth: not the difference between failing and
  clearing, but between one ride and two.
- **Pasto said GALERAS twice, three seconds apart.** `condor-ride` carries
  `wow: 'GALERAS'` and act three opens with `kick: 'GALERAS'`, and the act
  curtain fires 2.9 s after a tick while the place card is up for 3.6 s.
  `showPlaceLast` is what the curtain checks.

## THE PAD AND THE CARD — P2 (2 Sep 2026)

The second batch of `ROADMAP-POLISH.md`. Measured with a synthetic pad
(`qa/p2-pad.js` installs one over `navigator.getGamepads`), because a controller
is the one input surface a headless run cannot otherwise reach.

### A PAD COULD OPEN EVERY CARD AND OPERATE NONE

Measured before any of this existed. Three wheeks at the wharf raise the
departures board and the world pauses behind it — and then **all seventeen
buttons and both sticks in eight directions leave it exactly where it is**.
Start does not close it; it stacks the pause card ON TOP. On the pause card,
focus never left `resume`: the d-pad did nothing, A pressed nothing, the three
faders read 100/100/100 throughout, and B closed nothing.

That is R5's touch trap with a pad in place of a thumb, and worse: the board
pauses the world, so the only exits were to travel somewhere nobody asked to go
or to reload a three-hour game.

`sysPadCard(g, dt)` drives the DOM rather than reimplementing four menus —
d-pad walks `focus()`, A `click()`s the focused control, B is Escape, left/right
step a focused fader, and Start on a card means what B means. It runs BEFORE the
verbs and the camera and returns early, because A is both `hop` and `press this`
and the d-pad is both `walk` and `move down the list`. After: the board closes on
B, its rows walk, and A travels.

**Three bugs found while building it, all in the driver:**

1. **The button that opens a card is still down on the next frame.** A wheek is
   130 ms and a frame is 16, so a zeroed edge state reads the tail of the
   opening press as a fresh one — the board opened on the third wheek and closed
   itself on the very next frame, which looks exactly like three wheeks no
   longer working. The state is seeded from what is held, so every button must
   be RELEASED before the driver acts on it.
2. **`button:not([disabled])` matches a button whatever its tabIndex.** The
   journal sets `tabIndex = -1` on all nineteen souvenir slots, with a comment
   saying why. The pad walked the shelf: four presses of d-pad down on the
   departures board moved between souvenirs and never reached a destination.
   The rule the feature is built on is that the pad reaches exactly what the
   keyboard reaches, so the filter reads `el.tabIndex < 0`.
3. **The quit question is a card inside a card.** While it is up the four
   buttons behind it are still visible and focusable, so a list taken over the
   whole pause card walks out of the question onto `resume` — measured, one
   press down from "stay here" landed on a volume slider. `sysPadTopCard`
   returns `pauseAsk` when it is open, which is the order Escape already uses.

### THE SLIDE WAS CTRL, AND CTRL+W CLOSES THE TAB

Not "opens a dialog the page can cancel": Chrome and Firefox both reserve
Ctrl+W and a page cannot `preventDefault` it. The chord fires whenever W is
pressed while Ctrl is already down, which is precisely "hold slide, then push
forward" — and the game's own teaching line said to do exactly that. A
three-hour journey, gone, with no confirm.

**Slide is `G`.** Ctrl is not kept as an alias, because there is no safe way to
keep it and an unreleased game has no muscle memory to protect. G because every
alternative is taken by something it would be worse to move: C is the camera
recentre (documented, and four probes press it), X and Z turn the camera, V
raises the eye, F re-aims, R is the rescue. One stretch of the index finger from
WASD, and no browser chord in any engine.

### A THIRD VOCABULARY — `sysPAD_WORDS`

The touch table exists because telling a phone to press E is the most confusing
thing a hint can do. A pad player was in the same position: with a controller in
both hands the first four Sydney clues read `press Q, anywhere`, `grab it off
their head with E`, `hold Shift and barge them`, `hold E on the soil to dig`.
Names are the FACE LABELS, not the W3C button numbers. Touch wins over pad — a
phone with a controller paired to it is still a phone, and the buttons the
player can SEE are the ones the sentence should name.

Checked statically the way R5's table was (`qa/p2-clues.mjs`): **191 clue
literals, 39 rewritten, and zero clues contain any other lone capital**, so the
bare-letter rules cannot eat prose. Adding `G` changed no count, because no clue
names the slide — the only teaching line for it is a toast.

The connect toast named three of nine bindings, had no slide, no run, no pause
and no way back to the paper, and fired only on `gamepadconnected` — which
browsers do not dispatch for a pad that was already plugged in at load, so a
player who started the game pad-in-hand was told nothing at all. `padSayHello()`
is said from whichever of the two happens first, once per session.

**BACK is a tap and a hold.** The tap hides the paper as it always has; the hold
is the stuck-rescue, which the pad could not reach at all — R5 found the
identical hole on touch. Resolved on RELEASE so the two cannot both fire.
Measured: held, the animal moves 21.9 m back; tapped, the paper still toggles.

### TAB STAYS IN THE CARD — `sysFocusWrap`

The pause card's own comment said `inert` on the rest of the HUD kept the walk
inside it, and **nothing ever set that**. Measured, fourteen presses of Tab:
four buttons, then BODY, then round again — the walk left the card on every
cycle. `aria-modal` was declared on all four cards and the DOM does not honour
it. One wrap, used by all four, sharing the pad's focusable list so the two
schemes cannot disagree about what is reachable. It ALWAYS cancels the browser's
own walk and does the whole move itself: the half-and-half version is wrong for
the ledger and album, which preventDefault first for other reasons and would
leave focus pinned. After: **0 of 12 presses leave the card.**

### THE CALM SWITCH REACHES THE FREEZE

`main.js` read `prefers-reduced-motion` once at boot into a private `calm`, and
`hitstop`/`slowmo` gated on that — so R4's "less motion" switch moved the shake
and the FOV kick and left the two things that stop time altogether. Both now
call `calmOn()`, the one channel. `padRumble` does too: a player who asks for
less motion is not asking to keep the thing that shakes in their hands. And
`calmSys` was a const read once, so an OS change mid-session did nothing —
`matchMedia`'s `change` event now keeps it live.

Measured end to end, driving the card's own checkbox: calm off, a freeze applies
`scale` **0.08**; calm on, it stays **1**.

**The freeze cannot be read while the card is open**, because the card pauses
the world and a paused world runs no time step — the first cut of that
measurement read `scale` 120 ms into a 350 ms hitstop with the settings still up
and got 1.0 both ways, which reads exactly like a freeze that never fires.

### AND THE CEREMONY STOPPED NAMING A KEY NOBODY HAS

`no picture of X yet · K, then Enter` was unconditional. The touch layer has no
camera button and calls `photoSet` from nowhere, and a pad has no camera either
— so the game finished a chapter by asking for a key that does not exist. Said
only to the scheme that has one.

## THE SUBJECT — P1 (2 Sep 2026)

The first batch of `ROADMAP-POLISH.md`. Everything here is one measurement:
render the frame, hide the capybara, render again, count the pixels that
changed. That is how much of the animal you can see, with nothing classified;
the mean luma of those pixels against what replaced them is the silhouette
contrast. `qa/p1-see.js`.

### A RAISE IS AN ANGLE, NOT A HEIGHT — `sysLOOK_RAISE` (load-bearing)

The occlusion ray shortens the boom and moves nothing else, so the eye came in
while the look target stayed 0.6–1.6 m above the animal's feet — and the closer
the eye gets, the larger that offset is in degrees. Measured at 21 stations, as
how far below centre the animal sits:

| boom cut to | animal at | |
|---|---|---|
| 1.00 | −0.21 | sixteen chapters; the frame the rig was designed for |
| 0.54 | −0.39 | Manly |
| 0.26 | −0.78 | Antarctica, on the edge of the picture |
| 0.16 | **−1.40** | under a Norfolk pine: off screen, **0 px of capybara** |

`sysLook.y`'s raise is now multiplied by `camClearF`. Holding raise/distance
constant holds the composition; at `clear = 1` the line is arithmetically what
it was, and the sixteen unaffected chapters are unchanged to two decimals.
Under the pine: **0 px → 57,412 px**, −1.40 → +0.07. It reads LAST frame's
`camClearF` on purpose — already damped, eases outward only, and it means the
target and the eye are cut by the same number on the same frame.

`camClearF` is also reset in `teleportCapy`: it only ever eases outward, so a
chapter left from somewhere tight handed its cut to the next one's arrival.

### THE ANIMAL'S OWN RIM — `matSelf`, `sysSELF`

`matSelf` binds the capybara's six body materials to their own rim uniforms.
Same source, same `customProgramCacheKey`, so it is the same program every wall
in the chapter already uses — the animal does not gain a rim, it stops sharing
the scenery's. The nose pad and the eyes stay on `mat()`; they are never on the
outline.

**A RIM IS LIGHT, AND THAT DECIDES THE WHOLE TABLE.** It separates the animal
from a background she is brighter than and closes the gap on one she is darker
than. Paired A/B (`game.state.noSelfRim`, both reads in one frame), and the sign
of the change is the sign of the contrast in all nineteen:

| animal brighter — gained | animal darker — lost |
|---|---|
| antarctic +9.2 · drift +8.9 · pantanal +8.3 | venice −4.2 · sydney −4.1 · hanoi −3.2 |
| iceland +8.1 · cave +6.6 · kowloon +4.6 | sahara −2.9 · pasto −2.8 · quay −2.5 |
| cali +1.3 · monaco +0.8 | palawan −2.3 · goreme −2.0 · rio −1.3 |

`sysSELF` is that measurement. Eight chapters keep a lift that held across TWO
paired runs; the other eleven carry `sysRIM`'s own number, which is what they
had before. Kyoto is among them because it returned +0.5 then −2.7 at the same
strength — a number that changes sign between two runs is a number nobody
measured. What the darker-animal chapters want is a DARKER edge, which is a
contact-occlusion term and not this one with a minus sign on it.

### PEOPLE ARE NOT WALLS — `sysCamRayHit`

The block above that function has claimed "static geometry only" since it was
written and it was never true: a walker is a mass-0 KINEMATIC box
(`userData.npc`) and a stallholder is a mass-0 STATIC one (`userData.local`),
and both fell through to the shape test. It now keeps the same ignore list
`capyClimbRayHit` does, plus every kinematic body that is not the deck underfoot
(traffic: Hanoi's train, Monaco's cars, Rio's trams, Venice's boats).

**Measured, and it bought nothing**: four crowd stations, 25 s standing still,
10–32 people, `clear` 1.000 before and after with zero dips. The boom sits ~8 m
up and 12 m back and passes over people's heads. Kept as a contract alignment,
recorded as a no-op.

### THE CANOPY DISSOLVE WAS BUILT AND REMOVED

A cone from the lens to the animal, dithered discard injected in `leaf()` so it
reached every plant in the game through the one material they share. It worked.
It bought nothing: paired on/off in one session, 24 yaws at each of four
stations plus 30 legs of a walk through the Sydney grove — **84,479 px of
capybara with it off, 84,627 with it on**, as many yaws worse as better, and the
animal never once badly hidden. The frame that motivated it was the look raise
above, not the leaves. `material.userData.capyLeaf` survives because
`hud.canopyAudit()` walks for it.

**If anybody rebuilds it: a zero-width ray is the wrong detector for a volume.**
`canopyAudit`'s raycast reported "nothing in the way" in 17 Göreme frames where
the dissolve was plainly changing the picture, because the cone is 1.7 m across.
Measure the paired pixel count.

### THE SCORE MAY NOT SCHEDULE THE PAST — `musFeel`

Found by P1's sweep on the unmodified tree, in two chapters at two voices:
`RangeError: setValueAtTime … Time must be a finite non-negative number:
-0.000127775`. That is the size of `musFeel`'s own jitter. `musStart` calls
`musTick()` synchronously on the line that builds the graph, `ac.currentTime` is
still exactly 0 there, the re-anchor guard is `musBarAt < now` so `0 < 0` leaves
the anchor at zero, and half the first bar's notes land before the origin.
Whether it throws is a coin toss per note — which is why nineteen chapters of
R10 soak reported a clean console: that run read `state.lastError` and console
messages, and an uncaught RangeError out of a `setInterval` callback is neither.
`musFeel` clamps to `ac.currentTime`: one place, six band schedulers, every
voice in the file.

### THE VEIL, MEASURED AND LEFT ALONE

Full-frame luma, centre crop, ranked by lifted blacks (`p05`): venice 133,
sydney 118, palawan 117, sahara 117 … monaco 59, kowloon 58, **kyoto 57**,
drift 54, iceland 48. Venice and Marrakech do sit high; Kyoto, which the review
called milky from a screenshot, has among the deepest blacks in the game. The
range is continuous from 48 to 133 with no gap to cut a class along, and the
narrowest two (the Drift and the cave, both span90 44) are night chapters that
are meant to be narrow. Not acted on.

### AUDIT

`hud.canopyAudit()` — foliage registered in the live chapter, what is on the
eye-to-animal ray, `cutInfo`-style rim strengths for both rims, and how many of
the animal's meshes actually bound to its own rim (a hook that silently fails to
bind still draws a perfectly good capybara with no rim at all). Nothing in `src`
reads it.

**TWO RUNS OF THIS GAME ARE NOT COMPARABLE.** People, props and carriers are not
in the same places twice, and cross-run silhouette-contrast differences of ±20
levels are ordinary. Every verdict in this section is a paired A/B inside one
session, toggling the term between two reads of the same pixels.

## THE FRONT DOOR (v52 — 31 Aug 2026)

Fifty-one versions of content, picture, feel and audio, and **the review that
produced this section could not find anything wrong with the game.** Nineteen
chapters entered through the picker, driven for nine seconds each, seventy
frames sampled: zero console errors, zero NaN positions, zero solver saves,
16.5–17.0 ms median everywhere. So this version is not about the game. It is
about the three ways it could not be given to anybody, all measured rather than
guessed, and all of which ended in **the same permanent `warming up the
harbour…` splash**.

**1. THE TWO LIBRARIES ARE IN THE REPOSITORY NOW (`vendor/`).** They were
resolved through an importmap pointing at jsdelivr. Block that host and the game
does not start — with no error, no message and nothing to click, because a
module script whose bare specifier will not resolve never reaches
`window.onerror` with anything readable. An ad-blocker, an office or school
proxy, a laptop away from a signal or ten minutes of CDN trouble all produce it.
`vendor/README.md` carries versions, source URLs, SHA-256s and both MIT notices.

**2. `dist/` IS NOW WHAT ITS OWN BUILD HEADER HAS ALWAYS SAID IT WAS.**
`build.mjs` described its output as "a single self-contained HTML file that runs
straight from `file://` with no server" and it was neither — it inlined 7.5 MB
of game and left `import * as THREE from 'three'` pointing at the network. It
inlines both libraries now, **each in its own IIFE**, which is not tidiness:
three.js and cannon-es both declare a top-level `Material` (and `Quaternion`,
`Shape`, `Plane`, `Sphere`), so a flat concatenation collides immediately. The
build re-checks that each file is import-free, `import.meta`-free, has exactly
one trailing `export { … };` and uses no `as` aliases before wrapping it, and
refuses to emit a bundle that still names a CDN.

**AND THE TRAP THAT COST THE MOST: `String.replace(pattern, string)` INTERPRETS
`$&`, `` $` `` AND `$'` IN THE REPLACEMENT.** three.js contains a `$'`. The
bundle therefore had "everything after the match" — `</script></body></html>` —
spliced into the middle of a string literal 1.2 MB in. It was the right sort of
size, it looked fine, and it died with `SyntaxError: Invalid or unexpected
token`. **A replacer function is passed the match instead of scanning for `$`
and has no such behaviour**; both `replace` calls in `build.mjs` are functions
now, including the one inserting fixed text, so the next person to edit it does
not have to know this. The latent bug was always there — the game's own source
simply never happened to contain a `$` sequence.

**3. A FAILURE CARD, IN THE GAME'S OWN PALETTE, THAT SAYS WHICH FAILURE IT WAS**
(`index.html`). No WebGL, nothing loaded, or a throw during boot — each gets its
own words, its own list of things to try, and a reload button. Two rules make it
work:

- **The pre-flight probe asks for EXACTLY the two contexts three.js asks for, in
  its order** (`webgl2` then `webgl`). It used to fall back to
  `experimental-webgl`, which some browsers answer when they will not answer
  `webgl`, so the probe passed, the renderer failed on its own request, and the
  player got the generic card instead of the one naming the cause. *A capability
  check that is more generous than the thing it is checking for is worse than no
  check at all.*
- **The watchdog is called off by a FRAME, not by a module.** `window.__capy` is
  assigned in the first ten lines of `mainBoot`, so clearing on that would call
  it off before any of the twenty-three modules had run. `main.js` sets
  `window.__capyRunning` after two `requestAnimationFrame`s.

The `#boot` card is **hidden and never removed** now. It used to be removed
700 ms after the first frame, which was fine while the only thing it could say
was "warming up the harbour…"; it is now the one place in the game that can talk
to a player in plain words, and the most likely such moment happens hours in.

**4. A LOST GL CONTEXT HAD NEVER BEEN LISTENED FOR ANYWHERE IN THE TREE**
(`main.js`). It happens on a driver reset, on a laptop waking from sleep, when
another tab takes the memory, and on Windows whenever the GPU is preempted for
more than about two seconds. The result was a black rectangle with the HUD still
drawn over it and every key still answering — the worst kind of failure, because
it looks like the game is fine and the player is doing something wrong.
`webglcontextlost` **must** `preventDefault()`, or the browser will not even try
to give the context back; `game.tick` returns early while it is gone, because
stepping the world behind that card would hand the player back a capybara
somewhere else.

**5. TOUCH WAS ABOUT 60 % OF A CONTROL SCHEME** (`systems.js`). The plumbing was
never the problem — the fan, the phone CSS, the safe-area insets and the gamepad
map are all thought through. The problem was that a phone player was *shown* a
scheme they did not have:

- The title legend listed seven keyboard keys, every one naming something a
  phone does not have. `sysLEGEND_TOUCH` is chosen by `sysIsTouch()`, which is
  the same media query the touch layer itself switches on — so the legend and
  the buttons cannot disagree about which scheme the player has.
- **Thirty-nine of the 191 hint clues name a key** (`press E at the fire`, `hold
  Shift and barge them`). `sysSay()` rewrites them at the two places a clue is
  resolved — **before** the `clue !== clueEl.textContent` comparison, or the
  rewritten text is never equal and it rewrites four times a second. Checked
  against all 191 strings first: 39 rewrite, 152 untouched, no lone capital
  survives. That test is why the bare `\bE\b` and `\bQ\b` rules are safe here
  and would not be safe on arbitrary prose.
- **The slide** got a fourth button in the fan. **The stuck-rescue got a fifth,
  and deliberately not in the fan** — it is a rescue, not a verb, so it is
  smaller, dashed, quieter, and parked under the chart in the top right where no
  thumb arrives by accident. It went bottom-left first, which is wrong twice
  over: that is inside `.capyui-zone`, so it eats the corner a thumb rests the
  stick on, and it puts a rescue in among the controls. Measured: held 1.4 s it
  puts the animal 14.5 m back, on its feet. `R` exists precisely so a three-hour
  game has no state whose only answer is F5, and on a phone it had one anyway.
- **Pinch to zoom.** The camera distance was the wheel and the pad's right stick
  and nothing else. Writing the touch legend advertised a pinch, which made the
  legend a lie the moment it was written — so it was implemented rather than
  retracted. Two fingers zoom and do not also turn; the second finger is *not*
  pointer-captured, because capture routes every later event for that id to one
  element. Touch drags now take their delta from the last client position:
  **`movementX` is a mouse concept and is not reliably filled in for touch
  pointers.** Both handlers clear on `blur` and on `visibilitychange`, because
  an interrupted pinch never gets its `pointerup`s.

**AND ONE MEASUREMENT THAT IS NOT A FINDING.** Render cost is entirely
resolution-bound — 1.96 ms at 1280×720, 8.12 ms at 2560×1440, **17.4 ms at
3200×1800**, i.e. past the budget. That is fine, because the adaptive scaler
already existed and is correct (`sysMaxDPR()` scales the ceiling by pixel count;
a 2 s sampler walks the render scale down to 0.7 below 50 fps). It is
load-bearing on any high-DPI display and should not be removed. The first probe
written for this pass reported `hasQualityApi: false` and it was **the probe
that was wrong**, not the game — the fourth time in this project's history that
a review's opening instrument has lied about a feature that was already built.

What is left, and why the rest of it is not in this file: see `ROADMAP.md`. The
short version is that the one remaining hard blocker is a `LICENSE`, and that is
not a technical decision.

## THE REMAINDER (v53 — 31 Aug 2026)

v51 closed with a list of what it had not done. This is that list, and four of
the six items turned out to be defects in v51 itself or in the code it touched.

### 1. THE ENCORE SWEEP, AND THE PATHOLOGY IS RARE

v51 fixed two one-shot set pieces in Kyoto and left the other seventeen
chapters unswept. **Swept now: 110 `xDone` latches across nineteen files.** The
result is the good one — most of them are switches (sit on a cat, steal a
tart) where one-shot is correct, and of the rest almost all put their feedback
and their measurement ABOVE the guard, so only the tick is suppressed:

| | |
|---|---|
| `condorPeakDone` | `recordLive('thermal-peak')` is above the guard — the altitude keeps being measured |
| `gorHerdDone` | `gorMareCarry` is above it — you can still ride the mare |
| `venTragDone` | the arrival thud is above it — the traghetto keeps running |
| `hkClimbDone` | `hkClimbBest` is a continuously tracked peak, outside the latch |

**The dangerous shape is a `Done` guard that early-returns out of the whole
function**, and there were three left. Two are fixed here; the third
(`rioCalcDone`) is a discipline test with no number in it and is left alone
deliberately.

- **`caliCaneDone`** — a hundred and six metres of sugarcane, wrapped in
  `if (!caliCaneDone) { ... }`. Cali was the OTHER chapter that measured dead
  in v51's free-play soak, and this was its only measurable set piece. Re-arms,
  and carries **`cane-run`** — *the cane in*, par **8 s** against a measured
  machine floor of **6.5**.
- **`kyoDryDone`** — and this one switched off more than the torii did. The
  guard killed the six rising water-notes, the arming, and **the heron**, which
  holds its ground however close you get *only while an attempt is alive*. Tick
  the crossing once and the best-behaved animal in the garden went back to
  flushing at ten metres, and six stepping stones a hop apart stopped being a
  skill test. **The second half of it was in `kyoDryCrossing()` itself**, which
  returned `kyoDryArmed && !kyoDryDone` — so fixing the update function alone
  would have left the bird broken. Now `kyoDryArmed` alone, which is the honest
  question. Verified: **6 stone notes on run 1 and 6 on run 2**, task ticks once.

No chapter now has fewer than two repeatable numbers in it. Kyoto went 1 → 3
and Cali 2 → 3; the floor across all nineteen moved from one to two.

### 2. CAUSATION TRAVELS ONE HOP — `physCarriesCause` (props.js)

Knocking a bin into a crate is the oldest joke in this genre and the crate was
not, by this file's reckoning, anything to do with you: `disturbed` was stamped
only where the capybara itself touched. Measured over 75 s of driven play in
Sydney: **nineteen impacts over `sysINC_HIT`, and two of them on a prop with
`disturbed` set** — so the incident chain, which needs three witnessed things
inside twelve seconds, essentially could not start.

**THE CLOCK IS THE WHOLE SAFETY ARGUMENT.** The struck prop inherits the
striker's `lastCapyTouch` rather than taking the current time, so causation
decays from the moment the animal actually did something and **cannot be renewed
by propagation**. A daisy-chain across six crates is still measured against the
one shove that started it. That is what keeps `physCausedByCapy` — the gate
every `completeTask` in props.js goes through — from becoming looser than it
reads.

Unit-tested both ways, and the random-walk probe was abandoned for it: a fresh
shove (0.2 s) propagates and the struck prop's inherited clock reads 1.7 s old
rather than 0; a stale one (5 s, over `physCAUSE_TIP`) propagates nothing.
**The soak that first found this cannot verify it** — it depends entirely on
where a random walker happens to go, and re-running it gave 48 impacts and zero
disturbed, which is noise, not a result. Same family as trap 18 in the harness
note: a probe is part of the experiment.

### 3. ONE SHORT ON A COUNT IS THE NEAREST MISS THERE IS (systems.js)

v51's near miss used a proportional band with an absolute floor —
`max(0.35, best × 0.07)` — which is right for a clock and silently wrong for a
tally. `yacht-race` is *threaded N of the six*: best 5, run 4, gap 1, band 0.35,
**silent**. The most motivating outcome that row has, and it said nothing.

`dp: 0` is the question — a row with no decimal place is counting whole things —
so the band now floors at 1 for those. For the eleven rows that are distances
rounded to the metre it changes nothing: a gap of one metre out of ninety is
already inside seven per cent.

**v51's own test missed this because its only count case beat the best instead
of missing it**, so the branch was never reached. Same run also finally
exercised the stale-watchdog close, which v51 left untested for the same
reason — its `staleClose` figure was *lower* on a lower-is-better row, i.e. a
win. Four cases now, all measured:

```
so close  ·  1.2 s off your best     (watchdog close, lower-better)
(silent)                             (too far)
so close  ·  1 off your best         (count — no "1 of the six off")
so close  ·  0.7 m off your best     (metres keep their unit)
```

### 4. THE BOARD IS ANNOUNCED, BUT ONLY AS A BOARD (systems.js)

The record board is an async update — it arrives on the frame a chapter is
finished and nothing else says so — which is the one case in this HUD that has
a live region everywhere else (the toasts carry `role="status"`, the journal's
shelf caption `aria-live="polite"`). It could not simply BE one: as an ordinary
clue this element is rewritten four times a second by the hint tick, and a live
region on that reads a sentence about a doorway over and over for the length of
a chapter.

**So the region is the class.** `aria-live` goes on with `recs` and off with it,
and the hint tick already skips the element while `recs` is set (v51), so the
text under it is stable — at most one announcement per chapter, which is the
number of times a chapter can be finished.

Measured while there: the board does NOT clip at any viewport. Monte Carlo's
seven lines are 131 px against a 176 px cap at 1280, and 114 against 136 at 320
— the clamp and the font shrink together. The `transition: max-height` under it
is not compositor-friendly and is pre-existing; it is left alone because
`prefers-reduced-motion` already crushes it to 0.01 ms.

### WHAT IS STILL NOT MEASURED, AND IT IS THE HEADLINE

**Nobody has timed a chapter.** "Twenty to thirty-five minutes a place" is the
target v51 and v53 were both aimed at, and every number in either section is a
proxy for it: things to knock over, numbers to beat, set pieces that still work
the second time. A real figure needs a real player and a clock, and until
somebody does that this remains an argument rather than a result.

## THE SECOND HOUR (v51 — 31 Aug 2026)

Seven versions of picture work (v44–v50) and the last change to the *loop* was
v43. So this one asks the question the picture cannot: **is a chapter still fun
at minute twenty-five.** Five things, every one of them measured first, and
three of the five are a feature that was already written and could not be
reached.

### 1. THE MISCHIEF SANDBOX WAS A FIFTH THE SIZE IT LOOKED (props.js)

Measured, all nineteen chapters, live props counted by `p.biome`:

| | |
|---|---|
| Sydney | **49** (42 grabbable) |
| Pasto · Monte Carlo · Hanoi | 24 · 20 · 16 |
| the other fifteen | **8 to 11**, every one of them inside a single annulus |

Sydney is the chapter everybody's sense of this game comes from, and it has five
times what the average chapter has. Worse, the fifteen keep theirs in ONE
cluster 13–26 m across, so two streets away the world has nothing loose in it at
all: forty-five seconds of active free play measured **zero prop impacts in
Kyoto, Cali, Rio, the Drift, Sơn Đoòng and the Pantanal**.

And it shows worst at the arrival, which is the worst place for it to show.
Props within 20 m of the spawn: **0** in Cali, the Pantanal, Sơn Đoòng and
Hanoi, **1** in Kyoto and Monte Carlo. Sydney's is nine. Sơn Đoòng had zero
within *eighty* metres — its whole list is at the survey camp, 109 m away.

A `physBIOME_SCATTER` row may now carry **`also`**, a second annulus, and
sixteen do. `physScatterRing` is the old loop, split out; `physScatterBiome`
runs it twice. Three rules, and the first two are the ones the first annulus was
already held to:

1. **It is centred on a person.** Ownership is by where a prop LIVES — inside
   `npcOWN_R` (11 m) of its home — so an annulus on empty ground is a guarantee
   that nothing belongs to anybody and the ownership chase cannot fire. Every
   centre is a position read off that chapter's own `game.locals`, not a
   coordinate somebody liked the look of.
2. **Nothing is from the wrong kind of place.** Same list as the chapter's own
   first annulus or a subset of it. No new geometry, no new types.
3. **It goes where the first one is not** — at least twenty-five metres away,
   and where a chapter had nobody's belongings at the arrival, that is where it
   goes.

**The Drift does not get one, on purpose**: its nine props are one household's,
its islands are forty metres of sky apart at different altitudes, and the long
note on its row is an argument for exactly one cluster. Sydney and Pasto do not
need one.

**MEASURED AFTER: 100% placement in all sixteen** (`physSpotOk` refused not one
candidate centre), every new prop resting 0.1–0.8 m above its own terrain, the
fifteen thin chapters now at 15–20, Cali's arrival 0 → 8, Sơn Đoòng's 0 within
80 m → 5 within 40, Monte Carlo's 1 → 10. Frame time 16.5–16.8 ms median in all
nineteen, against a v50 baseline of 16.6–17.0. `qa/fuzz.js` 19/19 clean.

### 2. THE RECORD BOARD HAD NEVER BEEN VISIBLE (systems.js)

v18 built it and the note above it is still true — *"tick the last thing in a
place and the paper went blank… that is the moment a player leaves and does not
come back, and it arrives thirteen times"*. **Two things stopped it working and
both had been there since it was written.**

- `todoRefresh` writes the board into `clueEl`. But a finished chapter's
  `todoTopId` is `sysWAY_ID`, whose `clue` is `wayClue`, and the hint tick
  rewrites `clueEl.textContent` from `sysHINTS[todoTopId]` **four times a
  second** — so the board survived about 250 ms. Measured in Kyoto: 11 / 11 on
  the tally and a clue reading `three wheeks when you get there, and the board
  opens`. Every chapter declares `way`, so this happened in all nineteen. The
  hint tick now skips the element while it carries the `recs` class, which is
  the class the board branch already sets — no second flag to keep in step.
- `.capyui-clue` is clamped to `max-height:3.2em` with `overflow:hidden`,
  because a CLUE is one sentence. The board is up to eight lines. `.recs` now
  raises it to 16em, which is Monte Carlo — five records with the way clue
  wrapped above them.

**...and it could only ever list what you had already done.** It was built out
of `recText`, which is empty for a row with no stored figure, so a chapter you
finished without racing anything showed an empty board. A row you do NOT hold is
the more interesting line of the two — it is the only thing on that card that is
an invitation — so an unheld record now prints `<label> — not yet`. The par is
deliberately not printed there: the live line says what a good one is at the
moment that is worth knowing, and five rows of it is a spreadsheet on a piece of
scrap paper.

Kyoto, finished, now reads:

```
DONE HERE
  the way on: the bridge at Uji            ▸ 79 m
  three wheeks when you get there, and the board opens
  the tunnel in — not yet
  the grove in — not yet
  the river in 40.0 s
  you kept: a tea whisk, slightly chewed
KYOTO & UJI  ·  11 / 11
```

### 3. THE NEAR MISS (systems.js)

`recordValue` speaks when a run BEATS something and is silent otherwise, and
`recordEnd` cleared the line without a word — so fifty-five measured things paid
out on exactly one of their outcomes. A run that came within a tenth of your
best was told the same thing as a run that fell over at the first corner, and
the "one more go" that every one of those rows exists to produce had no voice.

    game.recordLive(id, v)   ...captures jrRecs[id] as recOpenBest when the id CHANGES
    game.recordEnd(id)       ...and recClose() compares against it

Four rules:

1. **It needs a best to be near.** With no stored figure there is no near miss,
   so the deliberate silence on a first attempt is untouched. `recOpenBest` is
   read when the attempt OPENS, which is what makes a run that beat the best —
   and has therefore already overwritten it — read correctly as a win.
2. **It has to be near**: `sysNEAR_BAND` (7%) of the standing figure, floored by
   `sysNEAR_FLOOR` (0.35) so a two-second record is not held to two hundredths.
   An abandoned run is a long way off and is silent by construction.
3. **The smallest channel there is**: a toast and a flat chime under the personal
   best's pitch and volume. No card, no lift, no confetti, no slow motion.
4. **It cannot nag**: one line per closed attempt and one per `sysNEAR_COOL`
   (12 s).

`recClose` runs from `recordEnd` AND from the stale watchdog, because a chapter
that simply stops handing a figure over is the run ending too. It does **not**
run on `biome:enter` — an attempt abandoned by travelling is not a near miss,
which is why that clear is written out by hand rather than calling `recordEnd`.

`recGapUnit` prints a unit only when the gap is IN one — half the rows are
counts (`of the six`, `on the two`, `gulls at once`) where *"2 of them off"* is
nonsense and *"2 off your best"* is right.

Measured: best 40.0 s, run 41.5 → `so close · 1.5 s off your best`; run 48.0 →
silence; run 38.0 → silence; no best at all → silence.

### 4. THE CHAIN CLIMBS (systems.js)

The incident is the only repeatable reward in this game and it was **completely
silent until the moment it paid out**: three things happened, a card appeared,
and nothing on the way there said anything was being counted. A reward you
cannot aim at is a lottery, not a loop.

The fix is the one the torii tunnel already found — a note per event, going up.
Quiet, positional, from where the thing happened, rising over the length of the
chain, so the rule is learnt by ear inside one chapter and can be played for
after that. No HUD, nothing named, nothing listed, nothing gated: the finds'
three laws hold and the card is still the payout. **Not on the event that
cards** — that one has a chime, a lift, confetti and a card of its own, and a
fourth voice on the same frame is mud. And a chain that reached two and then
died says so once, going DOWN, which is the other half of the pattern.

### 5. THE ENCORE, AND KYOTO HAD ONE NUMBER IN IT (kyoto.js, shared.js)

Kyoto: eleven tasks and a single record — the thinnest chapter in the game to
come back to. It had TWO set pieces with a clock in them by construction and
both **switched themselves off for ever** the first time they were done:
`kyoCheckTorii` opened `if (kyoToriiDone) return` and `kyoCheckBamboo` opened
`if (kyoBambooDone) return`.

That one line was the whole of what was wrong with the last twenty minutes of
the chapter. Forty-four gates up a mountain, a wooden block per gate climbing a
scale, a camera rail written specially for it — all of it inert scenery from the
moment it paid out.

Rio's Selarón steps has done it the right way since v32 (*"been here before: no
tick, no instruction, just the number"*), and Venice's passerelle and Hong
Kong's laundry pole both re-arm. Kyoto was the exception, so now:

- the task keeps its latch (a tick fires once) and the RUN re-arms — counter
  back to zero, gates singing, `game.record` filed on every run including the
  first;
- **`torii-run`** — `the tunnel in`, lower, par **32 s**;
- **`bamboo-dash`** — `the grove in`, lower, par **17 s**;
- the tunnel's clock starts at gate ONE and nowhere else, so walking down
  through gate forty and back up is not a two-second run; a run decayed all the
  way back to nothing closes the line rather than counting up beside a player
  who left the mountain; and the grove's line waits until the crossing is a
  third done, so walking past the corner does not put a clock on the paper.

**BOTH PARS ARE MEASURED.** A scripted steer holding sprint the whole way, aimed
gate to gate, does the tunnel in **24.7 s** and the grove in **14.5 s**. Those
are the machine floors, and a par a player cannot reach is worse than no par —
the first guesses were 34 and 12, and 12 was unreachable.

**Verified:** three consecutive runs of the tunnel, **44 gate ticks every time**,
the arrival toast on the first only, the record filed on all three. Before the
change, runs two and three produced nothing at all.

### WHAT THE MEASURING TAUGHT, AND IT IS THE SAME LESSON AS v36

Three of these five are a feature that was written, published, documented at
length and then **never once reached**: the board (two independent blockers), the
chain's legibility, the tunnel's second run. The instrument that found all three
was the same — *play it the way a player would and count what happens* — and the
one that found the props was a single line: live props per chapter, by
`p.biome`. None of it needed a new system. See [[capy3-payoff-batch-one]] and
[[capy3-five-things-already-built]] for the previous two times this was the
answer.

**AND TWO HARNESS TRAPS, BOTH OF WHICH READ AS THE FEATURE NOT WORKING.**
`toast()` and `sfx()` inside systems.js are module-local — wrapping `game.toast`
or `game.sfx` from a probe sees NOTHING they emit, and the first near-miss run
came back with six empty arrays against a feature that worked. Observe the
`.capyui-toasts` DOM instead. And a closed-loop steer with no pathfinding walks
into the first wall between the spawn and the target and stands there for two
minutes: put the animal at the START of the corridor being measured.


## THE FALLEN BLOSSOM (v50 — 30 Aug 2026)

`shared.js`'s contact header calls these *"the worst-looking thing in
qa/na-sydney.png"* and uses them as the standing argument against ever solving
contact shadows with decals. Four separate things were wrong with them, all four
visible in a still:

1. **ONE FLAT COLOUR** over two and a half metres, on a lawn carrying a
   three-octave noise field. The decal mesh is built on `matVC2`, which has no
   `grain()` at all — so every improvement made to the ground over v45–v46 (the
   near octave, the broad hue field, the contact term) made the blossom stand
   out *more*.
2. **A VISIBLE OCTAGON.** Eight segments at two and a half metres across.
3. **FLOATING FIVE CENTIMETRES** over a lawn that undulates by three.
4. **A HARD EDGE.** The disc simply stops, which is the one thing drifted
   blossom never does.

### The rim is the fix

The outer ring is given **the lawn's own colour**, computed from the same two
noise fields the ground mesh uses, so the drift dissolves into the grass instead
of ending on it. No alpha, no sorting, no z-fighting — the same reasoning the
crease's opposed pairs and Palawan's swash ramp are built on.

Two rings rather than a plain triangle fan: a fan interpolates straight from the
centre to the rim, which spends the whole drift on the falloff and leaves it
with no solid middle. Sixteen segments, and the outer radius is **wobbled by a
noise field** — a perfect circle reads as a decal however soft its edge is.
Vertices follow `envLawnY` at a 2.2 cm offset, so the drift lies on the grass.

**It is built on the GROUND's material** (`matVCGnd`, `envMerger(envBaseA)`) and
not the decals', which is the whole reason it stopped reading as a sticker: it
picks up the grain, the near octave, the broad hue field and the contact term
that the lawn around it already has.

**PAINTING THE GROUND MESH INSTEAD WAS THE FIRST IDEA AND CANNOT WORK.** That
mesh is 64×46 over 220×160 m, so its cells are **3.44 m**, and eight of the ten
drifts are smaller than one cell. There is nothing there to paint with. Worth
checking before designing around it.

### AND EVERY GROUND DISC IN THE CHAPTER IS WOUND FACE-DOWN

The blossom came back **completely invisible** the first time it ran. `envDisc`
emits `tri(centre, v[i-1], v[i])`, which with `x = cos` and `z = sin` puts the
geometric normal at **−Y**. Every disc it has ever built — the pond bed, the pond
water, the flower-bed pads — is wound face-down, and they are all on screen only
because `matVC2` happens to be `side: DoubleSide` **for the Opera House sails**.
Move one onto a front-faced material, which the ground's is, and it is culled.

Nothing looks different today: a double-sided material draws both faces, and the
merger writes a `+Y` normal attribute so the lighting was never affected. It is
fixed in `envDisc` anyway, because it is a trap and not a defect — the cost of
leaving it is that the next person to do what this pass just did loses an hour.

The winding was settled by the cross product rather than by trying both: for
`a` = centre and `b`, `c` on the ring at increasing angle,
`((b−a) × (c−a)).y` is `−sin(θc − θb)`, so the outer pair must be listed in
**decreasing** angle for the face to point up.

### Cost

Measured as a differential (`git stash` the file, reload, re-measure, restore),
with `shadowMap.enabled = false` and `info.autoReset = false` so the counter is
the main pass and not the composite quad:

- **480 triangles replacing 80**, against a chapter that draws about 87 000.
- **140 draw calls against a baseline of 141** — i.e. inside the run-to-run
  variance of what the frustum culls on an arrival frame. Worth measuring before
  quoting the "+1" that the design predicts and the instrument cannot see.

## THE PENUMBRA (v49 — 30 Aug 2026)

Everything else in the picture softened over v45–v48 and the shadows did not.
They were the last hard edge in the frame, and the reason turned out to be that
the table meant to control them had never been connected to anything.

### `sysBIO_SH_RAD` HAD NEVER DONE ANYTHING

It has been in systems.js since chapter 2 with a comment saying *"PCFShadowMap
does honour shadow.radius (it scales the PCF tap offsets), so this is free."*
That sentence is true, and it is about the wrong constant: the renderer is set
to **`PCFSoftShadowMap`** thirty lines below it, and three's PCF_SOFT branch
does not reference `shadowRadius` at all.

Measured byte-exact (`qa/shadow-probe.js`), which is the only way to be sure of
a claim like this:

| | `shadow.radius` 1 vs 25 |
|---|---|
| under PCF_SOFT | **0.000% of frame, peak 0** |
| under PCF | 15.485% of frame, peak 62 |

So every shadow in all nineteen chapters has been the same fixed one-texel
kernel — 2.15 cm at 2048 over a 44 m box, about a six-centimetre penumbra —
whether the thing casting it is a bollard twenty centimetres up or a building
twenty metres up.

### What replaces it

Contact hardening, which is the actual physics: a penumbra grows with the
distance between the caster and the surface it lands on. A five-tap blocker
search first, then a twelve-tap PCF whose radius comes out of what it found.

- **IT IS NOT MORE EXPENSIVE.** three's PCF_SOFT is a fixed sixteen taps for
  every fragment in the frame. This is five, and only fragments that find a
  blocker spend twelve more — so the lit two thirds of a daylight frame get
  *cheaper* and only real penumbra pays. Measured as a differential (`git stash`
  the file, rebuild, re-run, restore): **−0.198 to +0.137 ms across four
  chapters**, and a negative delta is impossible for added work, so the noise
  floor is ±0.2 and the cost is unmeasurable.
- **`shadowRadius` BECOMES THE LIGHT SIZE**, which is what it means in a soft
  shadow and what the dead table was reaching for. One number per biome, already
  plumbed, and now it arrives.
- **NO JITTER, AND THEREFORE NO NOISE.** A rotated sample disc is the usual way
  to hide a low tap count, and this game has no denoiser anywhere in the chain —
  the same argument the crease's opposed pairs are built on. Two fixed rings
  instead, four and eight.

It is a global override of a three `ShaderChunk`, because `getShadow()` is called
from `<lights_fragment_begin>` and shadows have no per-material hook. It is
installed from systems.js, which already owns every other decision about the sun,
and it **refuses to install** if three ever restructures that chunk — a wrong
replacement there breaks every shadow in the game, so a missing `#elif` returns
rather than corrupting it.

### What it measures

`qa/shadow-pen.js` puts a controlled 4 m plate over flat lawn at four heights and
diffs the new filter against a stand-in for the old one (`shadowRadius = 0`
clamps the derived radius to its one-texel floor, which *is* the fixed-kernel
behaviour, so the old filter can be compared without reverting the chunk):

| caster height | frame differing | mean | peak |
|---|---|---|---|
| 0.25 m | 1.71% | 7.6 | 22 |
| 1 m | 2.16% | 9.2 | 32 |
| 3 m | 6.14% | 12.7 | 38 |
| 8 m | 14.24% | 13.4 | 41 |

**8.3× more of the frame affected at eight metres than at twenty-five
centimetres** — a shadow on the ground barely moves, one cast from high up
softens completely. That is the whole of the feature.

### FOUR ATTEMPTS AT THE INSTRUMENT, AND THE FOURTH WAS TO STOP MEASURING WIDTH

The obvious probe is the 10–90% transition width of a shadow edge. It failed
three times:

1. **It measured the depth of field.** The lens is still on: the defocus blurs
   the very edge under test, and the first run reported a 1279-pixel penumbra —
   the entire scanline. `dof`, `air`, `crease`, `vignette`, `contrast` and
   `bloom` all have to come off first.
2. **It measured world motion.** `shot()` awaited an image decode between two
   renders, and an await yields to rAF, which ticks the game. That reported an
   11.3% frame difference from a uniform the shader provably never reads — NPCs
   walking. **Third time this trap has been paid for in this session.**
3. **It measured the caster.** Looking straight down at where the shadow lands,
   the plate is also in frame at low heights, and a dark box on a bright lawn is
   a far steeper edge than any penumbra.

The fix was to abandon the width entirely. **The prediction does not need one** —
it is simply that the two filters agree for a caster on the ground and diverge as
it rises. A per-pixel diff between the arms tests exactly that and cannot be
fooled by clutter, because the clutter is identical in both arms.

## THE AIRLIGHT (v48 — 30 Aug 2026)

The spill (v-presence) lights SURFACES. It lives in the rim's injection and
reaches the ground, the stalls and the animal. What it has never been able to
reach is the air BETWEEN the lens and those surfaces, because there is no
fragment out there — so on a wet night in Mong Kok the neon paints the road and
the shopfronts and then simply stops, and the fifteen metres of humid air it is
actually shining through is drawn as nothing at all.

The composite is the only place this can happen: it is the only pass with a
depth buffer, and therefore the only one that knows how far the air in front of
each pixel goes before something solid stops it. That buffer arrived in v45 and
this is the second thing it has paid for.

### One pool, two consumers

`shared.js` exports `spillUniforms()`, which hands back the **live** uniform
objects rather than copies. main.js binds them into the composite material once;
systems.js goes on writing the pool exactly as it did. One ranking per frame
feeds both the surfaces and the air, which is the only arrangement in which the
two can never disagree about where the lamps are.

### It is the real integral, and the first version was not

The cheap version asked only *how close does this ray pass to the lamp*, shaped
with the same reach ramp the spill uses on surfaces. Measured, that touched
**99.8% of the Mong Kok frame with a mean of +64 of 255** — a wash over the
whole picture rather than a glow around anything.

The reason is that it had **no dependence on how far away the lamp was**. The
camera stands ten metres from a cluster whose reach is twenty, so essentially
every ray in the frame passes inside that radius and every one of them scored
the same. The spill gets away with a reach ramp because it measures from a
SURFACE POINT, which is bounded; a view ray is not.

So it is the scattering integral:

```
∫₀^tMax dt / (dmin² + (t−b)²)  =  (1/dmin)·[atan((tMax−b)/dmin) − atan(−b/dmin)]
```

where `b` is the lamp's projection onto the ray and `dmin` its perpendicular
distance from it. Two `atan` per light, and it gives all three behaviours the
cheap form was missing: it falls with perpendicular distance, it falls with the
lamp's distance from the lens (the angular span closes), and it accounts for how
much of the segment actually lies near the lamp — so a ray that stops at a wall
in front of a lamp collects almost nothing.

Still bounded by the emitter's reach, because an inverse square never quite
reaches zero and a sign cluster on the next street should not tint this one. And
clamped to `MAIN_AIRLIT_FAR` (90 m), because a pixel of SKY carries the far
plane as its depth and the segment would otherwise be two kilometres of air in a
chapter whose lamps are ten metres away.

**ADDITIVE, AND NOT MULTIPLIED BY THE ALBEDO** — the exact opposite of the rule
one function over in the spill, and for the opposite reason. The spill is light
landing ON something and takes that thing's colour; this is light scattered by
the air on its way to the lens, and there is no surface involved to take the
colour of.

### The ray basis

Three world vectors rebuilt once a frame (`uRayBL`, `uRayDX`, `uRayDY`), so the
fragment gets a world ray out of its own uv with two multiplies and an add and
the pass needs no inverse-view-projection. **They are scaled so `rd · forward`
is exactly 1**, which is what makes the linear depth usable as a ray parameter
without a second dot product per pixel: `length(rd)` is then the ratio between
view-axis depth and true distance, 1 at the centre of the frame and larger at
the corners.

### `sysAIRLIT` — four rows, and an order of magnitude

Only chapters with both an emitter pool and something in the air to catch it. A
lamp in clean daylight scatters nothing worth drawing, and a chapter that
registers no emitters pays one coherent branch (`uSpillOn`) whatever is written
here.

The first draft had these at **0.20–0.34 by guess**. Swept (`qa/airlit-sweep.js`),
Mong Kok at 0.05 already touched 92% of the frame and at 0.24 it was 99% with a
mean of +25. The band where this reads as light in the air rather than as a
filter over the picture is **0.02–0.04**: a peak around +33 of 255 on the halo,
a quarter to a half of the frame touched, nothing blown.

| chapter | k |
|---|---|
| kowloon | 0.030 |
| monaco | 0.035 |
| iceland | 0.028 |
| cave | 0.030 |

### THE CAVE CANNOT BE JUDGED FROM ITS ARRIVAL FRAME

Swept at the doline mouth it read **0.00 at every strength**, which looks exactly
like a dead table row — and a published row with no effect is the failure named
in the payoff pass. It is not dead: the chapter has **826 emitters** and the
mouth simply has none within reach. Measured ten metres from the brightest of
them (`qa/airlit-cave.js`, which finds emitters the same way `sysSpillScan`
does, teleports the animal and ticks ninety frames so the pool re-ranks), the
same 0.24 gave a peak of **+216**.

**A chapter whose lights are all somewhere else has to be probed where its
lights are.** Every other visual pass in this game has been verified from
nineteen arrival frames, and for this one term that method returns a confident
false negative.

The switch is `game.state.noAirLight` and it cuts.

## EXPOSURE (v47 — 30 Aug 2026)

One uniform in `MAIN_POST_COMP`, one table in systems.js, **one chapter in it**.
`params.exposure` is 1.0 by default and 1.0 is an exact no-op, so eighteen of
nineteen chapters are byte-for-byte what they were.

### The thing it fixes, and how much of it there actually was

The lighting header says intensities are scaled so a fully lit surface reads
~1.2 albedo. That is deliberate — it is what gives the bright pass something to
catch — and it is fine everywhere the ground is a colour. It stops being fine
where the ground is nearly WHITE. `palSand` is `0xf2e9d2`, which is 0.887 linear
in red, and 0.887 × 1.2 is 1.06: the entire beach lives above the shoulder's
knee, and every bit of shading in it is squeezed into the last few levels of the
display.

**THE INSTRUMENT IS THE NUMBER OF DISTINCT LEVELS THE TOP DECILE OCCUPIES**, not
how much of the frame is bright. A frame whose highlights live in nine levels
has no shading in them; one with forty has. Measured across all nineteen with
`qa/tone-hist.js`:

| chapter | >235 | top-decile levels |
|---|---|---|
| **palawan** | **26.96%** | **9** |
| pasto | 6.81% | 17 |
| rio | 2.24% | 36 |
| iceland | 2.14% | 112 |
| sahara | 1.25% | 32 |
| antarctic | 0.45% | 74 |
| sydney | 0.00% | 41 |
| venice | 0.00% | 25 |

**TWO THINGS THAT CHANGED ABOUT THE JOB, BOTH FROM THAT TABLE.**

1. **NOTHING IN THIS GAME CLIPS.** `>253` is 0.00% in all nineteen — the v40
   shoulder is doing exactly what it was built for. This is a compression
   problem, not a clipping one, and calling it "the albedo ceiling" was
   describing the symptom as if it were the mechanism.
2. **VENICE AND ANTARCTICA ARE NOT CASES**, and both had been named as ones on
   the strength of looking at frames. Venice is 0.00% over 235; Antarctica has
   74 levels in its top decile. So this is one severe chapter, and it needs no
   global re-grade at all — which is what it had been scoped as.

### Why exposure, and the arithmetic that said otherwise

A lower per-chapter shoulder looked like the surgical answer on paper: the
roll-off is identity below its knee, so it would touch only the highlights and
leave the midtones exactly alone. **Swept against exposure on the real frame it
does not work at all** (`qa/tone-sweep.js`, Palawan):

| arm | >235% | top-decile levels |
|---|---|---|
| ship | 27.19 | 9 |
| shoulder 0.70 | 14.10 | 10 |
| shoulder 0.58 | 2.11 | **9** |
| exposure 0.92 | 7.81 | 15 |
| **exposure 0.86** | **0.95** | **18** |
| exposure 0.80 | 0.02 | 19 |
| exposure 0.74 | 0.00 | 20 |

A lower shoulder moves the whole top of the picture DOWN without spreading it.
It raises the curve's slope a little, and the sRGB encode's slope at the lower
output it now lands on falls by about as much, so the two cancel: darker
highlights, just as flat. Exposure moves the content **below** the knee, where
the roll-off is identity and sRGB is steep, and that is where the separation
comes from.

The shoulder therefore stays what `sysSHOULDER`'s own note says it is — a
property of the lens and not of the place. What is wrong in Palawan is that the
SCENE is too bright for the sensor, and that is what exposure means.

**0.86 and not lower.** It is the knee: 27.19% over 235 becomes 0.95% and the
top decile doubles, for six per cent of mean brightness. 0.80 and 0.74 buy one
and two more levels and cost another three and six per cent — paying real
brightness for something nobody can see.

**PASTO IS DELIBERATELY ABSENT**, and was in the first draft of the table. It is
second worst on the >235 column and looks like a case, but its top decile is
already eighteen levels and exposure at 0.86 takes it to nineteen. There is no
compression there to recover: a plaza at 2 527 m under a 61-degree sun is simply
bright.

### Where it goes in the chain

**After the bloom and before the shoulder.** After the bloom, because exposure
is the last thing that happens before a sensor and it must scale the glow along
with the thing glowing. Before the shoulder, because the whole point is to give
the roll-off something to roll off.

**And NOT before the bright pass.** `threshold` is a per-chapter number in
nineteen hand-tuned grade rows, expressed in the units the scene target is
written in; scaling the scene before the bright pass reads it would re-base
every one of them at once.

Not cross-faded and not in `sysGRADE_KEYS`, for the reason the depth row is not:
it is a property of how bright a place is, and lerping two chapters' exposures
across a swap gives half a second of a stop belonging to neither. The swap
happens inside `biomeFadeTo`'s white hold.

The switch is `game.state.noExposure` and it cuts.

## THE LEAF (v46 — 30 Aug 2026)

`shared.js` owns it. Audited across all twenty-eight modules before a line was
written: **there is no translucency, no transmission, no wrap and no
back-lighting term anywhere in this game.** The only occurrences of the word are
four comments, about a propeller, a bag of biscuits, a ghost and a silhouette.

So every leaf, frond, blade, petal and lily pad in nineteen chapters is an
opaque Lambert facet — and a leaf is the one thing in the natural world that is
famously not opaque. Son Doong's vegetation reads as cut paper for this reason
and no other. It is the same argument the rim is built on, one surface type
over: the rim separates a silhouette from the background, and this is what makes
a canopy read as a canopy rather than as a green polygon with a light on it.

### The term

A lobe around the ANTI-SUN direction, not a fresnel. The eye sees transmitted
light when it is roughly opposite the sun *through* the leaf, so the term peaks
at `dot(V, -L)` and is tightened with a power; the sample direction is distorted
toward the surface normal so a leaf turned part-way still catches some.

**MULTIPLIED BY THE ALBEDO.** Light through a leaf comes out the colour of the
leaf. Added flat it is a white haze down one side of every plant, which is the
failure mode of every cheap version of this — the same reasoning as the spill's
own multiply, one line above it in the same block.

**IT WORKS IN VIEW SPACE AND ADDS NO VARYINGS.** `vViewPosition` and `normal`
are already in scope at `<opaque_fragment>` in every Lambert three compiles, so
the term needs none of the plumbing the rim carries. It costs the sun direction
being pushed through the camera once a frame, which `leafTick` does for the
caller — the camera is in systems.js and the nineteen chapters that own foliage
are not.

**IT IS ITS OWN PROGRAM.** The rim compiles into essentially every material in
the game and reports ONE cache key so that hundreds of them share a program;
putting this in there would make every wall, bollard and capybara in the game
pay a normalize and a `pow` for a thing only plants want. A leaf material gets a
second program and nothing else in the game changes.

**SHADOWS ARE DELIBERATELY IGNORED.** A leaf glowing in the shade is wrong, and
the fix is a shadow lookup this term cannot afford. The bargain is to keep the
strength low enough that the case never reads as a mistake — the same bargain
the spill already takes.

### Wiring

`leaf(material, k)` and `leafMesh(mesh, k)`, both of which CLONE and chain
whatever hook the material already had, exactly as `sway()` does. A canopy is
precisely the kind of thing that has a rim and a grain already, and a leaf
material that silently dropped either would be the `grainOwn()` bug again.

**`swayMesh` carries a `leaf:` option**, because that call is already the marker
for "this mesh is a plant" — every swaying thing in the game is foliage, so
opting a chapter's greenery in is one word on a line that already exists. It is
read BEFORE the `auto` branch, which rebuilds the options object as a copy and
would otherwise drop it. Plants that do not sway (Sydney's fig and jacaranda
crowns, the lily pads) use `leafMesh` directly.

Twenty-six call sites: eighteen swaying batches across ten chapters and eight
static canopies in Sydney. **Son Doong is NOT wired and it is the chapter that
motivated the term** — its vegetation is merged into one mesh with the rock and
the walls, so there is no material that is only leaves to attach it to. Splitting
that merge is its own job.

### `sysLEAF_K` is 0.75, and the first guess was 0.16

How translucent a leaf is, is a property of leaves and not of places, so this is
a lens-style constant like `sysSHOULDER`; what varies per call site is how much
a given plant passes (a coconut frond is one cell thick, a fig crown is not).

**0.16 was invisible and the instrument could not see that it was.** A frame-mean
luminance A/B read 0.001 in five chapters — which is the same mistake as
measuring a defocus with mean luminance, one term over: a few hundred backlit
canopy facets do not move a frame average. `qa/leaf-orbit.js` orbits the camera
to eight azimuths around the animal and diffs the two arms PER PIXEL, and that
is the only measurement here worth anything.

Cranking it to 3.0 found the ceiling: the Pantanal's campo went acid
yellow-green and the grass read as emissive. A quarter of that puts a fully
backlit facet about 20 of 255 over its unlit self and touches ~6% of a Sydney
frame from the backlit side.

**IT IS STRONGLY DIRECTIONAL AND THAT IS THE POINT.** Measured across the orbit,
Sydney runs 0.03% of the frame affected at the front-lit azimuth and 6.2% at the
backlit one. A probe that photographs one arrival frame will conclude this term
does nothing, and in that frame it very nearly does.

The switch is `game.state.noLeaf` and it cuts.

### AND THE SHORE, WHICH WAS ALREADY BUILT

A companion item — "generalise the Pantanal's depth-graded waterline to the
chapters that lack it" — was **retired by reading the code**. Three of the four
chapters named already have a shore: the Pantanal fades its sheet out on vertex
alpha, Manly blends `manSand` → `manSandWet` → `manSandDeep` across the terrain,
and Antarctica carries a rock-and-scree band at `antWATER + 0.3`. Manly and
Antarctica's seas are also OPAQUE by design, so the alpha approach is not
portable to them without changing how they sort against the floes, the boat and
the dive — which is its own piece of work and not a batch-one item.

The one genuine defect was **Palawan, which switched at a single contour**:
`dry` above `h > 0.1` and `wetc` below it, so the swash zone — the band of sand
that is wet because the sea was just there, and the entire visual signature of a
beach — did not exist above the waterline. It ramps over half a metre of rise
now, continuous at 0.1 by construction so it cannot introduce a seam of its own.

## THE DEPTH PASS (v45 — 30 Aug 2026)

Until now there was nothing in the frame buffer but colour. `sceneRT` has always
had a depth buffer attached and has always thrown it away, and three of the four
things most obviously missing from a still of this game all wanted that one
texture. It costs the resolve and nothing else.

The review that specified it was the nineteen arrival frames again
(`qa/vr30.js`), and it came back with two sentences: **every frame in this game
is uniformly sharp from two metres to the fog, and every surface in it meets
every other surface on a clean seam.** Venice is the clearest case — sixty
people between eight metres and forty-five, all equally crisp, on a pavement
that is one value corner to corner, under arches that read as flat panels.

**Everything below is a no-op at its default.** A chapter with a row of zeroes
in `sysDEPTH` is byte-for-byte the chapter that shipped, and `uDepthOn` goes to
zero so the depth texture is not merely multiplied out but never sampled.

### 0. The attachment

`sceneDepth` is a `DepthTexture`, `UnsignedIntType` / `DepthFormat`, on the
existing `samples: 4` half-float target. A multisampled depth attachment has to
be RESOLVED, and a driver that declined would have taken the whole post chain
down with it — so it was **probed on the real target before a line of this was
written** (`qa/depthprobe.js`): range 0..245, `glErr` 0, identical in the
multisampled and single-sample arms.

At a 0.5 m near plane, 24 bits resolves under a millimetre at forty metres in
the coarsest chapter in the game (Göreme, far 2200), which is two orders of
magnitude finer than the smallest thing any term below asks about.

### 1. Defocus — `dof`

One scale of blur says how far away a thing is in a way no amount of grading
can. The chain is a coverage-premultiplied quarter-res downsample
(`MAIN_POST_COC`) and then the bloom's own blur shader, twice, which is why
`MAIN_POST_BLUR` now carries four channels instead of three — for the bloom
that is arithmetically what it always was (the binomial weights sum to 0.99999
and nothing reads bloom's alpha).

**WHY PREMULTIPLIED.** A plain quarter-res blur of the scene smears the sharp
foreground outward, and the composite then reads that smear wherever CoC is
high — so a crisp capybara against a defocused square acquires a brown halo.
Weighting every tap by its own CoC and normalising at the far end means an
in-focus pixel contributes nothing to the blurred image at all. The CoC is
taken **per tap** and not from an averaged depth, for the same argument one
level down: an averaged depth across a silhouette is a distance at which
nothing exists.

The mix uses the FULL-RES CoC at the pixel, so an in-focus pixel stays exactly
the pixel it was and there is no quarter-res lattice on a sharp subject.

### 2. The air — `air` / `airMax`

`scene.fog` is **linear and starts at 78–90 m**. The camera is six metres up
and the whole of the game happens between three and forty, so aerial
perspective — the cheapest depth cue there is — was switched off exactly where
the game is. This is an exponential term starting at zero, capped, and mixed
toward **`scene.fog.color` itself**, which is why it needs no table of its own:
that colour is already cross-faded by `atmosApply` and already moved by the
aurora, the storm and the tide, so the near air and the far fog agree by
construction and can never drift apart.

**THE SKY IS EXEMPT, OFF THE RAW DEPTH.** Every dome in this game is
`fog: false` on purpose — a dome IS the haze, and hazing it toward the haze
flattens the ramp it exists to draw. An untouched depth buffer is exactly 1.0
and no piece of world ever is, so `raw < 0.999999` is exact and free.

### 3. The crease — `crease`

This is the ambient occlusion this codebase has never had. The rim's own header
says it in words — *"no rim term, no fresnel, no ambient occlusion and no
contact shadow anywhere in this game"* — and `contact` (v-presence), which
arrived after it, is a twelve-slot pool of ground patches UNDER OBJECTS on the
**32 of 108** surfaces that opted in. It cannot darken a box against a box, a
wall against its own pavement, or the inside of an arch.

Eight taps, **four opposed pairs**, and the pairing is the whole algorithm:

- **A FLAT PLANE SEEN AT A GRAZING ANGLE** is the case that matters, because
  the biggest grazing plane in every frame of this game is the ground and it is
  half the picture. A single tap on a steeply inclined surface finds a
  neighbour tens of centimetres nearer and calls it a corner. Measured, the
  naive version took Sydney's lawn down **2.8 of 255** across the whole lower
  third — a shading term that darkens a flat plane is not an occlusion term, it
  is a filter. On any flat surface, whatever its inclination, one side of an
  opposed pair is nearer by exactly as much as the other is further, so the
  **minimum of the pair is zero**; in a real concave corner both sides come
  toward the lens and both are positive. After the fix the same measurement
  reads **0.001 of 255**.
- **A SILHOUETTE IS NOT A CREASE.** A neighbour four hundred metres in front of
  this pixel is a roofline against the sky, and darkening that draws a black
  outline round it — the one thing the aesthetic law names. Each weight ramps
  in over `MAIN_CREASE_RANGE` and back out over six times it.

The radius is **world-constant**, not screen-constant (`uFocalPx` metres-to-
pixels at one metre, over the distance): a fixed pixel radius gives a near wall
a hairline and a far one a black band. `MAIN_CREASE_R` (0.14 m) and
`MAIN_CREASE_RANGE` (0.30 m) are lens constants and deliberately NOT
per-chapter, like `sysSHOULDER` — every chapter wants a corner to be a corner.
Only the strength is a row.

### 4. `sysDEPTH`, and why the focus is a MULTIPLE

Six numbers per chapter: `dof`, `dofK`, `nearK`, `air`, `airMax`, `crease`.
`dofK` and `nearK` are multiples of the **distance from the lens to the
animal**, because that distance is six metres at a wall, twelve on a lawn,
thirty at a helm and seventy under a balloon, and a focus plane written in
metres would be behind the camera in one of those and past the fog in another.

**THE ROW IS NOT CROSS-FADED and is not in `sysGRADE_KEYS`.** A grade is a look
and looks may dissolve; a focus distance and a haze coefficient are geometry,
and lerping two chapters' geometry across a swap gives half a second of a focus
plane that belongs to neither place. The swap happens inside `biomeFadeTo`'s
white hold.

The subject distance is **clamped to 11..60 m** and lightly damped (a camera
that swings round a corner pulls focus rather than snapping it). Eleven is the
floor because the rig holds twelve in seventeen of nineteen chapters; at eight,
Antarctica and Manly both sat ON the floor and the Antarctic boat — thirty
metres out, and where a task sends you — came back visibly soft. **A focus
field that defocuses the thing the card is pointing at is a bug however good it
looks.**

### THE SWITCHES

`noDepth`, `noDof`, `noAir`, `noCrease` on `game.state`. All four **CUT rather
than fade**, for the reason the lens pass wrote down.

### WHAT MEASURED WRONG FIRST

1. **THE NEAR BLUR WAS AIMED IN FRONT OF THE PICTURE.** The first table put it
   at 2.8..7.5 m and the far ramp at 27.8..83.3, all guessed from the camera
   height and the pitch. `qa/depth-map.js` raycasts a 3×5 NDC grid and the real
   resting frame is **9.3 m at the bottom edge, 12 m at the animal, 16–18 m at
   the centre, 27–42 m at the upper third**. So the near half was entirely in
   front of the nearest visible thing and the far half only touched the top
   quarter. It measured as −5.7% gradient energy in the top band and
   **byte-identical** in the other two, which is exactly what a focus field
   aimed past the frame should measure. Off the real numbers: **−22.8% top,
   −17.8% bottom, −1.1% middle** — soft ends, sharp subject, which is the
   signature of a lens rather than of a blur.
2. **SYDNEY'S SKY DOME WAS THE ONLY ONE IN THE GAME THAT WROTE DEPTH.** A 300 m
   sphere inside a 400 m frustum, so the first sky gate (a rolloff at 0.9 of
   the far plane) never fired on it and the chapter came back milky. It is
   `depthWrite: false` now like the other four, which also removes a latent
   depth-clip on anything the harbour put past three hundred metres. **Cloned
   first** — `mat()` hands back a shared cached material.
3. **THE AIR COLUMN WAS AUTHORED AT ROUGHLY TWICE WHAT IT IS WORTH.** 0.0038/m
   under a 0.26 ceiling put 26% of the horizon colour on anything past eighty
   metres, and Sydney's harbour is eighty to a hundred and fifty out. It came
   back grey-green. Aerial perspective is real and it does desaturate, but that
   blue is one of the things the chapter is FOR. **Chroma is the metric, not
   luminance** — a mix toward a pale haze RAISES the mean, so the luminance
   probe could not see the cost it was paying.

   `qa/depth-chroma.js` measures the air term ALONE (the defocus also lowers
   local max-minus-min, and that is a blur and not a desaturation; mixing the
   two spends the budget on the wrong term) in all nineteen. **Sydney at −14%
   in the top band is the calibration point** — that is the arm judged
   acceptable by eye. Eleven chapters were past −12% on the first pass and
   eight were retuned; the table now runs −1% to −20%, with Monte Carlo (−25)
   and Hanoi (−24) deliberately over because in both of those the haze is the
   subject. The mid band, which is where the game is, is −1 to −11 everywhere.
4. **NO PROBE THAT CALLS `game.tick()` CAN ISOLATE ANY OF THIS.** Even at
   `dt = 0` the camera moved 0.16 m across five arms. `post.render()` re-renders
   the same scene through the same camera and does nothing else, and
   `sysDressFrame` cannot overwrite the params because it never runs. And every
   arm must be **captured before any of them is decoded**: `await` yields to the
   event loop, the event loop is where rAF lives, and the real game steps
   between arms. With both, the camera is identical to four decimal places in
   every row — which is the assertion, and it is in the output.

### AND THE SECOND SHADOW CASCADE WAS RETIRED BY MEASUREMENT

`sysSHADOW_HALF` is 22, so the sun's shadow frustum is a **44 m box centred on
the animal** and nothing further than that casts a shadow at all, at any time,
in any chapter. In the wide places — the Pantanal, the Erg, the Piazza, the
pack ice — that is most of the frame, and it is why the far field read as one
flat sheet. It was on the list for this pass as a second, wider, lower-
resolution cascade: one more shadow render per frame.

**It is not being built, because the air and the crease already carry the
distance and a cascade would be paying a whole extra pass for something no
longer visible.** Compare `qa/VR30-15-pantanal.png` with
`qa/D45-15-pantanal.png`: the Transpantaneira used to run two hundred metres to
the horizon at exactly the value it started at, and now it recedes. Anything a
cascade drew out there would be drawn behind a haze and inside a defocus.

Same reasoning as the sun glow in `/presence 2`. If the far field is ever
brought back into focus — a chapter with a long lens, or a marquee shot down a
valley — this is the first thing to reconsider, and the note is here so it can
be.

### WHAT IT COST

Frame time **16.2–16.8 ms median, 18.2–20.1 ms p95 in all nineteen** — a locked
sixty, unchanged, `qa/depth-sweep.js`, zero errors, and every row asserting its
own biome. The composite-pass delta
(`qa/depth-perf.js`, `post.render()` × 60 with a `readPixels` at each end,
interleaved, medians of five) is **+0.01 to +0.46 ms**, worst in Mong Kok.
**The instrument's own noise floor is about ±0.1 ms** — three of the five
per-term deltas came back negative, which is impossible — so the per-term
breakdown is not trustworthy and only the total is quoted.

Two render targets at a quarter (about 1.4 MB at 1600×900) and, when `dof` is
on, five quarter-res passes.

## THE BROAD OCTAVE — `grain({ broad, broadM })` (v45 — 30 Aug 2026)

Shipped alongside the depth pass and independent of it. `shared.js` owns it;
nineteen ground materials opt in, one per chapter, and every other call site in
the game is untouched because it defaults to zero.

**Everything `grain()` did varied BRIGHTNESS.** `gn` and `gnr` are both a
multiply on the diffuse and between them they run from a metre and a half down
to a few centimetres. Two things were missing and they are one thing looked at
twice:

- **There is no octave above a metre and a half.** A lawn is not uniform over
  thirty metres, it is patchy over ten; sand is packed in places and loose in
  others; a piazza has been mended. The ground is 40–55% of every frame in this
  game and it still read as one value with a texture on it.
- **Nothing here has ever moved a HUE.** Grass yellows where it is dry and goes
  blue-green in the damp. A flat hue over half the picture is most of what makes
  a large surface read as a polygon rather than as ground.

One extra `grNoise` does both, and they are **correlated on purpose**: the gain
is per-channel (`_BROAD_K`, 1.35 / 1.0 / 0.62), so the bright half of the field
goes warm and the dark half goes cool. That is not a shortcut, it is the
physical case — a dip in a lawn is darker for seeing less sun and cooler for
seeing more sky. At `broad = 0.10` the warm-to-cool spread is about 7%, the same
order as the split tone and, like it, meant to be invisible until switched off.

**`broadM` IS A WAVELENGTH IN METRES, not a multiple of `scale`.** Every other
octave in that helper is a multiple, and `scale` is a per-chapter number between
0.24 and 0.62 — so one multiplier would put this field at eighteen metres in
Kyoto and forty-six in Hanoi, and "how big is a patch of ground" does not vary
by a factor of three between two streets. It is taken off the world position on
**XZ only**: a wall gets one value up its whole height, which is what a wall
does.

**No distance fade**, unlike `near` and unlike the sparkle. At roughly sixteen
metres this field is never within an octave of Nyquist in any frame this camera
can compose, so there is nothing to alias and the `fwidth` those two need would
be a derivative for nothing. It IS warped by `gn` — free, already computed —
because a sixteen-metre value-noise lattice across a thirty-metre frame is two
cells and shows itself as two soft squares.

**`broad` and `broadM` are both in `key`.** That string feeds the material cache
AND `customProgramCacheKey`, so an option missing from it means two call sites
sharing one compiled program and which one you get depends on draw order.

## THE FEEL PASS (v44 — 30 Aug 2026)

Five things aimed at the ninety per cent of this game that is not a task: moving
about in it. None of them adds a task, a gate, a collectible or a number on a
screen, and every one is additive — a chapter that ignores all five behaves
exactly as it did.

### 1. THE FLOW — `game.state.flow`

The third number, beside the two that already existed.

    chaos   a SPIKE.  "what just happened?"        rests at zero
    calm    a HOLD.   "how long has nothing?"      rests at zero
    flow    a STREAK. "how long have you been moving WELL?"

Accrues while the animal is covering ground above `sysFLOW_MIN` (3.6 m/s, under
the 4.2 walk so a turn or a slope does not break it) **at a rate scaled by
speed**, so a walk is a line and a run is a better one. Collapses on a stall of
`sysFLOW_STALL` — and **a hop does not break it**, which is what makes hopping
the kerb rather than going round worth doing.

Four readers, all of them channels that already existed:

| | |
|---|---|
| the lens | `sysFLOW_FOV` degrees on top of the speed term — but arriving on the STREAK's clock, not the speedometer's, which is what makes a long run feel unlike a fast one |
| the boom | `sysFLOW_DOLLY` back. Same number the loaf moves, opposite reason: the loaf because you stopped and there is room to look, the flow because too much world is arriving |
| the score | `sysFLOW_MUS` into `musWant`, beside chaos. Deliberately the smallest of the three terms — a clean run should lift the music, not score it |
| the ground | the footfall dust thickens with it, one mote to four. The only reader at ground level |

Read-only. Nothing outside systems.js may write it.

### 2. THE SLIDE — `input.slide`, `capy.sliding`

**G held**, or the pad's left trigger. Held, not latched: a slide is a state. It was Ctrl until P2; Ctrl+W closes the tab and cannot be cancelled.

**It is not a new movement model.** A slide is being slippery on purpose, and
capybara.js already has a solved, measured model of slippery ground — the
glacier. So the slide does one thing: it raises the friction half of `slip`.
Everything else falls out of chapter 7's machinery, including THE CARVE, so a
player who has done `glacier-run` slides better everywhere for the rest of the
game.

**`slip` AND `slipG` ARE TWO NUMBERS AND THE SPLIT IS THE WHOLE DESIGN.** The
first cut put the slide into `slip` itself, which feeds three things — the grip
damper, the steering authority AND the top-speed multiplier. Measured on the
erg: holding the stick through a slide reached **17.9 m/s on the flat**, two and
a half times a run, on a key. A slide is a way of CARRYING speed, so it belongs
on the friction half only: `slipG` (ground + belly) drives the grip damper, the
steering, Tobler and the skid; `slip` (ground alone) keeps both speed ceilings.
Downhill still accelerates, because that is gravity against a body that has
stopped gripping — and that is now the only way a slide can gain.

Three rules keep it honest: you must already be moving (`capySLIDE_MIN`); it
cannot be pumped (one entry kick, then `capySLIDE_COOL`); and it ends itself
below `capySLIDE_OUT`, so it can never be held as a cheaper walk.

The pose is MODEL ONLY (`capySLIDE_DROP`/`_TILT`), for the landing spring's
reason: the collider is three spheres and a shorter capybara falls through
eighteen chapters of geometry sized against the one that exists.

### 3. THE WAKE — `wakeTick(x, z, speed)` in shared.js

Every swaying thing in the game answered the wind and nothing answered the
animal. Same shader hook, same `swR` tip ramp, one more uniform (`uWakeP` —
world x, world z, strength packed into one vec3 so the three can never disagree
about which frame they are in), and a radial displacement away from one point
with a squared falloff — a linear one has a hard outer edge that crosses a reed
bed like a ring.

Zeroed under `prefers-reduced-motion` and whenever the animal is not walking
through anything: carried, at a wheel, under water, on a bird.

**IT ONLY REACHES WHAT ALREADY SWAYS**, and when the wake was first built that
was three chapters (Palawan's fronds, Rio, Marrakech) — so it was a mechanism
with almost nothing to act on. THE ROLLOUT IS THE OTHER HALF OF THE FEATURE.

#### `swayMesh(mesh, { auto: true })` — the window comes off the geometry

The one thing a call site gets wrong is `lo`/`hi`, because it is a property of
the GEOMETRY and not of the plant: a unit cylinder built centred runs -0.5..0.5
and one built based runs 0..1, they read identically in the file using them, and
getting it backwards bends the tuft INTO the ground. `auto` reads the geometry's
own bounding box on the chosen axis. Rounded to 2 dp, because lo/hi go into the
program cache key and two tuft batches differing in the fifth decimal are the
same plant and must not compile two shaders — Göreme's **52 meshes share 3
programs** because of that line.

Explicit `lo`/`hi` still win, for the three original call sites that window a
deliberate SUBSET of their geometry.

#### What was opted in (v44), and what was left out and why

| chapter | what moves |
|---|---|
| Sydney | the lawn tufts, both shades, and the flowerbed stems — chapter 1's ground cover was the most static thing in the game |
| Pasto | shrubs, coffee, frailejones and their blooms. The windiest chapter in the first half and only its smoke ever moved |
| Kyoto | the iris at the pond edge, the bamboo culms (stiff — a culm's top eight metres travel and its base does not) and their leaves |
| Cali | plantain leaves (2 m of unsupported membrane), bougainvillea, cane tops |
| Iceland | lupins and their stems, by batch name |
| Göreme | vine, vine stem and scrub, by batch name |
| Pantanal | the grass — 2 619 waist-high tufts, the best wake target in the project |
| Drift | island turf, moss blades and stalks. The chapter that is ABOUT wind and whose turf the wind did not touch |
| Hanoi | the kerb weeds only |

**3 chapters → 12. 83 meshes, 24 696 instances.** Measured, and the frame time is
unchanged (vsync-locked at 16.6 ms with and without); the real cost is 4–17
extra shader programs per chapter, which is compile time on chapter entry.

**NOT DONE, AND FOR A REASON.** Antarctica has no plants. The Quay is a boat.
Venice, Kowloon, Monaco, Manly and Son Doong keep their foliage in MERGED
meshes, where the window is in the merged root's frame — the exact case the note
at the top of `_swayInject` warns about, and a y-window over a mesh spanning
y −10..+15 is meaningless. Those need a per-mesh window, not a one-liner, and
`auto` would confidently get them wrong.

**Flat cards lying on the ground are never swayed** — Iceland's tussock, Hanoi's
litter, the lily pads. A ramp along the y of a flat card slides the whole card
sideways instead of bending it.

### 4. THE ECHO — off `capy:wheek`, systems.js

The wheek is this game's only voice and in eighteen of nineteen chapters it went
out and never came back. Son Doong has an echo because a cave without one would
be absurd — but an echo is not a property of a cave, it is a property of BEING
NEAR SOMETHING, and the game is full of alleys, arcades, sea walls and the
underside of a harbour bridge that were acoustically identical to a field.

Eight bearings at ear height, nearest hard surface on each, played back off it
delayed by the real flight time (`2d/c`), positioned AT THE REFLECTOR so the
existing spatial mix pans it, quieter and duller the further it came from. In
the open there is no reflector and nothing happens — the effect IS the
difference between a square and a lane.

**THE SCENE, NOT THE PHYSICS WORLD.** The picture is what the player is standing
in: a drawn arcade with no collider still sounds like an arcade.

**TWO ROOTS, NOT ONE.** Sixteen chapters put their world under a group named for
the biome; **Sydney does not** — chapter 1 is built into `environment`. Testing
both is what stops the first chapter being the one place the effect is absent.
The 300 m sky dome cannot be hit because the ray is 34 m long.

### 5. THE CREST — systems.js

The rest voice opens the boom when you STOP. This is the other thing: cresting a
ridge at a run is the most reliable beautiful moment in any of these chapters
and it was framed at the same 9.5 m as the flat.

Four terrain samples ahead along the CAMERA yaw (not the animal's — an animal
running along a ridge with the camera over the edge is looking at the view
whatever its feet are doing), every `sysCREST_EVERY`. The ground must fall and
KEEP falling: a hill you are climbing fails, a shelf with a wall behind it
fails, a gully fails. No per-chapter data, and the caldera rim, the top of the
Corso, the brink of the great dune and a Kowloon roof all pass without being
told to.

It is the only camera term here that takes PITCH off as well as adding boom — a
longer boom at the same angle shows you more ground, and a view needs the
horizon to come up the frame. No card and no sound: a view is not an
achievement, and the moment it congratulates you it stops being a view.

### WHAT WAS MEASURED (30 Aug 2026, in a browser)

| | |
|---|---|
| flow, flat run on the erg | 0.06 → 0.62 over five seconds; **a hop carried it 0.62 → 0.78**; a stop took it to 0 in 1.9 s |
| flow, the lens | FOV 48 → 59.6 across a run; **max 60.6 across nineteen chapters** |
| slide | engages at 3.3 m/s, `slip` 0.86, **carries 7.4 and does not exceed it**, ends itself at ~3.5 s |
| wake | GLSL injected and the uniform tracks: still 0.001, running 0.862 at (20.2, 10) |
| echo | Sydney two returns at 116/231 ms (20 m, 40 m); Kowloon one at 110 ms (19 m); open ground silent |
| crest | over a 7.6 m lip in Göreme the boom went 8.87 → **12.13 m** and the eye lifted 17.9 → 20.9 m |
| all nineteen | 900 ticks each, running/hopping/sliding: **no NaN, no errors** |

### `qa/xmodule.mjs` — AND NOW THERE IS AN AUDIT FOR IT

    node qa/xmodule.mjs [srcDir]

For every file: is each name it CALLS declared in that file, imported by it, or
a known global? Anything else is either undeclared (throws everywhere) or
declared in another module (throws in the dev build, and resolves to the wrong
function in the bundle).

**The question is per file, not per bundle.** An earlier version unioned every
module's declarations and asked "is this declared anywhere" — which is the
bundle's question, and it answers "yes" for `biomeLive`.

Two things it had to learn, both of which produced 187 findings before they were
fixed: **block comments must be stripped over the whole file**, not line by line
(this codebase's jsdoc is long English prose full of "the position it is at
(x, z)"); and **method shorthand is not anchored to a line start** — main.js
declares four stubs on one line, `toast() {}, shake() {}, sfx() {}`.

**Validated against both real bugs rather than trusted on a green run**: it
reports `noiseBuf` UNDECLARED on the v41 tree and `biomeLive` CROSS-MODULE when
that call is put back. The tree is clean as of v44.

### AND ONE BUG THIS PASS ALMOST SHIPPED, WHICH IS THE `noiseBuf` ONE AGAIN

The crest's first cut called `biomeLive()` for the live chapter's api. That
function exists — **in npc.js** — so the bundle resolved it silently to another
module's helper, which is hard-coded to Sydney, and the unbundled dev build
would have thrown `ReferenceError` on the first frame of every chapter. `node
build.mjs` reports "no collisions" and cannot see this: it checks that top-level
names do not COLLIDE, not that a name belongs to the file using it. The idiom in
systems.js is `game[game.biome.current]`. See the module-tag rule at the top of
this contract — it exists for exactly this.

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

## WHAT THE OTHER NINE CHAPTERS TEACH (v43 — 30 Aug 2026)

Ten chapters hand over a costume. These nine hand over a **move** — and the
difference between the two halves is the whole design: a costume is that
chapter's joke and stays in it, and a skill is a thing the animal learned and
keeps. That is this codebase's own rule for the dive and the climb (a verb is a
property of the world; the chapter that teaches it is not the only one that
affords it — see `capyCanDive`, `sysDIVE_TAUGHT` and the `brought-` finds), so
`sysSKILLS` has no biome column.

It is also what makes the back half of the journey feel unlike the front. By
Hanoi you have Andean lungs, Kyoto's feet, Cali's ear, Iceland's edges,
Marrakech's wall-kick, the Drift's glide, Kowloon's reach, a place to sit and
right of way. None of it is a number on a screen.

**The teacher is chosen the same way the costumes' is: the task has to be the
thing that TEACHES the move.** Four of the nine are their chapter's marquee and
five are not — and two are FINDS rather than tasks, which is right for the two
subtlest skills, because nobody is told to do either.

| ch | earned by | skill | what it does | measured, off → on |
|---|---|---|---|---|
| 2 Pasto | `the-rim-walk` *(find)* | **THE LUNGS** | altitude: deeper wind, quicker recovery | 10.02 → **14.12 s** at a flat run; recovery 4.32 → **2.87 s** |
| 4 Kyoto | `still-bamboo` *(find)* | **SOFT FEET** | a fright leaves less behind | peak alarm **1.0 → 1.0** (untouched); peak wariness 0.985 → **0.443** |
| 5 Cali | `salsa-dance` | **ON THE TWO** | a hop on the beat carries | standing hop 0 → **0.76 m**; apex **0.93 → 0.93** |
| 7 Iceland | `glacier-run` | **THE EDGE** | steering on ground that slides | lateral gain at full slip 6.65 → **12.86 m** |
| 8 Marrakech | `acrobats` | **THE VAULT** | one kick off a wall per airtime | rise off a face 0.97 → **1.54 m** |
| 9 the Drift | `driftseed` | **THE SEED** | hold the hop key falling and you drift | 2.5 s of fall 57.0 → **10.8 m**, across 5.8 → **10.1 m**, rate exactly −1.85 |
| 11 Kowloon | `bamboo-climb` | **THE REACH** | catch the lip you just missed | topped out **0/6 → 5/6** |
| 15 Pantanal | `gather` | **THE HERD** | wheek and they fall in behind you | see below |
| 15 Pantanal | `the-crossing` | **THE FLOAT** | the loaf works on water | loaf in the harbour **0 → 1** |
| 19 Hanoi | `cross-the-road` | **RIGHT OF WAY** | hold a line and the world gives way | committed **0 → 124** frames of 180 straight; **16** of 180 wavering |

**THREE OF THEM WIDEN THE REACH ENVELOPE ON PURPOSE** — the vault, the seed and
the reach — and that is what they are for. The other six do not touch it at all.
**Nothing here changes the jump apex**, which is the constraint the hop's own
long note sets out: eighteen chapters of geometry are sized against 1.37 m and a
changed arc is the worst regression this game can have. The vault is a NEW
launch and not a bigger one; the seed only ever slows a descent and can never
gain height; the reach only finishes a lip that was already within a hop. The
beat bonus is horizontal for exactly this reason, and the apex came out of the
A/B at 0.93 m on and off.

Five things that were measured or were bugs:

| | |
|---|---|
| **`the-rim-walk` granted nothing at all** | It is a `FINDS` row, not a `TASKS` row, and `taskRec` and `findDone` are two registries that do not know about each other. The first measured run showed 10.02 s of running with the skill "on" — a row naming neither table fires silently for ever. Both are consulted now. |
| **a damp loses to gravity, by a factor of three** | capybara.js runs BEFORE the world step, so the solver puts back every frame what the damp just took. The seed at lambda 6 settled at **−5.64 m/s** against a stated −1.85: obviously better than terminal velocity, and therefore obviously "working". The damp is the flare only; after `capySEED_FLARE` the rate is assigned. |
| **the wall-kick had no wall** | The first vault probe stood five metres off the Kowloon spawn at ten bearings and found **zero** climb holds — because the spawn sweep deliberately puts the animal in the clear. A mechanic measured against nothing measures as nothing. |
| **the beat window cannot be sampled from a tick loop** | `ac.currentTime` is a REAL clock and `g.tick()` runs hundreds of sim frames per real second, so sixteen hops inside one `page.evaluate` all sample the same beat phase. Real waits between hops, and the phase read at the press so a hit is attributable. |
| **soft feet scales what is LEFT BEHIND, not the fright** | Scaling `alarm` would have made the animal quiet by making the world unresponsive. `alarm` is untouched — a person walked into still says so, still looks up, still hops — and only the wariness it writes is smaller. The measurement is the proof: alarm 1.0 either way, wariness more than halved. |

**Soaked** (`qa/skillsoak.js`): all nineteen chapters, every skill forced on,
every key that touches one held for four seconds. No errors, no NaN, and the
animal is inside the world in all nineteen.

**CHAPTER 15 TEACHES TWO**, and it is the only one that does. It is the one place
in the journey where the animal is not a novelty, and there are two separate
things about being a capybara it can show you.

### THE HERD — the only skill that is a whole system

`gather` is "get five of them to follow you", and what it teaches is that it
works on anything. Four rules, and the first two are what stop it being a switch:

| | |
|---|---|
| **it is on a timer** | One wheek buys `herdHOLD` = 21 s and no more. A herd is a thing you are actively KEEPING, not a thing you have collected — so the verb stays in use for as long as the herd exists, and walking a line of animals across a city is a performance rather than an inventory. Measured: 14 pigeons still at 18 s, 0 by 24 s, and rebuildable to 10 immediately after. |
| **some of them take more asking** | `obey` is 1, 2 or 3 wheeks and there is deliberately no way to ask for a fourth — it is `clamp(…, 1, 3)` in the offer. The counter DECAYS over `herdHEARD_T` = 7.5 s, so the extra wheeks have to be periodic; three wheeks over four minutes recruits nothing. |
| **everything answers the first wheek** | The rule that makes the tiers legible instead of mysterious. A three-wheek heron still turns its head on the first one. You can see you were heard, and you can see it has not moved, and those two facts together are the whole tutorial. Nothing in earshot ever ignores you. |
| **they walk the trail** | Straight off the Pantanal's own herd: a line down the player's own path cannot pile up, cannot orbit, cannot oscillate and cannot walk through the thing the player just walked round. |

**A chapter OFFERS its animals and keeps ownership of drawing them.**
`game.herdOffer({biome, kind, obey, voice, count, at, put})` — the system only
ever asks a chapter to put an animal somewhere, and only for the ones actually
following. **systems.js updates last** (env → …16 biomes… → weather → props →
capy → condor → npcs → systems), so a `put` lands after the chapter's own wander
has already run and wins for that frame. That is why this needed no surgery in
any chapter's updater: four offers, ten lines each, and nothing else moved.

**Wired, and measured from a clean animal** (`qa/herd2.js`, `qa/herd4.js`,
`qa/herd5.js`, `qa/heron.js`) — eight chapters, all three tiers:

| chapter | kind | obey | joined on wheek |
|---|---|---|---|
| 1 Sydney | ibis ×6 | 1 | **1** — the easiest tier, on the first animal a player ever meets |
| 7 Iceland | sheep ×14 | 1 | **1** |
| 10 Venice | pigeon ×180 | 1 | **1** — 80–93 looked, 14 recruited (the cap) |
| 15 Pantanal | cow ×13 | 1 | **1** — the thirteen on the campo, never the eleven in the corral |
| 17 Antarctica | gentoo ×42 | 1 | **1** — 42 looked, 14 recruited |
| 13 Göreme | cat ×9 | 2 | **2** — looked on wheek 1 and did not move |
| 14 Manly | silver gull ×30 | 2 | **joins** — they flush at 7 m and mill, so the tier is noisy to measure; called from 9–13 m they come |
| 4 Kyoto | heron ×1 | 3 | **3** — looked on 1, refused on 2, joined on 3 |

**The heron is the exemplar and it costs the most to get.** It flushes at
`kyoHERON_NEAR` = 9 m, and the herd's earshot is 15 m — so it can only be
recruited from OUTSIDE its own flush radius, three times, without startling it.
One bird, and it is worth more than the hundred and eighty pigeons.

**THREE ANIMALS WERE OFFERED AND TAKEN BACK OUT**, and the reasons are the rule
for what may be offered at all:

| | |
|---|---|
| **the leopard seal** — was to be the second obey 3 | `antSEAL_NOTICE` is 24 m and puts her to `watching`; closer puts her `in`. The herd carries 15 m, so **there is no distance at which she is both on the floe and inside earshot** — measured `n: 0` on every wheek of every attempt, gating first on `hauled` and then on `hauled \|\| watching`. Her marquee IS her leaving the ice to inspect you. |
| **the Pantanal caimans** | They are load-bearing FLOORS (`panCaimanTop`) with `panPoolBox` colliders baked at build time. Moving one desyncs mesh from collider. |
| **the Pantanal capybaras** | A native follower system already owns them and two would fight over the same nine animals. |
| **the Quay's apron gulls** | They store a PERCH INDEX, not a position — there is nothing to write. |

**An offer that cannot be completed is the exact bug this pass exists to find**,
so all four are comments where the offer would have been rather than dead code.

Three things that were bugs or were measured:

| | |
|---|---|
| **forcing the skill in a tick loop does not work for this one** | `herdUpdate()` runs at the END of `systems.update()`, which is after the skill table has rewritten `learn('herd')` from the task list — so every recruit was undone on the frame it was made and the first run measured `following: 0` everywhere. The tell was exact and worth keeping: 21 pigeons looked, 14 (the cap) were recruited and dropped, and the 7 over the cap kept `heard: 1`. Tick the real task. |
| **a tier cannot be measured on a dirty animal** | `gather` persists once ticked, so testing chapter after chapter carried the previous chapter's wheeks into the next one's arithmetic and measured a two-wheek cat joining on one. Stand 60 m off for twelve seconds and let `heardT` bleed first. |
| **`game.herdDebug()`** | Read-only, and it exists for the same reason `game.hintTarget` does: `herdKinds` is closure-local and the animals belong to four different files, so without it there is no way to ask "is there anything recruitable here, where is it, and has it heard me". The first probe walked a coarse grid hoping to bump into a pigeon. |

**Soaked** (`qa/herdsoak.js`): all nineteen chapters, six wheeks and four seconds
of running in each. No errors, no NaN. Eight chapters offer animals and eleven do
not — Pasto, the Quay, Cali, Rio, Marrakech, the Drift, Kowloon, Palawan, Son
Doong, Monte Carlo and Hanoi have no ground animal with a settable position, and
a wheek in those does exactly what it always did.

**AND THE OFFER MUST BE MADE FROM AN UPDATE, NOT A BUILD.** npc.js is created at
boot BEFORE systems.js is (…npcs → systems), so `game.herdOffer` did not exist in
the ibis spawn loop and the offer was silently skipped — Sydney reported no
recruitable kinds at all in the first measured run. It is one null check a frame,
the same way `addCritter` already has to be reached.

## THE WARDROBE (v42 — 30 Aug 2026)

Ten of the nineteen chapters ask you to do something that IMPLIES a piece of
kit, and handing it over afterwards is the cheapest delight in the game. The
dinner jacket proved the shape in Monte Carlo; this is the other nine.

**The rule for what earns one: the task has to be THE REASON YOU HAVE THE
THING.** Not a badge for finishing a chapter, not the marquee by default — the
object the task was about. That is why five of the ten are not their chapter's
`wow`:

| ch | earned by | worn | and why that task |
|---|---|---|---|
| 1 Sydney | `steal-hat` | the tourist's sun hat, askew | It is literally the hat you took, and the chapter's keepsake. The first thing this game ever asks of you. |
| 3 Circular Quay | `manly-voyage` | the ferry master's cap | Not `take-helm`. Anybody can hold a wheel in open water; the cap is for having put her alongside. |
| 6 Rio | `samba-parade` | seven carnival plumes and a gold collar | The marquee, because the parade is where headdresses come from. |
| 10 Venice | `gondola-ride` | the gondolier's boater and neckerchief | Not the marquee. Stand on the prow of a gondola and you have effectively applied for the job; `acqua-alta` is a flood. |
| 12 Palawan | `first-dive` | mask and snorkel | The moment the game hands over a verb it then keeps for ever. The only costume in the set that is equipment rather than uniform. |
| 13 Cappadocia | `sunrise` | the pilot's leather cap, goggles up | The marquee: the sun clearing the rim is what a pilot is up there for. Nobody puts a flying cap on to walk an envelope. |
| 14 Manly | `all-the-way` | the surf lifesaver's cap | Not `take-off`. The club does not give you the cap for standing up; it gives it to you for the whole wave. |
| 16 Son Doong | `the-doline` | the caver's helmet, lamp lit | Not `great-wall`. The helmet is for having been deep enough that light is a thing that happens to you. |
| 17 Antarctica | `orca-ride` | the expedition hood and its fur ruff | The marquee, and the last one in the journey. |
| 18 Monte Carlo | `black-tie` | the dinner jacket and sunglasses | The task IS the object. |

**One system, one verb.** `capy.wear(id)` hides the lot and shows one, so there
is no state to get out of step and no order to get wrong. `capy.dress(on)`
survives as the v39 name for `wear('black-tie')`. Every costume is TWO groups —
one on `capySquash`, one on `head` — because headgear on the body leaves the
face the moment the animal looks up, and a jacket on the head swims on every
hop. The table lives in systems.js as `sysWARDROBE` and is asked every frame;
the loop stops at the first row whose biome is live, so a second row for a
chapter would be dead and is not written.

**Scoped to the chapter on purpose.** A costume that travels is a different
game: the jacket is Monte Carlo's joke and the mask is Palawan's verb, and an
animal wearing either in Son Doong is in fancy dress rather than the thing it
just earnt.

Five things that were measured or were bugs:

| | |
|---|---|
| **the ears are at head-y 0.12–0.28 and the skull top is 0.18** | So a brim wide enough to matter sits BELOW the ear tips and they come through it. A hat that clears the ears is a hat floating over an animal. |
| **a capybara has no neck** | The skull box runs z 0.08–0.58 and the jaw 0.52–0.76, so nothing between the shoulders and the muzzle is ever on screen. Anything meant to read as a collar — the wing collar, the neckerchief — goes under the jaw's FRONT. The tux's first pass put a shirt on the chest and it was invisible from every angle. |
| **`capyLeather` was a capybara** | 0x7d5334 on 0xb0784a: the flying cap went on in warm Cappadocian light and DISAPPEARED. The palette block states the rule — every value is one the animal's own three browns are not — and then broke it. Dark and cool now, and the shearling trim does the separating, which is what makes a leather cap read as one anyway. |
| **Rio's collar was two boxes on the shoulders** | From three-quarter front they read as one gold shard sticking out of the animal's side. It is a ring round the base of the skull. |
| **the parka ruff has a GAP, and the gap is symmetric** | An arc that simply stops after 86% of a circle leaves a bald quarter on one side and the hood looks knocked askew. 0.95 rad open, centred on the jaw. |

**The lamp is the one emissive in the set**, because Son Doong is the only place
dark enough for the difference between a lit lamp and a white box to matter.

**Nothing joins `wetParts`** — the soak swaps a mesh for its wet twin, and a hat
with no wet twin comes out of the harbour wearing the belly's colour.

**Measured** (`qa/wear-smoke.js`): 31 meshes drawn bare; each costume adds 4–18;
wearing all ten in sequence and settling on one leaves exactly that one's count,
so nothing leaks; `wear(null)` returns to 31; an unknown id takes everything off
rather than throwing; and the ghost bake puts back what was on. The count has to
walk each mesh's PARENTS — `traverse` does not stop at an invisible node and
every costume mesh is `visible: true` inside a hidden group, so an `o.visible`
test alone reports the same number dressed and bare. That is the same trap the
ghost bake had to be fixed for and it will catch the next person too.

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
an event, because a save restore, a chapter change and a picker jump are three
places an event does not fire, and `wear` is idempotent.

...and once there was one costume it was obvious there should be ten. See
**THE WARDROBE** below.

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
