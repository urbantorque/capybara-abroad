async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ['quay','kyoto','cali']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE
      const B = { quay:[-150,290,-600,70], kyoto:[-100,60,-70,215], cali:[-135,130,-110,70] }[name]
      const api = g[name]
      const water = api && typeof api.isOverWater === 'function' ? api.isOverWater.bind(api) : null
      const terrF = api && typeof api.terrainHeight === 'function' ? api.terrainHeight.bind(api) : null
      const terr = (x, z) => { if (!terrF) return 0; const v = terrF(x, z); return v === v ? v : 0 }
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
      const inBox = (x, y, z) => {
        for (const q of boxes) if (x > q[0]-0.05 && x < q[3]+0.05 && y > q[1]-0.05 && y < q[4]+0.05 && z > q[2]-0.05 && z < q[5]+0.05) return true
        return false
      }
      const ray = new THREE.Raycaster()
      ray.far = 2.0
      const dirs = []
      for (let i = 0; i < 8; i++) dirs.push(new THREE.Vector3(Math.cos(i*Math.PI/4), 0, Math.sin(i*Math.PI/4)))
      const cells = {}
      let tested = 0, total = 0
      for (let x = B[0]; x <= B[1]; x += 4) {
        for (let z = B[2]; z <= B[3]; z += 4) {
          if (water && water(x, z)) continue
          const gy = terr(x, z)
          const y = gy + 0.45
          if (inBox(x, y, z)) continue
          tested++
          for (const d of dirs) {
            ray.set(new THREE.Vector3(x, y, z), d)
            const rs = ray.intersectObjects(meshes, false)
            for (const r of rs) {
              if (r.distance > 1.4) break
              if (inBox(r.point.x, r.point.y, r.point.z)) break
              total++
              const key = Math.round(r.point.x/12)*12 + '|' + Math.round(r.point.z/12)*12
              const c = cells[key] || (cells[key] = { n:0, x:0, z:0, y:0, col:'' })
              c.n++; c.x = Math.round(r.point.x); c.z = Math.round(r.point.z); c.y = Math.round(r.point.y*10)/10
              const mm = Array.isArray(r.object.material)?r.object.material[0]:r.object.material
              c.col = mm && mm.color ? '#'+mm.color.getHexString() : ''
              c.mat = mm && mm.vertexColors ? 'vc' : 'flat'
              break
            }
          }
        }
      }
      const arr = Object.keys(cells).map(k => cells[k]).sort((a,b) => b.n - a.n)
      return { tested, total, cells: arr.length, top: arr.slice(0, 24), bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate((o) => {
    return fetch('/shot?name=s2solid.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
