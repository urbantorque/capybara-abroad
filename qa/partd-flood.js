async page => {
  // Part D, Venice: push the tide clock with game.tick and shoot the flooded
  // square from a pinned lens, to read the algae tint under the water.
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit0')
  await page.waitForTimeout(6000)
  // the tide arms 90 s after arrival (or near the square); then ~100 s to the top
  for (let k = 0; k < 7; k++) {
    await page.evaluate(() => { const g = window.__capy; for (let i = 0; i < 600; i++) g.tick(0.1, false) })
  }
  const out = await page.evaluate((POSE) => {
    const g = window.__capy, T = g.THREE
    const c = new T.PerspectiveCamera(g.camera.fov, 1280 / 760, g.camera.near, g.camera.far)
    c.position.set(POSE.p[0], POSE.p[1], POSE.p[2]); c.lookAt(POSE.t[0], POSE.t[1], POSE.t[2]); c.updateMatrixWorld()
    g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c)
    return { water: g.biome && g.biome.api && g.biome.api.waterLevel, png: g.renderer.domElement.toDataURL('image/png') }
  }, { p: [2, 7, -8], t: [-30, 0, -40] })
  await page.evaluate(async (o) => { await fetch('/shot?name=WOW-D-venice-flood', { method: 'POST', body: o.u }) }, { u: out.png })
  await page.evaluate(async (o) => { await fetch('/shot?name=partd-venice-flood.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, { water: out.water })
}
