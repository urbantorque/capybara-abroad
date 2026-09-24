// Prints the newest ten-t1c-board result, one line per run.
import fs from 'fs';
const dir = new URL('.', import.meta.url);
const all = fs.readdirSync(dir).filter(f => /^ten-t1c-board-\d+\.json\.png$/.test(f)).sort();
const pick = process.argv[2] ? all.slice(-Number(process.argv[2])) : all.slice(-1);
for (const f of pick) {
  const o = JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'));
  for (const r of o.runs) {
    const s = x => x && { t: x.t, b: x.biome, p: [x.x, x.y, x.z], bal: x.bal, truck: x.truck, tb: x.truckToBasket, ab: x.aboard, rung: x.rung, err: x.err };
    console.log(f, JSON.stringify({ unstick: r.unstick, walkS: r.walkS, aboardS: r.aboardS, arrive: s(r.arrive), atHint: s(r.atHint), end: s(r.end) }));
  }
}
