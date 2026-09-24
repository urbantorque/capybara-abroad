// ROADMAP-TEN T3a, the static half of qa/ten-t3a-free.mjs: the source still
// carries the sketchbook. Each assertion names the behaviour it protects; the
// live instrument proves the behaviour, this keeps a refactor honest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/systems.js', 'utf8');
let n = 0;
const has = (s, why) => { assert.ok(src.includes(s), why + ' (missing: ' + s.slice(0, 60) + ')'); n++; };

// the flags, each a cut that restores the old behaviour
for (const f of ['noFreePaper', 'noFreeRemember'])
  has('game.state.' + f, 'the flag ' + f + ' is read');
// the free paper: a branch in todoRefresh, not a second paper
has("return !game.state.noFreePaper && game.state.journeyMode === 'free' && started;", 'the sketchbook is a free file\'s only');
has('if (freeP) {\n      winIds = [];', 'a free file has no list: the window is emptied');
has('if (!freeP && done >= rec.ids.length && rec.ids.length) {', 'the story\'s record board is not the free page');
has('if (freeP) freePaperRefresh(n);', 'todoRefresh hands the page to the sketchbook');
has("if (countEl.textContent !== foot) countEl.textContent = foot;", 'the story\'s "a memory kept" is not a free file\'s tally');
has('function freeSketchPick(biome) {', 'three unearned names are chosen per place');
has('if (p.biome && p.biome !== biome) continue;', 'another place\'s own name is never offered');
has("if (!props) continue; cls = 1;", 'a named-prop name is only offered where the prop lies');
// every repertoire id has a want word
const wantBlock = src.match(/const sysREP_WANT = \{([^]*?)\};/);
assert.ok(wantBlock, 'sysREP_WANT exists'); n++;
const table = src.slice(src.indexOf('const sysREP_MOVE = ['), src.indexOf('const sysREP_R = '));
let rows = 0;
for (const m of table.matchAll(/\{ id: '([a-z-]+)',\s+name: ["'][A-Z]/g)) {
  assert.ok(wantBlock[1].includes("'" + m[1] + "'"), 'the name ' + m[1] + ' has a want word'); n++; rows++;
}
assert.ok(rows >= 45, 'the repertoire table was read (' + rows + ' rows)'); n++;
// the stamp: a first name on a free file is rank 2 with its own look
has("showMoment(sysFREE_UI.stampKick, p.name, note, false, 2, undefined, 'stamp');", 'a new name is stamped at rank 2');
has("momentEl.classList.toggle('stamp', cls === 'stamp' && !game.state.noFreePaper);", 'the stamp look rides the moment card');
has('if (!(named && freeStamp(named, sentence)))', 'the chain\'s name goes through the stamp');
has('if (freeStamp(row, row.say)) return true;', 'a move\'s name goes through the stamp');
has('const sysFREE_MILES = [15, 30, 45];', 'the book speaks at fifteen, thirty and forty-five');
has("showMoment(sysFREE_MILE_KICK[hit], (notoName() || 'a rumour').toUpperCase(), line, false, 2);", 'the milestone is rank 2');
has('if (freeMileSeen < 0 && started) freeMileSeen = repFound();', 'a restored count is not a milestone');
// the wall and the stat
has('const freeTile = !atlas && !game.state.noFreePaper', 'the free wall shows the place\'s word, not a task tally');
has("p2StatFlat = [notoName(notoTier(sc.score)) || 'nobody yet', sc.variety + ' of ' + sysREP.length + ' names'];", 'the free stat is the rank and the names');
has('function notoScore(f) {', 'one notoriety formula for the live journey and the file');
// the place remembers, the door guard, the tab
has('if ((jrChapInc[n] || 0) >= sysFREE_BACK_INC) {', 'a place with five incidents says so on the way back');
has('if (game.notoWarm(n)) freeGift();', 'a place that is fond of it gives it something');
has('if (game.state.flierWhistleT > 0) return true;', 'the door ignores a wheek a flier is answering');
has('if (input.whistlePressed && doorHushed(p)) doorHushN++;', 'the door guard sits on the three-wheek count');
has('const sub = live ? wowLiveLine : freeTabSub;', 'a live marquee\'s tab carries its own line, not another row\'s clock');
// paper clarity, all modes
has('const near = todoByNear(experience.supportOpen);', 'the small moment offered is the nearest open one');
has("const txt = vert ? tell.trim() + ' ' + Math.abs(dh).toFixed(0) + ' m'", '"here" is not said with the target six metres below');
has('if (sysSkillT <= 0 && !jrShown && !bodyBusy) {', 'a skill card waits for the ground');
has("altLine: 'the ibis came when it was called.", 'a skill taught by its second teacher says whose');
has("'HOLD E as each white one reaches you. under, not over.'", 'the duck-dive clue says which way');
const shared = readFileSync('src/shared.js', 'utf8');
assert.ok(shared.includes("supports: ['torii-run', 'zen-ruin', 'bamboo-dash', 'matcha-raid', 'the-bell']"), 'Kyoto opens on Gion rows'); n++;
// the CSS lives in a marked block the earned-card check can strip
has('/* TEN T3a sketchbook:', 'the sketchbook CSS opens a marked block');
has('/* TEN T3a sketchbook end. */', 'the sketchbook CSS closes its marked block');
const card = readFileSync('qa/reimagine-earned-card.mjs', 'utf8');
assert.ok(card.includes('TEN T3a sketchbook'), 'the earned-card check strips the block'); n++;
console.log('ten-t3a static: ' + n + ' checks passed');
