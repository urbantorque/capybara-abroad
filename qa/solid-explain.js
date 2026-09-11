async page => {
  // solid-explain: for a list of (biome, x, z, dx, dz) samples from
  // audit-solid2, say WHAT was hit — the vertex colour of the triangle (which
  // names the palette entry, which names the part of the builder), the hit
  // height, and every static collider AABB within 3 m of the hit point.
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const Q = {
    venice:   [[-154,-59,1,0],[-145,-77,0,1],[-139,-47,0,-1],[-19,-26,1,0],[-19,-17,1,0]],
    kowloon:  [[-6,-65,1,0],[-3,-65,-1,0],[3,-65,1,0],[-3,-62,0,-1],[0,-62,0,-1],[9,1,-1,0],[-9,-41,-1,0]],
    sahara:   [[195,-35,-1,0],[198,-35,0,1],[186,37,1,0],[192,10,0,-1],[-54,19,1,0],[-54,25,1,0],[-3,22,0,-1],[24,7,0,-1],[26,0,0,0],[26,14,0,0]],
    palawan:  [[-56,53,1,0],[-56,56,1,0],[-53,38,1,0]],
    manly:    [[-56,18,0,-1],[-50,18,0,-1],[-5,30,1,0],[1,30,1,0],[-17,27,1,0],[-14,27,0,-1],[-23,33,1,0],[-20,33,-1,0],[10,30,1,0],[13,33,0,-1],[-59,39,0,-1],[85,-24,0,1],[-2,30,1,0]],
    iceland:  [[-60,-72,0,1],[-60,-69,0,1],[-60,-57,0,1],[24,132,0,1],[24,135,0,1],[-51,-6,0,1],[81,129,1,0]],
    rio:      [[-65,-37,1,0],[-56,-34,1,0],[73,-34,-1,0],[-26,83,1,0],[-23,83,-1,0],[-98,80,1,0],[-95,80,-1,0],[-44,80,0,-1],[85,5,-1,0]],
    goreme:   [[-45,66,0,-1],[-42,66,0,-1],[-39,48,-1,0],[-21,12,0,1],[-9,12,0,1],[-6,6,1,0],[18,9,1,0],[21,6,0,1],[39,15,1,0],[-36,-102,1,0]],
    kyoto:    [[-19,38,1,0],[-4,170,0,1],[8,173,0,-1],[-4,8,0,-1],[8,14,1,0],[44,-25,0,1]],
    cali:     [[27,37,0,1],[27,40,0,1],[-24,64,0,-1],[-18,40,1,0],[-72,-41,0,1],[-60,-35,1,0]],
    pasto:    [[47,5,1,0],[50,5,-1,0],[68,-10,0,1],[70,-16,0,0],[76,22,0,0]],
    quay:     [[231,-498,1,0],[249,-510,1,0],[46,32,0,0]],
    drift:    [[-71,-147,0,-1],[-104,36,1,0],[-62,-87,0,-1],[10,-132,1,0],[-14,-84,0,1],[-7,25,0,0],[-11,39,0,0]],
    antarctic:[[-188,-437,0,-1],[-134,-431,1,0],[118,-419,0,-1],[175,-341,1,0]],
    pantanal: [[-112,-121,-1,0],[119,-37,0,-1]],
  }
  const out = {}
  for (const n of Object.keys(Q)) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(700)
    out[n] = await page.evaluate((arg) => {
      const name = arg.name, qs = arg.qs
      const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
      const api = g[name] || (name === 'sydney' ? g.env : null)
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
        boxes.push([lo.x, lo.y, lo.z, hi.x, hi.y, hi.z, b.type])
      }
      const ray = new THREE.Raycaster(); ray.far = 3.0
      const rayD = new THREE.Raycaster(); rayD.far = 60
      const org = new THREE.Vector3(), dir = new THREE.Vector3(), down = new THREE.Vector3(0,-1,0)
      const rows = []
      for (const [x, z, dx, dz] of qs) {
        const gy = terr(x, z), y = gy + 0.5
        const dirs = (dx || dz) ? [[dx, dz]] : [[1,0],[-1,0],[0,1],[0,-1]]
        for (const [ddx, ddz] of dirs) {
          org.set(x, y, z); dir.set(ddx, 0, ddz); ray.set(org, dir)
          const its = ray.intersectObjects(meshes, false)
          if (!its.length) { rows.push({ x, z, d: [ddx, ddz], hit: null }); continue }
          const it = its[0]
          const o = it.object
          let col = null
          if (o.geometry && o.geometry.attributes.color && it.face) {
            const c = o.geometry.attributes.color, f = it.face
            const r = (c.getX(f.a) + c.getX(f.b) + c.getX(f.c)) / 3
            const gg = (c.getY(f.a) + c.getY(f.b) + c.getY(f.c)) / 3
            const bb = (c.getZ(f.a) + c.getZ(f.b) + c.getZ(f.c)) / 3
            // vertex colours are linear-ish here; report both raw and sRGB-hex
            const hx = v => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1/2.2) * 255).toString(16).padStart(2, '0')
            col = '#' + hx(r) + hx(gg) + hx(bb)
          } else if (o.material && o.material.color) col = '#' + o.material.color.getHexString()
          const hx2 = it.point.x, hz2 = it.point.z
          const base = terr(hx2 + ddx * 0.12, hz2 + ddz * 0.12)
          org.set(hx2 + ddx * 0.12, base + 40, hz2 + ddz * 0.12); rayD.set(org, down)
          const dits = rayD.intersectObjects(meshes, false)
          let top = base, topName = ''
          if (dits.length) { top = dits[0].point.y; topName = dits[0].object.name || dits[0].object.geometry.type }
          let nm = o.name || '', q = o.parent, guard = 0
          while (q && guard++ < 6) { if (q.name) nm = nm ? (q.name + '/' + nm) : q.name; q = q.parent }
          const near = []
          for (const b of boxes) {
            const cx = Math.max(b[0], Math.min(hx2, b[3])), cz = Math.max(b[2], Math.min(hz2, b[5]))
            const dd = Math.hypot(cx - hx2, cz - hz2)
            if (dd < 3 && b[4] > gy + 0.2 && b[1] < gy + 1.5) near.push([Math.round(dd*100)/100, b.slice(0,6).map(v => Math.round(v*10)/10), b[6]])
          }
          near.sort((a, b) => a[0] - b[0])
          rows.push({ x, z, d: [ddx, ddz], gy: Math.round(gy*100)/100, dist: Math.round(it.distance*100)/100,
                      at: [Math.round(hx2*10)/10, Math.round(it.point.y*100)/100, Math.round(hz2*10)/10],
                      col, mesh: nm || o.type, geo: o.geometry.type, inst: !!o.isInstancedMesh,
                      h: Math.round((top - base)*10)/10, topName, near: near.slice(0, 4) })
        }
      }
      return rows
    }, { name: n, qs: Q[n] })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=solidexplain.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
