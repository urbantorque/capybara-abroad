---
name: capy3-world-size-audit
description: "Measured scenery density along every capy3 chapter's walking route — which worlds are the right size, and the one that is not"
metadata: 
  node_type: memory
  type: project
  originSessionId: 154f62c3-cf4e-4dab-9e76-bcb5605fc33c
  modified: 2026-08-19T07:36:42.141Z
---

Measured 19 Aug 2026 under the playwright harness. The method is worth repeating: walk each
biome's main route, bucket every VISIBLE mesh centre within 30 m of the line into 20 m cells
(sampling instanced meshes ~60 deep so a grass field does not count as one object), and count
cells holding fewer than three things. See [[headless-qa-harness]].

    biome     route   empty 20 m cells   longest dead stretch
    sydney     70 m        1/4                  20 m
    pasto     116 m        0/6                   0 m
    cali      104 m        0/5                   0 m
    rio       108 m        0/5                   0 m
    venice     98 m        1/5                  20 m
    kyoto     350 m        5/18                 40 m
    sahara    350 m        6/18                 40 m
    kowloon   220 m        4/11                 80 m
    iceland   322 m        9/16                 80 m

**The five compact chapters (70–116 m) have essentially no dead ground and are the model.** The
long ones are mostly fine because their length is not WALKED: Kyoto's is the Uji run, Marrakech's
empty cells are the hamada crossed by caravan (and its emptiness is the stated point of the
chapter), and Kowloon's dead 80 m is Victoria Harbour, crossed by the Star Ferry.

**ICELAND IS THE OUTLIER AND IT IS THE ONE TO FIX.** More than half its route is empty, and the
dead ground is not incidental: the tail from z ≈ −40 to −196 reads `2,2,0,1,3,4,0,1,1` — a
hundred and sixty metres of almost nothing, and it is the approach to the glacier. Because
`glacier-run` is a RECORD, the player climbs it again every attempt, so the emptiest stretch in
the game is the toll on the best twenty seconds in it, charged repeatedly. Screenshots at
(0, 44) and (0, −46) confirm the numbers rather than contradicting them (the usual caution in
[[capy3-visibility-metrics]] cuts the other way here).

The cheap fix is NOT more scenery — the austerity is the chapter. It is to make the return trip
short: something at the snout that puts you back at the top, on the same principle as the
caravan and the Star Ferry, both of which are why the other two long chapters measure fine.

Also measured and healthy: solver contacts over ~180 frames of walking are 334–548 in ALL
eleven biomes (the detector in [[capy3-biome-build-gotchas]] — zero means no collision floor).
No biome is riding the analytic backstop any more.

Related: [[capy3-progression-chain]], [[capy3-slip-and-sky]]
