---
name: capy3-something-eats-something
description: "Tier 5 — the first predator-prey coupling in capy3, and the four ways a hunt measures as nothing"
metadata: 
  node_type: memory
  type: project
  originSessionId: d64d47e9-349d-4ec8-b5fe-04884a377f9c
  modified: 2026-09-10T12:36:11.457Z
---

Before 10 Sep 2026 **nothing in capy3 hunted**, and this was verified across the
whole tree rather than assumed: `addCritter` is a FLEE registry measured against
the player, `herdOffer` is a follow-the-leader solver whose leader is always the
capybara, `flockOffer` is scatter-and-peck, and the only real chase solver in
172k lines is in `npc.js` and is a person chasing you about a sandwich.

Three hunts shipped — Antarctica's skua on the gentoo colony, Palawan's terns on
the bait ball, the Pantanal's onça on the capybara herd. See
[[capy3-hub-payoff-pass]] for the surrounding passes.

**THE PLAYER IS NEVER THE PREY.** A jaguar's favourite food is a capybara, and
the game has no fail states outside Marrakech's chase — a predator that could eat
you would be a different game and would poison eighteen other chapters. She walks
straight past you, which is also funnier.

**THE TWO CHAPTERS WERE ALREADY WRITING CHEQUES FOR IT.** `antarctic.js:4854`
said the skua "drops on a nest, gets shouted at" and both halves were false;
`pantanal.js` promises a jaguar in THREE dialogue strings and grep found those
three strings and nothing else. The dialogue was written years before the animal.

## Four ways a hunt measured as nothing, all caught before shipping

1. **The tern aimed at the AXIS of the torus** — the hole in the doughnut. Every
   fish is ≥2.15 m off that axis, so a 2.6 m punch grazed the inside of the ring
   and moved the mean shoal spread by THIRTEEN MILLIMETRES. A tern hits the ball.
2. **The mean was the wrong instrument for a local hole.** Mean spread over 118
   clumps says nothing about a 3 m puncture; max per-fish displacement from the
   undisturbed torus says all of it.
3. **The onça rushed at u = 0.14.** The "is anybody within 21 m" test was true
   almost at once, so the stalk — the thing the state exists to draw — lasted
   eight seconds at the end of the bank nobody stands at. A stalk needs a FLOOR
   or it is a spawn.
4. **The colony reaction cost four lines** because `antCallX/Z/R` was already a
   wave front parameterised by an arbitrary point. It had exactly one caller (the
   wheek) and nobody had noticed it was general. Look for these before building.

## The player's voice, spent on somebody else

Two of the three are interruptible and that is what makes them mechanics rather
than cutscenes. Wheek at the skua inside 40 m and the chick lives (`took` 1,
`saved` 1). Wheek at the onça during the stalk and she stops, looks at you and
leaves without rushing — 0 of 9 scattered against 9 of 9. It is the first time in
nineteen chapters the animal can spend its voice on anything but itself.

`antSkuaFlush` already existed as a cosmetic flinch on a dive that was going
nowhere. Giving an existing decorative term a consequence is cheaper than a new
system and reads better, because the animation was already tuned.

## They interact, and it will eat your controls

A D4.13 A/B control run in the Pantanal ended with one follower instead of seven,
`lost` at zero — which looked like a bug in the river work and was **the jaguar,
committed forty seconds earlier**, `runs` 0 → 1. Re-running with `game.state.noHunt`
made the control behave. **Suppress one new system when measuring another in the
same file**, and add the other system's state to the probe output so an anomaly
identifies itself instead of costing a run.

Shared cut for the whole layer: `game.state.noHunt`.
Instruments: `antarctic.skuaDebug`/`skuaTo`/`skuaFlush`, `palawan.ternDebug`,
`pantanal.jaguarDebug`/`forceJaguar`/`herdToCrossing`.
