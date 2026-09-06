async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  // OUT OF THE LOAF. Rest IS the loaf after capyLOAF_T, and every picture of
  // this animal at rest is a picture of it sitting down — which is not the pose
  // the top line is about. Walk, release, and shoot inside a quarter of a
  // second, before it settles again.
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1400)
  await page.keyboard.up('KeyW')

  const shot = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const res = { err: null, loaf: null }
    try {
      res.loaf = g.capy.loaf
      const W = 1280, H = 760
      g.renderer.setSize(W, H, false)
      const my = (g.capy.model || g.capy.group).rotation.y
      const p = g.capy.position
      const aim = new T.Vector3(p.x, p.y + 0.16, p.z)
      for (const s of [['side', Math.PI * 0.5, 3.0, 0.45],
                       ['rear3q', Math.PI * 0.78, 3.0, 0.85],
                       ['front3q', Math.PI * 0.22, 3.0, 0.75]]) {
        const yaw = my + s[1]
        const c = new T.PerspectiveCamera(26, W / H, 0.02, 400)
        c.position.set(aim.x + Math.sin(yaw) * s[2], aim.y + s[3], aim.z + Math.cos(yaw) * s[2])
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        g.renderer.render(g.scene, c)
        await fetch('/shot?name=R2s-' + s[0], { method: 'POST',
          body: g.renderer.domElement.toDataURL('image/png') })
      }
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })

  // ---- THE APEX. Nothing here touched the collider or the launch, and that is
  // exactly why it gets asserted: a body change that moved it would be silent.
  await page.waitForTimeout(2500)
  const y0 = await page.evaluate(() => window.__capy.capy.position.y)
  await page.keyboard.press('Space')
  const hop = await page.evaluate(async (y0) => {
    const g = window.__capy
    let hi = -9, lo = 9
    const t0 = performance.now()
    while (performance.now() - t0 < 1600) {
      const y = g.capy.position.y
      if (y > hi) hi = y
      if (y < lo) lo = y
      await new Promise(r => requestAnimationFrame(r))
    }
    return { y0, hi: Math.round(hi * 1000) / 1000, lo: Math.round(lo * 1000) / 1000,
             rise: Math.round((hi - y0) * 1000) / 1000 }
  }, y0)

  const out = { shot, hop, errs }
  await page.evaluate(async o => {
    await fetch('/shot?name=R2s-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
