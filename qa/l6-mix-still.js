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
    const g = window.__capy, t = window.__tap, B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    window.__sfxN = {}
    const o = g.sfx
    g.sfx = function (name) { window.__sfxN[name] = (window.__sfxN[name] || 0) + 1; return o.apply(this, arguments) }
    try { g.hud.ambAudit(true) } catch (e) {}
  })
  // the review's still window: 15 s standing, score vs the whole world bus (beds included)
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, S = window.__stems, g = window.__capy
    const ans = { music: S.music, world: S.world, master: t.an }
    const acc = {}
    for (const k in ans) acc[k] = { td: new Float32Array(t.an.fftSize), s2: 0, n: 0, pk: 0, ws2: 0, wn: 0, perSec: [] }
    let sec = 0, red = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]; if (!an) continue
        an.getFloatTimeDomainData(a.td)
        let a2 = 0, p = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v; const q = v < 0 ? -v : v; if (q > p) p = q }
        a.s2 += a2 / a.td.length; a.n++; if (p > a.pk) a.pk = p; a.ws2 += a2 / a.td.length; a.wn++
      }
      if (t.comp.reduction < -1) red++
      const s = Math.floor((performance.now() - t0) / 1000)
      if (s !== sec) { for (const k in ans) { const a = acc[k]; a.perSec.push(+(10 * Math.log10(Math.max(1e-12, a.ws2 / Math.max(1, a.wn)))).toFixed(1)); a.ws2 = 0; a.wn = 0 } sec = s }
      await sleep(50)
    }
    const res = { red, calm: +g.calm().toFixed(2) }
    for (const k in ans) { const a = acc[k]; if (!ans[k]) continue; res[k] = { rms: +(10 * Math.log10(Math.max(1e-12, a.s2 / Math.max(1, a.n)))).toFixed(1), pk: +(20 * Math.log10(Math.max(1e-6, a.pk))).toFixed(1), perSec: a.perSec } }
    try { res.movers = g.hud.moverAudit().rows.filter(r => r.live).map(r => r.key + ':' + r.gain.toFixed(3)) } catch (e) {}
    try { const a = g.hud.ambAudit(); res.amb = a.tally; res.ambN = a.total } catch (e) {}
    res.sfx = window.__sfxN; window.__sfxN = {}
    try { const r = g.hud.roomAudit(); res.room = r.key + ':' + (+r.wet.toFixed(2)) + ':near' + r.near + ':mk' + r.makeup } catch (e) {}
    const m = g.musAudit(); res.sleep = m.sleep; res.pad = m.pad
    return res
  }, secs)
  const chapters = ['kyoto', 'venice', 'palawan', 'pantanal']
  for (const ch of chapters) {
    await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(9000)
    const row = { biome: await page.evaluate(() => window.__capy.biome.current) }
    // a step and back, so the still window starts from rest 0 the way the drive probe's did
    await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await page.keyboard.up('KeyW'); await page.waitForTimeout(1500)
    row.still = await meter(15)
    row.diff = +(row.still.world.rms - row.still.music.rms).toFixed(1)
    out.ch[ch] = row
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-mix-still.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
