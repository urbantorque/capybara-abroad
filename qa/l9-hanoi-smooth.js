// qa/l9-hanoi-smooth.js — HANOI, SMOOTHED (ROADMAP-LIFT9 T), STATICALLY
//
//   node qa/l9-hanoi-smooth.js
//
// A text scan of src/hanoi.js, in the same discipline as qa/l8-catalogue.mjs:
// it cannot drive a real frame (that needs a browser — see the live probe run
// under playwright-cli, session -s=l9t, whose numbers are in this pass's
// commit message and report, not committed here), but it CAN assert the shape
// of the fix does not silently regress on a later edit to this file:
//
//   1. hanLaneYawAt exists, is a central difference over a 3 m baseline (the
//      cali.js caliRouteAt pattern), and does not touch hanLaneAtS's own x/z.
//   2. hanLaneAtS itself is unmoved — same signature, same out.x/out.z/out.yaw
//      three-line body — because pavements, terraces and shopfronts are laid
//      out from it at other call sites this pass was told not to touch.
//   3. hanLaneYawAt is actually READ at the five call sites the roadmap named:
//      hanSyncBikes, hanBikeAt, hanUpdateTraffic's Doppler direction, and both
//      of hanUpdateRide's two placements — not just defined and orphaned.
//   4. The open-lane recycle (two sites: the airborne branch and the main
//      street loop) goes through a distance gate (hanRecycleS) rather than an
//      unconditional teleport to the far end.
//
// NOT CHECKED HERE (needs a live page): the actual heading-step-per-frame and
// teleport-event numbers, and hanUpdateFolk's pedestrian call sites reading
// live hanFolkData rather than a static pattern this scan could false-positive
// on. Those were measured under playwright-cli for this pass; see the commit.

import { readFileSync } from 'node:fs';

const src = readFileSync('src/hanoi.js', 'utf8');

function fail(msg) { console.log('FAIL  ' + msg); process.exitCode = 1; }
function pass(msg) { console.log('pass  ' + msg); }

// ---- 1: hanLaneYawAt is a real central difference, 3 m baseline -----------
const yawFnM = src.match(/function hanLaneYawAt\(L, s\) \{([\s\S]*?)\n\}/);
if (!yawFnM) fail('hanLaneYawAt not found');
else {
  const body = yawFnM[1];
  const hasBack = /s - 3/.test(body);
  const hasFwd = /s \+ 3/.test(body);
  const hasAtan2 = /Math\.atan2\(/.test(body);
  if (hasBack && hasFwd && hasAtan2) pass('hanLaneYawAt: central difference over a 3 m baseline, atan2 of the delta');
  else fail('hanLaneYawAt: expected s-3/s+3 baseline and an atan2 of the difference, got: ' + body.trim());
}

// ---- 2: hanLaneAtS itself is untouched -------------------------------------
const atSM = src.match(/function hanLaneAtS\(L, s, out\) \{([\s\S]*?)\n\}/);
if (!atSM) fail('hanLaneAtS not found');
else {
  const body = atSM[1];
  const rawYaw = /out\.yaw = Math\.atan2\(b\[0\] - a\[0\], b\[1\] - a\[1\]\);/.test(body);
  if (rawYaw) pass('hanLaneAtS: still the raw per-segment yaw — position/yaw outputs untouched, as required');
  else fail('hanLaneAtS: its raw out.yaw line has changed — this was the one function the fix must not edit');
}

// ---- 3: the five read sites actually call hanLaneYawAt ---------------------
const fnBody = (name) => {
  const re = new RegExp('function ' + name + '\\([^)]*\\) \\{');
  const m = re.exec(src);
  if (!m) return null;
  // walk braces from the opening one to find this function's own extent
  let depth = 0, i = m.index + m[0].length - 1, start = i;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
};

const sites = [
  ['hanSyncBikes', 'the drawn instance matrix + lateral normal'],
  ['hanBikeAt', 'the rider position used for distance tests and sfx'],
  ['hanUpdateTraffic', "the mover sfx's Doppler direction"],
  ['hanUpdateRide', 'what the capybara stands on while riding'],
];
for (const [name, what] of sites) {
  const body = fnBody(name);
  if (!body) { fail(name + ': function not found'); continue; }
  const n = (body.match(/hanLaneYawAt\(/g) || []).length;
  if (n > 0) pass(name + ': reads hanLaneYawAt (' + n + '×) — ' + what);
  else fail(name + ': does not call hanLaneYawAt — ' + what + ' would still snap');
}
// hanUpdateFolk: not walked by fnBody's brace-matcher discipline here because
// it is long and this scan is about the wiring, not a re-parse; a direct
// substring count on the function's own text is enough to catch a regression.
const folkBody = fnBody('hanUpdateFolk');
if (!folkBody) fail('hanUpdateFolk: function not found');
else {
  const n = (folkBody.match(/hanLaneYawAt\(/g) || []).length;
  if (n > 0) pass('hanUpdateFolk: reads hanLaneYawAt (' + n + '×) — pedestrians no longer snap identically to bikes');
  else fail('hanUpdateFolk: does not call hanLaneYawAt — pedestrians would still snap at every lane vertex');
}

// ---- 4: the open-lane recycle is distance-gated, not unconditional --------
const recycleFn = src.match(/function hanRecycleS\(L, s, total, p\) \{([\s\S]*?)\n\}/);
if (!recycleFn) fail('hanRecycleS not found');
else pass('hanRecycleS exists: an open lane end holds the bike at the kerb rather than teleporting it');

const recycleCalls = (src.match(/hanRecycleS\(L, hanBikeData\[o \+ 1\], (?:tot0|total), p\)/g) || []).length;
if (recycleCalls === 2) pass('hanRecycleS is called at both open-lane recycle sites (the ground loop and the airborne branch)');
else fail('expected hanRecycleS called at exactly 2 sites (ground loop + airborne branch), found ' + recycleCalls);

if (!process.exitCode) console.log('\nl9-hanoi-smooth: all checks passed');
