async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    const r = {}
    const inst = (pred) => { let m = null; g.scene.traverse(o => { if (!m && o.isInstancedMesh && pred(o)) m = o }); return m }
    const place = (x, y, z, vx, vz) => { const b = g.capy.body
      b.position.set(x, y, z); b.velocity.set(vx || 0, 0, vz || 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }

    g.biome.switchTo('kyoto')
    for (let i = 0; i < 40; i++) g.tick(1/60, false)
    const k = g.kyoto
    // ---- topple a lantern: kyoLANTERNS[0] is (-18, 18) -------------------
    for (let i = 0; i < 90; i++) { place(-18 + 1.0 - i * 0.02, k.terrainHeight(-18, 18) + 0.5, 18, -4.2, 0); g.tick(1/60, false) }
    // ---- and wreck the gravel -------------------------------------------
    const z0 = k.zen
    for (let i = 0; i < 400; i++) {
      const t = i / 400
      place(z0.x - 10 + t * 20, k.terrainHeight(z0.x, z0.z) + 0.5, z0.z + Math.sin(t * 9) * 5, 3.0, 1.0)
      g.tick(1/60, false)
    }
    const tracks = () => { const m = inst(o => o.count === 26 && o.material && !o.material.vertexColors && o.geometry.attributes.position.count === 4); if (!m) return -1
      const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
      let n = 0; for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mm); mm.decompose(p,q,s); if (p.y > -500) n++ }
      return n }
    const lantern = () => { const m = inst(o => o.count === 9); if (!m) return null
      const mm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
      m.getMatrixAt(0, mm); mm.decompose(p,q,s)
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ')
      return { x: Math.round(p.x*10)/10, z: Math.round(p.z*10)/10,
               tip: Math.round(Math.max(Math.abs(e.x), Math.abs(e.z))*100)/100 } }
    r.afterWreck = { tracks: tracks(), lantern: lantern(), done: g.hud.isTaskDone('lantern-topple') }
    // ---- leave and come back --------------------------------------------
    g.biome.switchTo('cali'); for (let i = 0; i < 20; i++) g.tick(1/60, false)
    g.biome.switchTo('kyoto'); for (let i = 0; i < 20; i++) g.tick(1/60, false)
    r.afterReturn = { tracks: tracks(), lantern: lantern(), done: g.hud.isTaskDone('lantern-topple') }
    return r
  })
  await page.evaluate((o) => fetch('/shot?name=kcverify.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
