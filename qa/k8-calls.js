async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['kyoto','cali','rio','sahara']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(1200)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      for (let i=0;i<30;i++) g.tick(1/60,false)
      g.renderer.info.autoReset = false
      g.renderer.info.reset()
      g.renderer.render(g.scene, g.camera)
      const r = { calls: g.renderer.info.render.calls, tri: g.renderer.info.render.triangles }
      g.renderer.info.autoReset = true
      return r
    })
  }
  await page.evaluate((o) => fetch('/shot?name=k8calls.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
