// ROADMAP-TEN T4a, static: the ending's wiring, so a later edit that drops a
// piece of it fails here and not in a player's last minute. The behaviour is
// proved live by qa/ten-t4a-finale.mjs (browser, not in npm test).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync('src/systems.js', 'utf8');
const sh = readFileSync('src/shared.js', 'utf8');
const rv = readFileSync('qa/aaa-rival.mjs', 'utf8');
let n = 0;
const has = (src, needle, what) => { assert.ok(src.includes(needle), what + ' (missing: ' + needle.slice(0, 70) + ')'); n++; };
// the coda caption: the pill, low, held with its note, a keepsake near the glass not held
has(s, "'.capyui-coda.pill{top:auto;bottom:18%;", 'the caption sits low as a pill');
has(s, "codaEl.classList.toggle('pill', polish);", 'the pill is the flag\'s');
has(s, 'ph.flash(p, polish ? 24 : 10);', 'the flash at 24');
has(s, 'Math.hypot(bp.x - cam.x, bp.y - cam.y, bp.z - cam.z) < sysFIN_FLASH_NEAR', 'no held flash at the glass');
// the last frame, the linger and the floor
has(s, 'function sysFinaleLastFrame()', 'the last frame');
has(s, "try { capyForceNap(1); sysFinNapped = true; }", 'the animal asleep at the end');
has(s, 'const sysFinCodaTotal = sysFinCodaPhrase + (game.state.noFinPolish ? 0 : sysFIN_LINGER);', 'the linger');
has(s, 'game.state.noFinPolish ? 0 : sysFIN_LEDGER_MIN * 1000', 'the ledger floor');
has(s, 'if (!game.state.noFinPolish) storyBeatQuiet(sysFinLedMs);', 'the frame is the ending\'s');
has(s, "if (game.state.noFinPolish) toast('and that is the lot.', 'last');", 'the line waits for the last frame');
// the bag and the wait for it
has(s, "game.events.on('npc:travBag', function (e) {", 'the bag answers npc.js');
has(s, 'if (!ev || game.state.noTravArc', 'the bag is the traveller flag\'s');
has(s, '(sysFinBagReady() || sysFinT >= sysFIN_BAG_WAIT)', 'the close waits for the bag, capped');
has(s, "{ finale: true, scale: 2.2 }", 'the staging asks for the plinth scale');
// the epilogue
has(s, "if (ledFinal && !game.state.noFinPolish) ledOut.push(def);", 'the unvisited are collected');
has(s, "sysEl('div', 'capyui-ledouth', 'still out there')", 'still out there');
has(s, "ledTitleFinal = 'FURTHER THAN IT MEANT'", 'the title at thirteen');
has(s, "if (kc >= chapMax) ledTitleFinal = 'MISCHIEF COMPLETE';", 'the title at nineteen');
// carry-ins
has(s, "(def.liveLabel || def.label) + ' ' + recLiveVal.toFixed(def.dp) + def.unit", 'the live label');
has(sh, "'lantern':       { label: 'lit it with', liveLabel: 'carrying',", 'the lantern carries');
has(sh, "'opera-stage':   { label: 'drew a house of', unit: ' people', better: 'higher', dp: 0, par: 10 },", 'concert par 10');
has(s, 'add(walletEl);', 'bubbles dodge the yuzu pill');
has(s, 'if (hereN === 1 && seenN <= 1) {', 'chapter one has no clock');
has(s, "if (!inCtl && !e.shiftKey) { e.preventDefault(); jrHide(); return; }", 'Tab closes the journal');
has(s, "const placeUp = !game.state.noPlaceFold", 'the paper folds under the place name');
has(rv, 'window.__capy.state.noFirstGrace = true', 'aaa-rival ends the grace after arrival');
// the marked CSS blocks the inherited-sheet lock strips
assert.equal((s.match(/\/\* TEN T4a finale:/g) || []).length, (s.match(/\/\* TEN T4a finale end\. \*\//g) || []).length, 'balanced CSS markers'); n++;
console.log('ten-t4a static: ' + n + ' checks');
