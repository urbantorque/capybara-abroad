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
  const c = await ev(() => { const t = window.__capy.goreme.catAt(); return [t.x, t.y, t.z] })
  await put(c[0] + 1.2, c[1] + 0.6, c[2] + 1.2); await page.waitForTimeout(800)
  for (let k = 0; k < 3; k++) { await tap('KeyQ', 100); await page.waitForTimeout(2200) }
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
  for (let k = 0; k < 28; k++) { await page.waitForTimeout(1000); if (await ev(() => window.__capy.perchCount())) break }
  out.perch = await ev(() => window.__capy.perchCount())
  const b = await ev(() => { const t = window.__capy.goreme.balloon(); return [t.x, t.y, t.z] })
  await put(b[0], b[1] + 0.8, b[2]); await page.waitForTimeout(1500)
  out.perch2 = await ev(() => window.__capy.perchDebug())
  await ev(() => { window.__vy = []; const f = () => { const c = window.__capy.capy; window.__vy.push([+window.__capy.state.time.toFixed(2), +c.velocity.y.toFixed(2), +(c.floorVY||0).toFixed(2), c.grounded ? 1 : 0, +c.position.y.toFixed(2)]); if (window.__vy.length < 400) requestAnimationFrame(f) }; requestAnimationFrame(f) })
  await page.keyboard.down('KeyE')
  for (let k = 0; k < 16; k++) {
    await page.waitForTimeout(250)
    out.rows.push(await ev(() => { const g = window.__capy, c = g.capy, d = g.perchDebug(); return { on: d.on, off: d.off, offAt: d.offAt, t: +g.state.time.toFixed(1), gr: c.grounded, vy: +c.velocity.y.toFixed(2), carried: !!c.carriedBy, climb: !!c.climbing, alt: +g.goreme.altitude().toFixed(1), led: g.herdDebug().kinds[0].led } }))
  }
  await page.keyboard.up('KeyE')
  out.vy = await ev(() => window.__vy)
  await page.evaluate(o => fetch('/shot?name=l7-rim-dbg2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
