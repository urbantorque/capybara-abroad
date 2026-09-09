async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  const walk = async (biome, from, to, secs, label) => {
    await page.evaluate((q) => {
      const g = window.__capy
      if (g.biome.current !== q.biome) g.biome.switchTo(q.biome)
      const b = g.capy.body
      b.position.set(q.fx, q.fy, q.fz); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      window.__trk = { pts: [], stuck: 0 }
    }, { biome, fx: from[0], fy: from[1], fz: from[2] })
    const keys = ['KeyW','KeyA','KeyS','KeyD']
    let held = new Set()
    const t0 = Date.now()
    while ((Date.now() - t0) / 1000 < secs) {
      const st = await page.evaluate((q) => {
        const g = window.__capy
        const p = g.capy.body.position
        window.__trk.pts.push([Math.round(p.x*10)/10, Math.round(p.z*10)/10])
        const yaw = g.input.camYaw || 0
        const dx = q.tx - p.x, dz = q.tz - p.z
        const d = Math.hypot(dx, dz)
        // camera-relative: forward is (sin yaw, cos yaw)? derive from systems convention
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw)
        const rx = -Math.cos(yaw), rz = Math.sin(yaw)
        const f = (dx*fx + dz*fz) / (d||1)
        const r = (dx*rx + dz*rz) / (d||1)
        return { x: p.x, z: p.z, d, f, r }
      }, { tx: to[0], tz: to[2] })
      if (st.d < 4) break
      const want = new Set()
      if (st.f < -0.3) want.add('KeyS'); else if (st.f > 0.3) want.add('KeyW')
      if (st.r > 0.3) want.add('KeyD'); else if (st.r < -0.3) want.add('KeyA')
      if (st.f > -0.3 && st.f < 0.3) { want.add(st.f > 0 ? 'KeyW' : 'KeyS') }
      for (const k of keys) {
        if (want.has(k) && !held.has(k)) { await page.keyboard.down(k); held.add(k) }
        else if (!want.has(k) && held.has(k)) { await page.keyboard.up(k); held.delete(k) }
      }
      await page.waitForTimeout(220)
    }
    for (const k of held) await page.keyboard.up(k)
    out[label] = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.body.position
      const pts = window.__trk.pts
      return { end: [Math.round(p.x*10)/10, Math.round(p.y*10)/10, Math.round(p.z*10)/10],
               n: pts.length, tail: pts.slice(-14) }
    })
  }
  await walk('rio', [0,1.4,0], [0,1.4,46], 30, 'beach-to-avenue')
  await walk('rio', [40,1.4,0], [40,1.4,46], 25, 'beach-to-avenue-x40')
  await page.evaluate(async (o) => { await fetch('/shot?name=y67walk.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
