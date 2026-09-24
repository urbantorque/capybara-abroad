async page => {
  // T2f, noEchoPing on the game clock. The machine is shared and rAF runs at a frame every
  // few seconds, so the clock is driven by hand: one wheek on the bus in the dark passage
  // (x 32, z -14), then game.tick(1/60) x 200, sampling the marks lit and the echo envelope
  // every 6 ticks. Then a wheek, 54 ticks (0.9 s), and the picture; the flag, the same.
  const NAME = 'ten-t2f-ping-clock'
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome.current === 'cave'))) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
    await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'cave') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cave') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  const put = () => page.evaluate(() => {
    const g = window.__capy, b = g.capy.body, h = g.cave.terrainHeight(32, -14)
    b.position.set(32, h + 0.6, -14); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 90; i++) { g.tick(1 / 60, false); b.velocity.set(0, 0, 0) }
    return g.cave.daylight()
  })
  out.day = await put()
  out.rows = await page.evaluate(() => {
    const g = window.__capy, rows = []
    g.events.emit('capy:wheek')
    for (let i = 0; i < 200; i++) {
      g.tick(1 / 60, false)
      if (i % 6 === 0) { const p = g.cave.ping(); rows.push([+(i / 60).toFixed(2), +g.cave.echo().toFixed(2), p.n, p.wall, p.lit]) }
    }
    return rows
  })
  out.cast = await page.evaluate(() => window.__capy.cave.ping())
  out.peak = Math.max.apply(null, out.rows.map(r => r[4]))
  out.firstLit = (out.rows.find(r => r[4] > 0) || [null])[0]
  out.lastLit = (out.rows.slice().reverse().find(r => r[4] > 0) || [null])[0]
  const shot = async (tag, off) => {
    await page.evaluate(o => {
      const g = window.__capy; g.state.noEchoPing = o.off
      for (let i = 0; i < 80; i++) g.tick(1 / 60, false)
      g.events.emit('capy:wheek')
      for (let i = 0; i < 54; i++) g.tick(1 / 60, false)
    }, { off })
    out['shot_' + tag] = await page.evaluate(() => window.__capy.cave.ping())
    await page.screenshot({ path: 'qa/' + NAME + '-' + tag + '.png' })
  }
  await shot('live', false)
  await shot('off', true)
  await page.evaluate(() => { window.__capy.state.noEchoPing = false })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
