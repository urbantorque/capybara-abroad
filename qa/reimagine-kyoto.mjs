// REIMAGINE: authored facade rhythm, exact buffers and fixed-camera evidence.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
import * as THREE from '../vendor/three.module.js';
import {openHarness} from './reimagine-harness.mjs';
const source=readFileSync('src/kyoto.js','utf8');
const shared=readFileSync('src/shared.js','utf8');
const palette={};
for(const name of ['shoji','tatami','templeWood','shojiFrame','kawara','kawaraDark','templeWoodDk','indigo','granite','graniteDark'])
  palette[name]=Number(shared.match(new RegExp('\\b'+name+':\\s*(0x[0-9a-f]+)'))[1]);
const fn=(s,n)=>s.slice(s.indexOf('function '+n+'(')).match(/^function[\s\S]*?\n\}/)[0];
const pattern=source.match(/const kyoMACHIYA_ROWS = [\s\S]*?;/)[0];
const helpers=pattern+fn(source,'kyoMachiyaBuffers')+fn(source,'kyoUpdateMachiya');
function geometryMerger() {
  const p=[],c=[],idx=[];
  return {n:0,box(x,y,z,w,h,d,color,rx=0,ry=0,rz=0){
    const geo=new THREE.BoxGeometry(w,h,d),m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1));
    geo.applyMatrix4(m);const tint=new THREE.Color(color);
    for(const n of geo.attributes.position.array)p.push(n);
    for(let i=0;i<geo.attributes.position.count;i++)c.push(tint.r,tint.g,tint.b);
    for(const n of geo.index.array)idx.push(n+this.n);
    this.n+=geo.attributes.position.count;
  },build(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setIndex(idx);g.computeVertexNormals();return g;}};
}
function fixture(text) {
  const start=text.indexOf('function kyoBuildGion('),end=text.indexOf('// ---- the lanterns',start);
  const builder=text.slice(start,end)+'}';
  const run=new Function('THREE','PALETTE','kyoMerger',`
    let kyoMachiya=null,kyoMachiyaBase=null,kyoMachiyaLive=null,kyoMachiyaOn=false;
    const kyoGION_Z=52,kyoTerrain=()=>1,rand=(a,b)=>(a+b)/2,kyoVC=()=>new THREE.MeshLambertMaterial();
    const colliders=[];const kyoStaticBox=(...a)=>colliders.push(a.slice(1));
    ${helpers}${builder}
    const root=new THREE.Group(),game={state:{noMachiyaRhythm:true,perfRung:0}};
    kyoBuildGion(game,root);
    const mesh=root.children[0],base={position:mesh.geometry.attributes.position,color:mesh.geometry.attributes.color};
    if(kyoMachiya){game.state.noMachiyaRhythm=false;kyoUpdateMachiya(game);}
    return {mesh,base,colliders,live:kyoMachiyaLive};`);
  return run(THREE,palette,geometryMerger);
}
const a=fixture(source),old=fixture(execFileSync('git',['show','62315ad:src/kyoto.js'],{encoding:'utf8',maxBuffer:1000000}));
assert.deepEqual(a.base.position.array,old.base.position.array,'authored positions retained');
assert.deepEqual(a.base.color.array,old.base.color.array,'authored colours retained');
assert.deepEqual(a.colliders,old.colliders,'colliders exact');
assert.deepEqual(a.mesh.geometry.index.array,old.mesh.geometry.index.array,'same triangle topology');
assert.equal(a.mesh.geometry.attributes.position.count,a.base.position.count,'same vertex count');
let moved=0,changed=0;
for(let i=0;i<a.base.position.count;i++) {
  const p=a.base.position,v=a.live.position;
  assert.equal(p.getZ(i),v.getZ(i),'facade depth preserved');
  if(p.getX(i)!==v.getX(i)||p.getY(i)!==v.getY(i)){
    moved++;
    const z=p.getZ(i);
    assert.ok((z>46.44&&z<46.85)||(z>57.15&&z<57.56),'only facade planes move');
    assert.ok(p.getY(i)>2&&p.getY(i)<5.5,'roof/ground vertices untouched');
  }
  for(let k=0;k<3;k++)if(a.base.color.array[i*3+k]!==a.live.color.array[i*3+k]){changed++;break;}
}
assert.ok(moved>1000&&changed>0,'structural frontage variation, not only tint');
for(const attr of [a.live.position,a.live.color])assert.ok([...attr.array].every(Number.isFinite));
if(process.argv.includes('--static')){console.log(`Kyoto rhythm: baseline/topology/collider checks pass; ${moved} vertices moved, ${changed} tinted.`);process.exit(0);}
const require=createRequire(import.meta.url);
const {PNG}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const h=await openHarness();
try {
  await h.start();await h.arrive('kyoto');
  await h.page.addStyleTag({content:'[class*="capyui"]{visibility:hidden!important}*{transition:none!important;animation-play-state:paused!important}'});
  const evidence=[];
  for(const name of ['arrival','walk','reverse']) {
    if(name==='walk')await h.hold('ArrowUp',900);
    await h.page.evaluate(name=>{
      const g=window.__capy,m=g.scene.getObjectByName('kyoMachiya');
      window.__kyoRawTick=g.tick;g.tick=()=>{};
      const camera=g.camera.clone();
      if(name==='reverse'){
        const p=g.capy.group.position;
        // A controlled reverse street view; reflecting an oblique camera
        // across the walking animal puts it inside the opposite shop.
        camera.position.set(p.x+7.2,p.y+3.8,52.5);camera.lookAt(p.x,p.y+.6,p.z);
      }
      window.__kyoFrame={camera,m,index:m.geometry.index};
    },name);
    const images={},states={};
    for(const variant of ['before','after','hidden']) {
      states[variant]=await h.page.evaluate(variant=>{
        const g=window.__capy,f=window.__kyoFrame,m=f.m;
        m.geometry.setIndex(f.index);
        g.state.noMachiyaRhythm=variant==='before';g.kyoto.update(0);
        if(variant==='before'){
          f.baseP=m.geometry.attributes.position;f.baseC=m.geometry.attributes.color;
        }
        if(variant==='after'){
          f.liveP=m.geometry.attributes.position;f.liveC=m.geometry.attributes.color;
          const moved=new Set();
          for(let i=0;i<f.baseP.count;i++)for(let k=0;k<3;k++)if(f.baseP.array[i*3+k]!==f.liveP.array[i*3+k]||f.baseC.array[i*3+k]!==f.liveC.array[i*3+k]){moved.add(i);break;}
          f.hiddenIndex=[];
          for(let i=0;i<f.index.count;i+=3){const t=[f.index.array[i],f.index.array[i+1],f.index.array[i+2]];
            if(!t.some(v=>moved.has(v)))f.hiddenIndex.push(...t);}
        }
        if(variant==='hidden')m.geometry.setIndex(f.hiddenIndex);
        g.camera.copy(f.camera);g.camera.updateMatrixWorld();
        for(let i=0;i<3;i++)g.post.render();
        return {audit:g.kyoto.machiyaAudit(),vertices:m.geometry.attributes.position.count,
          indices:m.geometry.index.count,position:g.capy.group.position.toArray()};
      },variant);
      images[variant]=PNG.sync.read(await h.screenshot('reimagine-kyoto-'+name+'-'+variant));
    }
    let mask=0,diff=0;const delta=(a,b,i)=>Math.max(...[0,1,2].map(k=>Math.abs(a.data[i*4+k]-b.data[i*4+k])));
    for(let i=0;i<images.before.width*images.before.height;i++)if(delta(images.before,images.hidden,i)>4||delta(images.after,images.hidden,i)>4){
      mask++;if(delta(images.before,images.after,i)>4)diff++;
    }
    assert.ok(diff>1000,'visible facade change '+name);
    assert.equal(states.before.vertices,states.after.vertices);
    assert.equal(states.before.indices,states.after.indices);
    assert.equal(states.before.audit.inherited,true);assert.equal(states.after.audit.on,true);
    evidence.push({name,mask,diff,states});
    await h.page.evaluate(()=>{const g=window.__capy,f=window.__kyoFrame;f.m.geometry.setIndex(f.index);g.tick=window.__kyoRawTick;});
  }
  const lifecycle=await h.page.evaluate(()=>{
    const g=window.__capy,m=g.scene.getObjectByName('kyoMachiya'),raw=g.tick;g.tick=()=>{};
    g.state.noMachiyaRhythm=true;g.kyoto.update(0);const p=m.geometry.attributes.position,c=m.geometry.attributes.color;
    g.state.noMachiyaRhythm=false;g.state.perfRung=1;g.kyoto.update(0);
    const parked=m.geometry.attributes.position===p&&m.geometry.attributes.color===c;
    g.state.perfRung=0;g.kyoto.update(0);const live=g.kyoto.machiyaAudit();
    g.state.noMachiyaRhythm=true;g.kyoto.update(0);
    const back=m.geometry.attributes.position===p&&m.geometry.attributes.color===c;
    g.tick=raw;return{parked,back,live};
  });
  assert.ok(lifecycle.parked&&lifecycle.back);assert.ok(lifecycle.live.on);
  const cost=await h.page.evaluate(update=>{
    const g=window.__capy,raw=g.tick;g.tick=()=>{};
    try {
      const run=new Function('game','n','let kyoMachiya={},kyoMachiyaOn=false;'+update+
        ';const t=performance.now();for(let i=0;i<n;i++)kyoUpdateMachiya(game);return (performance.now()-t)/n;');
      let mode='flag',reads=0;const game={state:{get noMachiyaRhythm(){reads++;return mode==='flag';},get perfRung(){return mode==='rung'?1:0;}}};
      const samples=[];
      for(mode of ['flag','rung']){
        for(let i=0;i<5;i++)run(game,10000);reads=0;const times=[];
        for(let i=0;i<20;i++)times.push(run(game,100000));
        times.sort((a,b)=>a-b);samples.push({mode,medianMs:times[10],p95Ms:times[19],reads,invocations:2000000});
      }
      return {samples,scope:'Actual new gate only, counted getter cost included. Excludes inherited Kyoto update and renderer/GPU.'};
    }finally{g.tick=raw;}
  },fn(source,'kyoUpdateMachiya'));
  for(const sample of cost.samples){assert.equal(sample.reads,sample.invocations);assert.ok(sample.p95Ms<.1);}
  assert.deepEqual(h.metadata.errors,[]);
  await h.result('reimagine-kyoto',{metadata:h.metadata,evidence,lifecycle,cost,note:'Pinned paired facade masks. Art judgment requires screenshot inspection; no GPU timing claim.'});
  console.log(JSON.stringify({evidence:evidence.map(e=>({name:e.name,mask:e.mask,diff:e.diff})),lifecycle,cost,errors:h.metadata.errors},null,2));
}finally{await h.close();}
