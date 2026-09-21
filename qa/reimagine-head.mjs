// REIMAGINE E3: cached head contour, fixed-pose hide-and-diff on hardware.
// Photo poses and soaking are controlled fixtures, not claims of natural play.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripComments } from '../strip-comments.mjs';
import * as THREE from '../vendor/three.module.js';
import { openHarness } from './reimagine-harness.mjs';

// Run the shipped builders, not a reimplementation, before opening a browser.
const source=readFileSync('src/capybara.js','utf8');
const fn=(s,n)=>s.slice(s.indexOf('function '+n+'(')).match(/^function[\s\S]*?\n\}/)[0];
const constant=n=>stripComments(source).match(new RegExp('const '+n+' = [\\s\\S]*?;'))[0];
const declarations=['capyHULL','capyHULL_D','capyHULL_PIVOT','capyHEAD_SECTION','capyHEAD_ROWS','capyCHIN_SECTION','capyCHIN_ROWS'].map(constant).join('\n');
const builders=declarations+constant('capyHULL_N')+fn(source,'capyHullGeo')+fn(source,'capySmoothNormals')+fn(source,'capyHeadContourGeo');
const built=new Function('THREE',builders+';return {head:capyHeadContourGeo(false),chin:capyHeadContourGeo(true),body:capyHullGeo(capyHULL,0,0,0,true)};')(THREE);
// The shared body helper's optional arguments must not change the old body.
const inherited=execFileSync('git',['show','62315ad:src/capybara.js'],{encoding:'utf8',maxBuffer:4000000});
const oldBody=new Function('THREE',declarations+'const capyHULL_N=(capyHULL_D.length-1)*2;'+fn(inherited,'capyHullGeo')+fn(inherited,'capySmoothNormals')+'return capyHullGeo(capyHULL,0,0,0,true);')(THREE);
for(const key of ['position','normal'])assert.deepEqual(built.body.attributes[key].array,oldBody.attributes[key].array,'body unchanged '+key);
assert.deepEqual(built.body.userData.nRound.array,oldBody.userData.nRound.array,'body smooth normals unchanged');
for(const [geo,triangles]of [[built.head,216],[built.chin,96]]) {
  assert.equal(geo.attributes.position.count/3,triangles);
  for(const name of ['position','normal'])assert.ok([...geo.attributes[name].array].every(Number.isFinite));
  assert.ok(geo.userData.nRound&&geo.userData.nFlat,'both normal modes cached');
}
const mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const upper=new THREE.Mesh(built.head,mat);upper.position.set(0,.02,.07);upper.updateMatrixWorld();
const chin=new THREE.Mesh(built.chin,mat);chin.position.set(0,-.138-.0425,.262+.117);chin.updateMatrixWorld();
const hit=(mesh,x,y,z,dx,dy,dz)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(dx,dy,dz)).intersectObject(mesh)[0]?.point;
for(const [x,z]of [[0,.426],[.036,.445],[.064,.465]])assert.ok(Math.abs(hit(upper,x,1,z,0,-1,0).y-.055)<1e-6,'nose pad / nostril support');
const eyeSocket=new THREE.Group();eyeSocket.position.set(.128,.128,.265);eyeSocket.rotation.y=.62;
const eye=new THREE.Object3D();eye.position.z=.056;eye.scale.set(.046,.050,.042);eyeSocket.add(eye);eyeSocket.updateMatrixWorld(true);
const catchlight=eye.localToWorld(new THREE.Vector3(.135,.452,.597));
assert.ok(hit(upper,catchlight.x,1,catchlight.z,0,-1,0).y<catchlight.y,'upper crown must not bury eye catchlight');
for(const angle of [0,Math.PI/4,Math.PI/2]) {
  const direction=new THREE.Vector3(Math.sin(angle),.28,Math.cos(angle)).normalize();
  const ray=new THREE.Raycaster(catchlight.clone().add(direction),direction.negate());
  const obstruction=ray.intersectObject(upper)[0];
  assert.ok(!obstruction||obstruction.distance>1,'catchlight clear from front, quarter and profile');
}
assert.ok(Math.abs(hit(upper,0,0,1,0,0,-1).z-.500)<1e-6,'blunt muzzle front retained');
for(const z of [.33,.40,.48])for(const x of [-.12,0,.12]) {
  const a=hit(upper,x,-1,z,0,1,0).y,b=hit(chin,x,1,z,0,-1,0).y;
  assert.ok(Math.abs(a+.145)<1e-6&&Math.abs(b+.138)<1e-6,'closed mouth overlap remains 7mm');
}
assert.ok(Math.abs(hit(chin,0,-.15,1,0,0,-1).z-.496)<1e-6,'chin remains 4mm behind nose');
if(process.argv.includes('--static')) {console.log('Head v2: geometry, body identity, nose support and mouth seam checks passed.');process.exit(0);}

const require = createRequire(import.meta.url);
const { PNG } = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs'));
const h = await openHarness();
try {
  await h.start();
  if(process.argv.includes('--cost')) {
    const apply=source.match(/function capyHeadApply\(on\) \{[\s\S]*?\n  \}/)?.[0];
    const gate=source.match(/    const headContour =[^\n]+\n    if \(capyHeadOn !== headContour\)[^\n]+/)?.[0];
    assert.ok(apply&&gate,'actual production gate found');
    const cost=await h.page.evaluate(({apply,gate})=>{
      const g=window.__capy,c=g.capy,raw=g.tick;g.tick=()=>{};
      try {
        const parts=['capySkull','capyBrowBridge','capyMuzzle','capyChin','capyCheekL','capyCheekR'].map(n=>c.group.getObjectByName(n));
        g.state.noHeadContour=true;c.update(1/60);
        const inherited=parts.map(o=>o.geometry),visible=parts.map(o=>o.visible);
        g.state.noHeadContour=false;c.update(1/60);
        const contour=parts.map(o=>o.geometry);
        let reads=0;
        // Counted accessor prevents the benchmark loop hoisting a constant
        // flag read. Its overhead stays INCLUDED: this is a conservative
        // measurement of the added gate, not the inherited capy update.
        let mode='flag';
        const game={state:{get noHeadContour(){reads++;return mode==='flag';},get perfRung(){return mode==='rung'?1:0;}}};
        const run=new Function('game','capyHeadParts','capyHeadBase','capyHeadRound','capyHeadVisible','count',
          'let capyHeadOn=false;const capyRoundOn=true;'+apply+';const t=performance.now();for(let i=0;i<count;i++){'+gate+'}return (performance.now()-t)/count;');
        const samples=[];
        for(mode of ['flag','rung']) {
          for(let i=0;i<5;i++)run(game,parts,inherited,contour,visible,10000);
          reads=0;
          const times=[];
          for(let i=0;i<20;i++)times.push(run(game,parts,inherited,contour,visible,100000));
          times.sort((a,b)=>a-b);
          samples.push({mode,medianMs:times[10],p95Ms:times[19],reads,invocations:2000000});
        }
        return {samples,
          scope:'Production head-contour gate only, counting accessor cost included. No whole-update or renderer/GPU timing; geometry built before measurement.'};
      } finally {g.tick=raw;}
    },{apply,gate});
    for(const sample of cost.samples) {
      assert.equal(sample.reads,sample.invocations,'every cut gate executed');
      assert.ok(sample.p95Ms<.1,'isolated gate upper-bound CPU below .1ms');
    }
    assert.equal(h.metadata.errors.length,0,'no runtime errors');
    await h.result('reimagine-head-v2-cost',{metadata:h.metadata,...cost});
    console.log(JSON.stringify(cost,null,2));
    await h.close();
    process.exit(0);
  }
  await h.page.waitForTimeout(1600);
  await h.page.waitForFunction(()=>window.__capy.capy.animAudit().eyeOpen>.045);
  await h.page.addStyleTag({ content: '[class*="capyui"] { visibility:hidden!important; } * { animation-play-state:paused!important; transition:none!important; }' });
  await h.page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    window.__headRawTick = g.tick; g.tick = () => {};
    g.state.perfRung = 0;
    c.wear(null);
    const parts=['capySkull','capyBrowBridge','capyMuzzle','capyChin','capyCheekL','capyCheekR'].map(n=>c.group.getObjectByName(n));
    const nodes = [];
    c.group.traverse(o => nodes.push({ o, p:o.position.clone(), q:o.quaternion.clone(), s:o.scale.clone(), v:o.visible, m:o.material }));
    const restore = () => {
      for (const n of nodes) { n.o.position.copy(n.p); n.o.quaternion.copy(n.q); n.o.scale.copy(n.s); if(!parts.includes(n.o))n.o.visible=n.v; if(n.m)n.o.material=n.m; }
    };
    const target = new g.THREE.Vector3();
    const fixture = { parts, nodes, restore, target, draws:0 };
    for(const part of parts) {
      const draw=part.onBeforeRender;
      part.onBeforeRender=function(...args){fixture.draws++;draw.apply(this,args);};
    }
    window.__headFixture = fixture;
  });
  const fixtures = [
    { name:'front', angle:0, distance:2.6 },
    { name:'quarter', angle:Math.PI/4, distance:2.6 },
    { name:'profile', angle:Math.PI/2, distance:2.6 },
    { name:'gameplay', angle:Math.PI/3, distance:8.6 },
    { name:'loaf', angle:Math.PI/4, distance:2.6, pose:2 },
    { name:'mouth', angle:Math.PI/4, distance:2.6, pose:3 },
    { name:'mouth-front', angle:0, distance:2.6, pose:3 },
    { name:'mouth-profile', angle:Math.PI/2, distance:2.6, pose:3 },
    { name:'sunhat', angle:Math.PI/4, distance:2.6, wear:'sunhat' },
    { name:'ferrycap', angle:Math.PI/4, distance:2.6, wear:'ferrycap' },
    { name:'snorkel', angle:Math.PI/4, distance:2.6, wear:'snorkel' },
    { name:'wet', angle:Math.PI/4, distance:2.6, wet:true },
  ];
  const evidence = [];
  for (const fixture of fixtures) {
    await h.page.evaluate(wet => {
      const g=window.__capy,c=g.capy,f=window.__headFixture;
      f.wetMats=null;f.wetColors=null;
      if(!wet)return;
      const soaking=g.env.soaking;
      g.env.soaking=()=>1;
      for(let i=0;i<150;i++)c.update(1/60);
      if(soaking)g.env.soaking=soaking;else delete g.env.soaking;
      f.wetMats=f.nodes.map(n=>n.o.material);
      f.wetColors=new Map();
      for(const m of f.wetMats)if(m&&m.color)f.wetColors.set(m,m.color.clone());
    },!!fixture.wet);
    const frames = {}, states = {};
    for (const variant of ['before','after','hidden']) {
      states[variant] = await h.page.evaluate(({ fixture, variant }) => {
        const g = window.__capy, c = g.capy, f = window.__headFixture;
        g.state.noHeadContour = variant === 'before';
        c.update(1/60); // production flag edge; restore all poses below
        c.wear(null);
        f.restore();
        if(f.wetMats) {
          f.nodes.forEach((n,i)=>{if(f.wetMats[i])n.o.material=f.wetMats[i];});
          for(const [m,color]of f.wetColors)m.color.copy(color);
        }
        c.wear(fixture.wear || null);
        const forward=new g.THREE.Vector3(0,0,1).applyQuaternion(c.group.quaternion);
        const yaw = Math.atan2(forward.x,forward.z) + fixture.angle;
        f.target.copy(c.group.position).add(new g.THREE.Vector3(0,.20,.10));
        g.camera.position.set(f.target.x + Math.sin(yaw)*fixture.distance,
          f.target.y + fixture.distance*.28, f.target.z + Math.cos(yaw)*fixture.distance);
        g.camera.lookAt(f.target); g.camera.updateMatrixWorld();
        c.photoPose(fixture.pose || 0, g.camera.position, 1);
        c.group.updateMatrixWorld(true);
        const anchors = c.mouthAnchor.matrixWorld.elements.slice();
        if(variant==='hidden')for(const part of f.parts)part.visible=false;
        for(let i=0;i<3;i++)g.post.render(); // settle shadow/reflection caches
        const auto = g.renderer.info.autoReset;
        g.renderer.info.autoReset=false;g.renderer.info.reset();f.draws=0;g.post.render();
        const render = { ...g.renderer.info.render, headDraws:f.draws };
        g.renderer.info.autoReset=auto;
        return { contour:c.headContourAudit(), coat:c.coatAudit(), render, anchors,
          wet:c.animAudit().wetVis, worn:c.worn, biome:g.biome.current };
      }, { fixture, variant });
      frames[variant] = PNG.sync.read(await h.screenshot('reimagine-head-v2-'+fixture.name+'-'+variant));
    }
    const {width,height} = frames.before;
    const delta=(a,b,i)=>Math.max(...[0,1,2].map(c=>Math.abs(a.data[i*4+c]-b.data[i*4+c])));
    let mask=0, changed=0;
    for(let i=0;i<width*height;i++) {
      if(delta(frames.before,frames.hidden,i)>4 || delta(frames.after,frames.hidden,i)>4) {
        mask++;
        if(delta(frames.before,frames.after,i)>4)changed++;
      }
    }
    assert.equal(states.before.contour.on,false,'cut geometry');
    assert.equal(states.after.contour.on,true,'live geometry');
    assert.equal(states.before.contour.triangles,416,'inherited six pieces exact');
    assert.equal(states.after.contour.triangles,312,'closed upper and chin hulls');
    assert.deepEqual(states.after.contour.visible,[true,false,false,true,false,false]);
    assert.ok(states.after.render.headDraws<states.before.render.headDraws,'fewer head draw calls '+fixture.name);
    assert.equal(states.after.coat.bare,0,'no uncoated wet/dry geometry '+fixture.name);
    assert.deepEqual(states.before.anchors,states.after.anchors,'mouth anchor unchanged '+fixture.name);
    assert.ok(changed>0,'visible head contribution '+fixture.name);
    if(fixture.wet)assert.ok(states.after.wet>.5,'actual wet coat reached');
    evidence.push({fixture:fixture.name,mask,changed,states});
  }
  const lifecycle = await h.page.evaluate(() => {
    const g=window.__capy,c=g.capy;
    g.state.noHeadContour=true;c.update(1/60);
    const cut=c.headContourAudit();
    for(let i=0;i<120;i++)c.update(1/60);
    const stable=c.headContourAudit();
    g.state.noHeadContour=false;g.state.perfRung=1;c.update(1/60);
    const parked=c.headContourAudit();
    g.state.perfRung=0;c.update(1/60);
    const live=c.headContourAudit();
    g.state.noHeadContour=true;c.update(1/60);
    const back=c.headContourAudit();
    g.state.noRound=true;g.state.noHeadContour=false;c.update(1/60);
    const flat=c.headContourAudit();
    g.state.noHeadContour=true;c.update(1/60);g.state.noHeadContour=false;c.update(1/60);
    const flatReturn=c.headContourAudit();
    g.state.noRound=false;c.update(1/60);
    const smooth=c.headContourAudit();
    return {cut,stable,parked,live,back,flat,flatReturn,smooth};
  });
  assert.deepEqual(lifecycle.cut.geometries,lifecycle.stable.geometries,'cut does not rebuild');
  assert.deepEqual(lifecycle.cut.geometries,lifecycle.parked.geometries,'rung one restores inherited');
  assert.deepEqual(lifecycle.cut.geometries,lifecycle.back.geometries,'return reuses exact inherited geometries');
  assert.equal(lifecycle.live.on,true,'recovery enables contour');
  assert.deepEqual(lifecycle.cut.visible,lifecycle.parked.visible,'rung restores inherited visibility');
  assert.deepEqual(lifecycle.cut.visible,lifecycle.back.visible,'cut restores inherited visibility');
  assert.equal(lifecycle.flat.smooth,false,'noRound respected');
  assert.equal(lifecycle.flatReturn.smooth,false,'flag toggle preserves noRound');
  assert.equal(lifecycle.smooth.smooth,true,'round normals recover');
  assert.deepEqual(h.metadata.errors,[],'no runtime errors');
  await h.result('reimagine-head-v2',{metadata:h.metadata,evidence,lifecycle,
    note:'Controlled head geometry/pose fixtures; pixel differences prove contribution, not taste. No performance claim.'});
  console.log(JSON.stringify({evidence:evidence.map(e=>({fixture:e.fixture,mask:e.mask,changed:e.changed})),lifecycle,errors:h.metadata.errors},null,2));
} finally { await h.close(); }
