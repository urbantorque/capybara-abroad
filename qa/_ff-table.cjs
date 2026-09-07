// Print the two-pass first-five table. Not a test; a reader for the JSON.
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('qa/first-five.json.png', 'utf8'));
const f = (v, w) => String(v === null ? '-' : v).padStart(w);

console.log('errs ' + JSON.stringify(j.errs).slice(0, 300));
console.log('seconds per chapter: ' + j.seconds + '\n');
console.log('                 WANDER (as B1)              WANDER + E + Shift');
console.log('ch          tick1  tSee  ticks gap   | tick1  tSee  ticks gap   wowAt');
const sum = { w: { tick30: 0, see: 0, ticks: 0 }, v: { tick30: 0, see: 0, ticks: 0 } };
for (let i = 0; i < j.wander.length; i++) {
  const a = j.wander[i], b = j.verbs[i] || {};
  if (a.tFirstTick !== null && a.tFirstTick <= 30) sum.w.tick30++;
  if (b.tFirstTick !== null && b.tFirstTick <= 30) sum.v.tick30++;
  if (a.tSee !== null) sum.w.see++;
  if (b.tSee !== null) sum.v.see++;
  sum.w.ticks += a.ticks || 0;
  sum.v.ticks += b.ticks || 0;
  console.log(
    (a.biome === a.want ? '  ' : '!!') + String(a.want).padEnd(10) +
    f(a.tFirstTick, 6) + f(a.tSee, 6) + f(a.ticks, 6) + f(a.gapMax, 6) + '  |' +
    f(b.tFirstTick, 6) + f(b.tSee, 6) + f(b.ticks, 6) + f(b.gapMax, 6) +
    f(b.wowAt === undefined ? null : b.wowAt, 7));
}
console.log('');
console.log('first tick <= 30 s   wander ' + sum.w.tick30 + '/19   verbs ' + sum.v.tick30 + '/19');
console.log('marquee seen at all  wander ' + sum.w.see + '/19   verbs ' + sum.v.see + '/19');
console.log('rows ticked, total   wander ' + sum.w.ticks + '      verbs ' + sum.v.ticks);
const never = j.verbs.filter((r) => r.tFirstTick === null).map((r) => r.want);
console.log('ticks NOTHING with verbs: ' + (never.length ? never.join(', ') : 'none'));
const marq = j.verbs.filter((r) => r.marqOn !== true).map((r) => r.want);
console.log('signpost not up: ' + (marq.length ? marq.join(', ') : 'none — 19/19'));
