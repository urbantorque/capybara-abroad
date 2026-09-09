async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    const R = {}
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false) }
    g.biome.switchTo('kyoto')
    const sp = g.biome.spawnOf('kyoto'), b = g.capy.body, K = g.kyoto
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    settle(120)
    const pt = o => o ? [+o.x.toFixed(1), +o.z.toFixed(1)] : null
    R.places = { spawn: pt(sp), mill: pt(K.mill), uji: pt(K.uji), bowl: pt(K.bowl),
      matchaHeap: pt(K.matchaHeap), bridge: pt(K.bridge), pond: pt(K.pond),
      zen: pt(K.zen), bamboo: pt(K.bamboo), stones: pt(K.stones),
      toriiStart: pt(K.toriiStart), bell: pt(K.bell) }
    R.millToUji = +Math.hypot(K.mill.x - K.uji.x, K.mill.z - K.uji.z).toFixed(1)
    R.millToBowl = +Math.hypot(K.mill.x - K.bowl.x, K.mill.z - K.bowl.z).toFixed(1)
    R.millToHeap = +Math.hypot(K.mill.x - K.matchaHeap.x, K.mill.z - K.matchaHeap.z).toFixed(1)
    // minimap box (systems MAPS table) -- test membership by hand
    const box = { x0: -100, x1: 60, z0: -70, z1: 215 }
    R.outsideMinimap = Object.entries(R.places).filter(([, p]) => p &&
      (p[0] < box.x0 || p[0] > box.x1 || p[1] < box.z0 || p[1] > box.z1)).map(([n, p]) => n + ' ' + p)
    // torii path extent
    let tz0 = 1e9, tz1 = -1e9, tx0 = 1e9, tx1 = -1e9
    for (let i = 0; i < 44; i++) { const q = K.toriiNext ? null : null }
    R.toriiStartPt = pt(K.toriiStart)
    // walk the torii to get its far end
    R.toriiSummit = null
    // river endpoints
    R.riverLen = K.riverLength ? +K.riverLength().toFixed(1) : null
    R.runLen = K.runLength ? +K.runLength().toFixed(1) : null
    // locals near the mill: who acknowledges the arrival?
    const live = g.biome.current
    const L = g.locals.filter(r => r.biome === live)
    R.localsNearMill = L.filter(r => Math.hypot(r.x - K.mill.x, r.z - K.mill.z) < 30)
      .map(r => ({ d: +Math.hypot(r.x - K.mill.x, r.z - K.mill.z).toFixed(1), onTask: r.onTask ? Object.keys(r.onTask).join('/') : '-' }))
    R.localsWithUjiRunOnTask = L.filter(r => r.onTask && r.onTask['uji-run'])
      .map(r => ({ x: +r.x.toFixed(0), z: +r.z.toFixed(0), dMill: +Math.hypot(r.x - K.mill.x, r.z - K.mill.z).toFixed(0) }))
    R.localAllXZ = L.map(r => [+r.x.toFixed(0), +r.z.toFixed(0)])
    return R
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async o => {
    await fetch('/shot?name=b3k5.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
