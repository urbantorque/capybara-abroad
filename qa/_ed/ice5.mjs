import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}

// the centre search has to RETRY, or a band that is nine tenths one ground
// throws away nine tenths of its budget for every other ground
rep(`function iceScatClumps(band, tries, perClump, spread, kind, place) {
  let n = 0;
  for (let c = 0; c < tries; c++) {
    const cx = rand(band[1], band[2]), cz = rand(band[3], band[4]);
    if (iceGroundKind(cx, cz) !== kind) continue;
    if (iceIsOverWater(cx, cz)) continue;
    const cy = iceTerrain(cx, cz);
    if (cy < 0.15) continue;`,
`function iceScatClumps(band, tries, perClump, spread, kind, place) {
  let n = 0;
  for (let c = 0; c < tries; c++) {
    // ---- AND THE CENTRE SEARCH RETRIES -----------------------------------
    // First cut took ONE sample per clump and dropped the clump if it was not
    // on the right ground. A band is a rectangle and a ground is a stripe, so
    // for four of the five grounds that rectangle is mostly the wrong stripe:
    // measured, the whole pass planted 554 pieces against a budget of three
    // thousand and the chapter came out at 1,130 instances, still a quarter of
    // the seventeen-chapter median. Trap 10, in its usual form — sample INSIDE
    // the places there is the thing you are looking for.
    let cx = 0, cz = 0, ok = false;
    for (let t = 0; t < 8 && !ok; t++) {
      cx = rand(band[1], band[2]); cz = rand(band[3], band[4]);
      ok = iceGroundKind(cx, cz) === kind && !iceIsOverWater(cx, cz) &&
           iceTerrain(cx, cz) >= 0.15;
    }
    if (!ok) continue;`);

// ...and there has to be enough of it
rep(`    iceScatClumps(band, 26, [7, 16], 5.5, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 40, [10, 22], 6.0, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 14, [14, 30], 4.2, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 22, [18, 38], 4.6, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 22, [8, 18], 4.8, 'town', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 34, [10, 22], 5.2, 'town', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 20, [6, 14], 4.4, 'geo', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 32, [8, 18], 5.0, 'geo', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 16, [3, 7], 7.0, 'moraine', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 30, [4, 10], 8.0, 'moraine', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 14, [4, 10], 6.5, 'ice', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 26, [6, 14], 8.0, 'ice', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 9, [1, 3], 6.0, id.indexOf('town') === 0 ? 'town' : 'shore',`,
    `    iceScatClumps(band, 16, [1, 3], 7.0, id.indexOf('town') === 0 ? 'town' : 'shore',`);

// and the middle of the map was not in any town or shore band at all
rep(`  ['town-e',       55,   170,    72,   130],`,
`  ['town-c',       -55,    55,    72,   130],
  ['town-e',       55,   170,    72,   130],`);
rep(`  ['shore-e',      62,   180,   -78,   -26],`,
`  ['shore-e',      62,   180,   -78,   -26],
  ['lava-n',     -170,   170,   -26,    18],`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
