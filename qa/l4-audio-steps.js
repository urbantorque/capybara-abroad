async page => {
  // l4-audio-steps: every (material, pitch) pair the surface tables author,
  // fired as `step` at volume 1 and measured ALONE. Per row: spectral
  // centroid, duration to -30 dB, share of energy above 5 kHz, peak. Then the
  // clusters: rows whose centroids sit >= 1/3 octave apart.
  //
  // THE TAP IS ON THE STEP'S OWN PANNER, not on the bus. Measured first off
  // hud.audioBus().sfxIn: the effects bus is busy 43-85 % of the time in every
  // chapter (the place's ladder, the wind's fluff, the herd), so three clean
  // 0.7 s windows out of eight was the best any row got. sfxStep builds one
  // StereoPanner per call and everything it makes goes through it (L4), so
  // the constructor is hooked and the next panner after `__armStep` gets the
  // ScriptProcessor. Shape of qa/s1-sfx.js; the processor is so the envelope
  // can be read at 4 ms rather than at the analyser's poll.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.setViewportSize({ width: 1200, height: 700 })
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    const AC = window.AudioContext || window.webkitAudioContext
    const orig = AC.prototype.createStereoPanner
    AC.prototype.createStereoPanner = function () {
      const n = orig.call(this)
      if (window.__armStep && window.__tap) { window.__armStep = false; try { n.connect(window.__tap.sp) } catch (e) {} }
      return n
    }
  })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Semicolon')          // the Pantanal: no movers on the sfx bus
  await page.waitForTimeout(9000)
  const biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => {
    const g = window.__capy
    if (g.hud.setMusicVolume) g.hud.setMusicVolume(0, true)
    const B = g.hud.audioBus()
    const ac = B.ac
    const N = ac.sampleRate * 2.5 | 0
    const ring = new Float32Array(N)
    let head = 0
    const sp = ac.createScriptProcessor(1024, 2, 1)
    sp.onaudioprocess = e => {
      const L = e.inputBuffer.getChannelData(0)
      const R = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : L
      for (let i = 0; i < L.length; i++) { ring[head] = 0.5 * (L[i] + R[i]); head = (head + 1) % N }
    }
    const sink = ac.createGain(); sink.gain.value = 0
    sp.connect(sink); sink.connect(ac.destination)
    window.__tap = { ac, ring, N, get head() { return head }, sp }
  })
  // Every authored surface in the thirteen tables, as (mat, pitch). Kept in
  // step with capySurfacePitch and the ten per-chapter publishers by hand.
  const rows = [
    ['grass', 0.82, 'sydney lawn'], ['stone', 1.0, 'sydney podium'], ['timber', 1.22, 'sydney boardwalk'],
    ['timber', 1.24, 'quay deck'], ['sand', 0.82, 'quay manly beach'],
    ['gravel', 0.86, 'kyoto zen'], ['stone', 1.02, 'kyoto uji'], ['grass', 0.78, 'kyoto bamboo'], ['gravel', 1.0, 'kyoto torii'],
    ['grass', 0.72, 'cali cane'], ['timber', 1.20, 'cali terrace'],
    ['stone', 1.06, 'rio calcadao'], ['stone', 0.98, 'rio avenue'], ['stone', 1.18, 'rio selaron'],
    ['ice', 1.30, 'iceland ice'], ['gravel', 1.12, 'iceland moraine'], ['stone', 1.04, 'iceland cliff'],
    ['timber', 1.26, 'drift jetty'], ['gravel', 0.86, 'drift pale'],
    ['sand', 0.74, 'sahara erg'], ['stone', 0.94, 'sahara square'], ['sand', 0.86, 'sahara default'],
    ['metal', 1.30, 'antarctic hull'], ['ice', 1.12, 'antarctic sea ice'], ['ice', 1.34, 'antarctic blue ice'],
    ['ice', 1.06, 'antarctic glacier'], ['ice', 1.22, 'antarctic guano ice'], ['snow', 0.90, 'antarctic snow'],
    ['grass', 0.70, 'cave roost'], ['gravel', 0.92, 'cave river'], ['stone', 1.18, 'cave rimstone'], ['stone', 1.12, 'cave phyto'],
    ['timber', 1.36, 'goreme basket'], ['sand', 0.92, 'goreme tuff'], ['grass', 0.88, 'goreme field'],
    ['timber', 1.30, 'hanoi huc'], ['metal', 1.22, 'hanoi long bien'], ['grass', 0.86, 'hanoi market'],
    ['stone', 1.12, 'hanoi bia'], ['gravel', 1.10, 'hanoi rails'], ['grass', 0.90, 'hanoi dyke'],
    ['stone', 1.14, 'kowloon roof'], ['metal', 1.36, 'kowloon sign'], ['timber', 1.30, 'kowloon bamboo'],
    ['stone', 0.96, 'kowloon market'],
    ['sand', 0.72, 'manly sand'], ['sand', 0.80, 'manly shelly'], ['stone', 1.14, 'manly pool deck'],
    ['stone', 1.34, 'monaco atrium'], ['timber', 1.22, 'monaco salon'], ['stone', 0.96, 'monaco road'],
    ['timber', 1.32, 'palawan bangka'], ['stone', 1.06, 'palawan limestone'], ['sand', 0.80, 'palawan dry sand'],
    ['timber', 1.24, 'pantanal bridge'], ['grass', 0.94, 'pantanal road'], ['sand', 1.05, 'pantanal sandbar'],
    ['grass', 0.60, 'pantanal mat'], ['grass', 0.68, 'pantanal grass'],
    ['timber', 1.26, 'venice boards'], ['stone', 1.16, 'venice calli'], ['stone', 0.94, 'venice molo'],
    ['grass', 0.78, 'venice cafe'],
  ]
  const measure = (mat, pitch) => page.evaluate(async ([mat, pitch]) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const T = window.__tap, ac = T.ac, sr = ac.sampleRate
    // the window is anchored on the ring head AT THE CALL, not on the head at
    // read time: the processor's latency is under the pre-roll, and a window
    // taken off the tail of the ring started after the step had been and gone
    const pre = 0.10, post = 0.60
    await sleep(60)
    const h0 = T.head
    window.__armStep = true
    window.__capy.sfx('step', { force: true, volume: 1, pitch: pitch, mat: mat })
    window.__armStep = false
    await sleep((pre + post) * 1000 + 200)
    const preN = (pre * sr) | 0
    const buf = new Float32Array(((pre + post) * sr) | 0)
    for (let i = 0; i < buf.length; i++) buf[i] = T.ring[(h0 - preN + i + T.N) % T.N]
    // envelope: power in 4 ms windows
    const W = (0.004 * sr) | 0, nw = (buf.length / W) | 0
    const pw = new Float64Array(nw)
    for (let w = 0; w < nw; w++) { let s = 0; for (let i = 0; i < W; i++) { const v = buf[w * W + i]; s += v * v } pw[w] = s / W }
    const preW = (preN / W) | 0
    let floor = 0; for (let w = 0; w < preW; w++) floor += pw[w]; floor /= Math.max(1, preW)
    let peak = 0, peakW = 0; for (let w = preW; w < nw; w++) if (pw[w] > peak) { peak = pw[w]; peakW = w }
    const net = peak - floor
    let onset = peakW; for (let w = preW; w <= peakW; w++) if (pw[w] - floor > 0.1 * net) { onset = w; break }
    const thr = Math.max(0.001 * net, floor * 1.5)   // -30 dB, or clear of the floor
    let last = onset; let quiet = 0
    for (let w = onset; w < nw; w++) { if (pw[w] - floor > thr) { last = w; quiet = 0 } else if (++quiet > 12) break }
    const dur = (last - onset + 1) * W / sr
    // ...and nothing else arrived late: the last 100 ms of the window
    let tail = 0; for (let w = nw - 25; w < nw; w++) tail += pw[w]; tail /= 25
    // spectrum of the burst: Hann, zero-padded FFT, floor spectrum subtracted
    const n = 32768
    const fft = (re, im) => {
      for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t } }
      for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
        for (let i = 0; i < n; i += len) { let cr = 1, ci = 0
          for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2; const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr
            re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr } } }
    }
    const spec = (start, len) => { const re = new Float64Array(n), im = new Float64Array(n); const L = Math.min(len, n)
      for (let i = 0; i < L; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / L); re[i] = (buf[start + i] || 0) * w }
      fft(re, im); const p = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i]; return p }
    const segLen = Math.min(((dur + 0.05) * sr) | 0, n, buf.length - onset * W)
    const ps = spec(onset * W, segLen), pf = spec(0, Math.min(segLen, preN))
    let tot = 0, cen = 0, hi5 = 0
    for (let i = 0; i < n / 2; i++) { const hz = i * sr / n; if (hz < 40 || hz > 16000) continue
      const v = Math.max(0, ps[i] - pf[i]); tot += v; cen += v * hz; if (hz >= 5000) hi5 += v }
    return { centroid: Math.round(cen / Math.max(1e-18, tot)), dur: +(dur * 1000).toFixed(0), above5k: +(hi5 / Math.max(1e-18, tot) * 100).toFixed(1),
             peakDb: +(10 * Math.log10(Math.max(1e-12, peak))).toFixed(1), floorDb: +(10 * Math.log10(Math.max(1e-12, floor))).toFixed(1), tailDb: +(10 * Math.log10(Math.max(1e-12, tail))).toFixed(1) }
  }, [mat, pitch])
  const out = { biome, rows: [], errs }
  const seen = new Set()
  for (const r of rows) {
    const key = r[0] + '@' + r[1]
    if (seen.has(key)) continue
    seen.add(key)
    // The effects bus is exactly zero between one-shots, and the place's own
    // ladder speaks every few seconds: a gull inside the window can only ADD
    // energy, so of the clean captures (silent before the onset) the shortest
    // is the step alone. Up to six tries for three clean ones.
    const m = []
    const ok = x => x.floorDb < -85 && x.tailDb < -85 && x.peakDb > -70
    for (let k = 0; k < 8 && m.filter(ok).length < 3; k++) m.push(await measure(r[0], r[1]))
    const clean = m.filter(ok)
    const miss = m.filter(x => x.peakDb <= -70).length
    const pool = clean.length ? clean : m
    pool.sort((a, b) => a.dur - b.dur)
    const best = pool[0]
    best.tries = m.length; best.clean = clean.length; best.miss = miss
    out.rows.push({ mat: r[0], pitch: r[1], where: r[2], ...best })
  }
  // clusters: greedy, on log2(centroid), a third of an octave apart
  const cs = out.rows.map(r => Math.log2(Math.max(1, r.centroid))).sort((a, b) => a - b)
  const clusters = []
  for (const c of cs) { if (!clusters.length || c - clusters[clusters.length - 1] >= 1 / 3) clusters.push(c) }
  out.clusters = clusters.map(c => Math.round(Math.pow(2, c)))
  out.clusterN = clusters.length
  const by = (m, p) => out.rows.find(r => r.mat === m && r.pitch === p)
  out.blueIce = by('ice', 1.34)
  out.snow = by('snow', 0.90)
  out.shelfMax = Math.max(...out.rows.map(r => r.above5k))
  out.worstShelf = out.rows.filter(r => r.above5k >= 25).map(r => r.mat + '@' + r.pitch + '=' + r.above5k)
  await page.evaluate((o) => fetch('/shot?name=l4-audio-steps.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
