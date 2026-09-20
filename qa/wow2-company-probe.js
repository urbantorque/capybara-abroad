async page => {
  // ROADMAP-WOW2 V2.4 probe — one chapter, 60 s of deterministic time: how
  // many close pairs there ARE (the nearest neighbour of every local with a
  // figure) and how many company beats fired, with the animal parked.
  const CHAP = 'rio'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty': rung 0 held
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  if (CHAP !== 'sydney') { await page.evaluate((n) => window.__capy.hud.cross(n), CHAP); await page.waitForTimeout(9500) }
  const out = { errs, chap: CHAP }
  out.pairs = await page.evaluate(() => {
    const g = window.__capy, live = g.biome.current
    const L = g.locals.filter(l => l.biome === live && l.fig)
    const cp = g.capy.position
    const rows = []
    for (let i = 0; i < L.length; i++) {
      let best = 1e9, bj = -1
      for (let j = 0; j < L.length; j++) { if (i === j) continue; const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z); if (d < best) { best = d; bj = j } }
      rows.push({ i, near: L[i].near, dNN: +best.toFixed(2), dCapy: +Math.hypot(L[i].x - cp.x, L[i].z - cp.z).toFixed(1) })
    }
    return { n: L.length, under3: rows.filter(r => r.dNN <= 3).length, under45: rows.filter(r => r.dNN <= 4.5).length, rows }
  })
  await page.evaluate(() => window.__capy.peopleAudit.company(true))
  for (let k = 0; k < 3; k++) {
    await page.evaluate(() => { const g = window.__capy; for (let t = 0; t < 20 * 60; t++) g.tick(1 / 60, false) })
  }
  out.company = await page.evaluate(() => window.__capy.peopleAudit.company())
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-company-probe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
