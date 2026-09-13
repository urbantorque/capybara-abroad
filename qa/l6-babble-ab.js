async page => {
  const session = async (mode) => {
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
  await page.addInitScript((m) => { window.__babbleMode = m }, mode)
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { mode, errs: errs.length, started: await page.evaluate(() => window.__capy.state.started) }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    const B = g.hud.audioBus()
    const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
    B.sfxOut.connect(an)
    window.__world = an
    // every line's sound, as it was asked for: name, wall-clock, pitch, streak, the line
    window.__sfxN = {}; window.__lines = []
    const o = g.sfx
    const mode = window.__babbleMode || 'babble'
    g.sfx = function (name, opts) {
      window.__sfxN[name] = (window.__sfxN[name] || 0) + 1
      if ((name === 'blip' || name === 'babble') && window.__lines.length < 600) {
        window.__lines.push({ t: +(performance.now() / 1000).toFixed(3), n: name, p: opts ? +(opts.pitch || 1).toFixed(4) : 1,
                              s: opts ? opts.streak : 0, at: opts && opts.at ? 1 : 0,
                              line: opts && opts.say ? String(opts.say.line || '').slice(0, 40) : '' })
      }
      // THE A/B, in one tree: 'blip' is the pre-F5 game exactly (npc.js sent
      // every line to the blip with 2 or 3 pulses by its character count);
      // 'none' is the world with nobody speaking, which is the floor of the
      // 640 Hz band — the stone footfall's recipe sits at ~750 Hz.
      if (name === 'babble' && mode === 'blip') {
        const line = opts && opts.say ? String(opts.say.line || '') : ''
        return o.call(this, 'blip', Object.assign({}, opts, { streak: line.length < 22 ? 2 : 3, say: null }))
      }
      if ((name === 'babble' || name === 'blip') && mode === 'none') return
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
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const wins = []
  for (let w = 0; w < 6; w++) { const mp = meter(19); await drive(19); wins.push(await mp) }
  out.drive = wins
  const agg = { frames: 0, red: 0, band: 0, top: 0, pk: -99, masterPk: -99 }
  for (const w of wins) { agg.frames += w.frames; agg.red += w.red; agg.band += w.blipBand * w.frames; agg.top += w.above5k * w.frames; agg.pk = Math.max(agg.pk, w.pk); agg.masterPk = Math.max(agg.masterPk, w.masterPk) }
  out.blipBandShare = +(agg.band / agg.frames).toFixed(4)
  out.above5k = +(agg.top / agg.frames).toFixed(4)
  out.peakWorld = agg.pk; out.peakMaster = agg.masterPk; out.red = agg.red
  out.calls = await page.evaluate(() => ({ blip: window.__sfxN.blip || 0, babble: window.__sfxN.babble || 0 }))
  out.speakers = await page.evaluate(() => { const s = {}; for (const r of window.__lines) s[r.p] = 1; return Object.keys(s).length })
  return out
  }
  // BEFORE, twice: the world with nobody speaking (the band's floor), then
  // the pre-F5 blip on every line. Each from a fresh goto, so the two drives
  // start from the same place the instrument's does.
  const all = { none: await session('none'), blip: await session('blip') }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-babble-ab.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, all)
}
