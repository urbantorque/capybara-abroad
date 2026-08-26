// Render one b5-cam-*.json.png as a table, or two of them side by side.
//   node qa/b5-camrep.mjs before            (one)
//   node qa/b5-camrep.mjs before after      (both)
//
// Every cell is  pitch/halfFOV = pitch − halfFOV, the angle of the horizon
// ABOVE the top edge of the frame. Negative, marked IN, means the sky is on
// the screen. See the header of qa/b5-cam.js for what each band is.
import fs from 'fs';
const read = t => JSON.parse(fs.readFileSync('qa/b5-cam-' + t + '.json.png', 'utf8'));
const [a, b] = process.argv.slice(2);
const A = read(a), B = b ? read(b) : null;
const cell = r => (r && r.n)
  ? ((r.pitch.toFixed(1) + '/' + r.half.toFixed(1)).padStart(10) + ' =' +
     ((r.horizon > 0 ? '+' : '') + r.horizon.toFixed(1)).padStart(6) + (r.inFrame ? ' IN ' : '    '))
  : '        GAP        ';
const tally = { };
const count = (o, key, band) => { const r = o[key][band]; return (r && r.n && r.inFrame) ? 1 : 0; };
const lines = [];
const BANDS = ['idle', 'raise', 'walk', 'run', 'runOpen'];
for (const tag of [a, b].filter(Boolean)) tally[tag] = { idle: 0, raise: 0, walk: 0, run: 0, runOpen: 0, sprint: 0, gaps: [] };
for (const k of Object.keys(A)) {
  const row = (o, tag, mark) => {
    let l = (mark === '|' ? k.padEnd(10) : ''.padEnd(10)) + ' ' + mark;
    for (const bd of BANDS) {
      l += ' ' + bd.slice(0, 4) + ' ' + cell(o[k][bd]);
      tally[tag][bd] += count(o, k, bd);
      if (!(o[k][bd] && o[k][bd].n) && bd === 'run') tally[tag].gaps.push(k);
    }
    const lf = (o[k].run && o[k].run.n) ? o[k].run.lift : (o[k].sprint ? o[k].sprint.lift : 0);
    return l + '| cut ' + (o[k].cutFrac * 100).toFixed(0).padStart(3) + '%' +
           (o[k].cutRaise === undefined ? '' : '/raise ' + (o[k].cutRaise * 100).toFixed(0).padStart(3) + '%') +
           ' worst ' + o[k].cutWorst.toFixed(2) + ' lift ' + (lf === undefined ? '?' : lf.toFixed(1));
  };
  lines.push(row(A, a, '|'));
  if (B && B[k]) lines.push(row(B, b, '>'));
}
console.log(lines.join('\n'));
const n = Object.keys(A).length;
console.log('');
for (const tag of [a, b].filter(Boolean)) {
  const t = tally[tag];
  console.log(tag.padEnd(7) + ' horizon IN FRAME: ' + BANDS.map(x => x + ' ' + t[x] + '/' + n).join(' · ') +
              (t.gaps.length ? '   (run gaps: ' + t.gaps.join(',') + ')' : ''));
}
const mean = o => Object.keys(o).reduce((s, k) => s + o[k].cutFrac, 0) / n * 100;
console.log('\nboom cut, mean over ' + n + ' chapters: ' + a + ' ' + mean(A).toFixed(1) + '%' +
            (B ? ' · ' + b + ' ' + mean(B).toFixed(1) + '%' : ''));
if (B) {
  const worse = Object.keys(A).filter(k => B[k] && B[k].cutFrac > A[k].cutFrac + 0.08)
    .map(k => k + ' ' + (A[k].cutFrac * 100).toFixed(0) + '%->' + (B[k].cutFrac * 100).toFixed(0) + '%');
  console.log('materially worse (>8 points more cut frames): ' + (worse.length ? worse.join(', ') : 'none'));
}
