async page => {
  // ROADMAP-WOW Part C "Heroes" probe, one chapter per run (the partd-probe-b
  // method): title-card arrival, l10's corrected depth bins on the live lens
  // and on a PINNED pose, renderer.info on the pinned render, the chapter
  // root's merged triangle / mesh / instanced-mesh counts, and the raw
  // own-camera arrival frame. Edit KEY/NAME/TAG between runs; the pinned pose
  // is one run's own live camera, kept so before/after compare.
  const KEY = 'Semicolon', NAME = 'pantanal', TAG = 'hero-arrive'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press(KEY)
  await page.waitForTimeout(8500)
  const POSE = {
    pasto: { p: [11.47, 3.9, 27.84], d: [-0.98, -0.124, -0.157] },
    monaco: { p: [0.06, 6.5, -85.96], d: [0.851, -0.124, 0.51] },
    hanoi: { p: [-69.15, 5.15, -70.81], d: [0.78, -0.127, -0.613] },
    pantanal: { p: [10.26, 5.8, 67.87], d: [-0.86, -0.133, -0.492] },
  }[NAME]
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
    g.renderer.setRenderTarget(null)
    g.renderer.info.reset()
    g.renderer.render(g.scene, cam)
    const inf = g.renderer.info.render
    const info = { calls: inf.calls, triangles: inf.triangles }
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
    { n: 'WOW-H-' + NAME + '-' + TAG, u: png })
  if (pngPinned) await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) },
    { n: 'WOW-H-' + NAME + '-' + TAG + '-pinned', u: pngPinned })
  await page.evaluate(async (o) => { await fetch('/shot?name=wowh-' + o.name + '-' + o.tag + '.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o.row)))) }) }, { name: NAME, tag: TAG, row })
}
