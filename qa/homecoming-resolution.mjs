// Actual production helpers, with renderer/targets replaced by counters.
// Browser runs separately establish frame pacing and visual coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const systems=readFileSync('src/systems.js','utf8'),main=readFileSync('src/main.js','utf8');
const extract=(source,name)=>{
  const match=source.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));
  assert(match,'actual helper '+name);return match[0];
};
const calls=[],game={state:{},post:{enabled:true}};
const renderer={setPixelRatio:v=>calls.push(['ratio',v]),setSize:(...v)=>calls.push(['canvas',...v])};
const context=vm.createContext({game,renderer,window:{devicePixelRatio:2,innerWidth:1280,innerHeight:760},sysMaxDPR:()=>1.5});
vm.runInContext('let dprScale=1;'+extract(systems,'applyDPR')+extract(systems,'sysPerfResolution'),context);
for(const scale of [1,.8,.6,1]){
  context.scale=scale;vm.runInContext('sysPerfResolution(scale)',context);
  assert.equal(game.state.sceneScale,scale);assert.equal(calls.length,0,'post scaling never resizes canvas');
}
vm.runInContext('applyDPR()',context);
assert.deepEqual(calls.splice(0),[['ratio',1.5],['canvas',1280,760]],'window resize retains native capped DPR');
game.post.enabled=false;
context.scale=.6;vm.runInContext('sysPerfResolution(scale)',context);
assert.equal(game.state.sceneScale,1);
assert(Math.abs(calls[0][1]-.9)<1e-9,'direct-render fallback retains authored reduction');
assert.equal(calls[1][0],'canvas');calls.length=0;
const sizes=[],uniform={value:{set:(...v)=>sizes.push(['uniform',...v])}};
const target=name=>({setSize:(...v)=>sizes.push([name,...v])});
const q=vm.createContext({game,post:{},renderer:{getDrawingBufferSize:()=>({x:1280,y:760})},mainPostSize:{},
  sceneRT:target('scene'),bloomA:target('bloomA'),bloomB:target('bloomB'),wideA:target('wideA'),wideB:target('wideB'),
  dofA:target('dofA'),dofB:target('dofB'),aoA:target('aoA'),aoB:target('aoB'),matBright:{uniforms:{uTexel:uniform}},matCoC:{uniforms:{uTexel:uniform}},matComp:{uniforms:{uPx:uniform,uAoPx:uniform}}});
const resize=main.match(/  post.resize = function \(\) \{[^]*?\n  \};/)[0];
vm.runInContext('let vw=0,vh=0,bw=0,bh=0,ww=0,wh=0,aw=0,ah=0;'+resize,q);
for(const scale of [1,.8,.6,1]){
  game.state.sceneScale=scale;sizes.length=0;vm.runInContext('post.resize()',q);
  assert.deepEqual(sizes[0],['scene',Math.floor(1280*scale),Math.floor(760*scale)]);
  assert.equal(sizes.filter(s=>s[0]!=='uniform').length,9,'all existing targets resize together');
  assert.deepEqual(sizes.find(s=>s[0]==='aoA'),['aoA',Math.floor(1280*scale)>>1,Math.floor(760*scale)>>1],'the occlusion is half the scene');
  sizes.length=0;vm.runInContext('post.resize()',q);assert.equal(sizes.length,0,'stable dimensions allocate nothing');
}
const branch=systems.match(/      if \(pfMs > sysPF_SLOW_MS \|\| lateFraction[^]*?else \{ pfSlowT = 0; pfFastT = 0; \}/)[0];
for(const [mean,cpu,late,slow,fast] of [[17,5,.2,.5,0],[17,5,0,0,.5],[17,5,.05,0,0],[23,5,0,.5,0],[17,20,0,0,0],[17,5,.06,.5,0],[17,5,.02,0,0]]){
  const c=vm.createContext({pfMs:mean,tickMs:cpu,lateFraction:late,sysPF_SLOW_MS:22,sysPF_TICK_FAST_MS:10,
    win:.5,pfSlowT:0,pfFastT:0});vm.runInContext(branch,c);
  assert.equal(c.pfSlowT,slow);assert.equal(c.pfFastT,fast);
}
assert(systems.includes('if (fpsDt > 0.020) pfLateFrames++;'));
assert(systems.includes('const lateFraction = pfLateFrames / fpsFrames;\n      pfLateFrames = 0;'));
console.log('Homecoming resolution: stable canvas, fallback, nine target dimensions, reuse and seven governor windows pass.');
