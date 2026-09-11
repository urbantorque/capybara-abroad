async page => {
  // audit-solid2: the waist-high version of audit-solid.
  //
  // audit-solid keeps only drawn-but-not-collided things that stand 1.6 m or
  // taller, which is what separates a building from a tuft of grass. It is
  // also what let a one-metre riverside parapet in Cali through, which the
  // player walked into and then through. The capybara is three 0.34 m spheres:
  // anything whose top is more than solidRISE (0.62 m) over the ground is a
  // wall to it, and this pass keeps everything from 0.7 m up, banded.
  //
  // Two passes per chapter:
  //   rays  — the same chest-height cross as audit-solid on a 3 m grid, with
  //           the height floor at 0.7 m and each hit reported with its sample
  //           point so it can be walked to.
  //   inst  — every InstancedMesh, every instance: world AABB from the
  //           instance matrix, and a thing that stands on the ground, is at
  //           least 0.25 m thick and at least 0.7 m tall is checked for ANY
  //           static collider under its footprint at ground + 0.5. This does
  //           not depend on a ray happening to cross a 0.4 m trunk.
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi']
  const only = null   // e.g. ['cali'] to run one
  const out = {}
  for (const n of names) {
    if (only && only.indexOf(n) < 0) continue
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
        cave:[-80,80,-200,80], antarctic:[-212,212,-500,122],
        monaco:[-145,180,-115,140], hanoi:[-135,80,-105,215]
      }[name]
      const api = g[name] || (name === 'sydney' ? g.env : null)
      const water = api && typeof api.isOverWater === 'function' ? api.isOverWater.bind(api) : null
      const terrF = api && typeof api.terrainHeight === 'function' ? api.terrainHeight.bind(api) : null
      const terr = (x, z) => { if (!terrF) return 0; const v = terrF(x, z); return v === v ? v : 0 }
      const meshes = [], info = {}, insts = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || m.transparent) return
        meshes.push(o)
        if (o.isInstancedMesh) insts.push(o)
        const gm = o.geometry
        if (gm && !gm.boundingSphere) gm.computeBoundingSphere()
        let nm = o.name || '', q = o.parent, guard = 0
        while (q && guard++ < 6) { if (q.name) nm = nm ? (q.name + '/' + nm) : q.name; q = q.parent }
        const bb2 = gm ? (gm.boundingBox || (gm.computeBoundingBox(), gm.boundingBox)) : null
        o.updateWorldMatrix(true, false)
        const wp = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)
        info[o.id] = { name: nm || o.type, geo: (gm && gm.type) || '?',
          wat: [Math.round(wp.x * 10) / 10, Math.round(wp.y * 10) / 10, Math.round(wp.z * 10) / 10],
          inst: !!o.isInstancedMesh, cnt: o.count || 0,
          bb: bb2 ? [Math.round(bb2.min.x), Math.round(bb2.min.y), Math.round(bb2.min.z),
                     Math.round(bb2.max.x), Math.round(bb2.max.y), Math.round(bb2.max.z)] : null,
          col: o.material && o.material.color ? '#' + o.material.color.getHexString() : '',
          tris: gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0),
          r: gm && gm.boundingSphere ? Math.round(gm.boundingSphere.radius) : 0 }
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
      const inSolid = (x, y, z) => {
        for (const b of boxes) if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) return true
        return false
      }
      const inB = (x, z) => x >= B[0] && x <= B[1] && z >= B[2] && z <= B[3]
      const t0 = performance.now()

      // ---- pass 1: instances, analytically --------------------------------
      const instRep = {}
      const M = new THREE.Matrix4(), W = new THREE.Matrix4(), bx = new THREE.Box3()
      for (const o of insts) {
        const gm = o.geometry
        const gb = gm.boundingBox || (gm.computeBoundingBox(), gm.boundingBox)
        const rep = { cand: 0, bad: 0, exMin: 99, exMax: 0, hMin: 99, hMax: 0, sample: [] }
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, M)
          W.multiplyMatrices(o.matrixWorld, M)
          bx.copy(gb).applyMatrix4(W)
          const cx = (bx.min.x + bx.max.x) / 2, cz = (bx.min.z + bx.max.z) / 2
          if (!inB(cx, cz)) continue
          const ex = (bx.max.x - bx.min.x) / 2, ez = (bx.max.z - bx.min.z) / 2
          const th = Math.min(ex, ez)
          if (th < 0.25) continue                      // a blade, a post thinner than a leg
          if (th > 60) continue                        // a sky or a sea
          const base = terr(cx, cz)
          const h = bx.max.y - base
          if (h < 0.7) continue                        // steppable
          if (bx.min.y > base + 0.45) continue         // hanging: a canopy, a sign, a roof
          if (bx.max.y - bx.min.y < 0.5) continue      // a plate
          if (water && water(cx, cz)) continue
          rep.cand++
          if (inSolid(cx, base + 0.5, cz)) continue
          rep.bad++
          rep.exMin = Math.min(rep.exMin, th); rep.exMax = Math.max(rep.exMax, th)
          rep.hMin = Math.min(rep.hMin, h); rep.hMax = Math.max(rep.hMax, h)
          if (rep.sample.length < 6) rep.sample.push([Math.round(cx), Math.round(cz), Math.round(th*100)/100, Math.round(h*10)/10])
        }
        if (rep.cand) instRep[o.id] = Object.assign(rep, info[o.id])
      }
      const msInst = Math.round(performance.now() - t0)

      // ---- pass 2: rays ----------------------------------------------------
      const ray = new THREE.Raycaster(); ray.far = 2.6
      const rayD = new THREE.Raycaster(); rayD.far = 60
      const org = new THREE.Vector3(), dir = new THREE.Vector3()
      const orgD = new THREE.Vector3(), down = new THREE.Vector3(0,-1,0)
      const from = new CANNON.Vec3(), to = new CANNON.Vec3()
      const rr = new CANNON.RaycastResult()
      const DIRS = [[1,0],[-1,0],[0,1],[0,-1]]
      const STEP = 3, REACH = 2.5, EYE = 0.5, HMIN = 0.7
      const hits = [], byObj = {}
      let sampled = 0
      const t1 = performance.now()
      outer:
      for (let x = B[0]; x <= B[1]; x += STEP) {
        for (let z = B[2]; z <= B[3]; z += STEP) {
          if (performance.now() - t1 > 80000) break outer
          if (water && water(x, z)) continue
          const gy = terr(x, z)
          sampled++
          const y = gy + EYE
          if (inSolid(x, y, z)) continue
          for (const [dx, dz] of DIRS) {
            org.set(x, y, z); dir.set(dx, 0, dz); ray.set(org, dir)
            const its = ray.intersectObjects(meshes, false)
            if (!its.length) continue
            const it = its[0]
            if (it.distance > REACH) continue
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
            if (h < HMIN) break
            const id = it.object.id
            const k = byObj[id] || (byObj[id] = { n: 0, waist: 0, tall: 0, pts: [] })
            k.n++
            if (h < 1.6) k.waist++; else k.tall++
            if (k.pts.length < 8) k.pts.push([Math.round(x), Math.round(z), dx, dz, Math.round(dg*10)/10, Math.round(h*10)/10])
            hits.push(id)
            break
          }
        }
      }
      const objs = {}
      for (const k of Object.keys(byObj)) objs[k] = Object.assign({}, byObj[k], info[k])
      return { sampled, n: hits.length, objs, inst: instRep, boxes: boxes.length,
               msInst, msRay: Math.round(performance.now() - t1) }
    }, n)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=auditsolid2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
