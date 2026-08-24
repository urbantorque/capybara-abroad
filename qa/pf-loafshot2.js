// The pose, side on, from a camera this script owns. The game's own lens is
// player-controlled and the previous cut of this shot came out from directly
// behind the animal, where a sit and a stand look identical. Rendered without
// the post chain on purpose: this is a shape check, not a picture check.
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const shot = (name) => page.evaluate(async (n) => {
    const g = window.__capy
    const T = g.THREE
    g.renderer.setSize(1280, 760, false)
    if (!window.__side) {
      window.__side = new T.PerspectiveCamera(38, 1280 / 760, 0.1, 400)
    }
    const c = g.capy.renderPosition || g.capy.position
    window.__side.aspect = 1280 / 760
    window.__side.position.set(c.x + 4.4, c.y + 1.15, c.z + 1.2)
    window.__side.lookAt(c.x, c.y + 0.30, c.z)
    window.__side.updateProjectionMatrix()
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, window.__side)
    await fetch('/shot?name=' + n, { method: 'POST', body: g.canvas.toDataURL('image/png') })
  }, name)
  const run = (n) => page.evaluate((k) => {
    const g = window.__capy
    for (let i = 0; i < k; i++) g.tick(1 / 60, false)
  }, n)

  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const sp = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    for (let i = 0; i < 45; i++) { g.input.x = 0.6; g.tick(1 / 60, false) }
    g.input.x = 0
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false)
  })
  await shot('pf-pose-standing')
  await run(60 * 16)
  await shot('pf-pose-sat')
  const st = await page.evaluate(() => ({ loaf: +window.__capy.capy.loaf.toFixed(2) }))
  await page.evaluate(async o => {
    await fetch('/shot?name=pfpose.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, st)
}
