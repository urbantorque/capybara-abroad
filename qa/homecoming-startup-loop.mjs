// Fresh visible Chrome/Edge starts, one browser at a time. Diagnostic only.
import assert from 'node:assert/strict';
import {openHarness} from './reimagine-harness.mjs';

const url=process.argv[2]||'http://localhost:5188/dist/untitled-capybara-game.html';
const tag=process.argv[3]||'startup-loop';
const count=Number(process.argv[4]||6);
const clickMode=process.argv[5]||'evaluated';
assert.match(tag,/^[\w-]+$/);
assert(Number.isInteger(count)&&count>=1&&count<=12);
assert(['evaluated','pointer'].includes(clickMode));
const report={url,tag,count,clickMode,runs:[]};
async function flush(){
  const r=await fetch('http://localhost:5188/shot?name='+tag+'.json',{
    method:'POST',body:Buffer.from(JSON.stringify(report,null,2)).toString('base64')});
  assert.equal(r.status,200,'local QA sink');
}
for(let i=0;i<count;i++){
  let h=null;const row={n:i+1,stages:[],at:new Date().toISOString()};
  report.runs.push(row);
  try{
    h=await openHarness({url,pinRung:false});
    row.channel=h.metadata.channel;row.browser=h.metadata.browser;
    const mark=async stage=>{
      const s=await h.page.evaluate(()=>{const g=window.__capy;
        return{started:!!g.state.started,chapter:g.biome.current,rung:g.state.perfRung,
          error:g.state.lastError||null,geometries:g.renderer.info.memory.geometries,
          textures:g.renderer.info.memory.textures,programs:g.renderer.info.programs?.length||0,
          heap:performance.memory?.usedJSHeapSize||null};});
      row.stages.push({stage,at:new Date().toISOString(),...s});
    };
    await mark('game-ready');
    if(clickMode==='evaluated')await h.page.evaluate(()=>{
      const carry=document.querySelector('.capyui-carry');
      const free=document.querySelector('.capyui-go[data-free]');
      if(!carry&&free){free.click();document.querySelector('.capyui-pick.hero').click();}
      else (carry||document.querySelector('.capyui-go')).click();
    });
    else{
      const carry=h.page.locator('.capyui-carry');
      if(await carry.count())await carry.click();
      else await h.page.locator('.capyui-go').first().click();
    }
    await h.page.waitForFunction(()=>window.__capy.state.started===true);
    await mark('title-started');
    await h.hold('Shift',30);
    await mark('trusted-input');
    await h.page.waitForTimeout(250);
    await mark('first-quarter-second');
    await h.page.waitForTimeout(1200);
    await mark('settled');
    row.pass=true;
  }catch(e){row.pass=false;row.failure=String(e.stack||e);}
  finally{
    if(h){row.errors=h.metadata.errors.slice();row.requests=h.metadata.requests.slice();
      row.startup=h.metadata.startup.slice();await h.close();}
    await flush();
    console.log(JSON.stringify({run:row.n,pass:row.pass,last:row.stages.at(-1)?.stage,
      errors:row.errors,failure:row.failure?.split('\n')[0]}));
  }
}
report.passes=report.runs.filter(r=>r.pass).length;
report.crashes=report.runs.filter(r=>r.errors?.some(e=>e.kind==='crash'||e.kind==='targetcrashed')).length;
await flush();
console.log(JSON.stringify({passes:report.passes,crashes:report.crashes,count}));
