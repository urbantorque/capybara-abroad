async page => {
  // T1f STRETCH, noWireFade: the cables at half section in PALETTE.caliWire, and each segment
  // dithered out within 5 m of the lens. Rung pinned to 0 (pretty) — the fade parks at 1+.
  // (1) the spawn frame, live then flagged, same pose; (2) the animal stood under the first
  // cable so the lens is among them: how many segments fade, and the picture.
  const NAME = 'ten-t1f-wires'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  const out = {}
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === 'cali') break
    await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cali') }); await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const dbg = () => page.evaluate(() => { const c = window.__capy.cali.chivaDebug(); return { rung: window.__capy.state.perfRung, segs: c.wireSegs, faded: c.wireFaded, thin: c.wireThin, old: c.wireOld } })
  out.spawnLive = await dbg()
  await page.screenshot({ path: 'qa/' + NAME + '-spawn-live.png' })
  await page.evaluate(() => { window.__capy.state.noWireFade = true }); await page.waitForTimeout(400)
  out.spawnOff = await dbg()
  await page.screenshot({ path: 'qa/' + NAME + '-spawn-off.png' })
  await page.evaluate(() => { window.__capy.state.noWireFade = false })
  // under the first cable, on the road, facing along it
  out.wire0 = await page.evaluate(() => { const g = window.__capy, w = g.cali.wireList()[0]; return w })
  out.put = await page.evaluate(() => {
    const g = window.__capy, c = g.cali.chivaDebug()
    // chivaSet puts the bus at the cable, the animal on the road 6 m short of it
    const w = g.cali.wireList()[0]
    g.cali.chivaSet({ s: w.s - 6, state: 'parked', v: 0 })
    return w.s
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => window.__capy.cali.roofPlace(0)); await page.waitForTimeout(3000)
  const rows = []
  for (let k = 0; k < 16; k++) {
    await page.waitForTimeout(500)
    rows.push(await page.evaluate(() => { const g = window.__capy, c = g.cali.chivaDebug(), cam = g.camera.position
      return { faded: c.wireFaded, cam: [+cam.x.toFixed(1), +cam.y.toFixed(1), +cam.z.toFixed(1)], s: c.s } }))
  }
  out.rows = rows
  out.maxFaded = Math.max.apply(null, rows.map(r => r.faded))
  await page.screenshot({ path: 'qa/' + NAME + '-under-live.png' })
  await page.evaluate(() => { window.__capy.state.noWireFade = true }); await page.waitForTimeout(400)
  out.underOff = await dbg()
  await page.screenshot({ path: 'qa/' + NAME + '-under-off.png' })
  await page.evaluate(() => { window.__capy.state.noWireFade = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
