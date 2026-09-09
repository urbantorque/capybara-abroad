async page => {
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ['cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(800)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
      const B = {
        sydney:[-80,80,-44,76], quay:[-150,290,-600,70], pasto:[-115,115,-115,115],
        kyoto:[-100,60,-70,215], cali:[-135,130,-110,70], iceland:[-120,130,-210,150],
        sahara:[-90,350,-110,100], drift:[-110,110,-180,60], venice:[-160,60,-80,60],
        kowloon:[-60,60,-170,70], palawan:[-80,80,-145,70], goreme:[-90,110,-120,70],
        rio:[-110,120,-70,100], manly:[-110,120,-90,90], pantanal:[-130,130,-130,110],
        cave:[-80,80,-200,80], antarctic:[-212,212,-500,122]
      }[name]
      const api = g[name] || (name === 'sydney' ? g.env : null)
      const water = api && typeof api.isOverWater === 'function' ? api.isOverWater.bind(api) : null
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
          bb: bb2 ? [Math.round(bb2.min.x), Math.round(bb2.min.y), Math.round(bb2.min.z),
                     Math.round(bb2.max.x), Math.round(bb2.max.y), Math.round(bb2.max.z)] : null,
          col: o.material && o.material.color ? '#' + o.material.color.getHexString() : '',
          tris: gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0),
          r: gm && gm.boundingSphere ? Math.round(gm.boundingSphere.radius) : 0 }
      })
      // static collider AABBs, so a sample point INSIDE a wall can be skipped:
      // cannon's raycast reports no hit for a ray that starts inside a box, so
      // an origin buried in a façade reads as "drawn but not solid" when it is
      // in fact the most solid place in the world.
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
      const inSolid = (x, y, z) => {
        for (const b of boxes) if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) return true
        return false
      }
      const ray = new THREE.Raycaster(); ray.far = 2.6
      const rayD = new THREE.Raycaster(); rayD.far = 60
      const org = new THREE.Vector3(), dir = new THREE.Vector3()
      const orgD = new THREE.Vector3(), down = new THREE.Vector3(0,-1,0)
      const from = new CANNON.Vec3(), to = new CANNON.Vec3()
      const rr = new CANNON.RaycastResult()
      const DIRS = [[1,0],[-1,0],[0,1],[0,-1]]
      const STEP = 5, REACH = 2.5
      const hits = [], byObj = {}
      let sampled = 0
      const t0 = performance.now()
      outer:
      for (let x = B[0]; x <= B[1]; x += STEP) {
        for (let z = B[2]; z <= B[3]; z += STEP) {
          if (performance.now() - t0 > 40000) break outer
          if (water && water(x, z)) continue
          const gy = terr(x, z)
          sampled++
          const y = gy + 0.55
          if (inSolid(x, y, z)) continue
          for (const [dx, dz] of DIRS) {
            org.set(x, y, z); dir.set(dx, 0, dz); ray.set(org, dir)
            const its = ray.intersectObjects(meshes, false)
            if (!its.length) continue
            const it = its[0]
            if (it.distance > REACH) continue
            // is what we hit the GROUND ITSELF? a slope read at chest height is
            // terrain, not a structure, and cannon's heightfield raycast is not
            // reliable enough to be the arbiter of that.
            if (it.point.y <= terr(it.point.x, it.point.z) + 0.40) continue
            const dg = it.distance
            from.set(x, y, z); to.set(x + dx*(dg+0.7), y, z + dz*(dg+0.7)); rr.reset()
            g.world.raycastClosest(from, to, { skipBackfaces: false }, rr)
            if (rr.hasHit) continue
            const hx = x + dx*(dg+0.12), hz = z + dz*(dg+0.12)
            const base = terr(hx, hz)
            orgD.set(hx, base + 40, hz); rayD.set(orgD, down)
            const dits = rayD.intersectObjects(meshes, false)
            let topY = base
            for (const d of dits) { if (d.point.y > topY) { topY = d.point.y; break } }
            const h = topY - base
            if (h < 1.6) break
            const id = it.object.id
            byObj[id] = (byObj[id]||0)+1
            hits.push([Math.round(x), Math.round(z), Math.round(base*10)/10, Math.round(h*10)/10, id])
            break
          }
        }
      }
      const objs = {}
      for (const k of Object.keys(byObj)) objs[k] = Object.assign({ hits: byObj[k] }, info[k])
      return { sampled, n: hits.length, objs, boxes: boxes.length, sample: hits.slice(0, 50), ms: Math.round(performance.now()-t0) }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=jsolid.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
