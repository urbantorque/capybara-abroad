async page => {
  // px-solid-walk: confirm audit hits with a REAL walk. For each target the
  // animal is teleported 2.2 m short of the drawn face, pointed at it (capy.face
  // so the auto-follow camera settles behind it and W walks along the ray),
  // then W is held for 1.6 s through playwright's real keyboard. The verdict is
  // how far along the walk direction the body centre got, against where the
  // drawn face was on the same line. Nothing writes body.velocity, so the
  // solver is honest.
  const TAG = 'W1'
  const TARGETS = [
    // { c:'quay', x:0, z:0, dx:1, dz:0, dg:1.5, id:'label' }
  ]
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms)
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await wait(6500)
  await page.keyboard.press('Digit1')
  await wait(5000)
  const rows = []
  let cur = null
  for (const t of TARGETS) {
    if (t.c !== cur) {
      await page.evaluate((name) => {
        const g = window.__capy
        if (g.biome.current !== name) g.biome.switchTo(name)
        const sp = g.biome.spawnOf(name), b = g.capy.body
        b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      }, t.c)
      await wait(2500)
      cur = t.c
    }
    // 1. park short of the face, pointed at it, let the camera settle behind
    await page.evaluate((t) => {
      const g = window.__capy
      const api = g[t.c] || (t.c === 'sydney' ? g.env : null)
      const terr = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
      const fx = t.x + t.dx * t.dg, fz = t.z + t.dz * t.dg
      const sx = fx - t.dx * 2.2, sz = fz - t.dz * 2.2
      const b = g.capy.body
      b.position.set(sx, terr(sx, sz) + 0.6, sz); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (g.capy.group) g.capy.group.position.copy(b.position)
      if (typeof g.capy.face === 'function') g.capy.face(Math.atan2(t.dx, t.dz))
    }, t)
    await wait(2400)
    // 2. read the camera, re-place on ITS line, measure the drawn/physics face
    const pre = await page.evaluate((t) => {
      const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
      const api = g[t.c] || (t.c === 'sydney' ? g.env : null)
      const terr = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
      const yaw = g.input.camYaw
      const wx = -Math.sin(yaw), wz = -Math.cos(yaw)
      const fx = t.x + t.dx * t.dg, fz = t.z + t.dz * t.dg
      const sx = fx - wx * 2.2, sz = fz - wz * 2.2
      const sy = terr(sx, sz) + 0.6
      const b = g.capy.body
      b.position.set(sx, sy, sz); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      if (g.capy.group) g.capy.group.position.copy(b.position)
      // drawn face along w from S at chest height
      const meshes = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || m.transparent) return
        if (g.capy.group && (o === g.capy.group || (o.parent && o.parent === g.capy.group))) return
        meshes.push(o)
      })
      const ray = new THREE.Raycaster(new THREE.Vector3(sx, sy, sz), new THREE.Vector3(wx, 0, wz), 0.5, 4.5)
      const its = ray.intersectObjects(meshes, false)
      let drawn = -1, dname = ''
      for (const it of its) {
        if (it.point.y <= terr(it.point.x, it.point.z) + 0.40) continue
        let p = it.object; const chain = []
        for (let q = p, k = 0; q && k < 5; q = q.parent, k++) if (q.name) chain.unshift(q.name)
        drawn = it.distance; dname = chain.join('/') || (it.object.geometry && it.object.geometry.type) || '?'
        break
      }
      const rr = new CANNON.RaycastResult()
      g.world.raycastClosest(new CANNON.Vec3(sx, sy, sz), new CANNON.Vec3(sx + wx * 4.5, sy, sz + wz * 4.5), { skipBackfaces: false }, rr)
      // the animal's own body is dynamic; ignore a hit on it
      let phys = rr.hasHit ? rr.distance : -1
      if (rr.hasHit && rr.body === b) phys = -2
      window.__pxWalk = { sx, sz, sy, wx, wz, samples: [] }
      const h = setInterval(() => {
        const p = g.capy.body.position
        window.__pxWalk.samples.push([Math.round(((p.x - sx) * wx + (p.z - sz) * wz) * 100) / 100, Math.round(p.y * 100) / 100])
        if (window.__pxWalk.samples.length > 40) clearInterval(h)
      }, 100)
      return { yaw: Math.round(yaw * 100) / 100, wx: Math.round(wx * 100) / 100, wz: Math.round(wz * 100) / 100,
               sx: Math.round(sx * 10) / 10, sz: Math.round(sz * 10) / 10, sy: Math.round(sy * 10) / 10,
               drawn: Math.round(drawn * 100) / 100, dname, phys: Math.round(phys * 100) / 100, biome: g.biome.current }
    }, t)
    await wait(150)
    await page.keyboard.down('KeyW')
    await wait(1600)
    await page.keyboard.up('KeyW')
    await wait(250)
    const post = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.body.position
      const W = window.__pxWalk || { sx: 0, sz: 0, wx: 0, wz: 0, samples: [] }
      const along = (p.x - W.sx) * W.wx + (p.z - W.sz) * W.wz
      const lat = (p.x - W.sx) * W.wz - (p.z - W.sz) * W.wx
      let maxAlong = along
      for (const s of W.samples) if (s[0] > maxAlong) maxAlong = s[0]
      return { along: Math.round(along * 100) / 100, lat: Math.round(lat * 100) / 100, maxAlong: Math.round(maxAlong * 100) / 100,
               y: Math.round(p.y * 100) / 100, ns: W.samples.length, err: g.state.lastError || '' }
    })
    let verdict = 'n/a'
    if (pre.drawn > 0) {
      if (post.maxAlong > pre.drawn + 0.45) verdict = 'THROUGH'
      else if (post.maxAlong > pre.drawn - 0.15) verdict = 'nose-in'
      else verdict = 'STOPPED'
    } else verdict = 'no-face-on-line'
    rows.push(Object.assign({ id: t.id, c: t.c, x: t.x, z: t.z, dx: t.dx, dz: t.dz, dg: t.dg }, pre, post, { verdict }))
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { tag: TAG, rows })
  await page.evaluate(s => fetch('/shot?name=px-solid-walk-W1.json', { method: 'POST', body: s }), bl)
}
