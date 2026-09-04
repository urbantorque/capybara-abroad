const fs = require('fs');
const dir = 'C:/Users/roger/OneDrive/Desktop/capy3/qa/';
let rows = [];
for (const f of ['px-controls-a.json.png', 'px-controls-b.json.png']) {
  try { rows = rows.concat(JSON.parse(fs.readFileSync(dir + f, 'utf8'))); }
  catch (e) { console.log('FAIL', f, e.message); }
}
const n = x => (x === undefined || x === null) ? '-' : (typeof x === 'number' ? (Math.abs(x) < 1e-6 ? 0 : +x.toFixed(2)) : x);
console.log('rows', rows.length);
console.log('| k | biome | hop vy | walk | run | slide sp/flag | wheek? | grab | Zyaw | Xyaw | C before/after | V pitch a->b->c | V sky | V dy | V dist | clearMin worst | err |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const sl = r.slide || {};
  const v = r.v || {};
  const st = r.state || {};
  const wheek = (r.wheek || []).includes('wheek') ? 'Y' : 'NO(' + (r.wheek || []).join(',') + ')';
  const clears = [];
  for (const k of ['hop', 'slide', 'grab']) if (r[k] && r[k].clearMin !== undefined) clears.push(r[k].clearMin);
  if (v.clear) clears.push(...v.clear);
  const worst = clears.length ? Math.min(...clears) : '-';
  console.log('| ' + [r.k, r.biome, n(r.hop && r.hop.vy), n(r.walk), n(r.run),
    n(sl.sp) + '/' + (sl.slide ? 'Y' : 'NO'), wheek,
    (r.grab ? Object.keys(r.grab).filter(k => ['dive', 'swim', 'climb', 'held'].includes(k)).join('+') || 'ok' : '-'),
    n(r.z), n(r.x), n(r.c && r.c.before) + '/' + n(r.c && r.c.after),
    (v.pitch || []).map(n).join('>'), (v.sky || []).map(n).join('>'),
    (v.dy || []).map(n).join('>'), (v.dist || []).map(n).join('>'),
    n(worst), st.err || '-'].join(' | ') + ' |');
}
// flags
console.log('\n## anomalies');
for (const r of rows) {
  const out = [];
  const sl = r.slide || {}, v = r.v || {};
  if (!(r.hop && r.hop.vy > 4)) out.push('HOP weak vy=' + n(r.hop && r.hop.vy));
  if (!(r.walk > 3.8 && r.walk < 5.2)) out.push('WALK ' + n(r.walk));
  if (!(r.run > 6.9)) out.push('RUN low ' + n(r.run));
  if (!sl.slide) out.push('SLIDE did not fire (sp ' + n(sl.sp) + ', vy ' + n(sl.vy) + ')');
  if (!(r.wheek || []).includes('wheek')) out.push('WHEEK silent');
  if (Math.abs(r.z || 0) < 0.5) out.push('Z yaw dead ' + n(r.z));
  if (Math.abs(r.x || 0) < 0.5) out.push('X yaw dead ' + n(r.x));
  if (v.pitch && v.pitch.length >= 2 && !(v.pitch[1] < v.pitch[0] - 1.5)) out.push('V pitch did not raise ' + v.pitch.map(n).join('>'));
  if (v.sky && v.sky.length >= 2 && !(v.sky[1] > v.sky[0] + 0.05)) out.push('V sky flat ' + v.sky.map(n).join('>'));
  if (r.state && r.state.err) out.push('ERR ' + r.state.err);
  if (out.length) console.log(r.k + ' ' + r.biome + ': ' + out.join(' | '));
}
