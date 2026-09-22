// Task injection isolates the return UI. Not earned-play or novice evidence.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness({story:true,...(touch?{width:390,height:844,hasTouch:true,isMobile:true}:{})});
const out = {metadata:h.metadata,touch,fixture:'injected coastal tasks; real journal click',checks:0};
function check(ok,label) { assert(ok,label); out.checks++; }
try {
  await h.start();
  await h.page.evaluate(()=>['steal-hat','picnic-thief'].forEach(id=>window.__capy.completeTask(id,true)));
  await h.arrive('quay');
  await h.page.evaluate(()=>['under-bridge','take-helm'].forEach(id=>window.__capy.completeTask(id,true)));
  await h.page.keyboard.press('Tab');
  const card=h.page.locator('.capyui-homevisit'), button=card.locator('button');
  check(await card.isVisible(),'invitation in journal');
  await button.scrollIntoViewIfNeeded();
  const box=await button.boundingBox();
  check(box.height>=44 && box.x>=0 && box.x+box.width<=(touch?390:1280),'touch target fits');
  await h.screenshot('homecoming-home-visit-'+(touch?'touch':'desktop'));
  await button.focus(); await h.page.keyboard.press('Enter');
  await h.page.waitForFunction(()=>window.__capy.biome.current==='sydney',null,{timeout:45000});
  await h.page.waitForTimeout(9500);
  out.shelf=await h.page.evaluate(()=>{
    const g=window.__capy;
    return {...g.shelfAudit(),props:g.props.filter(p=>!p.removed&&['sydney','quay'].includes(p.keep)).map(p=>({keep:p.keep,x:p.homeX,y:p.homeY,z:p.homeZ}))};
  });
  check(out.shelf.shelf===2,'two memories staged');
  check(out.shelf.props.length===2,'two physical keepsakes');
  for(const p of out.shelf.props) check(out.shelf.slots.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<.01&&Math.abs(s.y-p.y)<.01),'prop staged on shelf slot');
  await h.page.keyboard.press('Tab'); check(!await card.isVisible(),'no invitation while home');
  await h.page.keyboard.press('Escape');
  await h.arrive('quay'); await h.page.keyboard.press('Tab');
  check(!await card.isVisible(),'staged memories do not repeat invitation');
  check(await h.page.evaluate(()=>window.__capy.gateInfo().filter(r=>r.open).map(r=>r.n).join(',')==='1,2,3,5,6,14,15'),'onward routes remain open');
  check(h.metadata.errors.length===0,'no browser errors'); out.pass=true;
} catch(e) { out.pass=false;out.failure=String(e.stack||e);process.exitCode=1; }
finally { await h.result('homecoming-home-visit-v1-'+(touch?'touch':'desktop'),out); await h.close(); console.log(JSON.stringify(out)); }
