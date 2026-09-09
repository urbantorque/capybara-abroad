async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('cali')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const c = g.cali, b = g.capy.body
    const stick = () => { const a = c.chivaAt(); b.position.set(a.x, a.y + 4.05, a.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    stick()
    for (let i = 0; i < 12000; i++) { if (!c.onChiva()) stick(); g.tick(1 / 60, false); if (c.rideProgress() > 0.62) break }
    window.__stick = 1
    const loop = () => { if (!window.__stick) return; if (!c.onChiva() && c.chivaState() !== 'arrived') stick(); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  })
  let st = {}
  for (let k = 0; k < 14; k++) {
    await page.waitForTimeout(4000)
    st = await page.evaluate(() => { const c = window.__capy.cali; return { p: +c.rideProgress().toFixed(3), s: c.chivaState() } })
    if (st.s === 'arrived') break
  }
  const shot = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE || window.THREE
    const cam = g.camera
    const dir = new (cam.getWorldDirection(new (Object.getPrototypeOf(cam.position).constructor)()).constructor)()
    cam.getWorldDirection(dir)
    const camYaw = Math.atan2(dir.x, dir.z)
    // sample the city floor on a 6 m grid, count what is inside the frustum
    const v = new (Object.getPrototypeOf(cam.position).constructor)()
    let tot = 0, seen = 0, below = 0
    for (let x = -74; x <= 74; x += 6) for (let z = -36; z <= 76; z += 6) {
      const y = g.cali.terrainHeight(x, z)
      tot++
      v.set(x, y + 2, z); v.project(cam)
      if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1) seen++
      if (y < g.capy.position.y - 8) below++
    }
    return { camYaw: +camYaw.toFixed(3), MIR_YAW: 1.068, offDeg: +((camYaw - 1.068) * 180 / Math.PI).toFixed(1),
      cityCells: tot, inFrustum: seen, pctSeen: +(seen / tot * 100).toFixed(1), cellsBelow: below,
      capyY: +g.capy.position.y.toFixed(2),
      terrMir: +g.cali.terrainHeight(-84, -46).toFixed(2),
      terrFloor: +g.cali.terrainHeight(-22, 52).toFixed(2),
      terrGato: +g.cali.terrainHeight(0, 8).toFixed(2),
      skyward: +g.cali.skyward().toFixed(2),
      state: g.cali.chivaState(), night: g.cali.night() }
  })
  // now aim the rig down the terrace's own view axis and look again
  await page.evaluate(async () => {
    const g = window.__capy
    const wrap = a => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a }
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    for (let i = 0; i < 400; i++) {
      const d = wrap(1.068 - g.input.camYaw)
      if (Math.abs(d) < 0.04) break
      const k = d > 0 ? 'KeyZ' : 'KeyX'
      down(k); await new Promise(r => requestAnimationFrame(r)); up(k)
    }
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/p3c-view.png' })
  const shot2 = await page.evaluate(() => {
    const g = window.__capy, cam = g.camera
    const v = new (Object.getPrototypeOf(cam.position).constructor)()
    let tot = 0, seen = 0
    for (let x = -74; x <= 74; x += 6) for (let z = -36; z <= 76; z += 6) {
      const y = g.cali.terrainHeight(x, z); tot++
      v.set(x, y + 2, z); v.project(cam)
      if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1) seen++
    }
    window.__stick = 0
    return { pctSeenAimed: +(seen / tot * 100).toFixed(1), camYaw: +g.input.camYaw.toFixed(3), err: g.state.lastError || null }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p3c6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, { st, shot, shot2 })
}
