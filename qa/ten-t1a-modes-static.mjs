// ROADMAP-TEN T1a, the static half of qa/ten-modes.mjs (qa/ten-t1a-modes-static.mjs): the source still
// holds the two games apart. Each assertion names the behaviour it protects;
// the live instrument proves the behaviour, this keeps a refactor honest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/systems.js', 'utf8');
let n = 0;
const has = (s, why) => { assert.ok(src.includes(s), why + ' (missing: ' + s.slice(0, 60) + ')'); n++; };
const hasNot = (s, why) => { assert.ok(!src.includes(s), why + ' (found: ' + s.slice(0, 60) + ')'); n++; };

// the flat wall: nineteen tiles in chapter order, the loop from 4cc6e5e^
has("sysEl('div', 'capyui-picks flat')", 'Free Roam has its own flat shelf');
has('for (let i = 1; i < pickDefs.length; i++) {\n    flatEl.appendChild(buildPick(pickDefs[i], i, false, false));',
  'the flat shelf holds every place after the hero, in CHAPTERS order');
has("'.capyui-picks.flat{max-height:none;overflow:visible;}'", 'on a desktop window the flat shelf does not scroll');
// the atlas is the story's alone
has("if (jrHasFile && journeyMode === 'story') {\n    heroAtlas = buildPick(pickDefs[0], 0, true, true);",
  'the act atlas is built only for a story file');
has("const fileOpen = !atlas ||", 'only the atlas has gates');
has('homecomingMemory(1, isDoneF).enough ? sysHOME_UI.actGate : sysHOME_UI.firstGate',
  'a gate says Sydney before the first memory, the act after it');
has("if (pickWanted) setTimeout(function () { if (!started) { shelfUse(true); titlePage(2); } }, 60);",
  'pause\'s "choose a place" opens the atlas on a story file');
// digits: page two only; page one's Digit1 is Begin
has("} else if (pick === 1 && !jrHasFile) startResume();", 'Digit1 on page one does what Begin does');
has("if (titlePageN === 2) {\n          const t = +heroEl.dataset.n === pick ? heroEl :",
  'a digit on page two presses the live shelf\'s tile');
hasNot("if (pick > 0) { titleFreeCommit(); startGame(CHAPTERS[pick - 1].biome, jrHasFile, 'free'); return; }",
  'no digit hard-codes Free Roam');
// the doors
has("beginLine: 'the bag, the shelf at home, and an ibis'", 'Begin says it is the story');
has("freeLine: 'every place open. no list. only trouble.'", 'Free roam says it is the sketchbook');
hasNot("goEl.setAttribute('title',", 'no tooltip stands in for the door\'s subline');
// the toggle, both ways
has("const pauseStory = pauseBtn('', sysHOME_UI.storyBack,", 'pause has a way back to the story');
has("storyEl.appendChild(sysEl('b', null, sysHOME_UI.storyCarry));", 'the title has "Carry on the story" for a free file');
has("if (hp.open.indexOf(chapterOf(where || 'sydney')) < 0) {", 'a story restore outside the open places goes to the frontier');
// the free gates
has("if (game.state.journeyMode === 'story' && game.state.homecomingArc && experience && !experience.enough) {",
  'the paper counts memories in the story only');
has("if (game.state.homecomingArc && game.state.journeyMode !== 'story') return false;", 'the ending is the story\'s');
has("function tutBeats() { return game.state.journeyMode === 'free' ? sysTUT_LINES.length - 1 : sysTUT_LINES.length; }",
  'the free walk ends before the story\'s exit beat');
has("if (started && c === 'Tab' && !jrShown) { e.preventDefault(); jrShow(jrFreeDepart()); return; }",
  'Tab in Free Roam is the departures board');
has("function jrFreeDepart() { return !game.state.noFreeDepart && game.state.journeyMode !== 'story'; }",
  'noFreeDepart cuts the free departures board');
console.log('Ten modes (static): ' + n + ' checks passed; two shelves, two doors, a toggle both ways.');
