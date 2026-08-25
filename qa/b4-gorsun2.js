async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { rows: [] }
    g.biome.switchTo('goreme')
    const A = g.goreme, b = g.capy.body
    const bp = A.balloon()
    b.position.set(bp.x, bp.y + 0.9, bp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const inp = g.input
    inp.x = 0; inp.z = 0; inp.run = false
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    let fired = false
    for (let i = 0; i < 60 * 400 && !fired; i++) {
      inp.action = true
      g.tick(1 / 60, false)
      if (g.framing() > 0.3) fired = true
      const p = A.balloon()
      if (Math.abs(b.position.x - p.x) > 1.2 || Math.abs(b.position.z - p.z) > 1.2) {
        b.position.x = p.x; b.position.z = p.z; b.velocity.x = 0; b.velocity.z = 0
      }
    }
    R.fired = fired
    R.alt = +g.capy.position.y.toFixed(1)

    // find the sun disc in the scene: the biggest emissive-ish mesh at x ~ 760
    let sun = null
    g.scene.traverse(o => {
      if (!o.isMesh) return
      const wp = new (o.position.constructor)()
      o.getWorldPosition(wp)
      if (wp.x > 600 && wp.x < 900 && Math.abs(wp.z + 70) < 200) {
        if (!sun || wp.y > sun.y) sun = { obj: o, x: wp.x, y: wp.y, z: wp.z, vis: o.visible }
      }
    })
    R.sun = sun ? { x: Math.round(sun.x), y: Math.round(sun.y), z: Math.round(sun.z), vis: sun.vis } : null
    if (!sun) { R.err = g.state.lastError || null; return R }

    // Where is it, relative to the animal, right now?
    const c = g.capy.position
    R.sunBearingDeg = +(Math.atan2(sun.x - c.x, sun.z - c.z) * 180 / Math.PI).toFixed(1)
    R.sunElevDeg = +(Math.atan2(sun.y - c.y, Math.hypot(sun.x - c.x, sun.z - c.z)) * 180 / Math.PI).toFixed(1)

    // Try candidate shots: after each, settle and project the sun into NDC.
    const cand = [
      { yaw: -1.10, pitch: 0.00, raise: 1.4, dist: 17, tag: 'A yaw -1.10' },
      { yaw: -1.00, pitch: 0.00, raise: 1.4, dist: 17, tag: 'B yaw -1.00' },
      { yaw: -1.10, pitch: -0.04, raise: 2.4, dist: 19, tag: 'C -1.10 low wide' },
      { yaw: -0.90, pitch: 0.00, raise: 1.4, dist: 17, tag: 'D yaw -0.90' },
    ]
    const V = g.camera.position.constructor
    for (const k of cand) {
      const o = { yaw: k.yaw, pitch: k.pitch, raise: k.raise, hold: 6 }
      if (k.dist) o.dist = k.dist
      g.frameShot(o)
      for (let i = 0; i < 130; i++) { inp.action = true; g.tick(1 / 60, false) }
      const v = new V(sun.x, sun.y, sun.z)
      g.camera.updateMatrixWorld()
      v.project(g.camera)
      const e = g.camera.position, cc = g.capy.position
      R.rows.push({ tag: k.tag, w: +g.framing().toFixed(2),
                    ndc: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3)],
                    inFrame: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
                    bearing: +(Math.atan2(e.x - cc.x, e.z - cc.z) * 180 / Math.PI).toFixed(1),
                    dist: +Math.hypot(e.x - cc.x, e.z - cc.z).toFixed(1),
                    dy: +(e.y - cc.y).toFixed(2) })
    }
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-gorsun2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
