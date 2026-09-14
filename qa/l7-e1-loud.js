async page => {
  // WHY IS THE SCORE LOUD AT REST HERE (L7, E1): per second for 24 s after a crossing, the score's
  // RMS and the writers' terms (pad gain, bass, intensity, lift, sting, sleep, breath, calm, side).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, ch: {} }
  await page.evaluate(() => {
    const g = window.__capy
    const ac = g.hud.audioBus().sfxOut.context
    const mk = (node) => { const an = ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0; node.connect(an); return an }
    window.__S = { vol: mk(g.music.taps.vol), pad: mk(g.music.taps.pad), bass: mk(g.music.taps.bass), pluck: mk(g.music.taps.pluck), world: mk(g.hud.audioBus().sfxOut) }
  })
  for (const ch of ['antarctic', 'cave', 'drift', 'goreme']) {
    await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(6000)
    out.ch[ch] = await page.evaluate(async () => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy, S = window.__S
      const td = new Float32Array(4096)
      const rows = []
      const t0 = performance.now()
      let acc = {}, n = 0
      const rmsOf = (an) => { an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; return a2 / td.length }
      let sec = 0
      while (performance.now() - t0 < 24000) {
        for (const k in S) acc[k] = (acc[k] || 0) + rmsOf(S[k])
        n++
        const s = Math.floor((performance.now() - t0) / 1000)
        if (s !== sec) {
          const m = g.musAudit()
          const r = { t: s }
          for (const k in S) r[k] = +(10 * Math.log10(Math.max(1e-12, acc[k] / n))).toFixed(1)
          r.padG = m.pad; r.bassG = m.bass; r.int = m.intensity; r.chaseT = m.chaseT; r.sleep = m.sleep; r.breath = m.breath; r.side = m.side; r.env = m.worldEnv; r.sting = m.stingEnv; r.pend = m.arrivePend; r.calm = +g.calm().toFixed(2); r.busy = m.busy; r.pal = m.pal
          try { r.lift = +g.music.liftNow().toFixed(3) } catch (e) { r.lift = null }
          rows.push(r); acc = {}; n = 0; sec = s
        }
        await sleep(40)
      }
      return rows
    })
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-loud.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
