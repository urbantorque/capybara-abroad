async page => {
  // ROADMAP-WOW Part D probe: one chapter, title-card arrival, then the
  // corrected depth bins (l10-depth-sweep's method), renderer.info.render, the
  // live resting camera, and the raw own-camera arrival frame (wow-sheet's
  // method). Edit KEY/NAME/TAG between runs.
  const KEY = 'Digit0', NAME = 'venice', TAG = 'after'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(8500)
  // The resting lens is not deterministic between arrivals (Manly settled at
  // two yaws 0.3 rad apart), so a PINNED pose — one run's own live camera,
  // rebuilt with the live fov — is measured as well, and that is the
  // before/after differential.
  const POSE = { iceland: { p: [-5.87, 4.05, 109.15], d: [0.496, -0.134, -0.858] }, goreme: { p: [10.06, 10.92, 39.9], d: [-0.856, -0.125, -0.502] }, venice: { p: [6.12, 4.88, 19.16], d: [-0.844, -0.119, -0.522] },
                 manly: { p: [11.62, 6.68, 48.37], d: [-0.971, -0.135, -0.198] },
                 cave: { p: [8.35, 6.59, 69.99], d: [-0.716, -0.127, -0.686] }, sahara: { p: [6.42, 3.9, -1.7], d: [-0.548, -0.123, 0.828] } }[NAME]
  const row = await page.evaluate((POSE) => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera
    const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    const rc = new T.Raycaster(); rc.far = 5000
    const binsOf = (c) => {
      const bins = { near: 0, mid: 0, far: 0, sky: 0 }
      let n = 0
      for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 13; xx++) {
        rc.setFromCamera(new T.Vector2(-1 + (xx + 0.5) * 2 / 13, 1 - (yy + 0.5) * 2 / 9), c)
        const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder !== -20)
        n++
        if (!hits.length) { bins.sky++; continue }
        const d = hits[0].distance
        if (d < 20) bins.near++; else if (d < 60) bins.mid++; else if (d < 400) bins.far++; else bins.sky++
      }
      for (const k in bins) bins[k] = +(bins[k] / n).toFixed(3)
      bins.midfar = +(bins.mid + bins.far).toFixed(3)
      return bins
    }
    const bins = binsOf(cam)
    let pinned = null, pngPinned = null
    if (POSE) {
      const c = new T.PerspectiveCamera(cam.fov, 1280 / 760, cam.near, cam.far)
      c.position.set(POSE.p[0], POSE.p[1], POSE.p[2])
      c.lookAt(POSE.p[0] + POSE.d[0], POSE.p[1] + POSE.d[1], POSE.p[2] + POSE.d[2])
      c.updateMatrixWorld()
      pinned = binsOf(c)
      g.renderer.setRenderTarget(null)
      g.renderer.info.reset()
      g.renderer.render(g.scene, c)
      pinned.calls = g.renderer.info.render.calls; pinned.triangles = g.renderer.info.render.triangles
      pngPinned = g.renderer.domElement.toDataURL('image/png')
    }
    const p = cam.getWorldPosition(new T.Vector3())
    const d = cam.getWorldDirection(new T.Vector3())
    const cp = g.capy.position
    // a plain scene render for the draw stats, own camera, same as the sheet
    g.renderer.setRenderTarget(null)
    g.renderer.info.reset()
    g.renderer.render(g.scene, cam)
    const inf = g.renderer.info.render
    const info = { calls: inf.calls, triangles: inf.triangles }
    // the chapter's own merged triangles (non-instanced meshes under its root):
    // renderer.info counts the shadow pass too, so the budget is stated here
    let geoTris = 0, meshes = 0, imeshes = 0
    const root = g.scene.getObjectByName(g.biome.current)
    if (root) root.traverse(o => { if (o.isInstancedMesh) imeshes++; if (o.isMesh && !o.isInstancedMesh && o.geometry) { meshes++; const ix = o.geometry.index; geoTris += ix ? ix.count / 3 : o.geometry.attributes.position.count / 3 } })
    info.geoTris = Math.round(geoTris); info.meshes = meshes; info.imeshes = imeshes
    const png = g.renderer.domElement.toDataURL('image/png')
    return { biome: g.biome.current, started: g.state.started, bins, pinned,
             cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], dir: [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)],
             capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)], info, lastError: g.state.lastError || null, png, pngPinned }
  }, POSE)
  const png = row.png; delete row.png
  const pngPinned = row.pngPinned; delete row.pngPinned
  row.errs = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
    { n: 'WOW-D-' + NAME + '-' + TAG, u: png })
  if (pngPinned) await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
    { n: 'WOW-D-' + NAME + '-' + TAG + '-pinned', u: pngPinned })
  await page.evaluate(async (o) => { await fetch('/shot?name=partd-' + o.name + '-' + o.tag + '.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o.row)))) }) }, { name: NAME, tag: TAG, row })
}
