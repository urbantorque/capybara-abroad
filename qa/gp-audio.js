async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    return { started: g.state.started, ts: g.state.timeScale, rawDt: g.state.rawDt, err: g.state.lastError || null }
  })
  const probe = await page.evaluate(() => {
    const g = window.__capy
    const e = g.camera.matrixWorld.elements
    const capy = g.capy.position
    const rx = e[0], rz = e[2]
    const fired = []
    const shot = (dx, dz, label) => {
      const n0 = 0
      g.sfx('thud', { at: { x: capy.x + dx, y: capy.y, z: capy.z + dz }, force: true })
      fired.push(label)
    }
    shot(rx * 14, rz * 14, 'right14')
    shot(-rx * 14, -rz * 14, 'left14')
    shot(400, 0, 'far400')
    return { rx, rz, fired }
  })
  await page.waitForTimeout(800)
  const hs = await page.evaluate(() => {
    const g = window.__capy
    g.hitstop(0.12, 0.08)
    return { calm: g.time.calm, scaleNow: g.time.scale }
  })
  await page.waitForTimeout(60)
  const mid = await page.evaluate(() => ({ scale: window.__capy.state.timeScale, dt: window.__capy.state.dt }))
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => ({ scale: window.__capy.state.timeScale, err: window.__capy.state.lastError || null }))
  const payload = JSON.stringify({ out, probe, hs, mid, after, errs: errs.slice(0, 12) })
  await page.evaluate(async (b) => {
    const enc = btoa(unescape(encodeURIComponent(b)))
    await fetch('/shot?name=gp-audio.json', { method: 'POST', body: enc })
  }, payload)
}
