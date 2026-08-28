import fs from 'fs';
const f = process.argv[2] || 'qa/b4-pose.json.png';
const j = JSON.parse(fs.readFileSync(f, 'utf8'));
console.log('started', j.started);
console.log('ch         sit slid split  deg  sprMean sprAgree  sprMax  gapMean gapAbs   wSunk');
for (const r of j.rows) {
  if (r.error) { console.log(r.biome, 'ERR', r.error); continue; }
  if (r.noTerrain || r.flat || r.legs !== 4) {
    console.log(r.biome.padEnd(10), r.noTerrain ? 'no terrainHeight' : r.flat ? 'no slope sites' : 'legs=' + r.legs);
    continue;
  }
  console.log(r.biome.padEnd(10), String(r.settled).padStart(3), String(r.slid).padStart(4),
    String(r.splitN).padStart(5), String(r.slopeDeg).padStart(5), String(r.spreadMean).padStart(8),
    String(r.spreadAgree).padStart(8), String(r.spreadMax).padStart(7),
    String(r.gapMean).padStart(8), String(r.gapAbsMean).padStart(6), String(r.worstSunk).padStart(7),
    JSON.stringify(r.spreadMaxAt || ''));
}
