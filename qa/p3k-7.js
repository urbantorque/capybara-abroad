async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = {}
  out.spot = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('kyoto')
    const k = g.kyoto
    // scan a ring 10..16 m round perch A for FLAT DRY ground
    const cands = []
    for (let a = 0; a < 64; a++) {
      for (let d = 9; d <= 20; d += 0.5) {
        const x = 48 + Math.cos(a / 64 * 6.283) * d, z = -6 + Math.sin(a / 64 * 6.283) * d
        if (k.isOverWater(x, z)) continue
        const h = k.terrainHeight(x, z)
        if (h < k.waterLevel + 0.25) continue
        const s = k.slopeAt(x, z)
        cands.push({ x: +x.toFixed(1), z: +z.toFixed(1), h: +h.toFixed(2), s: +Number(s).toFixed(3), d: +d.toFixed(1) })
      }
    }
    cands.sort((a, b) => a.s - b.s || a.d - b.d)
    return { n: cands.length, best: cands.slice(0, 6) }
  })
  out.heron = await page.evaluate(async (spot) => {
    const g = window.__capy, k = g.kyoto, b = g.capy.body
    const s = spot.best[0]
    if (!s) return { err: 'no flat dry ground within 20 m of perch A' }
    b.position.set(s.x, k.terrainHeight(s.x, s.z) + 0.42, s.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const out = []
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const ca = g.hud.calmAudit(), c = ca.critters.find(x => x.live) || {}
      const h = k.heron(), cp = g.capy.position
      out.push({ t: +(i * 1.5).toFixed(1), calm: +ca.calm.toFixed(2), cl: +(g.capy.loaf || 0).toFixed(2),
        sw: !!g.capy.swimming, near: +Number(c.near || 0).toFixed(2), appr: +Number(c.appr || 0).toFixed(3),
        h: [+h.x.toFixed(1), +h.z.toFixed(1)], dC: +Math.hypot(h.x - cp.x, h.z - cp.z).toFixed(1),
        cx: +cp.x.toFixed(1), cz: +cp.z.toFixed(1), st: k.heronStanding() })
    }
    return { stand: s, samples: out }
  }, out.spot)
  await page.screenshot({ path: 'qa/p3k-heron.png' })

  // ---- pair chat: hunt the bubble DIVs by their known text ---------------
  out.chat = await page.evaluate(async () => {
    const g = window.__capy, k = g.kyoto, b = g.capy.body
    const x = -4.25, z = 63
    b.position.set(x, k.terrainHeight(x, z) + 0.42, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    const seen = []
    for (let i = 0; i < 55; i++) {
      await new Promise(r => setTimeout(r, 1200))
      const all = document.querySelectorAll('div, span')
      for (const e of all) {
        if (e.children.length > 1) continue
        const t = (e.textContent || '').trim()
        if (t.length < 4 || t.length > 120) continue
        if (!/[.!?…]$/.test(t)) continue
        if (getComputedStyle(e).position !== 'absolute') continue
        if (!seen.some(s => s.t === t)) seen.push({ t, at: +(i * 1.2).toFixed(1) })
      }
    }
    return { stand: { x, z }, bubbles: seen }
  })
  await page.screenshot({ path: 'qa/p3k-gion.png' })
  out.lastError = await page.evaluate(() => { const g = window.__capy; return g.state.lastError ? String(g.state.lastError).slice(0, 200) : null })
  await page.evaluate((o) => fetch('/shot?name=p3k7.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}