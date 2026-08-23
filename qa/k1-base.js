async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['kyoto','cali']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1500)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      let tris = 0, meshes = 0, drawish = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        let t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        if (o.isInstancedMesh) t *= o.count
        tris += t; meshes++
        drawish += o.isInstancedMesh ? 1 : 1
      })
      const locals = (g.locals||[]).filter(l => !l.biome || l.biome === g.biome.current)
      return { tris: Math.round(tris), meshes, draws: drawish,
               bodies: g.world.bodies.length,
               npcs: (g.npcs||[]).length,
               localsAll: (g.locals||[]).length,
               current: g.biome.current }
    })
  }
  await page.evaluate((o) => fetch('/shot?name=k1base.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }), out)
}
