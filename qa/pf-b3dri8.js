async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy, R = {}
    g.biome.switchTo('drift')
    const sp = g.biome.spawnOf('drift'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const live = g.biome.current, d = g.drift
    R.emitApi = typeof (g.events && g.events.emit)
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === live))
    const mug = props.filter(p => p.type === 'mug')[0]
    const trav = g.locals.filter(r => r.biome === live && Math.abs(r.az - 32.8) < 1)[0]
    R.trav = trav ? { fig: !!trav.fig, own: !!trav.own, ownCool: trav.ownCool,
      ax: trav.ax, az: trav.az, x: +trav.x.toFixed(1), z: +trav.z.toFixed(1),
      biome: trav.biome, hasSays: !!trav.says } : null
    R.mug = mug ? { mass: mug.mass, keep: !!mug.keep, hidden: !!mug.hidden,
      removed: !!mug.removed } : null
    // move home and try a REAL grab through the game's own path
    mug.homeX = 18; mug.homeZ = 34
    mug.body.wakeUp()
    mug.body.position.set(15, d.terrainHeight(15, 34) + 0.4, 34)
    mug.body.previousPosition.copy(mug.body.position)
    mug.body.interpolatedPosition.copy(mug.body.position)
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    R.dHome = +Math.hypot(mug.homeX - trav.ax, mug.homeZ - trav.az).toFixed(2)
    if (g.events && g.events.emit) g.events.emit('capy:grab', { prop: mug })
    R.after1 = !!trav.own
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false)
    R.after2 = !!trav.own
    const x0 = trav.x, z0 = trav.z
    let walked = 0
    for (let s = 0; s < 40; s++) {
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      walked = Math.max(walked, Math.hypot(trav.x - x0, trav.z - z0))
    }
    R.walked = +walked.toFixed(2)
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri8.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
