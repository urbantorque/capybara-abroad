async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = {}
  for (const n of ['venice','kowloon','rio','pasto','quay']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<90;i++) g.tick(1/60,false)
      let tris = 0, meshes = 0, inst = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        if (o.isInstancedMesh) inst++
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        tris += t * (o.isInstancedMesh ? o.count : 1)
      })
      g.tick(1/60, true)
      const t0 = performance.now()
      for (let i=0;i<30;i++) g.tick(1/60,true)
      const ft = (performance.now()-t0)/30
      const api = g[name]
      return { tris: Math.round(tris), meshes, inst, calls: g.renderer.info.render.calls,
               bodies: g.world.bodies.length, ft: +ft.toFixed(2),
               npcs: (g.npc && g.npc.count) ? g.npc.count(name) : null,
               lastError: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=w1base.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
