async page => {
  await page.reload(); await page.waitForTimeout(6000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['cave','antarctic','quay']) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await new Promise(r=>setTimeout(r,1500))
      const ts=[]
      for(let i=0;i<180;i++){ const t0=performance.now(); g.tick(1/60,true); ts.push(performance.now()-t0) }
      ts.sort((a,b)=>a-b)
      return { tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls,
               bodies: g.world.bodies.length,
               med:+ts[90].toFixed(2), p95:+ts[171].toFixed(2) }
    }, n)
  }
  await page.evaluate(async (o)=>{await fetch('/shot?name=jt.json',{method:'POST',body:btoa(JSON.stringify(o))})}, out)
}
