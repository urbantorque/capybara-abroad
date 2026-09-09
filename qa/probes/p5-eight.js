async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  // Eight bearings round the densest knot of people, all posted. Picking one
  // bearing blind put the camera inside the cafe wall twice; eight is cheaper
  // than guessing which way the building is.
  for (let i = 0; i < 8; i++) {
    const u = await page.evaluate(async (i) => {
      const g = window.__capy
      const T = g.THREE
      let sx = 0, sy = 0, sz = 0, best = -1
      for (const p of g.npcs) {
        if (!p.group) continue
        let c = 0
        for (const q of g.npcs) {
          if (!q.group) continue
          const dx = q.group.position.x - p.group.position.x
          const dz = q.group.position.z - p.group.position.z
          if (dx * dx + dz * dz < 121) c++
        }
        if (c > best) { best = c; sx = p.group.position.x; sy = p.group.position.y; sz = p.group.position.z }
      }
      const a = i * Math.PI / 4
      const cam = new T.PerspectiveCamera(44, 1100 / 660, 0.05, 500)
      cam.position.set(sx + Math.sin(a) * 10, sy + 3.0, sz + Math.cos(a) * 10)
      cam.lookAt(sx, sy + 1.35, sz)
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      return g.renderer.domElement.toDataURL('image/png')
    }, i)
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
                        { n: 'p5-eight-' + i, u: u })
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-eight.json', { method: 'POST', body: s })
  }, { errs: errs })
}
