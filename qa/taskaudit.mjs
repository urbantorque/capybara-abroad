// Static task audit: every row in the shared.js task table, and where (if
// anywhere) that id is referenced in the chapter sources.
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
const shared = fs.readFileSync(path.join(SRC, 'shared.js'), 'utf8');

const re = /\{\s*id:\s*'([^']+)'\s*,\s*text:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
let m;
const rows = [];
while ((m = re.exec(shared))) {
  const tail = m[3];
  const ch = /chapter:\s*(\d+)/.exec(tail);
  if (!ch) continue;
  const act = /act:\s*(\d+)/.exec(tail);
  rows.push({
    id: m[1], text: m[2], ch: +ch[1], act: act ? +act[1] : 1,
    mini: /mini:/.test(tail), wow: /wow:/.test(tail),
  });
}

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));
const all = {};
for (const f of files) all[f] = fs.readFileSync(path.join(SRC, f), 'utf8');

const orphans = [];
for (const r of rows) {
  const hits = [];
  for (const f of files) {
    if (f === 'shared.js') continue;
    const rx = new RegExp("['\"]" + r.id.replace(/[-]/g, '\\-') + "['\"]", 'g');
    const c = (all[f].match(rx) || []).length;
    if (c) hits.push(f + ':' + c);
  }
  r.hits = hits;
  if (!hits.length) orphans.push(r);
}

// the reverse direction: completeTask('x') calls whose id is not in the table
const known = new Set(rows.map((r) => r.id));
const ghosts = [];
for (const f of files) {
  const rx = /completeTask\(\s*'([^']+)'/g;
  let g;
  while ((g = rx.exec(all[f]))) if (!known.has(g[1])) ghosts.push(f + ' -> ' + g[1]);
}

console.log('task rows:', rows.length);
const byCh = {};
for (const r of rows) byCh[r.ch] = (byCh[r.ch] || 0) + 1;
console.log('per chapter:', JSON.stringify(byCh));
console.log('\nORPHANS (id never referenced outside shared.js):', orphans.length);
for (const r of orphans) console.log('  ch' + r.ch, r.id, '|', r.text);
console.log('\nGHOST completeTask ids not in the table:', ghosts.length);
for (const g of ghosts) console.log('  ' + g);

fs.writeFileSync('qa/tasks.json', JSON.stringify(rows, null, 1));
