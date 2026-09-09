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
    const park = (x, z) => { const y = sa.terrainHeight(x, z) + 1.0
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.input.run = false; g.tick(1 / 60, false) } }
    const runNorth = (secs) => { const p0 = { x: g.capy.position.x, z: g.capy.position.z }
      const tr = []
      for (let i = 0; i < secs * 60; i++) { g.input.camYaw = 0; g.input.x = 0; g.input.z = -1; g.input.run = true
        g.tick(1 / 60, false)
        if (i % 30 === 0) tr.push([+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)]) }
      return { moved: +Math.hypot(g.capy.position.x - p0.x, g.capy.position.z - p0.z).toFixed(1), tr } }
    // A. stand where the E-press happens and just walk away. NO chase.
    park(sa.cart.x + 0.4, sa.cart.z + 2.9)
    o.atCartNoChase = runNorth(5)
    // B. same spot, rob it first
    park(sa.cart.x + 0.4, sa.cart.z + 2.9)
    g.input.actionPressed = true; g.tick(1 / 60, false); g.input.actionPressed = false
    o.robbed = g.taskDone('orange-cart')
    o.atCartChased = runNorth(5)
    o.nearAfter5 = +sa.chaseNear().toFixed(1)
    // C. keep going for another 12 s and see where it ends
    let ct = 5, end = null
    for (let i = 0; i < 1600; i++) {
      const p = g.capy.position
      const tx = sa.souk.x, tz = sa.souk.z
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz)
      g.input.camYaw = 0; g.input.run = true
      if (d > 4) { g.input.x = dx / d; g.input.z = dz / d } else { g.input.x = Math.sin(ct * 1.3); g.input.z = Math.cos(ct * 1.3) }
      g.tick(1 / 60, false); ct += 1 / 60
      if (!sa.chasing()) { end = { t: +ct.toFixed(1), escaped: g.taskDone('souk-escape'),
        x: +p.x.toFixed(0), z: +p.z.toFixed(0), inSouk: sa.inZone('souk', p.x, p.z) }; break }
      if (ct > 45) break
    }
    o.chaseEnd = end
    // D. navBlocked map around the cart, 1 m grid
    const map = []
    for (let dz = -4; dz <= 4; dz++) { let row = ''
      for (let dx = -4; dx <= 4; dx++) row += sa.navBlocked(sa.cart.x + dx, sa.cart.z + dz, 0.6) ? '#' : '.'
      map.push(row) }
    o.navMapCart = map
    o.cart = sa.cart
    // E. souk cover: how far from the cart to the first souk cell
    o.souk = sa.souk
    o.distCartSouk = +Math.hypot(sa.cart.x - sa.souk.x, sa.cart.z - sa.souk.z).toFixed(1)
    return o
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-f.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
