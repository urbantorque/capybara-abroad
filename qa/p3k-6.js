async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}

  // ---- A. THE HERON, from DRY LAND --------------------------------------
  out.heron = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const k = g.kyoto, b = g.capy.body
    // find dry ground walking out east from perch A (48,-6)
    let sx = 48, sz = -6, found = null
    for (let d = 6; d < 40; d += 0.5) {
      const x = 48 + d
      if (!k.isOverWater(x, sz) && k.terrainHeight(x, sz) > k.waterLevel) { found = { x, z: sz, d }; break }
    }
    if (!found) return { err: 'no dry ground east of perch A' }
    const gy = k.terrainHeight(found.x, found.z)
    b.position.set(found.x, gy + 0.45, found.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const samples = []
    for (let i = 0; i < 22; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const ca = g.hud.calmAudit()
      const c = ca.critters.find(x => x.live) || {}
      const h = k.heron(), cp = g.capy.position
      samples.push({ t: +(i * 1.5).toFixed(1), calm: +ca.calm.toFixed(2), loaf: +ca.loaf.toFixed(2),
        cl: +(g.capy.loaf || 0).toFixed(2), sw: !!g.capy.swimming,
        near: +Number(c.near || 0).toFixed(2), appr: +Number(c.appr || 0).toFixed(2),
        hx: +h.x.toFixed(1), hz: +h.z.toFixed(1),
        dC: +Math.hypot(h.x - cp.x, h.z - cp.z).toFixed(1), st: k.heronStanding() })
    }
    return { stand: { x: found.x, z: found.z, y: +(gy + 0.45).toFixed(2), dFromPerch: found.d }, samples }
  })

  // ---- B. PAIR CHAT in the Gion lane ------------------------------------
  out.chat = await page.evaluate(async () => {
    const g = window.__capy, k = g.kyoto, b = g.capy.body
    // stand 11 m off the pair midpoint (-4.25, 52) — inside EX_MAX 26, outside EX_MIN 6
    const x = -4.25, z = 63
    const gy = k.terrainHeight(x, z)
    b.position.set(x, gy + 0.45, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const seen = []
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 1200))
      const bs = Array.from(document.querySelectorAll('[class*=bubble], .capyui-bub, [class*=bub]'))
        .map(e => (e.textContent || '').trim()).filter(t => t.length)
      for (const t of bs) if (!seen.some(s => s.t === t)) seen.push({ t, at: +(i * 1.2).toFixed(1) })
    }
    return { stand: { x, z }, bubbles: seen }
  })
  out.lastError = await page.evaluate(() => { const g = window.__capy; return g.state.lastError ? String(g.state.lastError).slice(0, 200) : null })
  await page.evaluate((o) => fetch('/shot?name=p3k6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}