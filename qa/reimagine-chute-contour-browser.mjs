// E7 staged scenery views, not natural chute approach or launch physics proof.
// node qa/reimagine-chute-contour-browser.mjs v1
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHarness } from './reimagine-harness.mjs';
const require=createRequire(import.meta.url);
const {PNG}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const tag=process.argv[2]||'v1';assert.ok(/^[\w.-]+$/.test(tag));
const name='reimagine-chute-contour-'+tag,out={tag,views:[],screenshots:[],
  scope:'Staged approach/launch/reverse cameras derived from actual Kyoto chuteAt(back), frozen poses/post. No body, task or clock seed; no launch-physics claim.',
  maskScope:'Only audit indexStart/indexCount triangles are degenerated for hidden references, then original indices restored before every writer tick. Rocks and downstream foam indices stay intact. Mask includes any nonzero hidden-reference RGB delta; meaningful change >4; exact cut/restored parity tolerance0. Rung wholeframe differences are diagnostic because unrelated effects park.'};
const h=await openHarness();
try{
  await h.start();await h.arrive('kyoto');
  await h.page.waitForTimeout(1200);
  await h.page.addStyleTag({content:'[class*="capyui"]{visibility:hidden!important}*{animation-play-state:paused!important;transition:none!important}'});
  out.pin=await h.page.evaluate(async()=>{
    const g=window.__capy,T=await import('three'),shared=await import('/src/shared.js'),raw=g.tick;
    if(!g.kyoto?.chuteContourAudit)throw new Error('Chute audit unavailable');
    g.tick=()=>{};g.state.perfRung=0;g.state.noChuteContour=true;raw(0,false);
    const audit=g.kyoto.chuteContourAudit(),target=g.scene.getObjectByProperty('uuid',audit.uuid),range=audit.range;
    if(!target||audit.primitives!==6||!range||range.indexStart<0||range.indexStart%3||range.indexCount%3)
      throw new Error('Six-primitive indexed chute range unavailable');
    const geometry=target.geometry,index=geometry.index.array.slice();
    if(range.indexStart+range.indexCount>index.length)throw new Error('Chute index range exceeds geometry');
    for(let i=range.indexStart;i<range.indexStart+range.indexCount;i++)
      if(index[i]<range.start||index[i]>=range.start+range.count)throw new Error('Mask range contains non-chute vertex');
    const base={position:geometry.attributes.position.array.slice(),normal:geometry.attributes.normal.array.slice()};
    const nodes=[],materials=new Map();g.scene.updateMatrixWorld(true);
    g.scene.traverse(o=>{
      nodes.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),v:o.visible,m:o.material,geo:o.geometry,
        count:o.count,im:o.instanceMatrix?.array.slice(),ic:o.instanceColor?.array.slice()});
      for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))if(!materials.has(m))
        materials.set(m,{color:m.color?.clone(),emissive:m.emissive?.clone(),opacity:m.opacity});
    });
    const box=new T.Box3();for(let i=range.start;i<range.start+range.count;i++)
      box.expandByPoint(new T.Vector3().fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(target.matrixWorld));
    const center=box.getCenter(new T.Vector3()),views=[['approach',25,4.2],['launch',8,2.4],['reverse',-18,3.5]].map(([label,back,height])=>{
      const p=g.kyoto.chuteAt(back);if(!p)throw new Error('Actual chuteAt returned no point');
      // chuteAt's two river samples alias one scratch object; its x/z repeat
      // the upstream point. Aim at the measured crest bounds, not that alias.
      return {label,back,hook:{...p},position:[p.ux,center.y+height,p.uz],target:center.toArray()};
    });
    const originalDraw=target.onBeforeRender;
    const f={raw,T,shared,target,range,index,base,nodes,materials,views,time:g.state.time,post:{...g.post.params},
      fov:g.camera.fov,near:g.camera.near,far:g.camera.far,draws:0};
    target.onBeforeRender=function(...args){f.draws++;originalDraw.apply(this,args);};
    window.__chuteFixture=f;
    return {audit,views,bounds:{min:box.min.toArray(),max:box.max.toArray()},position:g.capy.body.position,
      time:g.state.time,geometry:{uuid:geometry.uuid,vertices:geometry.attributes.position.count,triangles:index.length/3}};
  });
  for(const view of out.pin.views){
    const frames={},states={};
    for(const variant of ['warm-before','before','live','cut','rung','restored','hidden-before','hidden-live']){
      states[variant]=await h.page.evaluate(({view,variant})=>{
        const g=window.__capy,f=window.__chuteFixture,geo=f.target.geometry,r=f.range;
        // Restore the exact original triangle list before the actual profile writer.
        geo.index.array.set(f.index);geo.index.needsUpdate=true;
        const live=['live','restored','hidden-live'].includes(variant);
        g.state.noChuteContour=!live&&variant!=='rung';g.state.perfRung=variant==='rung'?1:0;f.raw(0,false);
        const audit=g.kyoto.chuteContourAudit();
        for(const n of f.nodes){
          n.o.position.copy(n.p);n.o.quaternion.copy(n.q);n.o.scale.copy(n.s);n.o.visible=n.v;if(n.m)n.o.material=n.m;
          if(n.geo)n.o.geometry=n.geo;
          if(n.im){n.o.instanceMatrix.array.set(n.im);n.o.instanceMatrix.needsUpdate=true;n.o.count=n.count;}
          if(n.ic){n.o.instanceColor.array.set(n.ic);n.o.instanceColor.needsUpdate=true;}
        }
        for(const[m,s]of f.materials){if(s.color)m.color.copy(s.color);if(s.emissive)m.emissive.copy(s.emissive);m.opacity=s.opacity;}
        Object.assign(g.post.params,f.post);
        g.camera.position.fromArray(view.position);g.camera.fov=f.fov;g.camera.near=f.near;g.camera.far=f.far;
        g.camera.lookAt(...view.target);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);g.scene.updateMatrixWorld(true);
        f.shared.lensCapTick(0,0,0,0,0,0,0,false);
        const exact={},outside={};
        for(const key of ['position','normal']){
          const a=geo.attributes[key].array,b=f.base[key],start=r.start*3,end=(r.start+r.count)*3;
          let same=true,rest=true;for(let i=0;i<a.length;i++)if(a[i]!==b[i]){if(i>=start&&i<end)same=false;else rest=false;}
          exact[key]=same;outside[key]=rest;
        }
        const hidden=variant.startsWith('hidden');
        if(hidden){for(let i=r.indexStart;i<r.indexStart+r.indexCount;i+=3){geo.index.array[i+1]=geo.index.array[i];geo.index.array[i+2]=geo.index.array[i];}geo.index.needsUpdate=true;}
        let outsideIndicesExact=true,hiddenTriangles=0;
        for(let i=0;i<f.index.length;i++)if((i<r.indexStart||i>=r.indexStart+r.indexCount)&&geo.index.array[i]!==f.index[i])outsideIndicesExact=false;
        if(hidden)for(let i=r.indexStart;i<r.indexStart+r.indexCount;i+=3)
          if(geo.index.array[i]===geo.index.array[i+1]&&geo.index.array[i]===geo.index.array[i+2])hiddenTriangles++;
        g.renderer.shadowMap.needsUpdate=true;for(let i=0;i<3;i++)g.post.render();
        const auto=g.renderer.info.autoReset;g.renderer.info.autoReset=false;g.renderer.info.reset();f.draws=0;g.post.render();
        const render={...g.renderer.info.render,rocksColorDraws:f.draws};g.renderer.info.autoReset=auto;
        return {audit,exact,outside,outsideIndicesExact,hiddenTriangles,render,geometry:{uuid:geo.uuid,vertices:geo.attributes.position.count,triangles:geo.index.count/3},
          time:g.state.time,capRadius:0,camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray()}};
      },{view,variant});
      const row=states[variant];
      assert.equal(row.time,out.pin.time,'zero-step clock remains frozen');
      assert.ok(row.outside.position&&row.outside.normal&&row.outsideIndicesExact,'non-chute geometry unchanged');
      assert.equal(row.audit.on,['live','restored','hidden-live'].includes(variant),'actual profile gate');
      if(!row.audit.on)assert.ok(row.exact.position&&row.exact.normal,'exact inherited range fallback');
      assert.deepEqual(row.geometry,out.pin.geometry,'same geometry identity/counts');
      if(variant.startsWith('hidden'))assert.equal(row.hiddenTriangles,out.pin.audit.range.indexCount/3,'only complete foam triangles degenerated');
      if(variant==='warm-before')continue;
      const artifact=`${name}-${view.label}-${variant}`;frames[variant]=PNG.sync.read(await h.screenshot(artifact));
      out.screenshots.push(fileURLToPath(new URL('./'+artifact+'.png',import.meta.url)));
    }
    const delta=(a,b,i)=>Math.max(...[0,1,2].map(k=>Math.abs(a.data[i*4+k]-b.data[i*4+k])));
    const metrics={mask:0,changed:0,outsideMaskChanged:0,cutMismatch:0,restoreMismatch:0,rungMismatch:0};
    for(let i=0;i<frames.live.width*frames.live.height;i++){
      const mask=delta(frames.before,frames['hidden-before'],i)>0||delta(frames.live,frames['hidden-live'],i)>0;
      const changed=delta(frames.before,frames.live,i)>4;
      if(mask){metrics.mask++;if(changed)metrics.changed++;}else if(changed)metrics.outsideMaskChanged++;
      if(delta(frames.before,frames.cut,i)>0)metrics.cutMismatch++;
      if(delta(frames.live,frames.restored,i)>0)metrics.restoreMismatch++;
      if(delta(frames.before,frames.rung,i)>0)metrics.rungMismatch++;
    }
    out.views.push({view,metrics,states});
    assert.equal(metrics.cutMismatch,0,'cut pixel parity '+view.label);assert.equal(metrics.restoreMismatch,0,'restore pixel parity '+view.label);
    assert.ok(metrics.changed>0,'visible six-primitive contribution '+view.label);
    assert.equal(metrics.outsideMaskChanged,0,'changes stay inside foam contribution mask '+view.label);
    for(const key of ['calls','triangles','rocksColorDraws'])assert.equal(states.before.render[key],states.live.render[key],'unchanged '+key+' '+view.label);
  }
  assert.deepEqual(h.metadata.errors,[],'zero runtime errors');
  await h.result(name,{...out,metadata:h.metadata});
  console.log(JSON.stringify({views:out.views.map(r=>({view:r.view,metrics:r.metrics,before:r.states.before.render,live:r.states.live.render})),errors:h.metadata.errors,screenshots:out.screenshots},null,2));
}catch(error){
  out.failure=String(error.stack||error);await h.screenshot(name+'-failure');await h.result(name+'-failure',{...out,metadata:h.metadata});throw error;
}finally{await h.close();}
