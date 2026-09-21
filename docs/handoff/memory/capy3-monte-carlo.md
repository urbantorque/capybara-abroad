---
name: capy3-monte-carlo
description: "Chapter 18 (monaco): the first chapter that denies anything, and the five things that measured wrong"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0366ded3-f17a-4f15-9340-54129eac34b7
  modified: 2026-08-26T00:29:50.297Z
---

Chapter 18 is Monte Carlo at blue hour (`src/monaco.js`, ~4,140 lines, built 26 Aug 2026).
Three mechanics: THE EYE (five sweeping cones inside the Casino, `monSeen`, ejection to the
steps), THE STACK (plaques into a turning roulette wheel — red 2, black 1, green 8, nothing
ever lost), and THE CIRCUIT (three cars lapping the streets; the marquee is 111 m of tunnel
on the roof).

**The eye is built out of verbs that already existed** and that is why it needed no tutorial:
the LOAF halves a cone's range (`monEYE_LOAF`), running raises it by half. There is no meter —
the cones are wedges on the marble that go red. The penalty is ten seconds and whatever was in
the mouth; nothing is denied.

Five things that measured wrong and would be re-derived otherwise:

1. **A watcher must not be in its own cover list.** `monBlockedSight` casts FROM the croupier's
   position, so a cover circle centred there is a ray blocked at t = 0. With one, the room could
   not see anything ever, and it looked exactly like a mechanic that was working.
2. **`monEYE_FILL` 0.60 was a mechanic that was switched off.** Thirty seconds of pacing the
   atrium at a run peaked at 0.46. A sweep at 0.7 rad/s holds a point ~1.3 s, so a fill that
   cannot reach 1.0 in a pass and a half never fires. 0.86 fill / 0.58 drain.
3. **The car had to become open-topped.** A roof at 1.44 m is unreachable — `capyJUMP_V` peaks
   at ~1.2 m of rise — and splitting the collider into deck + cabin left a 55 cm boot, so the
   animal landed on the cabin and was posted off in 84 frames. One box at 0.95 m with FOUR
   RAILS round the cockpit. Corner speeds also had to come down: `v = C/sqrt(k)` means C² IS
   the lateral acceleration, and 3.4 was 1.2 g.
4. **Rotations are +yaw, never −yaw.** A box turned about Y by θ sends local +z to
   (sin θ, cos θ) — the same convention `monTrackAt` returns a heading in. Negating it mirrored
   every kerb, barrier and tunnel wall about the z axis; on a straight it looks like nothing and
   on the west quay it was 100 m of armco lying across the road.
5. **A spawn is not a coordinate you pick off a map.** Four in a row landed inside the crash
   barrier, inside a palm row, inside a building, and with the CAMERA inside a palm. The fifth
   was swept: `navBlocked(x,z,3.2)`, a road-distance test, a clear camera arm at the spawn's own
   yaw, and an open view. See [[capy3-hanoi]] — the same sweep found that one too.

An elliptical terrain pad **cannot have a gentle side** (Le Rocher's rim was 1.79, sixty
degrees); the ramp up it is a second CENTRELINE with the terrain blended toward it, at 24%.
Same machinery as the circuit and the chiva road — see [[capy3-centreline-worlds]].

Related: [[capy3-hanoi]], [[capy3-external-forces-on-the-capybara]], [[capy3-the-middle-rung]],
[[headless-qa-harness]]
