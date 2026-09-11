async page => {
  // s1-sfx: every voice in the sfx table played alone, at default volume,
  // through the same tap as s1-spectrum. Per voice: peak dBFS, the share of
  // its energy above 5 kHz and 8 kHz, and its spectral centroid. Then the
  // lift figure per palette (music.swell(1)) the same way.
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
  // music off, ambient bed as is
  await page.evaluate(() => { const g = window.__capy; g.hud.setMusicVolume ? g.hud.setMusicVolume(0, true) : null })
  const names = ['wheek', 'thud', 'splash', 'gasp', 'pop', 'rustle', 'whistle', 'gull', 'bark', 'strum', 'horn', 'hiss', 'chime', 'tick', 'step',
                 'cheer', 'organ', 'thunder', 'drip', 'clink', 'higurashi', 'shishi', 'bonsho', 'muezzin', 'darbuka', 'cart', 'mahjong', 'cleaver', 'tram',
                 'pigeons', 'lap', 'campanile', 'vendor', 'bowls', 'cicada', 'magpie', 'lorikeet', 'frailejon', 'banda', 'corso', 'roulette', 'burner', 'farbell',
                 'geyser', 'berg', 'groan', 'fluff', 'purr', 'blip']
  const measure = (name, secs, pitch) => page.evaluate(async ([name, secs, pitch]) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap; const an = t.an, ac = t.ac
    const N = an.frequencyBinCount, f = new Float32Array(N), td = new Float32Array(an.fftSize)
    const acc = new Float64Array(N); let frames = 0, peak = 0
    const hz = i => i * ac.sampleRate / an.fftSize
    // the floor: 300 ms of whatever is already sounding
    const floor = new Float64Array(N)
    for (let k = 0; k < 6; k++) { an.getFloatFrequencyData(f); for (let i = 0; i < N; i++) floor[i] += Math.pow(10, f[i] / 10) / 6; await sleep(50) }
    if (name === 'LIFT') window.__capy.music.swell(1)
    else window.__capy.sfx(name, { force: true, volume: 1, pitch: pitch || 1 })
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
    let pkI = 0, pkV = -1; for (let i = 0; i < N; i++) if (acc[i] > pkV) { pkV = acc[i]; pkI = i }
    return { peakDb: +(20 * Math.log10(Math.max(1e-6, peak))).toFixed(1), above5k: +(hi5 / Math.max(1e-12, tot) * 100).toFixed(1),
             above8k: +(hi8 / Math.max(1e-12, tot) * 100).toFixed(1), centroid: Math.round(cen / Math.max(1e-12, tot)), loudest: Math.round(hz(pkI)) }
  }, [name, secs, pitch])
  const out = { sfx: {}, lift: {} }
  for (const n of names) { out.sfx[n] = await measure(n, 1.6); await page.waitForTimeout(400) }
  // the chime at the pitches chapters ask for
  out.sfx['chime@1.5'] = await measure('chime', 1.6, 1.5)
  out.sfx['chime@1.35'] = await measure('chime', 1.6, 1.35)
  out.sfx['wheek@1.25'] = await measure('wheek', 1.6, 1.25)
  // the lift per palette, music back on
  await page.evaluate(() => { const g = window.__capy; g.hud.setMusicVolume ? g.hud.setMusicVolume(1, true) : null; g.hud.setSfxVolume(0, true) })
  for (const n of ['sydney', 'pasto', 'kyoto', 'iceland', 'drift', 'palawan', 'cave', 'kowloon', 'venice', 'monaco']) {
    await page.evaluate((n) => window.__capy.biome.switchTo(n), n)
    await page.waitForTimeout(5000)
    out.lift[n] = await measure('LIFT', 4)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=s1sfx.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
