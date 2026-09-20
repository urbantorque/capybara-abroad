async page => {
  const FROM = { cam: [44, 9, 215], at: [44, 6, 520], fov: 48 }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForFunction(() => window.__capy.state && window.__capy.state.started, null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(1500)
  await page.evaluate((n) => window.__capy.hud.cross(n), 'hanoi')
  await page.waitForFunction(() => window.__capy.biome.current === 'hanoi', null, { timeout: 60000, polling: 500 })
  await page.waitForTimeout(6000)
  await page.evaluate(async (FROM) => {
    const g = window.__capy, T = g.THREE
    const cam = new T.PerspectiveCamera(FROM.fov, 1280 / 760, 0.5, g.camera.far)
    cam.position.set(FROM.cam[0], FROM.cam[1], FROM.cam[2])
    cam.lookAt(FROM.at[0], FROM.at[1], FROM.at[2])
    cam.updateMatrixWorld()
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, cam)
    const cx = 400, cy = 330, cw = 480, ch = 220
    const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch
    const ctx = c2.getContext('2d')
    ctx.drawImage(g.renderer.domElement, cx, cy, cw, ch, 0, 0, cw, ch)
    const url = c2.toDataURL('image/png')
    await fetch('/shot?name=wow3-d4-hanoi-crop.png', { method: 'POST', body: url.split(',')[1] })
  }, FROM)
}
