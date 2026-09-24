async page => {
  // T4f diag: six glowing rings at fixed screen places in the first landing
  // frames. Which objects project there? Every visible mesh (and every
  // instance of an instanced one) within 40 px of (640,290) and (1020,240).
  const NAME = 'ten-t4f-ringprobe'
  const PORT = 5196
  const out = {}
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:' + PORT + '/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('drift') })
  let t0 = Date.now()
  while (Date.now() - t0 < 45000) {
    const ok = await page.evaluate(() => { const g = window.__capy; if (g.biome.current !== 'drift' || !g.drift) return false; const s = g.drift.SPAWN, p = g.capy.position; return Math.hypot(p.x - s.x, p.z - s.z) < 5 })
    if (ok) break
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(12000)
  await page.evaluate(P => { const b = window.__capy.capy.body; b.position.set(P.x, 14, P.z); b.velocity.set(0, -2, 0); b.aabbNeedsUpdate = true }, { x: 28, z: 57 })
  t0 = Date.now()
  while (Date.now() - t0 < 8000) { if (await page.evaluate(() => window.__capy.capy.position.y) < 0.6) break; await page.waitForTimeout(60) }
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'qa/' + NAME + '.png' })
  out.hits = await page.evaluate(() => {
    const g = window.__capy, cam = g.camera, V = cam.position.clone(), M = cam.matrixWorld.clone()
    const targets = [[640, 290], [1020, 240], [380, 105]]
    const hits = []
    const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
    const path = o => { const n = []; for (let p = o; p && n.length < 4; p = p.parent) n.push(p.name || p.type); return n.join('<') }
    const test = (o, wx, wy, wz, inst) => {
      V.set(wx, wy, wz).project(cam)
      if (V.z > 1 || V.z < -1) return
      const sx = (V.x + 1) * 640, sy = (1 - V.y) * 380
      for (const t of targets) if (Math.hypot(sx - t[0], sy - t[1]) < 40) {
        const mt = o.material || {}
        hits.push({ at: t.join(','), path: path(o), inst, geo: o.geometry && o.geometry.type, n: o.count, col: mt.color && mt.color.getHexString(), em: mt.emissive && mt.emissive.getHexString(), op: mt.opacity, blend: mt.blending, dt: mt.depthTest, sx: Math.round(sx), sy: Math.round(sy) })
      }
    }
    g.scene.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isSprite) || !shown(o)) return
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, M); M.premultiply(o.matrixWorld); test(o, M.elements[12], M.elements[13], M.elements[14], i) }
      } else { const e = o.matrixWorld.elements; test(o, e[12], e[13], e[14], -1) }
    })
    return hits.slice(0, 40)
  })
  out.dom = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 30 && r.width < 160 && Math.abs(r.left + r.width / 2 - 640) < 30 && Math.abs(r.top + r.height / 2 - 290) < 30 }).map(e => e.className + '|' + e.tagName).slice(0, 10))
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
