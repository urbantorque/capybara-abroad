# BATCH ONE — the world sits in itself, and it moves

**Est. 4–5 h. Two phases, a commit at each boundary.**

This is the safe batch. Two shared shader terms, both opt-in, both defaulting to
today's behaviour. **No new draw calls, no new lights, no new materials, no
re-grading.** Nothing in it can move a bloom threshold, which is exactly why it
runs first and why it is safe to run unattended.

Read the shared preamble in `../SKILL.md` first — the aesthetic law, the eight
harness traps, and the five conditions that make a phase done.

---

# PHASE 1 — CONTACT

**Est. ~2.5 h.** ~1 h of shader and pooling, the rest wiring and looking at it.

## The finding

There is no ambient occlusion, no contact darkening, and no grounding term of
any kind anywhere in the build. It is visible in six of six photographs taken
for `qa/PRESENCE-PASS.md`:

- `qa/na-sydney.png` — the capybara casts a soft offset sun shadow and has
  **no darkening under its feet at all**. The bench legs, the jacaranda trunk
  and the sandstone kerb all meet the lawn on a clean seam.
- `qa/na-monaco.png` — bollards, lamp post and capybara all float.
- `qa/na-rio.png` — on the best floor in the game, the capybara sits on the
  white band like a sticker.

The polish pass's rim solved the other half of this: it separates a silhouette
from the **background**. Nothing separates it from the **floor**, and that half
is what makes a flat-shaded object read as resting on a surface rather than
drawn over one.

## Two things this must not be

1. **Not alpha-blended dark quads.** Sydney already has flat lilac jacaranda
   decals on the lawn (`na-sydney.png`) and they are the worst-looking thing in
   that frame. A second family of flat blobs is not the answer, and decals also
   bring z-fighting on a heightfield and transparency sorting against the motes.
2. **Not a real AO pass.** No SSAO, no second render target, no depth prepass.
   The composite pass is already doing enough work and this is a flat-shaded
   low-poly game, not a deferred renderer.

There is also **no shadow-blob system to hang it on** — the game uses real
shadow maps throughout. `registerShadowTarget` (`systems.js:5213`) is the only
existing registry of grounded things, and it is the natural feed.

## The work

### 1. `sysContact` — a nearest-N pool (`systems.js`)

A fixed-size ranked pool, identical in shape to the one phase 3 will need for
lights, and **written to be reused by it**:

- A hard slot count, constant for the life of the program so three never
  recompiles a material mid-run. Start at **12** and measure.
- Contributors register `{ object3D, radius, strength }`. Each frame the pool
  ranks live contributors by distance to the camera, takes the nearest N, and
  writes their world x/z, ground y, radius and strength into a `vec4[]` uniform
  pair.
- **A smooth fade in and out of the pool.** A contact patch that pops on as the
  ranking changes reads as a bug, and this is the part that will be skipped
  under time pressure. Do not skip it.
- A contributor that leaves the pool must not leave a dark patch behind.

Feed it from `registerShadowTarget`'s registry where that is already correct,
and add explicit registration for the capybara, for `props.js` bodies, and for
`npc.js` records. Radius from the object's own bounding sphere, not a constant —
a bollard and a market stall do not sit in the same footprint.

### 2. The term, in the ground materials (`shared.js`)

A new option on `grain()`, because the ground materials already all go through
it and a second injection site is a second thing to keep in sync:

    contact   0 (off, THE DEFAULT) .. ~1, the strength of the darkening

In the fragment shader, before the grain modulates the diffuse: for each of the
N slots, a smooth radial falloff on the horizontal distance from the fragment's
world position to the slot centre, attenuated by the vertical distance so a
prop on a balcony does not darken the street below it. Multiply the diffuse.

Three things to get right:

- **It multiplies `diffuseColor`, not `outgoingLight`.** The rim is added to
  outgoing light on purpose — it is light. This is occlusion: it is the absence
  of light reaching a surface, so it belongs on the albedo, where the sun's own
  shading then acts on it. Getting this backwards makes contact patches that
  survive into shadow at full strength and read as paint.
- **It composites under the grain**, so the ground's own texture still reads
  inside the darkened ring.
- **Keep it shallow.** The target is a soft ring a little wider than the object
  and no more than about 25–35% darkening at the centre. This finding is about
  contact, not about drama.

### 3. Opt in, chapter by chapter

Nineteen grounds. `contact` defaults to 0, so nothing changes until a call site
asks. Turn it on ground by ground and look at each one.

## Acceptance

- **Sydney, Rio and Monte Carlo screenshotted before and after and looked at.**
  In each, the capybara, one prop and one NPC must visibly meet the floor. Rio
  is the hard case — a dark ring on the white band of the calçadão is where this
  will look wrong first if the strength is too high.
- **The capybara walks a straight line across a lawn and the patch follows it
  without popping.** Watch for it specifically at the moment a twelfth
  contributor displaces a thirteenth.
- **A prop on a balcony or a stall roof does not darken the ground under it.**
  Hong Kong and Venice both have stacked geometry; test one of them.
- Ground-band SD from `na-scan.js` before and after, eight chapters. It will
  move — that is fine and expected — but **Palawan's mean luminance must not
  drop by more than about 4/255**. A contact term is not a way to fix a flat
  floor by darkening it, and if it starts doing that work the strength is wrong.
- Frame time before and after, stated as a number.

---

# PHASE 2 — SWAY

**Est. ~2 h.** ~40 minutes of shader, the rest choosing what sways and by how
much.

## The finding

`wxMOOD` in `weather.js` carries a real, authored, per-place wind — nineteen
rows of `gust: { base, swing, hz }` and a bearing `dir`. Sydney is 3.4 m/s
swinging 1.6 at 0.070 Hz on a bearing of 1.90 rad; Kyoto is a still 1.1; Pasto
is 2.6 swinging 1.9. It is damped, it gusts, and it has a direction.

Consumers of `api.wind()` across all 27 modules:

    src/capybara.js:845     the drift's air frame
    src/props.js:2900       the shove on a loose prop

**Two, and neither of them is the picture.** A grep across every module for
foliage, canopy, frond, banner, awning, laundry, bunting, sail, tarp or flag
motion — any per-frame rotation, any vertex displacement, any sway — returns
nothing. **There is no vertex animation anywhere in this game.**

And there is no shortage of subjects; cloth and foliage nouns per module:

    palawan 198   manly 146   sahara 126   kowloon 123   quay 112
    kyoto 75      venice 57   drift 46     pasto 41      rio 37
    pantanal 35   monaco 31   cali 29      antarctic 26  ...

This is the largest aliveness gap in the build and it costs no draw calls.

It is also the delight item in this pass. The gust already shoves props
(`props.js:2900`) — the player feels a cause they cannot see. A world that leans
into the same gust makes an invisible physics term readable.

## The work

### 1. `sway(m, opts)` in `shared.js`

A new exported helper in the same `onBeforeCompile` style `grain()` established,
and following every one of its conventions: shared uniforms updated once per
frame by a `swayTick()`, a `customProgramCacheKey` so hundreds of swaying
materials share one compiled program, and options that default to zero.

The vertex term displaces `transformed` before `<begin_vertex>`'s successors,
by an amount proportional to the vertex's height **above the object's own
base**, so a trunk stays planted and a canopy moves:

    amount    metres of travel at the tip, 0 (off, THE DEFAULT) .. ~0.5
    stiff     the exponent on the height ramp: 1 = a rope, 3 = a trunk
    phase     a per-instance offset so a row of parasols is not one organism

Driven from a shared uniform block written each frame from the live weather:
gust magnitude, bearing, and a slow clock. Two frequencies, not one — a slow
lean on the gust envelope and a faster flutter on top of it, or every awning in
Kowloon breathes in unison.

### 2. Four things that will go wrong, and the guard for each

- **Two writers on the same vertex.** Anything already animated in JS must not
  also sway, or the two fight. Grep the chapter for existing motion before
  opting a mesh in.
- **A merged mesh has one origin.** Most chapter geometry is merged into one
  draw call, so "height above the object's own base" is the *merged* base, and
  a canopy 12 m up sways as if it were 12 m of rope. Either supply the base as a
  vertex attribute when merging, or opt in only meshes that are not merged, or
  clamp the ramp. **Decide this before writing the shader, not after.**
- **Shadows.** The shadow pass compiles its own program. A mesh that sways in
  the colour pass and not in the depth pass has a shadow that detaches from it.
  Either inject into the depth material too, or exempt swaying meshes from
  casting.
- **Collision.** Nothing that sways may be something the capybara stands on or
  is blocked by. This is a picture term only; the physics body does not move.
  Check the solid index (`makeSolidIndex`) before opting a mesh in.

### 3. Opt in, place by place

Start with the four chapters with the most subjects and the most authored wind —
**Palawan, Manly, Marrakech, Hong Kong** — then work down. Kyoto's row is a
still 1.1 m/s and should barely move; that is the table doing its job, not a
bug.

## Acceptance

- **Palawan, Hong Kong and Manly screenshotted at two moments about 1.5 s apart
  and both frames looked at.** Foliage and cloth must be in visibly different
  positions; the ground, the buildings and the capybara must not.
- **Kyoto must be nearly still** and Pasto must be visibly windier. If the two
  look the same, `wxMOOD` is not actually reaching the shader.
- **Nothing the player stands on moves.** Walk onto every swaying surface you
  can reach in one chapter and confirm the capybara does not shear off it.
- **Shadows stay attached.** Screenshot a swaying palm with its shadow on sand
  and look at it.
- Frame time before and after, stated as a number. A vertex term across a few
  hundred meshes should be unmeasurable; if it is not, something is compiling
  per-material and the cache key is wrong.
- **No boiling at distance.** A high-frequency vertex term on far geometry
  aliases the same way the grain did. Look at the far end of Copacabana.

---

## At the end of batch ONE

Commit, then state:

1. The eight-chapter ground table before and after, and the frame time.
2. Which grounds have `contact` on and which are still at 0.
3. Which meshes sway, per chapter, and which were deliberately left out and why
   (merged origin, existing JS motion, solid).
4. Whether batch TWO is safe to start — specifically, whether contact darkening
   has changed any chapter's ground luminance enough to matter to phase 3's
   light placement or phase 5's grade re-validation.
