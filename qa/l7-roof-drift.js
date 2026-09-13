async page => {
  // THE ROOF DRIFT (L5 owed): a passenger placed at local x = +1.0 on the roof, the bus driven through
  // the bend before the first banner at 3 m/s, NO hand on the rail — where does it end up?
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(5000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  const out = {}
  await page.evaluate(() => { window.__capy.hud.cross('cali') }); await page.waitForTimeout(9000)
  const wires = await page.evaluate(() => window.__capy.cali.wireList())
  const banners = wires.filter(w => w.banner)
  await page.evaluate(() => window.__capy.cali.roofPlace(0)); await page.waitForTimeout(3500)
  const run = async (b, lx) => {
    await page.evaluate(s => window.__capy.cali.chivaSet({ s: s, state: 'rolling', v: 0 }), b.s - 16)
    await page.waitForTimeout(250)
    await page.evaluate(x => window.__capy.cali.roofPlace(x), lx); await page.waitForTimeout(250)
    await page.evaluate(x => window.__capy.cali.roofPlace(x), lx)
    await page.evaluate(() => window.__capy.cali.chivaSet({ v: 3 }))
    const rows = []
    for (let k = 0; k < 60; k++) {
      await page.waitForTimeout(150)
      const r = await page.evaluate(() => { const g = window.__capy, c = g.cali.chivaDebug(), p = g.capy.position
        const dx = p.x - c.x, dz = p.z - c.z, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw)
        return { s: +c.s.toFixed(1), yaw: +c.yaw.toFixed(2), onRoof: c.onRoof, lx: +(dx * cs - dz * sn).toFixed(2), lz: +(dx * sn + dz * cs).toFixed(2), av: +g.cali.chivaDebug().yawRate } })
      rows.push(r)
      if (r.s > b.s + 8) break
    }
    return rows
  }
  out.a = await run(banners[0], 1.0)
  await page.waitForTimeout(1500)
  out.b = await run(banners[1], 1.0)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l7-roof-drift.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
