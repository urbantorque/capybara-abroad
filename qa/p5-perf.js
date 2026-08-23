async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['pantanal','cave','antarctic','pasto','manly']) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await new Promise(r => setTimeout(r, 2500))
      const ts = []
      let last = performance.now()
      await new Promise(res => {
        let n2 = 0
        function step() {
          const now = performance.now()
          ts.push(now - last); last = now
          if (++n2 < 260) requestAnimationFrame(step); else res()
        }
        requestAnimationFrame(step)
      })
      ts.sort((a,b2) => a-b2)
      let tris = 0, calls = g.renderer.info.render.calls
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        tris += t * (o.isInstancedMesh ? (o.count||0) : 1)
      })
      return { med: +ts[Math.floor(ts.length*0.5)].toFixed(2), p95: +ts[Math.floor(ts.length*0.95)].toFixed(2),
               tris: Math.round(tris), bodies: g.world.bodies.length, calls }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p5perf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }) }, out)
}
