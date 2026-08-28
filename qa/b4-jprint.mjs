import fs from 'fs';
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
console.log('ch          deg  pitchJit(mrad/f2)  rollJit   pitchRange rollRange  err');
for (const r of j.rows) {
  if (r.error) { console.log(r.biome, 'ERR', r.error); continue; }
  if (r.noModel) { console.log(r.biome, 'no model'); continue; }
  console.log(r.biome.padEnd(10), String(r.deg).padStart(5),
    (r.pitch.mean + ' / ' + r.pitch.max).padStart(18),
    (r.roll.mean + ' / ' + r.roll.max).padStart(16),
    String(r.pitchRange).padStart(9), String(r.rollRange).padStart(9),
    r.lastError ? 'ERR ' + r.lastError : '');
}
