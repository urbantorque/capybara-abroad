async page => {
  // The instanced meshes in the Kyoto frame, by cost. For each bucket of
  // instanced meshes (by instance count) the drained pass with that bucket
  // hidden; minimum of 8 reps of 15 frames. And the cover sweep's own count.
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__capy.hud.cross('kyoto'))
  await page.waitForTimeout(11000)
  await page.evaluate(() => { const b = window.__capy.capy.body; b.position.set(26, 0.3, 19.5); b.velocity.set(0, 0, 0); if (b.interpolatedPosition) b.interpolatedPosition.set(26, 0.3, 19.5) })
  await page.waitForTimeout(3000)
  const r = await page.evaluate(() => {
    const g = window.__capy
    const gl = g.renderer.getContext()
    const px = new Uint8Array(4)
    const drain = () => { g.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) }
    const timePass = (n) => {
      const a = []
      for (let rep = 0; rep < (n || 8); rep++) {
        drain(); const t0 = performance.now()
        for (let k = 0; k < 15; k++) g.reflectDraw()
        drain(); a.push((performance.now() - t0) / 15)
      }
      return +Math.min(...a).toFixed(2)
    }
    g.state.noReflect = false
    g.reflectDraw()
    const base = timePass(12)
    const inst = []
    g.scene.traverse(o => { if (o.isInstancedMesh && o.visible) inst.push(o) })
    const vis = o => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true }
    const rows = inst.filter(vis).map(o => {
      const geo = o.geometry; if (!geo.boundingSphere) geo.computeBoundingSphere()
      const key = o.material && o.material.customProgramCacheKey ? String(o.material.customProgramCacheKey()).slice(0, 12) : ''
      return { count: o.count, r: +geo.boundingSphere.radius.toFixed(2), geo: geo.type, tri: (geo.index ? geo.index.count : geo.attributes.position.count) / 3, ro: o.renderOrder, key, name: o.name || (o.parent && o.parent.name) || '' }
    })
    rows.sort((a, b) => b.count * b.tri - a.count * a.tri)
    // buckets
    const buckets = {}
    const hideWhere = (pred) => { const h = inst.filter(pred); h.forEach(o => { o.visible = false }); const t = timePass(); h.forEach(o => { o.visible = true }); return { n: h.length, ms: t } }
    buckets.all = hideWhere(() => true)
    buckets.countOver1000 = hideWhere(o => o.count > 1000)
    buckets.count300to1000 = hideWhere(o => o.count > 300 && o.count <= 1000)
    buckets.countUnder300 = hideWhere(o => o.count <= 300)
    buckets.topTriBudget = hideWhere(o => { const geo = o.geometry; const tri = (geo.index ? geo.index.count : geo.attributes.position.count) / 3; return o.count * tri > 20000 })
    // non-instanced meshes, by draw count
    const plain = []; g.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.visible) plain.push(o) })
    buckets.allPlainMeshes = hideWhere.call(null, () => false)
    plain.forEach(o => { o.visible = false }); buckets.noPlain = { n: plain.length, ms: timePass() }; plain.forEach(o => { o.visible = true })
    const base2 = timePass(12)
    return { base, base2, rows: rows.slice(0, 25), instN: inst.length, buckets, info: g.reflectInfo() }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-reflect-perf3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, r)
}
