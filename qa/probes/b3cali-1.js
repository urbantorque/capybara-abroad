async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(1000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(7000)
  await page.mouse.click(500, 400); await page.waitForTimeout(2500)

  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    g.biome.switchTo('cali')
    const sp = g.biome.spawnOf('cali'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const c = g.cali
    o.spawn = { x: +sp.x.toFixed(1), z: +sp.z.toFixed(1) }
    o.routeLen = +c.rideProgress.toString().length // placeholder
    o.pts = {
      floor: [+c.floor.x.toFixed(1), +c.floor.z.toFixed(1), c.floor.r],
      mirador: [+c.mirador.x.toFixed(1), +c.mirador.z.toFixed(1)],
      chiva: [+c.chiva.x.toFixed(1), +c.chiva.z.toFixed(1)],
      gato: [+c.gato.x.toFixed(1), +c.gato.z.toFixed(1)],
      ermita: [+c.ermita.x.toFixed(1), +c.ermita.z.toFixed(1)],
      lulada: [+c.lulada.x.toFixed(1), +c.lulada.z.toFixed(1)],
      cristo: [+c.cristo.x.toFixed(1), +c.cristo.z.toFixed(1)],
      cane: [+c.cane.x.toFixed(1), +c.cane.z.toFixed(1)],
      bridge: [+c.bridge.x.toFixed(1), +c.bridge.z.toFixed(1)],
    }
    // ---- STAND STILL: does night ever move? --------------------------------
    let t = 0
    for (let i = 0; i < 60 * 120; i++) { g.tick(1 / 60, false); t += 1 / 60 }
    o.standStill = { secs: +t.toFixed(0), night: c.night(), state: c.chivaState(), prog: +c.rideProgress().toFixed(3) }
    // ---- surface pitch ladder ---------------------------------------------
    o.zones = {}
    const probe = [['spawn', sp.x, sp.z], ['floor', c.floor.x, c.floor.z],
      ['mirador', c.mirador.x, c.mirador.z], ['chivaStop', c.chiva.x, c.chiva.z],
      ['cane', c.cane.x, c.cane.z], ['cristo', c.cristo.x, c.cristo.z],
      ['lulada', c.lulada.x, c.lulada.z], ['gato', c.gato.x, c.gato.z]]
    for (const [n, x, z] of probe) {
      o.zones[n] = ['dancefloor', 'street', 'cane', 'river'].filter(k => c.inZone(k, x, z))
    }
    o.critters = (g.__critters || []).length
    o.locals = (g.locals || []).filter(L => L.biome === 'cali').map(L => ({
      x: +L.x.toFixed(1), z: +L.z.toFixed(1), near: L.near, fig: !!L.fig || !!L.figure,
      lines: (L.lines || []).length,
      when: (L.lines || []).filter(e => e && e.when).length,
      after: (L.lines || []).filter(e => e && e.after).length,
      before: (L.lines || []).filter(e => e && e.before).length,
      onTask: L.onTask ? Object.keys(L.onTask).length : 0,
    }))
    o.err = g.state ? (g.state.lastError || null) : null
    return o
  })
  out.errs = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=b3cali1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
