async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['sydney','rio','drift','venice','kowloon']) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      await sleep(1200)
      const t = []
      let prev = performance.now()
      for (let i = 0; i < 140; i++) {
        await new Promise(r => requestAnimationFrame(r))
        const now = performance.now()
        t.push(now - prev); prev = now
      }
      t.sort((a,b2)=>a-b2)
      let tris = 0, meshes = 0
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh)) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry; if (!gm) return
        const c = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        tris += c * (o.isInstancedMesh ? o.count : 1)
      })
      return { med: +t[70].toFixed(2), p90: +t[126].toFixed(2), tris: Math.round(tris), meshes,
               bodies: g.world.bodies.length }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=s3perf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
