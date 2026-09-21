// E6: actual switch CPU and separate dense-instancing GPU experiment.
// No full-game frame, production lighting, shadow or post-process cost claim.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h=await openHarness();
try {
  await h.start();
  const report=await h.page.evaluate(async()=>{
    const g=window.__capy,T=await import('three'),shared=await import('/src/shared.js');
    const source=await(await fetch('/src/npc.js')).text();
    const tick=source.match(/  function npcPersonTick\([^]*?\n  \}/)?.[0];
    if(!tick||typeof g.personContourAudit!=='function')throw new Error('Actual person contour writer/audit unavailable');
    const raw=g.tick,oldFlag=g.state.noPersonContour,oldRung=g.state.perfRung;
    g.tick=()=>{};
    let renderer,material,mesh,canvas,cutGeometry,liveGeometry;
    const stats=values=>{
      const sorted=values.slice().sort((a,b)=>a-b),n=sorted.length;
      if(!n)return {n:0,mean:null,median:null,p95:null,ci95HalfWidth:null};
      const mean=sorted.reduce((a,b)=>a+b,0)/n;
      const variance=n>1?sorted.reduce((a,b)=>a+(b-mean)**2,0)/(n-1):0;
      return {n,mean,median:sorted[n>>1],p95:sorted[Math.min(n-1,Math.floor(n*.95))],
        ci95HalfWidth:1.96*Math.sqrt(variance/n)};
    };
    try {
      const collect=()=>{
        const audit=g.personContourAudit(),map=new Map();
        g.scene.traverse(o=>{if(o.userData.personContour)map.set(o.uuid,o);});
        if(!audit.rows.every(r=>r.exact))throw new Error('Production geometry identity mismatch');
        return {audit,map};
      };
      g.state.perfRung=0;g.state.noPersonContour=true;raw(0,false);
      const before=collect(),ids=before.audit.rows.map(r=>r.uuid);
      const inherited=ids.map(id=>before.map.get(id)?.geometry);
      g.state.noPersonContour=false;raw(0,false);
      const after=collect(),contours=ids.map(id=>after.map.get(id)?.geometry);
      if(inherited.some(x=>!x)||contours.some(x=>!x))throw new Error('Tagged torso missing from actual scene');
      const pick=before.audit.rows.findIndex(r=>r.kind==='roster'&&before.map.get(r.uuid)?.isInstancedMesh);
      if(pick<0)throw new Error('Roster torso unavailable');
      if(inherited[pick]===contours[pick])throw new Error('Actual flag edge did not change torso geometry');
      // CPU fixture writes dummy mesh slots, never real game mesh geometry.
      const slots=ids.map((id,i)=>({mesh:{geometry:inherited[i]},inherited:inherited[i],contour:contours[i]}));
      let mode='live',reads=0;
      const game={state:{get noPersonContour(){reads++;return mode==='flag';},get perfRung(){return mode==='rung'?1:0;}}};
      const step=new Function('game','npcPersonMeshes',`let npcPersonOn=false;${tick};return npcPersonTick;`)(game,slots);
      const cpu=[];
      for(mode of ['live','flag','rung']){
        for(let i=0;i<10000;i++)step();reads=0;
        const times=[];
        for(let j=0;j<100;j++){const at=performance.now();for(let i=0;i<10000;i++)step();times.push((performance.now()-at)/10000);}
        const exact=slots.every(r=>r.mesh.geometry===(mode==='live'?r.contour:r.inherited));
        cpu.push({mode,reads,timedCalls:1000000,exact,ms:stats(times)});
      }
      // Representative Lambert avoids production shared uniforms, custom hooks,
      // and a second renderer touching the game's material/program ownership.
      cutGeometry=inherited[pick].clone();liveGeometry=contours[pick].clone();
      cutGeometry.computeBoundingBox();liveGeometry.computeBoundingBox();
      canvas=document.createElement('canvas');canvas.width=1280;canvas.height=760;
      Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'1280px',height:'760px',zIndex:'2147483647'});
      document.body.appendChild(canvas);
      renderer=new T.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
      renderer.setPixelRatio(1);renderer.setSize(1280,760,false);renderer.shadowMap.enabled=false;
      const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if(!ext)throw new Error('Isolated GPU timer extension unavailable; no CPU substitute');
      const gpuExt=gl.getExtension('WEBGL_debug_renderer_info');
      const gpuIdentity={renderer:gpuExt?gl.getParameter(gpuExt.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
        vendor:gpuExt?gl.getParameter(gpuExt.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};
      const scene=new T.Scene();scene.background=new T.Color(shared.PALETTE.sail);
      scene.add(new T.AmbientLight(shared.PALETTE.sail,1.2));
      const light=new T.DirectionalLight(shared.PALETTE.sail,2);light.position.set(3,5,8);scene.add(light);
      material=new T.MeshLambertMaterial({color:shared.PALETTE.sail,vertexColors:true,flatShading:true});
      const cols=32,rows=18,count=cols*rows,spacing=.9,width=cols*spacing+1,height=width*760/1280;
      mesh=new T.InstancedMesh(cutGeometry,material,count);mesh.frustumCulled=false;scene.add(mesh);
      const pivot=cutGeometry.boundingBox.getCenter(new T.Vector3()),m=new T.Matrix4(),q=new T.Quaternion(),position=new T.Vector3();
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const i=y*cols+x;q.setFromEuler(new T.Euler(.12,(x%5-2)*.35,0));
        position.set((x-(cols-1)/2)*spacing,((rows-1)/2-y)*spacing,0).sub(pivot.clone().applyQuaternion(q));
        m.compose(position,q,new T.Vector3(1,1,1));mesh.setMatrixAt(i,m);
        mesh.setColorAt(i,new T.Color(i%2?shared.PALETTE.grassDark:shared.PALETTE.sandstone));
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
      const camera=new T.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,100);camera.position.set(0,0,30);camera.lookAt(0,0,0);
      const geometries={cut:cutGeometry,live:liveGeometry},batchRenders=16;
      const draw=(which,n=1)=>{mesh.geometry=geometries[which];for(let i=0;i<n;i++)renderer.render(scene,camera);};
      const checksum=()=>{
        const bytes=new Uint8Array(1280*760*4);gl.readPixels(0,0,1280,760,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        let hash=2166136261;const colors=new Set();
        for(let i=0;i<bytes.length;i++){hash=Math.imul(hash^bytes[i],16777619)>>>0;
          if(i%4===0)colors.add(bytes[i]|bytes[i+1]<<8|bytes[i+2]<<16);}
        return {hash,colors:colors.size};
      };
      const frames={},draws={};
      for(const which of ['cut','live']){
        draw(which,20);gl.finish();renderer.info.reset();draw(which);
        frames[which]=checksum();draws[which]={...renderer.info.render};
      }
      let disjoints=0,timeouts=0;const pairs=[],samples=[],deadline=performance.now()+45000;
      const timed=async which=>{
        if(performance.now()>deadline)throw new Error('GPU measurement exceeded45s; preserve bounded run');
        mesh.geometry=geometries[which];
        const beforeDisjoint=!!gl.getParameter(ext.GPU_DISJOINT_EXT),query=gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT,query);const at=performance.now();draw(which,batchRenders);
        const cpuSubmitMs=performance.now()-at;gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();
        const start=performance.now();
        while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)&&performance.now()-start<1500)
          await new Promise(resolve=>requestAnimationFrame(resolve));
        const ready=gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE),disjoint=beforeDisjoint||!!gl.getParameter(ext.GPU_DISJOINT_EXT);
        const batchGpuMs=ready&&!disjoint?gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6:null;
        gl.deleteQuery(query);if(disjoint)disjoints++;if(!ready)timeouts++;
        return {which,batchGpuMs,gpuPerRenderMs:batchGpuMs===null?null:batchGpuMs/batchRenders,cpuSubmitMs,disjoint,ready};
      };
      for(let i=0;i<40;i++){
        const order=i%2?['live','cut']:['cut','live'],row={};
        for(const which of order){row[which]=await timed(which);samples.push({pair:i,order,...row[which]});}
        if(row.cut.gpuPerRenderMs!==null&&row.live.gpuPerRenderMs!==null)
          pairs.push({pair:i,order,cut:row.cut.gpuPerRenderMs,live:row.live.gpuPerRenderMs,delta:row.live.gpuPerRenderMs-row.cut.gpuPerRenderMs});
      }
      return {cpu:{scope:'Actual extracted npcPersonTick steady path; counted getter overhead included, dummy mesh slots. Excludes edge swaps, layout, allocations and rendering; batch timing resolution applies.',rows:cpu},
        sourceGeometry:{uuid:ids[pick],kind:before.audit.rows[pick].kind,cut:before.audit.rows[pick],live:after.audit.rows.find(r=>r.uuid===ids[pick]),capturedBy:'Actual raw game.tick(0,false) flag writer; GPU clones preserve attributes.'},
        gpu:{scope:'Isolated dense torso instancing, representative flat Lambert with authored geometry/vertex colours; no production material hooks, shadows, fog, post or animation. Aggregate dense-scene delta, not per-person or full-game cost.',
          identity:gpuIdentity,viewport:[1280,760],instances:count,batchRenders,requestedPairs:40,validPairs:pairs.length,disjoints,timeouts,
          frames,draws,perRenderMs:{cut:stats(pairs.map(p=>p.cut)),live:stats(pairs.map(p=>p.live)),pairedDelta:stats(pairs.map(p=>p.delta))},
          ciScope:'Normal-approximation95% confidence half-width of the paired-sample mean; repeated GPU samples may be autocorrelated. No claim of independent population trials.',pairs,samples},
        hidden:document.hidden,paused:g.state.paused};
    }finally{
      mesh?.dispose();cutGeometry?.dispose();liveGeometry?.dispose();material?.dispose();renderer?.dispose();renderer?.forceContextLoss();canvas?.remove();
      g.state.noPersonContour=oldFlag;g.state.perfRung=oldRung;raw(0,false);g.tick=raw;
    }
  });
  await h.result('reimagine-person-contour-cost',{metadata:h.metadata,...report});
  console.log(JSON.stringify(report,null,2));
  assert.ok(!report.hidden&&!report.paused,'visible hardware browser');
  for(const row of report.cpu.rows){assert.equal(row.reads,row.timedCalls,'actual gate reads');assert.ok(row.exact);if(row.mode!=='live')assert.ok(row.ms.p95<=.1,'cut CPU budget');}
  assert.ok(report.gpu.validPairs>=30,'insufficient valid paired GPU samples');
  assert.equal(report.gpu.draws.cut.calls,report.gpu.draws.live.calls,'same isolated draw count');
  assert.ok(report.gpu.frames.cut.colors>4&&report.gpu.frames.live.colors>4,'nonflat isolated render');
  assert.notEqual(report.gpu.frames.cut.hash,report.gpu.frames.live.hash,'actual geometry changes visible fixture');
  assert.deepEqual(h.metadata.errors,[],'zero runtime errors');
}catch(error){
  await h.result('reimagine-person-contour-cost-failure',{metadata:h.metadata,failure:String(error.stack||error)});throw error;
}finally{await h.close();}
