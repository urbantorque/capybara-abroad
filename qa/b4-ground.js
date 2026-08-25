async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const ALL = ['quay','iceland','sahara','drift','venice','kowloon','palawan','goreme',
               'pantanal','cave','antarctic']
  const out = {}
  for (const n of ALL) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const api = g.biome.api ? g.biome.api() : null
      const rows = []
      g.scene.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry
        if (!gm || gm.type !== 'PlaneGeometry' || !gm.attributes.position) return
        const t = gm.index ? gm.index.count / 3 : gm.attributes.position.count / 3
        if (t < 3000) return
        // how much of this plane is under the chapter's own water line?
        const pos = gm.attributes.position
        let under = 0, n = 0
        const wl = api && typeof api.waterLevel === 'number' ? api.waterLevel : 0
        for (let i = 0; i < pos.count; i += 1) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
          // the geometry is rotated/translated into world space at build time
          const wy = y
          n++
          const w = api && api.waterHeightAt ? api.waterHeightAt(x, z) : wl
          if (wy < w - 0.05) under++
        }
        rows.push({ name: o.name || 'Mesh', tris: Math.round(t), verts: n,
                    pctUnderWater: +(100 * under / n).toFixed(1) })
      })
      rows.sort((a, c) => c.tris - a.tris)
      return { planes: rows.slice(0, 4) }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-ground.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
