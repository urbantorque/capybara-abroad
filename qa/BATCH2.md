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

- Started. Checklist written. Scouting the three job areas before touching code.
