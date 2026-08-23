async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['palawan','goreme','manly','pasto','venice']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    }, n)
    await page.waitForTimeout(900)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const api = g[name] || {}
      const terr = typeof api.terrainHeight === 'function' ? api.terrainHeight : null
      const rows = []
      // the locals live on npcs.locals? they are private; find their figures in the scene
      // instead: a local figure is a Group parented to the scene with a head Object3D
      g.scene.traverse(o => {
        if (!o.isGroup || o.parent !== g.scene) return
        if (!o.visible) return
        // a local figure is exactly 8 children: legs x2, torso, collar, head, armL, armR
        if (o.children.length < 6 || o.children.length > 9) return
        let boxes = 0
        for (const c of o.children) if (c.isMesh) boxes++
        if (boxes < 3) return
        const t = terr ? terr(o.position.x, o.position.z) : 0
        rows.push({ x: +o.position.x.toFixed(1), y: +o.position.y.toFixed(2),
                    z: +o.position.z.toFixed(1), terr: +t.toFixed(2),
                    off: +(o.position.y - t).toFixed(2) })
      })
      return rows
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4locals.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
