async page => {
  await page.reload(); await page.waitForTimeout(5200)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    const r = {}
    r.total = (g.npcs||[]).length
    r.keys = (g.npcs||[])[0] ? Object.keys(g.npcs[0]).slice(0,30) : []
    const kinds = {}
    for (const p of (g.npcs||[])) { const k = p.kind || p.type || p.biome || '?'; kinds[k] = (kinds[k]||0)+1 }
    r.kinds = kinds
    // which are alive in sydney vs pasto
    for (const n of ['sydney','pasto','quay']) {
      g.biome.switchTo(n); await sleep(1200)
      const live = new Set(); for (const bd of g.world.bodies) live.add(bd.id)
      let alive = 0
      for (const p of (g.npcs||[])) if (p && p.body && live.has(p.body.id)) alive++
      r[n] = alive
    }
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=npcshape.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
