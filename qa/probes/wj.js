async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['venice','kowloon','rio','pasto','sydney']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<90;i++) g.tick(1/60,false)
      g.renderer.info.autoReset = false
      g.renderer.info.reset()
      g.tick(1/60, true)
      const r = { calls: g.renderer.info.render.calls, tri: g.renderer.info.render.triangles }
      g.renderer.info.autoReset = true
      return r
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wj.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
