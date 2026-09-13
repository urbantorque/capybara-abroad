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
    const suns = g.scene.children.filter(o => o.isDirectionalLight)
    const sun = suns.find(o => o.castShadow) || suns[0]
    const hemi = g.scene.children.find(o => o.isHemisphereLight)
    const amb = g.scene.children.find(o => o.isAmbientLight)
    let sunElev = null, sunRel = null
    if (sun) {
      const sd = sun.position.clone().sub(sun.target.position).normalize()
      sunElev = Math.asin(sd.y) * 180 / Math.PI
      let rel = (Math.atan2(sd.x, sd.z) - Math.atan2(fwd.x, fwd.z)) * 180 / Math.PI; sunRel = ((rel + 540) % 360) - 180
    }
    const box = new T.Box3().setFromObject(g.capy.group)
    const pts = [], W = g.renderer.domElement.width, H = g.renderer.domElement.height
    for (let i = 0; i < 8; i++) {
      const p = new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z)
      p.project(g.camera); pts.push(p)
    }
    const ys = pts.map(p => (1 - p.y) * 0.5 * H), xs = pts.map(p => (p.x + 1) * 0.5 * W)
    const capyPx = { h: +(Math.max(...ys) - Math.min(...ys)).toFixed(0), w: +(Math.max(...xs) - Math.min(...xs)).toFixed(0), cx: +((Math.max(...xs) + Math.min(...xs)) / 2 / W).toFixed(2), cy: +((Math.max(...ys) + Math.min(...ys)) / 2 / H).toFixed(2) }
    // face: dot(animal forward, animal->camera)
    const aa = g.capy.animAudit ? g.capy.animAudit() : null
    let faceDot = null
    if (aa) {
      const yaw = aa.yaw
      const f = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
      const c = g.camera.position.clone().sub(g.capy.group.position); c.y = 0; c.normalize()
      faceDot = +f.dot(c).toFixed(2)
    }
    const fog = g.scene.fog ? { near: g.scene.fog.near, far: g.scene.fog.far, density: g.scene.fog.density } : null
    const ci = g.camInfo || {}
    let meshes = 0, inst = 0, castN = 0
    g.scene.traverse(o => { if (o.isMesh) { meshes++; if (o.castShadow) castN++ } if (o.isInstancedMesh) inst++ })
    const shadowBox = sun && sun.shadow ? [sun.shadow.camera.left, sun.shadow.camera.right, sun.shadow.camera.top, sun.shadow.camera.bottom, sun.shadow.mapSize.x] : null
    return { tag, biome: g.biome.current, fov: g.camera.fov, camPitch: +(pitch * 180 / Math.PI).toFixed(1), horizonFromTop: +hz.toFixed(2),
      skyT: ci.sky, rest: ci.rest, dist: +(ci.dist || 0).toFixed(1),
      sunElev: sunElev === null ? null : +sunElev.toFixed(0), sunRel: sunRel === null ? null : +sunRel.toFixed(0),
      sun: sun ? +sun.intensity.toFixed(2) : null, nSuns: suns.length, hemi: hemi ? +hemi.intensity.toFixed(2) : null, amb: amb ? +amb.intensity.toFixed(2) : null,
      capyPx, faceDot, fog, meshes, inst, castN, shadowBox, timeScale: g.state.timeScale,
      speed: aa ? +aa.speed.toFixed(1) : null, mood: aa ? aa.mood : null, nap: aa ? aa.nap : null, headX: aa ? +aa.headX.toFixed(2) : null,
      lastError: g.state.lastError || null }
  }, tag)
  const CH = ['sydney', 'pasto', 'quay', 'cali', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'venice', 'sahara', 'kowloon']
  for (const c of CH) {
    if (c !== 'sydney') {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    } else await page.waitForTimeout(2500)
    await page.screenshot({ path: 'qa/l7r-art-' + c + '-arrive.png' })
    out.rows.push(await info('arrive'))
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3200)
    await page.screenshot({ path: 'qa/l7r-art-' + c + '-walk.png' })
    out.rows.push(await info('walk'))
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l7r-art-' + c + '-rest.png' })
    out.rows.push(await info('rest'))
  }
  await page.evaluate((o) => fetch('/shot?name=l7r-art-shots.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
