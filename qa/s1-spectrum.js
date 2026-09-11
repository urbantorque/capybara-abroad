async page => {
  // s1-spectrum: the score, measured. An AnalyserNode is hung off the master
  // limiter (captured by wrapping createDynamicsCompressor before the game
  // boots) and every chapter's palette is played for a while with the sfx
  // bus muted, so what is measured is the SCORE. Per palette: band energies
  // (dB, relative), the share above 5 kHz and 8 kHz, the loudest bin above
  // 4 kHz, the peak sample and RMS in dBFS, and how many frames the limiter
  // was reducing by more than 3 dB.
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
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(4000)
  const out = { pal: {} }
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
                 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  // mute sfx so the score alone is measured; keep the game running
  await page.evaluate(() => { const g = window.__capy; g.hud.setSfxVolume(0, true) })
  const measure = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap; if (!t) return { err: 'no tap' }
    const an = t.an, ac = t.ac
    const N = an.frequencyBinCount, f = new Float32Array(N), td = new Float32Array(an.fftSize)
    const acc = new Float64Array(N); let frames = 0, peak = 0, rmsAcc = 0, red3 = 0
    const hz = i => i * ac.sampleRate / an.fftSize
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      an.getFloatFrequencyData(f); an.getFloatTimeDomainData(td)
      let s2 = 0, pk = 0
      for (let i = 0; i < td.length; i++) { const v = td[i]; s2 += v * v; if (Math.abs(v) > pk) pk = Math.abs(v) }
      if (pk > peak) peak = pk
      rmsAcc += Math.sqrt(s2 / td.length)
      for (let i = 0; i < N; i++) acc[i] += Math.pow(10, f[i] / 10)
      if (t.comp.reduction < -3) red3++
      frames++
      await sleep(50)
    }
    const mean = new Float64Array(N); for (let i = 0; i < N; i++) mean[i] = acc[i] / Math.max(1, frames)
    const band = (a, b) => { let s = 0; for (let i = 0; i < N; i++) { const h = hz(i); if (h >= a && h < b) s += mean[i] } return s }
    const tot = band(20, 20000)
    const db = x => +(10 * Math.log10(Math.max(1e-12, x))).toFixed(1)
    let hiI = 0, hiV = -1
    for (let i = 0; i < N; i++) if (hz(i) > 4000 && mean[i] > hiV) { hiV = mean[i]; hiI = i }
    let pkI = 0, pkV = -1
    for (let i = 0; i < N; i++) if (mean[i] > pkV) { pkV = mean[i]; pkI = i }
    return { frames: frames, peakDb: +(20 * Math.log10(Math.max(1e-6, peak))).toFixed(1),
             rmsDb: +(20 * Math.log10(Math.max(1e-6, rmsAcc / Math.max(1, frames)))).toFixed(1),
             red3: red3,
             bands: { sub: db(band(20, 120)), low: db(band(120, 500)), mid: db(band(500, 2000)), hi: db(band(2000, 5000)), top: db(band(5000, 8000)), air: db(band(8000, 20000)) },
             above5k: +(band(5000, 20000) / Math.max(1e-12, tot) * 100).toFixed(2),
             above8k: +(band(8000, 20000) / Math.max(1e-12, tot) * 100).toFixed(2),
             loudestBin: Math.round(hz(pkI)), loudestAbove4k: { hz: Math.round(hz(hiI)), db: db(hiV) } }
  }, secs)
  out.title = null
  for (const n of names) {
    await page.evaluate((n) => window.__capy.biome.switchTo(n), n)
    await page.waitForTimeout(4000)      // the crossfade, and the arrival phrase
    out.pal[n] = await measure(18)
  }
  out.state = await page.evaluate(() => ({ ac: window.__tap && window.__tap.ac.state, err: window.__capy.state.lastError || null }))
  await page.evaluate(async (o) => {
    await fetch('/shot?name=s1spectrum.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
