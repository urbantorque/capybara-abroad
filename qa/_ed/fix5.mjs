import fs from 'fs';
let s = fs.readFileSync('src/drift.js', 'utf8');
function rep(a,b){const n=s.split(a).length-1;if(n!==1){console.error('FAIL('+n+'): '+a.slice(0,60));process.exit(1)}s=s.replace(a,()=>b)}
rep(`  // and the birds notice, which is what a real turn of the wind looks like —
  // a stir, not a flush. driRoostUp is the flush; this only nudges the settle
  // clock so the colony shuffles.
  if (driRoostSettle < 90) driRoostSettle = Math.min(driRoostSettle, 4.5);`,
`  // ---- AND THE BIRDS NOTICE ---------------------------------------------
  // A stir, not a flush. The first cut of this only wound driRoostSettle back,
  // which does nothing at all: driUpdateRoost recomputes driRoostUp INSIDE
  // \`if (driRoostUp > 0)\`, so once the colony has settled that whole block is
  // dead and the settle clock is never read again. The flush amplitude is the
  // live variable and it has to be the one that is written.
  //
  // 0.30 with the clock at 4.6 puts every bird up about half a metre and back
  // down inside a second and a half — a shuffle along the stone, which is what
  // eleven birds actually do when the wind goes round, and nothing like the
  // full wheel a wheek buys.
  if (driRoostUp < 0.30) { driRoostUp = 0.30; driRoostSettle = 4.6; }`);
fs.writeFileSync('src/drift.js', s); console.log('ok');
