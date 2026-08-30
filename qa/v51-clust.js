async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const NAMES = ['quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic','monaco','hanoi']
  const out = []
  for (const n of NAMES) {
    out.push(await page.evaluate(async name => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(2500)
      const pts = []
      for (const q of (g.locals || [])) {
        if (!q || q.biome !== name) continue
        const x = q.ax !== undefined ? q.ax : q.x
        const z = q.az !== undefined ? q.az : q.z
        if (!isFinite(x) || !isFinite(z)) continue
        pts.push({ x: x, z: z })
      }
      if (name === 'quay') {
        for (const q of (g.npcs || [])) {
          const p = q && q.group ? q.group.position : null
          if (!p || !isFinite(p.x)) continue
          pts.push({ x: p.x, z: p.z })
        }
      }
      // greedy clustering at 14 m
      const cl = []
      for (const p of pts) {
        let hit = null
        for (const c of cl) if (Math.hypot(c.x - p.x, c.z - p.z) < 14) { hit = c; break }
        if (hit) { hit.n++; hit.sx += p.x; hit.sz += p.z; hit.x = hit.sx / hit.n; hit.z = hit.sz / hit.n }
        else cl.push({ x: p.x, z: p.z, sx: p.x, sz: p.z, n: 1 })
      }
      cl.sort((a, b) => b.n - a.n)
      const api = g[name] || g.env
      const ok = (x, z) => {
        try {
          if (api && api.navBlocked && api.navBlocked(x, z, 1.2)) return false
          if (api && api.isOverWater && api.isOverWater(x, z)) return false
          return true
        } catch (e) { return false }
      }
      return {
        name, people: pts.length, spawn: { x: Math.round(sp.x), z: Math.round(sp.z) },
        top: cl.slice(0, 5).map(c => ({
          x: Math.round(c.x), z: Math.round(c.z), n: c.n,
          dSpawn: Math.round(Math.hypot(c.x - sp.x, c.z - sp.z)),
          ok: ok(c.x, c.z),
        })),
      }
    }, n))
  }
  await page.evaluate(o => fetch('/shot?name=v51clust.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
