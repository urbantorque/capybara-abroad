---
name: capy3-third-lift
description: "L3 (12 Sep 2026) — the authority and the hide, the melody, the frame given a dark; five instruments and traps from the pass"
metadata: 
  node_type: memory
  type: project
  originSessionId: b58d2154-2b00-4b83-84f5-0f4f96166ab6
  modified: 2026-09-11T15:59:14.101Z
---

The third lift pass on capy3 (branch lift-pass, commits L3-0..L3-6d, 12 Sep 2026).
Five review agents → ROADMAP-LIFT3.md → batches. CONTRACT.md's top section is
the full record. What was non-obvious:

**The composite air was the wash.** qa/l3-luma.mjs (three bands, HUD
excluded) showed every daylight far band converged on one pale value. The
decisive test was `state.noAir = true` in Palawan: the far band went DARKER
by 12 points and the sky from grey to blue. The fix is elevation-weighted
terms on the composite (`uAirGnd`, `uFarDark`, `sysFAR`), the sky nearly
exempt, daylight `airMax` halved. Palawan's dome writes depth, so the
raw-depth sky exemption never covered it.

**A value field must be smaller than the frame.** Cloud shadows at 28 m
cells measured as nothing three runs running — the whole frame sat inside
one noise cell below the threshold. 12 m cells and a 0.44..0.66 threshold
read. Prove a shader term with a constant first (`gc = 0.5 * uCloudK`),
then the noise. `game.cloudForce(k)` is the harness override.

**The authority is the march with a carry on the end.** Locals path only
(`r.escT`, `escStep`), never the Sydney/Pasto rosters. The authority must be
allowed to start mid-line (`marFree(r, false)`) or a witness beats them to
it. The probe (qa/l3-authority.js) must move the animal 18 m from the spawn
first or the carry target IS the spawn and the carry measures 0.4 m.

**The hide is a predicate, not a state.** `game.hidden()` = still inside a
registered circle or still in water; `npc.js` walks to `marSeenX/Z` and gives
up after 2.6 s. Hide spots must come from constants that already place a
visible thing — the sub-agents were told never to invent coordinates and
none did.

**The melody's first cell never played** because the initial `musMelNext` was
the old cadence (11) while the range was 5..8; expose the counters on
musAudit before measuring.

**Sub-agents run `playwright-cli close-all`** and it is global: my session
died mid-probe twice. And `git add -A src` while agents are editing sweeps
their half-done files into your commit — stage by file when agents are live.

**Bash heredocs eat backslashes here even with a quoted delimiter** — any
regex or `\n` in a patch goes through the Write tool, not a heredoc.

**The errand is a plan you can break, and it needs three guards.** A carried
prop is a kinematic body placed at the hand each frame; the barge is the
locals' existing rush latch inside 2.4 m; a leg that cannot be walked must be
given up (20 s) or a person stands forever at somebody else's feet — a `to`
that lands within a metre of another person's body never arrives.

**Normalised PeriodicWaves are 2-4 dB hotter than a saw** at the same gain:
trim per spectrum in the one pad-gain writer and re-run qa/s1-spectrum.js.

**Reviewer notes go stale**: LIFT2's "Cali dancers frozen" was already fixed
on the beat — read the code before taking an open item.

**Crowd rigs are three files with three idioms** (Quay's stride array, Venice/Mong Kok's `limb(sgn)`); an agent per file with a draw-call budget and a screenshot works. `renderer.info.render.calls` reads 1 after the composite pass — set `autoReset=false` or wrap `render` to count.

**A worklet ships as a Blob URL** (`String.raw` source in systems.js) so the one-file build needs no second file; `musAudit().ks` says whether it loaded. **The riddle's "first row" is not `ids[0]`**: the paper's top row is act- and pin-ordered, so "first" means nothing in the chapter ticked yet.

Related: [[capy3-the-ridiculous-five]], [[capy3-second-lift-pass]],
[[headless-qa-harness]].
