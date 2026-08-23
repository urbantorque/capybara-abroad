async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const name of ['manly','pantanal']) {
    await page.evaluate((n) => {
      const g = window.__capy
      g.biome.switchTo(n)
      const sp = g.biome.spawnOf(n), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, name)
    await page.waitForTimeout(2000)
    out[name] = await page.evaluate(() => {
      const g = window.__capy
      let tris = 0, meshes = 0, inst = 0
      const per = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        const tot = t * (o.isInstancedMesh ? (o.count||0) : 1)
        tris += tot
        if (o.isInstancedMesh) inst++
        if (tot > 1500) per.push([o.name || (o.isInstancedMesh?'inst':'mesh'), Math.round(tot), o.isInstancedMesh?o.count:1])
      })
      per.sort((a,b)=>b[1]-a[1])
      const locals = (g.npcs||[]).filter(r => r.biome === g.biome.current).length
      return { tris: Math.round(tris), meshes, inst, bodies: g.world.bodies.length,
               locals, biome: g.biome.current, top: per.slice(0,12),
               render: g.renderer.info.render.calls,
               err: g.state.lastError || null }
    })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=f1base.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) })
  }, out)
}
