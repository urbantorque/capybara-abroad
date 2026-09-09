async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 160)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(700)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    window.__P = { steamMax: 0 }
  })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const g = window.__capy
    const b = g.capy.body
    b.position.set(-40, 1.2, -10)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    b.velocity.set(0, 0, 0)
    // sample every frame from now on
    const P = window.__P
    P.t0 = performance.now()
    P.loafAt = -1; P.taskAt = -1; P.aurAt = -1; P.calmMax = 0; P.loafMax = 0
    P.topMin = 99; P.topMax = -99; P.surfMin = 99; P.surfMax = -99; P.n = 0
    P.toasts = []
    const oldToast = g.hud.toast
    g.hud.toast = function (t) { P.toasts.push(String(t).slice(0, 90)); return oldToast.apply(this, arguments) }
    const THREE = g.THREE
    P.iv = setInterval(() => {
      const el = null
      const bb = new THREE.Box3().setFromObject(g.capy.group)
      const p = g.capy.position
      const env = g.iceland
      const surf = env && env.waterHeightAt ? env.waterHeightAt(p.x, p.z) : null
      P.n++
      if (bb.max.y < P.topMin) P.topMin = bb.max.y
      if (bb.max.y > P.topMax) P.topMax = bb.max.y
      if (surf != null) { if (surf < P.surfMin) P.surfMin = surf; if (surf > P.surfMax) P.surfMax = surf }
      const s = (performance.now() - P.t0) / 1000
      if (P.loafAt < 0 && g.capy.loaf > 0.5) P.loafAt = +s.toFixed(2)
      if (P.taskAt < 0 && g.hud.isTaskDone('hot-spring')) P.taskAt = +s.toFixed(2)
      if (P.aurAt < 0 && g.hud.isTaskDone('aurora')) P.aurAt = +s.toFixed(2)
      const a = g.hud.calmAudit()
      if (a.calm > P.calmMax) P.calmMax = a.calm
      if (a.loaf > P.loafMax) P.loafMax = a.loaf
      P.swim = !!g.capy.swimming
      P.depth = +(g.capy.depth || 0).toFixed(3)
      P.y = +p.y.toFixed(3)
      P.top = +bb.max.y.toFixed(3)
      P.surf = surf == null ? null : +surf.toFixed(3)
    }, 50)
  })
  await page.waitForTimeout(11000)
  await page.screenshot({ path: 'qa/p3i-soak-7s.png' })
  await page.waitForTimeout(9000)
  await page.screenshot({ path: 'qa/p3i-soak-aurora.png' })
  const out = await page.evaluate(() => {
    const g = window.__capy, P = window.__P
    clearInterval(P.iv)
    const R = {}
    for (const k of ['loafAt','taskAt','aurAt','swim','depth','y','top','surf','n','toasts'])
      R[k] = P[k]
    R.topMin = +P.topMin.toFixed(3); R.topMax = +P.topMax.toFixed(3)
    R.surfMin = +P.surfMin.toFixed(3); R.surfMax = +P.surfMax.toFixed(3)
    R.proud = +(P.top - P.surf).toFixed(3)
    R.calmMax = +P.calmMax.toFixed(3); R.loafMax = +P.loafMax.toFixed(3)
    R.env = (() => { const e = g.iceland; return { localWater: e.localWater, waterLevel: e.waterLevel, hasWHA: typeof e.waterHeightAt } })()
    R.soak = g.iceland ? +g.iceland.soak().toFixed(2) : null
    R.rec = (() => { try { return g.records ? g.records() : (g.state.records || null) } catch (e) { return 'ERR ' + e.message } })()
    R.mus = { vol: g.hud.musicVolume() }
    // steam particle liveness
    let steamVis = 0, steamTot = 0
    g.scene.traverse(o => {
      if (o.isInstancedMesh && /steam|Steam/.test(o.name || '')) { steamTot += o.count }
    })
    R.steamNamed = steamTot
    R.steamApi = g.iceland && g.iceland.steamAudit ? g.iceland.steamAudit() : null
    R.cam = { x: +g.camera.position.x.toFixed(1), y: +g.camera.position.y.toFixed(1), z: +g.camera.position.z.toFixed(1) }
    R.capyPos = { x: +g.capy.position.x.toFixed(2), y: +g.capy.position.y.toFixed(2), z: +g.capy.position.z.toFixed(2) }
    R.aurora = g.iceland && g.iceland.aurora ? +g.iceland.aurora().toFixed(3) : null
    R.err = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    R.tasks = ['hot-spring','aurora','snowcat','glacier-run'].map(t => t + '=' + g.hud.isTaskDone(t))
    return R
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async o => {
    await fetch('/shot?name=p3isoak.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
