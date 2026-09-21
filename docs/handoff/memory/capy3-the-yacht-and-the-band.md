---
name: capy3-the-yacht-and-the-band
description: "v39: the sun deck that was inside the deckhouse, the band that had no writer, and the game's first costume"
metadata: 
  node_type: memory
  type: project
  originSessionId: 888a28cc-359f-4fe1-8a49-90d7217b8d22
  modified: 2026-08-29T12:56:27.199Z
---

Reported from play, 29 Aug 2026: "it did not seem possible in Monte Carlo to reach and pick up
the dinner jacket". It was not. Three findings, and the first two are the same bug in two
different files.

**1. A DECKHOUSE COLLIDED AS A SOLID BOX SWALLOWS THE DECK ABOVE IT AND EVERY STAIR
INSIDE IT.** `monBuildYacht` collided cabin 1 as `y+3.4 .. y+6.6` and cabin 2 as
`y+6.3 .. y+9.3`, while the decks they carry are at `y+6.2` (bridge) and `y+9.0` (sun). Both
deck slabs were therefore buried 0.3–0.4 m inside the house standing on them, AND both
companionways — drawn at local x ±2.2, z −6..−2.3 — were inside those same boxes, tread by
tread. A drop test on a grid over the boat measured exactly three standable heights: 2.8 (main
deck), 6.0 and 8.7 (the two ROOFS). `capyJUMP_V` peaks at ~1.2 m of rise. There was no route
above the main deck at all, so `black-tie` and `high-dive` were both uncompletable — for three
versions, with the card pointing at the jacket and printing its range all evening.

The rules, and they generalise to any building with two floors:
  - a deckhouse collider STOPS AT THE DECK IT CARRIES (`monDECK1..monDECK2`, not +0.4)
  - a companionway must be IN OPEN AIR — flight A on the aft deck abaft the house, flight B
    on the foredeck ahead of the next one, climbing aft
  - the WALK BETWEEN two flights has to be walkable too: at the sun-deck house's old width
    (`B − 2.4`) the side deck was 70 cm. `B − 3.8` gives 1.4 m.

**HOW IT WAS FOUND AND WHAT ACTUALLY WORKED.** Three probes, in order of usefulness:
  1. `qa/tux3.js` — DROP THE ANIMAL FROM 20 m ON A GRID AND RECORD WHERE IT SETTLES. That is
     the true standable surface and it took thirty seconds to write. Reading collider extents
     out of `world.bodies` came second and was harder to interpret.
  2. `qa/tuxwalk.js` — WALK THE ROUTE AS A LIST OF LEGS with a closed-loop steer, and report
     per leg. It is the only thing that proves a route, and the first run's failing leg was my
     own waypoint inside the house rather than a bug.
  3. Do NOT drop-test a staircase. From 14 m the animal bounces off a 0.72 m tread and the
     column reads as noise. Drop tests find FLOORS; walks find ROUTES.

**2. `musBondHeat` HAD FOUR READERS AND NO WRITER.** Same shape as `monEYE_FILL` 0.60: an
arrangement with a documented top end (doubled brushes, harder tremolo, horns every 4th bar
instead of 8th, +20% level) that no session had ever reached, because the number was
`let x = 0` and nothing assigned it. Driven now from `game.monaco.heat()` — the eye, the stack
and the circuit — damped up in 0.2 s and down over 2 s.
Two more in the same palette: the riff's `for (half = 0; half < 2)` resolved to
`(half*16 + r.t)` sixteenths in a SIXTEEN-sixteenth bar, so every bar played its figure twice
in exact unison with itself; and chord 0 was `E B D F#` (Em9, no third) where the idiom's whole
identity is the minor third and the MAJOR SEVENTH sounding together — `E G B D# F#`.
**A generative-score palette can be entirely correct and entirely inaudible.** Grep every
`let mus*` for an assignment before believing a band is playing.

**3. THE COSTUME, and a capybara has no neck.** `capy.dress(on)` — the game's first — is
twelve boxes built once at `createCapybara` and hidden. Jacket + lapels on `capySquash`,
sunglasses + wing collar + bow on `head`; nothing joins `wetParts` (no wet twin = the belly's
colour out of the harbour). Asked every frame in `update()` from
`isActive('monaco') && taskRec['black-tie'].done`, not raised on an event, because a save
restore, a chapter change and a picker jump are three places an event does not fire.
The first pass put the shirt at chest z 0.30 and the tie at head-y −0.115 and BOTH WERE
INVISIBLE FROM EVERY ANGLE: the skull box runs z 0.08–0.58 and the jaw 0.52–0.76, so there is
nothing between the shoulders and the muzzle that is ever on screen. The only readable throat
on this animal is the 4 cm under the jaw's front.

**HARNESS, TWO MORE (both cost a run):**
  - `playwright-cli close-all` IS GLOBAL, not per `-s=` session. Opening a second session to
    take screenshots while a ten-minute sweep runs is fine; calling `close-all` in it kills the
    sweep with "Target page, context or browser has been closed".
  - `playwright-cli ... &` inside a Bash tool call DIES when the call returns. Use the tool's
    own `run_in_background`.

`game.hintTarget(id)` was added to systems.js for the audit: `sysHINTS` and its dozen `hint*`
helpers are closure-local, so before it the only way to read a task's target from outside was
to re-implement all of them — which is why the sweep that found this had to be written against
physics instead. One getter, no setter, returns null for anything that throws.

Related: [[capy3-monte-carlo]], [[headless-qa-harness]], [[capy3-solid-or-drawn]],
[[capy3-lattice-not-element-size]], [[capy3-five-things-already-built]]
