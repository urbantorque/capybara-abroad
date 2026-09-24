async page => {
  // T3b, Act IV in Iceland (qaRivalAct 4, grace cut). It comes and stands hunched 6-10 m
  // off; a yuzu put 1.5 m from it (game.dropGive, the ask's own door) is eaten and gets
  // the line; nothing is stolen while it stands (the wallet's fruit on the ground stays).
  // Then the finale seat is checked on the same page: 'finale:staged' in Sydney.
  const NAME = 'ten-t3b-cold'
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  if (await page.evaluate(() => !(window.__capy && window.__capy.biome.current === 'iceland'))) {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
    await page.goto('http://localhost:5192/'); await page.waitForTimeout(6000)
    await page.evaluate(() => { document.querySelector('.capyui-go').click() })
    await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 })
    await page.keyboard.down('Shift'); await page.waitForTimeout(40); await page.keyboard.up('Shift')
    for (let i = 0; i < 3; i++) {
      if (await page.evaluate(() => window.__capy.biome.current) === 'iceland') break
      await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('iceland') }); await page.waitForTimeout(11000)
    }
  }
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.stand = await page.evaluate(() => {
    const g = window.__capy; g.state.qaRivalAct = 4; g.state.noFirstGrace = true
    window.__ev = []; for (const n of ['rival:stole', 'rival:fed']) g.events.on(n, e => window.__ev.push(n))
    const p = g.capy.position, y = g.capy.group.rotation.y
    // a fruit 12 m ahead: A4's bird would take it; the cold one must not
    g.dropGive(p.x + Math.sin(y) * 12, p.z + Math.cos(y) * 12, 1)
    for (let i = 0; i < 400 && g.rivalAudit().state !== 'off'; i++) g.tick(1 / 30, false)
    g.rivalSoon()
    const seen = []
    for (let i = 0; i < 500; i++) { g.tick(1 / 30, false); const a = g.rivalAudit(); if (seen[seen.length - 1] !== a.state) seen.push(a.state); if (a.state === 'hunch' && a.t > 3) break }
    const a = g.rivalAudit()
    return { seen, audit: a, dist: a.at ? +Math.hypot(a.at[0] - p.x, a.at[2] - p.z).toFixed(1) : null }
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/' + NAME + '-hunch.png' })
  await page.evaluate(async n => {
    const g = window.__capy, T = g.THREE, s = g.scene.getObjectByName('rivalIbis'), p = g.capy.position
    const b = new T.Vector3(); s.getWorldPosition(b)
    const d = new T.Vector3(p.x - b.x, 0, p.z - b.z).normalize()
    g.camera.position.set(b.x + d.x * 3.2 + d.z * 1.2, b.y + 1.1, b.z + d.z * 3.2 - d.x * 1.2); g.camera.lookAt(b.x, b.y + 0.5, b.z); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=' + n, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  }, NAME + '-close')
  out.feed = await page.evaluate(() => {
    const g = window.__capy, a = g.rivalAudit()
    g.dropGive(a.at[0] + 1.5, a.at[2], 1)
    const seen = []
    for (let i = 0; i < 200; i++) { g.tick(1 / 30, false); const s = g.rivalAudit(); const k = s.state + (s.hunch < 0.9 ? ':eased' : ''); if (seen[seen.length - 1] !== k) seen.push(k); if (window.__ev.includes('rival:fed')) break }
    return { seen, ev: window.__ev.slice(), audit: g.rivalAudit() }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
