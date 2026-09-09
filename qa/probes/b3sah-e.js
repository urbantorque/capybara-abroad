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
    // --- 1. the surf at a RUN, which is what the record is actually for -----
    park(278, 10)
    let best = 0, t = 0
    for (let i = 0; i < 1200; i++) {
      g.input.camYaw = 0; g.input.x = -1; g.input.z = 0; g.input.run = true
      g.tick(1 / 60, false); t += 1 / 60
      const sp = Math.hypot(b.velocity.x, b.velocity.z); if (sp > best) best = sp
      if (g.taskDone('dune-surf')) break
    }
    o.surfRun = { best: +best.toFixed(2), t: +t.toFixed(2), rec: g.records ? g.records['dune-surf'] : null }
    // --- 2. flat-ground speeds vs the pursuers -----------------------------
    park(0, 0)
    let flatWalk = 0, flatRun = 0
    for (let i = 0; i < 300; i++) { g.input.camYaw = 0; g.input.x = 0; g.input.z = -1; g.input.run = false
      g.tick(1 / 60, false); const s = Math.hypot(b.velocity.x, b.velocity.z); if (s > flatWalk) flatWalk = s }
    park(0, 0)
    let blownAt = -1, tt = 0
    for (let i = 0; i < 900; i++) { g.input.camYaw = 0; g.input.x = 0; g.input.z = -1; g.input.run = true
      g.tick(1 / 60, false); tt += 1 / 60
      const s = Math.hypot(b.velocity.x, b.velocity.z); if (s > flatRun) flatRun = s
      if (blownAt < 0 && s < flatRun * 0.8 && tt > 2) blownAt = +tt.toFixed(1) }
    o.speed = { walk: +flatWalk.toFixed(2), run: +flatRun.toFixed(2), pursuer: 5.9, blownAt }
    // --- 3. the chase, sprinting straight for the souk ----------------------
    park(sa.cart.x - 1.4, sa.cart.z + 0.6)
    g.input.actionPressed = true; g.tick(1 / 60, false); g.input.actionPressed = false
    o.robbed = g.taskDone('orange-cart')
    const trail = []
    let ct = 0, ended = null
    for (let i = 0; i < 2600; i++) {
      g.input.camYaw = 0; g.input.run = true
      const p = g.capy.position
      // head for the souk anchor, then jink about inside it
      const tx = sa.souk.x, tz = sa.souk.z
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz)
      if (d > 4) { g.input.x = dx / d; g.input.z = dz / d }
      else { g.input.x = Math.sin(ct * 1.3); g.input.z = Math.cos(ct * 1.3) }
      g.tick(1 / 60, false); ct += 1 / 60
      if (i % 30 === 0) trail.push([+p.x.toFixed(0), +p.z.toFixed(0), +sa.chaseNear().toFixed(1),
        sa.inZone('souk', p.x, p.z) ? 1 : 0])
      if (!sa.chasing() && ct > 2) { ended = { t: +ct.toFixed(1), escaped: g.taskDone('souk-escape'),
        x: +p.x.toFixed(0), z: +p.z.toFixed(0), inSouk: sa.inZone('souk', p.x, p.z) }; break }
      if (ct > 40) break
    }
    o.chase = { ended, trail, escaped: g.taskDone('souk-escape') }
    return o
  })
  out.errs = errs.slice(0, 6)
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-e.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
