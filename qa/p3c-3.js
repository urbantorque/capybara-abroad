async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, out = {}
    g.biome.switchTo('cali')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const c = g.cali, b = g.capy.body
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
    // ---- FIND 2: walked-the-hill, chiva still parked -----------------------
    out.before = { walked: g.noticed('walked-the-hill'), floorDark: g.noticed('floor-after-dark'), night: c.night(), state: c.chivaState() }
    const my = c.terrainHeight(c.mirador.x, c.mirador.z)
    put(c.mirador.x, my + 0.6, c.mirador.z)
    for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
    out.atMirador = { y: +g.capy.position.y.toFixed(2), terr: +my.toFixed(2), grounded: !!g.capy.grounded,
                      d: +Math.hypot(g.capy.position.x - c.mirador.x, g.capy.position.z - c.mirador.z).toFixed(2),
                      walked: g.noticed('walked-the-hill'), night: c.night(),
                      onChiva: c.onChiva(), state: c.chivaState() }
    // ---- the two mirador locals' line pools RIGHT NOW (night 0) ----------
    const locs = (g.locals || []).filter(L => L.biome === 'cali')
    const resolve = (L) => (L.lines || []).filter(e => {
      if (typeof e === 'string') return true
      if (!e || !e.t) return false
      if (e.after && !g.taskDone(e.after)) return false
      if (e.before && g.taskDone(e.before)) return false
      if (e.when) { try { return !!e.when() } catch (x) { return false } }
      return true
    }).map(e => typeof e === 'string' ? e : e.t)
    out.linesDay = locs.map(L => ({ x: +L.x.toFixed(0), z: +L.z.toFixed(0), n: resolve(L).length, said: resolve(L) }))
    // ---- FIND 1: get on the roof, let her pull away, then go to the floor --
    const a0 = c.chivaAt()
    put(a0.x, a0.y + 4.05, a0.z)
    for (let i = 0; i < 400 && c.chivaState() === 'parked'; i++) {
      const a = c.chivaAt(); put(a.x, a.y + 4.05, a.z); g.tick(1 / 60, false)
    }
    out.pulledAway = c.chivaState()
    // hop off immediately: teleport back to the dance floor and stand still
    put(c.floor.x, c.terrainHeight(c.floor.x, c.floor.z) + 0.6, c.floor.z)
    const samp = []
    for (let i = 0; i < 9000; i++) {
      g.tick(1 / 60, false)
      if (i % 900 === 0) samp.push([+(i / 60).toFixed(0), +c.night().toFixed(3), c.chivaState(), g.noticed('floor-after-dark'), c.onFloor()])
      if (g.noticed('floor-after-dark')) break
    }
    out.floorRun = samp
    out.floorDark = g.noticed('floor-after-dark')
    out.nightEnd = c.night()
    out.stateEnd = c.chivaState()
    out.speed = +Math.hypot(b.velocity.x, b.velocity.z).toFixed(3)
    out.carriedBy = !!g.capy.carriedBy
    out.linesNight = locs.map(L => ({ x: +L.x.toFixed(0), z: +L.z.toFixed(0), said: resolve(L) }))
    out.err = g.state.lastError || null
    return out
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p3c3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
