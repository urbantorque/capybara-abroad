// Prints the newest ten-t1c-land result, one line per sample.
import fs from 'fs';
const dir = new URL('.', import.meta.url);
const f = fs.readdirSync(dir).filter(f => /^ten-t1c-land-\d+\.json\.png$/.test(f)).sort().pop();
const o = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
const l = s => s && [s.t, 'p', s.p.join(','), 'alt', s.alt, 'ab', s.aboard, 'ride', s.ride, 'task', s.landDone,
  'truck', s.truck.join(','), 'tb', s.tb, 'bed', s.bed.join(','), 'bb', s.bb, s.err ? 'ERR ' + s.err : ''].join(' ');
console.log(f);
console.log('boarded', l(o.boarded)); console.log('top', l(o.top));
for (const s of o.samples.slice(-3)) console.log(' down', l(s));
console.log('landed', l(o.landed));
for (const k of ['A', 'C1', 'B', 'D', 'C']) for (const s of o[k]) console.log(' ' + k, l(s));
console.log('final', l(o.final));
