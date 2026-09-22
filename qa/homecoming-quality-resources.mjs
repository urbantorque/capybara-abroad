// Resource attribution fixture for four chapters. The settings arms are
// synthetic input events; this records references and programs, not FPS or a
// leak verdict.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const chapters = ['kyoto', 'cali', 'iceland', 'antarctic'];
const tag = process.argv[2] || 'v1';
assert(/^[\w-]+$/.test(tag), 'safe result tag');
const h = await openHarness({ storage: { 'capy3.prefs.v1': { v: 1, pf: 1 } } });
const out = { tag, chapters, settingsFixture: true, metadata: h.metadata, rows: [] };
const arms = [{ value: 2, mode: 'fast', rung: 3 }, { value: 1, mode: 'pretty', rung: 0 },
  { value: 2, mode: 'fast', rung: 3 }, { value: 1, mode: 'pretty', rung: 0 }];

async function readResources(chapter, arm) {
  return h.page.evaluate(({ chapter, arm, chapters }) => {
    const g = window.__capy, seen = new Set(), refs = new Map();
    const addObject = (o, source, parentVisible = true) => {
      if (!o || seen.has(o.uuid)) return;
      seen.add(o.uuid);
      if (o.geometry && o.geometry.uuid) {
        const id = o.geometry.uuid, type = o.geometry.type || 'unknown';
        let row = refs.get(id);
        if (!row) row = { uuid: id, type, objects: [], visible: false, sources: new Set() };
        row.objects.push(o.name || '(unnamed)'); row.visible ||= parentVisible && !!o.visible;
        row.sources.add(source); refs.set(id, row);
      }
      if (o.children) for (const child of o.children) addObject(child, source, parentVisible && !!o.visible);
    };
    addObject(g.scene, 'scene', true);
    for (const name of chapters) for (const root of (g.biome.objectsOf(name) || [])) addObject(root, name, true);
    const grouped = {};
    for (const row of refs.values()) {
      const type = row.type;
      if (!grouped[type]) grouped[type] = { visible: [], invisible: [] };
      (row.visible ? grouped[type].visible : grouped[type].invisible).push(row.uuid);
      row.sources = [...row.sources];
    }
    for (const group of Object.values(grouped)) { group.visible.sort(); group.invisible.sort(); }
    const programs = (g.renderer.info.programs || []).map(p => ({
      key: p.cacheKey || p.name || String(p.id || ''), name: p.name || null, type:p.type,
      cacheKey: p.cacheKey || null, usedTimes: p.usedTimes ?? null,
    }));
    const materials = {};
    const allObjects = [];
    g.scene.traverse(o => allObjects.push(o));
    for (const name of chapters) for (const root of (g.biome.objectsOf(name) || [])) {
      root.traverse(o => allObjects.push(o));
    }
    for (const o of allObjects) {
      const ms = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of ms) {
        let ps;
        try { ps = g.renderer.properties.get(m)?.programs; } catch (e) { ps = null; }
        if (!ps) continue;
        for (const p of ps.values()) {
          const key = p.cacheKey || p.name || String(p.id || '');
          const item = materials[key] || (materials[key] = { types: [], names: [] });
          if (!item.types.includes(m.type)) item.types.push(m.type);
          if (m.name && !item.names.includes(m.name)) item.names.push(m.name);
        }
      }
    }
    const p = g.capy?.body?.position;
    const audit = typeof g.personContourAudit === 'function' ? g.personContourAudit() : null;
    return {
      chapter: g.biome.current, arm, mode: g.perfAudit().mode, rung: g.perfAudit().rung,
      focused: document.hasFocus() && !document.hidden, hidden: document.hidden,
      paused: !!g.state.paused, lastError: g.state.lastError || null,
      finitePosition: !!p && [p.x, p.y, p.z].every(Number.isFinite),
      position: p ? [p.x, p.y, p.z] : null,
      geometryRefs: [...refs.values()].map(row => ({ ...row, sources: [...row.sources] })),
      grouped, memory: { geometries: g.renderer.info.memory.geometries,
        textures: g.renderer.info.memory.textures, programs: programs.length },
      programs, programMaterials: materials, personContour: audit,
    };
  }, { chapter, arm, chapters: CHAPTERS });
}

function delta(before, after) {
  const oldIds = new Set((before?.geometryRefs || []).map(x => x.uuid));
  const newIds = new Set((after.geometryRefs || []).map(x => x.uuid));
  const oldPrograms = new Set((before?.programs || []).map(x => x.key));
  const newPrograms = (after.programs || []).filter(x => !oldPrograms.has(x.key));
  return {
    geometryAdded: (after.geometryRefs || []).filter(x => !oldIds.has(x.uuid)),
    geometryRemoved: (before?.geometryRefs || []).filter(x => !newIds.has(x.uuid)),
    programAdded: newPrograms.map(p => ({ ...p, materials: after.programMaterials[p.key] || null })),
    memory: after.memory,
  };
}

try {
  await h.start();
  await h.page.waitForFunction(() => !window.__capy.state.renderHold && window.__capy.state.frames > 0);
  for (const chapter of chapters) {
    await h.arrive(chapter);
    await h.page.waitForFunction(()=>!window.__capy.state.renderHold);
    await h.page.waitForTimeout(1000);
    let previous = await readResources(chapter, { value: null, mode: 'arrival', rung: null });
    assert.equal(previous.chapter, chapter);
    assert(previous.focused && !previous.hidden && !previous.paused && previous.lastError === null);
    assert(previous.finitePosition);
    for (const arm of arms) {
      const applied = await h.page.evaluate(value => {
        const input = document.querySelector('input[aria-label="performance"]');
        if (!input) throw new Error('performance settings input missing');
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return input.value;
      }, arm.value);
      assert.equal(applied, String(arm.value));
      await h.page.waitForTimeout(3000);
      const current = await readResources(chapter, arm);
      assert.equal(current.mode, arm.mode, `${chapter} mode arm`);
      assert.equal(current.rung, arm.rung, `${chapter} rung arm`);
      assert(current.focused && !current.hidden && !current.paused && current.lastError === null);
      assert(current.finitePosition);
      const row = { chapter, arm, before: previous, after: current, delta: delta(previous, current) };
      out.rows.push(row);
      await h.result('homecoming-quality-resources-' + tag, out);
      console.log(JSON.stringify({ chapter, arm: arm.mode, rung: current.rung,
        addedGeometry: row.delta.geometryAdded.length, removedGeometry: row.delta.geometryRemoved.length,
        addedPrograms: row.delta.programAdded.length, memory: current.memory }));
      previous = current;
    }
  }
  assert.equal(out.rows.length, chapters.length * arms.length);
  assert.equal(h.metadata.errors.length, 0);
  out.pass = true;
} catch (error) {
  out.pass = false; out.failure = String(error.stack || error); process.exitCode = 1;
  console.error(out.failure);
} finally {
  try { await h.result('homecoming-quality-resources-' + tag, out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ tag, pass: out.pass, rows: out.rows.length, failure: out.failure || null }));
}
