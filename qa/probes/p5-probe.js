async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const name of ['pantanal','cave','antarctic']) {
    await page.evaluate((n) => {
      const g = window.__capy
      g.biome.switchTo(n)
      const sp = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, name)
    await page.waitForTimeout(1500)
    out[name] = await page.evaluate(() => {
      const g = window.__capy
      let tris = 0, meshes = 0, inst = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        tris += t * (o.isInstancedMesh ? (o.count||0) : 1)
        if (o.isInstancedMesh) inst++
      })
      const locals = (g.npcs||[]).filter(r => r.biome === g.biome.current).length
      return { tris: Math.round(tris), meshes, inst, bodies: g.world.bodies.length,
               locals, biome: g.biome.current,
               render: g.renderer.info.render.calls,
               err: g.state.lastError || null }
    })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p5probe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) })
  }, out)
}
