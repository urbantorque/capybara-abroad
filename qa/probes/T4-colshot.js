async page => {
  await page.reload()
  await page.waitForTimeout(5600)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__capy.renderer.setSize(1280, 760, false) })
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const sp = g.biome.spawnOf('cave')
    g.capy.body.position.set(sp.x, sp.y, sp.z)
    await new Promise(r => setTimeout(r, 2800))
  })
  // 1. from the doline floor, looking at the column in the shaft
  await page.evaluate(async () => {
    const g = window.__capy, C = g.cave
    const d = C.columnDebug()
    g.capy.body.position.set(4, d.base + 0.4, -26)
    g.capy.body.velocity.set(0, 0, 0)
    g.input.camYaw = 0
    await new Promise(r => setTimeout(r, 2400))
  })
  await page.screenshot({ path: 'qa/T4-col-floor.png' })
  // 2. part way up the ramp
  await page.evaluate(async () => {
    const g = window.__capy, C = g.cave
    const d = C.columnDebug()
    const dy = 13, ra = 2.1 + 13 / 3.0
    const rr = (3.6 + (1.5 - 3.6) * (dy / 28)) + 1.05
    g.capy.body.position.set(4 + Math.cos(ra) * rr, d.base + dy + 0.5, -48 + Math.sin(ra) * rr)
    g.capy.body.velocity.set(0, 0, 0)
    await new Promise(r => setTimeout(r, 2200))
  })
  await page.screenshot({ path: 'qa/T4-col-ramp.png' })
  // 3. mid-fall, with the swifts formed
  const mid = await page.evaluate(async () => {
    const g = window.__capy, C = g.cave
    const d = C.columnDebug()
    g.capy.body.position.set(4, d.top + 0.6, -48)
    g.capy.body.velocity.set(0, 0, 0)
    await new Promise(r => setTimeout(r, 1400))
    g.capy.body.position.set(4 + 5.4, d.top + 0.6, -48)
    g.capy.body.velocity.set(2.0, 0, 0)
    // hold the animal in the air at a fixed height so the form can be seen
    const t0 = Date.now()
    let best = null
    while (Date.now() - t0 < 4000) {
      await new Promise(r => setTimeout(r, 50))
      const q = C.columnDebug()
      if (q.fall > 0.85) { best = q; break }
      g.capy.body.position.y = d.base + 18
      g.capy.body.velocity.y = -8
    }
    // freeze it there for the shot
    for (let k = 0; k < 26; k++) {
      g.capy.body.position.set(4 + 2.0, d.base + 18, -48)
      g.capy.body.velocity.set(0, -8, 0)
      await new Promise(r => setTimeout(r, 40))
    }
    return best || C.columnDebug()
  })
  await page.screenshot({ path: 'qa/T4-col-fall.png' })
  const err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=T4-colshot.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { mid, err })
}
