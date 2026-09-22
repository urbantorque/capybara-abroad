// Differentiate a saved-game cold start from repeated arrivals before reload.
// This is a fixture traversal, not an earned journey or a crash root-cause test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'v1';
const source = process.argv[3] || 'qa/homecoming-journey-chain-resumed-v8-failure.json.png';
assert.match(tag, /^[\w.-]+$/);
const prior = JSON.parse(readFileSync(source, 'utf8'));
const save = prior.lastSave || prior.gates?.at(-1)?.saved;
assert(prior.failure && save?.arcV1 === 1 && save?.journeyMode === 'story');
assert((save.tasks || []).length >= 24, 'use the actual Kyoto earned checkpoint');

const h = await openHarness({ story: true, storage: { 'capy3.journey.v1': save } });
const out = { scope: 'One owned headful Edge context, exact prior earned Kyoto save. Cold start, one baseline reload, rapid Sydney/Quay/Pasto/Pantanal/Kyoto arrivals without tasks, then reload. No production writes, no earned-route claim.',
  source, tag, savedTasks: save.tasks.length, metadata: h.metadata, rows: [] };
let stage = 'initial';
let cdp = null;
try {
  cdp = await h.context.newCDPSession(h.page);
  try { await cdp.send('Performance.enable'); } catch {}
  async function sample(label) {
    const row = { label, at: new Date().toISOString(), stage };
    try {
      row.game = await h.page.evaluate(() => {
        const g = window.__capy;
        return { ready: !!g, started: !!g?.state?.started,
          chapter: g?.biome?.current, time: g?.state?.time,
          frames: g?.state?.frames, error: g?.state?.lastError,
          focused: document.hasFocus(), hidden: document.hidden,
          renderer: g?.renderer ? { memory: { ...g.renderer.info.memory },
            programs: g.renderer.info.programs?.length ?? null } : null,
          bodies: g?.world?.bodies?.length ?? null,
          heap: performance.memory?.usedJSHeapSize ?? null };
      });
    } catch (error) { row.gameError = String(error.message || error); }
    if (cdp) {
      try { const p = await cdp.send('Performance.getMetrics');
        row.cdp = Object.fromEntries(['JSHeapUsedSize','Documents','Nodes'].map(k =>
          [k, p.metrics?.find(m => m.name === k)?.value ?? null]));
      } catch (error) { row.cdpError = String(error.message || error); }
    }
    out.rows.push(row);
    await h.result('homecoming-kyoto-reload-' + tag, out);
    console.log(JSON.stringify({ label, stage, game: row.game, errors: h.metadata.errors.length }));
  }
  async function reload(label) {
    stage = label + '-navigation';
    await h.page.reload({ waitUntil: 'load', timeout: 30000 });
    await h.page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go, .capyui-carry'));
    stage = label + '-before-start';
    await sample(label + '-before-start');
    stage = label + '-start';
    await h.start();
    await sample(label + '-started');
  }
  await h.start();
  await sample('cold-start');
  await reload('baseline-reload');
  for (const name of ['sydney', 'quay', 'pasto', 'pantanal', 'kyoto']) {
    stage = 'arrive-' + name;
    await h.arrive(name);
    await sample(stage);
  }
  await reload('after-arrivals-reload');
  assert.equal(h.metadata.errors.length, 0, 'no runtime error or target crash');
  out.pass = true;
} catch (error) {
  out.pass = false;
  out.failure = { stage, error: String(error.stack || error) };
  process.exitCode = 1;
} finally {
  try { await h.result('homecoming-kyoto-reload-' + tag, out); } catch {}
  try { await h.close(); } catch {}
  console.log(JSON.stringify({ pass: out.pass, stage, failure: out.failure,
    rows: out.rows.length, errors: h.metadata.errors }));
}
