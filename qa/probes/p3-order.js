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
    const probe = (nm) => {
      g.biome.switchTo(nm)
      const sp = g.biome.spawnOf(nm), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const W = g.locals.filter(r => r.biome === live && r.fig)
      const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
        (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
      let owned = 0, best = 1e9
      const tags = {}
      for (const p of props) {
        tags[p.biome === undefined ? 'NOBIOME' : p.biome] =
          (tags[p.biome === undefined ? 'NOBIOME' : p.biome] || 0) + 1
        let bd = 11 * 11, hit = false
        for (const r of W) {
          const dx = p.homeX - r.ax, dz = p.homeZ - r.az
          const d2 = dx * dx + dz * dz
          if (d2 < bd) { bd = d2; hit = true }
          if (d2 < best) best = d2
        }
        if (hit) owned++
      }
      return { live, nProps: props.length, walkers: W.length, owned,
               closest: +Math.sqrt(best).toFixed(1), tags }
    }
    // FIRST: kyoto cold
    const cold = probe('kyoto')
    // now mimic pf-mischief's order and come back
    probe('sydney'); probe('pasto'); probe('quay')
    const warm = probe('kyoto')
    return { cold, warm }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p3order.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
