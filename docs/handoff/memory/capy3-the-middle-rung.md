---
name: capy3-the-middle-rung
description: "capy3's `mini` tier — the payoff between a toast and the banner, the seventeen set pieces built on it, and the pacing number that says what is still missing"
metadata: 
  node_type: memory
  type: project
  originSessionId: b557d31b-0533-4d0c-b6a7-7f2898d00c6e
  modified: 2026-08-20T02:12:46.971Z
---

Built 20 Aug 2026, the night after [[capy3-the-lift]] finished the banner. **Second half added
the same day: four chapters have TWO now.**

**THE PROBLEM WAS A MISSING RUNG, NOT A MISSING FEATURE.** With `wow` built, a chapter had
exactly two kinds of line in it: the one moment it is for, and a hundred and fifteen switches.
Everything in between — riding a thing, being carried by a thing, standing somewhere at the
moment something happens — was paid out exactly like picking a sandwich up off a rug.

`mini: 'CAPTION'` in TASKS. **One or two per chapter, never more, never on the same row as
`wow`** — `qa/audit-tasks.mjs` enforces both and prints the tally. `completeTask` pays it on the
same three channels at half of each: `musSwell(0.55)` (same figure, same palette, so it still
cannot be out of key), the **moment card** (`showMoment` — paper like a toast, composed like the
banner, kicker ABOVE the rule, 2.6 s), eighteen scraps not twenty-four. It is a BIGGER TICK and
not a smaller marquee, and the two have to stay different in KIND or the banner stops meaning
anything.

Thirteen of them at first, one per chapter, eight being the first thing in their biome that
moves on its own: a Mr Whippy van, a Carnaval float, a real Manly ferry, a bonshō you stand
INSIDE, a fruit barrow, the set at Arpoador, a humpback, the acrobats of Amizmiz, seed-heads on
the wind, the traghetto (standing), an open-top bus, a bait ball, and eleven horses.

**THE FOUR SECONDS, chosen by measurement and NOT by taste** — `qa/pacing.mjs` names the four
chapters furthest under the twenty-minute floor, and no chapter got a second moment of the same
KIND as its first:

- **Rio, `o-bonde`.** `rioBuildLapa` had drawn forty-two arches with a deck across them and the
  comment "where the tram runs" — and there was nothing on it, NO COLLIDER at all, and no way
  up. Now: a viaduct off Rua Lapa, two yellow open trams on 1.55 m tracks, and they pass out on
  the arches a metre apart. You ride the running board.
- **Venice, `volo`.** The one chapter whose argument is a metre of water and the only one that
  never showed itself from above. A wire from the campanile to a stage at the far end of the
  Piazza; the twelve seconds going UP are the set piece, the flight is the encore.
- **Hong Kong, `choi-cheng`.** Nine plum-blossom poles in the road, a drum and a gong, and a
  lettuce on a bamboo rig. The lion rests on the tarmac head-DOWN, which is a ramp, then goes up
  the poles in eight leaps with you aboard.
- **Palawan, `the-manta`.** The only carrier in the game that is an animal deciding where to go.
  Grab the leading edge (E, and you must be UNDER — the chapter's verb is the price of admission
  to its own middle rung), then a barrel roll at ten metres and it leaves the water.

**NINE OF THE THIRTEEN CARRY THE ANIMAL, SO THE CARRIER RULES ARE IN CONTRACT.md** — rule 2 is
the one that keeps being relearnt: *move a kinematic carrier with `velocity`, never by assigning
`position`*, and difference against the PREVIOUS TARGET on **all three axes**.

**TWO NEW RULES, BOTH PAID FOR ON THE VOLO, BOTH NOW RULES 6 AND 7:**

1. **Do not assign the passenger's velocity unless the carrier rises as fast as the animal does.**
   The Volo was first written the way the balloon is written — `carryFrame()` for horizontal,
   vertical assigned in the biome — and it threw its rider off the top of every haul. Measured:
   0.44 m over the floor for thirty metres, then 0.78, then thirty-two metres down. Assigning the
   velocity makes the animal match the floor exactly, so it never PENETRATES it, so there is no
   contact; and a DECLARED frame latches for `capyPLAT_AIR` (1.2 s) with nothing underfoot. At the
   ease-out the cradle slows and the animal does not. The balloon needs that machinery because it
   rises at the animal's own rate. A winch does not — a floor coming up at 3.5 m/s under a
   standing animal is the most honest contact this solver gets. **The safety argument is the
   ACCELERATION, not the speed:** smoothstep over 32 m in 12.5 s peaks at 1.3 m/s², an eighth of
   a gravity. Hong Kong's lion leaps on the same rule — 0.5 m over 2 s, a tenth of a gravity — and
   that is the whole reason a carrier that JUMPS can hold a passenger.
2. **Check a carrier's ENDPOINTS against the world's static boxes, not just the middle.** The
   Volo's first belfry anchor was inside the campanile's own 7.8 m collider on all three axes: it
   rode perfectly for thirty metres, entered the tower over the last two, and the solver ejected
   the passenger. Same family as the herd through a fairy chimney.

**AND ONE GEOMETRY LESSON THAT GENERALISES.** The manta's wing was eleven spanwise slabs, each
thicker and shorter than the last: it photographed as a venetian blind, and at four segments as a
raft. The fix was to yaw each segment to the LOCAL SLOPE OF ITS OWN SWEEP LINE, so the leading
edge is a curve made of creases rather than a staircase — and to remember that a manta is twice
as wide as it is long. Same class as Rio's `atan2(dy, dx)` on a line whose x DECREASES, which
returns 157° instead of -23° and rendered both trams belly-up.

**PACING, MEASURED: `qa/pacing.mjs`, now keyed by TASK ID rather than by biome** (a single number
per place silently dropped every second mini out of the model). Thirteen chapters, 133 tasks,
12-21 min at 40 s per ordinary task and 18-36 at 90 s. **The honest number: a second mini is
worth 25-35 s and moved each of those four chapters by about ninety seconds. That is real density
and it is not enough to lift a nine-task chapter from thirteen minutes to twenty.** The script now
prints the remaining backlog itself — **sixteen ORDINARY tasks over ten chapters at 75 s each**,
because an ordinary task costs its own time AND another crossing of the map. That is the lever
left, and it is smaller than it looks.

Related: [[capy3-the-lift]], [[capy3-external-forces-on-the-capybara]], [[capy3-reference-frames]],
[[capy3-world-size-audit]], [[headless-qa-harness]], [[capy3-things-that-are-simply-there]]
