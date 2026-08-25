async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy, R = {}
    const b = g.capy.body, d = g.drift
    b.position.set(36, d.terrainHeight(36, -172) + 1.0, -172)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    // walk north so the rig swings round behind and the lantern is ahead
    for (let i = 0; i < 200; i++) {
      g.input.forward = 1; g.input.mz = -1; g.input.moveZ = -1; g.input.up = true
      b.velocity.z = -3.2; b.velocity.x = 0
      g.tick(1 / 60, false)
    }
    g.input.forward = 0; g.input.mz = 0; g.input.moveZ = 0; g.input.up = false
    b.velocity.set(0, 0, 0)
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false)
    R.capy = { x: +g.capy.position.x.toFixed(1), z: +g.capy.position.z.toFixed(1) }
    R.cam = { x: +g.camera.position.x.toFixed(1), y: +g.camera.position.y.toFixed(1),
      z: +g.camera.position.z.toFixed(1) }
    R.dist = +Math.hypot(g.camera.position.x - 36, g.camera.position.y - 113,
      g.camera.position.z + 190).toFixed(1)
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
  await page.waitForTimeout(2500)
}
