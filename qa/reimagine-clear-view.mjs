// REIMAGINE E5: execute the shipped aperture maths and uniform writer.
// Browser compilation, pixels and GPU cost remain separate acceptance gates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import * as THREE from '../vendor/three.module.js';

const source=readFileSync('src/shared.js','utf8');
const inherited=execFileSync('git',['show','ffc4045:src/shared.js'],{encoding:'utf8',maxBuffer:1500000});
const systems=readFileSync('src/systems.js','utf8');
const fn=(s,n)=>s.slice(s.indexOf('function '+n+'(')).match(/^function[\s\S]*?\n\}/)[0];
const template=(s,n)=>s.match(new RegExp('const '+n+' = `([\\s\\S]*?)`;'))[1];
const glsl=template(source,'_LENS_CAP_CUT');
const smoothstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const js=glsl.replace('float lensCapCut(float d, float t, float radius)','function lensCapCut(d,t,radius)')
  .replace(/\bfloat /g,'let ').replace(/\bmax\(/g,'Math.max(');
const evaluate=clear=>new Function('uLensClearView','smoothstep',js+';return lensCapCut;')(clear,smoothstep);
const cut=evaluate(0),live=evaluate(1);
let checks=0;
function same(a,b,message){checks++;assert.equal(a,b,message);}
function okay(value,message){checks++;assert.ok(value,message);}
function near(a,b,message){okay(Math.abs(a-b)<1e-10,message);}
// Exact inherited expression at every sampled radius/depth/distance.
for(const radius of [.3,.7,1.2])for(const t of [-.2,0,.05,.2,.4,.8,1,1.2])for(let i=0;i<=150;i++) {
  const d=i*.01;
  same(cut(d,t,radius),.8*(1-smoothstep(radius-.25,radius,d)),'cut retains original profile');
  const value=live(d,t,radius);
  okay(Number.isFinite(value)&&value>=0&&value<=1,'live discard bounded');
}
for(const t of [.05,.2,.35,.65,.9]) {
  const outer=.7,inner=.7-.10;
  same(live(0,t,.7),1,'fully clear centre');
  near(live(inner,t,.7),1,'fully clear inner radius');
  near(live(outer,t,.7),0,'opaque outside outer radius');
  near(live((inner+outer)/2,t,.7),.5,'feather midpoint');
  let previous=1;
  for(let i=0;i<80;i++){const value=live(outer*i/79,t,.7);okay(value<=previous+1e-12,'monotonic feather');previous=value;}
}
for(const t of [.01,.2,.4,.6,.8])for(const d of [.4,.55,.60,.65,.7,.8])
  same(live(d,t,.7),live(d,.5,.7),'broad world-space opening independent of depth');
for(const radius of [.7,.805,.91]) {
  near(live(radius-.10,.2,radius),1,'candidate clear core');
  near(live(radius,.2,radius),0,'candidate outer extent');
}
const kept=k=>Array.from({length:16},(_,i)=>(i+.5)/16).filter(v=>v>=k).length;
same(kept(cut(0,.5,.7)),3,'inherited core retains three Bayer pixels');
same(kept(live(0,.5,.7)),0,'clear core retains no Bayer pixels');

const oldExpression='0.8 * (1.0 - smoothstep(uLensCapR - 0.25, uLensCapR, cD))';
same(template(source,'_RIM_FS_OUT').replace('lensCapCut(cD, cT, uLensCapR)',oldExpression),
  template(inherited,'_RIM_FS_OUT'),'all colour exemptions, crowd fade and Bayer code unchanged');
const refs={a:{value:new THREE.Vector3()},b:{value:new THREE.Vector3()},r:{value:0},clear:{value:0}};
const depth=(text)=>new Function('_lensCapA','_lensCapB','_lensCapR','_lensClearView','_LENS_CAP_CUT',
  fn(text,'_lensCapDepth')+';return _lensCapDepth;')(refs.a,refs.b,refs.r,refs.clear,glsl);
const shader=()=>({uniforms:{},vertexShader:'#include <common>\n#include <project_vertex>',
  fragmentShader:'#include <common>\n#include <clipping_planes_fragment>'});
const oldDepth=shader(),newDepth=shader();depth(inherited)(oldDepth);depth(source)(newDepth);
same(newDepth.vertexShader,oldDepth.vertexShader,'depth world/instance projection unchanged');
same(newDepth.fragmentShader.replace('\nuniform float uLensClearView;\n'+glsl,'')
  .replace('lensCapCut(cD, cT, uLensCapR)',oldExpression),oldDepth.fragmentShader,'depth exemptions/discard unchanged apart from profile');
same(newDepth.uniforms.uLensClearView,refs.clear,'depth uses cached shared uniform');
for(const name of ['uLensCapA','uLensCapB','uLensCapR'])same(newDepth.uniforms[name],oldDepth.uniforms[name],'existing uniform object '+name);
okay(fn(source,'_rimInjectWith').includes('shader.uniforms.uLensClearView = _lensClearView;'),'colour uses same cached uniform');
okay(template(source,'_RIM_FS_COMMON').includes('uniform float uLensClearView;\n${_LENS_CAP_CUT}'),'GLSL helper declared after uniform');
okay(source.includes('const _selfInject = _rimInjectWith(_selfK, _selfC, _lensCapOff);'),'animal remains exempt');
const tick=new Function('_lensCapA','_lensCapB','_lensCapR','_lensClearView',fn(source,'lensCapTick')+';return lensCapTick;')
  (refs.a,refs.b,refs.r,refs.clear);
const av=refs.a.value,bv=refs.b.value;
tick(1,2,3,4,5,6,.7,true);same(refs.clear.value,1,'live uniform');
tick(1,2,3,4,5,6,.7);same(refs.clear.value,0,'old caller defaults to inherited');
tick(1,2,3,4,5,6,-1,true);same(refs.r.value,0,'radius disable preserved');
same(refs.a.value,av,'eye vector cached');same(refs.b.value,bv,'chest vector cached');

// Run the actual single systems writer, including its photo/transition gate.
const call=systems.slice(systems.indexOf('lensCapTick(camera.position')).match(/^lensCapTick\([\s\S]*?\);/)[0];
const writer=new Function('game','started','transBusy','photoLens','lensCapTick',
  'const camera={position:{x:1,y:2,z:3}},r={x:4,y:5,z:6},sysLENS_CAP_CHEST=.45,sysLENS_CAP_R=.7;'+call);
for(const state of [{},{noClearView:true},{perfRung:1},{perfRung:2},{noLensCap:true}])
  for(const started of [false,true])for(const busy of [false,true])for(const photo of [0,.6]) {
    writer({state},started,busy,photo,tick);
    same(refs.r.value,(started&&!busy&&photo<.5&&!state.noLensCap)? .7 : 0,'inherited radius gate');
    same(refs.clear.value,!state.noClearView&&(state.perfRung|0)<1?1:0,'new flag/governor writer');
  }
console.log(`Clear view: ${checks} shipped-math, broad-aperture, shader-preservation and writer checks passed.`);
