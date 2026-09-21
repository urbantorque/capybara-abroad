---
name: capy3-the-depth-audit
description: "capy3's 10 Sep 2026 biome-by-biome audit — the three-class crowd, nine marquees that ask for nothing, and the instrument that measured the inverse of the truth"
metadata: 
  node_type: memory
  type: project
  originSessionId: 42ed3c55-8959-4863-a310-91073d94eb22
  modified: 2026-09-10T04:06:42.075Z
---

Audited 10 Sep 2026, all nineteen chapters, read-only, from "Sydney and Pasto feel developed;
Marrakech and Cappadocia feel like stationary objects". Output is `ROADMAP-DEPTH.md`.

**THE CROWD IS THREE CLASSES AND THE THIRD IS ASLEEP.** Every human is in exactly one of:
the *cast* (hand-written state machine per kind, `npc.js` `thinkHuman`/`stepHuman` :7293/:7962 and
`paThink` :9504) — ~45 people in **two** chapters; the *locals* (`addLocal` :2323, fixed, turns,
speaks, flinches, works a beat) — ~150 in seventeen chapters, all T2, **none of which walks**; and
the *instanced crowd* — **~760 figures in ten chapters, almost all T1**. Marrakech is not
under-populated: it has the most people in the game (~172, `sahUpdatePeople` sahara.js:1759) and
**not one reads the capybara's position**. Same for Rio's 258 (`rioUpdatePeople` rio.js:2488),
Hanoi's 70, Monte Carlo's 46. Only Venice, Hong Kong and the Quay wrote a capy term into their
crowd loop. Five of the seven loops already carry a per-person yaw target and a damp — they have
exactly one thing to point at. Six lines each converts ~500 statues.

**NINE OF NINETEEN MARQUEES ASK FOR NOTHING AT THE MOMENT.** Verb in the moment: Pasto (fly),
Quay (drive), Kyoto (steer a current), Manly (trim), Antarctica (drive + hold). Rails: Cali,
Monaco. Stat-check: Rio, Pantanal. Re-used verb: Marrakech = Iceland's slip. **Be-there /
stand-still: Sydney, Iceland, Drift, Venice, Hong Kong, Palawan, Cappadocia, Sơn Đoòng, Hanoi.**

**AND IN TEN CHAPTERS THE BEST DYNAMIC IN THE FILE IS FILED ONE RUNG BELOW THE MARQUEE** — Rio's
fragata (full condor.js aerodynamics) is a plain row, Palawan's manta and Venice's Volo and
Kyoto's bell and Cali's barrow are minis, Iceland's glacier is act 2, Marrakech's souk chase (the
only losable task in the game) is act 1, Hanoi's 240-bike flow carries no `wow` at all. Three of
those are fixed by editing `shared.js` and nothing else.

**HANOI IS THE ONLY CHAPTER WITH TRAFFIC ON A ROAD.** Kyoto, Manly, Pantanal and Antarctica have
no moving vehicle at all; Iceland has eleven parked cars; Mong Kok has one bus and three parked
taxis. And nobody boards anything — the ferry, the party bus, the Star Ferry and the cable car
all run empty, while `quayBuildPax` (quay.js:4648) already draws figures inside a hull's frame.

**THE INSTRUMENT I WROTE MEASURED THE INVERSE OF THE TRUTH.** Counting scene nodes whose world
matrix moved in 3 s ranked Sydney 16 and Kyoto 220. `npc.js:9` says why: Sydney's and Pasto's
casts are *a shadow hierarchy of Object3Ds NOT IN THE SCENE* copied into InstancedMeshes, so
`traverseVisible` cannot see them move. **The metric was "how little does this chapter instance
its crowd".** Read the update functions instead; see [[capy3-visibility-metrics]].

**Six defects verified by hand** (details and line numbers in ROADMAP-DEPTH.md D5): `rio.js:4074`
builds a ~300-shape static body inside `onEnter` not `ensureBuilt`, one per entry, all captured
under the tag — a compounding leak; `antarctic.js:463` `antSay` calls `game.say(s)` where the
signature is `sayAt(x,y,z,text)`, so the tiller control line has never been shown and the toast
fallback is skipped because `typeof g.say === 'function'` is true; `monaco.js:2687` rotates a
world delta by +yaw where −yaw is wanted, turning a 0.94×2.10 roof box 90° at diagonal headings;
`goreme.js:2717` ends `gorSyncBurn`'s else branch in `* 0`, so the whole valley's lantern term
snaps dark on the exact frame of its own marquee; `iceland.js:3168` `iceSheepSpook` is declared,
decremented and read and never set; `npc.js:976` gives four people the kind `'queue'` and :7439
admits only tourists and commuters, so the four people named queue never queue.

**TIER 1 BUILT, 10 Sep 2026, branch `depth-tier1`, two commits.** Six defects, two re-tierings
of three, and the crowd term in four chapters.

**FOUR INSTRUMENTS, THREE OF THEM WRONG, AND THE ORDER MATTERS.** (1) Counting scene nodes whose
yaw changed cannot see a crowd term at all: with a control leg the idle-fidget noise floor equalled
the signal in all four chapters (Marrakech 303 noise vs 319 signal). (2) Mean |bearing error| over
a near band against a far band on the same frame is the right shape — the far band is a free
control, random scores pi/2 = 1.571 — and it caught the term's first cut being **too weak to
detect**: `want = 1 - d/R` is a fifth of a turn at six metres. A plateau with a 2.2 m edge is both
the fix and the honest model. (3) The decisive one is **the term against its own absence**:
`game.state.noNotice`, the house cut-flag rule this batch had ignored, needs no guess about which
InstancedMesh is the crowd. Measured off→on: Marrakech 147 of 174 figures move, bearing error
2.924 → 0.955 rad; Monte Carlo 46 of 46, 1.451 → 0.000; Rio near band 0.174 vs far 0.801.
**Hanoi is left blank on purpose** — its seventy folk are ten meshes of ~7 instances each, which
every probe's minimum-count filter discarded, so the claim is not made.

**A FIX THAT WAS WRONG ON THE FIRST CUT AND CAUGHT BEFORE IT SHIPPED.** goreme's `gorSyncBurn`
else branch ends in `* 0`. Dropping the `* 0` is the obvious fix and is a serious regression:
`gorSun` is clamped to 0 until `gorSUN_P`, so the else reads **1**, not 0, for the ~90 % of the
cycle before the ramp — the whole valley on full burn all night. It needs three branches.

**AND THE THIRD RE-TIERING WAS REFUSED ON CONTACT.** Moving Iceland's `glacier-run` to act 3
orphans act 2's kick line, which *is* the glacier ("the ground stops holding you somewhere past
here"), and act 3 is the stillness act. Two shipped, not three, and the roadmap says why.

Verification that closed it: nineteen chapters entered, wheeked and walked — zero console errors,
zero NaN, every crossing correct; Rio entered three times running reports `world.bodies.length`
99, 99, 99, which proves the onEnter body leak from outside.

**TIER 2, THREE COMMITS, 10 Sep 2026.** Walkers, passengers, one ambient mover. Partial by
design — tier 2 is ~10 chapters of movers plus 4 vehicles — and what remains is listed in
ROADMAP-DEPTH.md.

**THE LOCALS RIG ALREADY WALKED; IT LACKED A MOVING ANCHOR.** The shuffle picks a spot within
1.7 m of `ax`/`az` and the steering walks `x`/`z` to it — and the ground-follow, the collider
writes and the bubble anchor are all in the block retrieval has used for months. So `walk:
{dx, dz, dwell, v}` is ONE branch beside retrieval and the march. An OFFSET, never a coordinate
list: it is measured from a point the chapter already chose to stand somebody on, and the far
end is probed against terrainHeight and the nav grid on the first live tick, so a bad route is
silently refused. `game.walkAudit()` exists because a silent refusal is exactly how you ship six
walkers none of whom walk — and Antarctica's first route WAS refused (the colony sits on a rise;
the tangent failed by >1.6 m, and the offset that passes is the outward radial, which is what a
transect actually is).

**A WALKER MUST NOT WALK THROUGH ITS OWN TOOL.** Kyoto's sweeper faces down the lane, his round
runs down the lane, so B12 planted his basket 0.73 m along it. He shoved it 3.8 m up the street,
past `npcTOOL_R` 3.2, and the game read a sixty-year-old broom as STOLEN: toolOut on 120 of 120
samples, one beat swing. Fixed in the rig — a walker's tool goes on the perpendicular of its
route, and the tool and the beat belong to the HOME end rather than the travelling anchor.

**AND THE CALL ORDER IS THE WHOLE THING** (MV Wheek's eight passengers): `quayBuildWheekPax`
takes the hull's group and returns silently on null. Written three lines ABOVE `quayBuildBoat`,
which is what makes the group, it did nothing at all with no error to show why. Passengers are
PARENTED to that group — unlike the Freshwater's fourteen, placed by hand each frame — so heel,
trim and yaw come free from the quaternion the hull already gets.

**cannon-es body types: DYNAMIC 1, STATIC 2, KINEMATIC 4.** A probe filtering on 2 measured
seventy static boxes standing perfectly still and reported the Pantanal truck as broken.

**AND A MOVER'S HEADING IS NOT ALWAYS ITS VELOCITY.** The truck taken from direction-of-travel
turned round at the bad bridge and drove home nose-first. The Transpantaneira is a raised
one-lane causeway with water both sides: you cannot turn a truck on it. The yaw is the road's own
southward tangent from `panRoadX`, constant through all four phases. Measured: 0.066 rad max
deviation over 150 samples, never once flipped.

**TIER 2 CLOSED, six commits.** 17/17 walkers, 8 ambient movers, passengers on all four empty
vehicles. Four more traps worth keeping:

**A GLOBAL SEARCH-AND-REPLACE ON PALETTE NAMES HITS THE WHOLE FILE.** Substituting guessed
colour names for real ones turned every person in Marrakech camel-brown and every pair of legs
in Cali chiva-blue — `skin3`, `cloth5`, `stoneDark` and `denim` are GENERIC palette entries and
were never missing; only my chapter-prefixed guesses were. Caught by reading the diff, reverted,
re-applied. Check a substitution's COUNT, not just that it compiled.

**shared.js imports three and nothing else, deliberately.** The first `makeMover` built its own
CANNON body behind a `typeof CANNON !== 'undefined'` guard, which is always false there — it
would have shipped every ambient mover with no collider and nothing to say why. The chapter
makes the body; the helper drives it.

**A BUILD CALL THAT TAKES A GROUP MUST COME AFTER THE BUILDER THAT MAKES IT.** `quayBuildWheekPax`
was written three lines above `quayBuildBoat` and did nothing at all, silently. Same shape for
the chiva, the Mong Kok bus and the Rio cabin.

**AND A WALKER'S ROUTE FAILS ON THE NAV GRID MORE OFTEN THAN ON THE TERRAIN.** Both refusals in
the second walker batch were `blocked`, not a slope — the Quay commuter's far end was inside the
finger sheds and Cali's embankment shelf is solid at both ends. `navBlocked` and `terrainHeight`
are both public on the biome api, so the harness can sweep candidate offsets with exactly the two
tests the rig's probe uses instead of guessing again.

Two claims in ROADMAP-DEPTH.md were wrong and are corrected there: Manly has the surfboat and
Antarctica the tender and its floes, so **Kyoto was the only chapter with no moving vehicle at
all** — confirmed by measurement, its new rickshaw is the only kinematic body in the file.

**TIER 3, THREE OF NINE (Hong Kong, Palawan, Cappadocia).** And the single most important
finding of the whole session, which is about the harness:

**THE PLAYWRIGHT PROBE HAD NEVER STARTED THE GAME.** `page.mouse.click(400,400)` does not start
it. A save file opens the title on page TWO, `titleEl`'s pointerdown only calls `startResume()`
on page ONE, and while `state.started` is false **systems.js's keydown handler drops every key**.
So every `q` and `w` in every smoke test was silently discarded and four commit messages said
"wheeked and walked" when only "entered" was true. The working sequence is: **reload, clear
localStorage, reload AGAIN, then click the button whose text is /begin/i at its own centre, then
poll `state.started` and retry.** Clearing on a live page is undone — the game writes its save
back before the unload — which is why a single clear-then-reload keeps landing on page two. And
`page.keyboard.press('q')` is too fast for an input edge read once a frame: hold it ~140 ms.

**A FUNCTION AT COLUMN ZERO CAN STILL BE NESTED.** Splicing `hkFireFinale`/`hkWheek` into the
middle of `hkUpdateShow`'s body parsed cleanly and put them at column 0 — but they became inner
declarations, so `createKowloon` could not see `hkWheek` and every wheek threw ReferenceError
inside the event emitter. Anchor an insertion to a `function name(` DECLARATION line, never to
a line inside a body. A brace-counting script written to rescue it was itself wrong, because it
counted braces inside comments and strings.

**AND TWO ROADMAP ITEMS WERE REFUSED ON CONTACT WITH THE FILES** (three across the session,
counting Iceland's act move). D4.2 wanted a task on Palawan's wheek shell; palawan.js says "there
is no task on this and there never will be" and that is correct — a task would spoil the one
thing in the chapter nobody designed. Shipped instead: the manta stirs the plankton (0.603 m/s
near her against 0.121 in the control band). **Read the file's own argument before overriding
it.**

Cappadocia's `sunrise` gate now needs the burner lit AND the player aboard — latched across the
whole window, never sampled at one frame, because that file has already been bitten by a
single-frame gate once. The old gate tested altitude alone and could in principle pay out with
the balloon up and the player watching from the field.

**TIER 3 CLOSED — nine marquee verbs.** Three more traps, all of the same family: *a gate that
cannot be met*.

**A CONDITION THAT SOUNDS RIGHT CAN BE UNREACHABLE.** Venice's new `flow()` returned zero unless
`venIsOverWater(x,z)`. Correct-sounding and fatal: the current runs during the tide's RAMP and the
square is only under water at the TOP of it, so on the piazza the term was zero for every frame a
player could be swimming in it — sixty seconds of sampling produced not one non-zero reading. The
gate was never needed at all, because capybara.js applies `flow` only while `capySwimming`.

**A FOLLOWING TERM DOES NOTHING IF NOTHING EVER CATCHES UP.** Monaco's three cars share one
curvature speed law and start a third of a lap apart, so the new eighteen-metre lookahead could
never fire: closest approach over 96 s was 107 m, exactly their built spacing. They needed
per-car PACE (±8 %; ±4.5 % closed only ~8 m a lap, which a player riding half a lap never sees).
Measured after: 16.2 m.

**AND ALWAYS LATCH A WINDOW, NEVER SAMPLE A FRAME.** Cappadocia's `sunrise` now needs the burner
lit — held across the whole eleven-second window, because that file had already shipped a
single-frame gate once and it paid out with the sun a hundred metres under the valley floor.

**REFUSING AN ITEM IS PART OF THE WORK.** D4.2 wanted a task on Palawan's wheek shell;
palawan.js says "there is no task on this and there never will be" and is right. Three items were
refused across the whole roadmap (Iceland's act move, Palawan's task, and the caravan re-route),
each with the reason written into ROADMAP-DEPTH.md.

**And one shipped undemonstrated and says so**: Sydney's gull mob now targets a CARRIED cone, but
Sydney's gull meshes carry no `name`, so the probe could not find them to measure. Same discipline
as Hanoi's pavement folk. If this is picked up again: name the gull InstancedMeshes first.

Useful harness facts earned here: the grab is a wind-up, so hold E ~650 ms rather than tapping;
`page.keyboard.press` is too fast for any input edge; and `g.props` is walkable from the page for
finding a prop by `type`.

Related: [[capy3-the-locals]], [[capy3-the-lift]], [[capy3-the-middle-rung]],
[[capy3-shared-module-blindness]], [[capy3-the-second-beauty-pass]], [[headless-qa-harness]]
