async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = {}
  for (const n of ['palawan','goreme','pasto']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      window.__fr = []
      window.__s = performance.now()
      window.__h = (t) => {
        const now = performance.now()
        window.__fr.push(now - window.__s); window.__s = now
      }
      const old = g.renderer.render.bind(g.renderer)
      window.__samp = setInterval(() => window.__h(), 0)
    }, n)
    await page.waitForTimeout(1000)
    await page.evaluate(() => { clearInterval(window.__samp); window.__fr = []; })
    // measure real rAF frame times over 8 s
    await page.evaluate(() => new Promise(res => {
      const fr = []
      let last = performance.now(), n = 0
      const step = () => {
        const now = performance.now(); fr.push(now - last); last = now
        if (++n < 480) requestAnimationFrame(step); else { window.__fr = fr; res() }
      }
      requestAnimationFrame(step)
    }))
    out[n] = await page.evaluate(() => {
      const f = window.__fr.slice(30).sort((a, b) => a - b)
      const q = (p) => Math.round(f[Math.floor(f.length * p)] * 100) / 100
      const g = window.__capy
      return { n: f.length, median: q(0.5), p95: q(0.95),
               calls: g.renderer.info.render.calls,
               tris: g.renderer.info.render.triangles }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=zaperf.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
