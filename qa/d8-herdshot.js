async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Semicolon')
  await page.waitForTimeout(9000)
  const out = { rows: [] }
  for (let k = 0; k < 4; k++) {
    const st = await page.evaluate(() => {
      const g = window.__capy
      const a = g.pantanal.herdAudit()
      const h = g.pantanal.herd()
      // Beside one of them and level, so the legs are the silhouette.
      const gy = g.pantanal.terrainHeight(h.x + 4.2, h.z)
      g.capy.body.position.set(h.x + 4.2, gy + 0.6, h.z)
      g.capy.body.velocity.set(0, 0, 0)
      g.frameShot({ yaw: -1.5708, dist: 5.0, pitch: 0.02, raise: 0.9, hold: 5 })
      return { moving: a.rows.filter(r => r.moving).length,
               footHz: a.rows.map(r => r.footHz) }
    })
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'qa/d8s-herd-' + (k + 1) + '.png' })
    out.rows.push(st)
    await page.waitForTimeout(900)
  }
  await page.evaluate(o => fetch('/shot?name=d8-herdshot.json',
      { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
