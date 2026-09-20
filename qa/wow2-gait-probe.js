async page => {
  // ROADMAP-WOW2 V2.1 probe — boot Sydney, count the gait profiles, drive
  // deterministic time and sample the cast: does anybody skip, pause, sit?
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty': rung 0 held
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  const out = { errs }
  out.start = await page.evaluate(() => ({ started: window.__capy.state.started, biome: window.__capy.biome.current }))
  out.audit0 = await page.evaluate(() => window.__capy.peopleAudit.gait())
  // 40 s of deterministic time in two evaluates, sampling every second
  out.samples = []
  for (let k = 0; k < 2; k++) {
    const s = await page.evaluate(() => {
      const g = window.__capy, rows = []
      for (let t = 0; t < 20; t++) {
        for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
        const a = g.peopleAudit.gait()
        rows.push([a.walking, a.skipping, a.paused, a.sat])
      }
      return rows
    })
    out.samples.push(...s)
  }
  // find a sat tired one and a shuffler and pin the camera on them
  out.pose = await page.evaluate(() => {
    const g = window.__capy
    return g.peopleAudit.gait(true).rows
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-gait-probe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
