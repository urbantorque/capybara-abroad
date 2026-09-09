async page => {
  await page.reload(); await page.waitForTimeout(5200)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['sydney','pasto','cave','antarctic']) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      await sleep(2500)
      const ts = []
      let last = performance.now()
      const t0 = performance.now()
      while (performance.now() - t0 < 6000) {
        await new Promise(r => requestAnimationFrame(r))
        const now = performance.now(); ts.push(now - last); last = now
      }
      ts.sort((a,b2)=>a-b2)
      let tris = 0, meshes = 0
      g.scene.traverse(o => { if (!o.isMesh && !o.isInstancedMesh) return
        for (let p=o;p;p=p.parent) if(!p.visible) return
        meshes++
        const gm=o.geometry; if(!gm) return
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position?gm.attributes.position.count/3:0)
        tris += t * (o.isInstancedMesh ? o.count : 1) })
      return { median: +ts[(ts.length*0.5)|0].toFixed(2), p95: +ts[(ts.length*0.95)|0].toFixed(2),
               tris: Math.round(tris), meshes, bodies: g.world.bodies.length,
               calls: g.renderer.info.render.calls, err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=bgperf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
