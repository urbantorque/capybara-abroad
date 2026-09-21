// D7: controlled earned-memory save, then real walking and three wheeks.
// The separate natural Palawan instrument proves earning these tasks.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tasks = ['jetty-jump', 'first-dive', 'the-manta'];
const h = await openHarness({ storage: { 'capy3.journey.v1': {
  v: 1, tasks, seen: [1,12], biome: 'palawan', ms: 90000, tut: 1, fin: 0
} } });
const name = 'reimagine-palawan-board', out = { metadata: h.metadata, samples: [],
  scope: 'Earned-memory save fixture, not natural task earning. Trusted walking/Q only after startup.' };
let held = new Set();
async function keys(want) {
  for (const k of held) if (!want.has(k)) await h.page.keyboard.up(k);
  for (const k of want) if (!held.has(k)) await h.page.keyboard.down(k);
  held = want;
}
try {
  await h.start(); await h.arrive('palawan');
  out.initial = await h.page.evaluate(() => ({ board: window.__capy.exitBoard(),
    enough: window.__capy.gateInfo(12).enough, bloom: window.__capy.palawan.seenBloom() }));
  assert.equal(out.initial.enough, true);
  assert.equal(out.initial.bloom, false, 'memory departure does not need bloom');
  const b = out.initial.board;
  assert.ok(b && b.x === 2 && b.z === 32 && b.y > -.1 && b.y < 1 && b.yaw === 0, 'board planted on shore floor facing beach approach');
  const target = { x: b.x, z: b.z + 2.7 }, until = Date.now() + 18000;
  while (Date.now() < until) {
    const s = await h.page.evaluate(() => { const g=window.__capy; return {
      p:g.capy.position.toArray(), yaw:g.input.camYaw, hidden:document.hidden,
      paused:!!g.state.paused, t:g.state.time }; });
    out.samples.push(s); assert.ok(!s.hidden && !s.paused);
    const dx=target.x-s.p[0], dz=target.z-s.p[2];
    if (Math.hypot(dx,dz)<.35) break;
    const x=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw), z=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw);
    const want=new Set();
    if(Math.abs(x)>Math.abs(z)*.42)want.add(x>0?'d':'a');
    if(Math.abs(z)>Math.abs(x)*.42)want.add(z>0?'s':'w');
    await keys(want); await h.page.waitForTimeout(100);
  }
  await keys(new Set()); await h.page.waitForTimeout(350);
  out.arrived=await h.page.evaluate(()=>window.__capy.capy.position.toArray());
  assert.ok(Math.hypot(out.arrived[0]-b.x,out.arrived[2]-b.z)<3.5, 'walk reaches board action radius');
  await h.screenshot(name+'-approach');
  for(let i=0;i<3;i++){await h.hold('q',80);await h.page.waitForTimeout(220);}
  await h.page.waitForFunction(()=>document.querySelector('.capyui-jr')?.classList.contains('show'),null,{timeout:5000});
  await h.page.waitForTimeout(900);
  await h.screenshot(name+'-open');
  out.end=await h.page.evaluate(()=>({bloom:window.__capy.palawan.seenBloom(),
    text:document.querySelector('.capyui-jr').textContent}));
  assert.equal(out.end.bloom,false,'board opens before bloom');
  assert.deepEqual(h.metadata.errors,[]);
  await h.result(name,out);console.log(JSON.stringify({pass:true,board:b,samples:out.samples.length,errors:h.metadata.errors}));
}catch(error){out.failure=String(error.stack||error);await h.screenshot(name+'-failure');await h.result(name+'-failure',out);throw error;}
finally{await keys(new Set());await h.close();}
