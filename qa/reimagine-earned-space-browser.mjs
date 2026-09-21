// D5 controlled presentation and real-clock lifetime. Completion is a fixture.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const width=Number(process.argv[2]||1280),h=await openHarness({width});
const name=`reimagine-earned-space-${width}`,rows=[];
try {
  await h.start();
  await h.page.evaluate(()=>{
    const g=window.__capy;window.__spaceTick=g.tick;g.tick=()=>{};
    const style=document.createElement('style');
    style.textContent='*{transition:none!important;animation:none!important}';document.head.appendChild(style);
    g.completeTask('opera-stage');
    g.hud.showMoment('AN INCIDENT','A generic incident.', '',true);
    window.__spaceTick.call(g,0,false);
  });
  async function sample(mode) {
    const row=await h.page.evaluate(mode=>{
      const g=window.__capy;g.state.noEarnedSpace=mode==='flag';g.state.perfRung=mode==='rung'?1:0;
      window.__spaceTick.call(g,0,false);
      const el=document.querySelector('.capyui-moment');
      return {mode,visible:el.classList.contains('show'),text:el.textContent,
        earned:document.querySelector('.capyui-place').classList.contains('show')};
    },mode);rows.push(row);return row;
  }
  assert.equal((await sample('live')).visible,false);
  assert.equal((await sample('flag')).visible,true);
  assert.equal((await sample('rung')).visible,true);
  assert.equal((await sample('restored')).visible,false);
  await h.screenshot(name+'-quiet');
  // Replacing incidental content with named/direct feedback is immediate.
  await h.page.evaluate(()=>window.__capy.hud.showMoment('A NAMED MOMENT','The named reward remains.', 'Direct feedback.'));
  assert.equal((await sample('protected')).visible,true);
  await h.screenshot(name+'-protected');
  // Real authored 2600 ms timeout continues while the incident is hidden.
  await h.page.evaluate(()=>window.__capy.hud.showMoment('AN INCIDENT','A generic incident.', '',true));
  assert.equal((await sample('hidden-timer')).visible,false);
  await h.page.waitForTimeout(2800);
  assert.equal((await sample('flag')).visible,false,'expired content cannot return on cut');
  assert.equal((await sample('rung')).visible,false,'expired content cannot return on rung');
  assert.equal((await sample('restored')).visible,false);
  await h.page.waitForTimeout(1000);
  assert.equal((await sample('expired-reward')).earned,false,'real reward timer closes');
  // Independent pixel fixture. Freeze the authored timers only in this phase.
  await h.page.addInitScript(()=>localStorage.removeItem('capy3.journey.v1'));await h.page.reload();await h.start();
  await h.page.evaluate(()=>{
    const g=window.__capy;if(g.taskDone('opera-stage'))throw new Error('Pixel fixture must start unearned');window.__spaceTick=g.tick;g.tick=()=>{};
    const style=document.createElement('style');style.textContent='*{transition:none!important;animation:none!important}canvas,#hud > :not(.capyui-moment){opacity:0!important}';document.head.appendChild(style);
    const later=window.setTimeout,held=[];
    window.setTimeout=function(fn,ms,...args){const id=later(fn,ms,...args);if(ms===2600||ms===3600)held.push(id);return id;};
    try {g.completeTask('opera-stage');g.hud.showMoment('AN INCIDENT','A generic incident.', '',true);}
    finally {window.setTimeout=later;for(const id of held)clearTimeout(id);}
  });
  const cdp=await h.context.newCDPSession(h.page),images={};
  for(const mode of ['flag','live','rung','restored']) {
    await sample(mode);
    await cdp.send('Page.captureScreenshot',{format:'png'});
    images[mode]=(await cdp.send('Page.captureScreenshot',{format:'png'})).data;
  }
  const comparison=await h.page.evaluate(async images=>{
    const pixels={};let w=0,hh=0;
    for(const [key,data] of Object.entries(images)) {
      const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
      const bmp=await createImageBitmap(new Blob([bytes],{type:'image/png'}));w=bmp.width;hh=bmp.height;
      const c=document.createElement('canvas');c.width=w;c.height=hh;const ctx=c.getContext('2d');ctx.drawImage(bmp,0,0);pixels[key]=ctx.getImageData(0,0,w,hh).data;
    }
    const r=document.querySelector('.capyui-moment').getBoundingClientRect();
    const diff=(a,b)=>{let changed=0,outside=0;for(let i=0;i<a.length;i+=4){if(a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2])continue;changed++;
      const x=(i/4%w+.5)*innerWidth/w,y=(Math.floor(i/4/w)+.5)*innerHeight/hh;
      // Inherited shadow includes a 46px blur displaced 20px downwards.
      if(x<r.left-96||x>r.right+96||y<r.top-96||y>r.bottom+96)outside++;}return{changed,outside};};
    return {live:diff(pixels.flag,pixels.live),rung:diff(pixels.flag,pixels.rung),restored:diff(pixels.live,pixels.restored),imageWidth:w,imageHeight:hh};
  },images);
  console.log(JSON.stringify({comparison}));
  assert.ok(comparison.live.changed>100);assert.equal(comparison.live.outside,0);
  assert.equal(comparison.rung.changed,0);assert.equal(comparison.restored.changed,0);
  assert.deepEqual(h.metadata.errors,[]);
  await h.result(name,{metadata:h.metadata,rows,comparison,scope:'Controlled completion: real timeout first, separate held-timer pixel fixture second, world canvas and other HUD layers hidden for numeric comparison. Incident bounds plus 96px inherited-shadow mask; not a natural-play reward claim.'});
  console.log(JSON.stringify({width,rows,comparison,errors:h.metadata.errors}));
} catch(error) {
  await h.result(name+'-failure',{metadata:h.metadata,rows,error:String(error.stack||error)});
  throw error;
} finally {await h.close();}
