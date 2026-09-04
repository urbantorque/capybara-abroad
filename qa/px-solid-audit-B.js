async page => {
  // px-solid-audit: audit-solid.js reworked for the 3 Sep 2026 solidity audit.
  //  - every hit is kept (not the first 50), with the ray direction, the drawn
  //    face distance, the physics distance and the hit height, so a hit can be
  //    walked into afterwards;
  //  - the physics ray is cast 2.2 m PAST the drawn face and the gap between the
  //    two is recorded, so a collider recessed behind its drawn face ("solid,
  //    but not where you see it") shows up as class (b) rather than passing;
  //  - each chapter is sampled in x-strips of <= 8 s so no single evaluate
  //    outlives the ~20 s execution-context limit;
  //  - the result is tagged so two runs can be intersected offline (the audit
  //    drifts with time-of-day visibility toggles; only stable hits count).
  const TAG = 'B'
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms)
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await wait(6500)
  await page.keyboard.press('Digit1')
  await wait(5000)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi']
  const B = {
    sydney:[-80,80,-44,76], quay:[-150,290,-600,70], pasto:[-115,115,-115,115],
    kyoto:[-100,60,-70,215], cali:[-135,130,-110,70], iceland:[-120,130,-210,150],
    sahara:[-90,350,-110,100], drift:[-110,110,-180,60], venice:[-160,60,-80,60],
    kowloon:[-60,60,-170,70], palawan:[-80,80,-145,70], goreme:[-90,110,-120,70],
    rio:[-110,120,-70,100], manly:[-110,120,-90,90], pantanal:[-130,130,-130,110],
    cave:[-80,80,-200,80], antarctic:[-212,212,-500,122],
    monaco:[-145,180,-115,140], hanoi:[-135,80,-105,215]
  }
  const out = { tag: TAG, at: new Date().toISOString() }
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      if (g.biome.current !== name) g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await wait(1500)
    const bb = B[n]
    const NSTRIP = 12
    const w = (bb[1] - bb[0]) / NSTRIP
    const acc = { name: n, biome: null, sampled: 0, n: 0, objs: {}, hits: [], recessed: [], boxes: 0, ms: 0, timedOut: 0 }
    for (let s = 0; s < NSTRIP; s++) {
      const x0 = bb[0] + s * w, x1 = (s === NSTRIP - 1) ? bb[1] : bb[0] + (s + 1) * w - 1e-6
      const part = await page.evaluate((arg) => {
        const { name, x0, x1, z0, z1 } = arg
        const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
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
        const ray = new THREE.Raycaster(); ray.far = 2.6
        const rayD = new THREE.Raycaster(); rayD.far = 60
        const org = new THREE.Vector3(), dir = new THREE.Vector3()
        const orgD = new THREE.Vector3(), down = new THREE.Vector3(0,-1,0)
        const from = new CANNON.Vec3(), to = new CANNON.Vec3()
        const rr = new CANNON.RaycastResult()
        const DIRS = [[1,0],[-1,0],[0,1],[0,-1]]
        const STEP = 2.5, REACH = 2.5
        const hits = [], recessed = [], byObj = {}
        let sampled = 0, timedOut = 0
        const t0 = performance.now()
        outer:
        for (let x = x0; x <= x1; x += STEP) {
          for (let z = z0; z <= z1; z += STEP) {
            if (performance.now() - t0 > 9000) { timedOut = 1; break outer }
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
              if (it.point.y <= terr(it.point.x, it.point.z) + 0.40) continue
              const dg = it.distance
              from.set(x, y, z); to.set(x + dx*(dg+2.2), y, z + dz*(dg+2.2)); rr.reset()
              g.world.raycastClosest(from, to, { skipBackfaces: false }, rr)
              const pd = rr.hasHit ? rr.distance : -1
              const hx = x + dx*(dg+0.12), hz = z + dz*(dg+0.12)
              const base = terr(hx, hz)
              orgD.set(hx, base + 40, hz); rayD.set(orgD, down)
              const dits = rayD.intersectObjects(meshes, false)
              let topY = base
              for (const d of dits) { if (d.point.y > topY) { topY = d.point.y; break } }
              const h = topY - base
              if (h < 0.7) break
              const id = it.object.id
              let vh = ''; try { const ca = it.object.geometry.attributes.color; if (ca && it.face) { const cc = new THREE.Color(ca.getX(it.face.a), ca.getY(it.face.a), ca.getZ(it.face.a)); vh = cc.getHexString() } else if (it.object.material && it.object.material.color) vh = it.object.material.color.getHexString() } catch (e) {}
              const row = [Math.round(x), Math.round(z), Math.round(base*10)/10, Math.round(h*10)/10, id, dx, dz, Math.round(dg*100)/100, Math.round(pd*100)/100, Math.round(it.point.y*10)/10, vh]
              if (rr.hasHit) {
                // solid within 0.7 m of the face: pass. Further: recessed collider.
                if (pd - dg > 0.7) recessed.push(row)
                break
              }
              byObj[id] = (byObj[id]||0)+1
              hits.push(row)
              break
            }
          }
        }
        const objs = {}
        for (const k of Object.keys(byObj)) objs[k] = Object.assign({ hits: byObj[k] }, info[k])
        const rinfo = {}
        for (const r of recessed) if (!rinfo[r[4]]) rinfo[r[4]] = info[r[4]]
        return { biome: g.biome.current, sampled, hits, recessed, objs, rinfo, boxes: boxes.length, ms: Math.round(performance.now()-t0), timedOut }
      }, { name: n, x0, x1, z0: bb[2], z1: bb[3] })
      acc.biome = part.biome
      acc.sampled += part.sampled
      acc.boxes = part.boxes
      acc.ms += part.ms
      acc.timedOut += part.timedOut
      for (const h of part.hits) acc.hits.push(h)
      for (const r of part.recessed) acc.recessed.push(r)
      for (const k of Object.keys(part.objs)) {
        if (acc.objs[k]) acc.objs[k].hits += part.objs[k].hits
        else acc.objs[k] = part.objs[k]
      }
      acc.rinfo = Object.assign(acc.rinfo || {}, part.rinfo)
      await wait(120)
    }
    acc.n = acc.hits.length
    acc.nRecessed = acc.recessed.length
    out[n] = acc
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))), out)
  await page.evaluate(s => fetch('/shot?name=px-solid-audit-B.json', { method: 'POST', body: s }), bl)
}
