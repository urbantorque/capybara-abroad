async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [] }

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  const r = await page.evaluate(async () => {
    const g = window.__capy
    const T = g.THREE
    // densest neighbourhood, then a camera 9 m off it at head height, which
    // is the distance and the pitch the game is actually played at
    let sx = 0, sz = 0, best = -1
    for (const p of g.npcs) {
      if (!p.group) continue
      let c = 0
      for (const q of g.npcs) {
        if (!q.group) continue
        const dx = q.group.position.x - p.group.position.x
        const dz = q.group.position.z - p.group.position.z
        if (dx * dx + dz * dz < 100) c++
      }
      if (c > best) { best = c; sx = p.group.position.x; sz = p.group.position.z }
    }
    // THE PERSON'S OWN FEET, not terrainHeight: Sydney does not publish one,
    // so the first run left gy at 0 and put the camera inside the hill — the
    // shot came back as a flat tan rectangle.
    let gy = 0
    for (const p of g.npcs) {
      if (p.group && Math.abs(p.group.position.x - sx) < 0.01) { gy = p.group.position.y; break }
    }
    const cam = new T.PerspectiveCamera(46, 1280 / 760, 0.05, 500)
    cam.position.set(sx, gy + 3.4, sz + 9)
    cam.lookAt(sx, gy + 1.45, sz)
    g.renderer.setRenderTarget(null)
    g.renderer.render(g.scene, cam)
    const url = g.renderer.domElement.toDataURL('image/png')
    // ...and the cost, read off the scene render rather than off the
    // composite pass. renderer.info reports the LAST render, and the last
    // render every frame is a fullscreen quad: reading it from outside the
    // loop says 1 call and 1 triangle, which is the quad.
    const i = g.renderer.info
    return { url: url, at: [Math.round(sx), Math.round(sz)], near: best,
             calls: i.render.calls, tris: i.render.triangles }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p5-dist.png', { method: 'POST', body: o.u }) },
                      { u: r.url })
  delete r.url
  out.shot = r

  // ---- frame time, 6 s of real frames -----------------------------------
  out.frame = await page.evaluate(async () => {
    const t = []
    let last = performance.now()
    await new Promise(res => {
      const step = () => {
        const n = performance.now()
        t.push(n - last); last = n
        if (t.length < 360) requestAnimationFrame(step); else res()
      }
      requestAnimationFrame(step)
    })
    t.sort((a, b) => a - b)
    return { n: t.length, med: Math.round(t[Math.floor(t.length / 2)] * 100) / 100,
             p95: Math.round(t[Math.floor(t.length * 0.95)] * 100) / 100 }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-dist.json', { method: 'POST', body: s })
  }, out)
}
