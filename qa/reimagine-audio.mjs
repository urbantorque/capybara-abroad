// ROADMAP-REIMAGINE F: one chapter, unchanged audible graph, real keys/clock.
// node qa/reimagine-audio.mjs sydney before [--seconds=60] [--legacy]
// Stereo meters are side branches with unconnected outputs. No gain is muted,
// no sound is added to destination, and no existing connection is removed.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHarness, CHAPTERS, snapshot } from './reimagine-harness.mjs';

const args = process.argv.slice(2);
const chapter = args.find(a => !a.startsWith('--')) || 'sydney';
const tag = args.filter(a => !a.startsWith('--'))[1] || 'baseline';
const seconds = Number(args.find(a => a.startsWith('--seconds='))?.split('=')[1] || 60);
const legacy = args.includes('--legacy');
if (!CHAPTERS.includes(chapter) || !/^[\w.-]+$/.test(tag)) throw new Error('Invalid chapter/tag.');
if (!(seconds >= 8 && seconds <= 120)) throw new Error('--seconds must be 8–120.');
const name = `reimagine-audio-${chapter}-${tag}`;
const root = fileURLToPath(new URL('../', import.meta.url));
let h;
try {
  h = await openHarness();
  await h.page.evaluate(legacy => {
    window.__capy.state.noQuiet = legacy;
    window.__audioTrusted = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
      if (window.__audioTrusted.length < 500) window.__audioTrusted.push({ type,
        key: e.code, trusted: e.isTrusted, t: performance.now() });
    });
  }, legacy);
  await h.start();
  await h.arrive(chapter);
  const before = await snapshot(h.page);
  const availability = await h.page.evaluate(() => {
    const g = window.__capy, B = g.hud.audioBus(), T = g.music.taps || {}, ac = B.ac;
    if (!ac || ac.state !== 'running') throw new Error('Trusted gesture did not unlock audio.');
    // Existing taps have different transfer functions. They are not additive
    // stems: pad/bass/pluck/wet already contribute to musicVol.
    const nodes = {
      masterPreLimiter: B.master,
      musicVolPreEqPlace: T.vol,
      padPreSidechain: T.pad,
      bassPreDry: T.bass,
      pluckPreShelf: T.pluck,
      drumsPreMusicVol: T.drum,
      musicWetPreMusicVol: T.wet,
      sfxBusPreEq: B.sfxOut,
      sfxInPreRoomSplit: B.sfxIn,
      sfxRoomReturn: B.roomOut,
    };
    // A future read-only accessor can supply these without rewriting this
    // instrument. Missing nodes remain missing, never inferred from names.
    const F = typeof g.hud.audioStems === 'function' ? g.hud.audioStems() : null;
    if (F) Object.assign(nodes, { musicFinalPreMaster: F.musicFinal,
      ambienceWash: F.ambience, weatherBed: F.weather, themeLead: F.theme,
      musicDry: F.musicDry, masterPostLimiter: F.limiter });
    const limiter = F?.limiter || null;
    const channels = 2;
    const fftSize = 2 ** Math.round(Math.log2(ac.sampleRate * .020));
    const meters = [];
    for (const [key, node] of Object.entries(nodes)) {
      if (!node) continue;
      const split = ac.createChannelSplitter(channels), analysers = [];
      node.connect(split);
      for (let ch = 0; ch < channels; ch++) {
        const a = ac.createAnalyser();
        a.fftSize = fftSize; a.smoothingTimeConstant = 0;
        split.connect(a, ch);
        analysers.push({ a, td: new Float32Array(fftSize) });
      }
      meters.push({ key, node, split, analysers });
    }
    const clone = value => JSON.parse(JSON.stringify(value));
    const audit = () => ({ audio: g.hud.audioBuses(), music: g.musAudit(),
      theme: g.musThemeAudit(), mix: g.hud.mixAudit(), ambience: g.hud.ambAudit(),
      acceptedSfx: clone(g.sfxAudit()) });
    const position = () => { const p = g.capy.body.position; return { x: p.x, y: p.y, z: p.z }; };
    const db = power => power > 0 ? 10 * Math.log10(power) : null;
    const ampDb = amplitude => amplitude > 0 ? 20 * Math.log10(amplitude) : null;
    const empty = () => ({ sumPower: 0, rmsMin: Infinity, peak: 0, minSample: Infinity,
      maxSample: -Infinity, clippedSamples: 0, n: 0 });
    const M = window.__audioMeter = { current: null, timer: null };
    M.start = label => {
      if (M.current) throw new Error('Meter phase already running.');
      const t0 = performance.now();
      const c = M.current = { label, t0, last: t0, intervals: [], rows: [], audit0: audit(),
        counters: clone(g.sfxAudit()), events: [], position0: position(), meters: {}, gains: {},
        reductionMax: limiter ? 0 : null, n: 0, invalidAudio: 0, hidden: 0, paused: 0, swimming: 0 };
      for (const m of meters) {
        c.meters[m.key] = [empty(), empty()];
        c.gains[m.key] = m.node.gain ? { before: m.node.gain.value,
          min: m.node.gain.value, max: m.node.gain.value } : null;
      }
      M.timer = setInterval(() => {
        const now = performance.now();
        c.intervals.push(now - c.last); c.last = now;
        for (const m of meters) {
          const gain = c.gains[m.key];
          if (gain) { gain.min = Math.min(gain.min, m.node.gain.value); gain.max = Math.max(gain.max, m.node.gain.value); }
          for (let ch = 0; ch < channels; ch++) {
          const { a, td } = m.analysers[ch], s = c.meters[m.key][ch];
          a.getFloatTimeDomainData(td);
          let power = 0;
          for (const v of td) {
            power += v * v; s.peak = Math.max(s.peak, Math.abs(v));
            s.minSample = Math.min(s.minSample, v); s.maxSample = Math.max(s.maxSample, v);
            if (Math.abs(v) >= 1) s.clippedSamples++;
          }
          power /= td.length; s.sumPower += power;
          s.rmsMin = Math.min(s.rmsMin, Math.sqrt(power)); s.n++;
          }
        }
        if (limiter) c.reductionMax = Math.max(c.reductionMax, -limiter.reduction);
        c.invalidAudio += Number(ac.state !== 'running');
        c.hidden += Number(document.hidden); c.paused += Number(!!g.state.paused);
        c.swimming += Number(!!g.capy.swimming); c.n++;
        const counts = g.sfxAudit();
        for (const [key, value] of Object.entries(counts)) {
          if (!key.includes(':') && value > (c.counters[key] || 0)) c.events.push({
            t: (now - t0) / 1000, name: key, count: value - (c.counters[key] || 0) });
        }
        c.counters = { ...counts };
        if (!c.rows.length || now - t0 >= c.rows.length * 1000) c.rows.push({
          t: (now - t0) / 1000, audioTime: ac.currentTime, position: position(),
          theme: g.musThemeAudit(), music: g.musAudit(), calm: g.calm(),
          paused: !!g.state.paused, hidden: document.hidden, swimming: !!g.capy.swimming });
      }, 20);
    };
    M.stop = () => {
      if (!M.current) return null;
      clearInterval(M.timer); M.timer = null;
      const c = M.current; M.current = null;
      const measuredSeconds = (performance.now() - c.t0) / 1000;
      const metersOut = {};
      for (const [key, sides] of Object.entries(c.meters)) {
        const gain = c.gains[key];
        metersOut[key] = { gain: gain ? { ...gain, after: meters.find(m => m.key === key).node.gain.value } : null,
          stereoRmsDbfs: db(sides.reduce((v, s) => v + s.sumPower / Math.max(1, s.n), 0) / 2),
          channels: sides.map(s => ({ rmsDbfs: db(s.sumPower / Math.max(1, s.n)),
            minimumWindowRmsDbfs: ampDb(s.rmsMin), peakDbfs: ampDb(s.peak),
            minSample: Number.isFinite(s.minSample) ? s.minSample : null,
            maxSample: Number.isFinite(s.maxSample) ? s.maxSample : null,
            clippedSamples: s.clippedSamples, windows: s.n })) };
      }
      const sorted = c.intervals.slice().sort((a, b) => a - b);
      const end = audit(), acceptedByName = {};
      for (const e of c.events) acceptedByName[e.name] = (acceptedByName[e.name] || 0) + e.count;
      return { label: c.label, seconds: measuredSeconds, meterPolls: c.n,
        pollingMs: { median: sorted[Math.floor(sorted.length * .5)] ?? null,
          p95: sorted[Math.floor(sorted.length * .95)] ?? null, max: sorted.at(-1) ?? null },
        invalidAudioPolls: c.invalidAudio, hiddenPolls: c.hidden, pausedPolls: c.paused,
        swimmingPolls: c.swimming, limiterReductionMaxDb: c.reductionMax,
        positionBefore: c.position0, positionAfter: position(), meters: metersOut,
        acceptedSfxByName: acceptedByName, acceptedSfxTimeline: c.events,
        ambienceAttemptDelta: end.ambience.total - c.audit0.ambience.total,
        auditBefore: c.audit0, auditAfter: end, timeline: c.rows };
    };
    M.close = () => {
      if (M.current) M.stop();
      for (const m of meters) {
        m.node.disconnect(m.split); m.split.disconnect();
        for (const { a } of m.analysers) a.disconnect();
      }
    };
    return { audioState: ac.state, sampleRate: ac.sampleRate, fftSize,
      waveformWindowMs: fftSize / ac.sampleRate * 1000, requestedPollMs: 20,
      exposedMusicTaps: Object.keys(T), exposedAudioBus: Object.keys(B),
      measuredTaps: meters.map(m => m.key), audioStemsAvailable: !!F,
      limiterAvailable: !!limiter,
      missing: ['continuous beds summed after SFX transfer', 'accepted NPC identity/category attribution'],
      caveats: ['Stereo RMS is mean channel power, not mono downmix.',
        '20ms polling samples overlapping/gapped waveform windows; not contiguous PCM or a true-peak meter.',
        'Taps overlap in the graph. Never sum these measurements as independent stems.',
        'musicVol is before music EQ/place; sfxBus is before SFX EQ. Their ratio is not the final audible ratio.',
        'Rest follows arrival and can include its fade/theme; subsequent walking is a different musical passage. Phase RMS differences do not isolate walking attenuation.',
        'Ambience audit counts attempts; SFX audit counts accepted synthesis calls without reliable caller categories.',
        'No PCM recording or perceptual listening; meter overhead invalidates performance claims.'] };
  });
  const phases = [];
  for (const phase of ['rest', 'walk']) {
    console.log(JSON.stringify({ phase, chapter, captureSeconds: seconds / 2 }));
    await h.page.evaluate(label => window.__audioMeter.start(label), phase);
    const deadline = Date.now() + seconds * 500;
    let leg = 0;
    while (Date.now() < deadline) {
      const duration = Math.min(1500, deadline - Date.now());
      if (duration <= 0) break;
      if (phase === 'walk') await h.hold(leg++ % 2 ? 's' : 'w', duration);
      else await h.page.waitForTimeout(duration);
    }
    phases.push(await h.page.evaluate(() => window.__audioMeter.stop()));
  }
  const after = await snapshot(h.page);
  const trustedInput = await h.page.evaluate(() => window.__audioTrusted);
  await h.page.evaluate(() => window.__audioMeter.close());
  await h.screenshot(name);
  const report = { chapter, tag, noQuiet: legacy, requestedSeconds: seconds,
    metadata: h.metadata, availability, before, after, trustedInput, phases };
  await h.result(name, report);
  console.log(JSON.stringify({ result: resolve(root, 'qa', name + '.json.png'),
    screenshot: resolve(root, 'qa', name + '.png'), errors: h.metadata.errors,
    phases: phases.map(p => ({ label: p.label, seconds: p.seconds, polls: p.meterPolls,
      masterDbfs: p.meters.masterPreLimiter?.stereoRmsDbfs,
      musicVolDbfs: p.meters.musicVolPreEqPlace?.stereoRmsDbfs,
      acceptedSfx: p.acceptedSfxByName, invalidAudioPolls: p.invalidAudioPolls,
      hiddenPolls: p.hiddenPolls, pausedPolls: p.pausedPolls })) }, null, 2));
  if (h.metadata.errors.length || phases.some(p => !p.meterPolls || p.invalidAudioPolls || p.hiddenPolls || p.pausedPolls)) process.exitCode = 1;
} finally {
  if (h) await h.close();
}
