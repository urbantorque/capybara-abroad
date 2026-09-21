// D4 presentation fixture: actual reward path, held card timer and frozen scene.
// This deliberately seeds a completion; natural concert coverage is separate.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const width = Number(process.argv[2] || 1280);
const height = width === 640 ? 390 : 760;
assert.ok([1280, 640, 390, 320].includes(width));
const h = await openHarness({ width, height });
const name = `reimagine-earned-card-${width}`, rows = [], images = {};
const cdp = await h.context.newCDPSession(h.page);
async function capture(suffix) {
  // Capture the compositor without advancing the explicitly frozen world.
  const {data} = await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  if (suffix) await h.page.evaluate(async ({name,data})=>{
    const r=await fetch('/shot?name='+encodeURIComponent(name),{method:'POST',body:data});
    if(!r.ok)throw new Error('screenshot sink '+r.status);
  },{name:name+'-'+suffix,data});
  return Buffer.from(data,'base64');
}
try {
  await h.start();
  await h.page.evaluate(() => {
    const g = window.__capy;
    window.__earnedRawTick = g.tick; g.tick = () => {};
    const style = document.createElement('style'); style.textContent = '*{transition:none!important;animation:none!important}';
    document.head.appendChild(style);
    const later=window.setTimeout,held=[];
    window.setTimeout=function(fn,ms,...args){const id=later(fn,ms,...args);if(ms===3600)held.push({id,fn,ms});return id;};
    try {g.completeTask('opera-stage');} finally {window.setTimeout=later;}
    for(const timer of held)clearTimeout(timer.id);
    window.__earnedTimers=held;
    window.__earnedRawTick.call(g, 0, false);
  });
  async function shot(mode) {
    await h.page.evaluate(mode => {
      const g = window.__capy;
      g.state.noEarnedCard = mode === 'cut' || mode === 'legacy';
      g.state.perfRung = mode === 'rung' ? 1 : 0;
      window.__earnedRawTick.call(g, 0, false);
    }, mode);
    const row = await h.page.evaluate(mode => {
      const el = document.querySelector('.capyui-place'), title = el.querySelector('h2');
      const r = el.getBoundingClientRect(), h = title.getBoundingClientRect();
      const sub = el.querySelector('.capyui-placesub');
      return { mode, classes: el.className, title: title.textContent, subtitle: sub.textContent,
        subtitleDisplay: getComputedStyle(sub).display, font: getComputedStyle(title).fontSize,
        rect: { x:r.x, y:r.y, right:r.right, bottom:r.bottom, area:r.width*r.height },
        titleFits: h.x>=0 && h.y>=0 && h.right<=innerWidth && h.bottom<=innerHeight && title.scrollWidth<=title.clientWidth+1 };
    }, mode);
    rows.push(row); await capture(); await capture(mode);
    await h.page.evaluate(() => {
      const style = document.createElement('style'); style.id='earned-metric';
      style.textContent='#hud > :not(.capyui-place){opacity:0!important}'; document.head.appendChild(style);
    });
    await capture();
    images[mode] = (await capture()).toString('base64');
    await h.page.evaluate(() => document.getElementById('earned-metric').remove());
    return row;
  }
  const old = await shot('legacy'), live = await shot('live');
  await shot('cut'); await shot('rung'); await shot('restored');
  assert.ok(live.classes.includes('earned-card') && !old.classes.includes('earned-card'));
  assert.equal(live.subtitle, old.subtitle, 'stored inherited instruction remains');
  assert.equal(live.subtitleDisplay, 'none');
  assert.ok(live.titleFits && parseFloat(live.font)>=18, 'legible untruncated title');
  assert.ok(live.rect.area < old.rect.area*.5, 'reward footprint less than half inherited');
  const comparison = await h.page.evaluate(async ({images,mask,width,height}) => {
    const pixels = {};let imageWidth=0,imageHeight=0;
    for (const [key, value] of Object.entries(images)) {
      const bytes = Uint8Array.from(atob(value), c=>c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes],{type:'image/png'}));
      imageWidth=bitmap.width;imageHeight=bitmap.height;
      const canvas = document.createElement('canvas'); canvas.width=bitmap.width;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);pixels[key]=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    }
    const different=(a,b)=>{let n=0,outside=0,maxDelta=0;const first=[];
      for(let i=0;i<a.length;i+=4) {
        const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
        if(!d)continue;n++;maxDelta=Math.max(maxDelta,d);
        const x=((i/4)%imageWidth+.5)*width/imageWidth,y=(Math.floor(i/4/imageWidth)+.5)*height/imageHeight;
        if(!mask.some(r=>x>=r.x&&x<=r.right&&y>=r.y&&y<=r.bottom))outside++;
        if(first.length<5)first.push({x,y,d});
      }return {n,outside,maxDelta,first};};
    return { live:different(pixels.legacy,pixels.live), cut:different(pixels.legacy,pixels.cut),
      rung:different(pixels.legacy,pixels.rung), restored:different(pixels.live,pixels.restored), imageWidth,imageHeight };
  }, {images,mask:[old.rect,live.rect],width,height});
  await h.result(name,{metadata:h.metadata,rows,comparison});
  console.log(JSON.stringify({width,height,areaRatio:live.rect.area/old.rect.area,
    pixels:Object.fromEntries(['live','cut','rung','restored'].map(k=>[k,{n:comparison[k].n,outside:comparison[k].outside,maxDelta:comparison[k].maxDelta}]))},null,2));
  assert.ok(comparison.live.n>100);assert.equal(comparison.live.outside,0);
  assert.equal(comparison.cut.n,0);assert.equal(comparison.rung.n,0);assert.equal(comparison.restored.n,0);
  // Layout-only variants use every authored title, not invented long strings.
  const titles=await h.page.evaluate(async()=>{
    const {TASKS}=await import('/src/shared.js'),el=document.querySelector('.capyui-place'),h=el.querySelector('h2'),old=h.textContent;
    const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const rows=[];
    for(const title of new Set(TASKS.map(x=>x.wow).filter(x=>typeof x==='string'))) {
      h.textContent=title;const r=el.getBoundingClientRect(),t=h.getBoundingClientRect();
      rows.push({title,font:parseFloat(getComputedStyle(h).fontSize),
        fits:t.x>=0&&t.y>=0&&t.right<=innerWidth&&t.bottom<=innerHeight&&h.scrollWidth<=h.clientWidth+1,
        walletOverlap:overlap(r,document.querySelector('.capyui-wallet').getBoundingClientRect()),
        paperOverlap:overlap(r,document.querySelector('.capyui-todo').getBoundingClientRect())});
    }
    h.textContent=old;return rows;
  });
  for(const title of titles){assert.ok(title.fits&&title.font>=18,title.title+' readable');assert.equal(title.walletOverlap,0);assert.equal(title.paperOverlap,0);}
  // Invoke the captured authored timer, not a replacement close implementation.
  assert.ok(await h.page.evaluate(()=>window.__earnedTimers.length>0));
  await h.page.evaluate(()=>{for(const timer of window.__earnedTimers)timer.fn();});
  assert.equal(await h.page.evaluate(()=>document.querySelector('.capyui-place').classList.contains('show')),false);
  await h.result(name, { metadata:h.metadata, rows, comparison,titles,
    scope:'Controlled completion, held authored card timer, frozen world and banner-only pixel comparison; natural timing/reward and protected-guide screenshots are separate.' });
  assert.deepEqual(h.metadata.errors,[]);
  console.log(JSON.stringify({width,height,titles:titles.length,errors:h.metadata.errors}));
} catch(error) {
  console.error(String(error.stack||error));
  await h.result(name+'-failure',{metadata:h.metadata,rows,error:String(error.stack||error)});
  try { await capture('failure'); } catch {}
  throw error;
} finally {await h.close();}
