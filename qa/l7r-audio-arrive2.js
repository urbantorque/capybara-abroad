async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  // A: a marquee-like burst (swell only, no wowLive), cross 16 s later
  for (let i = 0; i < 20; i++) { await page.evaluate(() => { try { window.__capy.music.swell(1) } catch (e) {} }); await page.waitForTimeout(500) }
  await page.waitForTimeout(16000)
  out.afterSwell = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy; const rows = []
    const m0 = g.musAudit().themeSaid
    g.hud.cross('kyoto')
    const t0 = performance.now()
    while (performance.now() - t0 < 9000) { const m = g.musAudit(); rows.push([+((performance.now() - t0) / 1000).toFixed(1), g.biome.current, m.themeSaid - m0, +m.stingEnv.toFixed(2), m.liftTails]); await sleep(300) }
    return rows
  })
  await page.waitForTimeout(3000)
  // B: one swell 4 s before a crossing
  await page.evaluate(() => { try { window.__capy.music.swell(1) } catch (e) {} })
  await page.waitForTimeout(4000)
  out.afterOneSwell4s = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy; const rows = []
    const m0 = g.musAudit().themeSaid
    g.hud.cross('venice')
    const t0 = performance.now()
    while (performance.now() - t0 < 9000) { const m = g.musAudit(); rows.push([+((performance.now() - t0) / 1000).toFixed(1), g.biome.current, m.themeSaid - m0, +m.stingEnv.toFixed(2), m.liftTails]); await sleep(300) }
    return rows
  })
  await page.waitForTimeout(3000)
  // C: a real wowLive burst (marqId empty so the live bed is off) then cross 16 s later
  for (let i = 0; i < 20; i++) { await page.evaluate(() => { try { window.__capy.wowLive('probe', 0.5) } catch (e) {} }); await page.waitForTimeout(500) }
  await page.waitForTimeout(16000)
  out.afterWowLive = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy; const rows = []
    const m0 = g.musAudit().themeSaid
    g.hud.cross('rio')
    const t0 = performance.now()
    while (performance.now() - t0 < 9000) { const m = g.musAudit(); rows.push([+((performance.now() - t0) / 1000).toFixed(1), g.biome.current, m.themeSaid - m0, +m.stingEnv.toFixed(2), m.liftTails]); await sleep(300) }
    return rows
  })
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7r-audio-arrive2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
