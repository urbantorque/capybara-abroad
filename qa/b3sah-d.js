async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = {}
    g.biome.switchTo('sahara')
    const b = g.capy.body, sa = g.sahara
    const snapPost = () => { const p = (g.post && g.post.params) || {}; const r = {}
      for (const k of ['bloom', 'threshold', 'radius', 'saturation', 'vignette']) if (k in p) r[k] = +p[k].toFixed(3)
      return r }
    const y0 = sa.terrainHeight(278, 10) + 1.0
    b.position.set(278, y0, 10); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.tick(1 / 60, false) }
    o.done0 = g.taskDone('dune-surf')
    o.pre = snapPost()
    let best = 0, t = 0, fired = null, series = []
    for (let i = 0; i < 1600; i++) {
      g.input.camYaw = 0; g.input.x = -1; g.input.z = 0
      g.tick(1 / 60, false); t += 1 / 60
      const p = g.capy.position, sp = Math.hypot(b.velocity.x, b.velocity.z)
      if (sp > best) best = sp
      if (i % 24 === 0) series.push([+p.x.toFixed(0), +sp.toFixed(1), sa.surfing() ? 1 : 0])
      if (!fired && g.taskDone('dune-surf')) {
        const c = g.camera
        fired = { t: +t.toFixed(2), x: +p.x.toFixed(1), y: +p.y.toFixed(1), sp: +sp.toFixed(2),
          best: +best.toFixed(2),
          camDist: +Math.hypot(c.position.x - p.x, c.position.z - p.z).toFixed(1),
          camDy: +(c.position.y - p.y).toFixed(1),
          camAz: +(Math.atan2(c.position.x - p.x, c.position.z - p.z) * 180 / Math.PI).toFixed(1),
          timeScale: +g.time.scale.toFixed(3), slow: +g.time.slow.toFixed(3),
          post: snapPost() }
        // watch the second after the payout
        let peakSlow = g.time.slow, peakBloom = ((g.post && g.post.params) || {}).bloom || 0
        for (let k = 0; k < 90; k++) { g.input.x = -1; g.tick(1 / 60, false)
          if (g.time.slow < peakSlow) peakSlow = g.time.slow
          const bl = ((g.post && g.post.params) || {}).bloom || 0
          if (bl > peakBloom) peakBloom = bl }
        fired.minSlowAfter = +peakSlow.toFixed(3)
        fired.maxBloomAfter = +peakBloom.toFixed(3)
        break
      }
      if (t > 26) break
    }
    o.surf = { fired, best: +best.toFixed(2), t: +t.toFixed(2), series }
    o.storm = +sa.storm().toFixed(2); o.dusk = +sa.dusk().toFixed(2)
    // the marquee's target point and what is around it
    o.camp = sa.camp; o.duneTop = sa.duneTop
    o.hCrest = +sa.terrainHeight(280, 10).toFixed(1)
    o.hFoot = +sa.terrainHeight(202, 10).toFixed(1)
    return o
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-d.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
