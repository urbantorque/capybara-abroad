# audit-ground.md — capybara sinking / hovering / ground-contact feel (read-only audit, 4 Sep 2026)

STATUS: IN PROGRESS (written incrementally; if this file ends abruptly the run died)

## 0. Contact steady state (code, CONFIRMED)
- Body: mass 30, three spheres r=0.34 at local z +0.34/0/-0.34 (capybara.js:2497-2507). capyR 0.34, capyFOOT_Y 0.34.
- World: gravity -24, solver 10 it, tol 0.002; capy/ground pair friction 0.00 restitution 0.00, contactEquationStiffness 1e7, relaxation 3 (props.js:330-396).
- Static penetration ~ m*g/k = 30*24/1e7 = 7e-5 m. NOT a source of visible sink. Walk probe confirms body y = 0.340 on flat ground to 3 dp.
- capyGROUND_SLOP 0.02 is the backstop dead band (capybara.js:254, used 3595), only when !grounded; REST_BAND 0.06, HOP_KILL 1.2.
- => "contact penetration" class is CLEAN. Any visible sink is render-side (model offset from body) or collider-vs-picture disagreement.

## 1. Render-side offsets that move the MODEL below the body (code, CONFIRMED)
capyModel.position.y is written in one chain per frame (capybara.js):
  5171: -capyFOOT_Y + bob(<=0.085) + capyLand(clamped >= -0.30) - capySLIDE_DROP*slideW (+0.02 swimming)
  5248: -= capyIdleCrouch
  5254: -= capyLoaf*capyLOAF_DROP
  5331: += capyPoseLift   (damped toward capyPoseRise*trust, capyPoseRise in [-0.45, +0.12])
capyPoseRise = clamp((sup - h0) - rise, -0.45, +0.12) where rise = FOOT_Y*|gF| + FOOT_Y*(sqrt(1+gM^2)-1)
  and h0/hF/hB/hP/hN come from capyGroundY == api.terrainHeight (the LAW, not the drawn mesh, not the collider).
  => on a 30 deg slope (g=0.58): rise = 0.34*0.58 + 0.34*0.155 = 0.25 m dropped; at POSE_MAX 35 deg (g=0.70): 0.34*0.70+0.34*0.22 = 0.31 m.
  => the drop is computed from the LAW gradient; where the collider is a Heightfield facet that sits ABOVE the law (lattice trap) the body is held up by the facet AND the model is dropped by the law's slope: two sinks add.
  => where the law is FLAT but the picture is a kerb/step/deck edge, the pose reads nothing (law-driven), so no drop: pose-lift cannot explain sink on decks (trust fades to 0 when body is >0.25..0.60 above the law).
Landing spring: capyLand clamped at -0.30 (5163), explicit Euler k=190 c=27 — stable only for dt < ~0.074 s; systems.js has NO dt clamp found by grep (to verify).

## 2. Lattice pass — drawn ground lattice vs CANNON.Heightfield lattice (code + qa/px-ground-b3.json.png, CONFIRMED)
Heightfield tiles read live (b3): EL / NX / NZ / X0 / Z1. Drawn plane read from source.
| chapter | drawn step x,z (span/segs) | HF EL | HF extent vs drawn | b3 pctOver15 (walkable) | drawnAbove% (=sink) | verdict |
| pasto | pastoREGION*2/44 (4 tiles, es 2) — law is pastoMeshY = the DRAWN mesh sampled | 2 | same | 1.5 | 1.3 | clean-ish (law==mesh) |
| kyoto | 340/92=3.70, 460/108=4.26 (kyoto.js:388-392) | 5 | HF Z1 210 vs drawn 230: HF smaller | 3.9 | 3.5 | LATTICE (two different grids) |
| cali | 420/96=4.375, 370/88=4.20 (cali.js:452-456) | 5 | HF Z1=170 vs drawn Z1=150: HF 20 m PAST the picture at +z | 2.9 | 0.1 | LATTICE + collider-beyond-picture strip (the -144 m outlier at z=162) |
| rio | 400/80=5.00, 330/70=4.714 (rio.js:536-543) | 5 | same box | 4.8 | 3.9 | LATTICE on z (memory said rio divides exactly: it does NOT, 330/70) — "undiagnosed" rio is this |
| iceland | 460/86=5.35, 430/104=4.13 (iceland.js:680-684) | 5 | same | 2.4 | 0.3 | LATTICE (memory said iceland divides exactly: it does NOT) |
| sahara | PlaneGeometry(1,1,114,52) scaled (sahara.js:3427) | 5 (100x56) | ? | 1.6 | 0.6 | clean in measurement |
| venice | 280/128=2.19, 230/106=2.17 | 2 | HF Z1 128 vs 130 | 1.0 | 0 | flat: harmless |
| kowloon | 300/60=5, 320/80=4 (kowloon.js:4707, translate z -60 -> Z -220..100) | 5 (Z1=120) | HF 20 m PAST the picture at +z (z 100..120) | 12.4 (ALL in the strip) | 0 | flat: z-lattice harmless; the strip is the -15.7 mean |
| palawan | 300/78=3.85, 380/96=3.96 | 4 | HF Z1 134 vs 130 | 0 | 0 | flat: harmless |
| goreme | 320/100=3.2 both (translate 20,-30 -> X -140..180, Z -190..130) | 5 (X0 -160, Z0 -200) | HF 20 m past picture at -x, 10 m at -z (83 noHit) | 1.0 | 0.6 | LATTICE 3.2 vs 5, mostly benign; gorRidge worst 22.8 |
| manly | 272/109=2.495, 212/85=2.494 (EL const 2.5!) | 4 | same | 5.1 | 1.1 | LATTICE: source says EL 2.5 for the mesh, live HF is 4 |
| pantanal | 264/88=3.0, 236/79=2.99 (EL const 3) | 4 | same | 4.1 | 3.5 | LATTICE 3 vs 4 |
| cave | nx*EL (fixed in block 10) | 3 | same | 0 | 0 | CLEAN |
| antarctic | 424/106=4, 624/156=4 (EL const 4) | 5 (85x125, Z0 -502) | HF 1 m wider | 3.0 | 0.7 | LATTICE 4 vs 5 |
| monaco | NX*EL (fixed) | 4 | same | 6.1 | 2.5 | residual = triangulation (opposite diagonals), cannot be fixed by lattice |
| hanoi | (X1-X0)/EL rounded | 5 | same | 0.3 | 0.1 | clean |
| sydney/quay/drift | no Heightfield: boxes (env.js:2297 ground box 70x6x40 @ y-6, seabed box) / quayGroundY / driTerrain | — | — | — | — | not lattice-class |
Note the sign: in every relief chapter drawnAbove (sink) >> drawnBelow (hover). A FINER picture over a COARSER collider is systematically below the picture on convex ground (a chord under a crest is lower), so the animal reads as sunk on every crest and never as floating. The fix is ONE lattice for both (draw over NX*EL from the corner with the same EL, as cave/monaco do), not a smaller EL.

## 3. Findings from qa/px-ground-walk.json.png (previous run; 7 chapters usable, sydney errored, 11 timed out on page.goto — server wedged after ~8 reloads)
Field meanings (read from the script): by=body y, ry=renderPosition y, terr=law, feet=world y of capyModel origin (= renderY - 0.34 + all model offsets), dg=drawn ground under renderPos (ray from feet+0.95, own meshes hidden, water skipped), soles[i]= sole world y - drawn ground under that sole (NEGATIVE = sunk, positive = hover; the script's own comment has the sign backwards), gr=grounded, sp=|v_xz|.

### 3a. CONFIRMED — Uji river bank (kyoto): stuck-rescue teleport loop while walking
kyoto slope leg, x -26..-22, z 116 (Uji, south bank of the river cut): body y -0.39 with law -0.36, drawn ground -0.73, i.e. the BODY sits 0.37 m below where the law says and 0.34 above the drawn/collider surface (collider == drawn here). The law has a bank lip both 5 m collider and 3.7x4.3 m picture lattices miss. Because gap = law+0.34-by = 0.37 > capySTUCK_GAP (0.22) and the body height is steady while walking (< capySTUCK_MOVE 0.05), the stalemate detector fires every 0.45 s: sample at x -23.76 shows by jump -0.39 -> -0.04 (teleport to law+0.34, capybara.js:3640-3653), then it falls back through -0.11, -0.16, -0.20, -0.23 and re-arms. Repeat firings within 2 s spiral SIDEWAYS 1.4-2.5 m (capyFreeSpot n>0). Class: lattice-vs-law feeding a rescue that measures against the LAW. Severity: HIGH (visible pop + sideways teleport on a walkable bank). Fix: judge "stuck" against the collider facet / a short downward ray or require a live contact-less state, not law-vs-body; or raise capySTUCK_GAP above the worst lattice error on walkable ground (~0.4). Effort 1-2 h.

### 3b. CONFIRMED — Pasto plaza platform: body ejected under the cobbles, and the rescue never fires
pasto "deck" leg: static box 17.2 x 15.2 m, top y 0.70 (walk-probe info: hx 8.6, hz 7.6 at (0,44)). Placed on its top edge the body was pushed DOWN and walked 9 m (z 47 -> 38) at body y -0.23..-0.37 under the cobbles (grounded true, feet 0.6-0.9 m under the drawn ground, all four soles -0.6..-0.96). The stalemate detector did NOT fire because the backstop/contact limit cycle moves the body 0.13 m per frame pair (-0.234 <-> -0.365), which exceeds capySTUCK_MOVE 0.05 and resets the timer every frame. Class: solid ejection + safety net defeated by its own oscillation. Severity: MEDIUM (entry needs a hop onto a 0.7 m lip since STEP_MAX is 0.40; once in, 9 m under the floor). Fix: the "not moving" test should use a low-pass of y or the MIN gap over the window, not frame-to-frame delta. Effort 0.5 h.

### 3c. INSTRUMENT — the +-0.30 m alternation in soles/feet at sp 0 (all chapters) is NOT a picture
At standstill on flat cobbles (pasto z 31.3, body 0.340 stable) `feet` alternates -0.300 / +0.27 on successive 50 ms samples. -0.300 is exactly the capyLand clamp (capybara.js:5163). The landing spring (k 190, c 27) is explicit Euler with NO sub-stepping (the pop spring above it IS sub-stepped) and game.tick clamps dt at 0.1 s (main.js:1986); it is unstable for dt > ~0.074 s, so under the previous probe's long headless frames it rang between its clamp and an overshoot for ever. Every "sink" of 0.28-0.35 with a flat law and dg near 0 in that file is this. It is ALSO a real bug on a slow machine or after a tab switch (dt 0.1): the model sinks 0.30 into the floor and pops 0.27 out of it on alternate frames until the frame rate recovers — PLAUSIBLE in the wild, CONFIRMED in the harness. Fix: sub-step the landing spring like the pop (5 lines). Effort 0.3 h.

### 3d. CONFIRMED — collider (and bounds) extend past the picture: Kowloon +z strip, Cali +z strip
Side probe (qa/px-ground-pose.js v1, side[]): kowloon (4,102): law 0, isOverWater false, boundsOf z1 = 120, and a downward ray from y 100 hits NOTHING visible (only hidden monaco/antarctic meshes). The drawn ground (kowloon.js:4707, PlaneGeometry 300x320 translated z -60 -> z -220..100) stops at z 100; the Heightfield (kowloon.js:4725-4740, Z0 -220, NZ 68 x EL 5 -> Z1 120) and therefore boundsOf() run to 120. 20 m x 300 m of in-bounds, walkable, invisible floor. b3's kowloon meanSigned -15.7 / worst -152 is entirely this strip (12.4% over-15 == 12.4% over-50): the b3 ray fell to a deep skirt; it is NOT a lattice number for Kowloon (Kowloon's 4 m vs 5 m z-lattice on flat ground is harmless).
cali (5,162): law 0, isOverWater false, boundsOf z1 = 221.7 (a bounding-radius union, main.js:483+), nothing visible under the ray. Drawn ground ends at z 150 (cali.js:452 Z1 = 150), the Heightfield at 170 (b3 tile Z1 170, NZ 78 x 5 -> Z0 -220). 20 m of invisible floor, then a 50 m band that is in bounds with no floor at all (void rescue at y < -3 is what catches you). b3's cali worst -144.84 at (5,162) is this strip, an instrument artefact for lattice purposes.
Severity: LOW-MEDIUM (edge of the map, but the fence lets you in). Fix: make the drawn plane and the Heightfield share X0/Z0/NX/NZ/EL (one set of constants), and have boundsOf() come from the DRAWN ground where a chapter has one. Effort 0.5 h each.

## 4. Walk probe per chapter (qa/px-ground-walk.json.png, parsed with scratchpad/parse-walk.js). sink = -min(soles) (m), hover = +min(soles); "landing-ring" = the +-0.30 instrument artefact of 3c is present, so p95 is contaminated in every row; the *stable* numbers are the standing/settled ones and body-vs-law.
| chapter | leg | ground mesh | sink p50/p95/max | hover p95/max | body-law (grounded) | verdict |
| pasto | spawn (cobbles) | pastoCobbles | 0.02 / 0.08 / 0.75 (one leg, sp 4.2: swing) | 0.08 / 0.11 | 0 | clean |
| pasto | slope gr 0.46 | pastoLandscape | 0.01 / 0.36 / 0.47 (one leg only, other three ~0) | 0.16 / 0.19 | 0 (body 0.835 on law 0.322: +0.17 = the sphere-chain rise on 0.46) | SLOPE: the downhill leg swings through the hill by up to 0.47 while walking; standing sink ~0 |
| pasto | plaza box | furniture/cobbles | 0.37 / 0.79 / 0.96, body UNDER cobbles 42 samples | 0.59 / 0.63 | -0.57..-0.71 | 3b |
| kyoto | spawn | kyoto | 0 / 0.32 / 0.32 (ring) | 0.36 / 0.39 (ring) | +0.13 (body 0.291 on law -0.178: collider 0.13 above law = lattice) | lattice +0.13 => model 0.13 m ABOVE the law on flat Gion, picture in between |
| kyoto | slope (Uji bank) | kyoto | 0 / 0.13 / 0.26 | 2.38 (airborne after teleport) | -0.37 | 3a |
| cali | spawn | cali | 0 / 0.31 / 0.32 (ring) | 0.38 / 0.42 (ring) | 0 | clean |
| cali | slope gr 0.25 | cali | 0 / 0.57 / 0.75 (two downhill legs) | 0.38 / 0.54 | +0.34 (body 1.08 vs law 0.40: rise 0.09 expected -> 0.25 EXCESS) | LATTICE: collider 0.25 above law -> model hovers, then pose-trust fades |
| cali | deck (-22,52 top 0.38) | cali | 0 / 0.31 / 0.32 (ring) | 0.40 / 0.41 (ring) | +0.20 (body 0.72 on law 0.18 = standing on the 0.38 slab) | clean (ring only) |
| rio | spawn | rio | 0 / 0.32 / 0.34 (ring) | 0.57 / 1.39 (one sample: hop) | 0 | clean |
| rio | slope gr 0.30 | rio | 0 / 0.39 / 0.41 all four legs | 0.23 / 0.24 | +0.02 | POSE/GAIT on a 17 deg slope: all four soles 0.40 under the picture at sp 0.58 |
| rio | deck (-8,-6) | rio | 0 / 0.34 / 0.35 (ring) | 0.40 / 0.69 | 0 | clean |
| iceland | spawn | iceland | 0 / 0.35 / 0.35 (ring) | 0.36 | 0 | clean |
| iceland | slope gr 0.39 | iceland | 0.13 / 0.34 / 0.35 all four legs, sp 0 (standing!) | 0.43 / 0.63 | +0.03 | STANDING sink 0.30-0.35 on a 21 deg slope: see 5 |
| kowloon | spawn | kowloon | 0 / 0.38 / 0.38 (ring) | 0.34 | 0 | clean |
| goreme | spawn | goreme | 0.01 / 0.09 / 0.09 | 0.12 | 0 | clean |
| goreme | slope gr 0.47 | goreme | 0.37 / 0.95 / 0.97 (three legs 0.78-0.98) | 0.20 / 0.21 | -0.11 (body 6.53 on law 6.30: collider BELOW law by ~0.1) | WORST: model origin 0.13 under the picture, soles up to 0.97 under it on a 25 deg hillside |
| goreme | deck (-7,43.5, top 10.8) | goreme | 0.08 / 0.46 / 0.47 all four | 0.19 / 0.21 | -0.11 | same hillside below the deck |

## 5. Ground-contact FEEL constants (capybara.js, CONFIRMED by reading)
- step-up: capySTEP_STALL 0.09 s blocked before assist, capySTEP_V 2.9 m/s rise, capySTEP_MAX 0.40 m per blockage, capySTEP_FRAC 0.34 (397-400). A 0.7 m plaza lip (Pasto) and any deck > 0.40 need a hop.
- coyote: capyCOYOTE 0.12 s (360), effGround = grounded || airTime < 0.12 (4086).
- landing: capyLAND_K 190 / C 27 / SCALE 0.022 m per m/s, clamp -0.30, only if fall > 0.8 m/s (386-388, 4093). Peak dip for critically damped = v0/(w e): fall 5 m/s -> 0.08 m; 2 m drop (9.8 m/s) -> 0.155 m; clamp -> 0.216 m. The landing dip puts the FEET that far into the floor for ~0.1 s by design; it is model-only.
- slope pose: LOOK 0.45 fore/aft, WIDE 0.30, MAX 35 deg, LIFT -0.45 / RAISE +0.12 clamp, LAMBDA 5; TRUST 0.25..0.60 m body-vs-law disagreement fades it (489-509). capyPoseRise = (sup-h0) - rise, rise = 0.34|gF| + 0.34(sqrt(1+g^2)-1): 0.25 m at 30 deg, 0.31 m at 35 deg. The -0.45 clamp is unreachable (sup >= h0 always), so the model is never dropped more than 0.31.
- WHY A SLOPE STILL READS AS SUNK EVEN WHEN THE POSE IS RIGHT: the pose pitches the model by atan(gF) about the model origin, which sits at the belly line (-capyFOOT_Y under the body centre), and drops it by `rise`. The four soles are at y -0.32 under hips at |x| 0.15, z +-? (capyLEG_R 0.30). On a uniform slope this is exact; on the FACETED collider + faceted picture it is not: iceland slope standing (sp 0) shows all four soles 0.30-0.35 under the picture with body-law +0.03 and drawn ground == law (dg 2.706 vs terr 2.697). With the law, the collider and the picture all agreeing to 1 cm, the only remaining writer of a 0.33 m sink is the model transform itself: capyPoseLift (~ -0.16 for g 0.39) plus the landing ring (-0.30 in the probe) — the standing iceland row was sampled 0.5 s after a teleport-drop, so the ring owns most of it. NEEDS the v2 probe (section 6) to separate.
