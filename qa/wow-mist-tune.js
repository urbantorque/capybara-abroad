// ROADMAP-WOW G3 — the mist's TUNING probe. One boot per chapter, then a
// list of row variants applied live through weather.mistSet(), one composite
// frame each, all read by eye. Not the instrument (qa/wow-mist.js is); this
// is how the shipped rows were chosen without six boots per guess.
async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })

  const PLAN = {
    venice: [
      { tag: 'd', alpha: 4.0, tint: 0xdcd8cf, h: 0.7 },
      { tag: 'e', alpha: 4.0, tint: 0x9aa0a6, h: 0.7 },
    ],
    goreme: [
      { tag: 'a', alpha: 2.4, tint: 0xe8dfc9, h: 0.7 },
      { tag: 'b', alpha: 2.4, tint: 0x8a7f8a, h: 0.7 },
    ],
    pantanal: [
      { tag: 'a', alpha: 2.4, tint: 0xcfd6bc, h: 0.8 },
      { tag: 'b', alpha: 3.2, tint: 0xcfd9d6, h: 0.8 },
    ],
    drift: [
      { tag: 'a', alpha: 2.4, tint: 0xbdb2d6, h: 0.8 },
      { tag: 'b', alpha: 3.2, tint: 0x8d82ad, h: 0.8 },
    ],
    monaco: [
      { tag: 'a', alpha: 2.0, tint: 0xb9c6cc, h: 0.6 },
      { tag: 'b', alpha: 2.8, tint: 0x6a7ea0, h: 0.6 },
    ],
  }
  const out = { errs, rows: [] }

  for (const name of Object.keys(PLAN)) {
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.evaluate(() => document.querySelector('.capyui-go').click())
    await page.waitForTimeout(1500)
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    for (let tries = 0; tries < 20; tries++) {
      const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      await page.waitForTimeout(1000)
      const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
    }
    for (const v of PLAN[name]) {
      const r = await page.evaluate(async ([n, cfg]) => {
        const g = window.__capy
        // Venice: hold the tide out of it, the row's own tide scaling is
        // measured separately. Alpha here is the row's alpha at high water.
        g.weather.mistSet(n, { alpha: cfg.alpha, tint: cfg.tint, h: cfg.h, tide: null })
        g.state.noMist = false
        g.tick(1 / 60, true)
        const a = g.weather.mistAudit()
        const d = g.renderer.domElement.toDataURL('image/png')
        await fetch('/shot?name=wow-mist-tune-' + n + '-' + cfg.tag, { method: 'POST', body: d.split(',')[1] })
        return { n, tag: cfg.tag, audit: a, rung: g.state.perfRung }
      }, [name, v])
      out.rows.push(r)
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wow-mist-tune.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
