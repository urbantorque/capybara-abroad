async page => {
  // ROADMAP-WOW2 V2.2 probe — one chapter: drive time, count gestures
  // started, and pin the lens on the first one caught mid-beat for a picture.
  const CHAP = 'kyoto'
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
  const out = { errs, chap: CHAP, shots: [] }
  out.a0 = await page.evaluate(() => window.__capy.peopleAudit.gesture(true))
  for (let k = 0; k < 1; k++) {
    const r = await page.evaluate(async () => {
      const g = window.__capy
      const shots = []
      for (let t = 0; t < 20 * 60; t++) {
        g.tick(1 / 60, false)
        if (t % 6) continue
        const a = g.peopleAudit.gesture()
        const row = a.rows.find(r => r.w > 0.9 && r.g !== 'point')
        if (row && shots.length < 4 && !shots.some(s => s.g === row.g)) {
          const cam = g.camera.clone()
          const yaw = row.yaw + 0.5
          cam.position.set(row.x + Math.sin(yaw) * 4.2, row.y + 1.7, row.z + Math.cos(yaw) * 4.2)
          cam.lookAt(row.x, row.y + 1.1, row.z)
          cam.updateMatrixWorld(true)
          g.renderer.setRenderTarget(null)
          g.renderer.render(g.scene, cam)
          const d = g.renderer.domElement.toDataURL('image/png')
          await fetch('/shot?name=wow2-gest-' + row.g, { method: 'POST', body: d.split(',')[1] })
          shots.push(row)
        }
      }
      return { audit: g.peopleAudit.gesture(), shots }
    })
    out.shots.push(...r.shots)
    out['audit' + k] = r.audit
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-gest-probe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
