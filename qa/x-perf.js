async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const b of ['pantanal','cave','antarctic','pasto','sydney']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const s = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(s.x, s.y, s.z); cb.velocity.set(0,0,0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
    }, b)
    await page.waitForTimeout(2500)
    out[b] = await page.evaluate(() => new Promise(res => {
      const g = window.__capy
      const t = []
      let last = performance.now(), n = 0
      const step = () => {
        const now = performance.now()
        t.push(now - last); last = now
        if (++n < 200) requestAnimationFrame(step)
        else { t.sort((a,b)=>a-b); res({ med: +t[100].toFixed(2), p95: +t[189].toFixed(2), max: +t[199].toFixed(2),
                                          calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }) }
      }
      requestAnimationFrame(step)
    }))
  }
  await page.evaluate(async (o)=>{ await fetch('/shot?name=xperf.json',{method:'POST',body:btoa(JSON.stringify(o))}) }, out)
}
