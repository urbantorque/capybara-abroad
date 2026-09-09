async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ["palawan","goreme","manly"]
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(900)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE
      const B = { palawan:[-60,60,-130,62], goreme:[-80,84,-104,60], manly:[-90,100,-80,60] }[name]
      const api = g[name]
      const terrF = api && typeof api.terrainHeight === 'function' ? api.terrainHeight.bind(api) : null
      const terr = (x, z) => { if (!terrF) return 0; const v = terrF(x, z); return v === v ? v : 0 }
      const meshes = [], info = {}
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || m.transparent) return
        meshes.push(o)
        const gm = o.geometry
        if (gm && !gm.boundingSphere) gm.computeBoundingSphere()
        let nm = o.name || '', q = o.parent, guard = 0
        while (q && guard++ < 6) { if (q.name) nm = nm ? (q.name + '/' + nm) : q.name; q = q.parent }
        const bb2 = gm ? (gm.boundingBox || (gm.computeBoundingBox(), gm.boundingBox)) : null
        info[o.id] = { name: nm || o.type, inst: !!o.isInstancedMesh, cnt: o.count || 0,
          bb: bb2 ? [Math.round(bb2.min.x), Math.round(bb2.min.y), Math.round(bb2.min.z), Math.round(bb2.max.x), Math.round(bb2.max.y), Math.round(bb2.max.z)] : null,
          col: o.material && o.material.color ? '#' + o.material.color.getHexString() : '' }
      })
      const boxes = []
      for (const b of g.world.bodies) {
        if (b.mass > 0 && b.type !== 4) continue
        let skip = false
        for (const sh of b.shapes) { const t = sh.constructor && sh.constructor.name; if (t === 'Heightfield' || t === 'Plane') skip = true }
        if (skip) continue
        b.updateAABB()
        const lo = b.aabb.lowerBound, hi = b.aabb.upperBound
        if (!(lo.x === lo.x)) continue
        boxes.push([lo.x, lo.y, lo.z, hi.x, hi.y, hi.z])
      }
      const inBox = (x,y,z) => { for (const q of boxes) if (x>q[0]-0.05&&x<q[3]+0.05&&y>q[1]-0.05&&y<q[4]+0.05&&z>q[2]-0.05&&z<q[5]+0.05) return true; return false }
      const ray = new THREE.Raycaster()
      ray.far = 3.2
      const dirs = []
      for (let a = 0; a < 8; a++) dirs.push(new THREE.Vector3(Math.cos(a*Math.PI/4), 0, Math.sin(a*Math.PI/4)))
      const hits = {}
      const CANNON = g.CANNON
      const res = new CANNON.RaycastResult()
      const step = 2.5
      let samples = 0
      for (let x = B[0]; x <= B[1]; x += step) for (let z = B[2]; z <= B[3]; z += step) {
        const ty = terr(x, z)
        const y = ty + 0.55
        if (inBox(x, y, z)) continue
        samples++
        const org = new THREE.Vector3(x, y, z)
        for (const d of dirs) {
          ray.set(org, d)
          const hs = ray.intersectObjects(meshes, false)
          if (!hs.length) continue
          const h = hs[0]
          if (h.distance > 3.0) continue
          // is there a physics body along that segment?
          const from = new CANNON.Vec3(x, y, z)
          const to = new CANNON.Vec3(x + d.x * (h.distance + 0.25), y, z + d.z * (h.distance + 0.25))
          res.reset()
          g.world.raycastClosest(from, to, { skipBackfaces: false }, res)
          if (res.hasHit) continue
          const id = h.object.id
          hits[id] = (hits[id] || 0) + 1
        }
      }
      const rows = Object.entries(hits).sort((a,b) => b[1]-a[1]).slice(0, 26).map(([id, n]) => ({ n, ...info[id] }))
      return { samples, total: Object.values(hits).reduce((a,b)=>a+b,0), rows,
               bodies: g.world.bodies.length,
               calls: g.renderer.info.render.calls }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p4solid.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
