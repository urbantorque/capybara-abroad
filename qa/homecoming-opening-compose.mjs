// Pinned compositor A/B: only the opening's named paper can change pixels.
import assert from 'node:assert/strict';
import {openHarness} from './reimagine-harness.mjs';
const h=await openHarness({story:true}),out={metadata:h.metadata};
try{
  const begin=h.page.locator('.capyui-go:not([data-free])').first();
  await begin.focus();await h.page.keyboard.press('Enter');
  await h.page.waitForFunction(()=>window.__capy.openAudit().t!==null);
  await h.page.waitForTimeout(1200);
  out.mask=await h.page.evaluate(()=>{
    const g=window.__capy,root=document.getElementById('hud');
    window.__openingRender=g.tick;g.tick=()=>{};
    const style=document.createElement('style');style.id='opening-metric';
    style.textContent='*{animation:none!important;transition:none!important}';document.head.appendChild(style);
    root.classList.remove('opening-quiet');
    return [...root.querySelectorAll('.capyui-todo,.capyui-map,.capyui-maplegend,.capyui-wallet,.capyui-item,.capyui-stam,.capyui-stamlbl,.capyui-pips,.capyui-place,.capyui-moment,.capyui-home,.capyui-fly,.capyui-perf')].filter(el=>{
      const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0;
    }).map(el=>{const r=el.getBoundingClientRect();return{x:r.x-24,y:r.y-24,right:r.right+24,bottom:r.bottom+24};});
  });
  const cdp=await h.context.newCDPSession(h.page),images={};
  for(const [label,quiet] of [['paper',false],['quiet',true],['restored',false]]){
    await h.page.evaluate(async quiet=>{
      document.getElementById('hud').classList.toggle('opening-quiet',quiet);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    },quiet);
    images[label]=(await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data;
    await h.page.evaluate(async({label,data})=>{
      const r=await fetch('/shot?name=homecoming-opening-compose-'+label,{method:'POST',body:data});
      if(!r.ok)throw Error('shot sink failed');
    },{label,data:images[label]});
  }
  assert(await h.page.evaluate(()=>window.__capy.openAudit().t!==null),'opening did not expire during capture');
  out.diff=await h.page.evaluate(async({images,mask})=>{
    const pixels={};let width=0,height=0;
    for(const [key,data] of Object.entries(images)){
      const bmp=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/png'}));
      const canvas=document.createElement('canvas');canvas.width=width=bmp.width;canvas.height=height=bmp.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(bmp,0,0);pixels[key]=ctx.getImageData(0,0,width,bmp.height).data;bmp.close();
    }
    let changed=0,outside=0,restored=0;
    for(let i=0;i<pixels.paper.length;i+=4){
      const different=(a,b)=>a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2];
      if(different(pixels.paper,pixels.quiet)){
        changed++;const x=((i/4)%width+.5)*innerWidth/width,y=(Math.floor(i/4/width)+.5)*innerHeight/height;
        if(!mask.some(r=>x>=r.x&&x<=r.right&&y>=r.y&&y<=r.bottom))outside++;
      }
      if(different(pixels.paper,pixels.restored))restored++;
    }
    return{changed,outside,restored};
  },{images,mask:out.mask});
  assert(out.diff.changed>1000);assert.equal(out.diff.outside,0);assert.equal(out.diff.restored,0);
  assert.equal(h.metadata.errors.length,0);out.pass=true;
}catch(e){out.pass=false;out.failure=String(e.stack||e);process.exitCode=1;}
finally{
  try{await h.page.evaluate(()=>{if(window.__openingRender)window.__capy.tick=window.__openingRender;document.getElementById('opening-metric')?.remove();document.getElementById('hud').classList.toggle('opening-quiet',window.__capy.openAudit().t!==null);});}catch{}
  await h.result('homecoming-opening-compose-v2',out);await h.close();console.log(JSON.stringify(out.diff||out.failure));
}
