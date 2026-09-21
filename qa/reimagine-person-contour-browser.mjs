// E6 pinned people views; no task/body or direct rig-pose seeding.
// node qa/reimagine-person-contour-browser.mjs quay v5 0 -1 5
// Final args: zero-based distance-sorted subject index, profile side, metres,
// neutral(default)/child/cheer. Child and controlled concert cheer: Sydney only.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';
const require=createRequire(import.meta.url);
const {PNG}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const chapter=process.argv[2]||'sydney',tag=process.argv[3]||'v1';
assert.ok(CHAPTERS.includes(chapter));assert.ok(/^[\w.-]+$/.test(tag));
const options={subjectIndex:Number(process.argv[4]??0),profileSide:Number(process.argv[5]??(chapter==='quay'?-1:1)),distance:Number(process.argv[6]??8.6),height:2.4,pose:process.argv[7]||'neutral'};
assert.ok(['neutral','child','cheer'].includes(options.pose),'known pose fixture');
assert.ok(options.pose==='neutral'||chapter==='sydney','child/cheer require Sydney');
assert.ok(Number.isInteger(options.subjectIndex)&&options.subjectIndex>=0,'nonnegative subject index');
assert.ok([-1,1].includes(options.profileSide),'profile side -1 or1');
assert.ok(Number.isFinite(options.distance)&&options.distance>=2&&options.distance<=12,'staged distance2–12m');
const name=`reimagine-person-contour-${chapter}-${tag}`,out={chapter,tag,options,views:[],screenshots:[],
  scope:'Real arrival keys, then frozen scene transforms and instance poses. People/front/profile views aim at an explicitly selected active torso; default distance8.6m, shorter overrides are close-view fixtures, not natural player-composed shots.',
  poseScope:options.pose==='cheer'?'Controlled production concert.call/house/cheer API fixture; actual gathered actor and animated arms, not a naturally earned concert.':options.pose==='child'?'Genuine randomly built child with original build-time scaling; no child or pose fields assigned. Subject index selects within genuine child candidates.':'Default active torso selection; existing behavior preserved.',
  thresholds:{contributionMask:'any RGB-channel delta >0 against paired hidden references',meaningfulChange:'maximum RGB-channel delta >4',exactParity:'any RGB-channel delta >0 fails'},
  lensScope:'Natural view preserves the authored capsule. Explicit person views disable its radius because NPC subjects are not self-exempt from the aperture.',
  contactScope:'Contact-pool uniforms are cleared equally in every comparison frame; their cached world-space samples can drift from frozen scene transforms after zero-step updates. Sun shadows remain. This fixture isolates garment geometry, not contact-pool behaviour.',
  maskCaveat:'Hide-and-diff removes registered torso meshes, including whole instanced torso batches. Selected-subject acceptance requires change inside its projected box but cannot exclude another torso overlapping that box; screenshots still require subject inspection. Shadows/post filtering can contribute outside boxes. Rung also changes unrelated visual terms, so fullframe rung parity is diagnostic, not an assertion.'};
const h=await openHarness();
try {
  await h.page.evaluate(()=>{
    window.__personKeys=[];
    for(const type of ['keydown','keyup'])document.addEventListener(type,e=>window.__personKeys.push({type,code:e.code,trusted:e.isTrusted}));
  });
  await h.start();await h.arrive(chapter);
  await h.hold('z',350);await h.page.waitForTimeout(1800);
  await h.hold('w',650);await h.page.waitForTimeout(2000);
  if(options.pose==='cheer'){
    out.poseSetup=await h.page.evaluate(()=>({called:window.__capy.concert.call(0,2.5,3)}));
    assert.ok(out.poseSetup.called>0,'production concert found an audience');
    await h.page.waitForFunction(()=>window.__capy.concert.house()>0,null,{timeout:30000});
    out.poseSetup.house=await h.page.evaluate(()=>{
      const g=window.__capy,n=g.concert.house();g.concert.cheer(4.5);return n;
    });
    await h.page.waitForFunction(()=>window.__capy.npcs.some(r=>r.nodes&&r.state==='gather'&&
      r.gathQuiet&&r.cheerT>0&&r.nodes.armL.rotation.x< -2&&r.nodes.armR.rotation.x< -2),null,{timeout:5000});
  }
  await h.page.addStyleTag({content:'[class*="capyui"]{visibility:hidden!important}*{animation-play-state:paused!important;transition:none!important}'});
  out.pin=await h.page.evaluate(async options=>{
    const g=window.__capy,T=await import('three'),shared=await import('/src/shared.js');
    if(typeof g.personContourAudit!=='function')throw new Error('personContourAudit missing');
    const raw=g.tick;g.tick=()=>{};
    // Settle the same zero-step production path used for every later flag edge.
    g.state.perfRung=0;g.state.noPersonContour=false;raw(0,false);
    g.scene.updateMatrixWorld(true);
    const audit=g.personContourAudit(),byId=new Map(audit.rows.map(r=>[r.uuid,r]));
    const nodes=[],targets=[],materials=new Map();
    g.scene.traverse(o=>{
      nodes.push({o,p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),v:o.visible,m:o.material,
        geo:o.geometry,count:o.count,im:o.instanceMatrix?.array.slice(),ic:o.instanceColor?.array.slice()});
      if(o.userData.personContour){targets.push(o);o.userData.qaContourDraws=0;
        const draw=o.onBeforeRender;o.onBeforeRender=function(...args){o.userData.qaContourDraws++;draw.apply(this,args);};}
      for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean))if(!materials.has(m))
        materials.set(m,{color:m.color?.clone(),emissive:m.emissive?.clone(),opacity:m.opacity});
    });
    const cap=g.capy.body.position,active=[],matrix=new T.Matrix4(),combined=new T.Matrix4();
    const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
    for(const o of targets){
      if(!visible(o))continue;
      o.geometry.computeBoundingBox();const center=o.geometry.boundingBox.getCenter(new T.Vector3());
      for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
        if(o.isInstancedMesh){o.getMatrixAt(i,matrix);if(Math.abs(matrix.determinant())<1e-9)continue;combined.multiplyMatrices(o.matrixWorld,matrix);}
        else combined.copy(o.matrixWorld);
        const p=center.clone().applyMatrix4(combined),distance=p.distanceTo(new T.Vector3(cap.x,cap.y,cap.z));
        if(distance<60){
          const rotation=new T.Quaternion(),scale=new T.Vector3();combined.decompose(new T.Vector3(),rotation,scale);
          active.push({uuid:o.uuid,kind:byId.get(o.uuid)?.kind,instance:o.isInstancedMesh?i:null,
            position:p.toArray(),quaternion:rotation.toArray(),scale:scale.toArray(),distance});
        }
      }
    }
    active.sort((a,b)=>a.distance-b.distance);
    if(!active.length)throw new Error('No active registered torso within60m; choose another chapter/view');
    const rigFor=row=>row.kind==='roster'?g.npcs.find(r=>r.nodes&&r.kind!=='ibis'&&r.idx===row.instance):null;
    const candidates=options.pose==='neutral'?active:active.filter(row=>{
      const r=rigFor(row);if(!r)return false;
      return options.pose==='child'?r.child:r.state==='gather'&&r.gathQuiet&&r.cheerT>0&&
        r.nodes.armL.rotation.x< -2&&r.nodes.armR.rotation.x< -2;
    });
    const selected=candidates[options.subjectIndex];
    if(!selected)throw new Error('No '+options.pose+' subject at index '+options.subjectIndex+'; candidates='+candidates.length+
      (options.pose==='child'?'. Reopen a fresh run; never assign the child bit.':''));
    const r=rigFor(selected);
    const pose=r?{kind:r.kind,idx:r.idx,child:!!r.child,arch:r.arch,bH:r.bH,bGirth:r.bGirth,bLeg:r.bLeg,
      state:r.state,cheerT:r.cheerT||0,gathQuiet:!!r.gathQuiet,carryT:r.carryT,
      groupScale:r.group.scale.toArray(),bobScale:r.nodes.bob.scale.toArray(),
      armL:r.nodes.armL.rotation.toArray(),armR:r.nodes.armR.rotation.toArray(),
      bobRotation:r.nodes.bob.rotation.toArray(),poseArmL:r.poseArmL,poseArmR:r.poseArmR}:null;
    const lens=shared.lensCapInfo();
    const f={raw,T,shared,nodes,targets,materials,active,selected,options,time:g.state.time,post:{...g.post.params},
      lens:{a:lens.a.toArray(),b:lens.b.toArray(),r:lens.r,clearView:lens.clearView},
      camera:{p:g.camera.position.clone(),q:g.camera.quaternion.clone(),fov:g.camera.fov,near:g.camera.near,far:g.camera.far},
      geometryRefs:new Map()};
    window.__personFixture=f;
    return {time:f.time,camera:{position:f.camera.p.toArray(),quaternion:f.camera.q.toArray(),fov:f.camera.fov},
      targets:targets.map(o=>({uuid:o.uuid,name:o.name,instanced:!!o.isInstancedMesh,kind:byId.get(o.uuid)?.kind})),active,selected,
      pose,candidates:candidates.length,audit};
  },options);
  if(options.pose==='child')assert.ok(out.pin.pose?.child&&out.pin.pose.arch===3,'genuine child build selected');
  if(options.pose==='cheer')assert.ok(out.pin.pose?.cheerT>0&&out.pin.pose.gathQuiet&&
    out.pin.pose.armL[0]< -2&&out.pin.pose.armR[0]< -2,'genuine animated cheer selected');
  for(const view of ['natural','people','front','profile']){
    const frames={},states={};
    for(const variant of ['warm-before','before','live','cut','rung','restored','hidden-before','hidden-live']){
      states[variant]=await h.page.evaluate(({view,variant})=>{
        const g=window.__capy,f=window.__personFixture,T=f.T;
        const live=['live','restored','hidden-live'].includes(variant);
        g.state.noPersonContour=!live&&variant!=='rung';g.state.perfRung=variant==='rung'?1:0;
        f.raw(0,false); // the actual sole geometry writer; no manual geometry swap
        const audit=g.personContourAudit();
        for(const n of f.nodes){
          n.o.position.copy(n.p);n.o.quaternion.copy(n.q);n.o.scale.copy(n.s);n.o.visible=n.v;
          if(n.m)n.o.material=n.m;
          if(n.geo&&!n.o.userData.personContour)n.o.geometry=n.geo;
          if(n.im){n.o.instanceMatrix.array.set(n.im);n.o.instanceMatrix.needsUpdate=true;n.o.count=n.count;}
          if(n.ic){n.o.instanceColor.array.set(n.ic);n.o.instanceColor.needsUpdate=true;}
        }
        for(const [m,s]of f.materials){if(s.color)m.color.copy(s.color);if(s.emissive)m.emissive.copy(s.emissive);m.opacity=s.opacity;}
        Object.assign(g.post.params,f.post);g.state.time=f.time;
        g.camera.position.copy(f.camera.p);g.camera.quaternion.copy(f.camera.q);
        g.camera.fov=f.camera.fov;g.camera.near=f.camera.near;g.camera.far=f.camera.far;
        if(view!=='natural'){
          const target=new T.Vector3(...f.selected.position);
          const offset=view==='people'?f.camera.p.clone().sub(new T.Vector3(...f.lens.b)):
            new T.Vector3(view==='profile'?f.options.profileSide:0,0,view==='front'?1:0).applyQuaternion(new T.Quaternion(...f.selected.quaternion));
          offset.y=0;offset.normalize().multiplyScalar(f.options.distance);offset.y=f.options.height;
          g.camera.position.copy(target).add(offset);g.camera.lookAt(target);
        }
        g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);g.scene.updateMatrixWorld(true);
        // The NPC subject is not exempt from the world's aperture. Keep the
        // natural lens unchanged; explicit person views must show whole rigs.
        f.shared.lensCapTick(...f.lens.a,...f.lens.b,view==='natural'?f.lens.r:0,f.lens.clearView);
        const boxes=[];
        for(const row of f.active){
          const o=f.targets.find(o=>o.uuid===row.uuid),matrix=new T.Matrix4();
          if(row.instance!==null){o.getMatrixAt(row.instance,matrix);matrix.premultiply(o.matrixWorld);}else matrix.copy(o.matrixWorld);
          o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,pts=[];
          for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
            const p=new T.Vector3(x,y,z).applyMatrix4(matrix).project(g.camera);pts.push({x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2,z:p.z});
          }
          if(pts.every(p=>p.z>1||p.z< -1))continue;
          const box={uuid:row.uuid,instance:row.instance,kind:row.kind,
            x0:Math.max(0,Math.floor(Math.min(...pts.map(p=>p.x)))-2),y0:Math.max(0,Math.floor(Math.min(...pts.map(p=>p.y)))-2),
            x1:Math.min(innerWidth,Math.ceil(Math.max(...pts.map(p=>p.x)))+2),y1:Math.min(innerHeight,Math.ceil(Math.max(...pts.map(p=>p.y)))+2)};
          if(box.x1>box.x0&&box.y1>box.y0)boxes.push(box);
        }
        const ids=f.targets.map(o=>o.geometry.uuid);
        if(variant==='before')f.geometryRefs.set(view,f.targets.map(o=>o.geometry));
        const exactInherited=f.targets.every((o,i)=>o.geometry===f.geometryRefs.get(view)?.[i]);
        if(variant.startsWith('hidden'))for(const o of f.targets)o.visible=false;
        f.shared.contactTick([],0);
        g.renderer.shadowMap.needsUpdate=true;for(let i=0;i<3;i++)g.post.render();
        const auto=g.renderer.info.autoReset;g.renderer.info.autoReset=false;g.renderer.info.reset();
        for(const o of f.targets)o.userData.qaContourDraws=0;g.post.render();
        const render={...g.renderer.info.render,torsoColorDraws:f.targets.reduce((n,o)=>n+o.userData.qaContourDraws,0)};
        g.renderer.info.autoReset=auto;
        return {audit,exactInherited,geometryIds:ids,boxes,render,capRadius:view==='natural'?f.lens.r:0,
          camera:{position:g.camera.position.toArray(),quaternion:g.camera.quaternion.toArray()},time:g.state.time};
      },{view,variant});
      // A zero-step at the newly pinned camera settles view-dependent terms
      // before the measured inherited frame; never relax the parity gate.
      if(variant==='warm-before')continue;
      const artifact=`${name}-${view}-${variant}`;
      frames[variant]=PNG.sync.read(await h.screenshot(artifact));
      out.screenshots.push(fileURLToPath(new URL('./'+artifact+'.png',import.meta.url)));
      assert.ok(states[variant].audit.rows.every(r=>r.exact),'production geometry identity '+variant);
      if(['before','cut','rung','hidden-before'].includes(variant))assert.ok(states[variant].exactInherited,'exact inherited references '+variant);
    }
    const delta=(a,b,i)=>Math.max(...[0,1,2].map(k=>Math.abs(a.data[i*4+k]-b.data[i*4+k])));
    const boxes=[...states.before.boxes,...states.live.boxes],w=frames.live.width,hp=frames.live.height;
    const selectedBoxes=boxes.filter(b=>b.uuid===out.pin.selected.uuid&&b.instance===out.pin.selected.instance);
    const metrics={mask:0,torsoBoxMask:0,changed:0,torsoBoxChanged:0,selectedBoxMask:0,selectedBoxChanged:0,outsideMaskChanged:0,cutMismatch:0,restoreMismatch:0,rungMismatch:0};
    for(let y=0;y<hp;y++)for(let x=0;x<w;x++){
      const i=y*w+x,mask=delta(frames.before,frames['hidden-before'],i)>0||delta(frames.live,frames['hidden-live'],i)>0;
      const changed=delta(frames.before,frames.live,i)>4,inBox=boxes.some(b=>x>=b.x0&&x<b.x1&&y>=b.y0&&y<b.y1);
      if(mask){metrics.mask++;if(changed)metrics.changed++;if(inBox){metrics.torsoBoxMask++;if(changed)metrics.torsoBoxChanged++;}}
      else if(changed)metrics.outsideMaskChanged++;
      if(mask&&selectedBoxes.some(b=>x>=b.x0&&x<b.x1&&y>=b.y0&&y<b.y1)){metrics.selectedBoxMask++;if(changed)metrics.selectedBoxChanged++;}
      if(delta(frames.before,frames.cut,i)>0)metrics.cutMismatch++;
      if(delta(frames.live,frames.restored,i)>0)metrics.restoreMismatch++;
      if(delta(frames.before,frames.rung,i)>0)metrics.rungMismatch++;
    }
    out.views.push({view,selected:out.pin.selected,selectedBoxes,metrics,states});
    assert.equal(metrics.cutMismatch,0,'flag cut pinned pixel parity '+view);
    assert.equal(metrics.restoreMismatch,0,'live restore pinned pixel parity '+view);
    assert.equal(metrics.outsideMaskChanged,0,'changes stay inside torso contribution mask '+view);
    assert.equal(states.before.render.torsoColorDraws,states.live.render.torsoColorDraws,'same torso color draw calls '+view);
    if(view!=='natural')assert.ok(metrics.selectedBoxChanged>0,'selected subject visible contribution '+view);
  }
  out.keys=await h.page.evaluate(()=>window.__personKeys);
  assert.ok(out.keys.length>0&&out.keys.every(k=>k.trusted));assert.deepEqual(h.metadata.errors,[]);
  await h.result(name,{...out,metadata:h.metadata});
  console.log(JSON.stringify({chapter,options,selected:out.pin.selected,pose:out.pin.pose,poseScope:out.poseScope,activeKinds:[...new Set(out.pin.active.map(r=>r.kind))],views:out.views.map(v=>({view:v.view,metrics:v.metrics,before:v.states.before.render,live:v.states.live.render})),errors:h.metadata.errors,screenshots:out.screenshots},null,2));
}catch(error){
  out.failure=String(error.stack||error);
  await h.screenshot(name+'-failure');await h.result(name+'-failure',{...out,metadata:h.metadata});throw error;
}finally{await h.close();}
