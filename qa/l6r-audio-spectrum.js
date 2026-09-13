async page => {
  await page.setViewportSize({ width: 1200, height: 700 })
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
  })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(4000)
  const out = { pal: {} }
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
                 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  await page.evaluate(() => {
    const g = window.__capy; g.hud.setSfxVolume(0, true)
    const t = window.__tap; const taps = g.music.taps
    window.__stems = {}
    if (t && taps) {
      for (const k of Object.keys(taps)) {
        if (!taps[k]) continue
        try {
          const an = t.ac.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0
          taps[k].connect(an); window.__stems[k] = an
        } catch (e) {}
      }
    }
  })
  const measure = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap; if (!t) return { err: 'no tap' }
    const an = t.an, ac = t.ac
    const N = an.frequencyBinCount, f = new Float32Array(N), td = new Float32Array(an.fftSize)
    const acc = new Float64Array(N); let frames = 0, peak = 0, rmsAcc = 0, red3 = 0
    const stems = window.__stems || {}, sk = Object.keys(stems)
    const sAcc = {}, sBuf = {}
    for (const k of sk) { sAcc[k] = 0; sBuf[k] = new Float32Array(stems[k].fftSize) }
    const hz = i => i * ac.sampleRate / an.fftSize
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      an.getFloatFrequencyData(f); an.getFloatTimeDomainData(td)
      let s2 = 0, pk = 0
      for (let i = 0; i < td.length; i++) { const v = td[i]; s2 += v * v; if (Math.abs(v) > pk) pk = Math.abs(v) }
      if (pk > peak) peak = pk
      rmsAcc += s2 / td.length
      for (let i = 0; i < N; i++) acc[i] += Math.pow(10, f[i] / 10)
      for (const k of sk) {
        const b = sBuf[k]; stems[k].getFloatTimeDomainData(b)
        let q = 0; for (let i = 0; i < b.length; i++) q += b[i] * b[i]
        sAcc[k] += q / b.length
      }
      if (t.comp.reduction < -3) red3++
      frames++
      await sleep(50)
    }
    const mean = new Float64Array(N); for (let i = 0; i < N; i++) mean[i] = acc[i] / Math.max(1, frames)
    const band = (a, b) => { let s = 0; for (let i = 0; i < N; i++) { const h = hz(i); if (h >= a && h < b) s += mean[i] } return s }
    const tot = band(20, 20000)
    const db = x => +(10 * Math.log10(Math.max(1e-12, x))).toFixed(1)
    let cw = 0, lap = 0
    for (let i = 1; i < N; i++) {
      const h = hz(i); if (h < 20 || h >= 20000) continue
      cw += mean[i] * h
      const r4 = Math.pow(h / 200, 4)          // |H|^2 of a 2nd-order Butterworth HP at 200 Hz
      lap += mean[i] * r4 / (1 + r4)
    }
    let pkI = 0, pkV = -1
    for (let i = 0; i < N; i++) if (mean[i] > pkV) { pkV = mean[i]; pkI = i }
    const stemDb = {}
    for (const k of sk) stemDb[k] = +(10 * Math.log10(Math.max(1e-12, sAcc[k] / Math.max(1, frames)))).toFixed(1)
    const g = window.__capy, m = g.musAudit()
    return { frames: frames, peakDb: +(20 * Math.log10(Math.max(1e-6, peak))).toFixed(1),
             rmsDb: +(10 * Math.log10(Math.max(1e-12, rmsAcc / Math.max(1, frames)))).toFixed(1),
             red3: red3,
             bands: { sub: db(band(20, 120)), low: db(band(120, 500)), mid: db(band(500, 2000)), hi: db(band(2000, 5000)), top: db(band(5000, 8000)), air: db(band(8000, 20000)) },
             above500: +(band(500, 20000) / Math.max(1e-12, tot) * 100).toFixed(1),
             above200: +(band(200, 20000) / Math.max(1e-12, tot) * 100).toFixed(1),
             above5k: +(band(5000, 20000) / Math.max(1e-12, tot) * 100).toFixed(2),
             centroid: Math.round(cw / Math.max(1e-12, tot)),
             laptopDb: +(10 * Math.log10(Math.max(1e-12, lap / Math.max(1e-12, tot)))).toFixed(1),
             loudestBin: Math.round(hz(pkI)),
             stems: stemDb, pal: m.pal, band: m.band, pad: m.pad, bass: m.bass, ks: m.ks, sleep: m.sleep, prog: m.chapProg, pulseN: m.pulseN }
  }, secs)
  for (const n of names) {
    await page.evaluate((n) => window.__capy.biome.switchTo(n), n)
    // a tap of W: switchTo clears the nap but not the rest timer, so the animal is asleep again
    // seven seconds after every teleport and the score (E3's SLEEP) fades under the window
    await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW')
    await page.waitForTimeout(3700)      // the crossfade, and the arrival phrase
    out.pal[n] = await measure(18)
  }
  const rows = Object.values(out.pal)
  out.tally = {
    n: rows.length,
    above500ge25: rows.filter(r => r.above500 >= 25).length,
    padCentroidGe350: rows.filter(r => !r.band && r.centroid >= 350).length, padN: rows.filter(r => !r.band).length,
    laptopWithin6: rows.filter(r => r.laptopDb >= -6).length,
    above5kUnder1: rows.filter(r => r.above5k < 1).length,
    peakUnderM6: rows.filter(r => r.peakDb < -6).length,
  }
  out.state = await page.evaluate(() => ({ ac: window.__tap && window.__tap.ac.state, started: window.__capy.state.started, err: window.__capy.state.lastError || null }))
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-audio-spectrum.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
