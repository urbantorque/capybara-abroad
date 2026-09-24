async page => {
  // T2b proof (noOrcaRound): the escort from the chase lens, round then crates.
  // Fresh profile, real keys to the tiller, full ahead up the lead, podForce()
  // puts the pod on the boat; rung pinned to 0 (the governor writes only on
  // its own change, so it is re-asserted before each read). Shots:
  // qa/ten-t2b-orca-round.png, qa/ten-t2b-orca-crate.png; data in
  // qa/ten-t2b-orca.json.png (geometry swap, triangle counts, blow bursts).
  const CH = 'antarctic', PORT = 5192
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:' + PORT + '/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  for (let i = 0; i < 3; i++) {
    const cur = await page.evaluate(() => window.__capy.biome.current)
    if (cur === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(12000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  const out = { errs }
  const t = () => page.evaluate(() => window.__capy.state.time)
  out.clock = [await t()]; await page.waitForTimeout(1000); out.clock.push(await t())
  await page.evaluate(() => { const g = window.__capy; g.capy.body.position.set(3.6, 1.6, 26); g.capy.body.velocity.set(0, 0, 0) })
  await page.waitForTimeout(1500)
  for (let i = 0; i < 14; i++) {
    const helm = await page.evaluate(() => window.__capy.antarctic.atHelm())
    if (helm) break
    const k = await page.evaluate(() => { const g = window.__capy, p = g.capy.position; const h = g.hintTarget('take-tiller'); const f = new g.THREE.Vector3(); g.camera.getWorldDirection(f); f.y = 0; f.normalize(); const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz); const fw = (dx * f.x + dz * f.z) / d, rt = (dx * -f.z + dz * f.x) / d; const keys = []; if (d > 1.2) { if (fw > 0.35) keys.push('KeyW'); if (fw < -0.35) keys.push('KeyS'); if (rt > 0.35) keys.push('KeyD'); if (rt < -0.35) keys.push('KeyA') } return keys })
    for (const kk of k) await page.keyboard.down(kk)
    await page.waitForTimeout(350)
    for (const kk of k) await page.keyboard.up(kk)
    await page.keyboard.press('KeyE'); await page.waitForTimeout(500)
  }
  out.helm = await page.evaluate(() => window.__capy.antarctic.atHelm())
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 40; i++) { const z = await page.evaluate(() => window.__capy.antarctic.podDebug().boatZ); if (z < -70) break; await page.waitForTimeout(500) }
  const read = () => page.evaluate(() => {
    const g = window.__capy, a = g.antarctic, o = g.scene.getObjectByName('antPod'), m = o.children[0]
    const tri = x => (x.geometry.index ? x.geometry.index.count : x.geometry.attributes.position.count) / 3
    g.state.perfRung = 0
    return { t: +g.state.time.toFixed(1), dbg: a.podDebug(), bodyTri: tri(m), finTri: tri(m.children[0]), flukeTri: tri(m.children[1]),
             flat: !!m.material.flatShading, rung: g.state.perfRung, boatSp: +a.boat.speed.toFixed(1) }
  })
  await page.evaluate(() => { const g = window.__capy; g.state.perfRung = 0; g.state.noOrcaRound = false; g.antarctic.podForce() })
  await page.waitForTimeout(1500)
  out.round = await read()
  await page.waitForTimeout(1500)
  out.round2 = await read()
  await page.screenshot({ path: 'qa/ten-t2b-orca-round.png' })
  await page.evaluate(() => { window.__capy.state.noOrcaRound = true })
  await page.waitForTimeout(400)
  out.crate = await read()
  await page.screenshot({ path: 'qa/ten-t2b-orca-crate.png' })
  await page.evaluate(() => { window.__capy.state.noOrcaRound = false })
  await page.waitForTimeout(400)
  out.back = await read()
  await page.evaluate(() => { const g = window.__capy; g.state.perfRung = 2 })
  await page.waitForTimeout(400)
  out.rung2 = await page.evaluate(() => { const g = window.__capy, m = g.scene.getObjectByName('antPod').children[0]; return { round: g.antarctic.podDebug().round, flat: !!m.material.flatShading } })
  await page.evaluate(() => { const g = window.__capy; g.state.perfRung = 0 })
  await page.keyboard.up('KeyW')
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => { await fetch('/shot?name=ten-t2b-orca.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
