// PAYOFF batch 1, job 1(b): what exactly are the solidity hits in 14-17 and 1-3?
// audit-solid.js names the object's parent chain, which in a chapter that builds
// everything under one root is just the chapter's name. This names the geometry,
// the material colour, the instance count and where it actually is, so a hit can
// be classified as furniture (a bug) or vegetation/terrain/sky (not one).
async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = {}
  for (const n of ['manly', 'pantanal', 'cave', 'antarctic', 'sydney', 'quay', 'pasto']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false)
      // Everything in the scene that is opaque, visible, and NOT backed by a body.
      // A body is matched by proximity: a static box within 1.5 m of the mesh's
      // world centre with a comparable footprint.
      const bodies = []
      for (const bd of g.world.bodies) {
        if (bd.mass !== 0) continue
        bodies.push([bd.position.x, bd.position.y, bd.position.z])
      }
      const rows = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || m.transparent) return
        const gm = o.geometry
        if (!gm) return
        if (!gm.boundingBox) gm.computeBoundingBox()
        const bb = gm.boundingBox
        const sx = bb.max.x - bb.min.x, sy = bb.max.y - bb.min.y, sz = bb.max.z - bb.min.z
        rows.push({
          id: o.id,
          geo: gm.type || '?',
          name: o.name || '',
          parent: (o.parent && o.parent.name) || '',
          inst: !!o.isInstancedMesh, cnt: o.count || 0,
          size: [+sx.toFixed(2), +sy.toFixed(2), +sz.toFixed(2)],
          at: [+o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)],
          col: m.color ? '#' + m.color.getHexString() : '',
          tris: gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0),
        })
      })
      return { bodies: bodies.length, meshes: rows.length, rows }
    }, n)
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=pfsolid1417.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
