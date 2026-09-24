async page => {
  // T3b, Act I: a fresh story file in Sydney. The act is read, not forced (journeyAct 1,
  // grace on). The watcher lands on a high point, is screenshotted, and leaves when the
  // animal comes within 10 m. Then an act turn on the bus: the next visit inside 60 s.
  const NAME = 'ten-t3b-watch'
  const out = { steps: [] }
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5192/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 })
  await page.keyboard.down('Shift'); await page.waitForTimeout(40); await page.keyboard.up('Shift')
  await page.waitForTimeout(4000)
  out.start = await page.evaluate(() => { const g = window.__capy; for (let i = 0; i < 3; i++) g.tick(1 / 30, false); g.events.on('rival:left', e => { (window.__rl = window.__rl || []).push(e.how) }); return { mode: g.state.journeyMode, act: g.journeyAct(), grace: g.graceOn(), audit: g.rivalAudit() } })
  // bring it (the wait only) and let the clock run by hand until it stands
  out.land = await page.evaluate(() => {
    const g = window.__capy; g.rivalSoon()
    const seen = []
    for (let i = 0; i < 400; i++) { g.tick(1 / 30, false); const a = g.rivalAudit(); if (seen[seen.length - 1] !== a.state) seen.push(a.state); if (a.state === 'watch' && a.t > 1.5) break }
    const a = g.rivalAudit(), p = g.capy.position
    return { seen, audit: a, dist: a.at ? +Math.hypot(a.at[0] - p.x, a.at[2] - p.z).toFixed(1) : null, rise: a.at ? +(a.at[1] - p.y).toFixed(2) : null }
  })
  out.first = out.start.audit.wait
  await page.waitForTimeout(1000)
  out.screen = await page.evaluate(() => {
    const g = window.__capy, s = g.scene.getObjectByName('rivalIbis'), v = new g.THREE.Vector3()
    s.getWorldPosition(v); v.y += 0.8; v.project(g.camera)
    return { on: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1, sx: Math.round((v.x + 1) * 640), sy: Math.round((1 - v.y) * 360) }
  })
  await page.screenshot({ path: 'qa/' + NAME + '-perch.png' })
  await page.evaluate(async n => {
    // a second lens, 5 m off the bird on the animal's side, for reading it by eye
    const g = window.__capy, T = g.THREE, s = g.scene.getObjectByName('rivalIbis'), p = g.capy.position
    const b = new T.Vector3(); s.getWorldPosition(b)
    const d = new T.Vector3(p.x - b.x, 0, p.z - b.z).normalize()
    g.camera.position.set(b.x + d.x * 5, b.y + 1.6, b.z + d.z * 5); g.camera.lookAt(b.x, b.y + 0.6, b.z); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=' + n, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  }, NAME + '-close')
  // walk at it (real keys are the harness's; here the body is set down 8 m off)
  out.near = await page.evaluate(() => {
    const g = window.__capy, a = g.rivalAudit(), b = g.capy.body, p = b.position
    const dx = p.x - a.at[0], dz = p.z - a.at[2], d = Math.hypot(dx, dz) || 1
    const k = 8 / d
    b.position.set(a.at[0] + dx * k, p.y + 0.3, a.at[2] + dz * k); b.velocity.set(0, 0, 0)
    const seen = []
    for (let i = 0; i < 150; i++) { g.tick(1 / 30, false); const s = g.rivalAudit().state; if (seen[seen.length - 1] !== s) seen.push(s); if (s === 'off') break }
    return { seen, left: window.__rl || [], audit: g.rivalAudit() }
  })
  // the act turn: the next visit comes inside a minute
  out.turn = await page.evaluate(() => {
    const g = window.__capy, before = g.rivalAudit().wait
    g.events.emit('story:act', { act: 2, title: 'qa', ready: false, chapter: 1 })
    return { before, after: g.rivalAudit().wait }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
