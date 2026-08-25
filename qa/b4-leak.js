async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = await page.evaluate(() => {
    const g = window.__capy
    // Which top-level scene children are visible, and what do they cost?
    const roots = () => {
      const rows = []
      for (const c of g.scene.children) {
        let tris = 0, meshes = 0, vis = 0
        c.traverse(o => {
          if (!o.isMesh && !o.isInstancedMesh) return
          meshes++
          let shown = true
          for (let p = o; p; p = p.parent) if (!p.visible) { shown = false; break }
          if (!shown) return
          vis++
          const gm = o.geometry; if (!gm) return
          const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0)
          tris += t * (o.isInstancedMesh ? o.count : 1)
        })
        if (meshes) rows.push([c.name || c.type, c.visible, Math.round(tris), vis, meshes])
      }
      rows.sort((a, b) => b[2] - a[2])
      return rows
    }
    const R = { title: roots() }
    const park = name => {
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    }
    park('quay'); R.quay = roots()
    park('antarctic'); R.antarctic = roots()
    R.err = g.state.lastError || null
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-leak.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
