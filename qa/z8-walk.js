async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  const walk = async (name, biome, from, to, secs, run) => {
    await page.evaluate((q) => {
      const g = window.__capy
      if (g.biome.current !== q.biome) g.biome.switchTo(q.biome)
      const b = g.capy.body
      const y = (g[q.biome] && g[q.biome].terrainHeight) ? g[q.biome].terrainHeight(q.fx, q.fz) : 0
      b.position.set(q.fx, y + 1.4, q.fz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      window.__trk = []
    }, { biome, fx: from[0], fz: from[1] })
    await page.waitForTimeout(400)
    if (run) await page.keyboard.down('Shift')
    const t0 = Date.now()
    let last = null
    while (Date.now() - t0 < secs * 1000) {
      const st = await page.evaluate((q) => {
        const g = window.__capy, p = g.capy.position
        const dx = q.tx - p.x, dz = q.tz - p.z
        const d = Math.hypot(dx, dz)
        // camera-relative WASD, recomputed from the live camYaw
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
        // world (dx,dz) -> stick (sx,sz) such that input maps back to world
        const sx = dx * cy - dz * sy, sz = dx * sy + dz * cy
        if (!window.__trk) window.__trk = []
        window.__trk.push([Math.round(p.x*10)/10, Math.round(p.z*10)/10])
        return { d, sx, sz, x: p.x, z: p.z, y: p.y }
      }, { tx: to[0], tz: to[1] })
      if (st.d < 4) break
      const want = new Set()
      const n = Math.hypot(st.sx, st.sz) || 1
      const ux = st.sx / n, uz = st.sz / n
      // W is iz -= 1 and S is iz += 1 (systems.js), so the sign on z is INVERTED
      if (uz < -0.35) want.add('w'); if (uz > 0.35) want.add('s')
      if (ux > 0.35) want.add('d'); if (ux < -0.35) want.add('a')
      const cur = last || new Set()
      for (const k of cur) if (!want.has(k)) await page.keyboard.up(k)
      for (const k of want) if (!cur.has(k)) await page.keyboard.down(k)
      last = want
      await page.waitForTimeout(220)
    }
    if (last) for (const k of last) await page.keyboard.up(k)
    if (run) await page.keyboard.up('Shift')
    out[name] = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position
      const t = window.__trk || []
      // where did it get stuck: the last point it stayed near for a long time
      let stall = null, run2 = 0
      for (let i = 1; i < t.length; i++) {
        if (Math.hypot(t[i][0]-t[i-1][0], t[i][1]-t[i-1][1]) < 0.35) { run2++; if (run2 > 8 && !stall) stall = t[i] }
        else run2 = 0
      }
      return { end: [Math.round(p.x*10)/10, Math.round(p.y*10)/10, Math.round(p.z*10)/10],
               frames: t.length, stall, err: g.state.lastError || null }
    })
  }
  // through the rebuilt Bab Agnaou, both ways
  await walk('gate-out', 'sahara', [40, 12], [104, 16], 26, true)
  await walk('gate-in',  'sahara', [104, 16], [30, 8], 26, true)
  // the walk-up track on the south shoulder of the great dune, foot to crest
  await walk('dune-up',  'sahara', [198, 55], [276, 55], 40, true)
  // and the medina: the square to the middle of the souk
  await walk('to-souk',  'sahara', [0, 8], [-6, -38], 26, true)
  await page.evaluate(async (o) => { await fetch('/shot?name=z8walk.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
