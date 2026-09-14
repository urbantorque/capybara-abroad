async page => {
  // BED CALIBRATION (L7, E1): in a chapter, the world bus RMS with all beds, then with each live
  // mover muted in turn (amp 0), so each bed's delivered level on the bus is a number.
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
    const an = ac.createAnalyser(); an.fftSize = 4096; an.smoothingTimeConstant = 0
    g.hud.audioBus().sfxOut.connect(an)
    const mn = ac.createAnalyser(); mn.fftSize = 4096; mn.smoothingTimeConstant = 0
    g.music.taps.vol.connect(mn)
    window.__an = an; window.__mn = mn
  })
  const rms = (secs) => page.evaluate(async (secs) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const td = new Float32Array(4096), md = new Float32Array(4096); let s2 = 0, m2 = 0, n = 0
    const t0 = performance.now()
    while (performance.now() - t0 < secs * 1000) {
      window.__an.getFloatTimeDomainData(td); let a2 = 0; for (let i = 0; i < td.length; i++) a2 += td[i] * td[i]; s2 += a2 / td.length
      window.__mn.getFloatTimeDomainData(md); let b2 = 0; for (let i = 0; i < md.length; i++) b2 += md[i] * md[i]; m2 += b2 / md.length; n++
      await sleep(40)
    }
    return { world: +(10 * Math.log10(Math.max(1e-12, s2 / n))).toFixed(1), music: +(10 * Math.log10(Math.max(1e-12, m2 / n))).toFixed(1) }
  }, secs)
  for (const ch of ['antarctic', 'iceland', 'pasto', 'rio', 'cave']) {
    await page.evaluate((c) => window.__capy.hud.cross(c), ch); await page.waitForTimeout(16000)
    const row = { all: await rms(5), each: {}, aud: await page.evaluate(() => window.__capy.hud.moverAudit().rows.map(r => r.key + ':' + r.live + ':' + r.gain)) }
    const keys = await page.evaluate(() => window.__capy.hud.moverAudit().rows.filter(r => r.live).map(r => [r.key, r.kind, r.gain]))
    row.live = keys
    for (const [key, kind] of keys) {
      await page.evaluate(([key, kind]) => { window.__capy.sfxMover(kind, { key }).amp(0) }, [key, kind])
      await page.waitForTimeout(1500)
      row.each[key] = await rms(4)
      await page.evaluate(([key, kind]) => { window.__capy.sfxMover(kind, { key }).amp(1) }, [key, kind])
      await page.waitForTimeout(1500)
    }
    // ...and everything off, for the floor (the weather bed, the ladder)
    await page.evaluate((ks) => { for (const [key, kind] of ks) window.__capy.sfxMover(kind, { key }).amp(0) }, keys)
    await page.waitForTimeout(1500)
    row.none = await rms(4)
    await page.evaluate((ks) => { for (const [key, kind] of ks) window.__capy.sfxMover(kind, { key }).amp(1) }, keys)
    out.ch[ch] = row
  }
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-bedcal.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
