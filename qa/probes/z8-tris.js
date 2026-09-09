async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = {}
  for (const n of ['sahara','drift']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<90;i++) g.tick(1/60,false)
      let tris = 0, meshes = 0, shadowTris = 0
      const per = [], ghosts = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        const tot = t * (o.isInstancedMesh ? o.count : 1)
        tris += tot
        if (o.castShadow) shadowTris += tot
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (m && o.castShadow && (m.transparent || m.depthWrite === false || m.blending === 2)) {
          let nm = o.name || o.type, q = o.parent, guard = 0
          while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
          ghosts.push([nm, Math.round(tot)])
        }
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        per.push([nm, Math.round(tot), o.isInstancedMesh ? o.count : 1])
      })
      per.sort((a,b2) => b2[1]-a[1])
      ghosts.sort((a,b2) => b2[1]-a[1])
      g.tick(1/60, true)
      return { tris: Math.round(tris), shadowTris: Math.round(shadowTris), meshes,
               calls: g.renderer.info.render.calls, bodies: g.world.bodies.length,
               top: per.slice(0,22), ghosts: ghosts.slice(0,20), err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=z8tris.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
