// Real-key Monaco rehearsal: authored route, no task/save/body/input writes.
// The piano climb is deliberately reported as unverified until a headful run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export async function monacoMemory(h, tag = 'v1', route = 'race') {
  const chapter = 'monaco';
  assert(/^[\w.-]+$/.test(tag), 'safe artifact tag');
  assert(['race','casino'].includes(route));
  const ids = route === 'race' ? ['the-tunnel', 'superyacht'] : ['piano-solo', 'champagne'];
  const out = { chapter, ids, steps: [], navigation: [], scope: 'Real keys with public Monaco targets; arrival is the only fixture.', unverifiedNavigation: true };
  const held = new Set();
  async function keys(want) {
    for (const k of [...held]) if (!want.has(k)) { await h.page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await h.page.keyboard.down(k); held.add(k); }
  }
  async function state() {
    return h.page.evaluate(ids => {
      const g = window.__capy, p = g.capy.body.position, yaw = g.input.camYaw;
      const m = g.monaco;
      const finite = ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));
      return { p: { x: p.x, y: p.y, z: p.z }, forward: { x: -Math.sin(yaw), z: -Math.cos(yaw) }, finite, chapter: g.biome.current,
        focused: document.hasFocus() && !document.hidden, paused: !!g.state.paused,
        error: g.state.lastError || null, tasks: Object.fromEntries(ids.map(id => [id, g.taskDone(id)])),
        piano: m && m.piano, tower: m && m.tower };
    }, ids);
  }
  async function walk(target, radius = 1.5, limit = 45000, hop = false) {
    let best = Infinity, moved = Date.now(), detours = 0, nextHop = 0;
    const until = Date.now() + limit;
    try {
      while (Date.now() < until) {
        const s = await state();
        assert(s.focused && !s.paused && s.chapter === chapter && !s.error, 'live focused route');
        assert(s.finite, 'finite body');
        const dx = target.x - s.p.x, dz = target.z - s.p.z, d = Math.hypot(dx, dz);
        out.navigation.push({ target, d, p: s.p });
        if (d < radius) return;
        if (d < best - 0.5) { best = d; moved = Date.now(); }
        let f = (dx * s.forward.x + dz * s.forward.z) / d;
        let r = (-dx * s.forward.z + dz * s.forward.x) / d;
        if (Date.now() - moved > 4000) {
          assert(detours < 4, 'bounded approach blocked');
          const side = 1; detours++; [f, r] = [-r * side, f * side]; moved = Date.now(); best = d;
          await keys(new Set(f > 0.28 ? ['KeyW'] : f < -0.28 ? ['KeyS'] : r > 0.28 ? ['KeyD'] : ['KeyA']));
          await h.page.keyboard.press('Space');await h.page.waitForTimeout(1500); continue;
        }
        const want = new Set(); if (f > 0.28) want.add('KeyW'); if (f < -0.28) want.add('KeyS');
        if (r > 0.28) want.add('KeyD'); if (r < -0.28) want.add('KeyA');
        await keys(want);
        if (hop && Date.now() >= nextHop) { await h.page.keyboard.press('Space'); nextHop = Date.now() + 700; }
        await h.page.waitForTimeout(100);
      }
      throw Error('walk timed out: ' + JSON.stringify(target));
    } finally { await keys(new Set()); }
  }
  function localPoint(piano, lx) {
    const c = Math.cos(-0.9), s = Math.sin(-0.9), lz = 0.4;
    return { x: piano.x + c * lx + s * lz, z: piano.z - s * lx + c * lz };
  }
  try {
    await h.start(); await h.arrive(chapter); await h.page.bringToFront();
    await h.page.waitForTimeout(1000);
    out.steps.push(await state());
    if (route === 'race') {
      await walk({x:10,z:-85},1.2,20000);
      await walk({x:10,z:-76},1.2,20000,true);
      await h.page.waitForFunction(()=>window.__capy.taskDone('superyacht'),null,{timeout:8000});
      await walk({x:10,z:-85},1.2,20000,true);
      const grid = await h.page.evaluate(()=>window.__capy.monaco.gridCar());
      await walk(grid,3.0,25000);
      await h.page.keyboard.press('KeyE');
      await h.page.waitForFunction(()=>window.__capy.monaco.race().on);
      const deadline=Date.now()+180000;
      while(Date.now()<deadline){
        const r=await h.page.evaluate(()=>window.__capy.monaco.race());
        if((await state()).tasks['the-tunnel'])break;
        assert(r.on,'real race remains mounted');
        const want=new Set(['KeyW']);
        if(r.lat>0.5)want.add('KeyA');else if(r.lat<-.5)want.add('KeyD');
        await keys(want);await h.page.waitForTimeout(100);
      }
      await keys(new Set(['KeyS']));await h.page.waitForTimeout(3000);await keys(new Set());
      await h.page.keyboard.press('KeyE');
      out.race=await h.page.evaluate(()=>window.__capy.monaco.race());
      assert((await state()).tasks['the-tunnel'],'real driven lap earns memory');
    } else {
    const piano = await h.page.evaluate(() => window.__capy.monaco.piano);
    assert(piano && Number.isFinite(piano.x) && Number.isFinite(piano.z), 'public piano target');
    const tower = (await state()).tower;
    assert(tower && Number.isFinite(tower.x) && Number.isFinite(tower.z), 'public champagne target');
    const source=readFileSync(new URL('../src/monaco.js',import.meta.url),'utf8');
    const track=vm.runInNewContext(source.match(/const monTRACK = (\[[\s\S]*?\n\]);/)[1]);
    // Follow the dry western quay and the actual climb to Casino Square.
    // A direct line from spawn crosses the harbour basin below the terrace.
    for(const i of [13,14,15,16,17,18,0,1,2,3,4])
      await walk({x:track[i][0],z:track[i][1]},2,60000);
    // The traveller occupies the middle of the steps; approach beside it.
    await walk({ x: 112, z: 98 }, 1.5,20000);
    await walk({ x: 118, z: 105 }, 2.5, 20000);
    // The salon has an interior wall; cross its central arch before turning.
    await walk({ x: 118, z: 122 }, 1.5, 20000);
    await walk({ x: 113, z: 135 }, 1.5, 20000);
    await walk(tower, 1.5, 20000);
    await h.page.waitForTimeout(500);
    assert((await state()).tasks.champagne, 'real casino-floor sprint earns champagne support');
    await walk({ x: 113, z: 135 }, 1.5, 20000);
    await walk({ x: 118, z: 122 }, 1.5, 20000);
    await walk({ x: 118, z: 109 }, 1.5, 20000);
    await walk({ x: 133, z: 113 }, 1.5, 20000);
    const first = localPoint(piano, -1.35), last = localPoint(piano, 1.35);
    await walk(first, 0.34, 12000, true);
    await walk(last, 0.34, 3500, true);
    await h.page.waitForFunction(id => window.__capy.taskDone(id), 'piano-solo', { timeout: 12000 });
    }
    out.steps.push(await state());
    await h.page.waitForFunction(ids => ids.every(id => window.__capy.taskDone(id)), ids);
    await h.page.waitForFunction(ids => { const s = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}'); return ids.every(id => s.tasks?.includes(id)); }, ids);
    out.saved = await h.page.evaluate(() => JSON.parse(localStorage.getItem('capy3.journey.v1')));
    out.gate=await h.page.evaluate(()=>window.__capy.gateInfo(18));
    assert(out.gate.enough,'actual Monaco memory gate');
    assert.equal(h.metadata.errors.length, 0); out.pass = true;out.unverifiedNavigation=false;
  } catch (e) {
    out.pass = false; out.failure = String(e.stack || e);
    try { await h.screenshot('homecoming-monaco-memory-' + tag + '-failure'); } catch {}
    throw Object.assign(e, { routeEvidence: out });
  }
  finally { await keys(new Set()); await h.result('homecoming-monaco-memory-' + tag, out); }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const h = await openHarness();
  try { const out = await monacoMemory(h, process.argv[2] || 'v1',process.argv[3]||'race'); console.log(JSON.stringify({ chapter: out.chapter, pass: out.pass })); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { await h.close(); }
}
