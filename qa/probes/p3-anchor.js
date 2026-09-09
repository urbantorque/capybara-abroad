async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const res = {}
    for (const nm of ['kyoto', 'venice', 'sahara']) {
      g.biome.switchTo(nm)
      const sp = g.biome.spawnOf(nm), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const L = g.locals.filter(r => r.biome === live && r.fig)
      res[nm] = L.map(r => ({ x: +r.x.toFixed(1), z: +r.z.toFixed(1),
        ax: r.ax === undefined ? 'UNDEF' : +r.ax.toFixed(1),
        az: r.az === undefined ? 'UNDEF' : +r.az.toFixed(1),
        keys: r.ax === undefined ? Object.keys(r).slice(0, 24).join(',') : '' }))
    }
    return res
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p3anchor.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
