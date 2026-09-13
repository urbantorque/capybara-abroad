async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { for (const t of ['bin-chicken', 'sunrise']) window.__capy.completeTask(t, true) })
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const ev = async (f, a) => page.evaluate(f, a)
  const out = { rows: [] }
  await ev(() => window.__capy.hud.cross('goreme')); await page.waitForTimeout(9000)
  out.can = await ev(() => [window.__capy.capy.can('herd'), window.__capy.capy.seats, window.__capy.capy.worn])
  const c = await ev(() => { const t = window.__capy.goreme.catAt(); return [t.x, t.y, t.z] })
  await put(c[0] + 1.2, c[1] + 0.6, c[2] + 1.2); await page.waitForTimeout(800)
  for (let k = 0; k < 3; k++) { await tap('KeyQ', 100); await page.waitForTimeout(2200) }
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
  for (let k = 0; k < 22; k++) {
    await page.waitForTimeout(1000)
    out.rows.push(await ev(() => { const g = window.__capy, c = g.capy, h = g.herdDebug(true).kinds[0], p = c.position
      const ds = h.pts.map(q => +Math.hypot(q[0] - p.x, q[2] - p.z).toFixed(2)).sort((a, b) => a - b)
      return { loaf: +c.loaf.toFixed(2), rest: +c.restT.toFixed(1), gr: c.grounded, led: h.led, near: ds.slice(0, 2), perch: g.perchCount(), pd: g.perchDebug ? g.perchDebug().lastOff : null } }))
  }
  out.err = await ev(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l7-rim-dbg.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
