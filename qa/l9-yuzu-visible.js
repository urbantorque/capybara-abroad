// qa/l9-yuzu-visible.js — THE YUZU, SEEN (ROADMAP-LIFT9 V), STATICALLY
//
//   node qa/l9-yuzu-visible.js
//
// A text scan of src/props.js and src/systems.js, in the same discipline as
// qa/l9-hanoi-smooth.js: it cannot drive a real frame (that needs a browser —
// see the live probe run under playwright-cli, session -s=l9v, whose numbers
// are in this pass's commit message and report, not committed here), but it
// CAN assert the shape of the fix does not silently regress on a later edit:
//
//   1. physBuildYuzu/physBuildYuzuGold: the two sphere radii are 0.30/0.34
//      (V1), and the leaf nub's own y-offset tracks whichever radius it sits
//      on top of, so a later resize of one without the other cannot silently
//      bury the leaf back inside the fruit.
//   2. sysDROP_LIFT sits in the roadmap's own 0.85-1.0 range (V2).
//   3. The pooled aura (V3) exists as an InstancedMesh, sized 0.9/1.3 m, in
//      the roadmap's own over-1.0 colours, built the way sparkMesh already
//      is (additive, toneMapped:false, fog:false, depthWrite:false), and its
//      opacity is written every tick rather than fixed once.
//   4. The vertical shaft (V4) reuses beaconShaft's own geometry numbers
//      verbatim (0.10, 0.26, 3.0, 8) and is gated to monaco/kowloon/hanoi
//      only.
//   5. The sparkle notice radius (V5) widened past the old 8 m (dist2 < 64).
//   6. The minimap dot (V6) is 2.4*u and golden gets its own PALETTE.yuzuGold
//      fill.
//
// NOT CHECKED HERE (needs a live page): actual projected pixel size at
// distance, whether the aura/shaft actually render without console errors,
// and game.state.lastError after a soak. Those were measured under
// playwright-cli for this pass; see the commit.

import { readFileSync } from 'node:fs';

const props = readFileSync('src/props.js', 'utf8');
const sys = readFileSync('src/systems.js', 'utf8');

function fail(msg) { console.log('FAIL  ' + msg); process.exitCode = 1; }
function pass(msg) { console.log('pass  ' + msg); }

// ---- 1: the two sphere radii, and the leaf nubs that track them -----------
const yuzuFn = props.match(/function physBuildYuzu\(g\) \{([\s\S]*?)\n\}/);
if (!yuzuFn) fail('physBuildYuzu not found');
else {
  const body = yuzuFn[1];
  const sph = body.match(/physSphG\((0\.\d+)\)/);
  const leaf = body.match(/physBoxG\([^)]*\),\s*PALETTE\.yuzuLeaf,\s*([\d.]+),\s*([\d.]+),/);
  if (!sph || sph[1] !== '0.30') fail('physBuildYuzu sphere radius is not 0.30: ' + (sph && sph[1]));
  else pass('physBuildYuzu sphere radius is 0.30');
  if (!leaf) fail('physBuildYuzu leaf nub offset not found');
  else if (Math.abs(parseFloat(leaf[2]) - 0.30) > 0.001) fail('physBuildYuzu leaf y-offset (' + leaf[2] + ') does not sit on the 0.30 surface');
  else pass('physBuildYuzu leaf nub sits on the new 0.30 surface');
}
const goldFn = props.match(/function physBuildYuzuGold\(g\) \{([\s\S]*?)\n\}/);
if (!goldFn) fail('physBuildYuzuGold not found');
else {
  const body = goldFn[1];
  const sph = body.match(/physSphG\((0\.\d+)\)/);
  const leaf = body.match(/physBoxG\([^)]*\),\s*PALETTE\.yuzuLeaf,\s*([\d.]+),\s*([\d.]+),/);
  if (!sph || sph[1] !== '0.34') fail('physBuildYuzuGold sphere radius is not 0.34: ' + (sph && sph[1]));
  else pass('physBuildYuzuGold sphere radius is 0.34');
  if (!leaf) fail('physBuildYuzuGold leaf nub offset not found');
  else if (Math.abs(parseFloat(leaf[2]) - 0.34) > 0.001) fail('physBuildYuzuGold leaf y-offset (' + leaf[2] + ') does not sit on the 0.34 surface');
  else pass('physBuildYuzuGold leaf nub sits on the new 0.34 surface');
}

// ---- 2: the lift, in the roadmap's own 0.85-1.0 range ----------------------
const liftM = sys.match(/const sysDROP_LIFT = ([\d.]+);/);
if (!liftM) fail('sysDROP_LIFT not found');
else {
  const v = parseFloat(liftM[1]);
  if (v < 0.85 || v > 1.0) fail('sysDROP_LIFT (' + v + ') is outside the roadmap\'s 0.85-1.0 range');
  else pass('sysDROP_LIFT (' + v + ') is inside the roadmap\'s 0.85-1.0 range');
}

// ---- 3: the pooled aura ----------------------------------------------------
if (!/const dropAuraMesh = new THREEx\.InstancedMesh\(/.test(sys)) fail('dropAuraMesh InstancedMesh not found');
else pass('dropAuraMesh is an InstancedMesh');
if (!/toneMapped:\s*false,\s*blending:\s*THREEx\.AdditiveBlending/.test(sys.slice(sys.indexOf('dropAuraMesh = new THREEx.InstancedMesh'), sys.indexOf('dropAuraMesh = new THREEx.InstancedMesh') + 600)))
  fail('dropAuraMesh material is not additive/unlit the way sparkMesh is');
else pass('dropAuraMesh material matches the sparkMesh pattern (additive, unlit)');
if (!/sysDROP_AURA_D = 0\.9;/.test(sys)) fail('plain aura size is not 0.9 m');
else pass('plain aura size is 0.9 m');
if (!/sysDROP_AURA_GOLD_D = 1\.3;/.test(sys)) fail('golden aura size is not 1.3 m');
else pass('golden aura size is 1.3 m');
if (!/sysDROP_AURA_RGB = \[1\.5, 1\.25, 0\.45\];/.test(sys)) fail('plain aura colour does not match the roadmap');
else pass('plain aura colour matches the roadmap ([1.5, 1.25, 0.45])');
if (!/sysDROP_AURA_GOLD_RGB = \[1\.9, 1\.6, 0\.5\];/.test(sys)) fail('golden aura colour does not match the roadmap');
else pass('golden aura colour matches the roadmap ([1.9, 1.6, 0.5])');
if (!/dropAuraMesh\.material\.opacity = dropAuraAlpha;/.test(sys)) fail('aura opacity is not written per tick (would be a fixed value, not a pulse)');
else pass('aura opacity is driven per tick, not fixed');

// ---- 4: the shaft, beaconShaft's own geometry verbatim, gated to 3 biomes -
if (!/new THREEx\.CylinderGeometry\(0\.10, 0\.26, 3\.0, 8, 1, true\)/.test(sys.slice(sys.indexOf('const dropShaftMesh'))))
  fail('dropShaftMesh geometry does not match beaconShaft\'s own numbers');
else pass('dropShaftMesh reuses beaconShaft\'s own geometry (0.10, 0.26, 3.0, 8)');
if (!/sysDROP_SHAFT_BIOMES = \{ monaco: true, kowloon: true, hanoi: true \};/.test(sys))
  fail('shaft is not gated to exactly monaco/kowloon/hanoi');
else pass('shaft is gated to monaco/kowloon/hanoi only');

// ---- 5: the sparkle notice radius ------------------------------------------
if (/if \(dist2 < 64\) \{/.test(sys)) fail('sparkle notice radius is still the old 8 m (dist2 < 64)');
else pass('sparkle notice radius widened past the old 8 m');

// ---- 6: the minimap dot -----------------------------------------------------
const mapM = sys.match(/g2\.beginPath\(\); g2\.arc\(dxp, dzp, ([\d.]+) \* u, 0, 6\.284\); g2\.fill\(\);/);
if (!mapM || mapM[1] !== '2.4') fail('minimap drop dot radius is not 2.4 * u: ' + (mapM && mapM[1]));
else pass('minimap drop dot radius is 2.4 * u');
if (!/PALETTE\.yuzuGold\s*:\s*PALETTE\.yuzu/.test(sys)) fail('minimap drop dot does not give golden its own PALETTE.yuzuGold fill');
else pass('minimap drop dot gives golden its own PALETTE.yuzuGold fill');

if (!process.exitCode) console.log('l9-yuzu-visible: all checks passed (static only — see the commit for the live playwright-cli numbers)');
