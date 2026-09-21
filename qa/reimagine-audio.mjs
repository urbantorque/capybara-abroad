// ROADMAP-REIMAGINE F: one chapter, unchanged audible graph, real keys/clock.
// node qa/reimagine-audio.mjs sydney before [--seconds=60] [--legacy] [--controls]
// Stereo meters are silent side branches. Capture never changes a gain;
// optional controls test public mute/pause APIs after the main capture.
// No sound is added to destination or existing connection removed by meters.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openHarness, CHAPTERS, snapshot } from './reimagine-harness.mjs';

const args = process.argv.slice(2);
const chapter = args.find(a => !a.startsWith('--')) || 'sydney';
const tag = args.filter(a => !a.startsWith('--'))[1] || 'baseline';
const seconds = Number(args.find(a => a.startsWith('--seconds='))?.split('=')[1] || 60);
const legacy = args.includes('--legacy');
const verifyControls = args.includes('--controls');
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
      ambienceWashPreSfxFaderEq: F.ambience, weatherBedPreSfxFaderEq: F.weather,
      themeLeadPreWideningRoom: F.theme, musicDryPreMusicVol: F.musicDry,
      sfxFinalPreMaster: F.sfxFinal, masterPostLimiter: F.limiter });
    const limiter = F?.limiter || null;
    // Coherent summing happens in Web Audio, before measuring power. Adding
    // independently measured RMS values loses correlation/cancellation.
    const bedSum = F ? ac.createGain() : null;
    const bedSources = new Map(), bedChanges = [];
    const disconnectProbe = (node, target) => {
      try { node.disconnect(target); }
      catch (e) { if (e.name !== 'InvalidAccessError') throw e; }
    };
    const refreshBeds = () => {
      if (!bedSum) return;
      const f = g.hud.audioStems(), next = new Map();
      if (f.ambience) next.set(f.ambience, 'ambience');
      if (f.weather) next.set(f.weather, 'weather');
      for (const b of f.bedMovers || []) if (b.node && b.kind !== 'tune') next.set(b.node, b.kind);
      for (const [node, kind] of bedSources) if (!next.has(node)) {
        // Retired movers can already have disconnected all their outputs.
        disconnectProbe(node, bedSum); bedSources.delete(node);
        bedChanges.push({ t: ac.currentTime, kind, added: false });
      }
      for (const [node, kind] of next) if (!bedSources.has(node)) {
        node.connect(bedSum); bedSources.set(node, kind);
        bedChanges.push({ t: ac.currentTime, kind, added: true });
      }
    };
    if (bedSum) { nodes.coherentBedsPreSfxFaderEq = bedSum; refreshBeds(); }
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
    const mode = () => ({ noQuiet: !!g.state.noQuiet, perfRung: g.state.perfRung,
      noTheme: !!g.state.noTheme, noArc: !!g.state.noArc, noMotif: !!g.state.noMotif });
    const mixState = () => {
      const f = typeof g.hud.audioStems === 'function' ? g.hud.audioStems() : null;
      return f ? { foreground: f.foreground, phrase: f.phrase, ambientTarget: f.ambientTarget,
        ambientGain: f.ambience?.gain.value, weatherGain: f.weather?.gain.value,
        moverGains: (f.bedMovers || []).map(b => ({ kind: b.kind, live: b.live, gain: b.node?.gain.value })) } : null;
    };
    const audit = () => ({ mode: mode(), foregroundMix: mixState(), audio: g.hud.audioBuses(), music: g.musAudit(),
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
      refreshBeds();
      const t0 = performance.now();
      const c = M.current = { label, t0, last: t0, intervals: [], rows: [], audit0: audit(),
        counters: clone(g.sfxAudit()), events: [], position0: position(), meters: {}, gains: {},
        reductionMax: limiter ? 0 : null, reductionSum: 0, reductionOver3: 0,
        audioTime0: ac.currentTime, approximateMissedPolls: 0, pollingGapMs: 0,
        invalidAudioMs: 0, hiddenMs: 0, pausedMs: 0, bedRefreshAt: t0,
        n: 0, invalidAudio: 0, hidden: 0, paused: 0, swimming: 0 };
      for (const m of meters) {
        c.meters[m.key] = [empty(), empty()];
        c.gains[m.key] = m.node.gain ? { before: m.node.gain.value,
          min: m.node.gain.value, max: m.node.gain.value } : null;
      }
      M.timer = setInterval(() => {
        const now = performance.now();
        const elapsed = now - c.last;
        c.intervals.push(elapsed); c.last = now;
        c.approximateMissedPolls += Math.max(0, Math.round(elapsed / 20) - 1);
        c.pollingGapMs += Math.max(0, elapsed - fftSize / ac.sampleRate * 1000);
        if (now - c.bedRefreshAt >= 200) { refreshBeds(); c.bedRefreshAt = now; }
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
        if (limiter) {
          c.reductionMax = Math.max(c.reductionMax, -limiter.reduction);
          c.reductionSum += -limiter.reduction;
          c.reductionOver3 += Number(-limiter.reduction > 3);
        }
        c.invalidAudio += Number(ac.state !== 'running');
        c.hidden += Number(document.hidden); c.paused += Number(!!g.state.paused);
        c.invalidAudioMs += Number(ac.state !== 'running') * elapsed;
        c.hiddenMs += Number(document.hidden) * elapsed;
        c.pausedMs += Number(!!g.state.paused) * elapsed;
        c.swimming += Number(!!g.capy.swimming); c.n++;
        const counts = g.sfxAudit();
        for (const [key, value] of Object.entries(counts)) {
          if (!key.includes(':') && value > (c.counters[key] || 0)) c.events.push({
            t: (now - t0) / 1000, name: key, count: value - (c.counters[key] || 0) });
        }
        c.counters = { ...counts };
        if (!c.rows.length || now - t0 >= c.rows.length * 1000) c.rows.push({
          t: (now - t0) / 1000, audioTime: ac.currentTime, position: position(), mode: mode(),
          theme: g.musThemeAudit(), music: g.musAudit(), foregroundMix: mixState(), calm: g.calm(),
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
        observedStateMs: { audioNotRunning: c.invalidAudioMs, hidden: c.hiddenMs, paused: c.pausedMs },
        audioClockSeconds: ac.currentTime - c.audioTime0,
        captureGaps: { approximateMissedPolls: c.approximateMissedPolls,
          waveformUnobservedMs: c.pollingGapMs, note: 'Main-thread sampling gaps, not demonstrated audio dropouts.' },
        swimmingPolls: c.swimming, limiterReductionMaxDb: c.reductionMax,
        limiterReductionMeanDb: limiter ? c.reductionSum / Math.max(1, c.n) : null,
        limiterOver3DbPolls: limiter ? c.reductionOver3 : null,
        continuousBedSources: [...bedSources.values()], bedConnectionChanges: bedChanges.slice(),
        positionBefore: c.position0, positionAfter: position(), meters: metersOut,
        acceptedSfxByName: acceptedByName, acceptedSfxTimeline: c.events,
        ambienceAttemptDelta: end.ambience.total - c.audit0.ambience.total,
        auditBefore: c.audit0, auditAfter: end, timeline: c.rows };
    };
    M.close = () => {
      if (M.current) M.stop();
      for (const m of meters) {
        disconnectProbe(m.node, m.split); m.split.disconnect();
        for (const { a } of m.analysers) a.disconnect();
      }
      for (const [node] of bedSources) disconnectProbe(node, bedSum);
      bedSources.clear();
      if (bedSum) bedSum.disconnect();
    };
    return { audioState: ac.state, sampleRate: ac.sampleRate, fftSize,
      waveformWindowMs: fftSize / ac.sampleRate * 1000, requestedPollMs: 20,
      exposedMusicTaps: Object.keys(T), exposedAudioBus: Object.keys(B),
      measuredTaps: meters.map(m => m.key), audioStemsAvailable: !!F,
      limiterAvailable: !!limiter, initialMode: mode(),
      missing: ['continuous beds summed after SFX transfer', 'accepted NPC identity/category attribution'],
      caveats: ['Stereo RMS is mean channel power, not mono downmix.',
        '20ms polling samples overlapping/gapped waveform windows; not contiguous PCM or a true-peak meter.',
        'Taps overlap in the graph. Never sum these measurements as independent stems.',
        'coherentBedsPreSfxFaderEq sums actual waveform contributions, excludes tune, and refreshes mover membership every200ms. It precedes the SFX fader, underwater filter and shelf/top filters.',
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
  const controls = [];
  if (verifyControls) {
    const cases = ['foreground', 'legacy', 'foreground-restored', 'rung1', 'rung0-restored',
      'music-muted', 'sfx-muted', 'master-muted', 'paused', 'resumed'];
    for (const test of cases) {
      console.log(JSON.stringify({ controls: test, chapter }));
      await h.page.evaluate(test => {
        const g = window.__capy;
        if (g.hud.pauseShown()) g.hud.pause();
        g.hud.setMusicMuted(false, true); g.hud.setSfxMuted(false, true); g.hud.setMuted(false, true);
        g.state.noQuiet = test === 'legacy'; g.state.perfRung = test === 'rung1' ? 1 : 0;
        if (test === 'music-muted') g.hud.setMusicMuted(true, true);
        if (test === 'sfx-muted') g.hud.setSfxMuted(true, true);
        if (test === 'master-muted') g.hud.setMuted(true, true);
      }, test);
      if (test === 'paused') await h.page.keyboard.press('Escape');
      await h.page.waitForTimeout(1600);
      await h.page.evaluate(label => window.__audioMeter.start(label), test);
      await h.page.waitForTimeout(800);
      const row = await h.page.evaluate(() => window.__audioMeter.stop());
      const a = row.auditAfter, f = a.foregroundMix;
      const failures = [];
      if (!f) failures.push('audioStems unavailable');
      else if (test !== 'master-muted' && test !== 'paused') {
        const expectedForeground = test !== 'legacy' && test !== 'rung1';
        if (f.foreground !== expectedForeground) failures.push('foreground/rung mode mismatch');
        const expectedTarget = expectedForeground ? .05 * .32 * f.phrase : .05;
        if (Math.abs(f.ambientTarget - expectedTarget) > 1e-6) failures.push('ambient-on target did not retarget');
      }
      if (test === 'music-muted' && a.audio.music > .001) failures.push('music mute gain');
      if (test === 'sfx-muted' && a.audio.sfx > .001) failures.push('SFX mute gain');
      if (test === 'master-muted' && a.audio.master > .001) failures.push('master mute gain');
      if (test === 'paused' && (!row.pausedPolls || !a.music.duckPause || a.music.duck >= .99)) failures.push('pause did not duck music');
      if (test === 'resumed' && (row.pausedPolls || a.music.duckPause || a.audio.master < .8 || a.audio.music < .9 || a.audio.sfx < .9)) failures.push('resume did not restore buses');
      controls.push({ test, pass: !failures.length, failures, measurement: row });
    }
    await h.page.evaluate(legacy => { window.__capy.state.noQuiet = legacy; }, legacy);
  }
  const after = await snapshot(h.page);
  const trustedInput = await h.page.evaluate(() => window.__audioTrusted);
  await h.page.evaluate(() => window.__audioMeter.close());
  await h.screenshot(name);
  const report = { chapter, tag, noQuiet: legacy, requestedSeconds: seconds,
    metadata: h.metadata, availability, before, after, trustedInput, phases, controls };
  await h.result(name, report);
  console.log(JSON.stringify({ result: resolve(root, 'qa', name + '.json.png'),
    screenshot: resolve(root, 'qa', name + '.png'), errors: h.metadata.errors,
    controls: controls.map(c => ({ test: c.test, pass: c.pass, failures: c.failures })),
    phases: phases.map(p => ({ label: p.label, seconds: p.seconds, polls: p.meterPolls,
      masterDbfs: p.meters.masterPreLimiter?.stereoRmsDbfs,
      musicVolDbfs: p.meters.musicVolPreEqPlace?.stereoRmsDbfs,
      acceptedSfx: p.acceptedSfxByName, invalidAudioPolls: p.invalidAudioPolls,
      hiddenPolls: p.hiddenPolls, pausedPolls: p.pausedPolls })) }, null, 2));
  if (h.metadata.errors.length || controls.some(c => !c.pass) || phases.some(p => !p.meterPolls || p.invalidAudioPolls || p.hiddenPolls || p.pausedPolls)) process.exitCode = 1;
} finally {
  if (h) await h.close();
}
