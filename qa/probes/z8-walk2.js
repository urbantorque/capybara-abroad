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
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw)
        const sx = dx * cy - dz * sy, sz = dx * sy + dz * cy
        if (!window.__trk) window.__trk = []
        window.__trk.push([Math.round(p.x*10)/10, Math.round(p.y*10)/10, Math.round(p.z*10)/10])
        return { d, sx, sz }
      }, { tx: to[0], tz: to[1] })
      if (st.d < 4) break
      const want = new Set()
      const n = Math.hypot(st.sx, st.sz) || 1
      const ux = st.sx / n, uz = st.sz / n
      if (uz < -0.35) want.add('w'); if (uz > 0.35) want.add('s')
      if (ux > 0.35) want.add('d'); if (ux < -0.35) want.add('a')
      const cur = last || new Set()
      for (const k of cur) if (!want.has(k)) await page.keyboard.up(k)
      for (const k of want) if (!cur.has(k)) await page.keyboard.down(k)
      last = want
      await page.waitForTimeout(200)
    }
    if (last) for (const k of last) await page.keyboard.up(k)
    if (run) await page.keyboard.up('Shift')
    out[name] = await page.evaluate((q) => {
      const g = window.__capy, p = g.capy.position
      const t = window.__trk || []
      let stall = null, run2 = 0
      for (let i = 1; i < t.length; i++) {
        if (Math.hypot(t[i][0]-t[i-1][0], t[i][2]-t[i-1][2]) < 0.3) { run2++; if (run2 > 8 && !stall) stall = t[i] }
        else run2 = 0
      }
      return { end: [Math.round(p.x*10)/10, Math.round(p.y*10)/10, Math.round(p.z*10)/10],
               reached: Math.hypot(p.x - q.tx, p.z - q.tz) < 6,
               frames: t.length, stall, storm: g.sahara ? +g.sahara.storm().toFixed(2) : null,
               err: g.state.lastError || null }
    }, { tx: to[0], tz: to[1] })
  }
  // the walk-up track: the FIRM shoulder, and it must be climbable. Kept under
  // the 22 s the sandstorm needs to arm, or the wind blows the test back down
  // the dune it is testing (which is the mechanic, not a failure).
  await walk('dune-shoulder', 'sahara', [222, 55], [272, 55], 17, true)
  // and the middle of the face MUST NOT be climbable - that is the whole point
  // of sahGroundSlip and the reason the shoulders exist
  await walk('dune-slip', 'sahara', [230, 10], [274, 10], 17, true)
  await page.evaluate(async (o) => { await fetch('/shot?name=z8walk2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
