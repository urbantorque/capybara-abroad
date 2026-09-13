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
  })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started), ch: {} }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap, taps = g.music.taps
    window.__stems = {}
    for (const k of ['vol', 'sfx', 'pad', 'bass', 'pluck', 'drum']) {
      if (!taps || !taps[k]) continue
      try { const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; taps[k].connect(an); window.__stems[k] = an } catch (e) {}
    }
  })
  const meter = (secs, tag) => page.evaluate(async ([secs, tag]) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, ac = t.ac
    const S = window.__stems
    const ans = { master: t.an, music: S.vol, sfx: S.sfx }
    const N = t.an.frequencyBinCount
    const hz = i => i * ac.sampleRate / t.an.fftSize
    const acc = {}
    for (const k in ans) acc[k] = { f: new Float32Array(N), td: new Float32Array(t.an.fftSize), s2: 0, n: 0, pk: 0, cw: 0, cs: 0, b: [0, 0, 0, 0, 0], perSec: [], ws2: 0, wn: 0 }
    const stemRms = {}; for (const k of ['pad', 'bass', 'pluck', 'drum']) if (S[k]) stemRms[k] = { s2: 0, n: 0, td: new Float32Array(4096) }
    let red = 0, sec = 0
    const t0 = performance.now()
    const g = window.__capy
    let chaseMax = 0, intMax = 0, chaseHits0 = g.musAudit().chaseHits
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]; if (!an) continue
        an.getFloatTimeDomainData(a.td); an.getFloatFrequencyData(a.f)
        let a2 = 0, p = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v; const q = v < 0 ? -v : v; if (q > p) p = q }
        a.s2 += a2 / a.td.length; a.n++; if (p > a.pk) a.pk = p; a.ws2 += a2 / a.td.length; a.wn++
        for (let i = 1; i < N; i++) { const q = Math.pow(10, a.f[i] / 10), h = hz(i); if (h < 20 || h > 20000) continue; a.cw += q * h; a.cs += q; a.b[h < 120 ? 0 : h < 500 ? 1 : h < 2000 ? 2 : h < 5000 ? 3 : 4] += q }
      }
      for (const k in stemRms) { const r = stemRms[k]; S[k].getFloatTimeDomainData(r.td); let a2 = 0; for (let i = 0; i < r.td.length; i++) a2 += r.td[i] * r.td[i]; r.s2 += a2 / r.td.length; r.n++ }
      if (t.comp.reduction < -1) red++
      const m = g.musAudit(); if (m.chaseT > chaseMax) chaseMax = m.chaseT; if (m.intensity > intMax) intMax = m.intensity
      const s = Math.floor((performance.now() - t0) / 1000)
      if (s !== sec) { for (const k in ans) { const a = acc[k]; a.perSec.push(+(10 * Math.log10(Math.max(1e-12, a.ws2 / Math.max(1, a.wn)))).toFixed(1)); a.ws2 = 0; a.wn = 0 } sec = s }
      await sleep(40)
    }
    const res = { tag }
    for (const k in ans) {
      const a = acc[k]; if (!ans[k]) continue
      const tot = a.b.reduce((x, y) => x + y, 0)
      res[k] = { rms: +(10 * Math.log10(Math.max(1e-12, a.s2 / Math.max(1, a.n)))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, a.pk))).toFixed(1),
                 cent: Math.round(a.cw / Math.max(1e-12, a.cs)),
                 sub: +(a.b[0] / tot * 100).toFixed(1), low: +(a.b[1] / tot * 100).toFixed(1), mid: +(a.b[2] / tot * 100).toFixed(1), hi: +(a.b[3] / tot * 100).toFixed(2), top: +(a.b[4] / tot * 100).toFixed(2),
                 perSec: a.perSec }
    }
    res.stems = {}; for (const k in stemRms) res.stems[k] = +(10 * Math.log10(Math.max(1e-12, stemRms[k].s2 / Math.max(1, stemRms[k].n)))).toFixed(1)
    const m = g.musAudit()
    res.mus = { pal: m.pal, band: m.band, pad: m.pad, bass: m.bass, intensity: m.intensity, intMax: +intMax.toFixed(3), chaseT: m.chaseT, chaseMax, chaseHits: m.chaseHits - chaseHits0, chaseDbl: m.chaseDbl, breath: m.breath, chapProg: m.chapProg, second: m.second, secondN: m.secondN, melCells: m.melCells, ks: m.ks, worldDuck: m.worldDuck, speak: m.speak, duck: m.duck, beatLen: m.beatLen, sleep: m.sleep, layers: m.layers, pulseN: m.pulseN }
    res.red = red; res.calm = +g.calm().toFixed(2); res.chaos = +((g.state && g.state.chaos) || 0).toFixed(2)
    const c = g.capy; res.speed = c ? +Math.hypot(c.velocity ? c.velocity.x : 0, c.velocity ? c.velocity.z : 0).toFixed(2) : null
    res.room = (() => { try { const r = g.hud.roomAudit(); return r.key + ':' + r.wet + ':' + (+r.secs.toFixed(1)) } catch (e) { return null } })()
    res.movers = (() => { try { return g.hud.moverAudit().rows.filter(r => r.live).map(r => r.key + ':' + r.gain.toFixed(2) + ':occ' + (r.occ === undefined ? '?' : (+r.occ).toFixed(2))) } catch (e) { return null } })()
    res.state = ac.state
    return res
  }, [secs, tag])
  const k = page.keyboard
  const chapters = ['sydney', 'kyoto', 'hanoi', 'venice', 'cave']
  for (const ch of chapters) {
    if (ch !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000) }
    const row = { biome: await page.evaluate(() => window.__capy.biome.current) }
    row.calm = await meter(12, 'still')
    const wp = meter(12, 'walk'); await k.down('KeyW'); await page.waitForTimeout(12200); await k.up('KeyW'); row.walk = await wp
    await page.waitForTimeout(1500)
    const cp = meter(14, 'chase')
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { const g = window.__capy; g.events.emit('npc:chase', { authority: false }) })
      await k.down('ShiftLeft'); await k.down('KeyW'); await page.waitForTimeout(2600); await k.up('KeyW'); await k.up('ShiftLeft')
      await k.press('KeyQ'); await page.waitForTimeout(600)
    }
    row.chase = await cp
    await page.evaluate(() => { const g = window.__capy; g.events.emit('npc:lost', {}) })
    await page.waitForTimeout(7000)
    const mp = meter(10, 'marquee: swell(1)+wowLive')
    for (let i = 0; i < 20; i++) { await page.evaluate(() => { const g = window.__capy; try { g.music.swell(1) } catch (e) {} try { g.wowLive('probe', 0.5) } catch (e) {} }); await page.waitForTimeout(500) }
    row.marquee = await mp
    await page.waitForTimeout(8000)
    row.after = await meter(8, 'after')
    out.ch[ch] = row
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-audio-states.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
