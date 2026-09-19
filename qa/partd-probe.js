async page => {
  // ROADMAP-WOW Part D probe: one chapter, title-card arrival, then the
  // corrected depth bins (l10-depth-sweep's method), renderer.info.render, the
  // live resting camera, and the raw own-camera arrival frame (wow-sheet's
  // method). Edit KEY/NAME/TAG between runs.
  const KEY = 'Digit8', NAME = 'sahara', TAG = 'geobefore'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(8500)
  const row = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const cam = g.camera
    const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    const rc = new T.Raycaster(); rc.far = 5000
    const bins = { near: 0, mid: 0, far: 0, sky: 0 }
    let n = 0
    for (let yy = 0; yy < 9; yy++) for (let xx = 0; xx < 13; xx++) {
      rc.setFromCamera(new T.Vector2(-1 + (xx + 0.5) * 2 / 13, 1 - (yy + 0.5) * 2 / 9), cam)
      const hits = rc.intersectObjects(g.scene.children, true).filter(h => vis(h.object) && h.object.renderOrder !== -20)
      n++
      if (!hits.length) { bins.sky++; continue }
      const d = hits[0].distance
      if (d < 20) bins.near++; else if (d < 60) bins.mid++; else if (d < 400) bins.far++; else bins.sky++
    }
    for (const k in bins) bins[k] = +(bins[k] / n).toFixed(3)
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
    let geoTris = 0, meshes = 0
    const root = g.scene.getObjectByName(g.biome.current)
    if (root) root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry) { meshes++; const ix = o.geometry.index; geoTris += ix ? ix.count / 3 : o.geometry.attributes.position.count / 3 } })
    info.geoTris = Math.round(geoTris); info.meshes = meshes
    const png = g.renderer.domElement.toDataURL('image/png')
    return { biome: g.biome.current, started: g.state.started, bins, midfar: +(bins.mid + bins.far).toFixed(3),
             cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], dir: [+d.x.toFixed(3), +d.y.toFixed(3), +d.z.toFixed(3)],
             capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)], info, lastError: g.state.lastError || null, png }
  })
  const png = row.png; delete row.png
  row.errs = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
    { n: 'WOW-D-' + NAME + '-' + TAG, u: png })
  await page.evaluate(async (o) => { await fetch('/shot?name=partd-' + o.name + '-' + o.tag + '.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o.row)))) }) }, { name: NAME, tag: TAG, row })
}
