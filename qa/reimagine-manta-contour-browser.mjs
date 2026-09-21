// E8: controlled frozen manta views. Natural ride acceptance is separate.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openHarness } from './reimagine-harness.mjs';
const require=createRequire(import.meta.url);
const {PNG}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const tag=process.argv[2]||'v1';assert.match(tag,/^[\w.-]+$/);
const anatomy=process.argv.includes('--anatomy');
const name='reimagine-manta-'+(anatomy?'anatomy':'contour')+'-'+tag,h=await openHarness();
const out={views:[],scope:'Frozen production poses of both mantas, staged local cameras. Whole-manta hide mask includes smooth lighting, body details and shadows. Aperture/contact pool cleared equally; no natural ride or full-game cost claim.'};
out.comparison=anatomy?'Accepted E8 contour versus E9 anatomy; rung restores original animal.':'Original animal versus E8 contour; E9 explicitly cut.';
try{
  await h.start();await h.arrive('palawan');
  await h.page.addStyleTag({content:'[class*="capyui"]{visibility:hidden!important}*{animation-play-state:paused!important;transition:none!important}'});
  out.pin=await h.page.evaluate(async(anatomy)=>{
    const g=window.__capy,T=await import('three'),shared=await import('/src/shared.js'),raw=g.tick;
    g.tick=()=>{};g.state.perfRung=0;g.state.noMantaContour=!anatomy;g.state.noMantaAnatomy=true;raw(0,false);
    const audit=g.palawan.mantaContourAudit(),ids=new Set(audit.rows.map(r=>r.uuid)),nodes=[],materials=new Map();
    g.scene.updateMatrixWorld(true);
    g.scene.traverse(o=>{
      nodes.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),v:o.visible,m:o.material,geo:o.geometry,count:o.count,im:o.instanceMatrix?.array.slice(),ic:o.instanceColor?.array.slice()});
      for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))if(!materials.has(m))materials.set(m,{color:m.color?.clone(),emissive:m.emissive?.clone(),opacity:m.opacity});
    });
    const roots=[...new Set(audit.rows.map(r=>r.rootUuid))].map(id=>g.scene.getObjectByProperty('uuid',id));
    if(roots.length!==2||roots.some(r=>!r))throw Error('Both actual manta roots required');
    const views=[];
    roots.forEach((r,i)=>{
      for(const[label,offset]of[['front',[0,2.5,10]],['quarter',[8,3,8]],['profile',[10,2.5,0]],...(anatomy?[['underside',[4,-5,8]]]:[])]){
        const center=new T.Box3().setFromObject(r).getCenter(new T.Vector3());
        const p=new T.Vector3(...offset).applyQuaternion(r.getWorldQuaternion(new T.Quaternion())).add(center);
        views.push({label:i+'-'+label,root:r.uuid,target:center.toArray(),position:p.toArray()});
      }
    });
    window.__mantaFixture={raw,shared,ids,nodes,materials,views,anatomy,time:g.state.time,post:{...g.post.params},fov:g.camera.fov,near:g.camera.near,far:g.camera.far};
    return {audit,views,time:g.state.time};
  },anatomy);
  for(const view of out.pin.views){
    const frames={},states={};
    for(const variant of['warm-live','warm-before','before','live','cut','rung','restored','hidden-before','hidden-live']){
      states[variant]=await h.page.evaluate(({view,variant})=>{
        const g=window.__capy,f=window.__mantaFixture;
        const live=['warm-live','live','restored','hidden-live'].includes(variant);
        g.state.noMantaContour=f.anatomy?false:!live&&variant!=='rung';
        g.state.noMantaAnatomy=f.anatomy?!live:true;
        g.state.perfRung=variant==='rung'?1:0;f.raw(0,false);
        const audit=g.palawan.mantaContourAudit();
        for(const n of f.nodes){
          n.o.position.copy(n.p);n.o.quaternion.copy(n.q);n.o.scale.copy(n.s);n.o.visible=n.v;
          if(!f.ids.has(n.o.uuid)){if(n.m)n.o.material=n.m;if(n.geo)n.o.geometry=n.geo;}
          if(n.im){n.o.instanceMatrix.array.set(n.im);n.o.instanceMatrix.needsUpdate=true;n.o.count=n.count;}
          if(n.ic){n.o.instanceColor.array.set(n.ic);n.o.instanceColor.needsUpdate=true;}
        }
        for(const[m,s]of f.materials){if(s.color)m.color.copy(s.color);if(s.emissive)m.emissive.copy(s.emissive);m.opacity=s.opacity;}
        Object.assign(g.post.params,f.post);
        g.camera.position.fromArray(view.position);g.camera.fov=f.fov;g.camera.near=f.near;g.camera.far=f.far;
        g.camera.lookAt(...view.target);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);g.scene.updateMatrixWorld(true);
        f.shared.lensCapTick(0,0,0,0,0,0,0,false);f.shared.contactTick([],0);
        if(variant.startsWith('hidden'))for(const id of f.ids)g.scene.getObjectByProperty('uuid',id).visible=false;
        g.renderer.shadowMap.needsUpdate=true;for(let i=0;i<3;i++)g.post.render();
        const auto=g.renderer.info.autoReset;g.renderer.info.autoReset=false;g.renderer.info.reset();g.post.render();
        const render={...g.renderer.info.render};g.renderer.info.autoReset=auto;
        return{audit,render,time:g.state.time};
      },{view,variant});
      const row=states[variant];assert.equal(row.time,out.pin.time);assert.ok(row.audit.rows.every(r=>r.exact),'exact cached geometry/material state');
      if(variant==='before')assert.equal(row.audit.mode,anatomy?'contour':'original');
      if(variant==='live')assert.equal(row.audit.mode,anatomy?'anatomy':'contour');
      if(variant==='rung')assert.equal(row.audit.mode,'original');
      if(!row.audit.on)assert.ok(row.audit.rows.every(r=>r.inheritedGeometry&&r.inheritedMaterial),'exact inherited fallback');
      if(variant.startsWith('warm'))continue;
      frames[variant]=PNG.sync.read(await h.screenshot(name+'-'+view.label+'-'+variant));
    }
    const delta=(a,b,i)=>Math.max(...[0,1,2].map(k=>Math.abs(a.data[i*4+k]-b.data[i*4+k])));
    const metrics={mask:0,changed:0,outside:0,cut:0,restored:0,rungDiagnostic:0};
    for(let i=0;i<frames.live.width*frames.live.height;i++){
      const mask=delta(frames.before,frames['hidden-before'],i)>0||delta(frames.live,frames['hidden-live'],i)>0;
      if(mask){metrics.mask++;if(delta(frames.before,frames.live,i)>4)metrics.changed++;}
      else if(delta(frames.before,frames.live,i)>4)metrics.outside++;
      if(delta(frames.before,frames.cut,i)>0)metrics.cut++;
      if(delta(frames.live,frames.restored,i)>0)metrics.restored++;
      if(delta(frames.before,frames.rung,i)>0)metrics.rungDiagnostic++;
    }
    out.views.push({view,metrics,states});
    assert.equal(metrics.cut,0,'cut pixels '+view.label);assert.equal(metrics.restored,0,'restored pixels '+view.label);
    assert.equal(metrics.outside,0,'whole-manta mask '+view.label);assert.ok(metrics.changed>0,'visible contribution '+view.label);
    assert.equal(states.before.render.calls,states.live.render.calls,'no extra draw calls '+view.label);
  }
  assert.deepEqual(h.metadata.errors,[]);await h.result(name,{...out,metadata:h.metadata});
  console.log(JSON.stringify({pass:true,views:out.views.map(v=>({view:v.view.label,metrics:v.metrics})),errors:h.metadata.errors}));
}catch(error){out.failure=String(error.stack||error);await h.screenshot(name+'-failure');await h.result(name+'-failure',{...out,metadata:h.metadata});throw error;}
finally{await h.close();}
