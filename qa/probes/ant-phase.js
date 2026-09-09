async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = {}
  const SETS = [['sydney', [[-55,-9],[-40,-24],[-40,-19]]],
                ['quay', [[0,0],[0,10],[-30,10],[25,10],[30,10],[-30,20],[30,20],[0,25],[-46,-268],[6,-126],[-55,-265]]],
                ['pasto', [[35,45],[35,55],[-90,-20],[-55,-75]]]]
  for (const [biome, pts] of SETS) {
    await page.evaluate((b) => { window.__capy.biome.switchTo(b) }, biome)
    await page.waitForTimeout(1200)
    out[biome] = await page.evaluate((list) => {
      const g = window.__capy
      const a = g.biome.current === 'sydney' ? g.env : g[g.biome.current]
      const meshes = []
      g.scene.traverse(o => { if (o.isMesh && o.visible) meshes.push(o) })
      const THREE = g.THREE, CANNON = g.CANNON
      const ray = new THREE.Raycaster(); ray.far = 3.0
      const org = new THREE.Vector3(), dir = new THREE.Vector3()
      const DIRS = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]
      return list.map(p => {
        const base = a && a.terrainHeight ? a.terrainHeight(p[0], p[1]) : 0
        const rows = []
        for (const h of [0.35, 0.8, 1.4]) {
          org.set(p[0], base + h, p[1])
          for (const d of DIRS) {
            dir.set(d[0], d[1], d[2])
            ray.set(org, dir)
            const its = ray.intersectObjects(meshes, false)
            if (!its.length) continue
            const it = its[0]
            // is there a physics hit on the same ray?
            const from = new CANNON.Vec3(org.x, org.y, org.z)
            const to = new CANNON.Vec3(org.x + d[0]*3, org.y, org.z + d[2]*3)
            const rr = new CANNON.RaycastResult()
            g.world.raycastClosest(from, to, { skipBackfaces: false }, rr)
            if (rr.hasHit) continue
            let nm = it.object.name || '', q = it.object.parent, guard = 0
            while (q && guard++ < 5) { if (q.name) nm = nm ? (q.name + '/' + nm) : q.name; q = q.parent }
            rows.push({ h, dir: d, dist: +it.distance.toFixed(2), obj: nm || it.object.type,
                        pt: [+it.point.x.toFixed(1), +it.point.y.toFixed(1), +it.point.z.toFixed(1)],
                        n: it.face ? [+it.face.normal.x.toFixed(1), +it.face.normal.y.toFixed(1), +it.face.normal.z.toFixed(1)] : null })
          }
        }
        return { at: p, terrain: +base.toFixed(2), drawnNoSolid: rows }
      })
    }, pts)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=antphase.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
