async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  out.atStart = await page.evaluate(() => { const m = window.__capy.musAudit(); return { themeSaid: m.themeSaid, ostN: m.ostN, pal: m.pal, stingEnv: m.stingEnv, liftTails: m.liftTails, themeCells: m.themeCells } })
  const poll = (secs, fn) => page.evaluate(async ([secs, fn]) => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    const rows = []; const t0 = performance.now(); let did = false
    while (performance.now() - t0 < secs * 1000) {
      const el = (performance.now() - t0) / 1000
      if (!did && el >= 1) { did = true; try { (new Function('g', fn))(g) } catch (e) {} }
      const m = g.musAudit()
      rows.push([+el.toFixed(1), m.pal, m.themeSaid, +m.stingEnv.toFixed(2), m.busy ? 1 : 0, m.themeCells, g.biome.current, +(g.music.lift ? g.music.lift() : -1).toFixed(3)])
      await sleep(150)
    }
    return rows
  }, [secs, fn])
  out.toKyoto = await poll(14, "g.hud.cross('kyoto')")
  await page.waitForTimeout(2000)
  out.toVenice = await poll(14, "g.hud.cross('venice')")
  await page.waitForTimeout(2000)
  out.toRio = await poll(14, "g.hud.cross('rio')")
  out.liftApi = await page.evaluate(() => Object.keys(window.__capy.music))
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7r-audio-arrive.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
