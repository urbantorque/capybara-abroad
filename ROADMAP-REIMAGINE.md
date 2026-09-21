# ROADMAP-REIMAGINE — a journey worth taking

Started 21 September 2026 on `codex/redesign-delight`, from `2fd9afa`.
Lead: the current Codex task. The user authorised autonomous redesign,
parallel agents, commits, pushes and milestone updates for a 48-hour
iteration window, ending 23 September 2026 at approximately 11:32 UTC.

## The direction

A curious capybara travels through places, disrupts their routines, and
gradually finds that it belongs somewhere. Curiosity, physical comedy,
place and attachment are the tests for an addition. Beauty must make
the world easier to want and easier to read. More systems are not the
measure of progress.

Keep all nineteen destinations. Build a shorter recommended journey,
with other places available as trips. Preserve existing saves and the
free, offline-capable browser build. Preserve the animal's wordless
motivation, the traveller, companions, physical keepsakes and homecoming.
Keep the flat built world and rounded living things, authored palette,
procedural geometry and synthesised sound as the visual/audio identity.

The user's new brief permits challenging past design decisions. Any
reversal must name the old rule, the player problem, the replacement and
the evidence. Historical roadmaps remain records, not files to rewrite
into apparent successes. Numerical tuning is a hypothesis until played.

## Seven standards

1. **Identity.** Trouble, wonder and belonging have different rhythms.
   Quiet places do not need a boss to count as memorable.
2. **Agency.** The player can predict an action's target and understand
   its consequence. Encounters afford several coherent approaches.
3. **Pacing.** A chapter ends after its meaningful experience; optional
   tasks remain available without holding the journey hostage.
4. **Rewards.** The base animal is delightful to control. Purchases
   create expression or a meaningful alternative, not basic comfort.
5. **Clarity.** One essential instruction at a time; pausing or seeking
   help never forfeits a lesson. Narrow screens remain playable.
6. **Presentation.** Strong silhouettes, depth, focal contrast, restrained
   interface and a score with room to speak. Camera agency comes first.
7. **Reliability.** Progress survives, the ending works for the ordinary
   route, and improvements can be verified and safely iterated.

## Baseline and honesty

- Current source: 19 chapters, 256 tasks. Existing progression quotas
  total 185 task completions (including arrival ticks), with every
  chapter's signature activity required. Sydney asks for ten.
- `node qa/run.mjs`: 25 checks, zero failed at baseline. Four are reports;
  the historical soak is stale and does not constitute current coverage.
- Prior live review sampled Sydney, Pasto and Venice. It did not finish
  nineteen chapters, assess audio by ear or measure input latency.
- Existing reference-GPU measurements in ROADMAP-WOW3 are historical.
  New performance claims require fresh GPU identification and evidence.
- Existing untracked files predate this work and belong to the user.
  Do not stage, delete or overwrite them as cleanup.

## Work programme

### A — trust the opening and the ending

Fix tutorial cancellation on Pause and control help. Preserve explicit
skip if available, introduce a clear replay path where necessary, and
retain lessons across ordinary menu use. Do not mistake a timed-out
lesson for demonstrated mastery. Keep the opening responsive.

Fix the mismatch between `keepHeld` finale eligibility and `chapComplete`
souvenir staging. Test the ordinary partial-completion ending as well as
100% completion, including the Pantanal's deliberately empty place.

Evidence: actual function behavior, fresh browser input, pause/resume,
help, save/reload, and a seeded partial journey. No new save keys in A.

### B — the journey has a shape

Author a six-to-eight-destination recommended route. Prototype a route
through departure, flight, quiet exploration, water and belonging;
select exact places after checking their transitions and skill needs.
All nineteen remain accessible. Replace blanket 70% completion with
named chapter experiences and a small choice of supporting actions.
Avoid introducing invisible gates or making earlier-earned abilities
impossible on an out-of-order trip. Progress UI and save restoration must
share the same eligibility functions.

Evidence: every destination reachable; recommended-route exit tests;
direct chapter starts; old saves; ordinary ending; no false requirement
for 100%. New save keys require an explicit amendment here before edits.

Selected route: Sydney -> Circular Quay -> Pasto -> Kyoto/Uji -> Palawan
-> Pantanal -> Hanoi -> Sydney home. Seven unique places and eight stops.
Stable chapter indices and task IDs do not move. Each route memory asks
for its signature plus two authored supporting actions; ordinary arrival
ticks do not count. Existing quota qualification remains a compatibility
path, so no earned memory is revoked. All nineteen destinations become
available from the travel board; the route is a recommendation, not a lock.
Finale staging, captions and recognition must use the actual earned set,
including Pantanal's intentional empty position. Preserve the full music.
Traveller acquaintance should restore from existing saved notebook facts,
without adding a save field or a recursive notebook getter.

### C — the animal is already fun

Improve baseline traversal without changing the established jump apex
or making geometry inaccessible. Measure safe sprint and recovery
changes; retain meaningful exertion in water, climbing and pursuit.
Simplify overlapping comfort upgrades and consumables. Preserve or
fairly convert existing purchases; never silently erase earned value.
Make the current interaction target and failed attempt legible.

Evidence: keyboard and controller paths; tired jump, swim, climb and
vehicle behavior; existing upgrade saves; representative timed records.

### D — fewer words, clearer consequences

Give tutorial, immediate action feedback and important narrative moments
priority over incidental chatter. Reveal secondary UI when useful.
Make narrow-screen layout a first-class case; reserve a clean area for
the animal and its target. Reuse existing queues and writers where
possible rather than adding competing systems.

Improve a few existing encounters into clear comic chains with multiple
solutions. Start with Sydney's picnic/cafe and an interaction in a second
chapter, using existing people and props. Better causality beats another
currency notification.

Evidence: normal and narrow screenshots, real actions and visible
reactions, concurrency of messages, recovery and repeatability.

### E — a deliberate visual leap

First audit real arrival and walking frames in Sydney, Pasto, Kyoto,
Venice, Palawan, Pantanal, Iceland and Hanoi. Judge silhouettes, focal
contrast, composition, foreground obstruction, material separation,
ground scale, sky, shadows, water and UI coverage. Identify three highest
return changes with before/after captures before expanding to nineteen.

Improve art direction through composition, geometry, a legible animal,
local colour relationships and motivated lighting. Avoid generic bloom,
wash or particles added to every frame. Existing rendering baselines
can be reconsidered under this new brief only with a documented reason,
reversible comparison and a real-browser result.

New visual/audio additions use a falsy-live `game.state.noX` flag, park at
governor rung >= 1 and cost <= 0.1 ms when cut. No second writer per
parameter. Compare through a pinned camera; use a subject mask when
proving a specific visual term. Inspect screenshots by eye. Measure
reference-GPU cost honestly; a headless timing is not a GPU budget.

### F — the score gets its room

Complete the intent of ROADMAP-SCORE Part Q after capturing a usable
baseline. Inspect the WIP branch but do not blindly merge it. Reduce
repetition, balance ambience and voices, prioritise player feedback and
theme statements. Make the settings promise match the actual mix.
Preserve synthesis and the existing compositions. Audio timing and bus
measurements require trusted input and a real clock. Perceptual listening
remains an explicitly named validation limit when unavailable.

### G — integration and player evidence

Run representative natural routes, all-chapter arrivals, replay,
save/restore, partial/complete endings, responsive UI, performance and
the repository's regression gates. Run soak alone. Use independent
agent playtests as usability evidence, labelled as agents; do not claim
human enjoyment or memorability from automated task counts.

For later human testing: time to intentional joke, understood causality,
unassisted signature activity, understood departure, voluntary continuing
and next-day recall. Do not invent those measurements.

## Ownership and checkpoints

The lead alone owns this roadmap, CONTRACT.md updates, Git staging,
commits, pushes and integration. Agents never commit or stage. Assign
disjoint file sets, not merely line ranges. `systems.js` and `npc.js`
changes in a coupled wave run sequentially. Read-only investigations may
run concurrently. No branch switching while agents edit; no stash,
amend, rebase, force push or blanket staging.

The legacy AGENT-BRIEF.md remains useful harness history. Its references
to WOW2 work, obsolete budgets and Claude attribution do not apply to
this pass. Agent assignments name the current section, files and checks.

Before every checkpoint: syntax-check edited source, `node build.mjs`,
`npm test`, review the diff, `git status`, stage owned files by name.
Commit format: `ROADMAP-REIMAGINE <item>: <change and measured result>`.
The body states applicable budget and flags, or explains why they do not
apply. Push the redesign branch at key checkpoints. Advance the public
build only when a coherent, verified milestone is ready.

Each checkpoint records what changed, evidence, uncertainty and next
work. A green static suite is necessary and never a claim of perfection.

## Current wave

- Lead: roadmap, baseline/tooling coordination, integration.
- A builder: tutorial continuity and partial-finale correctness,
  `src/systems.js` and specifically named new A regression instruments.
- Visual investigator: read-only art/composition and renderer audit.
- Harness investigator: establish isolated browser QA capability and
  baseline measurement method; do not alter game source.

## Checkpoint log

- 21 Sep, start: roadmap authored; redesign branch created from the
  verified remote `lift-pass` head. Implementation and current visual
  baselines pending.
- A checkpoint: guidance survives Pause/help, explicit skip/replay works,
  zero-task saves offer Carry On, and legacy saves retain their no-guidance
  behavior through migration. 23 function-behavior checks, 14 browser
  guidance assertions. Hardware browser ending seeds: partial 237/256
  tasks with zero complete chapters and full 256/256 both staged 18 real
  souvenirs, left Pantanal empty, opened the ledger and saved `fin=1`.
  Zero browser errors. These are seeded regression tests, not full natural
  journeys. Isolated harness added; old soak remains stale.
- E1 prototype: composed Sydney lawn implemented but not yet committed.
  Pinned hide-and-diff proves visible grass/ground contributions; parent
  inspected before/after and found the animal's feet and shadow clearer.
  The same captures expose the remaining foreground-tree/camera and
  simultaneous-balloon problems. First timing run overlapped the build and
  is rejected as performance evidence; isolated repeat is required.
- B foundation: seven-place route and pure experience predicates authored;
  409 assertions pass. Integration into travel, progress UI and ending is
  pending. Do not describe the shorter journey as playable yet.
- Continuation: task heartbeat registered every two hours, with an explicit
  stop/start-no-new-work deadline of 23 Sep 11:32 UTC. Local execution needs
  the computer awake and the app running.
