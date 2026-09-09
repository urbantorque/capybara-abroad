async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    g.biome.switchTo('kowloon')
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    o.biome = g.biome.current
    // the pools on the tarmac: measure the drawn geometry, not the source
    let mesh = null
    g.scene.traverse(m => { if (m.name === 'hkGlow' || m === (g.kowloon && g.kowloon.glowMesh)) mesh = m })
    if (!mesh) {
      // find it by shape: a big additive basic mesh sitting just above the road
      g.scene.traverse(m => {
        if (!m.isMesh || !m.material) return
        const mt = m.material
        if (mt.blending === 2 && mt.transparent && Math.abs(m.position.y - 0.05) < 0.001) mesh = m
      })
    }
    if (mesh) {
      const p = mesh.geometry.attributes.position
      const bb = new (window.THREE ? window.THREE.Box3 : Object)()
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i)
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
      }
      o.glow = { name: mesh.name, verts: p.count, tris: p.count / 3 | 0,
                 spanX: +(maxX - minX).toFixed(1), spanZ: +(maxZ - minZ).toFixed(1),
                 y: mesh.position.y, opacity: mesh.material.opacity }
    } else o.glow = null
    // the animal on the carriageway, where the arrival camera looks
    const b = g.capy.body
    const sp = g.biome.spawnOf('kowloon')
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0; g.input.action = false
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false)
    o.spawn = [+sp.x.toFixed(1), +sp.y.toFixed(1), +sp.z.toFixed(1)]
    o.cam = [+g.camera.position.x.toFixed(1), +g.camera.position.y.toFixed(1), +g.camera.position.z.toFixed(1)]
    o.err = g.state.lastError || null
    return o
  })
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-hk1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
  await page.waitForTimeout(2500)
}
