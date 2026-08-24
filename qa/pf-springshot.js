// The hot spring, side on, at the moment the sky lights.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const shot = (name, dx, dy, dz) => page.evaluate(async (o) => {
    const g = window.__capy, T = g.THREE
    g.renderer.setSize(1280, 760, false)
    if (!window.__side) window.__side = new T.PerspectiveCamera(40, 1280 / 760, 0.1, 500)
    const c = g.capy.renderPosition || g.capy.position
    window.__side.aspect = 1280 / 760
    window.__side.position.set(c.x + o.dx, c.y + o.dy, c.z + o.dz)
    window.__side.lookAt(c.x, c.y + 0.2, c.z)
    window.__side.updateProjectionMatrix()
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, window.__side)
    await fetch('/shot?name=' + o.n, { method: 'POST', body: g.canvas.toDataURL('image/png') })
  }, { n: name, dx, dy, dz })
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    for (let i = 0; i < 60 * 14; i++) g.tick(1 / 60, false)
  })
  await shot('pf-spring-close', 4.0, 1.0, 1.4)
  await page.evaluate(() => {
    const g = window.__capy
    for (let i = 0; i < 60 * 22; i++) g.tick(1 / 60, false)
  })
  await shot('pf-spring-wide', 15, 7, 13)
}
