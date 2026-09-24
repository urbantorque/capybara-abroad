// ROADMAP-TEN T2a, the static half of qa/ten-t2a-story.mjs: the source still
// carries the story's beats. Each assertion names the behaviour it protects;
// the live instrument proves the behaviour, this keeps a refactor honest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/systems.js', 'utf8');
let n = 0;
const has = (s, why) => { assert.ok(src.includes(s), why + ' (missing: ' + s.slice(0, 60) + ')'); n++; };

// the flags, each a cut that restores the old behaviour
for (const f of ['noMomentPriority', 'noMemBeat', 'noActTurn', 'noFirstGrace', 'noHeldWow'])
  has('game.state.' + f, 'the flag ' + f + ' is read');
// moment priority: ranks, the drop, the premise at rank 2 held five seconds
has('if (busy && pr === 0) { sysMomentDropped++; return; }', 'a rank-0 card under a higher one is dropped');
has('false, 2, 5.0);', 'the premise is rank 2 and held five seconds');
has("ranked ? 'FIVE FOLDS OF A MAP' : 'NINETEEN PLACES'", 'the premise says the story\'s number');
has("named ? 1 : 0);", 'the heat ladder is rank 0 unless it has a name');
has('incNow - incCardAt >= sysINC_RECARD', 'a repeat heat-ladder card inside ten seconds is the pips\' to say');
// the memory beat and the act turn, and what the next wave builds on
has('if (memFire) setTimeout(function () { memoryCeremony(cn, actWas); }, sysMEM_DELAY);',
  'the memory edge in completeTask schedules the ceremony');
has('const memWas = memStory ? keepHeld(r.chapter) : true;', 'the edge is read across the tick, never on a restore');
has('sysCardClaim(3, sysMEM_HOLD / 1000);', 'the memory card is rank 3');
has('setTimeout(function () { sysDropKeep(n); }, sysMEM_DROP);', 'the keepsake lands at the animal\'s feet');
has("if (!memBeatDone[n]) setTimeout(function () { showKeep(n); sysDropKeep(n); }, sysKEEP_WAIT);",
  'the chapter ceremony does not hand the keepsake over twice');
has('game.journeyAct = function () {', 'game.journeyAct() is exported for rival.js (T3b)');
has("game.events.emit('story:act', {", "'story:act' is on the bus");
has('const sysACT_LINES = [', 'the act turn has its pool');
// the grace
has('return started && !transBusy && !jrShown && !pauseShown && !game.state.paused && !sysGraceOn() &&',
  'the ibis waits for the first memory');
has('if (sysGraceOn()) incN = Math.min(incN, sysINC_N);', 'the heat ladder stops at AN INCIDENT in the grace');
has("yuzuAdd(sysYUZU_ARRIVAL, 'the first look', cp && cp.x", 'the first look is paid on the first wheek');
// the held-toast guard and the frame that belongs to its moment
has('if (!sysToastHeld.length || wowLiveOn || (shotReq && shotW > 0.002)) return;', 'held lines wait out a moment');
has('now - (h.at === undefined ? now : h.at) > sysHELD_STALE', 'held lines older than twelve seconds go unsaid');
has('const want = !wowEarnedOn && !owned && todoAwayT > sysTUCK_AFTER;', 'the paper does not tuck to a stale row mid-marquee');
has('!hudBare && !sysFrameOwned()) {', 'the paper tip waits out a marquee or a ride');
// the atlas in the story's terms
has("memF.enough ? 'remembered' : memK + ' of 2 to a memory'", 'an atlas tile counts memories, not tasks');
console.log('ten-t2a static: ' + n + ' checks');
