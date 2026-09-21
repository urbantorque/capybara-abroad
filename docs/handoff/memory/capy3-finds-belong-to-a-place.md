---
name: capy3-finds-belong-to-a-place
description: "The Delight Pass — the half of the finds design that was never built, and the six ways a place find fails in total silence"
metadata: 
  node_type: memory
  type: project
  originSessionId: aee9b1ad-3fc5-4342-bbc3-42bb76fcdb4d
  modified: 2026-08-24T07:52:19.830Z
---

24 Aug 2026, the session after chapters 16 and 17. **The headline was a measurement, not an
idea: all twenty finds were chapter-neutral, and the two fields the design reserved IN WRITING
for the other half — `chapter` and `where` — appeared on no row and were read nowhere in
systems.js.** Every find was a question about the moveset or the clock (dive, climb, cold,
breath, stillness, distance, being watched, high point, far corner, long drop), so all twenty
worked identically in seventeen worlds. Notice something in Venice, get the sentence Iceland
gave you. Thirty-four now, two per chapter. See [[capy3-the-paper]] for the other tables.

**THE FOURTH RULE IS WHAT MAKES THEM FINDS: a place find may not be a task with the paper
taken away.** Test — could a player plausibly do it without ever knowing it was there? Nine of
the thirty-four are *you were there and you did nothing*; several are the deliberate opposite
of the chapter's own task on the same spot (still in the bamboo against `bamboo-dash`, walking
up to the mirador against `chiva-mirador`, under the Arcos da Lapa against `o-bonde`, ignored
in the rookery against `colony-chorus`).

**THREE THINGS IN THE WORLD WERE NOT TRUE AND HAD TO BE MADE TRUE.** All three are the same
shape as the tell the rain code already names in its own comment — *"an animal that walks
through a sixty-second downpour and comes out with a dry coat is the tell that the weather is
a decal"*:

- **The Botanic Gardens sprinkler did not make you wet.** Since v1, and its whole job is to
  soak a *tourist*. New optional biome hook `soaking(x, z)`, taken as a FLOOR on `capyWetLevel`
  exactly as the sky is.
- **None of Sơn Đoòng's twenty-six drips could land on you.** They fall forty metres and ring
  the floor and went straight through the animal. cave.js's `soaking` ACCUMULATES (≈4 s under
  one, gives back at twice the rate, caps at 0.62 — damp, never a swim).
- **The heron, the arctic fox and the Harbour Bridge could not be asked where they were.** The
  fox has answered a wheek and come two thirds of the way toward you since it was built.

**SIX WAYS A PLACE FIND FAILS, AND EVERY ONE OF THEM IS SILENT — this is the real content:**

1. **A point may be a fixture OR a mover and guessing wrong never throws.** `craterCentre` is
   a `Vector3` constant; `carroza()` is a call. The crater's find was written
   `typeof a.craterCentre !== 'function' -> false` and was simply unreachable. `findPt(v)`
   resolves either. Neither the audit nor a soak would ever have shown it.
2. **A latch that rises with PROGRESS is not a clock.** `caliNightT` only climbs while you are
   on the chiva, so "on the dance floor when the lamps came on" is a moment you are provably
   somewhere else. Measured: `night()` never left 0 in 90 s of standing on the floor.
3. **A 0..1 ramp read as a flag spends its edge at 4e-7.** Göreme's `sunUp()` is a ramp;
   `findEdge(..., !!a.sunUp())` fired on one tick at the very bottom of dawn and was gone for
   ever. Use a WINDOW (0.02..0.98 held 3 s), not an edge.
4. **A published mover may not be near the thing it is named for.** `balloon()` is the one
   basket at the launch field, seventy metres from the landing zone, at `altitude()` 0 until
   you fly it. "Standing in the landing field when one comes down" measured impossible.
5. **Excluding a zone that matches nowhere reads exactly like excluding one that does.** A
   grid probe over the whole map found `quayInZone('quay', …)` true at no point — it answers
   apron/manly/corso/deck only. Worse, the berth (z 6) is OUTSIDE the apron zone (z 16-44), so
   "stopped in the middle of the harbour" would have paid out while still tied up. Use
   `voyageProgress()` — the thing actually meant.
6. **No speed threshold works on ice.** The Antarctic colony reads `groundSlip` 0.66, the idle
   grip is off, and a parked capybara crept half a metre in 35 s while reaching 1.78 m/s and
   still climbing. Whatever number you pick, twenty seconds will cross it. **Judge stillness by
   DISPLACEMENT there.** (`perfectly-still`, one of the shipped twenty, is unmeetable in
   Antarctica for this reason — legal, because it is chapter-neutral.)

And one that was a test bug, not a game bug: **a swept sprinkler is intermittent.** The rotor
runs at 1.35 rad/s over a ±1.05 half-angle, so `sprays(x, z)` is true for a point in pulses
about twice per 4.6 s and a continuous hold on the SECTOR can never be satisfied by anybody.
Hold on the CIRCLE and let `wet` (decay 1/8 per s) ride the pulses — it stays 0.77-0.92.

**THE PROOF STANDARD, because a find that throws is swallowed and then looks exactly like a
find that is merely not met.** `findTick` now writes `game.state.lastError` once per id on a
throw, so `qa/fuzz.js` doubles as a predicate-throw sweep across all seventeen.
`game.noticed(id)` was added purely so a find can be asserted (nothing in src reads it). All 34
were driven to fire headlessly: position/dwell by teleport-and-park, water by dropping below
the surface, dive by holding `input.action`, the boat by `input.z` (NOT `forward`/`throttle` —
those do not exist). **The four gated on a one-way latch (cali night, sahara dusk, drift lit,
pantanal dusk) were proven by forcing the getter in source, building, verifying and reverting**
— `git diff` clean afterwards. That is the honest way to test a latch you cannot reach.

Harness notes that cost time: `game.env` has **no** `terrainHeight` (Sydney is flat) — wrap it.
A `park()` helper that re-teleports EVERY frame never reports `grounded`; only re-place when it
drifts. `qa/audit-tasks.mjs` finds a FINDS row by matching `id` immediately followed by `text`,
so **every new field goes after `text`** or the row vanishes from four of six checks.

Related: [[capy3-the-paper]], [[headless-qa-harness]], [[capy3-reference-frames]],
[[capy3-slip-and-sky]], [[capy3-the-backlog-closed]], [[capy3-progression-chain]]
