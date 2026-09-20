async page => {
  // ROADMAP-WOW2 V2.3 probe — one chapter under a forced shower (trap 35:
  // odds 1, hold 14, the front pinned on the line, and rainT SAMPLED every
  // 250 ms): who put an umbrella up, and a pinned lens on the first who did.
  const CHAP = 'sydney'
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
  out.dry = await page.evaluate(() => window.__capy.peopleAudit.umbrella())
  await page.evaluate((n) => {
    const g = window.__capy
    const row = g.weather.rowOf(n)
    g.weather.set(n, { rain: { odds: 1, peak: Math.max(row.rain.peak, 0.6), hold: 14, gap: 1 } })
    g.hud.front(0)
    window.__m = []
    window.__mi = setInterval(() => { const a = g.peopleAudit.umbrella(); window.__m.push({ t: +g.state.time.toFixed(1), rain: a.rain, fn: a.frontNear, lup: a.locals.up, rup: a.roster.up }) }, 250)
  }, CHAP)
  await page.waitForTimeout(7000)
  out.shot = await page.evaluate(async () => {
    const g = window.__capy
    const a = g.peopleAudit.umbrella()
    const row = a.rows.find(r => r.kind !== 'local') || a.rows[0]
    if (!row) return null
    const cam = g.camera.clone()
    // a clear bearing: try eight, keep the first whose ray to the head is not
    // stopped by a wall (the raycaster sees the instanced figure itself, so
    // a hit within a metre of the head is the person, not a wall)
    const T = g.THREE, rc = new T.Raycaster(), head = new T.Vector3(row.x, row.y + 1.4, row.z)
    let yaw = (row.yaw || 0) + 0.6, clear = false
    for (let k = 0; k < 8 && !clear; k++) {
      const yy = yaw + k * 0.785
      const pos = new T.Vector3(row.x + Math.sin(yy) * 5.5, row.y + 2.0, row.z + Math.cos(yy) * 5.5)
      rc.set(pos, head.clone().sub(pos).normalize())
      const hits = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.distance > 0.2)
      const dHead = pos.distanceTo(head)
      if (!hits.length || hits[0].distance > dHead - 1.0) { yaw = yy; clear = true }
    }
    cam.position.set(row.x + Math.sin(yaw) * 5.5, row.y + 2.0, row.z + Math.cos(yaw) * 5.5)
    cam.lookAt(row.x, row.y + 1.2, row.z)
    cam.updateMatrixWorld(true)
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, cam)
    const d = g.renderer.domElement.toDataURL('image/png')
    await fetch('/shot?name=wow2-umb-' + g.biome.current, { method: 'POST', body: d.split(',')[1] })
    return { row, clear, audit: a }
  })
  await page.waitForTimeout(4000)
  out.trace = await page.evaluate(() => { clearInterval(window.__mi); return window.__m.filter((x, i) => i % 4 === 0) })
  out.peak = await page.evaluate(() => { const m = window.__m; const pk = f => m.reduce((a, x) => Math.max(a, x[f]), 0); return { rain: pk('rain'), lup: pk('lup'), rup: pk('rup') } })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-umb-probe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
