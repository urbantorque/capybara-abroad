async page => {
  // THE FOUR CULPRITS AND THE FOUR CLICKS (L7, E1 / audio #4): each voice alone at the master tap,
  // the s1-sfx way (share above 5 kHz and 8 kHz, centroid, peak), music off. The culprits' share
  // above 5 kHz must not rise; the click voices' should.
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
  })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const g = window.__capy; if (g.hud.setMusicVolume) g.hud.setMusicVolume(0, true) })
  await page.waitForTimeout(2000)
  const measure = (name, secs, opts) => page.evaluate(async ([name, secs, opts]) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap; const an = t.an, ac = t.ac
    const N = an.frequencyBinCount, f = new Float32Array(N), td = new Float32Array(an.fftSize)
    const acc = new Float64Array(N); let frames = 0, peak = 0
    const hz = i => i * ac.sampleRate / an.fftSize
    const floor = new Float64Array(N)
    for (let k = 0; k < 6; k++) { an.getFloatFrequencyData(f); for (let i = 0; i < N; i++) floor[i] += Math.pow(10, f[i] / 10) / 6; await sleep(50) }
    window.__capy.sfx(name, Object.assign({ force: true, volume: 1, pitch: 1 }, opts || {}))
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      an.getFloatFrequencyData(f); an.getFloatTimeDomainData(td)
      let pk = 0; for (let i = 0; i < td.length; i++) { const v = Math.abs(td[i]); if (v > pk) pk = v }
      if (pk > peak) peak = pk
      for (let i = 0; i < N; i++) acc[i] += Math.max(0, Math.pow(10, f[i] / 10) - floor[i])
      frames++
      await sleep(40)
    }
    let tot = 0, hi5 = 0, hi8 = 0, cen = 0
    for (let i = 0; i < N; i++) { const v = acc[i] / frames; const h = hz(i); if (h < 20) continue; tot += v; cen += v * h; if (h >= 5000) hi5 += v; if (h >= 8000) hi8 += v }
    return { peakDb: +(20 * Math.log10(Math.max(1e-6, peak))).toFixed(1), above5k: +(hi5 / Math.max(1e-12, tot) * 100).toFixed(1),
             above8k: +(hi8 / Math.max(1e-12, tot) * 100).toFixed(1), centroid: Math.round(cen / Math.max(1e-12, tot)) }
  }, [name, secs, opts])
  const out = { sfx: {} }
  for (let r = 0; r < 2; r++) {
    for (const n of ['cicada', 'geyser', 'rustle', 'hiss', 'thud', 'clink', 'pop']) { out.sfx[n + r] = await measure(n, 1.6); await page.waitForTimeout(500) }
    out.sfx['step:stone' + r] = await measure('step', 0.6, { mat: 'stone' }); await page.waitForTimeout(400)
    out.sfx['step:ice' + r] = await measure('step', 0.6, { mat: 'ice' }); await page.waitForTimeout(400)
    out.sfx['step:metal' + r] = await measure('step', 0.6, { mat: 'metal' }); await page.waitForTimeout(400)
    out.sfx['step:grass' + r] = await measure('step', 0.6, { mat: 'grass' }); await page.waitForTimeout(400)
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-voices.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
