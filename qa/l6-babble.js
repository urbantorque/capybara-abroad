async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createDynamicsCompressor
    AC.prototype.createDynamicsCompressor = function () {
      const n = orig.call(this)
      if (!window.__tap) {
        const an = this.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
        n.connect(an)
        window.__tap = { an: an, comp: n, ac: this }
      }
      return n
    }
    // the per-call panner sfx() builds for a placed sound: remembering the last
    // one is a clean tap on ONE voice, which the world bus can never give
    const op = AC.prototype.createStereoPanner
    AC.prototype.createStereoPanner = function () { const n = op.call(this); window.__lastPan = n; return n }
  })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    const B = g.hud.audioBus()
    const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
    B.sfxOut.connect(an)
    window.__world = an
    // every line's sound, as it was asked for: name, wall-clock, pitch, streak, the line
    window.__sfxN = {}; window.__lines = []
    const o = g.sfx
    g.sfx = function (name, opts) {
      window.__sfxN[name] = (window.__sfxN[name] || 0) + 1
      if ((name === 'blip' || name === 'babble') && window.__lines.length < 600) {
        window.__lines.push({ t: +(performance.now() / 1000).toFixed(3), n: name, p: opts ? +(opts.pitch || 1).toFixed(4) : 1,
                              s: opts ? opts.streak : 0, at: opts && opts.at ? 1 : 0,
                              line: opts && opts.say ? String(opts.say.line || '').slice(0, 40) : '' })
      }
      return o.apply(this, arguments)
    }
  })
  // ---- the meter: world energy, the 640 Hz blip band's share of it, the top end, peaks, red
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, ac = t.ac, an = window.__world
    const N = an.frequencyBinCount, hz = i => i * ac.sampleRate / an.fftSize
    const f = new Float32Array(N), td = new Float32Array(an.fftSize), mtd = new Float32Array(t.an.fftSize)
    let all = 0, band = 0, top = 0, low = 0, n = 0, pk = 0, mpk = 0, red = 0, s2 = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      an.getFloatTimeDomainData(td); an.getFloatFrequencyData(f); t.an.getFloatTimeDomainData(mtd)
      let a2 = 0, p = 0
      for (let i = 0; i < td.length; i++) { const v = td[i]; a2 += v * v; const q = v < 0 ? -v : v; if (q > p) p = q }
      s2 += a2 / td.length; if (p > pk) pk = p
      let mp = 0; for (let i = 0; i < mtd.length; i++) { const q = mtd[i] < 0 ? -mtd[i] : mtd[i]; if (q > mp) mp = q }
      if (mp > mpk) mpk = mp
      for (let i = 1; i < N; i++) {
        const h = hz(i); if (h < 20 || h > 20000) continue
        const q = Math.pow(10, f[i] / 10)
        all += q
        if (h >= 450 && h <= 1000) band += q
        if (h > 5000) top += q
        if (h < 300) low += q
      }
      n++
      if (t.comp.reduction < -1) red++
      await sleep(50)
    }
    return { frames: n, red, rms: +(10 * Math.log10(Math.max(1e-12, s2 / Math.max(1, n)))).toFixed(1),
             pk: +(20 * Math.log10(Math.max(1e-6, pk))).toFixed(1), masterPk: +(20 * Math.log10(Math.max(1e-6, mpk))).toFixed(1),
             blipBand: +(band / Math.max(1e-12, all)).toFixed(4), above5k: +(top / Math.max(1e-12, all)).toFixed(4), under300: +(low / Math.max(1e-12, all)).toFixed(4) }
  }, secs)
  const k = page.keyboard
  const drive = async (secs) => {
    // the reviewer's naive drive (qa/l6r-audio-drive.js): walk, turn, hop, wheek, grab, run
    const t0 = Date.now()
    let i = 0
    while (Date.now() - t0 < secs * 1000) {
      const r = i % 8
      if (r === 0) { await k.down('KeyW'); await page.waitForTimeout(2600); await k.up('KeyW') }
      else if (r === 1) { await k.down('KeyW'); await k.down('KeyA'); await page.waitForTimeout(1400); await k.up('KeyA'); await page.waitForTimeout(1200); await k.up('KeyW') }
      else if (r === 2) { await k.press('Space'); await page.waitForTimeout(900); await k.press('KeyQ'); await page.waitForTimeout(1500) }
      else if (r === 3) { await k.down('ShiftLeft'); await k.down('KeyW'); await page.waitForTimeout(2800); await k.up('KeyW'); await k.up('ShiftLeft') }
      else if (r === 4) { await k.press('KeyE'); await page.waitForTimeout(700); await k.down('KeyW'); await k.down('KeyD'); await page.waitForTimeout(1600); await k.up('KeyD'); await k.up('KeyW') }
      else if (r === 5) { await page.waitForTimeout(2200) }
      else if (r === 6) { await k.down('KeyW'); await page.waitForTimeout(1200); await k.press('Space'); await page.waitForTimeout(1200); await k.up('KeyW') }
      else { await k.down('KeyS'); await page.waitForTimeout(900); await k.up('KeyS'); await k.press('KeyE'); await page.waitForTimeout(800) }
      i++
    }
  }
  // ---- two minutes in Sydney, six 19 s windows, world bus tapped
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const wins = []
  for (let w = 0; w < 6; w++) { const mp = meter(19); await drive(19); wins.push(await mp) }
  out.drive = wins
  const agg = { frames: 0, red: 0, band: 0, top: 0, pk: -99, masterPk: -99 }
  for (const w of wins) { agg.frames += w.frames; agg.red += w.red; agg.band += w.blipBand * w.frames; agg.top += w.above5k * w.frames; agg.pk = Math.max(agg.pk, w.pk); agg.masterPk = Math.max(agg.masterPk, w.masterPk) }
  out.blipBandShare = +(agg.band / agg.frames).toFixed(4)
  out.above5k = +(agg.top / agg.frames).toFixed(4)
  out.peakWorld = agg.pk; out.peakMaster = agg.masterPk; out.red = agg.red
  out.calls = await page.evaluate(() => ({ blip: window.__sfxN.blip || 0, babble: window.__sfxN.babble || 0, all: window.__sfxN }))
  out.lines = await page.evaluate(() => window.__lines.slice(0, 40))
  out.speakers = await page.evaluate(() => { const s = {}; for (const r of window.__lines) s[r.p] = (s[r.p] || 0) + 1; return s })
  out.after = await page.evaluate(() => { const g = window.__capy; let mix = null; try { mix = g.hud.mixAudit() } catch (e) {}
    return { voiceDrops: mix && mix.voiceDrops, threw: mix && mix.synthThrew, why: mix && mix.synthWhy, err: g.state.lastError || null } })

  // ---- LISTEN: each real speaker's mouth, on its own (stand still, world bus only)
  // For >= 6 of the people who spoke during the drive, say one statement and one
  // question through the same door at volume 1 and read the sound back: the
  // fundamental by autocorrelation, the first formant as the spectral peak in
  // 250-1500 Hz, the syllable count and rate from the envelope, the contour as
  // the f0 of the last third against the first, and the onset from the call.
  const hasBabble = out.calls.babble > 0
  const name = hasBabble ? 'babble' : 'blip'
  const speakers = Object.keys(out.speakers).map(Number).sort((a, b) => a - b)
  // eight people spread across the whole cast's pitch range, not the low end of it
  const pick = []
  for (let j = 0; j < 8 && speakers.length; j++) { const p = speakers[Math.round(j * (speakers.length - 1) / 7)]; if (pick.indexOf(p) < 0) pick.push(p) }
  out.listen = []
  const cases = []
  for (const p of pick) { cases.push({ p, q: 0 }); cases.push({ p, q: 1 }) }
  // ...and the two kinds of voice the record can ask for, and a same-person cut
  cases.push({ p: pick[0], q: 0, low: true, tag: 'authority' })
  cases.push({ p: pick[1], q: 0, slow: true, tag: 'storyteller' })
  cases.push({ p: pick[2], q: 0, cut: true, tag: 'cut' })
  for (const cs of cases) {
    const line = cs.q ? 'have you seen the ferry come in yet?' : 'the ferry comes in at half past four.'
    const r = await page.evaluate(async ([name, p, line, cs]) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy, t = window.__tap, ac = t.ac, sr = ac.sampleRate
      // CAPTURE, then analyse. A polling loop on an AnalyserNode is starved by
      // the game's own frame (17–50 reads in 1.4 s, measured), so the voice is
      // recorded sample-accurately off its own panner through a
      // ScriptProcessor into a zero-gain sink, and every number below is read
      // from the recording after the line has ended.
      const chunks = []
      const sp = ac.createScriptProcessor(1024, 1, 1)
      sp.onaudioprocess = e => { chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))) }
      const sink = ac.createGain(); sink.gain.value = 0
      sp.connect(sink); sink.connect(ac.destination)
      const pos = g.capy.position
      const at = { x: pos.x + 0.8, y: pos.y, z: pos.z + 0.8 }
      const t0 = performance.now()
      window.__lastPan = null
      g.sfx(name, { volume: 1, pitch: p, streak: 6, say: { line: line, low: !!cs.low, slow: !!cs.slow }, force: true, at, near: 7, far: 70 })
      const pan = window.__lastPan
      if (pan) pan.connect(sp)
      let cutAt = -1
      while (performance.now() - t0 < 1500) {
        // the cut: a second line from the same person at 250 ms; only the
        // FIRST line is recorded, so its length is the cut's own length
        if (cs.cut && cutAt < 0 && performance.now() - t0 > 250) {
          cutAt = performance.now() - t0
          g.sfx(name, { volume: 1, pitch: p, streak: 6, say: { line: line }, force: true, at, near: 7, far: 70 })
        }
        await sleep(20)
      }
      if (pan) pan.disconnect(sp)
      sp.disconnect(); sink.disconnect()
      let n = 0; for (const c of chunks) n += c.length
      const x = new Float32Array(n); { let o = 0; for (const c of chunks) { x.set(c, o); o += c.length } }
      // ---- the envelope: 10 ms RMS windows
      const W = Math.round(sr * 0.01), env = []
      for (let i = 0; i + W <= n; i += W) { let a = 0; for (let j = i; j < i + W; j++) a += x[j] * x[j]; env.push(Math.sqrt(a / W)) }
      let mx = 0; for (const e of env) mx = Math.max(mx, e)
      const onI = env.findIndex(e => e > Math.max(0.001, mx * 0.08))
      let lastI = -1; for (let i = env.length - 1; i >= 0; i--) if (env[i] > 0.06 * mx) { lastI = i; break }
      let syl = 0, above = false, lastPk = -1, firstPk = -1, dips = 0
      for (let i = 0; i < env.length; i++) {
        const e = env[i]
        if (!above && e > 0.35 * mx) { above = true; syl++; if (firstPk < 0) firstPk = i; lastPk = i }
        else if (above && e < 0.12 * mx) { above = false; dips++ }
      }
      // ---- the pitch: normalised autocorrelation, 43 ms windows every 15 ms, lags 69–480 Hz
      const M = 2048, HOP = Math.round(sr * 0.015), L0 = Math.round(sr / 480), L1 = Math.round(sr / 69)
      const voiced = []
      const cs_ = new Float32Array(L1 + 1)
      for (let i = 0; i + M + L1 <= n; i += HOP) {
        let a = 0; for (let j = i; j < i + M; j++) a += x[j] * x[j]
        const rms = Math.sqrt(a / M)
        if (rms < 0.2 * mx) continue
        let bestC = 0
        for (let L = L0; L <= L1; L++) {
          let c = 0, e0 = 0, e1 = 0
          for (let j = i; j < i + M; j++) { c += x[j] * x[j + L]; e0 += x[j] * x[j]; e1 += x[j + L] * x[j + L] }
          c /= Math.max(1e-9, Math.sqrt(e0 * e1)); cs_[L] = c; if (c > bestC) bestC = c
        }
        let bestL = 0
        for (let L = L0; L <= L1; L++) if (cs_[L] >= bestC * 0.92) { bestL = L; break }
        if (bestC > 0.3 && bestL) voiced.push({ t: i / sr, f0: +(sr / bestL).toFixed(0), i })
      }
      // ---- the spectrum: a Hann-windowed 4096 FFT on each voiced frame
      const NF = 4096
      function fft(re, im) {
        const N = re.length
        for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let tr = re[i]; re[i] = re[j]; re[j] = tr; tr = im[i]; im[i] = im[j]; im[j] = tr } }
        for (let len = 2; len <= N; len <<= 1) {
          const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
          for (let i = 0; i < N; i += len) {
            let cr = 1, ci = 0
            for (let j = 0; j < len / 2; j++) {
              const ur = re[i + j], ui = im[i + j]
              const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr
              re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi
              const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr
            }
          }
        }
      }
      const re = new Float32Array(NF), im = new Float32Array(NF)
      const shares = [0, 0, 0, 0, 0], F1s = []
      let shN = 0
      for (const v of voiced) {
        if (v.i + NF > n) continue
        for (let j = 0; j < NF; j++) { re[j] = x[v.i + j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / NF)); im[j] = 0 }
        fft(re, im)
        let all = 0, b = [0, 0, 0, 0, 0], pkHz = 0, pkP = -1
        for (let k = 1; k < NF / 2; k++) {
          const h = k * sr / NF, q = re[k] * re[k] + im[k] * im[k]
          if (h < 20) continue
          all += q
          if (h < 250) b[0] += q; else if (h < 700) b[1] += q; else if (h < 1500) b[2] += q; else if (h < 3000) b[3] += q
          if (h > 5000) b[4] += q
          if (h >= 250 && h <= 1500 && q > pkP) { pkP = q; pkHz = h }
        }
        for (let k = 0; k < 5; k++) shares[k] += b[k] / Math.max(1e-12, all)
        shN++; F1s.push(pkHz)
      }
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
      const nA = Math.max(1, Math.floor(voiced.length * 0.35)), nB = Math.max(1, Math.floor(voiced.length * 0.25))
      const f0a = med(voiced.slice(0, nA).map(fr => fr.f0))
      const tailF = voiced.slice(-nB).map(fr => fr.f0)
      return { p, tag: cs.tag || '', tapped: !!pan, q: !!(line.indexOf('?') >= 0), onsetMs: onI >= 0 ? onI * 10 : -1, lenMs: lastI >= 0 ? lastI * 10 : 0,
               cutAtMs: Math.round(cutAt), peak: +mx.toFixed(3), syl, dips, rateHz: syl > 1 ? +((syl - 1) / Math.max(0.01, (lastPk - firstPk) * 0.01)).toFixed(1) : 0,
               f0: med(voiced.map(fr => fr.f0)), f0Start: f0a, f0End: med(tailF), f0EndMax: Math.max(0, ...tailF), F1: Math.round(med(F1s)), voicedFrames: voiced.length, samples: n,
               shares: shN ? shares.map(v => +(v / shN).toFixed(3)) : null,
               env: env.filter((e, i) => i % 3 === 0).map(e => +(e / Math.max(1e-6, mx)).toFixed(2)) }
    }, [name, cs.p, line, cs])
    out.listen.push(r)
    await page.waitForTimeout(400)
  }
  // distinct voices: two people are ONE voice if their fundamentals are within
  // 4 %, their first formants within 6 % AND their rates within 0.5 Hz; the
  // count is the number of clusters that leaves. The per-person offset is the
  // synth's own hash, reproduced, so the measured F1 can be read against it —
  // a formant peak is quantised to the nearest harmonic of f0 (±half an f0,
  // about ±8 % at 130 Hz), which is the noise floor of that column.
  const hash = (x, k) => { const s = Math.sin(x * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s) }
  const stmts = out.listen.filter(r => !r.q && !r.tag && r.f0 > 0)
  for (const r of stmts) r.offClaim = +(0.88 + 0.24 * hash(r.p, 1)).toFixed(3)
  const same = (a, b) => Math.abs(a.f0 - b.f0) < 0.04 * Math.max(a.f0, b.f0) && Math.abs(a.F1 - b.F1) < 0.06 * Math.max(a.F1, b.F1) && Math.abs(a.rateHz - b.rateHz) < 0.5
  const clusters = []
  for (const r of stmts) { if (!clusters.some(c => same(c, r))) clusters.push(r) }
  const span = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? [s[0], s[s.length - 1]] : null }
  out.voices = { speakers: stmts.length, distinct: clusters.length, f0: span(stmts.map(r => r.f0)), F1: span(stmts.map(r => r.F1)), rate: span(stmts.map(r => r.rateHz)),
                 table: stmts.map(r => ({ p: r.p, f0: r.f0, f0Claim: Math.round(150 * r.p), F1: r.F1, off: r.offClaim, rate: r.rateHz, syl: r.syl })) }
  const plain = out.listen.filter(r => !r.tag)
  out.onsetMax = Math.max(...plain.map(r => r.onsetMs))
  out.lenMax = Math.max(...plain.map(r => r.lenMs))
  // a sentence has gaps between its syllables; one long buzz has none
  out.buzz = plain.filter(r => r.dips < 2).length
  out.sylRange = [Math.min(...plain.map(r => r.syl)), Math.max(...plain.map(r => r.syl))]
  out.rateRange = [Math.min(...plain.map(r => r.rateHz)), Math.max(...plain.map(r => r.rateHz))]
  out.fall = plain.filter(r => !r.q && r.f0End < r.f0Start * 0.95).length + ' of ' + plain.filter(r => !r.q).length
  out.rise = plain.filter(r => r.q && r.f0EndMax > r.f0Start * 1.08).length + ' of ' + plain.filter(r => r.q).length
  out.voiceAbove5k = Math.max(...plain.map(r => r.shares ? r.shares[4] : 0))
  out.errsN = errs.length
  out.name = name
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-babble.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
