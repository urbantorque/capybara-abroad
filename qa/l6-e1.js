async page => {
  // L6 E1 — THE FAR SHADOW, AND THE LENS THAT COMES BACK. The instrument, in one run:
  //   far:   l4r-art-sunaz's shadow diff restricted to the band y 0.20–0.45, all-shade and
  //          far-cascade-only, in five walking frames; the far pass's CPU cost (game.state.farMs)
  //   yaw:   W held 6 s from a 90° hand orbit: |camYaw − (heading + π)| by 4 s; and the C key
  //   lens:  the crowd in the lens, deterministically (a synthetic local on the segment 2.5 m
  //          from the lens; an instanced cast member through the API; a crowd body with no
  //          drawable → the boom bias). The 30 s Venice piazza walk is qa/l6-e1-crowd.js —
  //          it waits a tide for the crowd to be on the paving and takes four minutes.
  //   pill:  a hop is not an impulse; an unlabelled launch names the chapter's fallback; a
  //          labelled one names its label; the lost-frame cut never fires on a tracked launch
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, far: [], yaw: {}, lens: {}, pill: {} }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }

  // ---- yaw + C, in Sydney before anything moves ---------------------------------------------
  const yawErr = () => page.evaluate(() => { const g = window.__capy; return [g.input.camYaw, g.capy.group.rotation.y] }).then(([c, h]) => +wrap(c - (h + Math.PI)).toFixed(3))
  await page.keyboard.down('KeyZ'); await page.waitForTimeout(650); await page.keyboard.up('KeyZ'); await page.waitForTimeout(300)
  out.yaw.orbited = await yawErr()
  const rows = []
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); rows.push(await yawErr()) }
  await page.keyboard.up('KeyW')
  out.yaw.errAt = { s1: rows[4], s2: rows[9], s4: rows[19], s6: rows[29] }
  out.yaw.pass4s = Math.abs(rows[19]) <= 0.3
  await page.waitForTimeout(1500)
  await page.keyboard.down('KeyZ'); await page.waitForTimeout(650); await page.keyboard.up('KeyZ'); await page.waitForTimeout(400)
  out.yaw.cBefore = await yawErr()
  await page.keyboard.press('KeyC'); await page.waitForTimeout(500)
  out.yaw.cAfter05 = await yawErr()

  // ---- pill --------------------------------------------------------------------------------
  await page.keyboard.press('Space'); await page.waitForTimeout(1200)
  out.pill.hop = await page.evaluate(() => window.__capy.state.impulseLast || null)
  await page.evaluate(() => window.__capy.capy.launch(7, 5, 0)); await page.waitForTimeout(900)
  out.pill.unlabelled = await page.evaluate(() => window.__capy.state.impulseLast || null)
  await page.waitForTimeout(4500)
  await page.evaluate(() => window.__capy.capy.launch(-7, 5, 0, 'the geyser')); await page.waitForTimeout(900)
  out.pill.labelled = await page.evaluate(() => window.__capy.state.impulseLast || null)
  out.pill.pillSeen = false
  for (let i = 0; i < 9; i++) { if (await page.evaluate(() => document.body.textContent.includes('that was the geyser'))) { out.pill.pillSeen = true; break }; await page.waitForTimeout(500) }
  out.pill.cut = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const c0 = g.state.camCuts | 0
    g.capy.launch(16, 9, 0, 'the ferry')
    let outF = 0
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100))
      const p = new T.Vector3(g.capy.position.x, g.capy.position.y + 0.4, g.capy.position.z).project(g.camera)
      if (!(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1)) outF++
    }
    return { outOfFrameSamples: outF, cuts: (g.state.camCuts | 0) - c0 }
  })
  await page.waitForTimeout(3000)

  // ---- lens, deterministic ------------------------------------------------------------------
  out.lens.local = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE, C = g.CANNON
    let matR = null
    g.scene.traverse(o => { if (!matR && o.isMesh && !o.isInstancedMesh && o.material && o.material.onBeforeCompile && o.material.vertexColors === false && o.material.color) matR = o.material })
    const cam = g.camera.position, a = g.capy.position
    const dx = a.x - cam.x, dy = a.y + 0.5 - cam.y, dz = a.z - cam.z
    const L = Math.hypot(dx, dy, dz)
    const px = cam.x + dx / L * 2.5, py = cam.y + dy / L * 2.5, pz = cam.z + dz / L * 2.5
    const mesh = new T.Mesh(new T.BoxGeometry(0.6, 1.0, 0.6), matR)
    mesh.position.set(px, py, pz); g.scene.add(mesh)
    const body = new C.Body({ mass: 0, type: C.Body.STATIC })
    body.addShape(new C.Box(new C.Vec3(0.3, 0.5, 0.3))); body.position.set(px, py, pz)
    body.userData = { local: { fig: { group: mesh } } }
    g.world.addBody(body)
    const fades = []
    for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 80)); fades.push(+(mesh.userData.lensFade || 0).toFixed(2)) }
    const lens = g.camInfo.lens
    g.world.removeBody(body)
    const drain = []
    for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 80)); drain.push(+(mesh.userData.lensFade || 0).toFixed(2)) }
    const unhooked = mesh.onBeforeRender === T.Object3D.prototype.onBeforeRender
    g.scene.remove(mesh)
    return { lens, fades, drain, unhooked }
  })
  out.lens.inst = await page.evaluate(async () => {
    const g = window.__capy
    const cast = g.npcs || []
    const a = g.capy.position
    let best = null, bd = 1e9
    for (const r of cast) { if (!r || !r.group || !r.nodes || !r.nodes.head) continue; const d = Math.hypot(r.group.position.x - a.x, r.group.position.z - a.z); if (d < bd) { bd = d; best = r } }
    if (!best) return null
    const ok = g.npcLensFade(best, 0.6)
    await new Promise(r => setTimeout(r, 120))
    let attrs = 0, val = null
    g.scene.traverse(o => { if (o.isInstancedMesh && o.geometry.getAttribute('aLensFade')) { attrs++; if (val === null) val = +o.geometry.getAttribute('aLensFade').array[cast.indexOf(best)].toFixed(2) } })
    // the picture: a 4x crop round the faded walker
    g.post.render()
    const c = g.renderer.domElement, T = g.THREE
    const p = new T.Vector3(best.group.position.x, best.group.position.y + 1.0, best.group.position.z).project(g.camera)
    const sx = (p.x + 1) / 2 * c.width, sy = (1 - p.y) / 2 * c.height
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480
    const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false
    cx.drawImage(c, sx - 80, sy - 60, 160, 120, 0, 0, 640, 480)
    await fetch('/shot?name=l6-e1-lens-zoom', { method: 'POST', body: cv.toDataURL('image/png').split(',')[1] })
    g.npcLensFade(best, 0)
    return { ok, meshesWithAttr: attrs, val }
  })
  out.lens.bias = await page.evaluate(async () => {
    const g = window.__capy, C = g.CANNON
    const cam = g.camera.position, a = g.capy.position
    const dx = a.x - cam.x, dy = a.y + 0.5 - cam.y, dz = a.z - cam.z
    const L = Math.hypot(dx, dy, dz)
    const body = new C.Body({ mass: 0, type: C.Body.STATIC })
    body.addShape(new C.Box(new C.Vec3(0.3, 0.9, 0.3)))
    body.position.set(cam.x + dx / L * 2.5, cam.y + dy / L * 2.5, cam.z + dz / L * 2.5)
    body.userData = { crowd: { n: 1 }, idx: 0 }
    g.world.addBody(body)
    const b = []
    for (let i = 0; i < 15; i++) { await new Promise(r => setTimeout(r, 100)); b.push(+g.camInfo.lensBias.toFixed(2)) }
    g.world.removeBody(body)
    return { bias: b, max: Math.max(...b) }
  })

  // ---- far -----------------------------------------------------------------------------------
  const CH = ['sydney', 'venice', 'pasto', 'sahara', 'pantanal']
  for (const c of CH) {
    if (c !== 'sydney') { await page.evaluate((c) => window.__capy.hud.cross(c), c); await page.waitForTimeout(9500) }
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2600)
    const row = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE
      const cv0 = g.renderer.domElement
      const suns = g.scene.children.filter(o => o.isDirectionalLight && o.castShadow)
      const near = suns.find(o => o.shadow.autoUpdate !== false), far = suns.find(o => o.shadow.autoUpdate === false)
      const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
      const pitch = Math.asin(-fwd.y)
      const grab = () => { g.post.render(); return cv0.toDataURL('image/png') }
      const uA = grab()
      let uB = null
      if (far) { far.castShadow = false; g.post.render(); uB = grab(); far.castShadow = true }
      if (near) near.castShadow = false
      if (far) far.castShadow = false
      g.post.render(); const uC = grab()
      if (near) near.castShadow = true
      if (far) far.castShadow = true
      g.post.render()
      const cv = document.createElement('canvas'); cv.width = cv0.width; cv.height = cv0.height
      const cx = cv.getContext('2d', { willReadFrequently: true })
      async function dec(url) { const im = new Image(); await new Promise(r => { im.onload = r; im.src = url }); cx.drawImage(im, 0, 0); return cx.getImageData(0, 0, cv.width, cv.height).data }
      const a = await dec(uA), b = uB ? await dec(uB) : null, d = await dec(uC)
      const W = cv.width, H = cv.height, y0 = Math.floor(H * 0.20), y1 = Math.floor(H * 0.45)
      const band = (p, q) => {
        let n = 0, hit = 0, sum = 0
        for (let y = y0; y < y1; y += 2) for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4
          const la = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]
          const lb = 0.2126 * q[i] + 0.7152 * q[i + 1] + 0.0722 * q[i + 2]
          const dd = lb - la
          n++; if (dd > 6) { hit++; sum += dd }
        }
        return { pct: +(100 * hit / n).toFixed(1), mean: +(sum / Math.max(1, hit)).toFixed(0) }
      }
      const all = band(a, d), farOnly = b ? band(a, b) : null
      return { biome: g.biome.current, camPitch: +(pitch * 180 / Math.PI).toFixed(1),
        speed: g.capy.animAudit ? +g.capy.animAudit().speed.toFixed(1) : null,
        farOn: !!far, farI: far ? +far.intensity.toFixed(2) : null, nearI: near ? +near.intensity.toFixed(2) : null,
        rung: g.perfAudit ? g.perfAudit().rung : null, farMs: +(g.state.farMs || 0).toFixed(2),
        bandShadeAllPct: all.pct, bandShadeFarPct: farOnly ? farOnly.pct : null, bandShadeFarMean: farOnly ? farOnly.mean : null,
        err: g.state.lastError ? String(g.state.lastError).slice(0, 200) : null }
    })
    await page.keyboard.up('KeyW')
    out.far.push(row)
    await page.screenshot({ path: 'qa/l6-e1-far-' + c + '.png' })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null)
  await page.evaluate((o) => fetch('/shot?name=l6-e1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
