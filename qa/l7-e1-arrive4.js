async page => {
  // THE 4 s CASE (L7, E1 / audio #9): one swell(1), a crossing four seconds later, and every 300 ms
  // for 16 s: the lift as musLiftNow() sees it, whether an arrival is pending, themeSaid, stingEnv.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 }); await page.waitForTimeout(9000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(8000)
  const out = { errs, started: await page.evaluate(() => window.__capy.state.started) }
  await page.evaluate(() => { try { window.__capy.music.swell(1) } catch (e) {} })
  await page.waitForTimeout(4000)
  out.rows = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy; const rows = []
    const m0 = g.musAudit().themeSaid
    g.hud.cross('venice')
    const t0 = performance.now()
    while (performance.now() - t0 < 16000) {
      const m = g.musAudit()
      let lift = null; try { lift = +g.music.liftNow().toFixed(3) } catch (e) { try { lift = +g.music.lift().toFixed(3) } catch (e2) {} }
      rows.push([+((performance.now() - t0) / 1000).toFixed(1), g.biome.current, m.themeSaid - m0, +m.stingEnv.toFixed(2), m.arrivePend, m.liftNow, m.liftT, m.busy, m.live, g.state.lastError || null])
      await sleep(300)
    }
    return rows
  })
  out.musicKeys = await page.evaluate(() => Object.keys(window.__capy.music))
  out.errsN = errs.length
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l7-e1-arrive4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
