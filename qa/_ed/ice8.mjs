import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
const block = fs.readFileSync('qa/_ed/ice7.txt', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}

// the scatter bands become a GRID, which is what culling actually wants
rep(`const iceSCAT_BANDS = [
  // id            x0     x1     z0     z1
  ['lava-w',     -170,   -55,    18,    72],
  ['lava-c',      -55,    55,    18,    72],
  ['lava-e',       55,   170,    18,    72],
  ['town-w',     -170,   -55,    72,   130],
  ['town-c',       -55,    55,    72,   130],
  ['town-e',       55,   170,    72,   130],
  ['geo-w',      -170,   -34,   -26,    18],
  ['geo-c',       -34,    34,   -26,    18],
  ['geo-e',        34,   170,   -26,    18],
  ['shore-w',    -180,   -62,   -78,   -26],
  ['shore-e',      62,   180,   -78,   -26],
  ['lava-n',     -170,   170,   -26,    18],
  ['mor-s',      -180,   180,  -122,   -78],
  ['mor-n',      -180,   180,  -196,  -122],
];`,
`/**
 * A GRID, NOT A LIST OF REGIONS.
 *
 * The first cut hand-wrote fourteen bands the size of the four grounds. That
 * is the right unit for THINKING about scatter and the wrong one for drawing
 * it: a batch a hundred and forty metres wide is inside the frustum from
 * anywhere in the chapter, so the world pays every frame for moss it cannot
 * see. Thirty-five cells of about seventy by fifty metres each are culled
 * properly, and the cost of the extra batches is a draw call apiece for
 * something that is usually not drawn at all.
 *
 * The cells that contain no ground of a given kind produce no batch, which is
 * why this is thirty-five cells and nothing like three hundred and fifty
 * meshes.
 */
const iceSCAT_BANDS = (function () {
  const XS = [-180, -108, -46, 0, 46, 108, 180];
  const ZS = [-196, -150, -108, -78, -26, 18, 48, 78, 106, 132];
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    for (let k = 0; k < ZS.length - 1; k++) {
      out.push(['c' + i + '-' + k, XS[i], XS[i + 1], ZS[k], ZS[k + 1]]);
    }
  }
  return out;
})();`);

// a cell is a fifth the size, so it wants a fifth the tries
rep(`    iceScatClumps(band, 130, [3, 8], 7.5, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 30, [3, 8], 7.5, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 26, [16, 34], 5.0, 'lava', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 6, [16, 34], 5.0, 'lava', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 96, [4, 10], 7.0, 'town', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 24, [4, 10], 7.0, 'town', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 78, [4, 10], 6.5, 'geo', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 20, [4, 10], 6.5, 'geo', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 64, [3, 7], 9.5, 'moraine', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 18, [3, 7], 9.5, 'moraine', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 54, [4, 9], 9.0, 'ice', (x, y, z, k, c) => {`,
    `    iceScatClumps(band, 15, [4, 9], 9.0, 'ice', (x, y, z, k, c) => {`);
rep(`    iceScatClumps(band, 16, [1, 3], 7.0, id.indexOf('town') === 0 ? 'town' : 'shore',`,
    `    iceScatClumps(band, 5, [1, 3], 7.0, band[3] > -26 ? 'town' : 'shore',`);
rep(`    if (id.indexOf('town') === 0 || id.indexOf('shore') === 0) {`,
    `    {`);
rep(`          if (z < 96 && id.indexOf('town') === 0) return;`,
    `          if (z > 60 && z < 96) return;    // driftwood belongs on a shore`);

// and the built things
rep(`function iceBuildFlora(game_, root) {`, block + `\nfunction iceBuildFlora(game_, root) {`);
rep(`  iceBuildScatter(game, iceRoot);`,
`  iceBuildScatter(game, iceRoot);
  iceBuildCairns(game, iceRoot);
  iceBuildTurfHouses(game, iceRoot);
  iceBuildRacks(game, iceRoot);
  iceBuildColumns(game, iceRoot);
  iceBuildSheep(iceRoot);`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
