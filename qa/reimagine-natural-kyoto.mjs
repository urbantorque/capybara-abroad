// REIMAGINE G: earn Kyoto's authored route memory with real keys. The river
// driver reads the live centreline and flow audit; it never moves the body,
// clock, task ledger, camera or input state from page code.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness(), name = 'reimagine-natural-kyoto';
const journeyMode = process.argv.includes('--journey');
const ids = ['golden-swim', 'uji-run', 'matcha-raid'];
const report = { metadata: h.metadata, steps: [], navigation: [], river: [], keys: [] };
const keys = new Set();

async function release() {
  for (const key of keys) await h.page.keyboard.up(key);
  keys.clear();
}

async function sample(label) {
  const row = await h.page.evaluate(({label,ids}) => {
    const g = window.__capy, p = g.capy.position, k = g.kyoto;
    const a = k && k.runAudit ? k.runAudit() : null;
    return { label, t: g.state.time, wall: performance.now(), hidden: document.hidden,
      paused: !!g.state.paused, pos: p.toArray(), swimming: !!g.capy.swimming,
      inRiver: !!(k && k.inRiver && k.inRiver()), riverMid: k && k.riverMid ? k.riverMid() : null,
      run: a, mix: g.hud && g.hud.mixAudit ? g.hud.mixAudit() : null,
      mover: g.hud && g.hud.moverAudit ? g.hud.moverAudit() : null,
      tasks: Object.fromEntries(ids.map(id => [id, g.taskDone(id)])), gate: g.gateInfo(4) };
  }, {label,ids});
  report.steps.push(row); console.log(JSON.stringify({label,t:row.t,pos:row.pos,tasks:row.tasks}));return row;
}

async function clearDetour(target) {
  return h.page.evaluate(target => {
    const g=window.__capy,p=g.capy.body.position,k=g.kyoto,V=p.constructor;
    const angle=Math.atan2(target.z-p.z,target.x-p.x), candidates=[];
    for(const turn of [Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75,Math.PI]) {
      for(const distance of [4,7]) {
        const a=angle+turn,q={x:p.x+Math.cos(a)*distance,z:p.z+Math.sin(a)*distance};
        const hits=[], ground=k.terrainHeight(q.x,q.z), blocked=k.navBlocked(q.x,q.z,.8);
        for(const offset of [-.5,0,.5]) {
          const ox=-Math.sin(a)*offset,oz=Math.cos(a)*offset;
          g.world.raycastAll(new V(p.x+ox,p.y+.25,p.z+oz),new V(q.x+ox,p.y+.25,q.z+oz),
            {skipBackfaces:true}, hit=>{
              if(hit.hasHit&&hit.body!==g.capy.body&&hit.body.collisionResponse!==false)
                hits.push({body:hit.body.id,distance:hit.distance,position:hit.body.position.toArray()});
            });
        }
        candidates.push({target:q,hits,ground,blocked});
      }
    }
    return {from:p.toArray(),candidates,
      chosen:candidates.find(c=>!c.blocked&&!c.hits.length&&c.ground<p.y+.65)?.target||null};
  },target);
}

async function walkTo(target, radius = 1.4, maxMs = 50000, detours=2) {
  const started = Date.now(); let best = Infinity, progressAt = Date.now(), jumps=0;
  try {
    while (Date.now() - started < maxMs) {
      const s = await h.page.evaluate(target => {
        const g = window.__capy, p = g.capy.position;
        const q = typeof target==='string' ? g.hintTarget(target) : target;
        return { p: p.toArray(), target: q, yaw: g.input.camYaw, t: g.state.time,
          inRiver:g.kyoto.inRiver(),done:typeof target==='string'&&g.taskDone(target),
          velocity: g.capy.body.velocity.toArray() };
      }, target);
      assert.ok(s.target, 'actual waypoint exists: ' + target);
      const dx = s.target.x - s.p[0], dz = s.target.z - s.p[2], d = Math.hypot(dx, dz);
      report.navigation.push({ target, ...s, distance: d });
      if(s.done)return;
      if(target==='uji-run'&&s.inRiver)return;
      if (d < radius) return;
      if (d < best - .35) { best = d; progressAt = Date.now(); }
      const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
      const want = new Set();
      if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
      if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
      for (const key of [...keys]) if (!want.has(key)) { await h.page.keyboard.up(key); keys.delete(key); }
      for (const key of want) if (!keys.has(key)) { await h.page.keyboard.down(key); keys.add(key); }
      if (Date.now() - progressAt > 4500) {
        if(jumps<1){await h.page.keyboard.press('Space');jumps++;progressAt=Date.now();}
        else if(detours>0){
          await release();
          const detour=await clearDetour(s.target);
          report.navigation.push({detour});
          assert.ok(detour.chosen,'no clear physical detour corridor: '+JSON.stringify(detour));
          await walkTo(detour.chosen,1,14000,0);detours--;best=Infinity;progressAt=Date.now();jumps=0;
        }else throw new Error('walk stuck after bounded real-key avoidance: '+JSON.stringify(s));
      }
      await h.page.waitForTimeout(160);
    }
    throw new Error('walk waypoint timed out: ' + target);
  } finally { await release(); }
}

async function swimPond() {
  // Leave Gion through the open end before crossing the solid shop rows.
  // The pond approach then stays west of its shoreline boulder at (12,22).
  await walkTo({x:-56,z:52});
  // The Zen garden occupies x[-49,-19], z[-2,18]; stay south of its wall.
  await walkTo({x:-56,z:-10});await walkTo({x:-16,z:-10});
  await walkTo({x:-16,z:0});
  await walkTo({x:8,z:-4},2.2);
  await h.page.waitForFunction(() => window.__capy.taskDone('golden-swim'), null, { timeout: 7000 });
}

async function runRiver(maxMs = 150000) {
  const started = Date.now(); let lastPos=null, progressAt = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      const s = await h.page.evaluate(() => {
        const g = window.__capy, k = g.kyoto, p = g.capy.position;
        const a = k.runAudit(), near = k.aheadOnRiver(p.x, p.z, g.capy.swimming ? 4 : 2);
        const q={x:near.x,z:near.z},hint=g.hintTarget('uji-run');
        const hintCopy=hint?{x:hint.x,z:hint.z}:null;
        const ahead=k.aheadOnRiver(p.x,p.z,16);
        return { p: p.toArray(), target: q, yaw: g.input.camYaw, t: g.state.time,
          hint:hintCopy,ahead:{x:ahead.x,z:ahead.z},chute:k.chuteAt(),
          audit: a, inRiver: !!k.inRiver(), mid: k.riverMid(), swimming: !!g.capy.swimming,
          flow: k.runFlow ? k.runFlow() : null, velocity: g.capy.body.velocity.toArray() };
      });
      report.river.push({ ...s, distance: s.target ? Math.hypot(s.target.x - s.p[0], s.target.z - s.p[2]) : null });
      if(s.inRiver)assert.ok(s.hint&&Math.hypot(s.hint.x-s.ahead.x,s.hint.z-s.ahead.z)<.001,'production hint follows actual river centreline');
      if(s.chute?.fired&&!report.chuteCapture){report.chuteCapture=true;await h.screenshot(name+'-chute');}
      if (s.audit && s.audit.done) return;
      assert.ok(s.target, 'river centreline target exists');
      const d = Math.hypot(s.target.x - s.p[0], s.target.z - s.p[2]);
      if (!lastPos || Math.hypot(s.p[0]-lastPos[0],s.p[2]-lastPos[2])>2) { lastPos=s.p;progressAt=Date.now(); }
      if (Date.now() - progressAt > 12000) throw new Error('river run stalled: ' + JSON.stringify(s));
      // Movement is camera-relative. W advances; A/D make the authored
      // lateral correction without writing camYaw or any other game state.
      const dx = s.target.x - s.p[0], dz = s.target.z - s.p[2];
      const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
      const want = new Set();
      if (Math.abs(x)>Math.abs(z)*.42)want.add(x>0?'d':'a');
      if (Math.abs(z)>Math.abs(x)*.42)want.add(z>0?'s':'w');
      for (const key of [...keys]) if (!want.has(key)) { await h.page.keyboard.up(key); keys.delete(key); }
      for (const key of want) if (!keys.has(key)) { await h.page.keyboard.down(key); keys.add(key); }
      await h.page.waitForTimeout(140);
    }
    throw new Error('river run timed out');
  } finally { await release(); }
}

try {
  await h.page.evaluate(() => {
    window.__naturalKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__naturalKeys.push({ type, key: e.code, trusted: e.isTrusted, t: window.__capy.state.time }));
  });
  await h.start(); await h.arrive('kyoto'); await sample('fresh Kyoto arrival');
  await swimPond(); await sample('golden swim earned');
  // Gion has two solid shop rows; use the open western end of the lane.
  await walkTo({x:-16,z:0});await walkTo({x:-16,z:-10});
  await walkTo({x:-56,z:-10});
  await walkTo({x:-56,z:80});
  await h.page.locator('.capyui-txt').filter({hasText:/^Ride the Uji rapids down to the mill$/}).click();
  await walkTo('uji-run', 2.4); await sample('river entry waypoint');
  await runRiver();
  await h.page.waitForFunction(() => window.__capy.taskDone('uji-run'), null, { timeout: 12000 });
  const runEnd = await sample('uji run earned'); await h.screenshot(name + '-uji');
  assert.equal(runEnd.run.done,true,'authored river finish awarded');
  report.riverQuality = { through: runEnd.run.through, chute: !!report.chuteCapture,
    required: journeyMode ? 'authored finish' : 'three gates and chute' };
  if (!journeyMode) {
    assert.equal(runEnd.run.through,3,'all three boat gates crossed');
    assert.equal(report.chuteCapture,true,'actual chute launch observed');
  }
  // Approach south of the authored tea bowl (24,196), whose rim is solid.
  await walkTo({x:42,z:212});await walkTo({x:14.4,z:212});
  await walkTo('matcha-raid', 1.8);
  await h.page.waitForFunction(() => window.__capy.taskDone('matcha-raid'), null, { timeout: 12000 });
  const end = await sample('natural Kyoto memory'); await h.screenshot(name + '-memory');
  // Separate the four-second reward cloud from persistent world occlusion.
  await h.page.waitForTimeout(4300);
  await sample('matcha reward settled'); await h.screenshot(name + '-memory-settled');
  assert.ok(ids.every(id => end.tasks[id]), 'signature plus two support actions earned');
  assert.equal(end.gate.enough, true, 'Kyoto signature plus two supports earns route memory');
  await h.page.waitForFunction(ids => {
    const save = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
    return ids.every(id => save.tasks?.includes(id));
  }, ids, { timeout: 12000 });
  report.saved = await h.page.evaluate(() => ({
    tasks: JSON.parse(localStorage.getItem('capy3.journey.v1')).tasks,
    gate: window.__capy.gateInfo(4) }));
  assert.equal(report.saved.gate.enough, true);
  report.keys = await h.page.evaluate(() => window.__naturalKeys);
  assert.ok(report.keys.length > 0 && report.keys.every(key => key.trusted), 'all controls were trusted keys');
  await h.page.reload(); await h.start();
  const resumed = await sample('earned Kyoto memory resumed');
  assert.ok(ids.every(id => resumed.tasks[id]) && resumed.gate.enough, 'route memory survives reload');
  assert.ok(report.steps.every(row => !row.hidden && !row.paused));
  assert.deepEqual(h.metadata.errors, []);
  report.scope = 'Natural Kyoto pond swim, Uji river run, matcha raid and save/reload from fresh arrival; live hints and river telemetry, no task/body/clock/input-state seeding.';
  await h.result(name, report);
  console.log(JSON.stringify({steps:report.steps.map(s=>({label:s.label,t:s.t,tasks:s.tasks,memory:s.gate.enough})),
    riverSamples:report.river.length,errors:h.metadata.errors},null,2));
} catch (error) {
  await release();
  try { await sample('failure'); } catch {}
  report.failure = String(error.stack || error);
  if (!report.keys.length) report.keys = await h.page.evaluate(() => window.__naturalKeys || []);
  try { await h.screenshot(name + '-failure'); } catch {}
  await h.result(name + '-failure', report);
  throw error;
} finally { await h.close(); }
