async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['palawan','goreme']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<120;i++) g.tick(1/60,false)
      // ---- triangles / meshes / bodies
      let tris = 0, meshes = 0, shadowTris = 0, ghosts = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        const tot = t * (o.isInstancedMesh ? o.count : 1)
        tris += tot
        if (o.castShadow) {
          shadowTris += tot
          const m = Array.isArray(o.material) ? o.material[0] : o.material
          if (m && (m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending || m.fog === false)) ghosts += tot
        }
      })
      // ---- kinematic bodies that move with no velocity (the kine audit)
      const kine = []
      for (const bd of g.world.bodies) {
        if (bd.type !== 4) continue
        const p0 = bd.position.clone()
        for (let i=0;i<12;i++) g.tick(1/60,false)
        const moved = p0.distanceTo(bd.position)
        const v = Math.hypot(bd.velocity.x, bd.velocity.y, bd.velocity.z)
        if (moved > 0.05 && v < 0.02) kine.push([Math.round(moved*100)/100, Math.round(v*1000)/1000])
      }
      // ---- per-frame allocation proxy: run 600 frames and watch for errors
      let err = null
      for (let i=0;i<600;i++) g.tick(1/60,false)
      err = g.state.lastError || null
      // ---- every task pointer resolves
      const api = g[name]
      const ptr = {}
      for (const k of ['beach','jetty','fire','reef','wreck','clam','crack','lagoon','cathedral','foot',
                       'town','plaza','field','valley','cliff','tether','landing','chimney']) {
        if (api && api[k]) { const v = api[k]; ptr[k] = [Math.round(v.x), Math.round(v.z)] }
      }
      for (const k of ['turtle','bangka','baitBall','manta','mare','balloon','truck','envelope','mouth']) {
        if (api && typeof api[k] === 'function') {
          const v = api[k]()
          ptr[k] = v ? [Math.round(v.x), Math.round(v.z)] : null
        }
      }
      return { tris: Math.round(tris), shadowTris: Math.round(shadowTris), ghostShadow: Math.round(ghosts),
               meshes, bodies: g.world.bodies.length, kine, err, ptr }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=zaaudit.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
