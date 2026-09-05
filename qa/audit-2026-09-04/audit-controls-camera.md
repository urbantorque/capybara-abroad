# Controls + camera audit (read-only) — capy3, 2026-09-04

Status: SUPERSEDED 5 Sep 2026. The write-up is batch X9 item 2 in
ROADMAP-PHYSICS.md. Read that first: of the inventory below, the flight-rig gate
and "V is KEYBOARD ONLY" were both fixed in X7, the `camCeil` census is out of
date (four publishers now, not two), and the one measurement this file left
pending — whether V does anything underwater — is made in `qa/px-cam-v.js`. It
does not: 5.05 degrees of pitch on land, 4.71 swimming, and a boom that moves
0.000 m submerged.

The inventory is kept verbatim below as the historical record. Do not quote its
numbers without checking them against the source.

## Code inventory notes (raw, to be condensed)

### Keyboard (systems.js keydown ~22366-22646, input assembly ~26362-26402)
- WASD/arrows move; Shift run; Space hop; E grab/dive/climb-hold/mount/helm (+LMB, pad X, touch GRAB); Q wheek(=whistle alias, +pad B/Y, touch WHEEK); G slide (+pad LT, touch SLIDE); C recentre (+pad R3); Z/X yaw (+pad LB/RB, right stick X, mouse right-drag, touch one-finger drag); V eye raise (KEYBOARD ONLY — no pad/touch equivalent); R hold 1.4 s rescue (+pad Back hold, touch BACK hold); F/Shift+F todo step (keyboard only); J journal, Tab board, H or Slash hint, Esc pause, P bare HUD (+pad Back tap), K photo, Enter shoot, M/N mute, [ ] music volume, ` perf, Backslash QA hard-cut (LIVE, no dev gate).
- Pad right stick Y zooms (camDistTarget 7..16); there is NO keyboard/touch zoom except touch pinch. Keyboard has no zoom at all.
- V: `eyeAsk = started && keys.KeyV ? 0.70 : 0` -> skyWant channel; skyT is forced to 0 while flyT>0.1 or sailT>0.1 (condor, helm). Works while swimming/climbing/diving in code (no gate) but the dive rig (rigT) applies AFTER skyT and lerps pitch to sysDIVE_RIG_P, so V underwater is largely overridden — to measure.
- Flight rig gate: `const mounted = !!(inPasto && game.condor && game.condor.mounted)` (systems.js:26608). Rio is the second condor host (rio.js:4236 thermals). => Rio flight uses the GROUND rig on a bird at 20 m/s. CONFIRMED by code; to measure.

### Occlusion (sysCamClear systems.js:24375)
- Single ray anchor->desired via world.raycastAll; skips mass>0, triggers, capy body, carriedBy, rideBody, npc/local userData, non-STATIC bodies, heightfield/plane shapes. Drawn-only geometry (no body) never occludes. Pad 0.70, min boom 1.9, out-rate 3.2/s.
- camCeil published by cave.js and sahara.js (souk); camFloor by cave.js, palawan.js; rig() by goreme, kyoto, manly, palawan; skyward by cali, cave, drift, iceland, kowloon.
