async page => {
  // T2e PROBE: the Sahara resting lens at rung 0 (prefs pf 1): the fov, the elevation of the
  // frame's top edge, the sun axis, and one picture. Data out through the /shot sink.
  const CH = 'sahara', NAME = 'ten-t2e-probe'
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)) })
  page.setDefaultNavigationTimeout(120000)
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5195/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  await page.waitForTimeout(3000)
  out.info = await page.evaluate(() => {
    const g = window.__capy, c = g.camera, T = g.THREE
    const d = new T.Vector3(); c.getWorldDirection(d)
    const top = new T.Vector3(0, 1, 0.5).unproject(c).sub(c.position).normalize()
    const bot = new T.Vector3(0, -1, 0.5).unproject(c).sub(c.position).normalize()
    return { biome: g.biome.current, rung: g.state.perfRung, fov: c.fov, far: c.far, aspect: c.aspect,
      pos: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(1)),
      dirY: +d.y.toFixed(3), topSin: +top.y.toFixed(3), botSin: +bot.y.toFixed(3),
      keys: Object.keys(g).slice(0, 400).join(','), storm: g.sahara.storm(), dusk: g.sahara.dusk(),
      err: g.state.lastError || null }
  })
  await page.screenshot({ path: 'qa/' + NAME + '-rest.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
