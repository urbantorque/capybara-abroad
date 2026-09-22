import assert from 'node:assert/strict';
import {openHarness} from './reimagine-harness.mjs';
const touch=process.argv.includes('--touch');
const h=await openHarness({story:true,...(touch?{width:390,height:844,hasTouch:true,isMobile:true}:{})});
const out={metadata:h.metadata,checks:0};
function check(ok,label){assert(ok,label);out.checks++;}
async function replay(){
  await h.page.keyboard.press('Escape');
  const skip=h.page.getByRole('button',{name:'skip the guided walk',exact:true});
  if(await skip.isVisible()){await skip.click();await h.page.keyboard.press('Escape');}
  await h.page.getByRole('button',{name:'replay the opening',exact:true}).click();
  await h.page.waitForTimeout(300);
  check(await h.page.evaluate(()=>window.__capy.openAudit().t!==null),'replay starts');
}
try{
  // Begin itself unlocks audio. A later synthetic Shift from h.start can
  // arrive after a slow frame's opening timer and correctly skip the scene.
  const begin=h.page.locator('.capyui-go:not([data-free])').first();
  if(touch)await begin.tap();else{await begin.focus();await h.page.keyboard.press('Enter');}
  await h.page.waitForFunction(()=>window.__capy.openAudit().t!==null);
  await h.page.waitForTimeout(1000);
  check(await h.page.evaluate(()=>window.__capy.openAudit().t!==null),'fresh opening starts');
  check(await h.page.locator('.capyui-todo').evaluate(el=>getComputedStyle(el).visibility==='hidden'),'opening clears task paper');
  check(await h.page.locator('.capyui-touch').evaluate(el=>getComputedStyle(el).visibility!=='hidden'),'opening preserves touch layer');
  await h.page.waitForTimeout(5000);
  check(await h.page.evaluate(()=>window.__capy.tutAudit().beat===0),'guided walk waits for opening');
  check(!await h.page.getByText('that bar is your puff.',{exact:false}).isVisible(),'stamina lesson waits for visible bar');
  await h.screenshot('homecoming-opening-quiet-'+(touch?'touch':'desktop'));
  await h.page.keyboard.press('KeyW');
  check(await h.page.evaluate(()=>window.__capy.openAudit().t===null),'keyboard skip releases opening');
  check(await h.page.locator('.capyui-todo').evaluate(el=>getComputedStyle(el).visibility!=='hidden'),'skip restores task paper');
  await replay();await h.screenshot('homecoming-opening-replay');
  await h.page.mouse.click(1100,700);
  check(await h.page.evaluate(()=>window.__capy.openAudit().t===null),'pointer skip releases opening');
  await replay();await h.page.keyboard.press('Escape');
  check(await h.page.evaluate(()=>window.__capy.openAudit().t===null&&window.__capy.state.paused),'pause cancels opening');
  check(await h.page.getByRole('button',{name:'replay the opening',exact:true}).isVisible(),'pause offers replay immediately');
  await h.page.getByRole('button',{name:'replay the opening',exact:true}).click();
  await h.page.waitForFunction(()=>window.__capy.openAudit().t===null,null,{timeout:15000});
  check(await h.page.evaluate(()=>!window.__capy.state.paused),'timeout returns live control');
  await h.page.reload();await h.page.waitForFunction(()=>window.__capyRunning&&!!document.querySelector('.capyui-go'));
  await h.start();
  check(await h.page.evaluate(()=>window.__capy.openAudit().t===null),'restored save does not auto-replay');
  check(h.metadata.errors.length===0,'no browser errors');out.pass=true;
}catch(e){out.pass=false;out.failure=String(e.stack||e);process.exitCode=1;}
finally{await h.result('homecoming-opening-v4-'+(touch?'touch':'desktop'),out);await h.close();console.log(JSON.stringify({pass:out.pass,checks:out.checks,failure:out.failure}));}
