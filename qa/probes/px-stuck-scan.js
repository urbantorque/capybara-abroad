async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 900, height: 560 })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  const CH = ['kyoto', 'cali', 'rio', 'pantanal', 'goreme', 'manly']

  const SCAN = () => {
    const g = window.__capy, CANNON = g.CANNON
    const capy = g.capy, b = capy.body
    const nm = g.biome.current
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : NaN; return typeof v === 'number' ? v : NaN }
    const ow = api && typeof api.isOverWater === 'function' ? (x, z) => !!api.isOverWater(x, z) : () => false
    // world extent from the heightfields
    let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9
    for (const bd of g.world.bodies) {
      if (bd.mass !== 0) continue
      for (const s of bd.shapes) {
        if (!(s instanceof CANNON.Heightfield)) continue
        X0 = Math.min(X0, bd.position.x); X1 = Math.max(X1, bd.position.x + (s.data.length - 1) * s.elementSize)
        Z1 = Math.max(Z1, bd.position.z); Z0 = Math.min(Z0, bd.position.z - (s.data[0].length - 1) * s.elementSize)
      }
    }
    if (X0 > X1) return { nm, err: 'no heightfield' }
    const pts = []
    const N = 7
    for (let i = 1; i < N; i++) for (let k = 1; k < N; k++) {
      const x = X0 + (X1 - X0) * i / N, z = Z0 + (Z1 - Z0) * k / N
      if (ow(x, z)) continue
      const h = th(x, z); if (!(h === h)) continue
      pts.push([x, z, h])
    }
    const out = []
    for (const [x, z, h] of pts) {
      b.position.set(x, h + 0.5, z)
      b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let t = 0; t < 70; t++) g.tick(1 / 60, false)
      let up = 0
      for (const c of g.world.contacts) {
        if (c.bi === b) { if (-c.ni.y > 0.4) up++ }
        else if (c.bj === b) { if (c.ni.y > 0.4) up++ }
      }
      const law = th(b.position.x, b.position.z)
      const gap = law + 0.34 - b.position.y
      out.push({ x: +x.toFixed(0), z: +z.toFixed(0), gap: +gap.toFixed(3), up,
                 gr: !!capy.grounded, drift: +Math.hypot(b.position.x - x, b.position.z - z).toFixed(2) })
    }
    return { nm, ext: [X0, X1, Z0, Z1], rows: out }
  }

  const res = { at: new Date().toISOString(), chapters: [] }
  for (const ch of CH) {
    try {
      await page.evaluate((nm) => { const g = window.__capy; if (g.biome.current !== nm) g.biome.switchTo(nm) }, ch)
      await page.waitForTimeout(4500)
      const r = await page.evaluate(SCAN)
      r.asked = ch
      res.chapters.push(r)
    } catch (e) { res.chapters.push({ asked: ch, error: String(e).slice(0, 200) }) }
  }
  await page.evaluate(o => fetch('/shot?name=px-stuck-scan.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))
  }), res)
}
