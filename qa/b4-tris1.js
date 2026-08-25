async page => {
  const NAME = 'quay'
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate((name) => {
    const g = window.__capy
    const count = () => {
      let tris = 0, meshes = 0
      const per = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)
        const tot = t * (o.isInstancedMesh ? o.count : 1)
        tris += tot
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        per.push([nm, Math.round(tot), o.isInstancedMesh ? o.count : 1, Math.round(t), gm.type || '?'])
      })
      per.sort((a, b) => b[1] - a[1])
      return { tris: Math.round(tris), meshes, top: per.slice(0, 20) }
    }
    const atTitle = count()
    g.biome.switchTo(name)
    const sp = g.biome.spawnOf(name), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const after = count()
    return { name, atTitleTris: atTitle.tris, atTitleMeshes: atTitle.meshes,
             atTitleTop: atTitle.top.slice(0, 8), after, err: g.state.lastError || null }
  }, NAME)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-tris1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
