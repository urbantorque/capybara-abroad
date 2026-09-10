# capy3 chapter audit — shared rubric (READ-ONLY audit: do not edit any file in the repo)

Repo: C:/Users/roger/OneDrive/Desktop/capy3 (src/*.js, one file per biome; npc.js holds the Sydney cast + the
shared "locals" rig (game.addLocal); systems.js holds cross-chapter systems (marquee lift, tasks, ambience,
map, music); shared.js holds TASKS (lines ~2453-3102), CHAPTERS (~3103-3457), FINDS (~3458-3651),
RECORDS (~3652+); props.js holds rigid-body props for chapters 3-17; weather.js the mood table.
Past reviews/roadmaps: ROADMAP*.md, REVIEW-2026-08-31.md in the repo root. Memory notes (project history,
trustworthy but may be stale): C:/Users/roger/.claude/projects/C--Users-roger-OneDrive-Desktop-capy3/memory/*.md
Latest arrival screenshot per chapter: qa/B2-NN-<biome>.png (use the Read tool to LOOK at yours).

Goal of the whole review: find where each chapter is under-developed in (a) NPC/creature behaviour and
richness, (b) visual/scene completeness, (c) the marquee "wow" moment (each chapter should have one big
moment that introduces a NEW dynamic — e.g. driving the ferry, flying the condor, diving, climbing bamboo).
The final product is a roadmap to make the game read 30-50% more polished. Accuracy matters more than
volume: every factual claim must cite file:line. If you cannot verify something, say "unverified".

## Behaviour tiers (classify EVERY animate-looking thing: people, animals, vehicles, machines)
- T0 static: a merged mesh; no update function touches it.
- T1 ambient loop: moves on a timer/path/spline; never reads the capybara's position.
- T2 reactive: reads the capybara (turns to look, flees, comments, speech bubble, startles). The shared
  "locals" rig (game.addLocal) is T2.
- T3 stateful actor: a multi-state machine (idle/walk/chase/carry/recover...), holds or drops objects, can be
  robbed/barged/chased, has a cooldown/memory, plays animation states.
- T4 systemic: interacts with OTHER NPCs or with world systems (crowd propagation, traffic, herd, flock
  reacting as a group, affects task outcomes, remembers across time).

## For EACH chapter you are assigned, produce:

### 1. Inventory table
One row per distinct animate thing or class of things: `name | count | tier | what it does | reacts to capy? |
file:line of its update fn (or 'none')`. Include vehicles, animals, machines, weather actors. Be exhaustive —
grep the biome file for `Step(`, `update`, `tick`, `state`, `addLocal`, `spline`, `path`, and read the module's
update/export at the bottom of the file to see what is actually called each frame.

Then a summary: count of T0/T1/T2/T3/T4; how many distinct things ACKNOWLEDGE the capybara at all; what is
the most complex behaviour in the chapter.

### 2. Scene completeness
From the code and the arrival screenshot: what is the set-dressing density; obvious missing things a real
version of this place would have (a market with no goods, a street with no traffic, a harbour with no boats,
interiors that are boxes, etc.); anything clearly placeholder. Note any known-open issues from ROADMAP*.md
or memory notes for this chapter that are still open (verify against code, don't trust the doc).

### 3. Marquee / wow moment
- Which task(s) are the marquee (see the `marquee` field in CHAPTERS, and the TASKS tier/wow markers, and
  systems.js's lift/marquee handling).
- What NEW dynamic/verb it introduces to the player; is it real simulation (physics, aerodynamics,
  audio-clock) or scripted/on-rails; who controls what; how long the payoff lasts; how it is reached; what it
  looks like on screen (camera work, scale, sound); any fail/repeat path.
- Honest rating 1-5 of "wow" vs the best in the game (ferry helm, condor, dive, bamboo climb, Hanoi traffic),
  with reasons. Identify if the chapter's supposed wow is actually a ride-on-rails, a stationary trigger, a
  cutscene, or a stat-check.
- Any other latent big moments that exist in code but are weak/unreachable/underexploited.

### 4. Recommendations (the important part)
For NPC/behaviour: 2-4 concrete step-change proposals that would lift this chapter to at least Sydney/Pasto
depth. Prefer reusing existing machinery (name the function/system you'd reuse: the locals rig, Sydney's
state machine in npc.js, the herd/followers, the chase system in sahara.js, the traffic in hanoi.js, the
carrier/passenger contract, the frame/reference-frame channel, etc.). Estimate effort (S/M/L) and impact.
For the wow moment: if rating <4, propose the ONE change (or one new moment) that gets it to 4-5, built on
existing systems where possible, and state what new verb it gives the player.
For the scene: 2-3 high-impact visual additions.
Also flag any bug/regression you notice while reading (with file:line) — don't fix it.

Write your full report to the scratchpad file named in your task. Keep prose tight; tables welcome.
Be honest: if a chapter is already strong, say so and don't pad recommendations.
