async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['drift','venice','kowloon','pasto','rio']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1600)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      let tris = 0, meshes = 0, inst = 0, mats = new Set()
      g.scene.traverse(o => {
        if (!o.visible) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        if (o.isInstancedMesh) { inst++; const gg=o.geometry; const c = gg.index? gg.index.count/3 : gg.attributes.position.count/3; tris += c*o.count; mats.add(o.material.uuid) }
        else if (o.isMesh) { meshes++; const gg=o.geometry; const c = gg.index? gg.index.count/3 : gg.attributes.position.count/3; tris += c; mats.add(Array.isArray(o.material)?o.material[0].uuid:o.material.uuid) }
      })
      const npcs = (g.npcs||[]).filter(r => r.biome === g.biome.current)
      return { tris: Math.round(tris), meshes, inst, mats: mats.size, bodies: g.world.bodies.length,
               npcs: npcs.length, npcKinds: npcs.map(r=>r.kind||r.type||'?'),
               err: g.state && g.state.lastError || null,
               calls: g.renderer.info.render.calls }
    })
  }
  await page.evaluate(async (o) => { const s = btoa(unescape(encodeURIComponent(JSON.stringify(o)))); await fetch('/shot?name=t4base.json', {method:'POST', body:s}) }, out)
}
