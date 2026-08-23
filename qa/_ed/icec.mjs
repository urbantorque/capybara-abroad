import fs from 'fs';
let s = fs.readFileSync('src/iceland.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`      const a = k / count * 6.28318 + ring * 0.22;
      // the seaward half only: the landward side is where the player walks up
      if (Math.sin(a) < -0.15) continue;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (z < iceSEA_Z - 26) continue;
      // stepping down to the water, and broken: a colonnade is a staircase of
      // hexagons and the tops are never level
      const h = Math.max(1.6, iceCLIFF.h * (1 - ring * 0.19) - ((k * 7) % 5) * 0.85);`,
`      const a = k / count * 6.28318 + ring * 0.22;
      // ---- THE SEAWARD QUARTER ONLY, AND NOT NINETEEN METRES TALL ---------
      // First cut: the whole half-circle at up to iceCLIFF.h (19 m), based at
      // sea level. Photographed from the old harbour — which is eighteen metres
      // away at x = 26 — that is a row of nineteen-metre black slabs standing
      // over the boats like a paling fence, and the arc reached round to within
      // a few metres of the quay. Reynisfjara's colonnade is five to twelve
      // metres and it is on the SEA side of the headland, stepping down into
      // the water; the landward side is the grass slope the player walks up to
      // the colony.
      //
      // So: the east-south-east quadrant, nothing where the ground is more than
      // two metres up (a column is a thing that stands IN the sea), and a
      // height that steps down rank by rank rather than starting at the top of
      // the cliff.
      if (Math.sin(a) < -0.10 || Math.cos(a) < 0.12) continue;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      if (z < iceSEA_Z - 24) continue;
      if (iceTerrain(x, z) > 2.0) continue;
      const h = Math.max(1.8, 10.5 - ring * 1.9 - ((k * 7) % 5) * 0.75);`);
fs.writeFileSync('src/iceland.js', s); console.log('ok');
