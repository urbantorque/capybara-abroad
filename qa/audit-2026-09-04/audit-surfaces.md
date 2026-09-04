# Surfaces audit — environmental / mechanical factors on the capybara

Read-only audit, 2026-09-04. Repo at HEAD 6672547 (D10). src/ untouched.
Status tags: CONFIRMED = read in code and/or measured; PLAUSIBLE = inferred from code, not measured.

## 1. Hook matrix

Consumers resolve the LIVE biome (`capyBiomeApi` / `physBiomeApi`, sydney -> game.env, else game[name]).
capybara.js reads via `capyAskNum` (finite-number guard, default) or `typeof api.x === 'function'`.

| hook | publishers (18 biomes + env) | consumers | default when absent | verdict |
|---|---|---|---|---|
| terrainHeight(x,z) | all 18 (env not — Sydney is flat) | capybara (ground backstop, grade, dive depth), props (surfaceY), systems, npc, weather, condor, main | 0 | OK. Grade is DIFFERENCED from this (capyGRADE_LOOK 1.4 m), not from slopeAt |
| slopeAt(x,z) | 17 (all but env) | **none at runtime** — only qa/*.js (b4-pasto, b4cav, b10-mon, stillness) | — | Producer with zero runtime consumers. Not a bug (capybara derives its own grade), but 17 copies of an analytic slope that nothing in the game trusts. Cheap to delete or to make capybara/npc read it |
| groundSlip(x,z) 0..1 | antarctic, hanoi, iceland, monaco, sahara | capybara `capySlipAt` (+ weather.slip added) | 0 | OK, consistent units. systems.js mentions it in comments only |
| soaking(x,z) 0..1 | cave (ignores x,z — global soak timer), env (sprinklers) | capybara (wet level only, raises capyWetLevel) | 0 | OK. Signature inconsistency: cave's takes no args (harmless) |
| wind() {x,z} | drift only | capybara (airborne frame, clamp ±12), props physWindNow (+weather.gust), condor? | {0,0} | OK. NOTE weather.gust() is read by props/npc/systems but NEVER by capybara — see F-WIND |
| flow(x,z) {x,z} | cave, kyoto, manly, pantanal, rio | capybara (swimming frame, clamp ±12), props physFlowAt (same clamp) | {0,0} | OK, symmetric animal/prop. NPCs never read it (swimming NPCs are not carried) |
| airControl (number) | antarctic .44, cave .46, drift .64, goreme, kowloon, manly, palawan, pantanal .36 | capybara | 0.35 | OK |
| navBlocked(x,z,r) | all 18 | capybara (bury rescue), props, npc | treated as "not blocked" | OK |
| canDive (bool) | cave T, hanoi, manly, monaco, palawan | capybara | measured: waterY - terrainHeight >= 1.75 | OK by design; see F-DRIFT-DIVE for the one biome where the measurement can answer yes wrongly |
| surfacePitch(x,z,y) | 10 biomes | capybara footstep voice | rectangle ladder | OK |
| climbHold(x,y,z,yaw) | cave, goreme, kowloon | capybara `capyClimbAt` | null | OK |
| carryFrame() {x,z} or null | cave, goreme, hanoi, iceland, manly, monaco, palawan, pantanal, rio, sahara | capybara (overrides sniffed contact frame; clamp ±capyPLAT_VMAX 12) | null | See F-PLAT-VMAX: Monaco cars reach 26.5 m/s, frame is clamped at 12 |
| isOverWater(x,z) | all 18 + env | capybara, props (FALSE when absent), systems, npc, weather | false | OK |
| waterLevel (number, MUTATED per frame by venice) | all 18 + env | capybara, props, systems, npc, weather | -0.5 | OK. Sahara publishes -400 to say "none" |
| localWater:true + waterHeightAt(x,z) | flag: iceland, manly, rio; waterHeightAt published by all 18 | capybara (only if flag), props physWaterHeightAt (reads waterHeightAt directly), systems, weather | waterLevel | INCONSISTENT gate: props/weather ask waterHeightAt unconditionally, capybara only with the flag. Harmless today because every biome's waterHeightAt without the flag returns its waterLevel — but a fourth biome that writes relief into waterHeightAt and forgets the flag repeats the Rio "1.56 m under the wave" bug for the animal while its props float correctly |
| skyward() | cali, cave, drift, iceland, kowloon | systems (camera crane) | 0 | OK |
| thermals | pasto, rio | condor, systems | — | OK |
| room() | cave, monaco, venice | systems (audio), weather? | null | OK |
| bounds() | env, hanoi, pasto, quay, rio | systems, condor, main | — | 14 biomes publish no bounds; out-of-world is handled elsewhere (not audited here) |
| world.gravity.y | drift onEnter -8.6 / onExit restore | capybara dive (reads live), condor (live), props buoyancy (live) | -24 | OK except props `physRUB_G = 24` constant (rubble particles fall at 1 g in the Drift) — cosmetic |

Force channels (capybara.js): `platVX/platVZ` frame; `capy.launch(vx,vy,vz)` one-shot (clears frame, lifts 0.30, ungrounded 0.20 s); `capy.shove(dvx,dvz)` velocity increment added AFTER grip damper, decays lambda 4, widens cap by its own size, `capySHOVE_MAX` 6.
Callers: launch — cali chiva, iceland geyser, palawan, sahara x3. shove — drift puff (one-shot 1.5), hanoi bike bump (one-shot 3.4), iceland whale breach (one-shot up to 5.5), sahara storm (continuous 6.2*storm*dt), venice traghetto roll (continuous).
Bare `capy.body.velocity` writes outside capybara.js: condor.js:1131-1133 (launch kick while carried, airborne — survives), goreme:4236 / rio:4014 (vertical only, carrier floor — vertical is never damped, fine), iceland:3834-3836 and sahara:2155-2157 (fallback branches behind `typeof capy.launch === 'function'` — dead code).

## 2. Per-factor findings

Measured under `playwright-cli -s=px2surf`, hand-ticked at 60 Hz (`g.tick(1/60,false)`), stick asserted every tick with `camYaw = 0` (calibrated: `inp.x=1` walks +x world, `inp.z=1` walks +z). Raw sinks: qa/surf-a.json.png, qa/surf-a2.json.png, qa/surf-b.json.png. Baseline Sydney paving: walk 4.20 m/s, run 7.4 (peak 8.09 at takeoff), stop in 14 ticks / 0.0 m.

### F1 — Slip is a SPEED BOOST in every direction (ice, snow, floe, deck, dune)  — CONFIRMED, HIGH
chapters: antarctic, iceland, sahara (dune face), monaco (marble 0.30), hanoi (lake steps 0.22), + every rain-wet chapter (weather.slip up to 0.55)
file: src/capybara.js:4213 `slipSpeed = topSpeed * (1 + slip * capySLIP_CAP)` (capySLIP_CAP 1.65) — the STEERING TARGET, not just the cap, is multiplied by slip, in whatever direction the stick points, including uphill and on the flat.
Measured, same held key:
| surface | slip | walk m/s | run m/s |
|---|---|---|---|
| Sydney paving | 0 | 4.20 | 7.4 |
| Antarctic snow (0.18) | 0.18 | 5.45 (+30 %) | 9.6 |
| Antarctic blue ice (0.93) | 0.93 | 10.64 (2.5x) | 18.8–19.0 (4.5x, 68 km/h) |
| Iceland glacier mid, slip 1.0, grade +0.32 UPHILL | 1.0 | 10.4 uphill | **19.61 uphill** (89 m of 18-degree ice climbed in 5 s) |
| Iceland glacier downhill | 1.0 | 11.13 | — |
| Iceland glacier, no input | 1.0 | slides 64 m in 10 s, peak 14.9, into the lagoon | — |
Formula check: 4.2·(1+0.93·1.65) = 10.65, 4.2·(1+0.18·1.65) = 5.45, 7.4·(1+1.65) = 19.6 — exact.
What is wrong: slippery ground should lower or hold achievable speed, lengthen stopping distance and cut steering. Only the last two are modelled; the first is inverted. The glacier the memory calls "a slide that needs a grippy way back up" is climbable at a sprint faster than any surface in the game, and the Tobler grade block is skipped at `slipG >= 0.35` (capybara.js:4193) so the 18-degree climb costs nothing either. Snow at 0.18 makes the animal faster than paving.
Why it was built this way: memory [slip-and-sky] — pressing forward down a glacier at 18 m/s must not be a brake, because the steer pulls velocity toward the target.
Fix sketch (~2 h + re-measure Iceland slide, Antarctic blue-ice descent, Sahara dune surf which is tuned on sahSURF_SLIP 0.72): keep `cap` widened by slip, keep the steering target at `topSpeed`, and make the along-stick steer ONE-SIDED on slip — if the velocity component along the stick already exceeds topSpeed, steer only the lateral component (never pull the along-stick speed down while slip > 0). Then a slide stays a slide, and a walk on ice tops out at walking speed with 0.2 control. Re-enable the grade block on slip, or at least uphill.

### F2 — launch() horizontal component is deleted by the coyote grip  — CONFIRMED (geyser), PLAUSIBLE (three other callers), HIGH
chapters: iceland (Strokkur), sahara (acrobat sahACRO_OUT 3.2, and the 2153 throw-back), cali (chiva cable, `away` = -5.5 m/s relative)
file: src/capybara.js:2946 `launch()` sets capyLaunchT/clears the frame but does NOT spend the coyote window; :4086 `effGround = grounded || capyAirTime < 0.12`; :4272/4330-4333 idle grip lambda 60 + snap < 0.9 m/s run while effGround.
The jump block spends it (`capyAirTime = capyCOYOTE` at :3762 and :3888); launch() forgets to, so for 7 frames after a ground launch the idle grip removes 63 %/frame of the horizontal and then snaps it to zero.
Measured, Strokkur, animal 2.5 m off the vent: fire-frame velocity [1.19, 0] (grounded=false), 5 frames later [0, 0], 20 frames later [0, 0]; apex 14.8 m, airtime 2.23 s, landing drift 0.04 m. Everybody comes off the geyser perfectly straight up — the exact symptom memory [external-forces] says launch() was written to fix.
Same arithmetic for the chiva: 5.5 m/s backwards with no stick → 2.0 → 0.75 → snapped; with a stick held the steer pulls 0.92 m/s per frame toward the walk target for 7 frames, ~6 m/s of the throw gone. Palawan's manta drop (1.6 m/s) is in water (swim branch, no snap) and survives.
Fix (15 min): `capyAirTime = capyCOYOTE;` inside launch(). Regression: geyser landing drift with a 2.5 m offset should be ~1.5 m·2.2 s ≈ 2.6 m; chiva should land behind the bus.

### F3 — Sandstorm shove compounds in the air: a hop in the storm travels 22–32 m at 23–33 m/s  — CONFIRMED, HIGH
chapters: sahara (any continuous shove caller; venice traghetto roll is small)
file: src/sahara.js:4664-4667 (`capy.shove(-6.2·storm·dt, ...)` every frame); src/capybara.js:4408 `vx += capyShove` unconditionally, :4419 cap widened by |shove|, airborne bleed only `capySTOP_LAMBDA·0.15` = 2.1.
Measured at storm() = 1.0, firm sand at (200,-60):
| action | result |
|---|---|
| standing, fresh spawn | blown -x at 7.0 m/s (idle log −7.03…−7.15), 14.2 m in 2 s; lateral sway ±2.4 m/s |
| standing after ~30 s (loafing) | 0.08 m/s, 0.0 m in 5 s (first run: `idle300`) |
| walking INTO the wind (+x) | goes BACKWARDS at 8.5–9.2 m/s — faster than standing, because pressing a stick leaves the grip branch (lambda 60) for the steer branch (0.92 m/s per frame of pull) |
| walking with the wind | -9 to -10.9 m/s |
| standing hop, no stick | airtime 1.08 s, peak horizontal 23.3 m/s, lands 22.0 m downwind (vlog climbs −11 → −22 in the air, nothing opposes it) |
| run-hop downwind | peak 29.8 m/s, 25.1 m |
| run-hop UPWIND (vIn already −11.2 while sprinting into it) | peak 32.7 m/s, lands 32 m downwind |
What is wrong: memory [external-forces] rule "shove is a force channel and compounds in the air; never a one-shot" applies to the continuous case too — in the air the only opposition is a 2.1 lambda bleed against a 6 m/s-per-frame injection. Also 7 m/s of ground drift while standing is not a "lean" (sahWIND_F is documented as m/s of lean), and walking into it being worse than standing is backwards. The chapter's task ("stand in it 11 s") is 77 m of travel unless you loaf.
Fix sketch (1–2 h): (a) while `!effGround`, do not add capyShove to vx at all — express the storm as a FRAME for an airborne animal (the Drift's `wind()` channel already does this: platVX += wind) so the hop drifts at the wind speed and no faster; (b) on the ground, apply the shove BEFORE the grip damper so standing and walking see the same opposition, or cap the steady state at ~1.5 m/s; (c) `sahWIND_F` 6.2 → ~2.5 once (b) lands. Regression: standing drift ≤ 1.5 m/s, hop in storm ≤ 6 m.

### F4 — Iceland whale breach and Hanoi bike bump are one-shots through shove  — PLAUSIBLE, LOW-MED
iceland.js:4846 `capy.shove(dx/d·k)` k ≤ 5.5, once; hanoi.js:1600 `capy.shove(3.4)` once. On the ground the grip eats them within ~0.3 s (≈1.3 m of displacement — a bump). If the animal is in the air (a hop when the bike clips it) the F3 arithmetic applies. Convert to `launch()` once F2 is fixed, or leave and accept.

### F5 — Manly flow field reads the CAPYBARA's depth, so props feel the animal's dive  — CONFIRMED (code), LOW
manly.js:846-853 `manFlowAt` scales the wave push by `capy.depth`; props.js `physFlowAt` calls the same `api.flow`, so a floating thong loses its shoreward push whenever the player is under water. `manFlowAtStatic` (foam only) is the depth-free version. Fix: pass depth as a third argument from capybara only (10 min).

### F6 — Hold Space, Drift vs Sydney — CLEAN
Sydney g −24: tap apex 0.88 m / 0.55 s, held 1.37 / 0.72. Drift g −8.6: tap 2.55 / 1.55, held 4.51 / 2.08. Gravity restored to −24 on return. All four match memory [drift-air-and-gravity] and qa/mv-feel.js.

