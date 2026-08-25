async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy, R = {}
    const b = g.capy.body, d = g.drift
    b.position.set(36, d.terrainHeight(36, -172) + 1.0, -172)
    b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false)
    R.lit = d.lit(); R.glow = +d.glow().toFixed(2)
    R.cam = { x: +g.camera.position.x.toFixed(1), y: +g.camera.position.y.toFixed(1),
      z: +g.camera.position.z.toFixed(1) }
    R.dist = +Math.hypot(g.camera.position.x - 36, g.camera.position.y - 108,
      g.camera.position.z + 190).toFixed(1)
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
  await page.waitForTimeout(2500)
}
