---
name: capy3-the-independent-list
description: "Batch 8 of the Lift Pass — the float that bulldozed the spawn, the deck that was a lid, and the route probe that ranks placement style"
metadata: 
  node_type: memory
  type: project
  originSessionId: cfb59242-b95a-4fc9-a34b-531315af5e59
  modified: 2026-08-26T23:16:09.374Z
---

Run 27 Aug 2026. Nine per-chapter rows plus one restatement; six fixed, four restated. This is
the batch that closed the oldest open finding in the game, and the lesson in all three of its
real fixes is the same: **the thing the number pointed at was not the thing that was wrong.**

## Pasto's drift was a kinematic slab, not a velocity write

Four passes hunted a bare `body.velocity` write because a parked animal slid 8 m in 60 s while
holding *exact* velocities. There is no such write. The method that settled it in two runs:

    // every setter on the body, tallied by stack, with world.step bracketed out
    let inStep = false
    const real = g.world.step
    g.world.step = function () { inStep = true; try { return real.apply(this, arguments) }
                                 finally { inStep = false } }
    b.velocity = new Proxy(b.velocity, { set (t, p, v) { if (!inStep) tally(stack()); t[p] = v; return true } })

`velocity` named three writers, all `capybara.js`. Swapping the proxy to `body.position` named
the real one: **100% of the displacement came from `world.step` at `main.js:993`** — cannon's
own integrator resolving a contact. The contact was `pastoCarBody`, the Carnaval float: a
3.24 × 6.60 m KINEMATIC box standing **on** the cobbles (y 0…1.55) driving the x = 10.5 line at
2.15 m/s, and spawn+(9,9) is x 9.0 — **0.12 m inside its near edge**.

**And the "exact −3.000" was `capyPIN_VMAX`** — the anti-creep pin saturating against a push it
could not beat. The signature everyone read as the bug was the fix losing. See
[[capy3-external-forces-on-the-capybara]].

Fix: `pastoCarBlocked()` — a procession stops for a capybara. Three things it got wrong first:

1. The rear bound of an "is something in front of me" test is **the body's own back face, not
   zero**. `ahead > 0` waves through the animal standing *inside* the footprint, and that is
   the case that leaked 30 m.
2. ...but **not as far back as the boarding point**. The hitch at −3.72 is the way aboard and
   she must keep rolling while you climb it.
3. Being ABOARD is not being in the way, or the chapter's own mini gates itself.

Differential, four float phases: **9.18 · 28.76 · 7.63 · 7.98 m → 0.24 · 0.42 · 1.78 · 0.61 m.**

**The residual at the actual spawn is the abuela.** `paShoveCapy(rec, 78, 46)` from
`paStepHuman`, `velocity.y += 1.533` every 2.6 s = `rec.swatCd`, through `applyImpulse`. Not a
defect; `npcBlockedFor` gates chase out on purpose. Do not "fix" it again.

## A ladder hole that closes becomes a lid

Hong Kong's roof was "0.65 m out of reach" through three versions with a warning not to lower
`hkSCAF.top`. It was **a height, not a distance**: an earlier fix closed the topmost scaffold
deck's ladder hole, making it a continuous plank at y 34.68…34.92 **directly over the climbing
face**. Head meets underside at 34.68, climb tops out at 34.365, roof edge is 0.63 m west.

The way to see this is to list every static box whose footprint covers the climb line, sorted
by height — three rows, and the answer is in the middle one. The fix moves the hole to the
outer face (two planks, a 1.30 m slot) instead of closing it. 34.36 → **34.85**.

**RULE: a deck over a climbable face is a ceiling. Check the climb line against the colliders
ABOVE it, not only the ones beside it.**

## qa/route.js ranks placement style, not density

It locates every mesh at its **bounding-box centre**, so a chapter built from a few large
merged surfaces reads as empty from a metre away and one built from 13,458 scattered instances
scores zero. Photographed, Kyoto's worst "dead cells" put the camera *inside a Gion machiya*.
Monte Carlo's are a straight spawn→landmark line over a headland, which is not a walk. This is
the same probe whose count went UP when fifteen lamps were added on the line it complained
about. **Do not spend work on its ranking.** Manly's 617-object alarm is the same artefact.

Join [[capy3-instruments-that-cannot-hold-a-line]]: that list is about instruments that move on
their own; this is an instrument that is stable and measures the wrong quantity.

## Small things worth keeping

- Three published-but-unread APIs got readers, all proved firing in one run:
  `palawan.inZone('shaft')` → the new find `in-the-shaft`; `cave.nearestDrip()` →
  `wet-in-a-mountain`, which now means what its text says; `cave.echoReady()` → the new find
  `let-it-return`. FINDS 58 → 60. `qa/audit-tasks.mjs` does **not** fixture-check finds, only
  tasks, so adding one is cheap.
- Venice's pigeons are in the calm registry now (`bold: 0.85`); 6 of 19 chapters register a
  critter. Antarctica's penguins must NOT be — `ignored` is a find about being ignored.
- Iceland's snowcat cannot move: the moraine is the flat shelf at x ≥ 26 and everything at
  x ≤ 22 is glacier ice at slip 1.0. It is a 54 m walk, not a miss — `iceCAT_HOLD_MAX` holds
  the machine at the bottom for a measured **26.4 s** when you are at the runout.

Related: [[headless-qa-harness]], [[capy3-the-closeout]], [[capy3-lens-and-wall]],
[[capy3-the-place-remembers]], [[capy3-things-that-are-simply-there]]
