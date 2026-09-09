async page => {
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
    const park = (x, z) => { const y = sa.terrainHeight(x, z) + 1.0
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.input.run = false; g.tick(1 / 60, false) } }
    // ---- THE CHASE, steered round obstacles --------------------------------
    park(7.0, 3.4)
    o.cartD = +Math.hypot(7 - sa.cart.x, 3.4 - sa.cart.z).toFixed(2)
    g.input.actionPressed = true; g.tick(1 / 60, false); g.input.actionPressed = false
    o.robbed = g.taskDone('orange-cart'); o.chasing0 = sa.chasing()
    const wps = [[0, 6], [-2, -6], [1, -20], [0, -32], [-4, -44], [4, -50], [-6, -46], [2, -36]]
    let wi = 0, ct = 0, trail = [], end = null
    for (let i = 0; i < 3200; i++) {
      const p = g.capy.position
      let [tx, tz] = wps[wi % wps.length]
      if (Math.hypot(tx - p.x, tz - p.z) < 3) wi++
      ;[tx, tz] = wps[wi % wps.length]
      let dx = tx - p.x, dz = tz - p.z; const d = Math.hypot(dx, dz) || 1
      dx /= d; dz /= d
      // slide along an obstacle rather than pressing into it
      if (sa.navBlocked(p.x + dx * 1.6, p.z + dz * 1.6, 0.6)) {
        const a = Math.atan2(dx, dz) + (i % 240 < 120 ? 1.1 : -1.1)
        dx = Math.sin(a); dz = Math.cos(a)
      }
      g.input.camYaw = 0; g.input.x = dx; g.input.z = dz; g.input.run = true
      g.tick(1 / 60, false); ct += 1 / 60
      if (i % 60 === 0) trail.push([+p.x.toFixed(0), +p.z.toFixed(0), +sa.chaseNear().toFixed(1), sa.inZone('souk', p.x, p.z) ? 1 : 0])
      if (!sa.chasing() && ct > 2.5) { end = { t: +ct.toFixed(1), escaped: g.taskDone('souk-escape'),
        x: +p.x.toFixed(0), z: +p.z.toFixed(0), inSouk: sa.inZone('souk', p.x, p.z) }; break }
      if (ct > 45) break
    }
    o.chase = { end, trail, escaped: g.taskDone('souk-escape'), chaseTime: +sa.chaseTime().toFixed(1) }
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-h.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
