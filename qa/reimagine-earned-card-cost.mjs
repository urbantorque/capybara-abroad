// D4 actual steady-state class writer in a hardware browser, not full-frame cost.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h=await openHarness();
try {
  await h.start();
  const report=await h.page.evaluate(async()=>{
    const source=await(await fetch('/src/systems.js')).text();
    const gate=source.match(/function sysEarnedCardLive\([^]*?\n\}/)[0];
    const tick=source.match(/  function placeEarnedTick\([^]*?\n  \}/)[0];
    const game={state:{noEarnedCard:false,perfRung:0}};
    const step=new Function('game',`const placeEl=document.createElement('div'),marqNameEl=document.createElement('div');
      let placeEarned=true,placeEarnedOn=false,placeEarnedDuplicate=false,placeEarnedTitle='THE OPERA HOUSE CONCERT',wowEarnedOn=false;
      ${gate};${tick};return placeEarnedTick;`)(game);
    const rows=[];
    for(const mode of ['live','flag','rung']) {
      game.state.noEarnedCard=mode==='flag';game.state.perfRung=mode==='rung'?1:0;
      for(let i=0;i<10000;i++)step();
      const ms=[];
      for(let j=0;j<100;j++){const t=performance.now();for(let i=0;i<10000;i++)step();ms.push((performance.now()-t)/10000);}
      ms.sort((a,b)=>a-b);rows.push({mode,calls:1010000,medianMs:ms[50],p95Ms:ms[95]});
    }
    return {scope:'Extracted actual steady-state card class writer, detached DOM; excludes layout, transition-event work and GPU.',rows};
  });
  await h.result('reimagine-earned-card-cost',{metadata:h.metadata,...report});
  console.log(JSON.stringify(report,null,2));
  for(const row of report.rows)if(row.mode!=='live')assert.ok(row.p95Ms<=.1);
  assert.deepEqual(h.metadata.errors,[]);
} finally {await h.close();}
