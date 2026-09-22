// ROADMAP-HOMECOMING: human-audition capture of the shipped soundtrack.
// The tap mirrors the native destination; it does not replace, mute, or
// normalise the game's output. This is a listening artifact, not a blind score.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHarness, CHAPTERS } from './reimagine-harness.mjs';

const args = process.argv.slice(2);
const chapter = args[0] || 'sydney';
const arm = args[1] || 'live';
const tag = args[2] || 'v1';
assert(CHAPTERS.includes(chapter) && ['live', 'inherited'].includes(arm) && /^[\w.-]+$/.test(tag),
  'usage: node qa/homecoming-audition.mjs <chapter> <live|inherited> [tag]');
const name = `homecoming-audition-${chapter}-${arm}-${tag}`;
const output = resolve(fileURLToPath(new URL('../qa/', import.meta.url)), name + '.webm');
const report = { chapter, arm, tag, name, durationTargetSeconds: 180,
  scope: 'Original synthesized game destination captured after a trusted start and public chapter-arrival fixture. Live uses normal admission; inherited toggles existing arrangement flags. No save, task, body or AudioParam writes. These are diagnostic state flags, not a reconstruction of an earlier release.',
  caveats: ['Audio is an unnormalised human-audition capture, not a loudness approval or blind A/B.',
    'Meter values sample short windows once per second; they are not integrated loudness or true-peak measurements.',
    'The inherited arm is a synthetic flag context and is not an earned journey progression.',
    'WebM/Opus support and browser scheduling determine the encoded file duration.'], stages: [], metadata: null };
let h, primaryError = null, captureResult = null;

async function checkpoint() {
  if (h) await h.result(name, report);
}

async function installTap() {
  await h.page.addInitScript(() => {
    const Native = window.AudioContext || window.webkitAudioContext;
    if (!Native || window.__qaAudioInstalled) return;
    const NativeConnect = AudioNode.prototype.connect;
    window.__qaContexts = [];
    const tapped = new WeakSet();
    const Wrapped = function (...args) {
      const ac = new Native(...args);
      ac.__qaTap = null;
      window.__qaContexts.push(ac);
      return ac;
    };
    Wrapped.prototype = Native.prototype;
    try { Object.defineProperty(Wrapped, 'name', { value: Native.name }); } catch {}
    const connect = function (destination, ...args) {
      const result = NativeConnect.call(this, destination, ...args);
      const ac = this.context;
      if (ac && destination === ac.destination && !tapped.has(this)) {
        tapped.add(this);
        const tap = ac.createMediaStreamDestination();
        const analyser = ac.createAnalyser();
        analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0;
        NativeConnect.call(this, analyser);
        NativeConnect.call(analyser, tap);
        ac.__qaTap = { ac, source: this, tap, analyser };
      }
      return result;
    };
    AudioNode.prototype.connect = connect;
    window.AudioContext = Wrapped;
    if (window.webkitAudioContext === Native) window.webkitAudioContext = Wrapped;
    window.__qaAudioInstalled = { Native, NativeConnect, connect };
  });
}

async function audioSetup() {
  return h.page.evaluate(() => {
    const tap = (window.__qaContexts || []).map(ac => ac.__qaTap).find(Boolean);
    const ac = tap?.ac;
    if (!tap || !ac) throw new Error('Final AudioContext destination tap was not found after trusted start.');
    const types = ['audio/webm;codecs=opus', 'audio/webm'].filter(type => MediaRecorder.isTypeSupported(type));
    if (!types.length) throw new Error('MediaRecorder audio/webm unsupported.');
    const rec = new MediaRecorder(tap.tap.stream, { mimeType: types[0] });
    const chunks = [], meter = new Float32Array(tap.analyser.fftSize);
    const state = { recorder: rec, chunks, meter, timer: null, startedAt: performance.now(), rms: 0, peak: 0, windows: 0 };
    rec.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
    state.timer = setInterval(() => {
      tap.analyser.getFloatTimeDomainData(meter);
      let power = 0, peak = 0;
      for (const value of meter) { power += value * value; peak = Math.max(peak, Math.abs(value)); }
      state.rms += Math.sqrt(power / meter.length); state.peak = Math.max(state.peak, peak); state.windows++;
    }, 1000);
    state.stop = async () => {
      clearInterval(state.timer);
      if (rec.state !== 'inactive') await new Promise(resolve => { rec.addEventListener('stop', resolve, { once: true }); rec.stop(); });
      const bytes = [];
      for (const chunk of chunks) {
        const data = new Uint8Array(await chunk.arrayBuffer());
        let binary = ''; for (let i = 0; i < data.length; i += 0x8000) binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
        bytes.push(btoa(binary));
      }
      return { mimeType: rec.mimeType, chunks: bytes, bytes: chunks.reduce((n, c) => n + c.size, 0),
        measuredSeconds: (performance.now() - state.startedAt) / 1000,
        rmsMean: state.windows ? state.rms / state.windows : null, peak: state.peak, windows: state.windows,
        audioState: ac.state, sampleRate: ac.sampleRate };
    };
    window.__qaAudioCapture = state;
    rec.start(1000);
    return { mimeType: rec.mimeType, audioState: ac.state, sampleRate: ac.sampleRate };
  });
}

async function gameState(label) {
  const state = await h.page.evaluate(() => {
    const g = window.__capy, p = g.capy.body.position, v = g.capy.body.velocity;
    return { chapter: g.biome.current, started: !!g.state.started, paused: !!g.state.paused,
      hidden: document.hidden, focused: document.hasFocus(), audioState: window.__qaContexts?.[0]?.state || null,
      time: g.state.time, lastError: g.state.lastError || null,
      body: { position: p.toArray(), velocity: v.toArray(), finite: [...p.toArray(), ...v.toArray()].every(Number.isFinite) },
      music: typeof g.musAudit === 'function' ? g.musAudit() : null,
      serene: { score: !g.state.noSereneScore, space: !g.state.noSereneSpace } };
  });
  const row = { label, at: new Date().toISOString(), state, errors: h.metadata.errors.slice() };
  report.stages.push(row); await checkpoint(); return row;
}

function assertHealthy(row) {
  assert(row.state.started && !row.state.paused && !row.state.hidden && row.state.focused, 'live focused game required');
  assert(row.state.body.finite && row.state.lastError === null, 'finite body and no game error required');
  assert.equal(row.state.audioState,'running','audio clock runs');
  assert.equal(h.metadata.errors.length, 0, 'zero harness runtime errors');
}

try {
  h = await openHarness({ story: true, pinRung: false });
  report.metadata = h.metadata;
  await installTap();
  await h.page.reload({ waitUntil: 'load', timeout: 30000 });
  await h.page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go, .capyui-carry'));
  await h.start(); await h.arrive(chapter);
  await h.page.evaluate(inherited => {
    window.__capy.state.noSereneScore = inherited;
    window.__capy.state.noSereneSpace = inherited;
  }, arm === 'inherited');
  const ready = await gameState('ready'); assertHealthy(ready);
  const availability = await audioSetup(); report.audio = { availability };
  await checkpoint();
  await h.page.waitForTimeout(60000); assertHealthy(await gameState('still-60s'));
  for (const key of ['w', 'd', 's', 'a']) { await h.hold(key, 10000); assertHealthy(await gameState('walk-' + key + '-10s')); }
  await h.page.waitForTimeout(40000); assertHealthy(await gameState('rest-40s'));
  await h.page.waitForTimeout(40000); assertHealthy(await gameState('rest-80s'));
  captureResult = await h.page.evaluate(async () => window.__qaAudioCapture.stop());
  const { chunks, ...captureMeta } = captureResult;
  report.audio.capture = captureMeta;
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk, 'base64')));
  assert(bytes.length>10000 && captureMeta.rmsMean>0,'non-silent audio captured');
  writeFileSync(output, bytes);
  report.audio.file = { path: output, bytes: bytes.length };
  report.pass = true; report.finishedAt = new Date().toISOString(); await checkpoint();
  console.log(JSON.stringify({ pass: true, chapter, arm, file: output, bytes: bytes.length }));
} catch (error) {
  primaryError = error; report.pass = false; report.failure = String(error.stack || error);
  try { if (h) await checkpoint(); } catch (sinkError) { console.error('QA sink failed:', sinkError); }
} finally {
  if (h) {
    try { await h.page.evaluate(async () => {
      if (window.__qaAudioCapture) await window.__qaAudioCapture.stop();
      const i = window.__qaAudioInstalled;
      if (i) { AudioNode.prototype.connect = i.NativeConnect; window.AudioContext = i.Native;
        if (window.webkitAudioContext) window.webkitAudioContext = i.Native; }
      for (const ac of window.__qaContexts || []) {
        const tap=ac.__qaTap;
        if (tap) { try { tap.source.disconnect(tap.analyser);tap.analyser.disconnect();tap.tap.stream.getTracks().forEach(t=>t.stop()); } catch {} }
      }
    }); } catch {}
    try { await h.close(); } catch (error) { if (!primaryError) primaryError = error; }
  }
}
if (primaryError) { console.error(String(primaryError.stack || primaryError)); process.exitCode = 1; }
