async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  const CHAPTER = 'manly'
  const out = { errs, chapter: CHAPTER }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate((n) => window.__capy.hud.cross(n), CHAPTER)
  await page.waitForFunction((n) => window.__capy.biome.current === n, CHAPTER, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(6000)
  for (let tries = 0; tries < 15; tries++) {
    const a = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => { const p = window.__capy.camera.position; return [p.x, p.y, p.z] })
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05) break
  }
  out.info = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera.clone(); cam.updateMatrixWorld()
    const far = g.far
    if (!far || !far.mover) return { skipped: 'no far mover' }
    const mesh = far.mover.mesh
    mesh.visible = true
    // Place it at x 150 (the North Head side of its run, where the top-edge
    // clip read worst before the fix) on its NEW z.
    mesh.position.set(150, 0, -295)
    mesh.rotation.set(0, 0, 0)
    mesh.updateMatrixWorld(true)
    const mp = mesh.getWorldPosition(new T.Vector3())
    // Same camera HEIGHT and PITCH the arrival lens actually pinned to
    // (cam.position, cam.quaternion are kept exactly as resting left them);
    // only the YAW is turned to face the mover, since this session's own
    // resting yaw happened to face the promenade, not the water -- the
    // roadmap's own point is about the PITCH clipping the top edge, which
    // this preserves unchanged.
    const camPos = cam.position.clone()
    const flatDir = mp.clone().sub(camPos); flatDir.y = 0
    const camDir = new T.Vector3(); cam.getWorldDirection(camDir)
    const pitch = Math.asin(camDir.y)
    const yaw = Math.atan2(flatDir.x, flatDir.z)
    const newCam = cam.clone()
    newCam.position.copy(camPos)
    newCam.rotation.set(0, 0, 0)
    newCam.rotateY(yaw)
    newCam.rotateX(pitch)
    newCam.updateMatrixWorld(true)
    const v = mp.clone().project(newCam)
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, newCam)
    g.__lastCam = newCam
    return { ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], camPos: [+camPos.x.toFixed(1), +camPos.y.toFixed(1), +camPos.z.toFixed(1)], pitchDeg: +(pitch * 180 / Math.PI).toFixed(1) }
  })
  await page.screenshot({ path: 'qa/wow3-d5-ferry-after2.png' })
  await page.evaluate(async (o) => { await fetch('/shot?name=w1-ferry-shot2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
