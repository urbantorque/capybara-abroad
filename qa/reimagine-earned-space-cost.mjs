// D5 actual steady-state visibility writer, detached DOM; not full-frame cost.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h=await openHarness();
try {
  await h.start();
  const report=await h.page.evaluate(async()=>{
    const source=await(await fetch('/src/systems.js')).text();
    const gate=source.match(/function sysMomentVisible\([^]*?\n\}/)?.[0];
    const tick=source.match(/  function momentVisibilityTick\([^]*?\n  \}/)?.[0];
    if(!gate||!tick)throw new Error('Actual earned-space functions not found');
    const game={state:{noEarnedSpace:false,perfRung:0}};
    const fixture=new Function('game',`const momentEl=document.createElement('div');
      let momentWanted=true,momentIncidental=true,momentVisible=false,
          placeEarned=true,showPlaceLast='THE OPERA HOUSE CONCERT',wowEarnedOn=false;
      ${gate};${tick};return {step:momentVisibilityTick,visible:()=>momentEl.classList.contains('show')};`)(game);
    const rows=[];
    for(const mode of ['live','flag','rung']) {
      game.state.noEarnedSpace=mode==='flag';game.state.perfRung=mode==='rung'?1:0;
      for(let i=0;i<10000;i++)fixture.step();
      const visible=fixture.visible();
      if(visible!==(mode!=='live'))throw new Error(mode+': incorrect actual visibility');
      const ms=[];
      for(let j=0;j<100;j++){const t=performance.now();for(let i=0;i<10000;i++)fixture.step();ms.push((performance.now()-t)/10000);}
      ms.sort((a,b)=>a-b);rows.push({mode,visible,calls:1010000,medianMs:ms[50],p95Ms:ms[95]});
    }
    return {scope:'Extracted actual steady-state moment visibility writer, detached DOM; incidental card during an earned title. Excludes layout, transition-event work and GPU. Batch estimates are timer-resolution limited.',rows};
  });
  await h.result('reimagine-earned-space-cost',{metadata:h.metadata,...report});
  console.log(JSON.stringify(report,null,2));
  for(const row of report.rows)if(row.mode!=='live')assert.ok(row.p95Ms<=.1,row.mode+' cut-gate budget');
  assert.deepEqual(h.metadata.errors,[]);
} finally {await h.close();}
