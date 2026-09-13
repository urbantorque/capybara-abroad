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
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  await page.evaluate(() => {
    const g = window.__capy, t = window.__tap, B = g.hud.audioBus()
    window.__stems = {}
    const mk = (node) => { const an = t.ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; node.connect(an); return an }
    try { window.__stems.music = mk(g.music.taps.vol) } catch (e) {}
    try { window.__stems.world = mk(B.sfxOut) } catch (e) {}
    window.__sfxN = {}
    const o = g.sfx
    g.sfx = function (name) { window.__sfxN[name] = (window.__sfxN[name] || 0) + 1; return o.apply(this, arguments) }
  })
  // per-second RMS of the score and the world, plus nap / sleep / the pad each second
  const meter = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const t = window.__tap, S = window.__stems, g = window.__capy
    const ans = { music: S.music, world: S.world, master: t.an }
    const acc = {}
    for (const k in ans) acc[k] = { td: new Float32Array(t.an.fftSize), ws2: 0, wn: 0, perSec: [] }
    const rows = []
    let sec = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      for (const k in ans) {
        const a = acc[k], an = ans[k]; if (!an) continue
        an.getFloatTimeDomainData(a.td)
        let a2 = 0
        for (let i = 0; i < a.td.length; i++) { const v = a.td[i]; a2 += v * v }
        a.ws2 += a2 / a.td.length; a.wn++
      }
      const s = Math.floor((performance.now() - t0) / 1000)
      if (s !== sec) {
        const m = g.musAudit()
        const row = { nap: +((g.capy && g.capy.nap) || 0).toFixed(2), sleep: m.sleep, pad: m.pad, bass: m.bass, wakeN: m.wakeN, sleepN: m.sleepN }
        for (const k in ans) { const a = acc[k]; row[k] = +(10 * Math.log10(Math.max(1e-12, a.ws2 / Math.max(1, a.wn)))).toFixed(1); a.ws2 = 0; a.wn = 0 }
        rows.push(row); sec = s
      }
      await sleep(40)
    }
    return rows
  }, secs)
  // still until asleep (nap > 0.6), at most 60 s
  out.toSleep = []
  for (let i = 0; i < 6; i++) {
    const rows = await meter(10)
    out.toSleep.push(...rows)
    const nap = await page.evaluate(() => (window.__capy.capy && window.__capy.capy.nap) || 0)
    if (nap > 0.6) break
  }
  out.napAt = out.toSleep.length
  // asleep: 40 s
  out.asleep = []
  for (let i = 0; i < 4; i++) out.asleep.push(...(await meter(10)))
  out.sfxAsleep = await page.evaluate(() => { const n = window.__sfxN; window.__sfxN = {}; return n })
  // wake: one press, then 8 s
  const wp = meter(8)
  await page.waitForTimeout(200); await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW')
  out.wake = await wp
  out.sfxAwake = await page.evaluate(() => window.__sfxN)
  out.mus = await page.evaluate(() => { const m = window.__capy.musAudit(); return { sleepN: m.sleepN, wakeN: m.wakeN, sleep: m.sleep, layers: m.layers, chapProg: m.chapProg, secondN: m.secondN, pulseN: m.pulseN } })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  // the numbers the target asks for
  const under50 = out.asleep.filter(r => r.music <= -50).length
  const stillWorld = out.toSleep.slice(0, 10).reduce((s, r) => s + r.world, 0) / Math.max(1, Math.min(10, out.toSleep.length))
  const asleepWorld = out.asleep.slice(-10).reduce((s, r) => s + r.world, 0) / Math.max(1, Math.min(10, out.asleep.length))
  let backAt = -1
  for (let i = 0; i < out.wake.length; i++) if (out.wake[i].music >= -30) { backAt = i + 1; break }
  out.tally = { secsUnder50: under50, minAsleep: Math.min(...out.asleep.map(r => r.music)), stillWorld: +stillWorld.toFixed(1), asleepWorld: +asleepWorld.toFixed(1), backAtS: backAt }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6-mix-nap.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
