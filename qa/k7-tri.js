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
      const rows = []
      let tris = 0, inst = 0, plain = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        let t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        if (o.isInstancedMesh) { t *= o.count; inst++ } else plain++
        tris += t
        rows.push([Math.round(t), o.isInstancedMesh ? 'i'+o.count : 'm', o.name || (o.parent && o.parent.name) || ''])
      })
      rows.sort((a,b) => b[0]-a[0])
      g.renderer.info.reset()
      g.tick(1/60, true)
      const info = { calls: g.renderer.info.render.calls, tri: g.renderer.info.render.triangles }
      let fr = 0; const t0 = performance.now()
      for (let i=0;i<40;i++) g.tick(1/60, true)
      fr = (performance.now()-t0)/40
      return { tris: Math.round(tris), inst, plain, meshes: inst+plain, info,
               ms: Math.round(fr*100)/100, top: rows.slice(0,14) }
    })
  }
  await page.evaluate((o) => fetch('/shot?name=k7tri.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
