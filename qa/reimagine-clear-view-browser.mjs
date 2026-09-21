// E5: pinned real scene and an explicitly controlled foreground-plane fixture.
// node qa/reimagine-clear-view-browser.mjs quay v2
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'quay';
assert.ok(CHAPTERS.includes(chapter), 'known chapter');
const candidate = process.argv[3] || 'v1';
assert.ok(/^[\w.-]+$/.test(candidate), 'candidate artifact tag');
const name = 'reimagine-clear-view-' + chapter + '-' + candidate;
const out = { chapter, candidate, lifecycle: [], screenshots: [], comparisons: {},
  maskCaveat: 'Metrics hide capyui DOM so timeout-driven pills cannot pollute frozen-scene comparisons; presentation PNGs retain it. Foreground is off-versus-hidden-reference RGB delta >2, not exact geometry segmentation. FarField means its complement, not proven distant world: matching colours, post filtering and other capsule-affected objects can cross this mask.',
  scope: 'Natural arrival-area keys, then frozen scene/camera/clock. Hidden-object reference is diagnostic; controlled plane supplies a known blocker, with an inferred post-render difference mask. No complete-chapter claim.' };
const h = await openHarness();
const images = {};
async function shot(suffix) {
  await h.screenshot(name + '-' + suffix);
  out.screenshots.push(fileURLToPath(new URL('./' + name + '-' + suffix + '.png', import.meta.url)));
  await h.page.evaluate(() => {
    const style=document.createElement('style');style.id='clear-view-metric-ui';
    style.textContent='[class*="capyui"]{visibility:hidden!important}';document.head.appendChild(style);
  });
  try { images[suffix]=(await h.page.screenshot()).toString('base64'); }
  finally { await h.page.evaluate(()=>document.getElementById('clear-view-metric-ui')?.remove()); }
}
try {
  await h.page.evaluate(async () => {
    window.__clearShared = await import('/src/shared.js');
    window.__clearThree = await import('three');
    window.__clearKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__clearKeys.push({ type, code: e.code, trusted: e.isTrusted }));
  });
  await h.start(); await h.arrive(chapter);
  await h.hold('z', 350); await h.page.waitForTimeout(1800);
  await h.hold('w', 650); await h.page.waitForTimeout(2000);
  // Capture the natural viewpoint before any lifecycle or fixture intervention.
  out.pinned = await h.page.evaluate(() => {
    const g = window.__capy, T = window.__clearThree, s = window.__clearShared;
    const info = s.lensCapInfo();
    window.__clearPin = { a: info.a.toArray(), b: info.b.toArray(), r: info.r,
      position: g.camera.position.clone(), quaternion: g.camera.quaternion.clone(),
      time: g.state.time, tick: g.tick };
    g.tick = () => {};
    const style = document.createElement('style');
    style.textContent = '*{animation-play-state:paused!important;transition:none!important}';
    document.head.appendChild(style);
    g.scene.updateMatrixWorld(true); g.camera.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(g.capy.group), pts = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new T.Vector3(x, y, z).project(g.camera);
        pts.push([(p.x + 1) * innerWidth / 2, (1 - p.y) * innerHeight / 2]);
      }
    const bbox = { x0: Math.max(0, Math.floor(Math.min(...pts.map(p => p[0])))),
      y0: Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])))),
      x1: Math.min(innerWidth, Math.ceil(Math.max(...pts.map(p => p[0])))),
      y1: Math.min(innerHeight, Math.ceil(Math.max(...pts.map(p => p[1])))) };
    const ray = new T.Raycaster(), chest = new T.Vector3(...window.__clearPin.b), hits = new Map();
    const visible = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const self = o => { for (; o; o = o.parent) if (o === g.capy.group) return true; return false; };
    for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 7; ix++) {
      const x = bbox.x0 + (ix + .5) / 7 * (bbox.x1 - bbox.x0);
      const y = bbox.y0 + (iy + .5) / 7 * (bbox.y1 - bbox.y0);
      ray.setFromCamera(new T.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), g.camera);
      const max = chest.distanceTo(g.camera.position) - .9;
      for (const hit of ray.intersectObjects(g.scene.children, true)) {
        if (hit.distance >= max) break;
        if (!visible(hit.object) || self(hit.object)) continue;
        const m = hit.object.material;
        if (!m || (Array.isArray(m) ? m : [m]).every(v => v.transparent || v.opacity < 1)) continue;
        let row = hits.get(hit.object.id);
        if (!row) { row = { object: hit.object, instances: new Set() }; hits.set(hit.object.id, row); }
        if (hit.instanceId !== undefined) row.instances.add(hit.instanceId);
        break;
      }
    }
    window.__clearOccluders = [...hits.values()];
    return { camera: { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray(), fov: g.camera.fov },
      time: g.state.time, capy: g.capy.body.position, lens: { a: info.a.toArray(), b: info.b.toArray(), r: info.r, clearView: info.clearView }, bbox,
      occluders: [...hits.values()].map(({ object:o, instances }) => ({ id:o.id, uuid:o.uuid, type:o.type,
        name:o.name, instanced:!!o.isInstancedMesh, instanceIds:[...instances], wholeObjectHidden:true })),
      referenceLimitation: 'CPU ray hits ignore shader discard and identify coarse visible opaque objects. Whole selected meshes are hidden, including every instance; reference can remove unrelated far geometry.' };
  });
  async function variant(label, { live = false, off = false, hide = false, fixture = false, radiusScale = 1 } = {}) {
    await h.page.evaluate(({ live, off, hide, fixture, radiusScale }) => {
      const g = window.__capy, s = window.__clearShared, p = window.__clearPin;
      g.camera.position.copy(p.position); g.camera.quaternion.copy(p.quaternion);
      g.camera.updateMatrixWorld(true); g.state.time = p.time;
      for (const row of window.__clearOccluders) row.object.visible = !hide;
      if (window.__clearPlane) window.__clearPlane.visible = fixture;
      s.lensCapTick(...p.a, ...p.b, off ? 0 : p.r * radiusScale, live);
      g.renderer.shadowMap.needsUpdate = true;
      for (let i=0;i<3;i++) g.post.render();
    }, { live, off, hide, fixture, radiusScale });
    await shot(label);
  }
  await variant('natural-inherited');
  await variant('natural-live', { live:true });
  await variant('natural-wide15', { live:true, radiusScale:1.15 });
  await variant('natural-wide30', { live:true, radiusScale:1.30 });
  await variant('natural-cut');
  await variant('natural-off', { off:true });
  await variant('natural-reference', { off:true, hide:true });
  await variant('natural-restored', { live:true });
  // Same camera, opaque world material, no collision or shadow side effects.
  out.fixture = await h.page.evaluate(() => {
    const T = window.__clearThree, s = window.__clearShared, g = window.__capy, p = window.__clearPin;
    const a = new T.Vector3(...p.a), b = new T.Vector3(...p.b), center = a.clone().lerp(b, .5);
    const plane = new T.Mesh(new T.PlaneGeometry(p.r * 4, p.r * 4), s.mat(s.PALETTE.grassDark, { side:T.DoubleSide }));
    plane.name = 'QA-only foreground plane'; plane.position.copy(center); plane.lookAt(a);
    plane.castShadow = false; plane.receiveShadow = false; plane.visible = false;
    g.scene.add(plane); window.__clearPlane = plane;
    return { id:plane.id, name:plane.name, palette:'grassDark', width:p.r*4, height:p.r*4, axialT:.5,
      castShadow:false, note:'Controlled opaque plane, not authored scenery. Foreground mask is actual off/reference screenshot difference.' };
  });
  await variant('fixture-reference', { off:true, hide:true });
  await variant('fixture-off', { off:true, fixture:true, hide:true });
  await variant('fixture-inherited', { fixture:true, hide:true });
  await variant('fixture-live', { live:true, fixture:true, hide:true });
  await variant('fixture-wide15', { live:true, fixture:true, hide:true, radiusScale:1.15 });
  await variant('fixture-wide30', { live:true, fixture:true, hide:true, radiusScale:1.30 });
  await variant('fixture-cut', { fixture:true, hide:true });
  await variant('fixture-restored', { live:true, fixture:true, hide:true });
  out.comparisons = await h.page.evaluate(async ({ images, bbox }) => {
    const data = {};
    for (const [name, base64] of Object.entries(images)) {
      const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
      const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
      const ctx=c.getContext('2d'); ctx.drawImage(img,0,0); data[name]=ctx.getImageData(0,0,c.width,c.height).data;
    }
    const w=innerWidth, h=innerHeight, delta=(a,b,i)=>Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])));
    const result={};
    for (const scope of ['natural','fixture']) {
      const ref=data[scope+'-reference'], opaque=data[scope+'-off'], inherited=data[scope+'-inherited'], live=data[scope+'-live'];
      const sums={capyBox:{n:0,changed:0,oldError:0,newError:0},foreground:{n:0,changed:0,oldError:0,newError:0},farField:{n:0,changed:0,oldError:0,newError:0}};
      let cutMismatch=0,restoreMismatch=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
        const i=(y*w+x)*4, foreground=delta(opaque,ref,i)>2;
        const masks=[x>=bbox.x0&&x<bbox.x1&&y>=bbox.y0&&y<bbox.y1?'capyBox':null,foreground?'foreground':'farField'].filter(Boolean);
        for(const key of masks) { const r=sums[key]; r.n++; r.changed+=delta(inherited,live,i)>2?1:0;
          r.oldError+=delta(inherited,ref,i);r.newError+=delta(live,ref,i); }
        cutMismatch+=delta(inherited,data[scope+'-cut'],i)>0?1:0;
        restoreMismatch+=delta(live,data[scope+'-restored'],i)>0?1:0;
      }
      for(const r of Object.values(sums)){r.oldMeanError=r.oldError/(r.n||1);r.newMeanError=r.newError/(r.n||1);delete r.oldError;delete r.newError;}
      result[scope]={...sums,cutMismatch,restoreMismatch};
    }
    return result;
  }, { images, bbox:out.pinned.bbox });
  // Resume the real writer; these checks do not use the direct pinned writer.
  await h.page.evaluate(() => {
    const g=window.__capy;
    window.__clearPlane.visible=false;
    for(const row of window.__clearOccluders) row.object.visible=true;
    g.tick=window.__clearPin.tick;
  });
  for(const mode of ['live','cut','rung1','restored','lens-off']) {
    await h.page.evaluate(mode=>{
      const s=window.__capy.state;s.noClearView=mode==='cut';s.perfRung=mode==='rung1'?1:0;s.noLensCap=mode==='lens-off';
    },mode);
    await h.page.waitForTimeout(180);
    const row=await h.page.evaluate(mode=>{const i=window.__clearShared.lensCapInfo();return {mode,r:i.r,clearView:i.clearView,hidden:document.hidden,paused:window.__capy.state.paused};},mode);
    out.lifecycle.push(row);
    assert.equal(row.clearView, !['cut','rung1'].includes(mode),mode+' writer clarity');
    assert.equal(row.r,mode==='lens-off'?0:out.pinned.lens.r,mode+' writer radius');
  }
  await h.page.evaluate(()=>{window.__capy.state.noLensCap=false;});
  await h.page.keyboard.press('k'); await h.page.waitForTimeout(700);
  const photo=await h.page.evaluate(()=>({mode:'photo',r:window.__clearShared.lensCapInfo().r,photo:window.__capy.hud.photoAudit()}));
  out.lifecycle.push(photo);assert.equal(photo.r,0,'photo composition exempt');
  await h.page.keyboard.press('k');await h.page.waitForTimeout(700);
  out.keys=await h.page.evaluate(()=>window.__clearKeys);
  assert.ok(out.keys.every(k=>k.trusted),'trusted natural keys');
  assert.deepEqual(h.metadata.errors,[],'zero runtime errors');
  for(const r of Object.values(out.comparisons)){assert.equal(r.cutMismatch,0,'pinned cut exact');assert.equal(r.restoreMismatch,0,'pinned restore exact');}
  await h.result(name,{...out,metadata:h.metadata});
  console.log(JSON.stringify({chapter,pinned:out.pinned,comparisons:out.comparisons,lifecycle:out.lifecycle,errors:h.metadata.errors,screenshots:out.screenshots},null,2));
} catch(error) {
  out.failure=String(error.stack||error);
  await h.screenshot(name+'-failure');await h.result(name+'-failure',{...out,metadata:h.metadata});throw error;
} finally { await h.close(); }
