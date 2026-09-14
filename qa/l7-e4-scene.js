async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null, chapters: {} }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const audit = async () => page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const live = g.biome.current
    const lights = g.scene.children.filter(o => o.isLight).map(o => ({ type: o.type, i: +o.intensity.toFixed(2), cast: !!o.castShadow,
      box: o.shadow && o.shadow.camera ? [o.shadow.camera.left, o.shadow.camera.right, o.shadow.camera.top, o.shadow.camera.bottom, o.shadow.camera.far, o.shadow.mapSize.x] : null,
      color: o.color ? '#' + o.color.getHexString() : null, ground: o.groundColor ? '#' + o.groundColor.getHexString() : null }))
    let meshes = 0, vis = 0, cast = 0, recv = 0, emis = 0, trans = 0, flat = 0, vcol = 0, tex = 0, water = 0, waterRecv = 0
    const mats = new Set(), cols = new Set()
    g.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return
      meshes++
      let v = true; o.traverseAncestors(a => { if (!a.visible) v = false }); if (!o.visible) v = false
      if (!v) return
      vis++
      if (o.castShadow) cast++
      if (o.receiveShadow) recv++
      const m = Array.isArray(o.material) ? o.material[0] : o.material
      if (!m) return
      mats.add(m)
      if (m.color) cols.add(m.color.getHexString())
      if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01 && m.emissiveIntensity !== 0) emis++
      if (m.transparent) trans++
      if (m.flatShading) flat++
      if (m.vertexColors) vcol++
      if (m.map) tex++
      const u = m.userData || {}
      if (/water|sea|lagoon|harbour|river|lake|canal/i.test(o.name || '') || u.water) { water++; if (o.receiveShadow) waterRecv++ }
    })
    // locals in the live chapter: stance spread
    const L = (g.locals || []).filter(r => r.biome === live && r.fig && r.group)
    const st = L.map(r => ({ aLx: +r.fig.armL.rotation.x.toFixed(2), aLz: +r.fig.armL.rotation.z.toFixed(2), aRx: +r.fig.armR.rotation.x.toFixed(2), aRz: +r.fig.armR.rotation.z.toFixed(2),
      eL: +r.fig.elbowL.rotation.x.toFixed(2), kL: +r.fig.kneeL.rotation.x.toFixed(2), tx: +r.fig.torso.rotation.x.toFixed(2), tz: +r.fig.torso.rotation.z.toFixed(2), ty: +r.fig.torso.rotation.y.toFixed(2),
      lLx: +r.fig.legL.rotation.x.toFixed(2), lRx: +r.fig.legR.rotation.x.toFixed(2), hy: +r.fig.head.rotation.y.toFixed(2), sy: +r.group.scale.y.toFixed(3), sx: +r.group.scale.x.toFixed(3), arch: r.fig.arch }))
    const sd = k => { const a = st.map(s => s[k]); const m = a.reduce((p, q) => p + q, 0) / Math.max(1, a.length); return +Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / Math.max(1, a.length)).toFixed(3) }
    const keys = ['aLx', 'aLz', 'aRx', 'aRz', 'eL', 'kL', 'tx', 'tz', 'lLx', 'lRx', 'hy', 'sy', 'sx']
    const spread = {}; for (const k of keys) spread[k] = sd(k)
    return { live, lights, meshes, vis, cast, recv, emis, trans, flat, vcol, tex, water, waterRecv, mats: mats.size, cols: cols.size, localsN: L.length, spread, sample: st.slice(0, 6),
      fog: g.scene.fog ? { near: +g.scene.fog.near.toFixed(0), far: +g.scene.fog.far.toFixed(0), c: '#' + g.scene.fog.color.getHexString() } : null,
      bg: g.scene.background && g.scene.background.isColor ? '#' + g.scene.background.getHexString() : typeof g.scene.background, err: g.state.lastError || null }
  })
  const CH = ['quay', 'venice', 'sahara', 'kowloon', 'cave']
  for (const c of CH) {
    if (true) {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    }
    out.chapters[c] = await audit()
  }
  await page.evaluate((o) => fetch('/shot?name=l7-e4-scene.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
