async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, rows: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const info = async (tag) => page.evaluate((tag) => {
    const g = window.__capy, T = g.THREE
    const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
    const pitch = Math.asin(-fwd.y)
    const hz = 0.5 - Math.tan(pitch) / Math.tan(g.camera.fov * Math.PI / 360) * 0.5
    const sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow)
    const hemi = g.scene.children.find(o => o.isHemisphereLight)
    const amb = g.scene.children.find(o => o.isAmbientLight)
    let sunElev = null, sunRel = null
    if (sun) {
      const sd = sun.position.clone().sub(sun.target.position).normalize()
      sunElev = Math.asin(sd.y) * 180 / Math.PI
      let rel = (Math.atan2(sd.x, sd.z) - Math.atan2(fwd.x, fwd.z)) * 180 / Math.PI; sunRel = ((rel + 540) % 360) - 180
    }
    // the animal's on-screen height: project its root's bounding box
    const box = new T.Box3().setFromObject(g.capy.group)
    const pts = [], W = g.renderer.domElement.width, H = g.renderer.domElement.height
    for (let i = 0; i < 8; i++) {
      const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
      p.project(g.camera); pts.push(p)
    }
    const ys = pts.map(p => (1 - p.y) * 0.5 * H), xs = pts.map(p => (p.x + 1) * 0.5 * W)
    const capyPx = { h: +(Math.max(...ys) - Math.min(...ys)).toFixed(0), w: +(Math.max(...xs) - Math.min(...xs)).toFixed(0), cx: +((Math.max(...xs) + Math.min(...xs)) / 2 / W).toFixed(2), cy: +((Math.max(...ys) + Math.min(...ys)) / 2 / H).toFixed(2) }
    // sky share: a 24x15 grid of raycasts from the lens against everything
    let skyHits = 0, n = 0
    const t0 = performance.now()
    const rc = new T.Raycaster(); rc.far = 3000
    const ndc = new T.Vector2()
    const solids = []
    g.scene.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && o.visible && !(o.name && /sky|dome|cloud|sun/i.test(o.name))) solids.push(o) })
    for (let j = 0; j < 15; j++) for (let i = 0; i < 24; i++) {
      if (performance.now() - t0 > 9000) break
      ndc.set((i + 0.5) / 24 * 2 - 1, 1 - (j + 0.5) / 15 * 2)
      rc.setFromCamera(ndc, g.camera)
      const hit = rc.intersectObjects(solids, false)
      n++; if (!hit.length) skyHits++
    }
    const ci = g.camInfo || {}
    return { tag, biome: g.biome.current, fov: g.camera.fov, camPitch: +(pitch * 180 / Math.PI).toFixed(1), horizonFromTop: +hz.toFixed(2),
      skyShareRay: n ? +(skyHits / n).toFixed(2) : null, rayN: n, rayMs: +(performance.now() - t0).toFixed(0), skyT: ci.sky, rest: ci.rest, dist: +(ci.dist || 0).toFixed(1),
      sunElev: sunElev === null ? null : +sunElev.toFixed(0), sunRel: sunRel === null ? null : +sunRel.toFixed(0),
      sun: sun ? +sun.intensity.toFixed(2) : null, hemi: hemi ? +hemi.intensity.toFixed(2) : null, amb: amb ? +amb.intensity.toFixed(2) : null,
      capyPx, timeScale: g.state.timeScale, speed: g.capy.animAudit ? +g.capy.animAudit().speed.toFixed(1) : null }
  }, tag)
  const CH = ['sydney', 'kyoto', 'venice', 'kowloon', 'iceland', 'palawan', 'drift', 'monaco', 'hanoi', 'sahara', 'rio', 'pasto']
  for (const c of CH) {
    if (c !== 'sydney') {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    } else await page.waitForTimeout(2500)
    await page.screenshot({ path: 'qa/l6r-art-' + c + '-arrive.png' })
    out.rows.push(await info('arrive'))
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3200)
    await page.screenshot({ path: 'qa/l6r-art-' + c + '-walk.png' })
    out.rows.push(await info('walk'))
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l6r-art-' + c + '-rest.png' })
    out.rows.push(await info('rest'))
  }
  await page.evaluate((o) => fetch('/shot?name=l6r-art-shots.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
