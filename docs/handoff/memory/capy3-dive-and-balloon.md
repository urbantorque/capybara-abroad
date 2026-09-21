---
name: capy3-dive-and-balloon
description: "Chapters 12 and 13 — the dive and the balloon, and the five ways a new verb quietly fights an old one"
metadata: 
  node_type: memory
  type: project
  originSessionId: 50745730-c475-475b-977f-7ff2e23e2e8f
  modified: 2026-08-19T09:54:55.071Z
---

Built 19 Aug 2026. THIRTEEN biomes now: `palawan` (chapter 12, prefix `pal`) and `goreme`
(chapter 13, Cappadocia, prefix `gor`) join the eleven in [[capy3-progression-chain]].

**Palawan — `canDive`.** Twelve chapters treated water as a wall, a floor or a road and never
as a ROOM. Hold E in the water and go down; release and buoyancy brings you up; Space kicks for
the surface; **the breath is the stamina bar**. E is also grab, so `capyDIVE_GRACE` (0.42 s)
holds depth after the key comes up — a TAP is a grab, a HOLD is a dive, and neither fights the
other. The chapter's one locked door is a rock lintel 1.55 m UNDER the surface: the new verb is
literally the key.

**Cappadocia — one lever.** A burner that takes ~4 s to answer, no vent, no stick input at all,
and the wind goes a different way at every height, so you steer by choosing a height. **The vent
had to be deleted**: Space is the hop and the hop is how you leave the basket, so a vent on Space
throws the animal over the side at sixty metres. The wind map is drawn as 120 cloud wisps moving
at their own layer's speed — the UI is out of the window, not on the HUD.

**THE FIVE TRAPS, all measured, none of them guessable:**

1. **The sea-wall clamber fires underwater.** It arms on "in water, holding the stick, not making
   much progress", which underwater is true every time you slow down. A capybara that paused on
   the seabed was hauled 11 m to the surface at 4 m/s and pinned under the tunnel roof. Add
   `&& !capyDiving`.
2. **The buoyancy spring is proportional to the gap** — harmless at knee depth, 84 m/s from an
   11 m seabed. Clamp it.
3. **`sysCAM_FLOOR` (1.7) is a CEILING in a world whose ground is at −11.** The camera could never
   go under, so the whole second look never fired. It is a biome hook now: `camFloor(x, z)`.
4. **The standing rig puts the lens ~6 m above the animal.** A dive to 2 m leaves it in the air.
   But flattening the rig to nothing puts it *inside a table coral*. 5.0 m at 0.12 rad is the pair
   that works. Cappadocia has the mirror problem: the envelope sits directly over the basket, so
   the default rig films the whole flight from inside the balloon — 15 m at 0.62 rad.
5. **A moving floor must DECLARE its frame, not be sniffed.** A basket carrying the animal upward
   at the same rate it is rising barely penetrates its own floor, and a contact that is barely
   there is sometimes not there — the capybara fell out within a second of the wind taking it,
   every time. New hook `carryFrame()` → `{x, z}`, applied into the same platVX/platVZ channel as
   a ferry deck (see [[capy3-reference-frames]]). Vertical is still assigned from inside the biome
   (the channel is horizontal-only) — the Drift's puff trick.

**And two content lessons.** A world whose interesting half is *behind a door* will ship with the
door's far side empty: the hidden lagoon and the cathedral both had literally zero meshes in them
until measured. And a wind with no containment puts the balloon 400 m outside the world in ninety
seconds — the rim curl (`gorRIM` 52 → `gorRIM_HARD` 86) both fixes it and has to be tuned so it
parks you INSIDE the scenery, not in a ring around it.

Related: [[capy3-biome-build-gotchas]] (the karst is static boxes, not heightfield — a vertical
face is a RAMP at any cell size and the analytic backstop levitates you up it),
[[headless-qa-harness]], [[capy3-world-size-audit]]
