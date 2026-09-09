async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['palawan','goreme','manly','pasto','venice','sydney']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.renderer.setSize(1600, 900, false)
      g.camera.aspect = 1600/900; g.camera.updateProjectionMatrix()
    }, n)
    await page.waitForTimeout(2500)   // real rAF frames, shaders compiled
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      const ts = []
      await new Promise(res => {
        let last = performance.now(), n = 0
        function step() {
          const t = performance.now(); ts.push(t - last); last = t; n++
          if (n < 150) requestAnimationFrame(step); else res()
        }
        requestAnimationFrame(step)
      })
      ts.sort((a,b)=>a-b)
      let tris = 0, meshes = 0
      g.scene.traverse(o => { if(!o.isMesh&&!o.isInstancedMesh) return
        for(let p=o;p;p=p.parent) if(!p.visible) return
        meshes++; const gm=o.geometry; if(!gm) return
        let t = gm.index?gm.index.count/3:(gm.attributes.position?gm.attributes.position.count/3:0)
        if(o.isInstancedMesh) t*=o.count; tris+=t })
      return { med: +ts[75].toFixed(2), p95: +ts[142].toFixed(2),
               tris: Math.round(tris), meshes, bodies: g.world.bodies.length,
               calls: g.renderer.info.render.calls, err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4perf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
