async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const o = { spoke: [] }
    try {
      g.biome.switchTo('palawan')
      const api = g.palawan
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
      const L = (g.locals || []).filter(r => r.biome === 'palawan')
      o.n = L.length
      o.keys = L.length ? Object.keys(L[0]).slice(0, 40) : []
      function tryPair(ax, az, bx, bz, tag) {
        const mx = (ax + bx) / 2, mz = (az + bz) / 2
        const b = g.capy.body
        b.position.set(mx, api.terrainHeight(mx, mz) + 0.8, mz); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        g.input.x = 0; g.input.z = 0
        let said = 0, who = {}
        for (let i = 0; i < 60 * 12; i++) {
          g.tick(1 / 60, false)
          for (let j = 0; j < L.length; j++) {
            const r = L[j]
            const t = (r.bubbleT || r.sayT || (r.anchor && r.anchor.bubbleT) || 0)
            if (t > 0) { said++; who[j] = (who[j] || 0) + 1 }
          }
        }
        o.spoke.push({ tag, sep: +Math.hypot(ax - bx, az - bz).toFixed(1), said, who })
      }
      tryPair(6.6, 25.5, 5.3, 16, 'boy/boatman')
      tryPair(-22, 51, 4.5, 55, 'netman/fire')
      tryPair(16, 52.5, 38, 42, 'drying/painter')
    } catch (e) { o.err = String(e).slice(0, 200) }
    o.lastError = g.state.lastError ? String(g.state.lastError).slice(0, 200) : null
    return o
  })
  await page.evaluate(async d => {
    await fetch('/shot?name=b4pal-9.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(d)))) })
  }, out)
}
