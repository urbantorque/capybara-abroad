async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of ALL) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      window.__pf = []
      window.__pfOn = true
    }, n)
    // let rAF run for real: this is the only way the number means anything
    await page.evaluate(() => new Promise(res => {
      const t = []
      let last = performance.now(), n = 0
      function step(now) {
        t.push(now - last); last = now; n++
        if (n < 200) requestAnimationFrame(step)
        else { window.__pf = t; res() }
      }
      requestAnimationFrame(step)
    }))
    out[n] = await page.evaluate(() => {
      const t = window.__pf.slice(20).sort((a, b) => a - b)   // drop the switch-in
      const q = p => +t[Math.min(t.length - 1, Math.floor(t.length * p))].toFixed(2)
      const mean = +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(2)
      const g = window.__capy
      let calls = 0, tris = 0
      if (g.renderer && g.renderer.info) {
        calls = g.renderer.info.render.calls; tris = g.renderer.info.render.triangles
      }
      return { n: t.length, mean, p50: q(0.5), p95: q(0.95), worst: q(0.999),
               drawCalls: calls, drawnTris: tris }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-perf.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
