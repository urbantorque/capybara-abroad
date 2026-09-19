async page => {
  // Part D: pinned own-camera looks at named places after a real title-card
  // arrival. Edit KEY/LOOKS between runs.
  const KEY = 'Semicolon'
  const LOOKS = [{ n: 'pantanal-gate', p: [-13, 4.6, 70], t: [3, 1.5, 76.5] }]
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(7000)
  for (const L of LOOKS) {
    const png = await page.evaluate((POSE) => {
      const g = window.__capy, T = g.THREE
      const c = new T.PerspectiveCamera(g.camera.fov, 1280 / 760, g.camera.near, g.camera.far)
      c.position.set(POSE.p[0], POSE.p[1], POSE.p[2]); c.lookAt(POSE.t[0], POSE.t[1], POSE.t[2]); c.updateMatrixWorld()
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c)
      return g.renderer.domElement.toDataURL('image/png')
    }, L)
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: 'WOW-H-' + L.n, u: png })
  }
}
