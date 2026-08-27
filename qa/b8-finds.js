async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    o.started = !!g.state.started
    const hold = (x, y, z) => {
      const b = g.capy.body
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    const idle = (act) => { g.input.x = 0; g.input.z = 0; g.input.action = !!act; g.input.run = false }

    // ---- 12, the shaft ----------------------------------------------------
    g.biome.switchTo('palawan')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const pal = g.palawan
    o.shaftZoneAtHole = pal.inZone('shaft', 2.5, -115)
    const floor = pal.terrainHeight(2.5, -115)
    o.cathFloor = +floor.toFixed(2)
    // paddle in first so the swim state is real, then hold E down on the sand
    hold(2.5, 0.2, -115)
    for (let i = 0; i < 60 * 3; i++) { idle(false); g.tick(1 / 60, false) }
    o.swimming = !!g.capy.swimming
    for (let i = 0; i < 60 * 12; i++) {
      idle(true)
      g.tick(1 / 60, false)
      const b = g.capy.body
      if (b.position.y > floor + 0.9) { b.position.y = floor + 0.7; b.velocity.set(0, 0, 0) }
      b.position.x = 2.5; b.position.z = -115
      if (i % 60 === 0 && !g.capy.diving) { /* keep trying */ }
    }
    o.diving = !!g.capy.diving
    o.depth = +(g.capy.depth || 0).toFixed(2)
    o.inShaftFind = !!g.noticed('in-the-shaft')

    // ---- 16, the drip -----------------------------------------------------
    g.biome.switchTo('cave')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const cav = g.cave
    const d = cav.nearestDrip()
    o.drip = d ? [+d.x.toFixed(2), +d.y.toFixed(2), +d.z.toFixed(2)] : null
    if (d) {
      const dx = d.x, dy = d.y, dz = d.z
      for (let i = 0; i < 60 * 30; i++) { hold(dx, dy + 0.35, dz); idle(false); g.tick(1 / 60, false) }
      o.wet = +(g.capy.wet || 0).toFixed(2)
      o.grounded = !!g.capy.grounded
      o.dripFind = !!g.noticed('wet-in-a-mountain')
      // ---- and the echo, from the same spot -------------------------------
      o.echoReadyBefore = cav.echoReady()
      try { g.events.emit('capy:wheek', {}) } catch (e) { o.emitErr = String(e) }
      o.echoReadyAfterCall = cav.echoReady()
      for (let i = 0; i < 60 * 5; i++) { hold(dx, dy + 0.35, dz); idle(false); g.tick(1 / 60, false) }
      o.echoReadyEnd = cav.echoReady()
      o.echoFind = !!g.noticed('let-it-return')
    }
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-finds.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
