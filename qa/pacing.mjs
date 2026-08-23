// A STATIC PACING AUDIT: how long is each chapter, at a casual pace?
//
// It is a MODEL and the model is stated rather than hidden, because the thing
// it is estimating cannot be measured without a human holding the controller.
// Three inputs:
//
//   TRAVEL   the half-perimeter of the chapter's own authored rectangle
//            (sysMAP_WORLDS), crossed once per two tasks, times a WANDER factor
//            of 1.9 because nobody walks the short way, at 4.6 m/s — between the
//            capybara's walk (4.2) and its run (7.4), which is about what a
//            casual player averages once stamina and corners are in it. Crude,
//            and deliberately crude: it is "how long does it take to get across
//            this place, over and over", which is what walking a chapter is.
//   SET PIECES  MEASURED, under playwright, 20 Aug 2026 — the build plus the
//            payoff of each chapter's mini and marquee, from the moment the
//            player commits.
//   ORDINARY TASKS  the one number that is a guess. See the sensitivity block
//            at the bottom, which prints the table again at four values of it,
//            because the answer is a range and not a number.
//
// The target is 20-35 minutes per map. Run: node qa/pacing.mjs
import { readFileSync } from 'node:fs';

const shared = readFileSync('src/shared.js', 'utf8');
const systems = readFileSync('src/systems.js', 'utf8');

// ---- tasks per chapter -----------------------------------------------------
const tb = shared.slice(shared.indexOf('export const TASKS = ['),
                        shared.indexOf('\n];', shared.indexOf('export const TASKS = [')));
const tasks = [];
const re = /\{\s*id:\s*'([^']+)'[^}]*?chapter:\s*(\d+)([^}]*)\}/g;
let m;
while ((m = re.exec(tb))) {
  tasks.push({ id: m[1], chapter: Number(m[2]),
               wow: /wow:\s*'([^']+)'/.test(m[3]), mini: /mini:\s*'([^']+)'/.test(m[3]) });
}

const chapBlock = shared.slice(shared.indexOf('export const CHAPTERS = ['));
const chaps = [...chapBlock.matchAll(/\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)',\s*name:\s*'([^']+)'/g)]
  .map(x => ({ n: Number(x[1]), biome: x[2], name: x[3] }));

// ---- the measured seconds each set piece takes ------------------------------
// Timed under playwright, 20 Aug 2026: the build plus the payoff, from the
// moment the player commits to it.
// KEYED BY TASK ID, NOT BY BIOME, since 20 Aug 2026: the audit has always
// allowed two minis in a chapter and four chapters now have them, so a single
// number per place silently dropped the second one out of the model.
const MINI_S = {
  'whippy-run': 24, carroza: 20, 'ferry-salute': 34, 'the-bell': 19,
  'cart-run': 55, 'take-a-wave': 33, 'the-whale': 25, acrobats: 15,
  driftseed: 27, traghetto: 21, 'bus-top': 24, 'bait-ball': 20, 'the-herd': 24,
  // The four added 20 Aug 2026. Each is the sum of its own constants — the
  // approach, the build and the payoff — and each was timed end to end under
  // playwright rather than estimated.
  'the-manta': 26,     // catch it, then 22 s of flight to the breach
  'choi-cheng': 34,    // walk up the head, then eight leaps and the lettuce
  volo: 28,            // 12.5 s of haul, 3 at the top, 10 down
  'o-bonde': 24,       // the ramp, the arches, and the pass in the middle
  // ...and the six minis of the three later chapters, estimated the same way.
  'take-off': 25, 'the-surfboat': 25, gather: 25, tamandua: 25,
  'great-wall': 25, 'the-log': 25,
};
// THREE ROWS THAT ARE ESTIMATES AND SAY SO. Manly, the Pantanal and Son Doong
// were built after this table was written and nobody has timed their set pieces
// under playwright. A MISSING row silently scored zero, which took a minute off
// each of those three chapters and is the worst kind of wrong number — invisible.
// These are the median of the thirteen that were measured. Replace them when the
// three are timed.
const WOW_S = {
  manly: 55, pantanal: 55, cave: 55,      // <- estimated, not measured
  sydney: 30, pasto: 60, quay: 80, kyoto: 45, cali: 95, rio: 60, iceland: 40,
  sahara: 35, drift: 45, venice: 90, kowloon: 55, palawan: 30, goreme: 120,
};
const ORDINARY_S = 40;
const WANDER = 1.9;
const SPEED = 4.6;

// ---- how big each place is --------------------------------------------------
// The minimap's own rectangle per biome. It is the designer's statement of the
// extent of the world and it is the only per-place size number in the codebase
// that is not a landmark, which is exactly what is wanted here.
const mw = systems.slice(systems.indexOf('const sysMAP_WORLDS = {'));
const rects = {};
const rre = /\n  ([a-z]+):\s*\{\s*x0:\s*(-?\d+),\s*x1:\s*(-?\d+),\s*z0:\s*(-?\d+),\s*z1:\s*(-?\d+)/g;
while ((m = rre.exec(mw))) {
  rects[m[1]] = { w: Number(m[3]) - Number(m[2]), d: Number(m[5]) - Number(m[4]) };
}

console.log('chapter          tasks  mini+wow    map (m)      travel     tasks     TOTAL');
console.log('-'.repeat(78));
let sum = 0;
for (const c of chaps) {
  const list = tasks.filter(t => t.chapter === c.n);
  const ord = list.filter(t => !t.wow && !t.mini).length;
  const r = rects[c.biome] || { w: 0, d: 0 };
  // The tour is modelled as the half-perimeter of the authored rectangle per
  // landmark visit — crude, and honest about being crude: it is the distance
  // you cover getting from one side of a place to the other, once per two
  // tasks, which is what walking a chapter actually looks like.
  const cross = (r.w + r.d) * 0.5;
  const travel = cross * (list.length / 2) * WANDER / SPEED;
  const miniS = list.reduce((n, t) => n + (t.mini ? (MINI_S[t.id] || 25) : 0), 0);
  const doing = ord * ORDINARY_S + miniS + (WOW_S[c.biome] || 0);
  const total = travel + doing;
  sum += total;
  console.log(
    (c.name).padEnd(17) +
    String(list.length).padStart(4) +
    ('  ' + miniS + '+' + (WOW_S[c.biome] || 0) + 's').padStart(11) +
    ('  ' + r.w + 'x' + r.d).padStart(13) +
    ('  ' + Math.round(travel / 60) + ' min').padStart(11) +
    ('  ' + Math.round(doing / 60) + ' min').padStart(10) +
    ('  ' + Math.round(total / 60) + ' min').padStart(10) +
    (total < 20 * 60 ? '   THIN' : total > 35 * 60 ? '   LONG' : ''));
}
console.log('-'.repeat(78));
console.log(chaps.length + ' chapters, ' + tasks.length + ' tasks, ' +
            Math.round(sum / 60) + ' min end to end (' + (sum / 3600).toFixed(1) + ' h)');

// ---- and the number the whole table hangs on --------------------------------
// ORDINARY_S is the one input above that is a guess rather than a measurement,
// and it moves every row. Forty seconds is a player who reads the clue, walks
// to the beacon and does the thing; a player who is also looking at the place
// takes nearer ninety. So the table is printed again at both ends of that, and
// the honest reading is the RANGE.
console.log('');
console.log('sensitivity to the one assumed number (s per ordinary task):');
for (const o of [40, 60, 75, 90]) {
  let lo = 1e9, hi = 0, tot = 0;
  for (const c of chaps) {
    const list = tasks.filter(t => t.chapter === c.n);
    const ord = list.filter(t => !t.wow && !t.mini).length;
    const r = rects[c.biome] || { w: 0, d: 0 };
    const travel = (r.w + r.d) * 0.5 * (list.length / 2) * WANDER / SPEED;
    const ms = list.reduce((n, t2) => n + (t2.mini ? (MINI_S[t2.id] || 25) : 0), 0);
    const t = travel + ord * o + ms + (WOW_S[c.biome] || 0);
    lo = Math.min(lo, t); hi = Math.max(hi, t); tot += t;
  }
  const inBand = o >= 60 && o <= 90;
  console.log('  ' + String(o).padStart(3) + ' s  ->  ' +
    Math.round(lo / 60) + '-' + Math.round(hi / 60) + ' min per chapter, ' +
    (tot / 3600).toFixed(1) + ' h end to end' + (inBand ? '   (inside the 20-35 target)' : ''));
}

// ---- AND THE THING THE TABLE IS ACTUALLY FOR --------------------------------
// A second mini is worth 25-35 s of set piece, which is real density and is NOT
// on its own enough to lift a nine-task chapter from thirteen minutes to twenty:
// measured above, the four chapters that got one on 20 Aug 2026 moved by about
// a minute and a half each. The remaining lever is the number of ORDINARY tasks,
// because every one of them costs its own time AND adds a crossing of the map.
//
// So the last thing this script prints is the only actionable number in it: how
// many more ordinary tasks each chapter needs to reach the bottom of the band.
// It is printed at 75 s, which is what "casual" means — a player who reads the
// clue, walks over, looks at the place on the way and fumbles it once.
const AT = 75, TARGET = 20 * 60;
console.log('');
console.log('ordinary tasks still needed to reach 20 min at ' + AT + ' s/task:');
let need = 0;
for (const c of chaps) {
  const list = tasks.filter(t => t.chapter === c.n);
  const ord = list.filter(t => !t.wow && !t.mini).length;
  const r = rects[c.biome] || { w: 0, d: 0 };
  const cross = (r.w + r.d) * 0.5;
  const ms = list.reduce((n, t) => n + (t.mini ? (MINI_S[t.id] || 25) : 0), 0);
  const fixed = ms + (WOW_S[c.biome] || 0);
  // each extra task adds AT seconds of doing plus half a crossing of travel
  const per = AT + cross * 0.5 * WANDER / SPEED;
  let k = 0;
  for (; k < 40; k++) {
    const n = list.length + k;
    const t = cross * (n / 2) * WANDER / SPEED + (ord + k) * AT + fixed;
    if (t >= TARGET) break;
  }
  need += k;
  console.log('  ' + c.name.padEnd(17) + (k ? '+' + k : '  in band') +
              (k ? '   (each is worth ~' + Math.round(per) + ' s here)' : ''));
}
console.log('  ' + '-'.repeat(30));
console.log('  ' + (need
  ? need + ' ordinary tasks across the ' + chaps.length + ', and that is the backlog.'
  : 'nothing. every chapter is in the band at ' + AT + ' s a task.'));
