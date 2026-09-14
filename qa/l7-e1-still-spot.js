async page => {
  // THE BED AT REST, NINETEEN TIMES (L7, E1). Per chapter: 10 s standing at the spawn, 8 s of W held.
  // Score (taps.vol) vs the whole world bus (audioBus().sfxOut) RMS, the master's share above 5 kHz,
  // chase hits and startles while standing, the live movers. The reviewer's states probe did five
  // chapters; the roadmap's target is 19/19.
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
  })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started), ch: {} }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap
    const B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    window.__ev = {}
    for (const n of ['npc:startled', 'npc:chase']) g.events.on(n, () => { window.__ev[n] = (window.__ev[n] || 0) + 1 })
  })
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, ac = t.ac, S = window.__stems, g = window.__capy
    const ans = { master: t.an, music: S.music, world: S.world }
    const N = t.an.frequencyBinCount, hz = i => i * ac.sampleRate / t.an.fftSize
    const acc = {}
    for (const k in ans) acc[k] = { f: new Float32Array(N), td: new Float32Array(t.an.fftSize), s2: 0, n: 0, pk: 0, b: [0, 0, 0, 0, 0], tr: 0, hist: [] }
    const m0 = g.musAudit(), ev0 = Object.assign({}, window.__ev)
    let chaseOn = 0, samples = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]; if (!an) continue
        an.getFloatTimeDomainData(a.td); an.getFloatFrequencyData(a.f)
        let a2 = 0, p = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v; const q = v < 0 ? -v : v; if (q > p) p = q }
        const fr = a2 / a.td.length
        a.s2 += fr; a.n++; if (p > a.pk) a.pk = p
        if (a.hist.length >= 5) { const m = a.hist.reduce((x, y) => x + y, 0) / a.hist.length; if (fr > m * 4) a.tr++ }
        a.hist.push(fr); if (a.hist.length > 5) a.hist.shift()
        for (let i = 1; i < N; i++) { const h = hz(i); if (h < 20 || h > 20000) continue; const q = Math.pow(10, a.f[i] / 10); a.b[h < 120 ? 0 : h < 500 ? 1 : h < 2000 ? 2 : h < 5000 ? 3 : 4] += q }
      }
      const m = g.musAudit(); if (m.chaseT > 0) chaseOn++; samples++
      await sleep(40)
    }
    const m1 = g.musAudit()
    const res = {}
    for (const k in ans) { const a = acc[k]; if (!ans[k]) continue; const tot = a.b.reduce((x, y) => x + y, 0); res[k] = { rms: +(10 * Math.log10(Math.max(1e-12, a.s2 / Math.max(1, a.n)))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, a.pk))).toFixed(1), trPerS: +(a.tr / secs).toFixed(2), hi: +(a.b[3] / tot * 100).toFixed(2), top: +(a.b[4] / tot * 100).toFixed(3) } }
    const ev = {}; for (const k in window.__ev) { const d = window.__ev[k] - (ev0[k] || 0); if (d) ev[k] = d }
    res.chaseHits = m1.chaseHits - m0.chaseHits; res.chaseTon = +(chaseOn / Math.max(1, samples)).toFixed(2); res.ev = ev
    res.pad = m1.pad; res.calm = +g.calm().toFixed(2); res.worldEnv = m1.worldEnv === undefined ? null : m1.worldEnv
    res.movers = (() => { try { return g.hud.moverAudit().rows.filter(r => r.live).map(r => r.key + ':' + r.gain.toFixed(3)) } catch (e) { return null } })()
    res.err = g.state.lastError || null
    return res
  }, secs)
  const names = ['venice', 'cali', 'rio']
  for (const ch of names) {
    if (ch !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000) }
    const row = { biome: await page.evaluate(() => window.__capy.biome.current) }
    row.still = await meter(10)
    const wp = meter(8); await page.keyboard.down('KeyW'); await page.waitForTimeout(8200); await page.keyboard.up('KeyW'); row.walk = await wp
    // ...and at rest again, 27 s after the border: the arrival tune's tail is out of this one
    await page.waitForTimeout(2000); row.still2 = await meter(8)
    out.ch[ch] = row
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-still-spot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
