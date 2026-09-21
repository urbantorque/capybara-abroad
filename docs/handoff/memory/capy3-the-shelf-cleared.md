---
name: capy3-the-shelf-cleared
description: "X8 — three shelf items that were wrong about their own subject, and the bug that only appeared once a thing became solid"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1cd09aae-9ae1-4c12-8402-6022ae8c2dc8
  modified: 2026-09-04T23:59:05.535Z
---

Batch X8 of ROADMAP-PHYSICS.md, landed 5 Sep 2026. Eight of the nine shelf items.
The generalisable part is not the fixes; it is that **a shelf entry is a hypothesis, and
three of nine were wrong about their own subject.** Measure the entry before you implement it.

**A hook with seventeen publishers and no consumer is not the problem. The problem is that
the seventeen do not agree.** `slopeAt` — twelve chapters return rise over run, Cappadocia,
Palawan and Venice returned `atan()` of it (radians), and Kowloon returned radians differenced
along **z only**, so a Mong Kok street climbing east read as flat in the one chapter whose
premise is that up is a direction. Nobody had found it because nothing at runtime reads it, and
the dozen QA probes that do compare against 0.75 thresholds where atan(g) ≈ g. The roadmap's
two options — delete it, or have the animal read it — were both unavailable: capybara.js and
npc.js each need a SIGNED grade along a direction, which a magnitude cannot give. Same shape as
`localWater`: capybara/systems asked `waterHeightAt` only behind a flag, props/weather/npc asked
unconditionally, and four chapters that never set the flag disagree with themselves by up to
63 cm (Monaco 0.627, Kyoto 0.577, Quay 0.289, Cali 0.100). **Kyoto had already worked around it
by rewriting its own published `waterLevel` every frame from the animal's position** — which is
the tell to look for: a published datum that moves because the player walked somewhere is a
chapter routing round a broken contract. One resolver, `waterYAt(api,x,z,miss)` in shared.js, no
flag.

**A mechanism stated in a roadmap is a guess until it is stalled.** The shelf said velocity-only
carriers "drift at refresh rates other than 60 Hz". They do not: main.js calls the three-argument
`world.step(1/60, dt, 5)` and cannon owns an accumulator, so 144 Hz integrates the same elapsed
time. What costs ground is a frame longer than five substeps — 83 ms. Measured on Monaco's car,
commanded travel minus actual over 2 s: clean 0.203 m, one 300 ms stall **3.13 m**, one 600 ms
stall **14.12 m** (600 ms at 26.5 m/s commands 15.9 and five substeps deliver 2.2). And the
shelf had the polarity backwards relative to CONTRACT.md, which was itself wrong: rule 2 said
never write position, with three named exceptions, and the census found eight carriers doing it.
What threw Cali's barrow off was a **zero velocity**, not a written position — a mass-0 body with
no velocity is solid ground to the contact sweep. Both patterns are correct; rule 2 rewritten.

**A sanity clamp below the fastest honest value is a speed limit.** `capyPLAT_VMAX` was 12 and
Monaco's cars do 26.5. The ride mostly survived anyway, which is why nobody caught it: the
cockpit has four rails and the solver made up 14.5 m/s by shoving. One of three legs held 8/40
samples. Census first (`qa/px-carriers.js`: fastest carrier in the game 26.5, next 8.6), then 30.

**Making a drawn thing solid is how you find out it was never where it was drawn.** Quay's 33
moored yachts got colliders; an animal put on one rested at y 21.34. Sampled 20×20 per field:
field 1 was 247 of 400 cells DRY with terrain to 26 m, field 2 was 74 dry. Thirteen yachts had
been drawn at the waterline inside a headland since they were added. **A thing you cannot collide
with is a thing whose position nothing has ever checked.** Fixed by rejection sampling per boat
(up to 20 candidates, scored on clear water at a hull's length) rather than moving the fields,
which are a composition.

**`camCeil` is evaluated at the CAMERA, and that is only enough for a big room.** Kowloon's
awnings are drawn-only and cannot get a shell, because Mong Kok is ONE merged mesh 57×49×110 m —
"which object is in the way" has a single useless answer. So camCeil, the souk's lever, with two
corrections the souk never needed: (a) the number is the LOWEST band, not the commonest — the
strip is banded 463 cells at 4.5–5.0, 102 at 3.5–4.0, 60 below, and 4.45 still left one frame as
a red awning; (b) ask at BOTH ends of the sight line and take the lower, because a dai pai dong
is 7×10 m and with the animal at its tables the lens sat at 6.80 out on the road and nothing
fired. Occluded frames 16/36 → 4/37.

**"Confirm reachability first" is a real test and it takes four tries to get right.** The last
shelf item named three things drawn-and-not-solid; the answers came out opposite. Sydney's nine
sails and two ferries carry a comment saying "no way for the player to reach them" — but the
chapter's own `bounds()` is x ±140, z −150..−8 and all eleven sit inside it; measured, twenty
seconds on one held key from the sea wall gets within 6.8 m of a hull. They are solid now, and
they CARRY (decks 0.58 m over the waterline), which forced a second fix: both ferry legs ran to
x ±150 against a bound of ±140, so a ride ended in the out-of-bounds rescue. **A carrier's whole
route has to be inside the world the passenger is allowed in** — CONTRACT rule 7 says check the
endpoints against static boxes; this is the same rule against `bounds()`.
Quay's Harbour Bridge went the other way: 38 cars and a train on a deck at 25 m, and the deck has
no collider for 300 of its 380 m. Thirty-two swim legs (bluff, pylon, pier; four sides; four
keys) top out at **2.28 m**, never grounded, and the chapter publishes no `climbHold`. So the
deck rightly has no floor and the traffic rightly has no bodies — and that is now written next to
the deck, because a bluff that ever becomes climbable turns it into a hole with cars in it.

**A reachability probe that starts inside the thing it is testing measures the solver, not the
player.** My first bridge probe dropped the animal at `bluff.z + 34` where the bluff radius is
42: it was ejected out of the top and read as a 25 m climb. Then the second could find no water
because it tested `terrainHeight < waterLevel` and Quay reports terrain **0** over open water
against a waterLevel of −0.5. Then the third swam the wrong way, because which of W/S faces a
target depends on the camera's yaw. Only the fourth — start where the chapter says water, run
every key, keep the leg that closes the distance — was worth a number. The same class caught a
comment in `quayBuildLand` claiming the animal "stands on the rim at 21 m" of Bradleys Head: run
as a control it measures 2.07–2.29, so that comment was written from a teleport too.

Instruments left: `px-ride-mon`, `px-carriers`/`-carriers2` (counts position writes by patching
`set` on each body's own vector; names the writer from `Error().stack`), `px-hitch`, `px-hooks`,
`px-hk-awn`…`-awn4`, `px-hk-spots`, `px-moor`…`-moor5`, `px-bodies`, `px-swim`.
See [[capy3-instruments-that-cannot-hold-a-line]] — px-hitch's FIRST version reported −6.997 m on
a clean run because it compared `lap()` (which wraps) against a body it picked separately.

Related: [[capy3-pasto-by-name]], [[capy3-physics-review]], [[capy3-carriers-that-drop-you]],
[[capy3-solid-or-drawn]], [[capy3-the-sea-has-a-shape]], [[capy3-lens-and-wall]],
[[headless-qa-harness]]
