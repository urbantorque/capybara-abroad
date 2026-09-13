async page => {
  // SCRIPTED FLOORS FOR TWO OF L5's PARS (L5 owed): the aurora's six calls in rhythm, and the
  // Uji run swum end to end along the centreline — the par of 42 s has to be a time a swim can do.
  const TAG = 'l7-floors'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(5000)
  const ev = async (f, a) => page.evaluate(f, a)
  const tp = async (x, y, z) => ev(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const out = {}
  // ---- THE AURORA: six calls, 1.8 s apart ----------------------------------
  await ev(() => window.__capy.hud.cross('iceland')); await page.waitForTimeout(9000)
  await ev(() => { const g = window.__capy, sp = g.iceland.spring, b = g.capy.body; b.position.set(sp.x + 2, 0.4, sp.z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); g.iceland.auroraForce(1) })
  await page.waitForTimeout(1500)
  const calls = []
  for (let k = 0; k < 6; k++) {
    await ev(() => window.__capy.iceland.auroraCall())
    await page.waitForTimeout(250)
    calls.push(await ev(() => { const a = window.__capy.iceland.auroraAudit(); return { run: a.run, best: a.best, bursts: a.bursts } }))
    await page.waitForTimeout(1550)
  }
  await page.waitForTimeout(5000)
  out.aurora = { calls, record: await ev(() => window.__capy.hud.recordAudit().best['aurora']), par: 6 }
  // ---- THE UJI RUN: from the bridge to the mill, steered down the centreline -
  await ev(() => window.__capy.hud.cross('kyoto')); await page.waitForTimeout(9000)
  const a0 = await ev(() => window.__capy.kyoto.runAudit())
  const g1 = a0.gates[0]
  // 30 m upstream of the first boat is inside the arming window (the bridge is the start)
  const start = await ev(([x, z]) => { const u = window.__capy.kyoto.aheadOnRiver(x, z, -30); return { x: u.x, z: u.z } }, [g1.x, g1.z])
  await tp(start.x, -0.5, start.z); await page.waitForTimeout(600)
  // the steering runs IN THE PAGE, every frame: a 100 ms playwright loop was a bank-to-bank swimmer at the hairpin
  await ev(() => {
    window.__steer = true
    const step = () => {
      if (!window.__steer) return
      const g = window.__capy, p = g.capy.position
      const a1 = g.kyoto.aheadOnRiver(p.x, p.z, g.capy.swimming ? 3.0 : 1), u = { x: a1.x, z: a1.z }
      const a2 = g.kyoto.aheadOnRiver(p.x, p.z, 10)
      // "pick a side": the bend's inside, 1.5 m off the centreline — the flow puts a swimmer on the outer bank of the hairpin
      const tx = u.x - p.x, tz = u.z - p.z, fx = a2.x - u.x, fz = a2.z - u.z
      const cr = tx * fz - tz * fx, tl = Math.hypot(tx, tz) || 1
      if (g.capy.swimming && Math.abs(cr) > 0.5) { const sg = cr > 0 ? 1 : -1; u.x += sg * (-tz / tl) * 1.5; u.z += sg * (tx / tl) * 1.5 }
      g.input.camYaw = Math.atan2(-(u.x - p.x), -(u.z - p.z))
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  await page.keyboard.down('KeyW')
  const rows = []
  let done = false
  for (let k = 0; k < 700 && !done; k++) {
    const r = await ev(() => { const g = window.__capy, p = g.capy.position; const a = g.kyoto.runAudit(); return { t: a.t, through: a.through, done: a.done, x: +p.x.toFixed(1), z: +p.z.toFixed(1), swim: !!g.capy.swimming } })
    if (k % 10 === 0) rows.push(r)
    if (r.done) { done = true; rows.push(r) }
    await page.waitForTimeout(100)
  }
  await ev(() => { window.__steer = false })
  // THE FINISH FRAME (L5 owed): where the lens is, against the water, for the 2.5 s after the payout
  const lens = []
  for (let k = 0; k < 25; k++) {
    lens.push(await ev(() => { const g = window.__capy, c = g.camera.position, w = g.kyoto.waterHeightAt ? g.kyoto.waterHeightAt(c.x, c.z) : null; return { camY: +c.y.toFixed(2), water: w === null ? null : +w.toFixed(2), capyY: +g.capy.position.y.toFixed(2), shot: +g.framing().toFixed(2), sub: g.subT !== undefined ? +g.subT.toFixed(2) : null } }))
    if (k === 8) await page.screenshot({ path: 'qa/l7-uji-finish.png' })
    await page.waitForTimeout(100)
  }
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(1500)
  out.uji = { lens, rows, record: await ev(() => window.__capy.hud.recordAudit().best['uji-run']), par: 42, audit: await ev(() => window.__capy.kyoto.runAudit()) }
  out.err = await ev(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
