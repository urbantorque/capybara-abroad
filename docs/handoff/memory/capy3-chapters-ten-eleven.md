---
name: capy3-chapters-ten-eleven
description: "Venice and Hong Kong (capy3 chapters 10 and 11) — the movable waterline, the climb hook, and the five bugs that made both marquee moments impossible"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6cafba14-b59c-4b34-9fc3-4981c76be36b
  modified: 2026-08-19T04:54:57.915Z
---

Built 19 Aug 2026. Venice is a tide; Hong Kong is the first vertical chapter.

**THE WATERLINE CAN MOVE NOW, AND EVERY OTHER CHAPTER IS UNCHANGED.** capybara.js
hardcoded the sea at −0.5 in three places (swim below `y 0.2`, float at `−0.42`, stop
clambering above `1.80`). They are offsets from the live biome's `waterLevel` now —
`capySWIM_ENTER 0.70`, `capyFLOAT_OFF 0.08`, `capyHAUL_TOP 2.30`, `capySWIM_OUT_H 0.60` — chosen
so that at −0.5 they are numerically identical. Venice writes `api.waterLevel` every frame AND
in `onEnter` (without the second one the first frame of a re-entry solves against the tide you
left). `isOverWater` is `waterY > terrain(x,z) + 0.22`; the slack is what keeps two centimetres
over paving a puddle rather than a hole, because that flag switches the analytic floor OFF.

**THE LEVELS ARE THE MECHANIC, and 85 cm is not enough of one.** First cut: square at 0, city
at 0.85, tide to +0.95 — the whole island went under together and there was nothing to learn.
Square 0, Molo 1.00, calli 1.30, fondamente 1.55 makes the flood a ROUTE CHANGE. Also: the
duckboards have to clear `waterLevel + capySWIM_ENTER`, not just the water — a deck 45 cm over
the flood put the animal's centre nine centimetres under the swim threshold and it slid off.

**THE CLIMB IS `climbHold(x,y,z) -> {nx,nz,top}`**, solved in capybara.js like slip and wind.
Stick INTO the face is up, away is down, sideways shuffles, Space kicks off. Two traps, both
measured, neither guessable:
- **The band must reach THROUGH the wall.** The cling pulls the animal at `capyCLIMB_STICK`
  and the building's collider stops it half a metre further in, so a band ending at the lattice
  face let go on the frame after it took hold, every time.
- **`top` must be ABOVE the deck it serves.** Clinging stops past `top` and hands over one
  shove; top 33 against a roof at 34.2 left it airborne at 3.5 m/s, which buys 26 cm, so every
  successful climb slid back down.
- **A working deck spanning the bay is a CEILING.** The climb stalled dead at 5.4 m under a
  deck at 5.8. Every real scaffold has a ladder hole; put one at the middle of the run, aim the
  task beacon at it, and the player stands in it without having to notice.
- **Stamina has to be costed against the actual climb.** 0.115/s over a 35 m scaffold is 1.7
  bars of a bar that holds 1.0 — arithmetically impossible. 0.042/s while ASCENDING (free while
  hanging) is half a bar. And being blown must take the UP away and leave the grip, not drop
  you: a fall you cannot see coming is a punishment, and the decks are somewhere to wait.

**A LAMBERT BOX IN A NIGHT SCENE IS BLACK.** Ninety neon signs over Mong Kok rendered as ninety
black rectangles — the premise (monochrome city, light is the only saturated thing) inverted
into a monochrome city with holes in it. `MeshLambertMaterial` has an `emissive` term, which is
what a sign IS. It is a UNIFORM, so per-instance colour is impossible: one InstancedMesh per
colour (six draw calls for a whole street) and one mesh per tower for the sixteen that light on
the beat. Cheaper than it sounds and it buys per-colour breathing for free.

**TINT THE COLOUR, NOT THE LIGHT.** The flooded square is one translucent sheet, and the
obvious way to make it read as a mirror is to push it toward the sky. Doing that with the
material's EMISSIVE term is wrong and it fails in the most confusing possible way: at full
tide it added (0.32, 0.29, 0.25) to every pixel, which is very nearly the colour of the dry
trachyte underneath, so the water became invisible and the marquee moment silently stopped
happening on screen — while every number said it was working (tide 0.995, capybara wet 1.0 and
floating at waterline + 0.08, all 180 pigeons airborne). Emissive is for things that EMIT:
signs, lamps, a lit tower. A wet surface is a colour. One lerp of material.color, kept under
half way, and the paving still reads through it.

**LAY THE WORLD ALONG THE CAMERA'S AXIS.** The rig looks down −z by default and its frame's top
edge points 17° BELOW horizontal, so nothing beyond ~24 m is ever in shot. Piazza San Marco laid
ACROSS that view was a photograph of paving with two beige strips at the edges; turned 90° so
the square runs away from the camera, the same geometry is the view everybody knows. Corollary:
put something TALL within about ten metres of every spawn — the two columns were moved to five
metres in front of the arrival point purely so the first frame has a composition in it.

Related: [[capy3-progression-chain]], [[capy3-slip-and-sky]], [[capy3-visibility-metrics]],
[[capy3-biome-build-gotchas]], [[capy3-render-pose-heuristics]]
