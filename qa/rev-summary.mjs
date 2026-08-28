import fs from 'node:fs';
const J = (f) => JSON.parse(fs.readFileSync('qa/' + f, 'utf8'));

const world = J('rev-world.json.png');
const edge = J('rev-edge2.json.png');
const terr = J('rev-terr.json.png');
const foot = J('rev-foot.json.png');
const ppl = J('rev-people.json.png');
const solid = J('auditsolid.json.png');

const by = (arr, n) => (arr.rows || []).find((r) => r.biome === n) || {};
const order = world.chapters;

const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

const rows = [];
for (let i = 0; i < order.length; i++) {
  const n = order[i];
  const w = by(world, n), e = by(edge, n), t = by(terr, n), f = by(foot, n), p = by(ppl, n);
  const s = solid[n] || {};
  const bs = e.bearings || [];
  const drawn = med(bs.map((b) => b.rDraw).filter((v) => v > 0));
  const nResc = bs.filter((b) => b.rResc > 0).length;
  rows.push({
    n: i + 1, biome: n,
    bounds: !!w.bounds, slope: !!w.hasSlope, slip: !!w.hasSlip, terrain: !!w.hasTerrain,
    drawnTo: drawn,
    resc: nResc + '/8',
    burial10: w.bur10pct, burial20: w.bur20pct,
    lawErr15: t.pctOver15 === undefined ? null : t.pctOver15,
    footMean: f.meanGap, footFloat: f.maxFloat, footSink: f.maxSink, footVoid: f.nVoid,
    solidHits: s.n === undefined ? null : s.n,
    rings: (p.rings || []).map((r) => r.pct),
    locals: p.localBodiesHere,
  });
}

const pad = (v, w2) => String(v === null || v === undefined ? '-' : v).padStart(w2);
console.log('CAPY3 - CHAPTER INTEGRITY SUMMARY');
console.log('');
console.log('  #  chapter    | bnd slp slip | drawn resc | slope burial | law vs | foot gap (m)        | walk | scenery %');
console.log('                |              | to(m)      | >10cm >20cm  | mesh   | mean  float  void   | thru | 20/45/70/95');
console.log('  ' + '-'.repeat(112));
for (const r of rows) {
  console.log(
    '  ' + pad(r.n, 2) + ' ' + r.biome.padEnd(10) + ' |  ' +
    (r.bounds ? 'Y' : '.') + '   ' + (r.slope ? 'Y' : '.') + '   ' + (r.slip ? 'Y' : '.') + '  | ' +
    pad(r.drawnTo, 5) + ' ' + pad(r.resc, 4) + ' | ' +
    pad(r.burial10, 5) + ' ' + pad(r.burial20, 5) + '  | ' +
    pad(r.lawErr15, 5) + '  | ' +
    pad(r.footMean, 6) + ' ' + pad(r.footFloat, 5) + ' ' + pad(r.footVoid, 4) + '  | ' +
    pad(r.solidHits, 4) + ' | ' + r.rings.map((x) => pad(x, 3)).join('/')
  );
}
console.log('');
console.log('bnd  = publishes bounds()  -> the only thing that can rescue you from off-map');
console.log('slp  = publishes slopeAt() ; slip = publishes groundSlip()');
console.log('resc = of 8 bearings, how many put you back within 440 m of spawn');
console.log('burial = % of walkable ground where a 0.45 m nose/tail is >10 / >20 cm off the ground the body stands on');
console.log('law vs mesh = % of samples where terrainHeight disagrees with the drawn ground by >15 cm');
console.log('foot gap = model feet vs drawn ground after settling (+ float, - sink); void = of 16 pts, how many had NOTHING drawn under them');
console.log('walk thru = drawn structures >=1.6 m tall with no collider');
console.log('scenery = % of 20 m cells on each ring with 2+ props in them');
