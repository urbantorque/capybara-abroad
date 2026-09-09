async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(7000)
  await page.mouse.click(500, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    g.biome.switchTo('cali')
    const sp = g.biome.spawnOf('cali'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const c = g.cali
    const stick = () => {
      const a = c.chivaAt()
      b.position.set(a.x, a.y + 3.70 + 0.34, a.z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    stick()
    for (let i = 0; i < 60 * 200; i++) {
      if (!c.onChiva()) stick()
      g.tick(1 / 60, false)
      if (c.chivaState() === 'arrived') break
    }
    o.state = c.chivaState(); o.night = c.night(); o.skyward = c.skyward()
    o.capy = { x: +g.capy.position.x.toFixed(1), y: +g.capy.position.y.toFixed(1), z: +g.capy.position.z.toFixed(1) }
    // ---- what is actually in front of the lens ---------------------------
    const cam = g.camera
    const fwd = new (cam.position.constructor)()
    cam.getWorldDirection(fwd)
    o.camYawDeg = +(Math.atan2(fwd.x, fwd.z) * 180 / Math.PI).toFixed(1)
    o.camPitchDeg = +(Math.asin(Math.max(-1, Math.min(1, fwd.y))) * 180 / Math.PI).toFixed(1)
    o.camDist = +Math.hypot(cam.position.x - g.capy.position.x, cam.position.y - g.capy.position.y, cam.position.z - g.capy.position.z).toFixed(1)
    // direction the far city field actually lies in, from the capybara
    o.cityYawDeg = +(Math.atan2(85 - g.capy.position.x, -20 - g.capy.position.z) * 180 / Math.PI).toFixed(1)
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3cali3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
