async page => {
  // THE FETCH (L6, F1): a Venetian pigeon carried to Rio brings a thrown frisbee back.
  const TAG = 'l7-fetch'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const g = window.__capy; g.completeTask('gather', true); g.completeTask('the-crossing', true); g.hud.cross('venice') })
  await page.waitForTimeout(9000)
  const out = {}
  out.mount = await page.evaluate(() => {
    const g = window.__capy
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    let k = g.herdDebug().kinds[0]
    for (let w = 0; w < 40 && (!k || !k.n || !k.first); w++) { tick(60); k = g.herdDebug().kinds[0] }
    if (!k || !k.first) return { err: 'nothing offered' }
    const px = k.first.x + 1.85 * 0.71, pz = k.first.z + 1.85 * 0.71
    const b = g.capy.body
    const pin = () => { b.position.x = px; b.position.z = pz; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0) }
    b.position.set(px, k.first.y + 0.8, pz); tick(1)
    for (let i = 0; i < 240; i++) { pin(); g.tick(1 / 60, false) }
    for (let w = 0; w < 5; w++) { pin(); g.events.emit('capy:wheek', { position: g.capy.position, soft: false }); for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false) } }
    let n = 0
    for (; n < 60 * 26 && g.perchCount() < 1; n++) { pin(); if (n > 0 && n % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false }); g.tick(1 / 60, false) }
    for (let i = 0; i < 90; i++) { pin(); g.tick(1 / 60, false) }
    return { on: g.perchCount(), stow: g.stowDebug().kind }
  })
  await page.evaluate(() => window.__capy.hud.cross('rio'))
  await page.waitForTimeout(9000)
  out.arrive = await page.evaluate(() => { const d = window.__capy.stowDebug(); return { kind: d.kind, state: d.state } })
  await page.keyboard.press('Space'); await page.waitForTimeout(2500)
  // walk 6 m so it is following on the trail, then stop
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1800); await page.keyboard.up('KeyW'); await page.waitForTimeout(1500)
  out.follow = await page.evaluate(() => { const g = window.__capy, d = g.stowDebug(), p = g.capy.position; return { state: d.state, d: +Math.hypot(d.x - p.x, d.z - p.z).toFixed(2) } })
  // a frisbee in the mouth, thrown BACK over the companion: turn (S) then tap E
  out.throw = await page.evaluate(() => {
    const g = window.__capy, p = g.capy.position
    const pr = g.physics.spawnProp('frisbee', p.x + 0.6, p.z, p.y + 0.3)
    if (!pr) return { err: 'no spawn' }
    window.__fp = pr
    g.physics.grab(pr)
    return { held: !!g.capy.heldProp, type: g.capy.heldProp && g.capy.heldProp.type }
  })
  await page.keyboard.down('KeyS'); await page.waitForTimeout(400); await page.keyboard.up('KeyS'); await page.waitForTimeout(300)
  await page.keyboard.down('KeyE'); await page.waitForTimeout(90); await page.keyboard.up('KeyE')
  const rows = []
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(400)
    rows.push(await page.evaluate(() => { const g = window.__capy, d = g.stowDebug(), p = g.capy.position; const pr = window.__fp; const bp = pr && pr.body.position
      return { t: +g.state.time.toFixed(1), state: d.state, fetch: d.fetch, held: d.fetchHeld, n: d.fetchN, dPropComp: bp ? +Math.hypot(bp.x - d.x, bp.z - d.z).toFixed(2) : null, dPropCapy: bp ? +Math.hypot(bp.x - p.x, bp.z - p.z).toFixed(2) : null, propY: bp ? +bp.y.toFixed(2) : null, err: g.state.lastError || null } }))
    if (rows[rows.length - 1].n >= 1) break
  }
  out.rows = rows
  await page.screenshot({ path: 'qa/l7-fetch.png' })
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
