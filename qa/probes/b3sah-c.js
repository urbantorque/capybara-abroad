async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = {}
    g.biome.switchTo('sahara')
    const b = g.capy.body, sa = g.sahara
    const park = (x, z) => {
      const y = sa.terrainHeight(x, z) + 1.0
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.tick(1 / 60, false) }
    }
    const snapPost = () => {
      const p = g.post && g.post.params ? g.post.params : {}
      const r = {}
      for (const k of ['bloom', 'threshold', 'radius', 'saturation', 'vignette']) if (k in p) r[k] = +p[k].toFixed(3)
      return r
    }
    // ---------- the marquee ----------
    park(278, 10)
    o.armAt278 = { slip: +sa.groundSlip(278, 10).toFixed(2), surfing: sa.surfing() }
    let best = 0, t = 0, fired = false, firedAt = null
    const preBloom = snapPost()
    for (let i = 0; i < 1600; i++) {
      g.input.camYaw = 0; g.input.x = -1; g.input.z = 0
      g.tick(1 / 60, false); t += 1 / 60
      const p = g.capy.position
      const sp = Math.hypot(b.velocity.x, b.velocity.z); if (sp > best) best = sp
      if (i === 4) o.armedEarly = sa.surfing()
      if (!fired && g.taskDone('dune-surf')) {
        fired = true
        const c = g.camera
        firedAt = { t: +t.toFixed(2), x: +p.x.toFixed(1), sp: +sp.toFixed(2), best: +best.toFixed(2),
          camDist: c ? +Math.hypot(c.position.x - p.x, c.position.z - p.z).toFixed(1) : null,
          camDy: c ? +(c.position.y - p.y).toFixed(1) : null,
          camYaw: c ? +(Math.atan2(c.position.x - p.x, c.position.z - p.z) * 180 / Math.PI).toFixed(1) : null,
          timeScale: g.time ? +g.time.scale.toFixed(3) : null,
          post: snapPost() }
        break
      }
      if (t > 26) break
    }
    o.surf = { fired, best: +best.toFixed(2), t: +t.toFixed(2), firedAt, preBloom }
    // ---------- the chase ----------
    park(sa.cart.x - 1.4, sa.cart.z + 0.6)
    o.cartDist = +Math.hypot(g.capy.position.x - sa.cart.x, g.capy.position.z - sa.cart.z).toFixed(2)
    g.input.actionPressed = true
    g.tick(1 / 60, false)
    g.input.actionPressed = false
    o.chaseArmed = { chasing: sa.chasing(), robbed: g.taskDone('orange-cart') }
    // run north-west and see if it resolves
    let near = [], esc = false, ct = 0
    for (let i = 0; i < 2200; i++) {
      g.input.camYaw = 0; g.input.x = (ct>9? Math.sin(ct*1.1):0); g.input.z = (ct>9? Math.cos(ct*1.1)*0.6 : -1)
      g.tick(1 / 60, false); ct += 1 / 60
      if (i % 60 === 0) near.push(+sa.chaseNear().toFixed(1))
      if (g.taskDone('souk-escape')) { esc = true; break }
      if (ct > 34) break
    }
    o.chase = { escaped: esc, t: +ct.toFixed(1), near: near.slice(0, 40), chasing: sa.chasing(),
                pos: { x: +g.capy.position.x.toFixed(0), z: +g.capy.position.z.toFixed(0) } }
    return o
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3sah-c.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
