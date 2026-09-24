async page => {
  // T4b, noFinPlinth: the finale's keepsakes on plinths at 2.2x, Sydney lawn,
  // hand clock, rung pinned. The lawn is laid exactly as sysFinaleStage lays
  // it (finaleOn up, then stageKeep(place, x, z) with no restY round the
  // horseshoe), so the auto path is the one proved.
  // (1) ten staged: ten slots, ten drawn, ten collider boxes, every keepsake
  //     at 2.2 with its drawn bottom on the stone; the draw-call delta of the
  //     plinth mesh on one pinned render; the coda-lens PNG, live and cut.
  // (2) the three rival.js leans on: keepOut finds the staged one; the pin
  //     (frozen + KINEMATIC, as keepTake) takes it to 1.0 and empties the
  //     slot; dropOwned hands it back DYNAMIC. Plus the mouth and a shove.
  // (3) the shelf's restY staging takes no plinth; rung 1 parks the stone and
  //     stands the keepsake on the grass; the cut clears everything.
  const NAME = 'ten-t4b-plinth'
  const PORT = 5192
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(7000)
  await page.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click())
  await page.waitForTimeout(9000)
  out.started = await page.evaluate(() => { const g = window.__capy; return { started: g.state.started, biome: g.biome.current } })

  const PLACES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'venice', 'hanoi']
  const lay = async (o) => page.evaluate(o => {
    const g = window.__capy, ph = g.physics
    const X = 30, Z = 26, R = 2.6, GAP = 1.75
    const sp = g.biome.spawnOf('sydney')
    const open = Math.atan2(sp.z - Z, sp.x - X)
    window.__t4b = { X, Z, open }
    g.state.perfRung = o.rung
    g.state.finaleOn = true
    const span = Math.PI * 2 - GAP, n = Math.max(1, o.places.length - 1)
    for (let i = 0; i < o.places.length; i++) {
      const a = open + GAP / 2 + (i / n) * span
      ph.stageKeep(o.places[i], X + Math.cos(a) * R, Z + Math.sin(a) * R)
    }
    const b = g.capy.body, y = g.groundY(X, Z)
    b.position.set(X, y + 0.6, Z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 40; i++) { g.state.perfRung = o.rung; g.tick(1 / 30, false) }
    // upright: the body's up axis, worst of the ten (1 = standing straight)
    let up = 1
    for (const k of o.places) {
      const q = ph.keepOut(k).body.quaternion
      up = Math.min(up, 1 - 2 * (q.x * q.x + q.z * q.z))
    }
    return Object.assign(ph.plinthAudit(), { minUp: +up.toFixed(3) })
  }, o)
  const shot = async (name) => page.evaluate(async o => {
    const g = window.__capy, F = window.__t4b
    g.renderer.setSize(1280, 720, false)
    g.camera.aspect = 1280 / 720; g.camera.updateProjectionMatrix()
    const y = g.groundY(F.X, F.Z)
    g.camera.position.set(F.X + Math.cos(F.open) * 7.5, y + 3.2, F.Z + Math.sin(F.open) * 7.5)
    g.camera.lookAt(F.X, y + 0.4, F.Z); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=' + o.name, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  }, { name: NAME + '-' + name })

  // ---- (1) the lawn ----------------------------------------------------------
  out.bodiesBefore = await page.evaluate(() => window.__capy.world.bodies.length)
  out.live = await lay({ places: PLACES, rung: 0 })
  out.bodiesAfter = await page.evaluate(() => window.__capy.world.bodies.length)
  out.calls = await page.evaluate(() => {
    const g = window.__capy, F = window.__t4b, r = g.renderer
    const m = g.scene.getObjectByName('finPlinths')
    const y = g.groundY(F.X, F.Z)
    g.camera.position.set(F.X + Math.cos(F.open) * 7.5, y + 3.2, F.Z + Math.sin(F.open) * 7.5)
    g.camera.lookAt(F.X, y + 0.4, F.Z); g.camera.updateMatrixWorld(true)
    const was = r.info.autoReset; r.info.autoReset = true
    const count = () => { r.render(g.scene, g.camera); return { calls: r.info.render.calls, tris: r.info.render.triangles } }
    count()
    const on = count()
    m.visible = false
    const off = count()
    m.visible = true
    r.info.autoReset = was
    return { on, off, delta: on.calls - off.calls, tris: on.tris - off.tris }
  })
  await shot('live')
  await page.evaluate(async o => {
    // close: from outside the ring, over the Kyoto-Cali-Rio arc
    const g = window.__capy, F = window.__t4b, y = g.groundY(F.X, F.Z)
    const a = F.open + Math.PI
    g.camera.position.set(F.X + Math.cos(a) * 5.2, y + 1.3, F.Z + Math.sin(a) * 5.2)
    g.camera.lookAt(F.X + Math.cos(a) * 2.6, y + 0.25, F.Z + Math.sin(a) * 2.6); g.camera.updateMatrixWorld(true)
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=' + o.name, { method: 'POST', body: g.renderer.domElement.toDataURL('image/png').split(',')[1] })
  }, { name: NAME + '-close' })

  // ---- (2) the three rival.js leans on, and the mouth, and a shove -----------
  out.rival = await page.evaluate(() => {
    const g = window.__capy, ph = g.physics, CANNON = g.CANNON
    const r = {}
    const p = ph.keepOut('kyoto')
    r.keepOut = !!p && p.keep === 'kyoto'
    r.scale0 = +p.mesh.scale.x.toFixed(3)
    // keepTake, as rival.js writes it
    const keepType = p.body.type
    p.frozen = true; p.grabbable = false
    p.body.type = 4 /* KINEMATIC */; p.body.updateMassProperties()
    p.body.collisionResponse = false; p.body.allowSleep = false
    p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0); p.body.wakeUp()
    for (let i = 0; i < 20; i++) {
      // keepRide: the beak carries it off the lawn
      p.body.position.set(p.body.position.x + 0.1, 1.4, p.body.position.z)
      p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z)
      g.state.perfRung = 0; g.tick(1 / 30, false)
    }
    r.inBeak = { scale: +p.mesh.scale.x.toFixed(3), frozen: p.frozen, type: p.body.type, audit: ph.plinthAudit().list.find(s => s.place === 'kyoto') }
    // keepLoose, as rival.js writes it
    p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z)
    p.frozen = false
    ph.dropOwned(p, 0, 0.5, 0)
    p.body.type = (keepType && keepType !== 4) ? keepType : 1; p.body.updateMassProperties()
    p.body.collisionResponse = true; p.body.allowSleep = true; p.body.wakeUp()
    p.frozen = false; if (p.grabbable === false && !p.planted) p.grabbable = true
    const y0 = p.body.position.y
    for (let i = 0; i < 60; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    r.dropped = { type: p.body.type, fell: +(y0 - p.body.position.y).toFixed(2), scale: +p.mesh.scale.x.toFixed(3), grabbable: p.grabbable }
    // the mouth: stand the animal by the Rio tile and take it
    const q = ph.keepOut('rio')
    const b = g.capy.body
    b.position.set(q.body.position.x + 0.6, q.body.position.y + 0.3, q.body.position.z); b.velocity.set(0, 0, 0)
    g.tick(1 / 30, false)
    r.grab = ph.grab(q)
    for (let i = 0; i < 10; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    r.held = { held: q.held, scale: +q.mesh.scale.x.toFixed(3), slot: ph.plinthAudit().list.find(s => s.place === 'rio') }
    ph.release(null)
    for (let i = 0; i < 30; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    r.released = { held: q.held, scale: +q.mesh.scale.x.toFixed(3) }
    b.position.set(window.__t4b.X, g.groundY(window.__t4b.X, window.__t4b.Z) + 0.6, window.__t4b.Z)
    // a shove: the Iceland ice, sideways at 3 m/s
    const s = ph.keepOut('iceland')
    s.body.wakeUp(); s.body.velocity.set(3, 1, 0)
    for (let i = 0; i < 60; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    r.shoved = { scale: +s.mesh.scale.x.toFixed(3), slot: ph.plinthAudit().list.find(t => t.place === 'iceland') }
    // a nudge that stays on the stone: the Hanoi stool, 0.4 m/s
    const h = ph.keepOut('hanoi')
    h.body.wakeUp(); h.body.velocity.set(0.3, 0, 0.2)
    for (let i = 0; i < 60; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    r.nudged = { scale: +h.mesh.scale.x.toFixed(3), slot: ph.plinthAudit().list.find(t => t.place === 'hanoi') }
    r.audit = ph.plinthAudit()
    return r
  })
  await shot('after')

  // ---- (3) the shelf, rung 1, the cut --------------------------------------
  out.shelf = await page.evaluate(() => {
    const g = window.__capy, ph = g.physics
    const p = ph.stageKeep('sahara', 35.6, 27.4, 0.84)
    for (let i = 0; i < 5; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    const a = ph.plinthAudit()
    return { scale: +p.mesh.scale.x.toFixed(3), slots: a.slots, hasSahara: !!a.list.find(s => s.place === 'sahara') }
  })
  out.cut = await page.evaluate(() => {
    const g = window.__capy, ph = g.physics
    const n0 = g.world.bodies.length
    g.state.noFinPlinth = true
    for (let i = 0; i < 40; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    const a = ph.plinthAudit()
    const sc = ['sydney', 'pasto', 'quay', 'cali', 'venice'].map(k => +ph.keepOut(k).mesh.scale.x.toFixed(3))
    return { audit: a, scales: sc, bodiesDelta: g.world.bodies.length - n0 }
  })
  out.cutLay = await lay({ places: PLACES, rung: 0 })
  await shot('cut')
  await page.evaluate(() => { window.__capy.state.noFinPlinth = false })
  out.rung1 = await lay({ places: PLACES, rung: 1 })
  await shot('rung1')
  out.relay = await page.evaluate(() => {
    const g = window.__capy
    g.state.noFinPlinth = true
    for (let i = 0; i < 5; i++) { g.state.perfRung = 0; g.tick(1 / 30, false) }
    g.state.noFinPlinth = false
    return g.physics.plinthAudit().slots
  })
  out.again = await lay({ places: PLACES, rung: 0 })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
