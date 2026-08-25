async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = { log: [] }
    g.biome.switchTo('sahara')
    const b = g.capy.body
    const sa = g.sahara
    // drop in at the top of the windward slip face
    const x0 = 270, z0 = 10
    const y0 = sa.terrainHeight(x0, z0) + 1.2
    b.position.set(x0, y0, z0); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
    o.slipAtTop = +sa.groundSlip(270, 10).toFixed(3)
    o.slipMid = +sa.groundSlip(240, 10).toFixed(3)
    o.slipShoulder = +sa.groundSlip(240, 60).toFixed(3)
    o.armed0 = sa.surfing()
    // drive west
    let fired = false, best = 0, t = 0, firedAt = null
    const preTasks = new Set(Object.keys(g.state.tasksDone || {}))
    const grade = []
    for (let i = 0; i < 1400; i++) {
      g.input.camYaw = 0; g.input.x = -1; g.input.z = 0
      g.tick(1 / 60, false)
      t += 1 / 60
      const sp = Math.hypot(b.velocity.x, b.velocity.z)
      if (sp > best) best = sp
      const p = g.capy.position
      if (i % 30 === 0) grade.push([+p.x.toFixed(0), +p.y.toFixed(0), +sp.toFixed(1), sa.surfing() ? 1 : 0])
      if (!fired && g.state.tasksDone && g.state.tasksDone['dune-surf']) {
        fired = true
        firedAt = {
          t: +t.toFixed(2), x: +p.x.toFixed(1), y: +p.y.toFixed(1), sp: +sp.toFixed(2),
          camYaw: g.camera ? +(g.camera.rotation.y * 180 / Math.PI).toFixed(1) : null,
          camDist: g.camera ? +Math.hypot(g.camera.position.x - p.x, g.camera.position.z - p.z).toFixed(1) : null,
          camDy: g.camera ? +(g.camera.position.y - p.y).toFixed(1) : null,
          timeScale: g.time ? +g.time.scale.toFixed(3) : null,
          bloom: g.post && g.post.bloom !== undefined ? g.post.bloom : (g.post && g.post.uniforms ? 'u' : null)
        }
        // sample the grade for the next second
        for (let k = 0; k < 60; k++) { g.input.x = -1; g.tick(1 / 60, false) }
        firedAt.timeScaleAfter = g.time ? +g.time.scale.toFixed(3) : null
        break
      }
      if (t > 22) break
    }
    o.surf = { fired, best: +best.toFixed(2), t: +t.toFixed(2), firedAt, trail: grade }
    o.dune = { top: sa.duneTop, hTop: +sa.terrainHeight(276, 10).toFixed(1),
               hEnd: +sa.terrainHeight(202, 10).toFixed(1) }
    // the grade layer's live numbers
    o.postKeys = g.post ? Object.keys(g.post).slice(0, 20) : null
    o.storm = +sa.storm().toFixed(3); o.dusk = +sa.dusk().toFixed(3)
    return o
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3sah-b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
