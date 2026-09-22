// Headful sampling profiler under real movement; samples are attribution,
// not a frame-rate result. Browser/GPU waits can appear as native/idle time.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'hanoi';
assert(CHAPTERS.includes(chapter));
const h = await openHarness();
const out = { chapter, metadata: h.metadata };
try {
  await h.start(); await h.arrive(chapter); await h.page.waitForTimeout(4000);
  const cdp = await h.context.newCDPSession(h.page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await h.hold('KeyW', 5000); await h.hold('KeyD', 5000); await h.hold('KeyS', 5000);
  out.profile = (await cdp.send('Profiler.stop')).profile;
  const nodes = new Map(out.profile.nodes.map(n => [n.id, n]));
  const costs = new Map();
  for (let i = 0; i < out.profile.samples.length; i++) {
    const node = nodes.get(out.profile.samples[i]);
    const frame = node.callFrame;
    const key = [frame.functionName || '(anonymous)', frame.url, frame.lineNumber + 1].join(' ');
    costs.set(key, (costs.get(key) || 0) + out.profile.timeDeltas[i] / 1000);
  }
  out.top = [...costs].map(([frame, ms]) => ({ frame, ms: +ms.toFixed(1) }))
    .sort((a, b) => b.ms - a.ms).slice(0, 35);
  out.state = await h.page.evaluate(() => ({ focused: document.hasFocus(), hidden: document.hidden,
    error: window.__capy.state.lastError, perf: window.__capy.perfAudit() }));
  assert(out.state.focused && !out.state.hidden && !out.state.error);
  assert.equal(h.metadata.errors.length, 0); out.pass = true;
  console.log(JSON.stringify(out.top, null, 2));
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  try { await h.result('homecoming-cpu-' + chapter, out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ pass: out.pass, failure: out.failure }));
}
