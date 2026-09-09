async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const list = (await page.evaluate(() => window.__qaCH || null)) || ['drift']
  const out = {}
  for (const n of list) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      let tris = 0, shadowTris = 0, meshes = 0
      const per = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)
        const tot = t * (o.isInstancedMesh ? o.count : 1)
        tris += tot
        if (o.castShadow) shadowTris += tot
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        per.push([nm, Math.round(tot), o.isInstancedMesh ? o.count : 1, Math.round(t), gm.type || '?'])
      })
      per.sort((a, b2) => b2[1] - a[1])
      return { tris: Math.round(tris), shadowTris: Math.round(shadowTris), meshes,
               top: per.slice(0, 16), err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-one.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
