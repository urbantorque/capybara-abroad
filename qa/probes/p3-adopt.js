async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(800)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = {}
  for (const name of ['kyoto', 'drift', 'rio', 'iceland', 'sahara', 'venice']) {
    out[name] = await page.evaluate(async (nm) => {
      const g = window.__capy
      g.biome.switchTo(nm)
      const sp = g.biome.spawnOf(nm), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const live = g.biome.current
      const L = g.locals.filter(r => r.biome === live && r.fig)
      const props = g.props.filter(p => !p.removed && !p.hidden && !p.keep &&
        (!p.biome || p.biome === live) && p.mass > 0 && p.mass <= 12)
      // nearest walker to each prop HOME
      const rows = props.map(p => {
        let bd = 1e9, who = -1
        for (let i = 0; i < L.length; i++) {
          const dx = p.homeX - L[i].x, dz = p.homeZ - L[i].z
          const d = Math.sqrt(dx * dx + dz * dz)
          if (d < bd) { bd = d; who = i }
        }
        return { t: p.type, hx: +p.homeX.toFixed(1), hz: +p.homeZ.toFixed(1), d: +bd.toFixed(1), who }
      }).sort((a, c) => a.d - c.d)
      // local spread
      const locs = L.map(r => ({ x: +r.x.toFixed(1), z: +r.z.toFixed(1) }))
      // closest pair of walkers
      let pd = 1e9, pi = -1, pj = -1
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const dx = L[i].x - L[j].x, dz = L[i].z - L[j].z
        const d = Math.sqrt(dx * dx + dz * dz)
        if (d < pd) { pd = d; pi = i; pj = j }
      }
      const sp2 = g.biome.spawnOf(nm)
      return { spawn: { x: +sp2.x.toFixed(1), z: +sp2.z.toFixed(1) },
               nProps: props.length, nWalkers: L.length,
               nearestPair: +pd.toFixed(1), pairIdx: [pi, pj],
               props: rows.slice(0, 10), locals: locs }
    }, name)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=p3adopt.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
