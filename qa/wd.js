async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['venice','kowloon']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<60;i++) g.tick(1/60,false)
      const root = g.scene.getObjectByName(name)
      const rows = []
      if (root) root.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        rows.push({ n: o.name || (o.isInstancedMesh ? 'inst x'+o.count : 'mesh'),
                    t: Math.round(t * (o.isInstancedMesh ? o.count : 1)) })
      })
      rows.sort((a,b) => b.t - a.t)
      return rows.slice(0, 14)
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wd.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
