async page => {
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(12000)
  const put = await page.evaluate(() => {
    const g = window.__capy
    const live = g.biome.current
    const cp = g.capy.position
    let best = null, bd = 1e9
    for (const L of (g.locals || [])) {
      if (!L || L.biome !== live || !L.fig) continue
      const d = Math.hypot(L.x - cp.x, L.z - cp.z)
      if (d < bd) { bd = d; best = L }
    }
    if (!best) return { err: 'nobody' }
    window.__L = best
    return { at: +bd.toFixed(1) }
  })
  const shot = async (name) => {
    await page.evaluate(() => {
      const g = window.__capy, L = window.__L
      g.capy.body.position.set(L.x + 2.4, L.y + 0.5, L.z + 2.4)
      g.capy.body.velocity.set(0, 0, 0)
      if (typeof g.frameShot === 'function') {
        // frameShot's yaw is the bearing from the ANIMAL TO THE CAMERA (the
        // same convention as input.camYaw, trap 26). To see the person, the
        // camera goes on the far side of the animal from them — the first cut
        // had the sign the other way round and photographed a kiosk.
        g.frameShot({ yaw: Math.atan2(2.4, 2.4),
                      dist: 5.5, pitch: 0.30, raise: 1.1, hold: 8 })
      }
    })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: 'qa/' + name })
  }
  await shot('B11-standing.png')
  const set = await page.evaluate(() => {
    const L = window.__L
    L.sat = 2.1; L.satCd = 40
    return { sat: L.sat }
  })
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'qa/B11-sat.png' })
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b11-shot.json', { method: 'POST', body: s })
  }, { put: put, set: set, errs: errs })
}
