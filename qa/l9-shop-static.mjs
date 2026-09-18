// qa/l9-shop-static.mjs — A SHOP, EVERY BIOME, ON THE MAP (ROADMAP-LIFT9, S),
// STATICALLY
//
//   node qa/l9-shop-static.mjs
//
// A text scan of src/npc.js, src/systems.js, src/main.js and src/kyoto.js, in
// the same discipline as qa/l9-hud-map.js: it cannot drive a real frame (the
// stall's placement, the E-tap/away-line door and the minimap pulse all need
// a browser — see qa/l9-shop.js, run under playwright-cli session -s=l9s, and
// the screenshots named in this pass's report, not committed here), but it
// CAN assert the shape of the build does not silently regress on a later
// edit.

import { readFileSync } from 'node:fs';

const npc = readFileSync('src/npc.js', 'utf8');
const sys = readFileSync('src/systems.js', 'utf8');
const main = readFileSync('src/main.js', 'utf8');
const kyoto = readFileSync('src/kyoto.js', 'utf8');

function fail(msg) { console.log('FAIL  ' + msg); process.exitCode = 1; }
function pass(msg) { console.log('pass  ' + msg); }

// ============================================================================
// S1 — ONE SHARED STALL, ATTACHED TO THE TRAVELLER EVERYWHERE
// ============================================================================

if (!/function npcMakeStall\(rec, angle, dist\)/.test(npc)) fail('npcMakeStall(rec, angle, dist) not found in npc.js');
else pass('npcMakeStall(rec, angle, dist) exists');

if (!/npcStallPostGeo = new THREE_\.CylinderGeometry/.test(npc) || !/npcStallTopGeo = new THREE_\.BoxGeometry/.test(npc))
  fail('the stall\'s shared geometries (posts/table) are not lazily built once');
else pass('the stall\'s posts/table geometry is lazily built and shared');

// The physics half — a static CANNON.Box, not a physTYPES row.
const stallBodyBlock = npc.match(/if \(game\.world\) \{\s*const face = \(o\.face[\s\S]*?rec\.stallBody = sb;/);
if (!stallBodyBlock) fail('addTraveller does not build a static CANNON body for the stall');
else {
  const b = stallBodyBlock[0];
  if (!/mass: 0/.test(b)) fail('the stall body is not mass: 0 (static)');
  else pass('the stall body is static (mass: 0)');
  if (!/new CANNON\.Box\(new CANNON\.Vec3\(0\.85, 0\.5, 0\.45\)\)/.test(b))
    fail('the stall collider is not the authored table-sized half extents (0.85, 0.5, 0.45)');
  else pass('the stall collider is the authored table-sized half extents');
}
// NOT a physTYPES entry (props.js) — those are all grabbable/throwable. The
// stall is built entirely in npc.js/addTraveller, which never calls
// spawnProp or references physTYPES for it (props.js already has an
// UNRELATED "market stall" concept of its own — physStalls, physSTALL_MAX,
// a collapsing-awning mechanic for the pasto/sahara market props — so the
// check that matters is that npc.js's OWN stall code never reaches for it).
const stallFn = npc.match(/function npcMakeStall\(rec, angle, dist\) \{([\s\S]*?)\n  \}/);
if (!stallFn) fail('could not isolate npcMakeStall\'s own body to check it');
else if (/physTYPES/.test(stallFn[1]) || /spawnProp/.test(stallFn[1]))
  fail('npc.js\'s stall build references physTYPES/spawnProp — it must be a plain static body, not a grabbable prop');
else pass('the stall is a plain static body, never a physTYPES/spawnProp entry');

// The escape hatch S2 needed: a per-chapter angle/distance override, not a
// blind constant, so a chapter whose ground does not tolerate 1.6 m straight
// behind the traveller can move it without touching the shared function.
if (!/shopAngle\b/.test(npc) || !/shopDist\b/.test(npc)) fail('addTraveller has no shopAngle/shopDist override hook');
else pass('addTraveller accepts a per-chapter shopAngle/shopDist override');

// S5: the in-person gift, said out loud, in the traveller's own bag of lines
// (appended, not a replacement — see the field-collision note this avoids).
if (!/npcTRAV_STALL_LINE = /.test(npc)) fail('no authored stall line (S5) found');
else pass('S5: the in-person gift is said out loud (npcTRAV_STALL_LINE)');
if (!/rec\.lines = rec\.lines\.concat\(npcTRAV_STALL_LINE\)/.test(npc))
  fail('the stall line is not appended to the traveller\'s own greeting pool');
else pass('the stall line is appended to (not replacing) the traveller\'s greeting pool');

// S2: Kyoto's own footprint fix — the one chapter whose default placement
// measured over the river (see qa/l9-shop.js's live isOverWater check).
if (!/shopAngle:\s*1\.6/.test(kyoto)) fail('kyoto.js does not override shopAngle for its traveller\'s stall');
else pass('kyoto.js overrides shopAngle so the stall stays on the bridge deck');

// ============================================================================
// S3 — MINIMAP MARK VIA THE `live` RESOLVER, A SIXTH GLYPH
// ============================================================================

if (!/shopWhere: npcShopWhere/.test(npc)) fail('npc.js does not publish shopWhere on its returned api');
else pass('npc.js publishes shopWhere');
if (!/game\.shopWhere = npcs\.shopWhere;/.test(main)) fail('main.js does not wire game.shopWhere');
else pass('main.js wires game.shopWhere the same way travWhere is wired');

if (!/const sysSHOP_MARK = \{ live: 'shopWhere', t: 'the bag' \};/.test(sys))
  fail('sysSHOP_MARK ({live:\'shopWhere\'}) not found — the shop must resolve through mapMarkPos\'s live branch');
else pass('sysSHOP_MARK resolves through the live branch, not a per-biome marks row');
if (!/if \(m\.live\) \{/.test(sys)) fail('mapMarkPos has no `live` resolver branch (expected already built by a prior pass)');
else pass('mapMarkPos\'s `live` resolver branch exists');

const shopGlyph = sys.match(/const sm = mapMarkPos\(sysSHOP_MARK\);([\s\S]*?)\n    \/\/ ---- what the to-do list/);
if (!shopGlyph) fail('mapDraw has no shop glyph block after the door');
else {
  const g = shopGlyph[1];
  if (!/shopAfford = shopCu !== null && jrYuzu >= shopCu/.test(g)) fail('the shop glyph does not gate its pulse on cheapestUnowned() vs jrYuzu');
  else pass('the shop glyph pulses only when jrYuzu >= cheapestUnowned()');
  if (!/mapPulse\(0\.8\)/.test(g)) fail('the shop glyph does not reuse mapPulse');
  else pass('the shop glyph reuses the existing mapPulse helper');
  if (!/shopInside/.test(g) || !/const c = w \/ 2;/.test(g)) fail('the shop glyph has no off-map rim-arrow fallback');
  else pass('the shop glyph falls back to a rim arrow when off the drawn square');
}

// ============================================================================
// S4 — DISCOVERABILITY OFF THE MAP: THE PAPER'S PSEUDO-ROW
// ============================================================================

if (!/const sysSHOP_ID = '__shop';/.test(sys)) fail('sysSHOP_ID not found');
else pass('sysSHOP_ID exists, built like sysTRAV_ID');
if (!/taskRec\[sysSHOP_ID\] = \{ def: null, li: li, txt: txt, done: false/.test(sys))
  fail('the shop\'s paper row is not built the same way as the traveller\'s (taskRec[sysSHOP_ID])');
else pass('the shop\'s paper row is built the same way as the traveller\'s');
if (!/sysHINTS\[sysSHOP_ID\] = \{/.test(sys)) fail('sysHINTS[sysSHOP_ID] not found');
else pass('sysHINTS[sysSHOP_ID] exists');

const shopRowOnFn = sys.match(/function shopRowOn\(\) \{([\s\S]*?)\n  \}/);
if (!shopRowOnFn) fail('shopRowOn() not found');
else {
  const b = shopRowOnFn[1];
  if (!/game\.chapDoneHere\(n\)/.test(b)) fail('shopRowOn does not gate on the same chapDoneHere the traveller\'s own visibility uses');
  else pass('shopRowOn gates on chapDoneHere — never points at an invisible stall');
  if (!/cheapestUnowned\(\)/.test(b) || !/jrYuzu < cu/.test(b)) fail('shopRowOn does not gate on affordability');
  else pass('shopRowOn gates on the wallet clearing the cheapest unowned price');
}
if (!/if \(shopRowOn\(\)\) open\.push\(sysSHOP_ID\);/.test(sys)) fail('todoStep does not let F reach the shop\'s pseudo-row');
else pass('todoStep reaches the shop\'s row the same way it reaches the traveller\'s');

// ============================================================================
// cheapestUnowned() — THE ONE NUMBER THE CHART AND THE PAPER BOTH GATE ON
// ============================================================================

const cheapFn = sys.match(/function cheapestUnowned\(\) \{([\s\S]*?)\n  \}/);
if (!cheapFn) fail('cheapestUnowned() not found');
else {
  const b = cheapFn[1];
  if (!/sysUPGRADES/.test(b)) fail('cheapestUnowned() does not read sysUPGRADES');
  else pass('cheapestUnowned() checks sysUPGRADES (next tier, prereq-gated)');
  if (!/sysCONSUM/.test(b)) fail('cheapestUnowned() does not read sysCONSUM');
  else pass('cheapestUnowned() checks sysCONSUM (capped, never fully owned)');
  if (!/sysWARDROBE/.test(b)) fail('cheapestUnowned() does not read sysWARDROBE');
  else pass('cheapestUnowned() checks sysWARDROBE\'s six for-sale rows only');
  if (!/return best === Infinity \? null : best;/.test(b)) fail('cheapestUnowned() does not return null when nothing is left to buy');
  else pass('cheapestUnowned() returns null (not Infinity) with nothing left unowned');
}
if (!/game\.state\.qaShopCheapest = cheapestUnowned;/.test(sys)) fail('cheapestUnowned is not published for QA (qaShopCheapest)');
else pass('cheapestUnowned is published read-only for QA');

// ============================================================================
// S6 — NO NEW SAVE KEY, AND THE QA INSTRUMENT EXISTS
// ============================================================================

if (!/game\.state\.qaStallInfo = function \(biome\)/.test(npc)) fail('npc.js does not publish qaStallInfo for QA');
else pass('npc.js publishes qaStallInfo (built/visible/hasBody) for QA');
if (!/localStorage\.setItem\(sysSAVE_KEY/.test(sys)) fail('sanity: sysSAVE_KEY write site not found at all (unrelated regression?)');
else {
  const saveBlock = sys.match(/localStorage\.setItem\(sysSAVE_KEY, JSON\.stringify\(\{([\s\S]*?)\}\)\);/);
  if (saveBlock && /shop/i.test(saveBlock[1])) fail('a "shop" key appears in the save payload — S6 says this feature adds none');
  else pass('no new save key: the save payload carries nothing shop-specific');
}

if (!process.exitCode) console.log('\nl9-shop-static: all checks passed');
else console.log('\nl9-shop-static: FAILED');
