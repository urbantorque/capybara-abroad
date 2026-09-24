async page => {
  // noGorDawn: the scatter poplars' one material, olive before the sun and
  // gorPoplar after it. Reads the colour off the meshes named gorScat:poplar:*
  // at arrival (pre-dawn), with the flag set, and after setPhase past the rim.
  const TAG = 'ten-t1c-poplar-' + Date.now()
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5193/', { waitUntil: 'commit', timeout: 120000 })
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go'), null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.evaluate(() => document.querySelector('.capyui-go').click())
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('goreme') })
  await page.waitForFunction(() => window.__capy.biome.current === 'goreme', null, { timeout: 30000 })
  await page.waitForTimeout(6000)
  const read = () => page.evaluate(() => {
    const g = window.__capy, mats = new Set(); let n = 0
    g.scene.traverse(o => { if (o.name && o.name.indexOf('gorScat:poplar:') === 0) { n++; mats.add(o.material) } })
    const m = [...mats][0]
    return { meshes: n, mats: mats.size, hex: m ? m.color.getHexString() : null, sun: +g.goreme.sunUp().toFixed(3),
      rim: !!(m && m.onBeforeCompile && m.onBeforeCompile.toString().length > 60), err: g.state.lastError || null }
  })
  const out = {}
  out.arrive = await read()
  await page.screenshot({ path: 'qa/' + TAG + '-predawn.png' })
  await page.evaluate(() => { window.__capy.state.noGorDawn = true })
  await page.waitForTimeout(1500)
  out.flagged = await read()
  await page.screenshot({ path: 'qa/' + TAG + '-flag.png' })
  await page.evaluate(() => { window.__capy.state.noGorDawn = false })
  await page.waitForTimeout(1500)
  out.unflagged = await read()
  const P = await page.evaluate(() => import('/src/shared.js').then(m => ({ olive: m.PALETTE.gorPoplarOlive.toString(16), lit: m.PALETTE.gorPoplar.toString(16) })))
  out.palette = P
  // walk the phase forward past the rim; the sun is a function of the phase
  out.phases = []
  for (let ph = 0.47; ph <= 0.60; ph += 0.02) {
    await page.evaluate(p => window.__capy.goreme.setPhase(p), ph)
    await page.waitForTimeout(900)
    const s = await read(); s.phase = +ph.toFixed(2); out.phases.push(s)
  }
  out.after = await read()
  await page.screenshot({ path: 'qa/' + TAG + '-sun.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
