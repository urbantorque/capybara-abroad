async page => {
  // `seed-gap` end to end (L6 owed): the Long Gap on the seed, no puff. The arch lip to the far side,
  // launched on a tailwind or a calm — never into the breath — with the hop key held down through the arc.
  const TAG = 'l7-seed-gap'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { for (const t of ['acrobats', 'driftseed']) window.__capy.completeTask(t, true) })
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const ev = async (f, a) => page.evaluate(f, a)
  const pos = async () => ev(() => { const p = window.__capy.capy.position; return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] })
  const out = { rows: [], can: null }
  await ev(() => window.__capy.hud.cross('drift')); await page.waitForTimeout(9000)
  out.can = await ev(() => [window.__capy.capy.can('seed'), window.__capy.capy.can('puff')])
  // the crossing axis: arch (5,-106) -> farside (42,-137)
  const DX = 37 / Math.hypot(37, 31), DZ = -31 / Math.hypot(37, 31)
  // face it: the camera yaw the controller steers by is input.camYaw, set here directly (no mouse)
  const yaw = Math.atan2(-DX, -DZ)
  for (let t = 0; t < 6; t++) {
    await put(11, 88.6, -110); await page.waitForTimeout(1200)
    await ev((y) => { window.__capy.input.camYaw = y }, yaw)
    // wait for the air to be with us: the along-gap wind component >= -0.3 m/s and not falling
    let w = null
    for (let k = 0; k < 90; k++) {
      w = await ev(([dx, dz]) => { const v = window.__capy.drift.wind(); return +(v.x * dx + v.z * dz).toFixed(2) }, [DX, DZ])
      if (w >= 0.6) break
      await page.waitForTimeout(500)
    }
    const s0 = await ev(() => window.__capy.capy.seedT)
    const p0 = await pos()
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(900)
    await page.keyboard.down('Space')
    let landed = null
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(250)
      const g = await ev(() => [window.__capy.capy.grounded, +window.__capy.capy.position.y.toFixed(1), +window.__capy.capy.seedT.toFixed(2)])
      if (k > 4 && g[0]) { landed = g; break }
    }
    await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
    await page.waitForTimeout(800)
    const r = { try: t, wind: w, from: p0, to: await pos(), seedT: +(await ev(() => window.__capy.capy.seedT) - s0).toFixed(2), landed,
                seedGap: await ev(() => window.__capy.taskDone('seed-gap')), longGap: await ev(() => window.__capy.taskDone('long-gap')),
                rec: await ev(() => { const r = window.__capy.recordDebug ? window.__capy.recordDebug('long-gap') : null; return r }), err: await ev(() => window.__capy.state.lastError || null) }
    out.rows.push(r)
    if (r.seedGap) { await page.screenshot({ path: 'qa/l7-seed-gap.png' }); break }
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
