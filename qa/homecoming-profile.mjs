// Headful CPU attribution diagnostic. Profiler samples add overhead; this is
// attribution evidence, not a frame-pacing or gameplay benchmark.
import assert from 'node:assert/strict';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'monaco';
const tag = process.argv[3] || 'v1';
assert(CHAPTERS.includes(chapter), 'Unknown chapter: ' + chapter);
assert(/^[\w-]+$/.test(tag), 'safe result tag');

const h = await openHarness();
let cdp = null;
let profile = null;
let profilerStarted = false;
let failure = null;
const checks = [];

const sampleState = async key => {
  checks.push(await h.page.evaluate(key => {
    const g = window.__capy;
    return { key, focused: document.hasFocus(), paused: !!g.state.paused,
      lastError: g.state.lastError || null, hidden: document.hidden };
  }, key));
};

try {
  cdp = await h.context.newCDPSession(h.page);
  await h.start();
  await h.arrive(chapter);
  await h.page.bringToFront();
  await sampleState('arrival');
  await cdp.send('Profiler.setSamplingInterval', { interval: 2000 });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  profilerStarted = true;
  for (const key of ['KeyW', 'KeyD', 'KeyS']) {
    await h.hold(key, 10000);
    await sampleState(key);
  }
} catch (error) {
  failure = String(error && (error.stack || error));
} finally {
  if (cdp && profilerStarted) {
    try { profile = (await cdp.send('Profiler.stop')).profile; }
    catch (error) { failure ||= String(error && (error.stack || error)); }
  }
  const self = new Map();
  const nodes = new Map((profile?.nodes || []).map(node => [node.id, node.callFrame || {}]));
  for (let i = 0; i < (profile?.samples || []).length; i++) {
    const frame = nodes.get(profile.samples[i]) || {};
    const label = `${frame.functionName || '(anonymous)'} @ ${frame.url || '(no url)'}:${frame.lineNumber ?? 0}`;
    self.set(label, (self.get(label) || 0) + (profile.timeDeltas?.[i] || 0));
  }
  const topSelfTime = [...self.entries()].sort((a, b) => b[1] - a[1])
    .slice(0, 40).map(([label, microseconds]) => ({ label, microseconds }));
  const counts = {
    focusFalse: checks.filter(x => !x.focused).length,
    paused: checks.filter(x => x.paused).length,
    lastError: checks.filter(x => x.lastError).length,
    hidden: checks.filter(x => x.hidden).length,
    metadataErrors: h.metadata.errors.length,
  };
  if (!failure && checks.length !== 4) failure = 'Expected four route checkpoints';
  if (!failure && (!profile || !profile.samples || !profile.samples.length)) failure = 'Profiler returned no samples';
  if (!failure && (counts.focusFalse || counts.paused || counts.lastError || counts.hidden || counts.metadataErrors)) {
    failure = 'Diagnostic route had focus, pause, error, hidden, or metadata errors';
  }
  try {
    await h.result('homecoming-profile-' + chapter + '-' + tag, {
      chapter, pass: !failure, metadata: h.metadata, interval: 2000, diagnostic: true,
      note: 'CDP CPU sampling adds overhead; attribution only, not frame pacing.',
      route: checks, counts, topSelfTime, profile, failure,
    });
  } finally { await h.close(); }
}

if (failure) { console.error(failure); process.exitCode = 1; }
console.log(JSON.stringify({ chapter, counts: {
  focusFalse: checks.filter(x => !x.focused).length,
  paused: checks.filter(x => x.paused).length,
  lastError: checks.filter(x => x.lastError).length,
  hidden: checks.filter(x => x.hidden).length,
  metadataErrors: h.metadata.errors.length,
}, samples: profile?.samples?.length || 0, failure }));
