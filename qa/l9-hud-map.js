// qa/l9-hud-map.js — THE PAPER, TUCKED (H) and THE CHART, READ AT A GLANCE (M)
// (ROADMAP-LIFT9), STATICALLY
//
//   node qa/l9-hud-map.js
//
// A text scan of src/systems.js, in the same discipline as qa/l9-yuzu-visible.js
// and qa/l9-hanoi-smooth.js: it cannot drive a real frame (the tuck timer, the
// hover/hold legend and the hold-to-zoom crop all need a browser — see the
// playwright-cli run under session -s=l9hm, whose screenshots are named in
// this pass's commit message and report, not committed here), but it CAN
// assert the shape of both fixes does not silently regress on a later edit.

import { readFileSync } from 'node:fs';

const sys = readFileSync('src/systems.js', 'utf8');

function fail(msg) { console.log('FAIL  ' + msg); process.exitCode = 1; }
function pass(msg) { console.log('pass  ' + msg); }

// ============================================================================
// H — THE PAPER, TUCKED
// ============================================================================

// ---- H1: the tuck rule is inverted, not just retimed -----------------------
if (!/const sysTUCK_AFTER = 6\.0;/.test(sys)) fail('sysTUCK_AFTER is not 6.0 (H1: tuck 6s after arrival)');
else pass('sysTUCK_AFTER is 6.0');
const tuckFn = sys.match(/function todoTuckTick\(dt\) \{([\s\S]*?)\n  \}/);
if (!tuckFn) fail('todoTuckTick not found');
else {
  const body = tuckFn[1];
  if (!/const stopped = spd < sysTUCK_V;/.test(body)) fail('todoTuckTick does not compute a "stopped" state');
  else pass('todoTuckTick computes "stopped" (spd < sysTUCK_V)');
  if (!/if \(busy \|\| todoAwayHold > 0 \|\| !stopped\) todoAwayT = 0;/.test(body))
    fail('todoTuckTick still resets the away timer on WALKING rather than on STOPPING — the rule is not inverted');
  else pass('todoTuckTick resets its timer while moving, accumulates while stopped (inverted, H1)');
}
// a fresh tick or a fresh marquee must hold the sheet open — the "don't tuck
// over a fresh payout" half of H1. The tick's own hold predates this pass;
// the marquee's is new.
const marqHoldCount = (sys.match(/todoAwayHold = sysTUCK_HOLD; todoAwayT = 0;/g) || []).length;
if (marqHoldCount < 2) fail('todoAwayHold is only reset once (expected at least a task tick AND a fresh marquee): ' + marqHoldCount);
else pass('todoAwayHold is reset at both a task tick and a fresh marquee (' + marqHoldCount + ' sites)');
// tapping the tab un-tucks
if (!/todoTab\.addEventListener\('click', function \(e\) \{\s*if \(!todoAway\) return;/.test(sys))
  fail('todoTab has no click handler that un-tucks the sheet');
else pass('todoTab click handler un-tucks the sheet');

// ---- H2: the record lines fold the same way the where-line/finds do -------
if (!/'\.capyui-todo:not\(\.away\) \.capyui-rec\{display:none;\}'/.test(sys))
  fail('.capyui-rec is not hidden on the full (not-away) sheet — H2 fold missing');
else pass('.capyui-rec is hidden on the full sheet (folds under the tab instead, H2)');
if (!/recEl\.classList\.contains\('on'\) \? recNowEl\.textContent/.test(sys))
  fail('todoTuckTick\'s tab-sub chain does not read the live record (H2)');
else pass('the tab\'s sub-line reads the live record when one is open (H2)');

// ---- H3: hide the empty item pill, keep the dim (spent-out) one -----------
if (!/'\.capyui-item\.show\.capyui-item-empty\{display:none;\}'/.test(sys))
  fail('.capyui-item.show.capyui-item-empty is not display:none (H3)');
else pass('.capyui-item.show.capyui-item-empty is hidden outright (H3)');
if (!/'\.capyui-item\.show\.capyui-item-dim\{opacity:0\.42;\}'/.test(sys))
  fail('.capyui-item.show.capyui-item-dim lost its dimmed-but-visible treatment (H3)');
else pass('.capyui-item.show.capyui-item-dim keeps the dimmed spent-out feedback (H3)');
if (!/'\.capyui-wallet\{position:absolute;left:14px;top:46px;display:flex;align-items:center;gap:5px;',\s*'min-height:44px;/.test(sys))
  fail('.capyui-wallet does not have a 44px touch-target floor (H3)');
else pass('.capyui-wallet has a 44px min-height (H3)');
if (!/'\.capyui-item\{position:absolute;left:120px;top:46px;display:flex;align-items:center;gap:6px;',\s*'min-height:44px;/.test(sys))
  fail('.capyui-item does not have a 44px touch-target floor (H3)');
else pass('.capyui-item has a 44px min-height (H3)');

// ---- H4: narrow-width collisions (.capyui-home vs .capyui-map/.capyui-pips)
const homeMobile = sys.match(/'\.capyui-home\{font-size:10px;padding:6px 12px;gap:6px;max-width:78vw;',\s*'white-space:normal[\s\S]{0,120}?bottom:162px;\}',/);
if (!homeMobile) fail('.capyui-home has no max-width/raised bottom offset in the @media(max-width:560px) block (H4)');
else pass('.capyui-home gets a max-width and a raised (map-clearing) bottom offset under 560px (H4)');

console.log('');

// ============================================================================
// M — THE CHART, READ AT A GLANCE
// ============================================================================

// ---- M1: size up ------------------------------------------------------------
if (!/width:clamp\(132px,20vw,190px\)/.test(sys)) fail('.capyui-map width is not clamp(132px,20vw,190px) (M1)');
else pass('.capyui-map width is clamp(132px,20vw,190px) (M1)');
if (!/width:clamp\(110px,30vw,148px\)/.test(sys)) fail('phone .capyui-map width is not clamp(110px,30vw,148px) (M1)');
else pass('phone .capyui-map width is clamp(110px,30vw,148px) (M1)');
if (/clamp\(92px,24vw,124px\)/.test(sys)) fail('a stale clamp(92px,24vw,124px) offset survives the M1 resize (back/menu/look would misalign)');
else pass('no stale clamp(92px,24vw,124px) offsets remain after M1\'s resize');

// ---- M2: the door label is hover/hold-only unless it is the pinned goal ---
if (!/const doorIsGoal = !!\(goal && Math\.hypot\(goal\.x - wq\.x, goal\.z - wq\.z\) < 1\.0\);/.test(sys))
  fail('mapDraw has no doorIsGoal check (M2)');
else pass('mapDraw computes doorIsGoal (M2)');
if (!/if \(wt && \(mapInteract \|\| doorIsGoal\)\) \{/.test(sys))
  fail('the door label is not gated on mapInteract||doorIsGoal (M2)');
else pass('the door label draws only when interacting or pinned as the goal (M2)');

// ---- M3: rounded, vignetted, warm-rimmed frame -----------------------------
if (!/'\.capyui-mapv\{position:absolute;inset:0;pointer-events:none;border-radius:16px;',/.test(sys))
  fail('.capyui-mapv corner radius was not raised to 16px (M3)');
else pass('.capyui-mapv corner radius raised to 16px (M3)');
if (!/inset 0 0 16px .*inset 0 0 0 1px .*inset 0 0 0 2px .*PALETTE\.sand/s.test(sys.replace(/\n\s*/g, ' ')))
  fail('.capyui-mapv is missing the deepened vignette + warm sand rim (M3)');
else pass('.capyui-mapv has a deepened vignette and a warm (sand) rim (M3)');

// ---- M4: narrower heading cone ---------------------------------------------
if (!/const half = 0\.26, reach = 18 \* u;/.test(sys)) fail('the heading cone half/reach were not narrowed to 0.26/18u (M4)');
else pass('the heading cone is 0.26/18u (M4)');
if (!/cone: sysRgba\(PALETTE\.sail, 0\.22\),/.test(sys)) fail('the cone alpha was not cut to 0.22 (M4)');
else pass('the cone alpha is 0.22 (M4)');

// ---- M5: a distinct glyph per landmark kind --------------------------------
if (!/g2\.fillRect\(mx - 2\.2 \* u, mz - 1\.3 \* u, 4\.4 \* u, 2\.6 \* u\);/.test(sys)) pass('the boat mark is no longer a plain filled rect (M5)');
else fail('the boat mark is still the old plain filled rect (M5)');
if (!/\} else if \(m\.k === 'water'\) \{[\s\S]{0,320}?g2\.stroke\(\);/.test(sys)) fail('the water mark is not a stroked ring (M5)');
else pass('the water mark is a stroked ring (M5)');
if (!/\} else if \(m\.k === 'leaf'\) \{[\s\S]{0,320}?quadraticCurveTo/.test(sys)) fail('the leaf mark is not a vesica/tick shape (M5)');
else pass('the leaf mark is a vesica tick (M5)');
if (!/\} else if \(m\.k === 'faint'\) \{[\s\S]{0,320}?g2\.stroke\(\);/.test(sys)) fail('the faint mark is not a hollow (stroked) dot (M5)');
else pass('the faint mark is a hollow dot (M5)');

// ---- M6: hover/hold legend --------------------------------------------------
if (!/'\.capyui-map\.show\{opacity:\.95;pointer-events:auto;\}'/.test(sys)) fail('.capyui-map.show does not enable pointer-events (M6)');
else pass('.capyui-map.show enables pointer-events (M6)');
if (!/const mapLegendEl = sysEl\('div', 'capyui-maplegend'\);/.test(sys)) fail('mapLegendEl is not built (M6)');
else pass('mapLegendEl is built (M6)');
if (!/mapEl\.addEventListener\('pointerenter'/.test(sys) || !/mapEl\.addEventListener\('pointerdown'/.test(sys))
  fail('the map is missing hover/hold listeners (M6)');
else pass('the map has hover (pointerenter/leave) and hold (pointerdown/up) listeners (M6)');

// ---- M7: hold-to-zoom -------------------------------------------------------
if (!/f = \{ cx: cx, cz: cz, k: w \/ \(baseFit\.span \/ 2\) \};/.test(sys)) fail('hold-to-zoom does not halve the fit span around the player (M7)');
else pass('hold-to-zoom halves the fit span, centred on the player (M7)');

// ---- M8: fade to 0.72 when nothing is live ---------------------------------
if (!/'\.capyui-map\.show\.quiet\{opacity:\.72;\}'/.test(sys)) fail('.capyui-map.show.quiet is not opacity .72 (M8)');
else pass('.capyui-map.show.quiet is opacity .72 (M8)');
if (!/const mapIsLive = mapGoal\.ok \|\| dropsLive \|\| !!marqChartPoint\(\);/.test(sys)) fail('mapIsLive is not computed from goal/drops/marquee (M8)');
else pass('mapIsLive reflects goal, live drops and the marquee ring (M8)');

// ---- M9: one breadcrumb band, not three ------------------------------------
if (/for \(let band = 0; band < sysMAP_TRAIL_BANDS/.test(sys)) fail('the trail still loops over sysMAP_TRAIL_BANDS (M9)');
else pass('the trail no longer loops over multiple age bands (M9)');
if (!/g2\.strokeStyle = sysRgba\(PALETTE\.ibisHead, 0\.22\);\s*\n\s*g2\.lineWidth = 1\.0 \* u;\s*\n\s*g2\.beginPath\(\);\s*\n\s*for \(let i = 0; i < mapTrailN; i\+\+\)/.test(sys))
  fail('the trail is not drawn as one path at a flat 0.22 alpha (M9)');
else pass('the trail draws as one path at a flat 0.22 alpha (M9)');

// ---- the Wave 3 contract: mapMarkPos resolves a `live`-named global fn ----
if (!/function mapMarkPos\(m\) \{\s*\/\/ WAVE 3 CONTRACT[\s\S]{0,900}?if \(m\.live\) \{/.test(sys))
  fail('mapMarkPos has no `live` resolver branch ahead of `get` (Wave 3 contract)');
else pass('mapMarkPos resolves `m.live` off game[m.live] (Wave 3 contract for the shop)');
if (!/const f = game\[m\.live\];/.test(sys)) fail('the live resolver does not read game[m.live]');
else pass('the live resolver reads game[m.live] the way the roadmap\'s contract line specifies');

if (!process.exitCode) console.log('\nl9-hud-map: all checks passed (static only — see the commit for the live playwright-cli screenshots)');
