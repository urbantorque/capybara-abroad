async page => {
  // T1c, the other half. Board at the pad, burn past 2.5 m (gorFlown), let go
  // and come down where the chase has put the trailer. Then:
  //   A. in the basket for 4 s: the truck holds (no ride, no sweep)
  //   B. onto the bed: the ride to the square starts
  //   C. off the bed after 2 s: the truck comes back for the grounded basket
  //      and must stop with the bed 6.4 m+ off it (gorCHASE_OFF)
  const TAG = 'ten-t1c-land-' + Date.now()
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const out = { samples: [] }
  const post = () => page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
  const snap = () => page.evaluate(() => {
    const g = window.__capy, G = g.goreme, p = g.capy.position
    const b = G.balloon(), bx = b.x, by = b.y, bz = b.z
    const t = G.truck(), tx = t.x, tz = t.z
    const r = G.trailer(), rx = r.x, rz = r.z, ry = r.y
    return { t: +g.state.time.toFixed(1), p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      bal: [+bx.toFixed(2), +by.toFixed(2), +bz.toFixed(2)], alt: +G.altitude().toFixed(2), flown: G.flown(),
      truck: [+tx.toFixed(2), +tz.toFixed(2)], tb: +Math.hypot(tx - bx, tz - bz).toFixed(2),
      bed: [+rx.toFixed(2), +rz.toFixed(2)], bedY: +ry.toFixed(2), bb: +Math.hypot(rx - bx, rz - bz).toFixed(2),
      aboard: G.aboard(), ride: G.riding(), landDone: g.taskDone ? g.taskDone('on-the-trailer') : null,
      rung: g.state.perfRung, err: g.state.lastError || null }
  })
  const put = (x, y, z) => page.evaluate(q => {
    const g = window.__capy
    g.capy.body.position.set(q.x, q.y, q.z)
    g.capy.body.velocity.set(0, 0, 0)
    g.capy.body.previousPosition.copy(g.capy.body.position)
    g.capy.body.interpolatedPosition.copy(g.capy.body.position)
  }, { x, y, z })
  const watch = async (arr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { arr.push(await snap()); await page.waitForTimeout(900) } }
  await page.goto('http://localhost:5193/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('goreme') })
  await page.waitForFunction(() => window.__capy.biome.current === 'goreme', null, { timeout: 30000 })
  await page.waitForTimeout(6000)
  // the walk is ten-t1c-board's proof; here the animal starts at the kerb
  let s = await snap()
  await put(s.bal[0], s.bal[1] + 1.2, s.bal[2] + 2.6)
  await page.waitForTimeout(800)
  // steer at the basket on the camera's yaw and hop, as ten-t1c-board does
  for (let i = 0; i < 16; i++) {
    const q = await page.evaluate(() => { const g = window.__capy, b = g.goreme.balloon(), p = g.capy.position
      return { ab: g.goreme.aboard(), dx: b.x - p.x, dz: b.z - p.z, yaw: g.input.camYaw } })
    if (q.ab) break
    const d = Math.max(0.01, Math.hypot(q.dx, q.dz))
    const f = (q.dx * -Math.sin(q.yaw) + q.dz * -Math.cos(q.yaw)) / d, r = (q.dx * Math.cos(q.yaw) + q.dz * -Math.sin(q.yaw)) / d
    const ks = []
    if (f > 0.38) ks.push('KeyW'); if (f < -0.38) ks.push('KeyS'); if (r > 0.38) ks.push('KeyD'); if (r < -0.38) ks.push('KeyA')
    for (const k of ks) await page.keyboard.down(k)
    await page.keyboard.down('Space'); await page.waitForTimeout(150); await page.keyboard.up('Space')
    await page.waitForTimeout(350)
    for (const k of ks) await page.keyboard.up(k)
    await page.waitForTimeout(200)
  }
  out.boarded = await snap()
  await page.keyboard.down('KeyE')
  const tb0 = Date.now()
  while (Date.now() - tb0 < 30000) { s = await snap(); if (s.alt > 6) break; await page.waitForTimeout(400) }
  await page.keyboard.up('KeyE')
  out.top = await snap()
  const td0 = Date.now()
  while (Date.now() - td0 < 60000) { s = await snap(); out.samples.push(s); if (s.alt < 0.05) break; await page.waitForTimeout(1000) }
  out.landed = await snap()
  out.A = []; await watch(out.A, 4000)
  // out of the basket, to the side away from the truck: the bed pulls clear
  s = await snap()
  let ux = s.bal[0] - s.truck[0], uz = s.bal[2] - s.truck[1], ul = Math.hypot(ux, uz) || 1
  await put(s.bal[0] + (ux / ul) * 4.5, s.bal[1] + 1.0, s.bal[2] + (uz / ul) * 4.5)
  out.C1 = []; await watch(out.C1, 10000)
  // onto the bed: the ride to the square
  s = await snap()
  await put(s.bed[0], s.bedY + 0.8, s.bed[1])
  out.B = []; await watch(out.B, 6000)
  // the ride ends at the square with the animal on the bed (a teleport onto a
  // bed doing 9 m/s falls off, and a ride left inside 1.5 s stays live), so
  // once the truck is there, on again for 5 s
  s = await snap()
  await put(s.bed[0], s.bedY + 0.8, s.bed[1])
  out.D = []; await watch(out.D, 5000)
  // off the bed to its side: the truck goes back for the grounded basket
  s = await snap()
  ux = s.bed[0] - s.bal[0]; uz = s.bed[1] - s.bal[2]; ul = Math.hypot(ux, uz) || 1
  await put(s.bed[0] + (-uz / ul) * 4, s.bedY + 0.2, s.bed[1] + (ux / ul) * 4)
  out.C = []; await watch(out.C, 24000)
  out.final = await snap()
  await page.screenshot({ path: 'qa/' + TAG + '.png' })
  await post()
}
