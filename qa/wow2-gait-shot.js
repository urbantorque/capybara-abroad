async page => {
  // ROADMAP-WOW2 V2.1 — a picture of each gait: pin the lens 4.5 m from a
  // sat tired figure, a skipping child mid-stride and a shuffler mid-walk.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(9000)
  const out = { errs, shots: {} }
  const want = [['tired', r => r.seat > 0.8, 'sat'], ['skip', r => r.spd > 0.6 && r.y > 0.05, 'skipping'], ['shuffle', r => r.spd > 0.4 || r.pause > 0.5, 'shuffling']]
  for (const [gait, ok, label] of want) {
    const r = await page.evaluate(async ([gait, okSrc]) => {
      const g = window.__capy
      const ok = new Function('r', 'return (' + okSrc + ')(r)')
      let row = null
      for (let t = 0; t < 40 * 60 && !row; t++) {
        g.tick(1 / 60, false)
        if (t % 10) continue
        const rows = g.peopleAudit.gait(true).rows
        row = rows.find(r => r.gait === gait && ok(r)) || null
      }
      if (!row) return null
      const rec = g.locals && null
      // pin the lens: 4.5 m off, 1.6 m up, looking at the chest
      const cam = g.camera
      const yaw = Math.random() * 6.28
      cam.position.set(row.x + Math.sin(yaw) * 4.5, row.y + 1.6, row.z + Math.cos(yaw) * 4.5)
      cam.lookAt(row.x, row.y + 0.9, row.z)
      cam.updateMatrixWorld(true)
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=wow2-gait-' + gait, { method: 'POST', body: d.split(',')[1] })
      return row
    }, [gait, ok.toString()])
    out.shots[gait] = r
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-gait-shot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
