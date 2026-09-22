# ROADMAP-HOMECOMING: space to wander, a reason to return

22 September 2026. Approved for autonomous implementation by the user.
Baseline: master b593602. Work in checkpointed milestones, preserving the
published game until a candidate passes its gates.

## Execution and usage budget

User requests Astra Medium lead work and lower-tier agents for bounded tasks.
Use Luna for source scouting, mechanical checks and small isolated edits;
use stronger reasoning only for integration or a demonstrated hard problem.
Avoid full-history agent forks, duplicated investigations, broad repeated file
reads, noisy tool output and repeated full suites before a checkpoint.

Initial account reading: weekly Codex 43% used, 57% remaining. User requires
at least 20% remaining after work: maximum available spend 37 percentage
points. Operational budget is 32 points, targeting at least 25% remaining,
with five points reserved for uncertainty and safe handoff. This is a quota
allocation, not a measured cost prediction or a guarantee of full scope.
Check usage before/after each bounded milestone, and more often if work is
consuming quickly. Account usage is shared with other tasks. At 25% remaining,
stop new feature work and safely checkpoint; do not deliberately use the 20%
reserve or redeem/buy credits. If external concurrent usage lowers availability,
reduce this task's budget accordingly. Calibrate cost after the first milestone.

Provisional allocation (percentage points, not estimates): performance/music
8; opening/first act 10; world rollout 8; final verification 6. Reallocate by
evidence. If the full programme cannot fit, retain a tested coherent checkpoint
and report deferred items rather than weakening gates or claiming completion.

## Direction

### M1 checkpoint: subtractive score admission

`noSereneScore` restores the inherited accumulation for comparison. Live
admission removes progress-triggered struck bass, pulse, repeated ostinato,
second voice and lead acceleration. The additional score answer to street
musicians is also withheld; their own tune is preserved. Incidental plucks stand down during a
statement. Authored palette, chord, root, dwell, instrument and next rows,
regional band clocks, chase pulses and reward statements are unchanged.
This is a removal of scheduled work, not a new audio term: it remains active
at every governor rung so a slower device does not restore the busier mix.
No AudioParam writer, node or save field is added. Long phrase rests,
regional arrangement refinement and listening approval remain later work.

M0 Sydney foreground baseline: 45 seconds, 1280x760, reference Edge GPU,
Auto rung zero. Still/walk/rest p95: 33.2/33.4/33.2 ms; CPU p95:
9.4/9.6/8.1 ms. No >100 ms frames. This misses the 20 ms target.
An earlier sample slowed to approximately 1 Hz despite low CPU cost;
foreground control was absent. Retain it as contaminated evidence, not a
certified game-performance regression. Browser focus is now recorded.

A serene, mischievous travel adventure about making somewhere feel like home.
The next improvement should come from selection, pacing and composition,
not another blanket layer of effects, instruments or checklists.

Seven design tests: emotional purpose; first-session clarity; agency and
reward; musical space; visual composition; frame pacing; lasting consequence.
The user's requested 30–50% visual uplift is an ambition, not a measurable
promise. Judge comparative images and moving play, not effect count.

## Evidence and limits

- shared.js JOURNEY currently recommends seven stops; all nineteen remain
  available. CHAPTER_EXPERIENCES requires a signature plus two supports.
  There is no five-act global progression structure yet.
- systems.js adds pulse at half progress, counter-line at one third, walking
  bass at two thirds and ostinato at full progress. These are credible sources
  of accumulating musical density, not proof of what any player heard.
- The eight-action tutorial teaches controls, a task star and departure; the
  economy gets a single stall sentence. A structured map/economy lesson is
  missing from this sequence. Audit existing controls/help before replacing.
- Existing upgrades include several small stamina/speed changes and late
  capstones costing 300–380 yuzu. Acquisition time needs measured play.
- main.js already reports module CPU costs and frame-wide draw counters.
  Its draw timing is submission CPU time, not measured GPU execution.
- shared.js records earlier reflection experiments as object/draw-call bound:
  shrinking the reflection target did not fix that fixture. Do not repeat a
  resolution-only optimisation as though this were an unknown.
- Auto sheds mirrors above rung zero; Pretty pins zero. Prior soak saw a
  150 ms post-reveal frame, governor rung two and solver recoveries. The latest
  public smoke passed, but it was not a sustained performance certification.
- Monaco's historical 33.1975 m/s warning and full cumulative earned-journey
  proof remain open. The clamp fix and focused pass do not close them.

This review is source/history-based. New device profiling, listening and
novice playtests below are work to do, not measurements already obtained.

## P0: establish smoothness before expanding the world

### Capture

Run one owned, headful browser at a time on the current reference GPU. Add a
representative lower-power laptop and real mid-range mobile device when
available; emulation is not device evidence. Cover Edge/Chrome and smoke
Firefox/Safari where actual platforms are available. Record missing coverage.

Capture all 19 arrivals, then 90-second routes in Sydney, Kyoto, Kowloon,
Hanoi, Monaco and Palawan, including crowded contact, water, diving, rides,
settings, return visits and travel. Repeat cold/warm and Auto/Pretty/Fast.
Use 30-minute traversal loops for allocation/resource trends. Keep network
load, build/compile hold, first visible frame and ordinary play separate.

Report p50/p95/p99 frame intervals; >33/50/100 ms hitch counts per minute;
CPU module cost; GPU timing only where supported; draw calls per pass;
program count; allocation/GC; contacts/substeps; active audio sources; and
governor transitions. Trace the actual public single-file build as well as
unbundled development. Compare equal camera/input trajectories and A/B order.

### Optimise in measured order

1. Attribute hitches: shader/material warm-up, scene traversal, allocations,
   collision solving, reflection/shadow submission, HUD layout and audio.
2. Reduce work: reuse temporaries, dirty-driven HUD updates, cache visibility
   lists, instance/merge suitable STATIC geometry within cullable regions,
   and update distant decorative NPCs less often. Protect near interactions,
   task detection, collision bodies, silhouettes and animated parts.
3. Reflections: profile existing exclusions; retain landmarks/trees, cull
   invisible water and irrelevant reflected objects. Test further batching
   before target-size cuts. Do not promise every-other-frame mirrors: moving
   cameras can make them judder. Reject visible lag or popping.
4. Audit postprocessing and shadows with individual controlled cuts. Remove
   an expensive pass if it contributes little in motion. No generic bloom,
   high-resolution shadow or particle increase before this budget exists.
5. Keep physics and audio clocks coherent through slow frames, transitions,
   tab switches and recovery. Lower decorative update rate before changing
   simulation semantics. Reproduce Monaco with contacts and carrier traces.
6. Only then revise adaptive quality. Prefer coherent, stable tiers retaining
   the scene's identity over repeated oscillation. Explore a measured cheap
   water fallback, not forcing full reflections on incapable hardware.

### Proposed acceptance targets, not current claims

On the reference 60 Hz desktop at 1280x760: ordinary traversal median near
16.7 ms, p95 <=20 ms, p99 <=33.4 ms; no reproducible >100 ms gameplay stall.
For a declared 30 fps low-power tier: p95 <=35 ms and p99 <=50 ms. Assess
thermal steady state too. Separate arrival/loading targets after baseline;
no unmasked freeze or lost input after the game says a destination is ready.
No unbounded resources across repeated identical laps; no new runtime errors,
audio dropouts, save regression, or capybara below-world/NaN events.

CPU submission timing alone cannot certify these targets. Do not add CPU and
GPU times as though their parallel execution were a simple serial budget.

## P1: an original, spacious score

Brian Eno is the direction reference for space, slow evolution and restraint,
not a track to reproduce. Retain original melodies, synthesis and each place's
identity. Music stays perceptually foreground; fewer attacks do the calming,
not drowning the score under surf or merely turning the whole mix down.

### Arrangement rules

- One harmonic bed, at most one foreground melodic idea, and one optional
  colour/rhythm role in ordinary exploration. These are musical roles, not
  individual oscillator counts. Give the audio graph a separate voice budget.
- Try 20–45-second rests between short lead phrases; allow stretches of
  harmony alone. These are audition starting ranges, not global constants.
- Retain authored harmonic rows. Thin event admissions, sustain compatible
  tones and phrase across the existing harmony; do not indiscriminately slow
  every timer or stretch incompatible chords across changes.
- Progress changes orchestration, register and warmth through substitution.
  It must not automatically pile counterpoint, bass walk, pulse and ostinato
  together. A completed place can sound more resolved and LESS busy.
- Introduce a single phrase-admission/priority policy at existing scheduler
  boundaries. Arrival, local musician, reward, wake and story cues must yield
  to one another. Keep one writer per AudioParam; retire superseded gates
  after a verified A/B instead of stacking another permanent workaround.
- Gameplay music briefly lifts for a river run or race, then settles with
  hysteresis. Normal walking/running is not a permanent invitation to drums.
- Preserve quiet diegetic signatures and essential warnings. Reduce chatter
  repetition and broad noise masking. Audit tail overlap and harsh attacks;
  more reverb is not a substitute for harmonic richness.

### Place briefs

| Places | Exploration direction | Active contrast |
|---|---|---|
| Sydney, Quay, Manly | Warm open harmony, unhurried plucks, coastal openness | Ferry/concert gets a brief articulated lift |
| Pasto, Cali, Rio | Air and melodic space; locally researched rhythmic/timbral identity | Festival/dance pulse belongs near its event, not everywhere |
| Pantanal, Palawan | Soft low register, breathing harmony, rare answering phrase | Herd crossing/manta flight opens the register without filling every beat |
| Kyoto | Spacious plucked resonance, restrained melodic contour, long rests | River action adds one pulse role |
| Hanoi, Kowloon | Intimate nocturnal/urban harmony; distinct regional palettes | Market/street energy stays local and intermittent |
| Venice, Monaco | Lyrical, warm, gently wistful; understated elegance | Regatta/race supplies contrast without permanent fanfare |
| Marrakech, Cappadocia | Spacious modal colour researched for the actual place | Sparse rhythmic articulation during market/chase/flight |
| Son Doong, Iceland, Antarctica, Drift | Very slow timbral evolution, suspended space, rare fragile motif | A discovery can be one exposed note and a harmonic opening |

Avoid a generic pentatonic preset for all Asian settings, or one exotic scale
for unrelated cultures. These briefs are intentions; consult credible regional
music references and informed listeners before claiming authenticity.

### Listening gate

Prototype Sydney, Kyoto, Hanoi and Iceland first. Record matched 3–5-minute
still/walk/activity/return segments, normalise audition loudness and compare
blind on headphones and laptop speakers. Test 30 minutes for fatigue. Rate
serenity, beauty, emotional movement, place-fit and unobtrusiveness separately.
Log audible lead attacks and simultaneous roles alongside listener ratings.
Pass requires human preference; a running AudioContext is insufficient.
No clipping, abrupt tail cuts or catch-up bursts after suspension. Use the
audio clock and bounded lookahead, not animation-frame timing for notes.

## P2: five high-value global visual refinements

Each is a low-regret direction, not permission to skip performance or taste
validation. Demonstrate on Sydney, Kyoto, Hanoi, Palawan and Iceland before
rolling the shared treatment across all nineteen.

1. **Value hierarchy and atmosphere.** Separate near/middle/far planes; quiet
   background contrast so the animal and landmark read. Tune existing light,
   fog/grade overlays with authored baselines intact. Do not put one orange
   sunset filter on nineteen places or add fog that hides the destination.
2. **Grounding and material restraint.** Improve feet/prop contact and the
   consistency of water/stone/foliage response using existing shadows and
   cheap procedural terms. Preserve flat Lambert buildings and living forms.
   Validate moving feet, not only a static contact-shadow screenshot.
3. **Water as the signature.** Preserve meaningful reflections, clarify
   shoreline/shallow/deep transitions, simplify sparkle and foam frequencies,
   and make wake/ripple scale agree with the animal. A calmer coherent water
   surface is preferable to several noisy overlays.
4. **Silhouette and clustering.** Improve shared tree crowns, foliage massing,
   rock groupings and repeated small-object proportions. Remove scatter that
   competes with paths or landmarks. Keep colliders/routes stable. More
   polygon density is not the target; more deliberate shape is.
5. **Composition and visual breathing room.** Compose one discoverable vista
   per place, with restrained foreground framing and useful sightlines. Reduce
   HUD competition and simultaneous world motion. Preserve manual camera
   ownership; no cinematic pan every time the player pauses.

Use pinned A/B frames, masks where applicable, and real walking clips at both
quality tiers. Test silhouette readability on a narrow screen. Target >=75%
preference in a small blinded panel across the representative scenes, while
recording sample size and limitations. This is a directional taste gate, not
proof that beauty increased by a scientifically meaningful percentage.
Every pass must fit the P0 budget; spend measured savings, not hoped-for ones.

## P3: a wordless mission and a learnable opening

### Narrative spine: make a place worth coming home to

Opening proposal: an empty riverside picnic, a small travelling case and a
blank postcard book. The animal nudges a second cup. A ferry horn answers.
Control returns after roughly 12–18 skippable seconds. No exposition speech.

The player's clear goal: collect encounters and invitations across the world
and bring them home. Five act pages gain a keepsake, a relationship and a
musical fragment. The home scene physically changes; the finale gathers
earned friends and objects rather than presenting another checklist screen.
The character's psychology remains unstated. The UI may say what to do next;
the scenery, repeated gestures and musical motif carry its emotional meaning.
Use existing traveller, companions, shelf and coda before inventing new systems.

Avoid literal teleportation of every local to Sydney. Some attend; others
are represented by a postcard, gift or musical answer. Act scenes last 8–15
seconds, are skippable/replayable, and never steal a live action's controls.

### A rival, not a villain

Prototype a recurring opportunistic ibis: takes the best picnic seat, copies
the animal's bow, finds a shortcut, later quietly helps. Rivalry becomes
recognition. Two authored appearances first; keep only if players remember
and enjoy it. No combat framework, stolen purchased upgrades, erased progress,
mandatory chase on every arrival, or world-threatening antagonist.

### The first ten minutes, proposed pacing

- 0:00–0:20: opening image and immediate control; movement is never paywalled.
- 0:20–1:30: one inviting interaction producing a readable comic response.
- 1:30–3:00: first meaningful task and unmistakable reward, without four cards.
- 3:00–5:00: earn enough for one visibly useful purchase; optional guided shop.
- 5:00–8:00: use it or encounter a companion/transport, see the first vista.
- 8:00–10:00: first memory and a clear next-place choice, with an easy save/stop.

These are playtest hypotheses, not forced timers. No automated driver can
substitute for watching a newcomer find these events without coordinates.

### Selectable field guide and lessons

Main menu and pause menu both offer Learn to Play. Five independently
replayable modules: movement/camera; interactions; tasks/memories; yuzu/shop;
map/travel. Each uses 30–60 seconds of one action, one response, one sentence.
Resume or exit at any time. Use an isolated practice state or non-consuming
lesson transactions; don't charge real yuzu for tutorial rehearsal.

Teach each minimap symbol beside a matching nearby world object. Provide a
legend, player/facing marker, destination pin and reset-view control; audit
existing symbols first. Distinguish story memory, optional mischief, collectible
and route marker. Show a purchase's benefit before commitment. Introduce later
modules when relevant, without forcing a five-page manual before play.
Audit keyboard slider input, focus, touch, controller labels, large text,
reduced motion and skip/replay saving. Reconcile stale tutorial departure copy
with the actual current travel rules and the eventual act structure.

## P4: five acts, choice within each

Choose emotional pacing over a strict world atlas. Geography informs each
place's integrity; a postcard-book transition makes long journeys intelligible.

| Act | Places (all nineteen, exactly once) | Emotional/gameplay job |
|---|---|---|
| I. A little further | Sydney, Quay, Manly | Safety, mischief, first departure; learn the basic verbs |
| II. In good company | Pasto, Cali, Rio, Pantanal | Flight, festivals, joining a crowd, belonging to a herd |
| III. Other people's rhythms | Kyoto, Hanoi, Kowloon, Venice | Ritual, river/traffic navigation, intimate human stories |
| IV. Beyond the familiar | Palawan, Son Doong, Cappadocia, Marrakech | Dive, underground scale, height, open desert; wonder and solitude |
| V. What comes home | Monaco, Iceland, Antarctica, Drift | Spectacle gives way to spaciousness; then a grounded return to Sydney |

Monaco is the bright contrast at the start of Act V, not the emotional finale.
Within an act, recommend an order but allow choice. Act V's last invitation
points home regardless of the player's final selected destination.

### Unlock policy

- Fresh Story players start in Sydney. The first short memory opens Quay and
  Manly. Two memories among Act I's three places open Act II.
- Two memories among each later act's four places open the next act. Act V's
  second memory opens the homecoming invitation. No 100% checklist requirement.
- Prototype a memory as one signature experience OR an authored accessible
  alternative of comparable meaning, plus one chosen supporting encounter.
  This deliberately revisits the existing signature + TWO supports rule.
- Do not gate progress behind score medals, currency purchases or a single
  difficult flight/race. Assistance preserves narrative eligibility.
- Show the current act, one suggested next place and a glimpse of the next
  act. The complete atlas lives one level deeper, not nineteen equal doors.
- Free Roam remains clearly available without story locks. Existing saves
  retain access, balances, upgrades, tasks and ending; no retroactive relocking.
  Choosing Story on a veteran save is opt-in and receives earned credit.

Ten memories suffice for the proposed main path; nine destinations remain
optional discoveries, with all nineteen relevant to completionist play. Verify
duration with novices before advertising a campaign length. Difficulty and
novelty must curve with the chosen path, not just with chapter number.

### Return visits

Offer short, relationship-driven return invitations after act boundaries.
Prototype Sydney's fuller picnic, Kyoto after rain with a remembered favour,
and Hanoi's cook recognising the earlier delivery. Each changes one scene
state, one encounter and one reward, not the whole biome.

Use authored triggered variants rather than real-world waiting. Retain routes
and landmarks. No reset task list, compulsory second lap or repeated fetch
grind. Returns are optional except the final homecoming. Defer rollout until
players voluntarily follow at least one prototype invitation.

## P5: progression and healthy retention

The loop is curiosity -> playful action -> memorable consequence -> useful
choice -> invitation. Reward a story or capability, not only another number.

- Short loop: readable feedback and a small surprise for experimentation.
- Session loop: earn a memory, make a purchase/relationship choice, see home
  or the book change, and leave with an intriguing next invitation.
- Campaign loop: complete two places, turn the act page, gain a new kind of
  opportunity and hear the motif resolve differently.
- Return loop: recognised by a character, familiar place meaningfully changed,
  an optional new encounter. Allow satisfying stopping points and clear resume.

Rebalance the shop only after logging honest income across several novice
routes. Target first meaningful affordable choice in 3–5 minutes, a second
distinct choice in 10–20; these are starting targets. Normal traversal must
already feel good. Keep purchased legacy benefits; show advanced stock after
relevance, without taking it away from existing players. Consider a cosmetic
or companion acknowledgement alongside a utility purchase instead of making
every reward a minor percentage increase. No new currency in this pass.

Do not add daily streak penalties, energy timers, expiring gifts, random paid
rewards or manufactured chores. Seek voluntary return and curiosity rather
than maximising time spent regardless of enjoyment. No remote analytics
without a separate privacy decision; use opt-in playtest observations first.

## Delivery order and decision gates

| Milestone | Work and output | Exit condition |
|---|---|---|
| M0. Baseline | Trace performance, capture soundtrack stems, audit fresh-save journey | Ranked causes, comparable fixtures, preserved failing cases |
| M1. Calm and fluid | Fix top measured costs; prototype four spacious arrangements | Frame targets approached/proven on named hardware; listening preference |
| M2. Beautiful first ten minutes | Sydney/Quay opening, first reward/shop lesson, shared visual prototypes | Novices understand goal/map/reward without coaching; no performance regression |
| M3. One complete act | Sydney–Quay–Manly, memory alternatives, act unlock, home consequence | End-to-end fresh save + legacy save + all control schemes |
| M4. World rollout | Remaining acts and biome arrangements, five visual passes | Every place reviewed in motion and sound; all branch paths viable |
| M5. Returns and character | Three return invitations; two rival scenes | Players notice consequence and voluntarily investigate; cut weak scenes |
| M6. Release | Full cumulative journeys, 19-place soak, 38 transitions, hosted/mobile tests | Evidence-backed release; unresolved blockers explicitly closed or disclosed |

First implementation tranche: approximately 8–12 focused engineering/design
hours for baseline, the largest measured performance fix and a small calm-score
prototype. Re-estimate after measurements. This is not enough for all five
acts, nineteen bespoke sound reviews, accessibility, variants and user tests.
Allocate initially about 30% performance, 25% score, 25% opening/progression,
15% shared beauty, 5% rival prototype. Adjust to findings; do not spread work
evenly over nineteen maps before the first act succeeds.

Five to eight fresh players can expose obvious onboarding problems; report
sample size and avoid statistical claims. Proposed gate: >=80% can describe
the immediate goal, locate their next objective and explain their first yuzu
purchase without coaching. Observe first delight, first confusion, voluntary
continuation and stop reason. A larger sample is needed for retention rates.

## Technical boundaries and deliberate rule changes

Preserve procedural geometry, PALETTE, flat built/smooth living forms,
synthesised audio, offline single-file output and stable chapter/task IDs.
Avoid a renderer/engine migration or a sweeping systems.js rewrite in this pass.
Only extract tested scheduler/progression seams when it reduces actual risk.

Proposed departures from old decisions, to document before implementation:

1. Seven recommended stops/all-open presentation -> five-act Story with Free
   Roam and legacy freedom preserved. This addresses first-session overload.
2. Signature + two supports -> signature/accessible alternative + one support.
   Verify reduced grind without losing the place's meaning.
3. Progress adds voices -> progress substitutes orchestration. Keep authored
   chord/root rows and one-writer ownership; tune admission instead.
4. The animal's why is never said remains; the player's concrete objective
   becomes legible through staging and concise task text.
5. New decorative visual/audio terms still need falsy-live noX flags, cheap
   cuts and governor parking. Core calm arrangement must not become busy again
   on a slow GPU: distinguish base scheduler correction from optional new
   audio decoration, and explicitly document any necessary contract exception.
6. Full mirrors still park above rung zero unless a separately measured tier
   revision demonstrates an affordable fallback. Do not silently bypass it.

Save planning: derive act eligibility from stable task/encounter facts, not a
second mutable unlock counter. If needed, add OPTIONAL allowlisted fields to
sysSAVE_SHAPE: journeyMode ('story'/'free'), arcV (1), actScenes (stable IDs),
returnMoments (stable IDs). Define migration, defaults, idempotence, import/
export and rollback tests before any writer. Tutorial progress reuses existing
state where possible; richer lesson state requires its own named schema.

## Checkpoint log

### M1a: progress-density correction

Implemented the subtractive admission policy above. `qa/homecoming-serene.mjs`
passes 107 source-derived checks. `qa/homecoming-score-live.mjs` passes a
headful, real-clock Sydney full-progress fixture with real movement input.
In its two 30-second windows, inherited/live counters were second voice
8/0, pulse 18/0, ostinato 44/0 and bass entries 3/0. No runtime errors.
Syntax checks, single-file build and all 55 suite checks pass. The historical
soak-staleness report remains informational; this is not a new soak pass.
The initial failed run exposed an additional street-musician score answer;
that answer is now gated too. Preserve `homecoming-score-live.json.png`
(failure) and `homecoming-score-live-v2.json.png` (pass), both ignored QA
evidence. Source-derived tests and live counters are not listening approval.

Next: controlled render-pass attribution using the baseline instrument's
reflection/shadows/depth cuts; calm phrase-rest prototypes; the first-session
learning menu. M0/M1 are partial, and M2–M6 are not implemented. Public master
remains unchanged until a release candidate passes the hosted gates.

### M2a: selectable learning reference

Five native disclosure lessons are available from the title and Pause:
movement/view, interactions, tasks/memories, yuzu/shop and map/travel.
The same pooled text builds both surfaces; opening a lesson refreshes its
input-scheme wording. No save field, reward or spending action is added.
Pause focuses the learning fold rather than leaving the player above the
nineteen-destination board. Enter/Space toggles a lesson without also starting
the game; this was caught by the first browser run and corrected. The title
now prevents horizontal scrolling when its reference content grows.

The separate learning-contract probe passes 30 checks; existing guidance
contracts retain their 23 checks. Desktop 1280x760 and touch emulation at
390x844 each pass 25 browser
checks, including 44px disclosure targets, keyboard isolation, pause and
unchanged score/wallet. This is not real-device or novice evidence. Screenshots
are inspected; the guide moves above destinations for a learning visit and
returns below them on ordinary journal visits. Interactive five-part practice is not implemented; Sydney's
existing guided walk remains available from Pause.
Syntax checks, the single-file build and all 56 suite checks pass.

Performance attribution: shadow-cut walking p95 18.2 ms initially improved
over the older 33.4 ms baseline, but a repeated uncut Pretty run also records
18.2 ms. Do not attribute that difference to shadows or ship a quality cut on
this evidence. Both probes preserve their >100ms outliers (one each in still
or rest); no production rendering change has been made.

## Explicit cuts (scope)

No conventional villain campaign, combat tree, paid/daily retention system,
additional currency, mandatory 19-place completion, mandatory repeated biome
clears, general asset-pipeline migration or automatic visual-effects pile-on.
No certification based only on static checks, FPS averages or screenshots.

## Engineering references

Browser work must fit the refresh interval and avoid unnecessary rendering
pipeline work: https://web.dev/articles/rendering-performance

Schedule musical events against the audio clock with lookahead, while keeping
UI animation separate: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques

These support implementation practices, not the narrative/music taste proposals
or unmeasured performance targets above.
