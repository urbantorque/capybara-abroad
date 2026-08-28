import fs from 'fs';
const j = JSON.parse(fs.readFileSync(process.argv[2] || 'qa/b5-solid.json.png', 'utf8'));
for (const ch of Object.keys(j)) {
  const r = j[ch];
  console.log('==', ch, ' hits', r.n, ' sampled', r.sampled, ' bodies', r.boxes, ' ms', r.ms);
  const rows = Object.entries(r.objs).sort((a, b) => b[1].hits - a[1].hits);
  for (const [id, o] of rows) {
    console.log('   ', String(o.hits).padStart(3), (o.name || '?').padEnd(26),
      (o.geo || '').padEnd(16), 'tris', String(o.tris).padStart(6),
      'r', String(o.r).padStart(4), o.inst ? ('inst x' + o.cnt) : '',
      'bb', JSON.stringify(o.bb), 'at', JSON.stringify(o.wat));
  }
}
