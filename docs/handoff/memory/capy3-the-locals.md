---
name: capy3-the-locals
description: "capy3's shared NPC rig for the fourteen chapters that had nobody in them, and why a pause that only stops the solver is not a pause"
metadata: 
  node_type: memory
  type: project
  originSessionId: 77c748fb-b63b-405b-88c5-6ccb693f86fc
  modified: 2026-08-20T15:44:51.219Z
---

Built 21 Aug 2026, from "some NPCs could look a lot more developed, similar to Sydney and
Pasto". The diagnosis was not that the other worlds' people were badly modelled. It was that
**they were props shaped like people**: Rio's biscoito Globo man is a cylinder, a sphere and a
hat merged into the beach mesh, and nothing in fourteen chapters ever ACKNOWLEDGED the animal.

`npc.js`'s cast — the articulated rig, the state machine, the speech bubbles — was gated behind
`biomeLive()`, which is `isActive('sydney')`, with Pasto's crowd on a parallel `paLive()`. So a
speech bubble was a thing that could only happen on one lawn in the world.

**THE LOCALS are the ninety per cent of that which is not a rewrite.** `game.addLocal({biome,
x, y, z, lines, wheek, near, figure})` registers a point in one chapter and gets:

- a line when the capybara comes within `near` (7 m), on a cooldown, never the same one twice;
- a different line when it WHEEKS, at 1.9× the radius, because being shouted at across a
  square is exactly the sort of thing that gets a stranger's attention;
- a body — legs and torso merged, head and both arms on their own nodes — that **turns to
  watch you** at 2× the talking radius, dips its head for something capybara-sized, breathes,
  and lifts one arm while it is actually speaking.

The turn is the cheap half and it is most of the effect: a figure that tracks you across a
square stops being scenery about four frames in. Thirty locals across twelve chapters; two or
three are ever in a frame; frame budget unchanged.

**Four things that make it work and would each have broken it:**

1. `updateBubbles()` and `localsStep()` had to move ABOVE the Sydney gate in `npc.update`,
   including into the early-return branch. That is the whole reason bubbles were Sydney-only.
2. The figure is added with `game.scene.add` DURING the biome's own build, so main.js's capture
   tag owns it and it detaches with the chapter. A figure registered outside a build follows
   the player around the world for ever.
3. The bubble reader wants something with `.group.position`; a fixed local has no head node, so
   it carries a plain `{group:{position}}` anchor. No change to `updateBubbles` at all.
4. Anchors must be on LAND. Two were not: Kyoto's miller (the whole reach round the mill is
   -1.7 to -4.3, i.e. the bed of the Uji) and the Pantanal drover (the channel). Bubble sits at
   `y + 1.35`, so both were talking from under the water. Probe `terrainHeight` before trusting
   a landmark constant as a place to stand.

**AND A PAUSE THAT ONLY STOPS THE SOLVER IS NOT A PAUSE.** `game.state.paused` (journal open,
or `document.hidden`) gated exactly one thing in main.js: `world.step`. Every module carried on
at full rate — so behind an open journal the tram still dinged, the storks still clattered, the
tide still came in and the ambience still fired. Measured with the journal open for eleven
seconds per chapter, FOURTEEN of the sixteen were still asking for sound. The fix is one
`continue` in the updater loop, skipping every module except `systems` — which must keep
running, because it owns the line that decides whether the game is paused at all, so skipping
it would make the pause a one-way door.

Sound has a second gate of its own now, inside `sfx()`: nothing plays unless
`state.started && !paused && !document.hidden`, with an `opts.ui` escape for a menu's own
noises. And Sydney's seaplane was a drone after all — one `hiss` every 1.4 s within 150 m, on
a world 160 m across, for 68 seconds out of every 75. Eleven of them in a fourteen-second idle.
Now 85 m, and the gap OPENS WITH DISTANCE.

Related: [[capy3-controls-one-voice]], [[capy3-catch-all-state]], [[headless-qa-harness]]
