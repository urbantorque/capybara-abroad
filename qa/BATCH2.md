# BATCH 2 — The payoff, and chapters 1-3 (Payoff Pass)

Started 25 Aug 2026, on `claude-opus-5`. Brief: `qa/PAYOFF-PROMPTS.md` § BATCH 2.
Predecessor: `qa/BATCH1.md` (complete, all green, CONTRACT v23).

## Carried in from batch 1

- The mischief economy and the auto-loaf ARE in the tree, so job 4 pillar 2 has
  something to certify. Harnesses: `qa/pf-mischief.js`, `qa/pf-loaf.js`.
- `capy.loaf` (0..1) and `capy.loafAsk` are published — a chapter that wants the
  animal to sit where the rest timer cannot reach writes `loafAsk = 1` per frame.
  **The finale wants this.**
- `game.physics.rescue(prop)` and `game.physics.typeOf(type)` are new exports.
- A local may leave its anchor while `r.own` is set — any anchor-distance audit
  must gate on that.
- Save format unchanged by batch 1; old files restore.

## Checklist

### Job 1 — the finale
- [ ] Map the current end: `showEnd`, `chapterCeremony`, `chapComplete`,
      `doneCount >= TASKS.length` scheduling in systems.js
- [ ] Stage the seventeen keepsakes in the Botanic Gardens via `spawnKeep`
- [ ] Gather a cast from existing systems (locals, critters, calm, loaf)
- [ ] One last postcard beat, then the ledger
- [ ] Survives save/reload; revisitable; guarded on `chapComplete` not elapsed time
- [ ] Certified from the rendered PNG

### Job 2 — the album
- [ ] Size-capped thumbnails persisted in the save
- [ ] Album page in the journal
- [ ] One gentle photo prompt per chapter (a suggestion, never a task)
- [ ] Title-screen postcards prefer the player's own photos once they exist

### Job 3 — the first hour
- [ ] Measure fresh-save Sydney: time to each verb, hint cadence, first find,
      first travel unlock, first ceremony
- [ ] Re-sequence hints and surfacing so every core verb lands inside 10 min
- [ ] NO new tasks — re-hint and re-order only

### Job 4 — the five pillars on chapters 1-3
Sydney · Pasto · Circular Quay
- [ ] 1 Marquee certification (four channels, from the PNG at the moment)
- [ ] 2 The cast (pair-chat 13 m, after:/before:, unprompted ack, mischief chains)
- [ ] 3 Feel of the ground (footfall/slip/particles, wetness, room tone, mood, loaf)
- [ ] 4 The signature toy
- [ ] 5 Route life (no purposeless dead 20 m cells)
- Chapter notes: oldest and most-audited, so expect tail misses. Keep the gardens
  clean enough to stage job 1. **Quay is 132,423 tris against a 130k budget — no
  heavy geometry; list reallocation candidates for batch 4.**
- Cheap wins flagged by batch 1: Quay's gull registers with the critter registry
  but has no `bold`/approach; Quay has only 1 edible prop, Sydney 7, Pasto 13.

### Finish
- [ ] CONTRACT.md new version section
- [ ] qa audits for new invariants
- [ ] Project memory
- [ ] This file as the handover
- [ ] `playwright-cli close-all`

## NOTE ON THE CHAIN

**Batch 1 did not chain batch 2.** The `capy3-batch-2` scheduled task was never
created — most likely the scheduled-tasks tool was refused by the permission
classifier mid-run, which is the same refusal the setup session hit. Batch 2 was
started by hand instead. Do not assume the chain works; if batch 3 must run
unattended, verify the task exists after this batch writes its handover.

## Log

- Started. Checklist written. Scouted the three job areas before touching code.
- **Found and fixed before job 1: the loaf was given away before the first
  keypress.** `capyRestT`/`capyStillT` accrued behind the title card, so six
  seconds on the menu put the loaf at 0.54 and pressing start put it at 1.00
  within a second — every new player's first sight of the animal was it already
  sitting, camera wide, score soft. Only Sydney shows it (every other chapter
  arrives through a teleport, which zeroes both). Commit `88eb571`.
- Job 1 (the finale) built and verified. See below.

## JOB 1 — THE LAWN, as built

`CONTRACT.md` § THE LAWN. Come back to Sydney with all seventeen chapters done
and the seventeen souvenirs are laid out on the picnic lawn in a horseshoe;
walk into the mouth of it and **sit down** and that is the ending — the loaf,
then a line, then the ledger. The last thing the game asks is the first thing
it taught you to do for its own sake.

- `physStageKeep(place, x, z, restY)` — new in props.js, published as
  `game.physics.stageKeep`. `physSpawnKeep` is idempotent, which is exactly what
  stops a caller ARRANGING the seventeen, so this is the mover: spawn if absent,
  otherwise pick up the existing one and set it down where asked. Clears
  velocity/angular/force/torque, sleeps the body, and moves `homeX/Y/Z` with it.
- `sysFinaleCheck/Stage/Step/Close` in systems.js, plus `fin` in the save
  (additive, `v` does not move).
- **Two doors in**, because Sydney is the one chapter that emits no
  `biome:enter`: the biome:enter handler for a return, and the `else` branch of
  `startGame`'s `landed` test for a restored file that opens straight into Sydney.
- **Staged every time, closed once.** Leaving Sydney clears the staging flag
  because props.js huddles all seventeen at the next chapter's spawn on the way
  out. `fin` only suppresses the closing beat.

### Measured

| check | result |
|---|---|
| staging | 17/17 laid, `homeY` 0.00 (the surface — not double-counted) |
| control: loafing at the spawn, outside the ring, 11 s | ledger did NOT open |
| sitting inside the ring | fired at second 11, `paused` true, ledger shown |
| ledger contents | `MISCHIEF COMPLETE · 199 of 199 · 17 of 17 places · 17 kept` |
| save | `fin: 1` persisted |
| `state.lastError` | null throughout |

### TWO COMPOSITION FIXES THE SCREENSHOT FOUND, AND ONE STILL OPEN

1. **Radius 4.2 m read as litter.** A keepsake is a 24 cm box; seventeen at
   1.55 m spacing is seventeen specks over eight metres of lawn. 2.6 m puts
   them 96 cm apart and the whole group in one frame. **Radius is a composition
   number, not a geometry one, and only the PNG can tell you.**
2. **A closed ring puts a souvenir between the shoulder camera and the animal
   at every approach angle** — the capybara was behind a jar in its own ending.
   Now a horseshoe with a ~100° mouth aimed at the spawn, which is also the
   better meaning: these are things you set down in front of you, not a circle
   you are surrounded by.
3. **STILL OPEN — the keepsakes vary enormously in visual scale.** The physics
   shape is a uniform 0.12 box but the drawn parts are not: Rio's is a tram
   roughly two metres long and Cappadocia's is a waist-high jar, while others
   are a hat or a stone. At 2.6 m the big ones still crowd the frame. Options
   for a later pass: sort the horseshoe by drawn size so the big ones sit at the
   horns, or give the finale its own wider camera. Not blocking — the moment
   works and is verified — but it is not yet as good as it should be.
