async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ['venice','kowloon']
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
      const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
      const B = { drift:[-110,110,-180,60], venice:[-160,60,-80,60], kowloon:[-60,60,-170,70] }[name]
      const api = g[name]
      const terrF = api.terrainHeight.bind(api)
      const waterF = api.isOverWater ? api.isOverWater.bind(api) : (()=>false)
      const terr = (x, z) => { const v = terrF(x, z); return v === v ? v : 0 }
      const meshes = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || m.transparent) return
        meshes.push(o)
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
      const ray = new THREE.Raycaster(); ray.far = 3.2
      const dirs = []
      for (let a = 0; a < 8; a++) dirs.push(new THREE.Vector3(Math.cos(a*Math.PI/4), 0, Math.sin(a*Math.PI/4)))
      const res = new CANNON.RaycastResult()
      const pts = []
      let samples = 0, skipWater = 0
      for (let x = B[0]; x <= B[1]; x += 2.5) for (let z = B[2]; z <= B[3]; z += 2.5) {
        const ty = terr(x, z)
        if (waterF(x, z)) { skipWater++; continue }
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
          if (h.face && Math.abs(h.face.normal.y) > 0.75) continue   // floor/ceiling, not a wall
          const from = new CANNON.Vec3(x, y, z)
          const to = new CANNON.Vec3(x + d.x * (h.distance + 0.3), y, z + d.z * (h.distance + 0.3))
          res.reset()
          g.world.raycastClosest(from, to, { skipBackfaces: false }, res)
          if (res.hasHit) continue
          pts.push([Math.round(h.point.x), Math.round(h.point.y*10)/10, Math.round(h.point.z),
                    '#'+(Array.isArray(h.object.material)?h.object.material[0]:h.object.material).color.getHexString()])
        }
      }
      // cluster on a 6 m grid
      const cl = {}
      for (const p of pts) {
        const k = Math.round(p[0]/6)+'|'+Math.round(p[2]/6)
        if (!cl[k]) cl[k] = { n:0, x:0, y:0, z:0, col:p[3] }
        const c = cl[k]; c.n++; c.x+=p[0]; c.y+=p[1]; c.z+=p[2]
      }
      const rows = Object.values(cl).map(c => ({ n:c.n, x:Math.round(c.x/c.n), y:Math.round(c.y/c.n*10)/10, z:Math.round(c.z/c.n), col:c.col }))
        .sort((a,b)=>b.n-a.n)
      return { samples, skipWater, total: pts.length, clusters: rows.length, rows: rows.slice(0,30), bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wqsolid.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
