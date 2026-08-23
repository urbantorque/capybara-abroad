async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const names = __NAMES__
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const s = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(s.x, s.y, s.z); cb.velocity.set(0,0,0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
    }, n)
    await page.waitForTimeout(2600)
    const counts = await page.evaluate(() => {
      const g = window.__capy
      let tris = 0, meshes = 0, inst = 0
      const snap = []
      g.scene.traverse(o => {
        for (let p = o; p; p = p.parent) if (!p.visible) return
        if (o !== g.capy.group) snap.push([o, o.position.x, o.position.y, o.position.z])
        if (!o.isMesh && !o.isInstancedMesh) return
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        const c = o.isInstancedMesh ? (o.count||0) : 1
        tris += t*c; meshes++; if (o.isInstancedMesh) inst += c
      })
      window.__snap = snap
      return { ktris: Math.round(tris/1000), meshes, inst, objs: snap.length,
               npcs: (g.npcs||[]).length, props: (g.props||[]).length,
               bodies: (g.world && g.world.bodies ? g.world.bodies.length : 0) }
    })
    const perf = await page.evaluate(() => new Promise(res => {
      const g = window.__capy, t = []
      let last = performance.now(), i = 0
      const step = () => {
        const now = performance.now(); t.push(now-last); last = now
        if (++i < 150) requestAnimationFrame(step)
        else { t.sort((a,b)=>a-b)
               res({ med:+t[75].toFixed(2), p95:+t[142].toFixed(2), max:+t[149].toFixed(2),
                     calls:g.renderer.info.render.calls, dtris:Math.round(g.renderer.info.render.triangles/1000) }) }
      }
      requestAnimationFrame(step)
    }))
    await page.waitForTimeout(2200)
    const life = await page.evaluate(() => {
      let moved = 0
      for (const [o,x,y,z] of window.__snap) {
        if (Math.abs(o.position.x-x)+Math.abs(o.position.y-y)+Math.abs(o.position.z-z) > 0.03) moved++
      }
      const g = window.__capy
      return { moved, lastError: g.state.lastError || null }
    })
    out[n] = Object.assign({}, counts, perf, life)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=__OUT__', { method:'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
