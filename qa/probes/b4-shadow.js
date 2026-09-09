async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of ALL) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      // Split the shadow-casting triangles three ways:
      //   ghost   — transparent / no-depth-write / additive: can NEVER cast honestly
      //   flat    — a mesh whose bounding box is thinner than 12 cm in y: a ground
      //             sheet, whose shadow is its own silhouette on itself
      //   solid   — everything else, which is a real shadow
      let ghost = 0, flat = 0, solid = 0, none = 0, nGhost = 0, nFlat = 0
      const ghosts = [], flats = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)
        const tot = t * (o.isInstancedMesh ? o.count : 1)
        if (!o.castShadow) { none += tot; return }
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 3) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        if (m && (m.transparent || m.depthWrite === false || m.blending === 2)) {
          ghost += tot; nGhost++; ghosts.push([nm, Math.round(tot)]); return
        }
        if (!gm.boundingBox) gm.computeBoundingBox()
        const bb = gm.boundingBox
        const sy = Math.abs((bb.max.y - bb.min.y) * (o.scale ? o.scale.y : 1))
        if (!o.isInstancedMesh && sy < 0.12 && tot > 400) {
          flat += tot; nFlat++; flats.push([nm, Math.round(tot), +sy.toFixed(3)]); return
        }
        solid += tot
      })
      ghosts.sort((a, b2) => b2[1] - a[1]); flats.sort((a, b2) => b2[1] - a[1])
      return { ghost: Math.round(ghost), flat: Math.round(flat), solid: Math.round(solid),
               none: Math.round(none), nGhost, nFlat,
               ghosts: ghosts.slice(0, 6), flats: flats.slice(0, 6) }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-shadow.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
